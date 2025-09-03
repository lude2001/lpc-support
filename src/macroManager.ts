import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MacroDefinition } from './types';

export class MacroManager {
    private macros: Map<string, MacroDefinition> = new Map();
    private includePath: string | undefined;
    private watcher: vscode.FileSystemWatcher | undefined;
    private scanningComplete: boolean = false;
    private scanningPromise: Promise<void> | null = null;

    constructor() {
        this.loadIncludePath();
        this.setupFileWatcher();
        this.startInitialScan();
    }

    private async loadIncludePath() {
        const config = vscode.workspace.getConfiguration('lpc');
        const configPath = config.get<string>('includePath');
        
        if (!configPath && vscode.workspace.workspaceFolders?.[0]) {
            // 默认使用工作区根目录下的 include 文件夹
            this.includePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'include');
        } else if (configPath && vscode.workspace.workspaceFolders?.[0]) {
            // 支持相对于项目根目录的路径
            this.includePath = this.resolveProjectPath(vscode.workspace.workspaceFolders[0].uri.fsPath, configPath);
        }

        console.log(`MacroManager: 配置的包含路径: ${this.includePath || '未配置'}`);
        
        if (this.includePath) {
            if (fs.existsSync(this.includePath)) {
                console.log(`MacroManager: 包含路径存在，开始扫描宏定义`);
                await this.scanMacros();
            } else {
                console.warn(`MacroManager: 包含路径不存在: ${this.includePath}`);
            }
        } else {
            console.warn(`MacroManager: 未配置包含路径，无法扫描宏定义`);
        }
    }

    private setupFileWatcher() {
        if (this.includePath) {
            // 监听头文件变化
            this.watcher?.dispose();
            this.watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(this.includePath, '**/*.h')
            );

            this.watcher.onDidChange(() => this.scanMacros());
            this.watcher.onDidCreate(() => this.scanMacros());
            this.watcher.onDidDelete(() => this.scanMacros());
        }
    }

    public async setIncludePath(newPath: string) {
        this.includePath = newPath;
        await this.scanMacros();
        this.setupFileWatcher();
        
        // 保存配置
        await vscode.workspace.getConfiguration('lpc').update('includePath', newPath, true);
    }

    public async scanMacros(progress?: vscode.Progress<{ message?: string }>) {
        this.macros.clear();
        if (!this.includePath || !fs.existsSync(this.includePath)) {
            console.warn(`MacroManager: 无法扫描宏定义 - 路径无效: ${this.includePath}`);
            return;
        }

        const startTime = Date.now();
        await this.scanDirectory(this.includePath, progress);
        const endTime = Date.now();
        
        console.log(`MacroManager: 扫描完成，共找到 ${this.macros.size} 个宏定义，耗时 ${endTime - startTime}ms`);
        
        // 输出一些统计信息
        if (this.macros.size > 0) {
            const files = new Set(Array.from(this.macros.values()).map(m => m.file));
            console.log(`MacroManager: 扫描了 ${files.size} 个文件`);
        }
    }

    private async scanDirectory(dirPath: string, progress?: vscode.Progress<{ message?: string }>) {
        const files = await fs.promises.readdir(dirPath);
        
        for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = await fs.promises.stat(fullPath);
            
            if (progress) {
                progress.report({ message: `扫描: ${path.relative(this.includePath!, fullPath)}` });
            }
            
            if (stat.isDirectory()) {
                await this.scanDirectory(fullPath, progress);
            } else if (file.endsWith('.h')) {
                await this.scanFile(fullPath);
            }
        }
    }

    private async scanFile(filePath: string) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            let currentComment = '';
            let macrosFoundInFile = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // 收集注释
                if (line.startsWith('//')) {
                    currentComment += line.substring(2).trim() + '\n';
                    continue;
                } else if (line.startsWith('/*')) {
                    // 处理多行注释
                    let j = i;
                    let commentBlock = '';
                    while (j < lines.length && !lines[j].includes('*/')) {
                        commentBlock += lines[j].replace(/^\/\*/, '').trim() + '\n';
                        j++;
                    }
                    if (j < lines.length) {
                        commentBlock += lines[j].replace(/\*\/.*$/, '').trim();
                        i = j;
                    }
                    currentComment = commentBlock;
                    continue;
                }
                
                // 匹配 #define 宏定义
                const match = line.match(/^#define\s+([A-Z_][A-Z0-9_]*)\s+(.+)$/);
                if (match) {
                    const [, name, value] = match;
                    this.macros.set(name, {
                        name,
                        value: value.trim().replace(/^"(.*)"$/, '$1'),
                        file: filePath,
                        line: i + 1,
                        description: currentComment.trim() || undefined
                    });
                    macrosFoundInFile++;
                    currentComment = ''; // 重置注释
                } else if (line.length > 0) {
                    currentComment = ''; // 如果遇到非空行且不是宏定义，重置注释
                }
            }
            
            // 输出调试信息
            if (macrosFoundInFile > 0) {
                console.log(`MacroManager: 在 ${filePath} 中找到 ${macrosFoundInFile} 个宏定义`);
            }
        } catch (error) {
            console.error(`MacroManager: 扫描文件 ${filePath} 时出错:`, error);
        }
    }

    public getMacro(name: string): MacroDefinition | undefined {
        return this.macros.get(name);
    }

    public getAllMacros(): MacroDefinition[] {
        return Array.from(this.macros.values());
    }

    public async showMacrosList() {
        const items = this.getAllMacros().map(macro => ({
            label: macro.name,
            description: macro.value,
            detail: `Defined in ${path.relative(this.includePath!, macro.file)}:${macro.line}`,
            macro: macro
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择宏定义以查看详情或跳转到定义',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const document = await vscode.workspace.openTextDocument(selected.macro.file);
            const position = new vscode.Position(selected.macro.line - 1, 0);
            await vscode.window.showTextDocument(document, {
                selection: new vscode.Selection(position, position)
            });
        }
    }

    public async configurePath() {
        const currentPath = this.includePath || '';
        
        const newPath = await vscode.window.showInputBox({
            prompt: '设置宏定义包含目录路径',
            value: currentPath,
            placeHolder: '例如: /path/to/your/include'
        });

        if (newPath) {
            await this.setIncludePath(newPath);
            await this.scanMacros();
            vscode.window.showInformationMessage(`已更新宏定义目录: ${newPath}`);
        }
    }

    public getIncludePath(): string | undefined {
        return this.includePath;
    }

    public dispose() {
        this.watcher?.dispose();
    }

    public async refreshMacros(): Promise<void> {
        // 重新加载宏定义
        await this.scanMacros();
    }

    public async canResolveMacro(macroName: string): Promise<boolean> {
        // 等待初始扫描完成
        if (this.scanningPromise) {
            await this.scanningPromise;
        }

        // 检查是否可以解析宏
        return this.getMacro(macroName) !== undefined;
    }

    private async startInitialScan() {
        this.scanningComplete = false;
        const progressOptions = {
            location: vscode.ProgressLocation.Window,
            title: "正在扫描宏定义..."
        };

        this.scanningPromise = Promise.resolve(
            vscode.window.withProgress(progressOptions, async (progress) => {
                await this.scanMacros(progress);
                this.scanningComplete = true;
            })
        );

        await this.scanningPromise;
    }

    public getMacroHoverContent(macro: MacroDefinition): vscode.MarkdownString {
        const content = new vscode.MarkdownString();
        
        // 添加宏定义标题
        content.appendMarkdown(`### 宏定义: \`${macro.name}\`\n\n`);
        
        // 添加宏的值
        content.appendCodeblock(`#define ${macro.name} ${macro.value}`, 'lpc');
        
        // 如果有描述，添加描述部分
        if (macro.description) {
            content.appendMarkdown('\n**描述**:\n');
            content.appendMarkdown(macro.description);
        }
        
        // 添加文件位置信息
        const relativePath = this.includePath ? 
            path.relative(this.includePath, macro.file) : 
            macro.file;
        content.appendMarkdown(`\n\n*定义于 [${relativePath}:${macro.line}](${vscode.Uri.file(macro.file).toString()})*`);
        
        content.isTrusted = true;
        return content;
    }

    /**
     * 解析项目相对路径
     * 支持相对于项目根目录的路径配置
     */
    private resolveProjectPath(workspaceRoot: string, configPath: string): string {
        if (path.isAbsolute(configPath)) {
            // 绝对路径直接返回
            return configPath;
        } else {
            // 相对路径，相对于项目根目录
            return path.join(workspaceRoot, configPath);
        }
    }
} 