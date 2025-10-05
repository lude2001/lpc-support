/**
 * PathResolver 使用示例
 *
 * 本文件展示了如何在不同场景下使用 PathResolver 工具类
 */

import * as vscode from 'vscode';
import { PathResolver } from './pathResolver';
import { MacroManager } from '../macroManager';

// ============ 示例 1: 解析 Include 路径 ============

/**
 * 场景: 用户在编辑器中点击 include 语句中的文件名，需要跳转到该文件
 */
async function example1_handleIncludeDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.Location | undefined> {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // 匹配 include 语句
    const includeMatch = lineText.match(/^#?include\s+([<"])([^>"]+)[>"](?:\s*\/\/.*)?$/);
    if (!includeMatch) {
        return undefined;
    }

    const [, quoteType, includePath] = includeMatch;
    const isGlobalInclude = quoteType === '<';

    // 使用 PathResolver 解析路径
    const resolvedPath = await PathResolver.resolveIncludePath(
        document,
        includePath,
        isGlobalInclude
    );

    if (resolvedPath) {
        const fileUri = vscode.Uri.file(resolvedPath);
        return new vscode.Location(fileUri, new vscode.Position(0, 0));
    }

    return undefined;
}

// ============ 示例 2: 解析 Inherit 路径（带宏展开） ============

/**
 * 场景: 查找继承文件中的函数定义
 */
async function example2_findInheritedFunctionDefinitions(
    document: vscode.TextDocument,
    macroManager: MacroManager
): Promise<Map<string, vscode.Location>> {
    const functionDefinitions = new Map<string, vscode.Location>();
    const text = document.getText();

    // 匹配 inherit 语句
    const inheritRegex = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*;/g;
    let match;

    while ((match = inheritRegex.exec(text)) !== null) {
        const inheritPath = match[1] || match[2]; // 可能是字符串或宏名

        // 使用 PathResolver 解析继承路径
        const resolvedPaths = await PathResolver.resolveInheritPath(
            document,
            inheritPath,
            macroManager
        );

        // 遍历所有可能的路径（可能匹配多个位置）
        for (const filePath of resolvedPaths) {
            try {
                const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                // 在继承文件中查找函数定义
                const functions = await findFunctionsInDocument(inheritedDoc);

                // 合并到结果中
                for (const [name, location] of functions) {
                    if (!functionDefinitions.has(name)) {
                        functionDefinitions.set(name, location);
                    }
                }
            } catch (error) {
                console.error(`无法打开继承文件 ${filePath}:`, error);
            }
        }
    }

    return functionDefinitions;
}

// ============ 示例 3: 解析对象方法调用 ============

/**
 * 场景: 用户点击 OBJECT->method() 中的 method，需要跳转到对象文件中的方法定义
 */
async function example3_handleObjectMethodCall(
    document: vscode.TextDocument,
    objectExpression: string, // 例如 "COMBAT_D" 或 '"/system/daemons/combat_d"'
    methodName: string,
    macroManager: MacroManager
): Promise<vscode.Location | undefined> {
    // 使用 PathResolver 解析对象路径
    const objectFilePath = await PathResolver.resolveObjectPath(
        document,
        objectExpression,
        macroManager
    );

    if (!objectFilePath) {
        return undefined;
    }

    try {
        // 打开对象文件
        const targetDoc = await vscode.workspace.openTextDocument(objectFilePath);

        // 在文件中查找方法定义
        return await findMethodInDocument(targetDoc, methodName);
    } catch (error) {
        console.error(`无法打开对象文件 ${objectFilePath}:`, error);
        return undefined;
    }
}

// ============ 示例 4: 批量查找文件 ============

/**
 * 场景: 在代码补全时，需要查找所有可能的继承文件
 */
async function example4_findInheritCandidates(
    workspaceFolder: vscode.WorkspaceFolder,
    partialName: string
): Promise<string[]> {
    // 使用 PathResolver 在工作区中查找文件
    const files = await PathResolver.findFileInWorkspace(
        workspaceFolder,
        partialName,
        ['.c'] // 只查找 .c 文件（继承文件）
    );

    return files;
}

// ============ 示例 5: 路径转换 ============

/**
 * 场景: 在诊断消息中显示相对路径，而不是绝对路径
 */
function example5_pathConversion(
    systemPath: string,
    workspaceFolder: vscode.WorkspaceFolder
): string {
    // 将系统路径转换为 LPC 路径
    const lpcPath = PathResolver.systemPathToLpcPath(systemPath, workspaceFolder);

    // LPC 路径更易读: "/system/daemons/combat_d.c"
    // 而不是: "C:/workspace/mylib/system/daemons/combat_d.c"
    return lpcPath;
}

/**
 * 场景: 从用户输入的 LPC 路径打开文件
 */
function example6_openFileFromLpcPath(
    lpcPath: string,
    workspaceFolder: vscode.WorkspaceFolder
): void {
    // 将 LPC 路径转换为系统路径
    const systemPath = PathResolver.lpcPathToSystemPath(lpcPath, workspaceFolder);

    // 打开文件
    vscode.workspace.openTextDocument(systemPath).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}

// ============ 示例 7: 综合应用 - 完整的定义跳转提供器 ============

/**
 * 场景: 实现一个完整的定义跳转提供器
 */
class EnhancedDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private macroManager: MacroManager) {}

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | undefined> {
        const line = document.lineAt(position.line);
        const lineText = line.text;

        // 1. 检查是否是 include 语句
        if (lineText.includes('include')) {
            const includeMatch = lineText.match(/^#?include\s+([<"])([^>"]+)[>"](?:\s*\/\/.*)?$/);
            if (includeMatch) {
                const [, quoteType, includePath] = includeMatch;
                const isGlobalInclude = quoteType === '<';

                const resolvedPath = await PathResolver.resolveIncludePath(
                    document,
                    includePath,
                    isGlobalInclude
                );

                if (resolvedPath) {
                    return new vscode.Location(
                        vscode.Uri.file(resolvedPath),
                        new vscode.Position(0, 0)
                    );
                }
            }
        }

        // 2. 检查是否是 inherit 语句
        if (lineText.includes('inherit')) {
            const inheritMatch = lineText.match(/inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*;/);
            if (inheritMatch) {
                const inheritPath = inheritMatch[1] || inheritMatch[2];

                const resolvedPaths = await PathResolver.resolveInheritPath(
                    document,
                    inheritPath,
                    this.macroManager
                );

                if (resolvedPaths.length > 0) {
                    // 如果有多个匹配，返回第一个
                    return new vscode.Location(
                        vscode.Uri.file(resolvedPaths[0]),
                        new vscode.Position(0, 0)
                    );
                }
            }
        }

        // 3. 检查是否是对象方法调用
        const wordRange = document.getWordRangeAtPosition(position);
        if (wordRange) {
            const word = document.getText(wordRange);
            const objectAccessMatch = lineText.match(
                /\b([A-Z_][A-Z0-9_]*|"[^"]+"\s*)\s*->\s*(\w+)\s*\(/
            );

            if (objectAccessMatch && objectAccessMatch[2] === word) {
                const objectExpr = objectAccessMatch[1].trim();
                const methodName = objectAccessMatch[2];

                return await example3_handleObjectMethodCall(
                    document,
                    objectExpr,
                    methodName,
                    this.macroManager
                );
            }
        }

        return undefined;
    }
}

// ============ 辅助函数 ============

async function findFunctionsInDocument(
    document: vscode.TextDocument
): Promise<Map<string, vscode.Location>> {
    // 实现函数查找逻辑
    // 这里只是示例，实际实现应使用 AST
    return new Map();
}

async function findMethodInDocument(
    document: vscode.TextDocument,
    methodName: string
): Promise<vscode.Location | undefined> {
    // 实现方法查找逻辑
    // 这里只是示例，实际实现应使用 AST
    return undefined;
}

// ============ 错误处理示例 ============

/**
 * 场景: 使用 try-catch 处理路径解析错误
 */
async function example8_errorHandling(
    document: vscode.TextDocument,
    includePath: string,
    isGlobalInclude: boolean
): Promise<void> {
    try {
        const resolvedPath = await PathResolver.resolveIncludePath(
            document,
            includePath,
            isGlobalInclude
        );

        if (!resolvedPath) {
            vscode.window.showWarningMessage(
                `无法找到包含文件: ${includePath}`
            );
            return;
        }

        // 使用解析后的路径
        const fileUri = vscode.Uri.file(resolvedPath);
        await vscode.window.showTextDocument(fileUri);

    } catch (error) {
        vscode.window.showErrorMessage(
            `路径解析失败: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

// ============ 性能优化示例 ============

/**
 * 场景: 批量解析路径，使用并行处理提升性能
 */
async function example9_batchResolve(
    document: vscode.TextDocument,
    inheritPaths: string[],
    macroManager: MacroManager
): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    // 并行解析所有路径
    const resolvePromises = inheritPaths.map(async (inheritPath) => {
        const resolvedPaths = await PathResolver.resolveInheritPath(
            document,
            inheritPath,
            macroManager
        );
        return { inheritPath, resolvedPaths };
    });

    const allResults = await Promise.all(resolvePromises);

    // 收集结果
    for (const { inheritPath, resolvedPaths } of allResults) {
        if (resolvedPaths.length > 0) {
            results.set(inheritPath, resolvedPaths);
        }
    }

    return results;
}

export {
    example1_handleIncludeDefinition,
    example2_findInheritedFunctionDefinitions,
    example3_handleObjectMethodCall,
    example4_findInheritCandidates,
    example5_pathConversion,
    example6_openFileFromLpcPath,
    EnhancedDefinitionProvider,
    example8_errorHandling,
    example9_batchResolve,
};
