import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from '../macroManager';

/**
 * LPC 文件路径解析器
 *
 * 统一处理各种 LPC 文件路径解析场景：
 * - Include 路径解析（支持全局和本地）
 * - Inherit 路径解析（支持宏展开）
 * - 宏路径解析
 * - 对象方法调用的文件路径解析
 */
export class PathResolver {
    private static workspaceConfigCache: Map<string, string> = new Map();
    private static cacheTimeout = 5000; // 5秒缓存
    private static lastCacheTime = 0;

    /**
     * 解析 include 路径
     *
     * @param currentDocument 当前文档
     * @param includePath include 路径（从 include 语句中提取）
     * @param isGlobalInclude 是否是全局包含（<> 而不是 ""）
     * @returns 解析后的完整文件路径，如果文件不存在返回 undefined
     *
     * @example
     * // 全局包含: #include <command.h>
     * resolveIncludePath(document, "command.h", true)
     *
     * // 本地包含: #include "myheader.h"
     * resolveIncludePath(document, "myheader.h", false)
     *
     * // 绝对路径: #include "/system/daemons/combat_d.h"
     * resolveIncludePath(document, "/system/daemons/combat_d.h", false)
     */
    static async resolveIncludePath(
        currentDocument: vscode.TextDocument,
        includePath: string,
        isGlobalInclude: boolean
    ): Promise<string | undefined> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocument.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        // 确保文件名有 .h 扩展名
        let fileName = includePath;
        if (!fileName.endsWith('.h') && !fileName.endsWith('.c')) {
            fileName += '.h';
        }

        let targetPath: string;

        if (isGlobalInclude) {
            // 全局包含路径：#include <command.h>
            const globalIncludePath = await this.getGlobalIncludePath(workspaceFolder);
            targetPath = path.join(globalIncludePath, fileName);
        } else {
            // 本地包含路径：#include "path.h"
            targetPath = this.resolveLocalPath(
                currentDocument,
                workspaceFolder,
                fileName
            );
        }

        // 检查文件是否存在
        return this.fileExists(targetPath) ? targetPath : undefined;
    }

    /**
     * 解析 inherit 路径（支持宏展开）
     *
     * @param currentDocument 当前文档
     * @param inheritPath inherit 路径（可能是宏名或文件路径）
     * @param macroManager 宏管理器实例
     * @returns 解析后的文件路径数组（可能匹配多个位置）
     *
     * @example
     * // 直接路径: inherit "/std/object";
     * resolveInheritPath(document, "/std/object", macroManager)
     *
     * // 宏路径: inherit OBJECT;
     * resolveInheritPath(document, "OBJECT", macroManager)
     *
     * // 相对路径: inherit "base";
     * resolveInheritPath(document, "base", macroManager)
     */
    static async resolveInheritPath(
        currentDocument: vscode.TextDocument,
        inheritPath: string,
        macroManager?: MacroManager
    ): Promise<string[]> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocument.uri);
        if (!workspaceFolder) {
            return [];
        }

        // 移除引号
        let cleanPath = inheritPath.replace(/^["']|["']$/g, '');

        // 如果是宏，尝试展开
        if (macroManager && /^[A-Z_][A-Z0-9_]*$/.test(cleanPath)) {
            const resolvedPath = await this.resolveMacroPath(cleanPath, macroManager);
            if (resolvedPath) {
                cleanPath = resolvedPath;
            } else {
                // 无法解析宏，返回空数组
                return [];
            }
        }

        // 确保有 .c 扩展名
        if (!cleanPath.endsWith('.c')) {
            cleanPath += '.c';
        }

        // 构建可能的文件路径
        const possiblePaths = this.buildPossiblePaths(
            currentDocument,
            workspaceFolder,
            cleanPath
        );

        // 返回存在的路径
        return possiblePaths.filter(p => this.fileExists(p));
    }

    /**
     * 解析宏定义的路径
     *
     * @param macroName 宏名称
     * @param macroManager 宏管理器实例
     * @returns 宏展开后的路径，如果无法解析返回 undefined
     *
     * @example
     * // #define COMBAT_D "/system/daemons/combat_d"
     * resolveMacroPath("COMBAT_D", macroManager)
     * // 返回: "/system/daemons/combat_d"
     */
    static async resolveMacroPath(
        macroName: string,
        macroManager: MacroManager
    ): Promise<string | undefined> {
        const macro = macroManager.getMacro(macroName);
        if (!macro) {
            return undefined;
        }

        // 移除宏值中的引号
        return macro.value.replace(/^["']|["']$/g, '');
    }

    /**
     * 解析对象方法调用的文件路径（用于 OBJECT->method() 语法）
     *
     * @param currentDocument 当前文档
     * @param pathExpression 路径表达式（可能是字符串字面量或宏）
     * @param macroManager 宏管理器实例
     * @returns 解析后的完整文件路径，如果无法解析返回 undefined
     *
     * @example
     * // 字符串字面量: USER_OB->query_name()
     * // 其中 USER_OB 是 #define USER_OB "/std/user"
     * resolveObjectPath(document, "USER_OB", macroManager)
     *
     * // 直接字符串: "/system/daemons/combat_d"->start()
     * resolveObjectPath(document, '"/system/daemons/combat_d"', macroManager)
     */
    static async resolveObjectPath(
        currentDocument: vscode.TextDocument,
        pathExpression: string,
        macroManager?: MacroManager
    ): Promise<string | undefined> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocument.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        let targetPath: string;

        // 检查是否是字符串字面量
        if (pathExpression.startsWith('"') && pathExpression.endsWith('"')) {
            targetPath = pathExpression.slice(1, -1);
        }
        // 检查是否是宏
        else if (macroManager && /^[A-Z_][A-Z0-9_]*$/.test(pathExpression)) {
            const macroPath = await this.resolveMacroPath(pathExpression, macroManager);
            if (!macroPath) {
                return undefined;
            }
            targetPath = macroPath;
        } else {
            return undefined;
        }

        // 确保有 .c 扩展名
        if (!targetPath.endsWith('.c')) {
            targetPath += '.c';
        }

        // 解析为绝对路径
        let fullPath: string;
        if (targetPath.startsWith('/')) {
            // LPC 绝对路径（相对于工作区根目录）
            fullPath = path.join(workspaceFolder.uri.fsPath, targetPath.substring(1));
        } else {
            // 相对路径
            fullPath = path.join(path.dirname(currentDocument.uri.fsPath), targetPath);
        }

        return this.fileExists(fullPath) ? fullPath : undefined;
    }

    /**
     * 在工作区中查找文件
     * 支持模糊匹配和多种搜索策略
     *
     * @param workspaceFolder 工作区文件夹
     * @param fileName 文件名（可以是部分名称）
     * @param extensions 要搜索的文件扩展名列表
     * @returns 找到的文件路径数组
     *
     * @example
     * // 查找所有名为 "combat_d" 的文件
     * findFileInWorkspace(workspace, "combat_d", [".c", ".h"])
     */
    static async findFileInWorkspace(
        workspaceFolder: vscode.WorkspaceFolder,
        fileName: string,
        extensions: string[] = ['.c', '.h']
    ): Promise<string[]> {
        const results: string[] = [];

        // 构建 glob 模式
        const patterns = extensions.map(ext => {
            const baseName = fileName.replace(/\.[^.]*$/, ''); // 移除扩展名
            return new vscode.RelativePattern(workspaceFolder, `**/${baseName}${ext}`);
        });

        // 搜索文件
        for (const pattern of patterns) {
            try {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
                results.push(...files.map(uri => uri.fsPath));
            } catch (error) {
                console.error(`查找文件时出错: ${error}`);
            }
        }

        return results;
    }

    /**
     * 标准化路径（处理不同平台的路径分隔符）
     *
     * @param filePath 要标准化的路径
     * @returns 标准化后的路径
     */
    static normalizePath(filePath: string): string {
        return path.normalize(filePath).replace(/\\/g, '/');
    }

    /**
     * 将 LPC 绝对路径转换为系统绝对路径
     *
     * @param lpcPath LPC 路径（以 / 开头）
     * @param workspaceFolder 工作区文件夹
     * @returns 系统绝对路径
     *
     * @example
     * // LPC 路径: "/system/daemons/combat_d.c"
     * // 工作区: "C:/workspace/mylib"
     * // 返回: "C:/workspace/mylib/system/daemons/combat_d.c"
     */
    static lpcPathToSystemPath(
        lpcPath: string,
        workspaceFolder: vscode.WorkspaceFolder
    ): string {
        const cleanPath = lpcPath.startsWith('/') ? lpcPath.substring(1) : lpcPath;
        return path.join(workspaceFolder.uri.fsPath, cleanPath);
    }

    /**
     * 将系统绝对路径转换为 LPC 绝对路径
     *
     * @param systemPath 系统绝对路径
     * @param workspaceFolder 工作区文件夹
     * @returns LPC 路径（以 / 开头）
     *
     * @example
     * // 系统路径: "C:/workspace/mylib/system/daemons/combat_d.c"
     * // 工作区: "C:/workspace/mylib"
     * // 返回: "/system/daemons/combat_d.c"
     */
    static systemPathToLpcPath(
        systemPath: string,
        workspaceFolder: vscode.WorkspaceFolder
    ): string {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, systemPath);
        return '/' + relativePath.replace(/\\/g, '/');
    }

    // ============ 私有辅助方法 ============

    /**
     * 获取全局包含路径
     */
    private static async getGlobalIncludePath(
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<string> {
        // 检查缓存
        const now = Date.now();
        if (now - this.lastCacheTime < this.cacheTimeout) {
            const cached = this.workspaceConfigCache.get(workspaceFolder.uri.toString());
            if (cached) {
                return cached;
            }
        }

        // 读取配置
        const config = vscode.workspace.getConfiguration('lpc');
        let includePath = config.get<string>('includePath');

        if (!includePath) {
            // 默认使用工作区根目录下的 include 文件夹
            includePath = path.join(workspaceFolder.uri.fsPath, 'include');
        } else {
            // 支持相对于项目根目录的路径
            includePath = this.resolveProjectPath(workspaceFolder.uri.fsPath, includePath);
        }

        // 更新缓存
        this.workspaceConfigCache.set(workspaceFolder.uri.toString(), includePath);
        this.lastCacheTime = now;

        return includePath;
    }

    /**
     * 解析本地路径（相对或绝对）
     */
    private static resolveLocalPath(
        currentDocument: vscode.TextDocument,
        workspaceFolder: vscode.WorkspaceFolder,
        fileName: string
    ): string {
        if (fileName.startsWith('/')) {
            // LPC 绝对路径（相对于工作区根目录）
            return path.join(workspaceFolder.uri.fsPath, fileName.substring(1));
        } else {
            // 相对路径（相对于当前文件所在目录）
            const currentDir = path.dirname(currentDocument.uri.fsPath);
            return path.resolve(currentDir, fileName);
        }
    }

    /**
     * 构建可能的文件路径列表
     */
    private static buildPossiblePaths(
        currentDocument: vscode.TextDocument,
        workspaceFolder: vscode.WorkspaceFolder,
        filePath: string
    ): string[] {
        const possiblePaths: string[] = [];

        if (filePath.startsWith('/')) {
            // LPC 绝对路径
            const relativePath = filePath.substring(1);
            possiblePaths.push(
                path.join(workspaceFolder.uri.fsPath, relativePath),
                path.join(workspaceFolder.uri.fsPath, relativePath.replace(/\.c$/, ''))
            );
        } else {
            // 相对路径：尝试相对于当前文件和工作区根目录
            const currentDir = path.dirname(currentDocument.uri.fsPath);
            possiblePaths.push(
                path.join(currentDir, filePath),
                path.join(currentDir, filePath.replace(/\.c$/, '')),
                path.join(workspaceFolder.uri.fsPath, filePath),
                path.join(workspaceFolder.uri.fsPath, filePath.replace(/\.c$/, ''))
            );
        }

        return possiblePaths;
    }

    /**
     * 解析项目相对路径
     */
    private static resolveProjectPath(workspaceRoot: string, configPath: string): string {
        if (path.isAbsolute(configPath)) {
            return configPath;
        } else {
            return path.join(workspaceRoot, configPath);
        }
    }

    /**
     * 检查文件是否存在
     */
    private static fileExists(filePath: string): boolean {
        try {
            return fs.existsSync(filePath);
        } catch {
            return false;
        }
    }

    /**
     * 清除配置缓存
     */
    static clearCache(): void {
        this.workspaceConfigCache.clear();
        this.lastCacheTime = 0;
    }
}

/**
 * 路径解析结果接口
 */
export interface PathResolutionResult {
    /** 解析成功的文件路径 */
    resolvedPath: string;
    /** 路径类型 */
    type: 'include' | 'inherit' | 'object' | 'macro';
    /** 是否通过宏展开 */
    isMacroExpanded: boolean;
    /** 原始路径表达式 */
    originalPath: string;
}

/**
 * 路径解析选项
 */
export interface PathResolverOptions {
    /** 是否检查文件存在性 */
    checkExists?: boolean;
    /** 允许的文件扩展名 */
    allowedExtensions?: string[];
    /** 是否启用宏展开 */
    enableMacroExpansion?: boolean;
    /** 搜索深度限制 */
    maxSearchDepth?: number;
}
