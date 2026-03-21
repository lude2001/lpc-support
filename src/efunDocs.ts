import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseFunctionDocs } from './efun/docParser';
import { BundledEfunLoader } from './efun/BundledEfunLoader';
import { RemoteEfunFetcher } from './efun/RemoteEfunFetcher';
import type { EfunDoc } from './efun/types';

export type {
    BundledEfunDoc,
    BundledEfunDocBundle,
    EfunDoc,
    LegacyEfunConfig,
    LegacyEfunConfigEntry
} from './efun/types';

export class EfunDocsManager {
    private static SIMULATED_EFUNS_PATH_CONFIG = 'lpc.simulatedEfunsPath';
    private bundledLoader: BundledEfunLoader;
    private remoteFetcher: RemoteEfunFetcher;
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();
    private simulatedEfunDocs: Map<string, EfunDoc> = new Map();
    private remoteDocFetches: Map<string, Promise<EfunDoc | undefined>> = new Map();
    // 存储当前文件的函数文档
    private currentFileDocs: Map<string, EfunDoc> = new Map();
    // 存储继承文件的函数文档，键为文件路径，值为该文件的函数文档 Map
    private inheritedFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    // 存储当前文件路径
    private currentFilePath: string = '';
    // 当前文件的继承文件路径列表
    private inheritedFiles: string[] = [];
    private currentFileUpdateVersion = 0;
    private missingRemoteDocs = new Set<string>();

    constructor(context: vscode.ExtensionContext) {
        this.bundledLoader = new BundledEfunLoader(context);
        this.remoteFetcher = new RemoteEfunFetcher();
        this.efunDocs = new Map(
            this.bundledLoader.getAllNames().map(name => [name, this.bundledLoader.get(name)!])
        );
        this.efunCategories = new Map(
            Array.from(this.bundledLoader.getCategories().entries(), ([category, names]) => [category, [...names]])
        );

        // 注册悬停提供程序
        context.subscriptions.push(
            vscode.languages.registerHoverProvider('lpc', {
                provideHover: (document, position) => this.provideHover(document, position)
            })
        );

        // 注册模拟函数库配置命令
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.configureSimulatedEfuns', () => this.configureSimulatedEfuns())
        );

        // 加载模拟函数库文档
        this.loadSimulatedEfuns();
        
        // 添加文件变更事件监听
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.languageId === 'lpc' || e.document.fileName.endsWith('.c')) {
                    this.updateCurrentFileDocs(e.document);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && (editor.document.languageId === 'lpc' || editor.document.fileName.endsWith('.c'))) {
                    this.updateCurrentFileDocs(editor.document);
                }
            })
        );

        // 如果已经有活动编辑器，则立即更新当前文件的文档
        if (vscode.window.activeTextEditor && 
            (vscode.window.activeTextEditor.document.languageId === 'lpc' || 
             vscode.window.activeTextEditor.document.fileName.endsWith('.c'))) {
            this.updateCurrentFileDocs(vscode.window.activeTextEditor.document);
        }
    }

    public getStandardDoc(funcName: string): EfunDoc | undefined {
        return this.efunDocs.get(funcName);
    }

    public async getEfunDoc(funcName: string): Promise<EfunDoc | undefined> {
        const bundledDoc = this.getStandardDoc(funcName);
        if (bundledDoc) {
            return bundledDoc;
        }

        return this.fetchMissingMudWikiDoc(funcName);
    }

    private async fetchMissingMudWikiDoc(funcName: string): Promise<EfunDoc | undefined> {
        if (this.missingRemoteDocs.has(funcName)) {
            return undefined;
        }

        const pendingFetch = this.remoteDocFetches.get(funcName);
        if (pendingFetch) {
            return pendingFetch;
        }

        const request = this.remoteFetcher.fetchDoc(funcName)
            .then(doc => {
                if (doc) {
                    this.efunDocs.set(funcName, doc);
                    this.missingRemoteDocs.delete(funcName);
                } else {
                    this.missingRemoteDocs.add(funcName);
                }
                return doc;
            })
            .finally(() => {
                this.remoteDocFetches.delete(funcName);
            });

        this.remoteDocFetches.set(funcName, request);
        return request;
    }

    private async configureSimulatedEfuns(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择模拟函数库目录'
        };

        const folders = await vscode.window.showOpenDialog(options);
        if (folders && folders[0]) {
            await vscode.workspace.getConfiguration().update(
                EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG,
                folders[0].fsPath,
                vscode.ConfigurationTarget.Global
            );
            await this.loadSimulatedEfuns();
            vscode.window.showInformationMessage('模拟函数库目录已更新');
        }
    }

    private async loadSimulatedEfuns(): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        const configPath = config.get<string>(EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG);
        
        if (!configPath) {
            return;
        }

        // 支持项目相对路径
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const simulatedEfunsPath = this.resolveProjectPath(workspaceFolder.uri.fsPath, configPath);

        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}')
            );

            this.simulatedEfunDocs.clear();

            for (const file of files) {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                
                // 解析文件中的函数文档
                const functionDocs = parseFunctionDocs(text, '模拟函数库', { isSimulated: true });
                
                for (const [funcName, doc] of functionDocs) {
                    this.simulatedEfunDocs.set(funcName, doc);
                }
            }
        } catch (error) {
            console.error('加载模拟函数库文档失败:', error);
        }
    }

    /**
     * 更新当前文件的函数文档
     * @param document 当前活动的文档
     */
    private async updateCurrentFileDocs(document: vscode.TextDocument): Promise<void> {
        // 如果不是 LPC 文件，则不处理
        if (document.languageId !== 'lpc' && !document.fileName.endsWith('.c')) {
            return;
        }

        const updateVersion = ++this.currentFileUpdateVersion;
        const currentFilePath = document.uri.fsPath;

        // 解析当前文件的函数文档
        const content = document.getText();
        const currentFileDocs = parseFunctionDocs(content, '当前文件');

        // 解析并加载继承文件
        const inheritedFiles = this.parseInheritStatements(content);
        const inheritedFileDocs = await this.loadInheritedFileDocs(currentFilePath, inheritedFiles);

        if (updateVersion !== this.currentFileUpdateVersion) {
            return;
        }

        this.currentFilePath = currentFilePath;
        this.currentFileDocs = currentFileDocs;
        this.inheritedFiles = inheritedFiles;
        this.inheritedFileDocs = inheritedFileDocs;
    }

    /**
     * 解析文件内容中的继承语句
     * @param content 文件内容
     * @returns 继承文件路径列表
     */
    private parseInheritStatements(content: string): string[] {
        const inheritFiles: string[] = [];
        const inheritPattern = /inherit\s+["']([^"']+)["']\s*;/g;
        
        let match;
        while ((match = inheritPattern.exec(content)) !== null) {
            const [_, inheritPath] = match;
            inheritFiles.push(inheritPath);
        }
        
        return inheritFiles;
    }

    /**
     * 加载继承文件的函数文档
     */
    private async loadInheritedFileDocs(
        currentFilePath: string,
        inheritedFiles: readonly string[]
    ): Promise<Map<string, Map<string, EfunDoc>>> {
        const inheritedFileDocs = new Map<string, Map<string, EfunDoc>>();
        if (!inheritedFiles.length) {
            return inheritedFileDocs;
        }

        try {
            // 获取当前工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return inheritedFileDocs;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            
            for (const inheritPath of inheritedFiles) {
                // 解析继承文件的绝对路径
                // 在 LPC 中，继承路径可能是相对于游戏根目录的，需要根据项目结构调整
                const possiblePaths = [
                    path.join(workspaceRoot, inheritPath),
                    path.join(workspaceRoot, inheritPath + '.c'),
                    path.join(path.dirname(currentFilePath), inheritPath),
                    path.join(path.dirname(currentFilePath), inheritPath + '.c')
                ];

                for (const filePath of possiblePaths) {
                    try {
                        if (fs.existsSync(filePath)) {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const fileName = path.basename(filePath);
                            const funcDocs = parseFunctionDocs(content, `继承自 ${fileName}`);
                            inheritedFileDocs.set(filePath, funcDocs);
                            break; // 找到文件后停止搜索其他可能的路径
                        }
                    } catch (error) {
                        console.error(`加载继承文件失败: ${filePath}`, error);
                    }
                }
            }
        } catch (error) {
            console.error('加载继承文件文档失败:', error);
        }

        return inheritedFileDocs;
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        
        // 确保当前文件的文档是最新的
        if (document.uri.fsPath !== this.currentFilePath) {
            await this.updateCurrentFileDocs(document);
        }
        
        // 查找顺序：当前文件 -> 继承文件 -> include文件 -> 模拟函数库 -> 标准 efun
        
        // 1. 先查找当前文件中的函数文档
        const currentDoc = this.currentFileDocs.get(word);
        if (currentDoc) {
            return this.createHoverContent(currentDoc);
        }
        
        // 2. 再查找继承文件中的函数文档
        for (const [filePath, funcDocs] of this.inheritedFileDocs.entries()) {
            const inheritedDoc = funcDocs.get(word);
            if (inheritedDoc) {
                return this.createHoverContent(inheritedDoc);
            }
        }
        
        // 3. 查找include文件中的函数文档
        const includeDoc = await this.findFunctionDocInIncludes(document, word);
        if (includeDoc) {
            return this.createHoverContent(includeDoc);
        }
        
        // 4. 再查找模拟函数库文档
        const simulatedDoc = this.simulatedEfunDocs.get(word);
        if (simulatedDoc) {
            return this.createHoverContent(simulatedDoc);
        }

        // 5. 最后查找标准efun文档
        const efunDoc = await this.getEfunDoc(word);
        if (!efunDoc) {
            return undefined;
        }

        return this.createHoverContent(efunDoc);
    }

    private createHoverContent(doc: EfunDoc): vscode.Hover {
        const content = new vscode.MarkdownString();
        content.isTrusted = false;
        content.supportHtml = true;

        // 函数签名
        if (doc.syntax) {
            content.appendMarkdown(`\`\`\`lpc\n${doc.syntax}\n\`\`\`\n\n`);
        }

        if (doc.returnType) {
            content.appendMarkdown(`**Return Type:** \`${doc.returnType}\`\n\n`);
        }

        // 分类标签 - 使用小型标签样式
        if (doc.category) {
            content.appendMarkdown(`<sub>${doc.category}</sub>\n\n`);
        }

        content.appendMarkdown(`---\n\n`);

        // 描述
        if (doc.description) {
            // 移除旧的"参数:"部分标记
            const descLines = doc.description.split('\n');
            const mainDesc: string[] = [];
            const params: string[] = [];
            let inParams = false;

            for (const line of descLines) {
                if (line.trim() === '参数:') {
                    inParams = true;
                    continue;
                }
                if (inParams) {
                    params.push(line);
                } else if (line.trim()) {
                    mainDesc.push(line);
                }
            }

            if (mainDesc.length > 0) {
                content.appendMarkdown(`${mainDesc.join('\n')}\n\n`);
            }

            // 参数表格
            if (params.length > 0) {
                content.appendMarkdown(`#### Parameters\n\n`);
                content.appendMarkdown(`| Name | Type | Description |\n`);
                content.appendMarkdown(`|------|------|-------------|\n`);

                params.forEach(param => {
                    const cleaned = param.trim();
                    if (cleaned) {
                        // 解析参数格式: "type name: description" 或 "name: description"
                        const match = cleaned.match(/^(?:(.+?)\s+)?`?([A-Za-z_][A-Za-z0-9_]*)`?\s*:\s*(.+)$/);
                        if (match) {
                            const [, type, name, desc] = match;
                            const normalizedType = type?.trim();
                            if (normalizedType) {
                                content.appendMarkdown(`| \`${name}\` | \`${normalizedType}\` | ${desc} |\n`);
                            } else {
                                content.appendMarkdown(`| \`${name}\` | | ${desc} |\n`);
                            }
                        } else {
                            content.appendMarkdown(`| ${cleaned} | | |\n`);
                        }
                    }
                });
                content.appendMarkdown(`\n`);
            }
        }

        // 返回值
        if (doc.returnValue) {
            content.appendMarkdown(`#### Returns\n\n${doc.returnValue}\n\n`);
        }

        // 详细说明
        if (doc.details) {
            content.appendMarkdown(`#### Details\n\n${doc.details}\n\n`);
        }

        // 其他说明
        if (doc.note) {
            content.appendMarkdown(`> **Note**  \n> ${doc.note.replace(/\n/g, '\n> ')}\n\n`);
        }

        // 相关函数
        if (doc.reference && doc.reference.length > 0) {
            content.appendMarkdown(`**See also:** ${doc.reference.map(ref => `\`${ref}\``).join(', ')}\n`);
        }

        return new vscode.Hover(content);
    }

    public getCategories(): Map<string, string[]> {
        return this.efunCategories;
    }

    public getAllFunctions(): string[] {
        return Array.from(this.efunDocs.keys());
    }

    public getAllSimulatedFunctions(): string[] {
        return Array.from(this.simulatedEfunDocs.keys());
    }

    public getSimulatedDoc(funcName: string): EfunDoc | undefined {
        return this.simulatedEfunDocs.get(funcName);
    }

    /**
     * 在include文件中查找函数文档
     */
    private async findFunctionDocInIncludes(document: vscode.TextDocument, functionName: string): Promise<EfunDoc | undefined> {
        try {
            const includeFiles = await this.getIncludeFiles(document.uri.fsPath);
            
            for (const includeFile of includeFiles) {
                if (includeFile.endsWith('.h') || includeFile.endsWith('.c')) {
                    try {
                        const content = await fs.promises.readFile(includeFile, 'utf-8');
                        const fileName = path.basename(includeFile);
                        const funcDocs = parseFunctionDocs(content, `包含自 ${fileName}`);
                        const doc = funcDocs.get(functionName);
                        if (doc) {
                            return doc;
                        }
                    } catch (error) {
                        // 静默处理错误，继续处理下一个文件
                    }
                }
            }
        } catch (error) {
            // 静默处理错误
        }
        
        return undefined;
    }

    /**
     * 获取文件的include列表
     */
    private async getIncludeFiles(filePath: string): Promise<string[]> {
        const includeFiles: string[] = [];
        
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const currentDir = path.dirname(filePath);

            for (const line of lines) {
                const trimmedLine = line.trim();
                // 匹配 #include "path" 或 #include <path> 或 include "path"，允许后面有注释
                const includeMatch = trimmedLine.match(/^#?include\s+[<"]([^>"]+)[>"](?:\s*\/\/.*)?$/);
                if (includeMatch) {
                    let includePath = includeMatch[1];
                    if (!includePath.endsWith('.h') && !includePath.endsWith('.c')) {
                        includePath += '.h'; // 默认为头文件
                    }
                    
                    // 解析为绝对路径
                    let resolvedPath: string;
                    if (/^(?:[\\/]|[A-Za-z]:[\\/])/.test(includePath)) {
                        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                        if (workspaceRoot && !/^[A-Za-z]:[\\/]/.test(includePath)) {
                            resolvedPath = path.join(workspaceRoot, includePath.replace(/^[/\\]+/, ''));
                        } else {
                            resolvedPath = includePath;
                        }
                    } else {
                        resolvedPath = path.resolve(currentDir, includePath);
                    }
                    
                    // 检查文件是否存在
                    try {
                        await fs.promises.access(resolvedPath);
                        includeFiles.push(resolvedPath);
                    } catch {
                        // 文件不存在，跳过
                    }
                }
            }
        } catch (error) {
            // 静默处理错误
        }

        return includeFiles;
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
