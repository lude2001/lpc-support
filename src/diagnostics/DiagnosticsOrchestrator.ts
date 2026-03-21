import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from '../macroManager';
import { ASTManager } from '../ast/astManager';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { Debouncer } from '../utils/debounce';
import { DiagnosticContext, IDiagnosticCollector, DiagnosticCollectionOptions, CollectorResult } from './types';
import { VariableAnalyzer } from './analyzers/VariableAnalyzer';
import { ParsedDocument } from '../parser/types';
import { VariableInspectorPanel } from './VariableInspectorPanel';
import { FolderScanner } from './FolderScanner';

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
    private astManager: ASTManager;
    private collectors: IDiagnosticCollector[];
    private variableAnalyzer: VariableAnalyzer;
    private variableInspector: VariableInspectorPanel;
    private folderScanner: FolderScanner;

    // 配置相关
    private config: LPCConfig;
    private excludedIdentifiers: Set<string>;

    // 性能优化
    private debouncer = new Debouncer();
    private isAnalyzing = new Set<string>();
    private lastAnalysisVersion = new Map<string, number>();

    constructor(context: vscode.ExtensionContext, macroManager: MacroManager) {
        this.macroManager = macroManager;
        this.astManager = ASTManager.getInstance();
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
        this.variableInspector = new VariableInspectorPanel(this.variableAnalyzer);
        this.folderScanner = new FolderScanner(
            this.analyzeDocument.bind(this),
            this.diagnosticCollection
        );

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
                    return this.variableInspector.show(editor.document);
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
            getGlobalParsedDocumentService().invalidate(document.uri);
            this.astManager.clearCache(document.uri.toString());
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
            getGlobalParsedDocumentService().invalidate(uri);
            this.astManager.clearCache(uri.toString());
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
        const analysis = this.astManager.parseDocument(document);
        const parsed = analysis.parsed;
        const snapshot = analysis.snapshot;

        if (!parsed) {
            return [...snapshot.parseDiagnostics];
        }

        const diagnosticContext = this.createDiagnosticContext(parsed, analysis);

        // 执行所有收集器
        for (const collector of this.collectors) {
            try {
                const result = await collector.collect(document, parsed, diagnosticContext);
                diagnostics.push(...result);
            } catch (error) {
                console.error(`收集器 ${collector.name} 执行失败:`, error);
            }
        }

        // 收集语法错误
        try {
            diagnostics.push(...snapshot.parseDiagnostics);
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
        const analysis = this.astManager.parseDocument(document);
        const parsed = analysis.parsed;
        const snapshot = analysis.snapshot;

        if (!parsed) {
            return [...snapshot.parseDiagnostics];
        }

        const config = vscode.workspace.getConfiguration('lpc.performance');
        const batchSize = options.batchSize || config.get<number>('batchSize', 3);
        const diagnosticContext = this.createDiagnosticContext(parsed, analysis);

        // 分批处理收集器
        for (let i = 0; i < this.collectors.length; i += batchSize) {
            const batch = this.collectors.slice(i, i + batchSize);

            // 并行处理当前批次
            const results = await Promise.allSettled(
                batch.map(async (collector) => {
                    await this.yieldToMainThread();
                    const startTime = Date.now();
                    const result = await collector.collect(document, parsed, diagnosticContext);
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
            diagnostics.push(...snapshot.parseDiagnostics);
        } catch (err) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`解析 LPC 失败: ${err.message}`);
            }
        }

        return diagnostics;
    }

    public async scanFolder(): Promise<void> {
        await this.folderScanner.scanFolder();
    }

    private createDiagnosticContext(
        parsed: ParsedDocument,
        analysis: { syntax?: DiagnosticContext['syntax']; semantic?: DiagnosticContext['semantic'] }
    ): DiagnosticContext {
        return {
            parsed,
            syntax: analysis.syntax,
            semantic: analysis.semantic
        };
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
