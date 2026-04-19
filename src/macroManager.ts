import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { defaultTextDocumentHost } from './language/shared/WorkspaceDocumentPathSupport';
import { MacroDefinition } from './types';
import { LpcProjectConfigService } from './projectConfig/LpcProjectConfigService';

export class MacroManager {
    private macros: Map<string, MacroDefinition> = new Map();
    private includePath: string | undefined;
    private watcher: vscode.FileSystemWatcher | undefined;
    private scanningPromise: Promise<void> | null = null;
    private readonly initializationPromise: Promise<void>;

    constructor(private readonly projectConfigService?: LpcProjectConfigService) {
        this.initializationPromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.loadIncludePath();
        this.setupFileWatcher();
        await this.startInitialScan();
    }

    private async loadIncludePath(): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();

        if (workspaceRoot && this.projectConfigService) {
            this.includePath = await this.projectConfigService.getPrimaryIncludeDirectoryForWorkspace(workspaceRoot);
        }

        console.log(`MacroManager: 配置的包含路径: ${this.includePath || '未配置'}`);

        if (!this.includePath) {
            console.warn(`MacroManager: 未配置包含路径，无法扫描宏定义`);
            return;
        }

        if (!this.hasValidIncludePath()) {
            console.warn(`MacroManager: 包含路径不存在: ${this.includePath}`);
            return;
        }

        console.log(`MacroManager: 包含路径存在，开始扫描宏定义`);
        await this.scanMacros();
    }

    private setupFileWatcher(): void {
        this.watcher?.dispose();

        if (!this.includePath) {
            return;
        }

        this.watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.includePath, '**/*.h')
        );

        this.watcher.onDidChange(() => void this.refreshMacros());
        this.watcher.onDidCreate(() => void this.refreshMacros());
        this.watcher.onDidDelete(() => void this.refreshMacros());
    }

    public async setIncludePath(newPath: string): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot || !this.projectConfigService) {
            throw new Error('当前工作区缺少可写入的 lpc-support.json，无法保存宏目录。');
        }

        const workspaceRelativePath = this.projectConfigService.toWorkspaceRelativePath(workspaceRoot, newPath);
        await this.projectConfigService.updateResolvedConfigForWorkspace(workspaceRoot, (resolvedConfig) => ({
            ...resolvedConfig,
            includeDirectories: [workspaceRelativePath]
        }));
        this.includePath = newPath;
        await this.scanMacros();
        this.setupFileWatcher();
    }

    public async scanMacros(progress?: vscode.Progress<{ message?: string }>) {
        this.macros.clear();
        if (!this.hasValidIncludePath()) {
            console.warn(`MacroManager: 无法扫描宏定义 - 路径无效: ${this.includePath}`);
            return;
        }

        const includePath = this.includePath!;
        const startTime = Date.now();
        await this.scanDirectory(includePath, progress);
        const endTime = Date.now();
        
        console.log(`MacroManager: 扫描完成，共找到 ${this.macros.size} 个宏定义，耗时 ${endTime - startTime}ms`);
        
        // 输出一些统计信息
        if (this.macros.size > 0) {
            const files = new Set(Array.from(this.macros.values()).map(m => m.file));
            console.log(`MacroManager: 扫描了 ${files.size} 个文件`);
        }
    }

    private async scanDirectory(dirPath: string, progress?: vscode.Progress<{ message?: string }>): Promise<void> {
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

    private async scanFile(filePath: string): Promise<void> {
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
                    currentComment = '';
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

    public async showMacrosList(): Promise<void> {
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
            const document = await defaultTextDocumentHost.openTextDocument(selected.macro.file);
            const position = new vscode.Position(selected.macro.line - 1, 0);
            await vscode.window.showTextDocument(document, {
                selection: new vscode.Selection(position, position)
            });
        }
    }

    public async configurePath(): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot || !this.projectConfigService) {
            vscode.window.showErrorMessage('当前工作区缺少可写入的 lpc-support.json，无法配置宏目录。');
            return;
        }

        const currentPath = this.includePath || '';

        const newPath = await vscode.window.showInputBox({
            prompt: '设置写入 lpc-support.json 的宏定义包含目录路径',
            value: currentPath,
            placeHolder: '例如: /path/to/your/include'
        });

        if (newPath) {
            await this.setIncludePath(newPath);
            vscode.window.showInformationMessage(`已更新宏定义目录: ${newPath}`);
        }
    }

    public getIncludePath(): string | undefined {
        return this.includePath;
    }

    public dispose(): void {
        this.watcher?.dispose();
    }

    public async refreshMacros(): Promise<void> {
        await this.initializationPromise;

        // 重新加载宏定义
        await this.scanMacros();
    }

    public async canResolveMacro(macroName: string): Promise<boolean> {
        await this.initializationPromise;

        // 等待初始扫描完成
        if (this.scanningPromise) {
            await this.scanningPromise;
        }

        // 检查是否可以解析宏
        return this.getMacro(macroName) !== undefined;
    }

    private async startInitialScan(): Promise<void> {
        const progressOptions = {
            location: vscode.ProgressLocation.Window,
            title: "正在扫描宏定义..."
        };

        this.scanningPromise = Promise.resolve(
            vscode.window.withProgress(progressOptions, async (progress) => {
                await this.scanMacros(progress);
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
        const relativePath = this.includePath
            ? path.relative(this.includePath, macro.file)
            : macro.file;
        content.appendMarkdown(`\n\n*定义于 [${relativePath}:${macro.line}](${vscode.Uri.file(macro.file).toString()})*`);
        
        content.isTrusted = true;
        return content;
    }

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private hasValidIncludePath(): boolean {
        return Boolean(this.includePath && fs.existsSync(this.includePath));
    }

}
