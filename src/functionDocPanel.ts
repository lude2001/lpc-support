import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from './macroManager';
import { FunctionInfo } from './types/functionInfo';
import { LPCFunctionParser } from './functionParser';
import { JavaDocProcessor } from './utils/javaDocProcessor';
import { FunctionUtils } from './utils/functionUtils';
import { getParsed } from './parseCache';

/**
 * 函数文档面板类
 * 用于显示当前文件及其继承的函数列表和文档
 */
export class FunctionDocPanel {
    private static currentPanel: FunctionDocPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private macroManager: MacroManager;
    private filePathCache: Map<string, string> = new Map();
    private functionCache: Map<string, FunctionInfo[]> = new Map();
    private currentDocument: vscode.TextDocument | undefined;
    private currentFunctions: FunctionInfo[] = [];
    private inheritedFunctions: Map<string, FunctionInfo[]> = new Map();
    private processedFiles: Set<string> = new Set();

    /**
     * 创建或显示函数文档面板
     */
    public static createOrShow(context: vscode.ExtensionContext, macroManager: MacroManager) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('.c')) {
            vscode.window.showInformationMessage('请先打开一个 LPC 文件');
            return;
        }

        // 如果已经有面板，则显示它
        if (FunctionDocPanel.currentPanel) {
            FunctionDocPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
            FunctionDocPanel.currentPanel.update(activeEditor.document);
            return;
        }

        // 否则，创建一个新面板，并将其放置在编辑器旁边
        const panel = vscode.window.createWebviewPanel(
            'lpcFunctionDoc',
            'LPC 函数文档',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'media'))
                ]
            }
        );

        FunctionDocPanel.currentPanel = new FunctionDocPanel(panel, macroManager);
        FunctionDocPanel.currentPanel.update(activeEditor.document);
    }

    /**
     * 构造函数
     */
    private constructor(panel: vscode.WebviewPanel, macroManager: MacroManager) {
        this.panel = panel;
        this.macroManager = macroManager;

        // 当面板关闭时清理资源
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // 处理来自 WebView 的消息
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'showFunctionDoc':
                        this.showFunctionDoc(message.functionName, message.source);
                        return;
                    case 'gotoDefinition':
                        this.gotoDefinition(message.filePath, message.line);
                        return;
                    case 'generateJavadoc':
                        this.generateJavadocForFunction(message.filePath, message.line, message.functionName);
                        return;
                }
            },
            null,
            this.disposables
        );

        // 当编辑器切换时更新面板
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.fileName.endsWith('.c')) {
                this.update(editor.document);
            }
        }, null, this.disposables);

        // 当文档保存时更新面板
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.fileName.endsWith('.c') && 
                this.currentDocument && 
                document.uri.toString() === this.currentDocument.uri.toString()) {
                this.update(document);
            }
        }, null, this.disposables);
    }

    /**
     * 更新面板内容
     */
    public async update(document: vscode.TextDocument) {
        this.currentDocument = document;
        this.panel.title = `函数文档: ${path.basename(document.fileName)}`;
        
        // 清除缓存
        this.currentFunctions = [];
        this.inheritedFunctions.clear();
        this.processedFiles.clear();
        
        // 解析当前文件的函数
        await this.parseFunctionsInFile(document, '当前文件', document.uri.fsPath);
        
        // 解析继承的函数
        await this.parseInheritedFunctions(document);
        
        // 更新 WebView 内容
        this.panel.webview.html = this.getWebviewContent();
    }

    /**
     * 解析文件中的函数
     */
    private async parseFunctionsInFile(
        document: vscode.TextDocument,
        source: string,
        filePath: string
    ): Promise<FunctionInfo[]> {
        // 使用统一的函数解析器
        const functions = LPCFunctionParser.parseAllFunctions(document, source, filePath);
        
        // 如果是当前文件，保存到当前函数列表
        if (source === '当前文件') {
            this.currentFunctions = functions;
        } else {
            this.inheritedFunctions.set(source, functions);
        }
        
        return functions;
    }

    /**
     * 解析继承的函数
     */
    private async parseInheritedFunctions(document: vscode.TextDocument): Promise<void> {
        const text = document.getText();
        
        // —— AST 方式收集 inherit ——
        const { tree } = getParsed(document);
        const inherits: Array<{file: string, source: string}> = [];

        const collect = (ctx: any) => {
            if (ctx instanceof (require('./antlr/LPCParser').InheritStatementContext)) {
                const inheritText = document.getText(new vscode.Range(
                    document.positionAt(ctx.start.startIndex),
                    document.positionAt(ctx.stop.stopIndex + 1)
                ));

                // 提取路径或宏
                let m = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))/i.exec(inheritText);
                if (m) {
                    let inheritedFile = (m[1] || m[2]).trim();
                    let macroSource = '';

                    // 宏解析（无扩展名）
                    if (/^[A-Z_][A-Z0-9_]*$/.test(inheritedFile)) {
                        const macro = this.macroManager.getMacro(inheritedFile);
                        if (macro) {
                            inheritedFile = macro.value.replace(/^"(.*)"$/, '$1');
                            let macroPath = path.basename(macro.file);
                            const includePath = this.macroManager.getIncludePath();
                            if (includePath) {
                                macroPath = path.relative(includePath, macro.file);
                            }
                            macroSource = `(通过宏 ${macro.name} 从 ${macroPath})`;
                        } else {
                            return;
                        }
                    }

                    if (!inheritedFile.endsWith('.c')) {
                        inheritedFile += '.c';
                    }

                    inherits.push({file: inheritedFile, source: macroSource});
                }
            }
            for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                const child = ctx.getChild(i);
                if (child && typeof child === 'object' && child.symbol === undefined) {
                    collect(child);
                }
            }
        };
        collect(tree);

        // 预处理include -> 扫描宏
        await this.macroManager.scanMacros();

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        const inheritTasks: Promise<void>[] = [];
        const allInheritedFiles = inherits;
        
        // 并行处理所有继承文件
        if (allInheritedFiles.length > 0) {
            // 创建所有继承文件的处理任务
            for (const {file, source} of allInheritedFiles) {
                inheritTasks.push(this.processInheritedFile(
                    file, 
                    source, 
                    document, 
                    workspaceFolder
                ));
            }
            
            // 等待所有任务完成
            await Promise.all(inheritTasks);
        }
        
        // 解析包含文件
        await this.parseIncludedFunctions(document, workspaceFolder);
    }
    
    /**
     * 解析包含文件中的函数
     */
    private async parseIncludedFunctions(document: vscode.TextDocument, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const includeFiles = await this.getIncludeFiles(document, workspaceFolder);
        
        for (const includeFile of includeFiles) {
            if (this.processedFiles.has(includeFile)) {
                continue;
            }
            
            try {
                const includeDoc = await vscode.workspace.openTextDocument(includeFile);
                const functions = await this.parseFunctionsInFile(
                    includeDoc,
                    `包含文件: ${path.basename(includeFile)}`,
                    includeFile
                );
                
                if (functions.length > 0) {
                    this.inheritedFunctions.set(`包含文件: ${path.basename(includeFile)}`, functions);
                }
                
                this.processedFiles.add(includeFile);
            } catch (error) {
                console.error(`无法读取包含文件 ${includeFile}:`, error);
            }
        }
    }
    
    /**
     * 获取包含文件列表
     */
    private async getIncludeFiles(document: vscode.TextDocument, workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
        const content = document.getText();
        const includeFiles: string[] = [];
        const includeRegex = /^\s*#?include\s+["<]([^\s">]+)[">]/gm;
        
        let match;
        while ((match = includeRegex.exec(content)) !== null) {
            let includePath = match[1];
            
            // 如果没有扩展名，默认添加 .h
            if (!path.extname(includePath)) {
                includePath += '.h';
            }
            
            let fullPath: string;
            
            // 处理绝对路径和相对路径
            if (path.isAbsolute(includePath)) {
                fullPath = includePath;
            } else {
                // 相对于当前文件的路径
                const currentDir = path.dirname(document.uri.fsPath);
                fullPath = path.resolve(currentDir, includePath);
                
                // 如果文件不存在，尝试相对于工作区根目录
                if (!fs.existsSync(fullPath)) {
                    fullPath = path.resolve(workspaceFolder.uri.fsPath, includePath);
                }
            }
            
            // 检查文件是否存在
            if (fs.existsSync(fullPath)) {
                includeFiles.push(fullPath);
            }
        }
        
        return includeFiles;
    }

    /**
     * 处理单个继承文件
     */
    private async processInheritedFile(
        inheritedFile: string,
        macroSource: string,
        document: vscode.TextDocument,
        workspaceFolder: vscode.WorkspaceFolder
    ): Promise<void> {
        // 检查文件路径缓存
        const cacheKey = `${document.uri.fsPath}:${inheritedFile}`;
        let resolvedPath = this.filePathCache.get(cacheKey);
        let fileFound = false;
        
        if (resolvedPath) {
            // 使用缓存的路径
            if (fs.existsSync(resolvedPath) && !this.processedFiles.has(resolvedPath)) {
                fileFound = true;
            }
        } else {
            // 构建可能的文件路径
            const possiblePaths = [];
            
            if (inheritedFile.startsWith('/')) {
                // 绝对路径：移除开头的/，然后从工作区根目录开始查找
                const relativePath = inheritedFile.slice(1);
                possiblePaths.push(
                    path.join(workspaceFolder.uri.fsPath, relativePath),
                    path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', ''))
                );
            } else {
                // 相对路径：先相对于当前文件查找，再从工作区根目录查找
                possiblePaths.push(
                    path.join(path.dirname(document.uri.fsPath), inheritedFile),
                    path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')),
                    path.join(workspaceFolder.uri.fsPath, inheritedFile),
                    path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', ''))
                );
            }

            // 去重路径
            const uniquePaths = [...new Set(possiblePaths)];

            for (const filePath of uniquePaths) {
                if (fs.existsSync(filePath) && !this.processedFiles.has(filePath)) {
                    resolvedPath = filePath;
                    // 缓存解析结果
                    this.filePathCache.set(cacheKey, filePath);
                    fileFound = true;
                    break;
                }
            }
        }

        // 同步检查是否有其他线程已经处理过这个文件
        if (this.processedFiles.has(resolvedPath || '')) {
            return;
        }
        
        if (fileFound && resolvedPath) {
            // 标记为已处理
            this.processedFiles.add(resolvedPath);
            
            try {
                const inheritedDoc = await vscode.workspace.openTextDocument(resolvedPath);
                const sourceName = `继承自 ${path.basename(resolvedPath)}${macroSource}`;
                
                // 解析函数
                await this.parseFunctionsInFile(inheritedDoc, sourceName, resolvedPath);

                // 递归处理继承的文件
                await this.parseInheritedFunctions(inheritedDoc);
            } catch (error) {
                console.error(`Error reading inherited file: ${resolvedPath}`, error);
            }
        }
    }

    /**
     * 显示函数文档
     */
    private showFunctionDoc(functionName: string, source: string) {
        let functionInfo: FunctionInfo | undefined;
        
        if (source === '当前文件') {
            functionInfo = this.currentFunctions.find(f => f.name === functionName);
        } else {
            const functions = this.inheritedFunctions.get(source);
            if (functions) {
                functionInfo = functions.find(f => f.name === functionName);
            }
        }
        
        if (functionInfo) {
            // 发送函数文档到 WebView
            this.panel.webview.postMessage({
                command: 'updateFunctionDoc',
                functionInfo: functionInfo
            });
        }
    }

    /**
     * 获取 WebView 内容
     */
    private getWebviewContent() {
        // 准备函数列表数据
        const currentFunctions = this.currentFunctions.map(f => ({
            name: f.name,
            source: f.source,
            filePath: f.filePath,
            line: f.line,
            definition: f.definition,
            comment: f.comment,
            briefDescription: f.briefDescription
        }));
        
        const inheritedFunctionGroups: Array<{source: string, functions: Array<{name: string, source: string, filePath: string, line: number, definition: string, comment: string, briefDescription: string}>}> = [];
        this.inheritedFunctions.forEach((functions, source) => {
            inheritedFunctionGroups.push({
                source: source,
                functions: functions.map(f => ({
                    name: f.name,
                    source: f.source || '',
                    filePath: f.filePath || '',
                    line: f.line || 0,
                    definition: f.definition || '',
                    comment: f.comment || '',
                    briefDescription: f.briefDescription || '暂无描述'
                }))
            });
        });

        // 读取HTML模板
        // 优先从dist/templates目录查找（打包后的环境）
        let finalHtmlPath = path.join(__dirname, 'templates', 'functionDocPanel.html');
        let finalJsPath = path.join(__dirname, 'templates', 'functionDocPanel.js');
        
        // 如果dist目录中不存在，则从src目录查找（开发环境）
        if (!fs.existsSync(finalHtmlPath)) {
            finalHtmlPath = path.join(__dirname, '..', 'src', 'templates', 'functionDocPanel.html');
        }
        if (!fs.existsSync(finalJsPath)) {
            finalJsPath = path.join(__dirname, '..', 'src', 'templates', 'functionDocPanel.js');
        }
        
        let htmlContent = '';
        let jsContent = '';
        
        try {
            htmlContent = fs.readFileSync(finalHtmlPath, 'utf8');
            jsContent = fs.readFileSync(finalJsPath, 'utf8');
        } catch (error) {
            console.error('Failed to read template files:', error);
            return this.getFallbackContent();
        }
        
        // 在HTML中插入JavaScript和初始数据
        const scriptTag = `
            <script>
                // 初始数据
                window.initialData = {
                    currentFunctions: ${JSON.stringify(currentFunctions)},
                    inheritedFunctionGroups: ${JSON.stringify(inheritedFunctionGroups)}
                };
                
                ${jsContent}
                
                // 确保在所有脚本加载完成后渲染数据
                (function() {
                    function tryRender() {
                        if (window.functionDocPanel && window.initialData) {
                            window.functionDocPanel.renderFunctionList(
                                window.initialData.currentFunctions,
                                window.initialData.inheritedFunctionGroups
                            );
                        } else {
                            // 如果还没准备好，稍后重试
                            setTimeout(tryRender, 10);
                        }
                    }
                    
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', tryRender);
                    } else {
                        tryRender();
                    }
                })();
            </script>
        `;
        
        // 在HTML的</body>标签前插入脚本
        const finalHtml = htmlContent.replace('</body>', `${scriptTag}</body>`);
        
        return finalHtml;
    }
    
    private getFallbackContent(): string {
        return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LPC 函数文档</title>
        </head>
        <body>
            <div style="padding: 20px; text-align: center;">
                <h3>模板文件加载失败</h3>
                <p>无法加载函数文档面板模板文件。</p>
            </div>
        </body>
        </html>`;
    }

    /**
     * HTML 转义
     */
    private escapeHtml(text: string): string {
        return FunctionUtils.escapeHtml(text);
    }

    /**
     * 获取函数返回类型
     */
    private getReturnType(definition: string): string {
        return FunctionUtils.getReturnType(definition);
    }

    /**
     * 获取分组类型
     */
    private getGroupType(source: string): string {
        return FunctionUtils.getGroupType(source);
    }

    /**
     * 清理ID字符串
     */
    private sanitizeId(str: string): string {
        return FunctionUtils.sanitizeId(str);
    }

    /**
     * 处理 JavaDoc 风格的注释
     */
    private processJavaDocComment(comment: string): string {
        return JavaDocProcessor.processToMarkdown(comment);
    }

    private gotoDefinition(filePath: string, line: number) {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc, {preview: false}).then(editor => {
                const pos = new vscode.Position(line, 0);
                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            });
        });
    }

    /**
     * 为指定函数生成 Javadoc 注释
     */
    private async generateJavadocForFunction(filePath: string, line: number, functionName: string) {
        try {
            // 打开文档
            const document = await vscode.workspace.openTextDocument(filePath);

            // 显示文档并激活编辑器
            const editor = await vscode.window.showTextDocument(document, {preview: false});

            // 将光标定位到函数位置
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

            // 触发生成 Javadoc 注释命令
            await vscode.commands.executeCommand('lpc.generateJavadoc');

            // 延迟后刷新面板以显示新生成的注释
            setTimeout(async () => {
                await this.update(document);
            }, 1000);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`生成注释失败: ${errorMessage}`);
        }
    }

    /**
     * 释放资源
     */
    public dispose() {
        FunctionDocPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}