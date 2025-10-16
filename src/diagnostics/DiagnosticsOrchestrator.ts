import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from '../macroManager';
import { getParsed, deleteDocumentCache } from '../parseCache';
import { Debouncer } from '../utils/debounce';
import { IDiagnosticCollector, DiagnosticCollectionOptions, CollectorResult } from './types';
import { VariableAnalyzer, VariableInfo } from './analyzers/VariableAnalyzer';

// 导入现有的收集器
import { StringLiteralCollector } from '../collectors/StringLiteralCollector';
import { FileNamingCollector } from '../collectors/FileNamingCollector';
import { UnusedVariableCollector } from '../collectors/UnusedVariableCollector';
import { GlobalVariableCollector } from '../collectors/GlobalVariableCollector';
import { LocalVariableDeclarationCollector } from '../collectors/LocalVariableDeclarationCollector';

// 导入新的收集器
import { ObjectAccessCollector } from './collectors/ObjectAccessCollector';
import { MacroUsageCollector } from './collectors/MacroUsageCollector';
// FunctionCallCollector已移除 - AST解析器已能检测所有语法错误

/**
 * LPC配置接口
 */
interface LPCConfig {
    types: string[];
    modifiers: string[];
    efuns: { [key: string]: { snippet: string; detail: string } };
}

/**
 * 诊断协调器
 * 负责管理和协调所有诊断收集器的执行
 */
export class DiagnosticsOrchestrator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private macroManager: MacroManager;
    private collectors: IDiagnosticCollector[];
    private variableAnalyzer: VariableAnalyzer;

    // 配置相关
    private config: LPCConfig;
    private excludedIdentifiers: Set<string>;

    // 性能优化
    private debouncer = new Debouncer();
    private isAnalyzing = new Set<string>();
    private lastAnalysisVersion = new Map<string, number>();

    constructor(context: vscode.ExtensionContext, macroManager: MacroManager) {
        this.macroManager = macroManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        context.subscriptions.push(this.diagnosticCollection);

        // 加载配置
        const configPath = path.join(context.extensionPath, 'config', 'lpc-config.json');
        this.config = this.loadLPCConfig(configPath);

        // 初始化排除标识符
        this.excludedIdentifiers = new Set([
            ...Object.keys(this.config.efuns)
        ]);

        // 初始化变量分析器
        const lpcTypes = this.config.types.join('|');
        const modifiers = this.config.modifiers.join('|');
        this.variableAnalyzer = new VariableAnalyzer(lpcTypes, modifiers, this.excludedIdentifiers);

        // 初始化收集器
        this.collectors = this.initializeCollectors();

        // 注册命令和事件
        this.registerCommandsAndEvents(context);
    }

    /**
     * 初始化所有收集器
     */
    private initializeCollectors(): IDiagnosticCollector[] {
        return [
            // 现有的收集器
            new StringLiteralCollector(),
            new FileNamingCollector(),
            new UnusedVariableCollector(),
            new GlobalVariableCollector(),
            new LocalVariableDeclarationCollector(),

            // 新的收集器
            new ObjectAccessCollector(this.macroManager),
            new MacroUsageCollector(this.macroManager),
            // FunctionCallCollector已移除 - 使用AST解析器检测语法错误,避免误报
        ];
    }

    /**
     * 注册命令和事件
     */
    private registerCommandsAndEvents(context: vscode.ExtensionContext): void {
        // 注册显示变量命令
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.showVariables', () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'lpc') {
                    this.showAllVariables(editor.document);
                }
            })
        );

        // 注册文档更改事件
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this))
        );

        // 注册文档打开事件
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(this.analyzeDocument.bind(this))
        );

        // 注册文档关闭事件
        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument(this.onDidCloseTextDocument.bind(this))
        );

        // 注册文件删除事件
        context.subscriptions.push(
            vscode.workspace.onDidDeleteFiles(this.onDidDeleteFiles.bind(this))
        );

        // 注册悬停提供器
        context.subscriptions.push(
            vscode.languages.registerHoverProvider('lpc', {
                provideHover: async (document, position, token) => {
                    const range = document.getWordRangeAtPosition(position);
                    if (!range) return;

                    const word = document.getText(range);
                    if (/^[A-Z][A-Z0-9_]*_D$/.test(word)) {
                        const macro = this.macroManager?.getMacro(word);
                        if (macro) {
                            return new vscode.Hover(this.macroManager.getMacroHoverContent(macro));
                        }

                        const canResolve = await this.macroManager?.canResolveMacro(word);
                        if (canResolve) {
                            return new vscode.Hover(`宏 \`${word}\` 已定义但无法获取具体值`);
                        }
                    }
                }
            })
        );
    }

    /**
     * 文档更改事件处理
     */
    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent): void {
        if (event.document.languageId === 'lpc') {
            const config = vscode.workspace.getConfiguration('lpc.performance');
            const debounceDelay = config.get<number>('debounceDelay', 300);

            const documentKey = event.document.uri.toString();
            const debouncedAnalyze = this.debouncer.debounce(
                documentKey,
                () => this.analyzeDocument(event.document, false),
                debounceDelay
            );
            debouncedAnalyze();
        }
    }

    /**
     * 文档关闭事件处理
     */
    private onDidCloseTextDocument(document: vscode.TextDocument): void {
        if (document.languageId === 'lpc') {
            const documentKey = document.uri.toString();
            // 清理缓存的分析状态
            this.isAnalyzing.delete(documentKey);
            this.lastAnalysisVersion.delete(documentKey);
            // 清理解析缓存
            deleteDocumentCache(document.uri);
        }
    }

    /**
     * 文件删除事件处理
     */
    private onDidDeleteFiles(event: vscode.FileDeleteEvent): void {
        for (const uri of event.files) {
            // 清理该文件的诊断信息
            this.diagnosticCollection.delete(uri);

            // 清理缓存的分析状态
            const documentKey = uri.toString();
            this.isAnalyzing.delete(documentKey);
            this.lastAnalysisVersion.delete(documentKey);

            // 清理解析缓存
            deleteDocumentCache(uri);
        }
    }

    /**
     * 分析文档
     */
    public analyzeDocument(document: vscode.TextDocument, showMessage: boolean = false): void {
        if (!this.shouldCheckFile(document.fileName)) {
            return;
        }

        const documentKey = document.uri.toString();

        // 检查是否正在分析中
        if (this.isAnalyzing.has(documentKey)) {
            return;
        }

        // 检查文档版本是否已经分析过
        const lastVersion = this.lastAnalysisVersion.get(documentKey);
        if (lastVersion === document.version) {
            return;
        }

        this.isAnalyzing.add(documentKey);

        // 异步分析
        this.analyzeDocumentAsync(document, { showMessage })
            .finally(() => {
                this.isAnalyzing.delete(documentKey);
                this.lastAnalysisVersion.set(documentKey, document.version);
            })
            .catch(error => {
                console.error('分析文档时发生错误:', error);
            });
    }

    /**
     * 异步分析文档
     */
    private async analyzeDocumentAsync(
        document: vscode.TextDocument,
        options: DiagnosticCollectionOptions = {}
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const enableAsync = config.get<boolean>('enableAsyncDiagnostics', true);

        const diagnostics = enableAsync
            ? await this.collectDiagnosticsAsync(document, options)
            : await this.collectDiagnostics(document);

        this.diagnosticCollection.set(document.uri, diagnostics);

        if (options.showMessage && diagnostics.length === 0) {
            vscode.window.showInformationMessage('代码检查完成，未发现问题');
        }
    }

    /**
     * 同步收集诊断
     */
    private async collectDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        const parsed = getParsed(document);

        // 执行所有收集器
        for (const collector of this.collectors) {
            try {
                const result = await collector.collect(document, parsed);
                diagnostics.push(...result);
            } catch (error) {
                console.error(`收集器 ${collector.name} 执行失败:`, error);
            }
        }

        // 收集语法错误
        try {
            const { diagnostics: parseDiags } = getParsed(document);
            diagnostics.push(...parseDiags);
        } catch (err) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`解析 LPC 失败: ${err.message}`);
            }
        }

        return diagnostics;
    }

    /**
     * 异步收集诊断（批量处理）
     */
    private async collectDiagnosticsAsync(
        document: vscode.TextDocument,
        options: DiagnosticCollectionOptions = {}
    ): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        const parsed = getParsed(document);

        const config = vscode.workspace.getConfiguration('lpc.performance');
        const batchSize = options.batchSize || config.get<number>('batchSize', 3);

        // 分批处理收集器
        for (let i = 0; i < this.collectors.length; i += batchSize) {
            const batch = this.collectors.slice(i, i + batchSize);

            // 并行处理当前批次
            const results = await Promise.allSettled(
                batch.map(async (collector) => {
                    await this.yieldToMainThread();
                    const startTime = Date.now();
                    const result = await collector.collect(document, parsed);
                    const duration = Date.now() - startTime;

                    return {
                        collectorName: collector.name,
                        diagnostics: result,
                        duration
                    } as CollectorResult;
                })
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    diagnostics.push(...result.value.diagnostics);
                } else {
                    console.error('收集器执行失败:', result.reason);
                }
            }
        }

        // 收集语法错误
        try {
            const { diagnostics: parseDiags } = getParsed(document);
            diagnostics.push(...parseDiags);
        } catch (err) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`解析 LPC 失败: ${err.message}`);
            }
        }

        return diagnostics;
    }

    /**
     * 显示所有变量
     */
    private async showAllVariables(document: vscode.TextDocument): Promise<void> {
        const globalVars = this.variableAnalyzer.findGlobalVariables(document);
        const localVars = this.variableAnalyzer.findLocalVariables(document);
        const unusedVars = this.variableAnalyzer.findUnusedVariables(document, localVars);

        // 创建并显示 webview 面板
        const panel = vscode.window.createWebviewPanel(
            'lpcVariables',
            'LPC 变量列表',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getVariablesHtml(globalVars, localVars, unusedVars);

        // 处理 webview 消息
        panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'jumpToVariable') {
                    const position = new vscode.Position(message.line, message.character);
                    vscode.window.showTextDocument(document, {
                        selection: new vscode.Selection(position, position),
                        preserveFocus: false,
                        preview: false
                    });
                }
            },
            undefined,
            []
        );
    }

    /**
     * 生成变量列表 HTML
     */
    private getVariablesHtml(
        globalVars: Set<string>,
        localVars: Map<string, VariableInfo>,
        unusedVars: Set<string>
    ): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .variable { cursor: pointer; padding: 2px 5px; }
                    .variable:hover { background-color: #e8e8e8; }
                    .unused { color: #cc0000; }
                    .section { margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="section">
                    <h3>未使用的变量:</h3>
                    ${Array.from(unusedVars).map(varName => {
                        const info = localVars.get(varName);
                        return `<div class="variable unused" data-line="${info?.range.start.line}" data-char="${info?.range.start.character}">
                            - ${info?.type} ${varName}
                        </div>`;
                    }).join('')}
                </div>
                <div class="section">
                    <h3>全局变量:</h3>
                    ${Array.from(globalVars).map(varName =>
                        `<div class="variable">- ${varName}</div>`
                    ).join('')}
                </div>
                <div class="section">
                    <h3>局部变量:</h3>
                    ${Array.from(localVars.entries()).map(([name, info]) =>
                        `<div class="variable" data-line="${info.range.start.line}" data-char="${info.range.start.character}">
                            - ${info.type} ${name}
                        </div>`
                    ).join('')}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.querySelectorAll('.variable').forEach(el => {
                        el.addEventListener('click', () => {
                            const line = el.getAttribute('data-line');
                            const char = el.getAttribute('data-char');
                            if (line !== null && char !== null) {
                                vscode.postMessage({
                                    command: 'jumpToVariable',
                                    line: parseInt(line),
                                    character: parseInt(char)
                                });
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }

    /**
     * 扫描文件夹
     */
    public async scanFolder(): Promise<void> {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择要扫描的文件夹'
        });

        if (!folders || folders.length === 0) {
            return;
        }

        const folderPath = folders[0].fsPath;
        const outputChannel = vscode.window.createOutputChannel('LPC 变量检查');
        outputChannel.show();
        outputChannel.appendLine(`开始扫描文件夹: ${folderPath}`);

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "正在扫描 LPC 文件...",
                cancellable: true
            }, async (progress, token) => {
                const files = await this.findLPCFiles(folderPath);
                const totalFiles = files.length;
                let processedFiles = 0;

                outputChannel.appendLine(`找到 ${totalFiles} 个 LPC 文件`);

                const batchSize = 10;
                const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

                for (let i = 0; i < files.length; i += batchSize) {
                    if (token.isCancellationRequested) {
                        outputChannel.appendLine('扫描已取消');
                        return;
                    }

                    const batch = files.slice(i, i + batchSize);

                    await Promise.all(batch.map(async (file) => {
                        progress.report({
                            increment: (1 / totalFiles) * 100,
                            message: `正在检查 ${path.basename(file)} (${++processedFiles}/${totalFiles})`
                        });

                        try {
                            const document = await vscode.workspace.openTextDocument(file);
                            this.analyzeDocument(document, false);

                            const fileDiagnostics = this.diagnosticCollection.get(document.uri);
                            if (fileDiagnostics && fileDiagnostics.length > 0) {
                                diagnosticsByFile.set(file, [...fileDiagnostics]);
                            }
                        } catch (error) {
                            outputChannel.appendLine(`处理文件 ${file} 时出错: ${error}`);
                        }
                    }));
                }

                // 输出诊断结果
                if (diagnosticsByFile.size > 0) {
                    for (const [file, diagnostics] of diagnosticsByFile.entries()) {
                        outputChannel.appendLine(`\n文件: ${path.relative(folderPath, file)}`);
                        for (const diagnostic of diagnostics) {
                            const line = diagnostic.range.start.line + 1;
                            const character = diagnostic.range.start.character + 1;
                            outputChannel.appendLine(`  [行 ${line}, 列 ${character}] ${diagnostic.message}`);
                        }
                    }
                }

                outputChannel.appendLine('\n扫描完成！');
            });
        } catch (error) {
            outputChannel.appendLine(`发生错误: ${error}`);
            vscode.window.showErrorMessage('扫描过程中发生错误，请查看输出面板了解详情。');
        }
    }

    /**
     * 递归查找所有 LPC 文件
     */
    private async findLPCFiles(folderPath: string): Promise<string[]> {
        const files: string[] = [];
        const fileExtensions = ['.c', '.h'];
        const ignoreDirs = ['node_modules', '.git', '.vscode'];

        const walk = async (dir: string): Promise<void> => {
            let entries;
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch (error) {
                console.error(`无法读取目录 ${dir}:`, error);
                return;
            }

            const directories: string[] = [];

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (!ignoreDirs.includes(entry.name)) {
                        directories.push(fullPath);
                    }
                } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }

            if (directories.length > 0) {
                await Promise.all(directories.map(walk));
            }
        };

        await walk(folderPath);
        return files;
    }

    /**
     * 加载 LPC 配置
     */
    private loadLPCConfig(configPath: string): LPCConfig {
        try {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(configContent) as LPCConfig;
        } catch (error) {
            vscode.window.showErrorMessage(`无法加载配置文件: ${error}`);
            return {
                types: [],
                modifiers: [],
                efuns: {}
            };
        }
    }

    /**
     * 检查是否应该检查该文件
     */
    private shouldCheckFile(fileName: string): boolean {
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.c' || ext === '.h';
    }

    /**
     * 让出主线程
     */
    private async yieldToMainThread(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
        this.debouncer.clear();
        this.isAnalyzing.clear();
        this.lastAnalysisVersion.clear();
    }
}
