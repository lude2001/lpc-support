import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from '../macroManager';
import { ASTManager } from '../ast/astManager';
import { Debouncer } from '../utils/debounce';
import { IDiagnosticCollector, DiagnosticCollectionOptions } from './types';
import { VariableAnalyzer } from './analyzers/VariableAnalyzer';
import { VariableInspectorPanel } from './VariableInspectorPanel';
import { FolderScanner } from './FolderScanner';
import { toVsCodeDiagnostics } from '../language/adapters/vscode/diagnosticsAdapter';
import type { LanguageDocument } from '../language/contracts/LanguageDocument';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import type {
    LanguageDiagnosticsRequest,
    LanguageDiagnosticsService
} from '../language/services/diagnostics/LanguageDiagnosticsService';

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

interface DiagnosticsOrchestratorOptions {
    registerDocumentLifecycle?: boolean;
    collectors?: IDiagnosticCollector[];
    diagnosticsService?: LanguageDiagnosticsService;
}

interface DiagnosticsPerformanceSettings {
    debounceDelay: number;
    enableAsyncDiagnostics: boolean;
    batchSize: number;
}

export function createDefaultDiagnosticsCollectors(macroManager: MacroManager): IDiagnosticCollector[] {
    return [
        new StringLiteralCollector(),
        new FileNamingCollector(),
        new UnusedVariableCollector(),
        new GlobalVariableCollector(),
        new LocalVariableDeclarationCollector(),
        new ObjectAccessCollector(macroManager),
        new MacroUsageCollector(macroManager),
    ];
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
    private diagnosticsService: LanguageDiagnosticsService;
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
    private readonly registerDocumentLifecycle: boolean;
    private readonly externalDiagnosticsService?: LanguageDiagnosticsService;

    constructor(
        context: vscode.ExtensionContext,
        macroManager: MacroManager,
        options: DiagnosticsOrchestratorOptions = {}
    ) {
        this.macroManager = macroManager;
        this.astManager = ASTManager.getInstance();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        this.registerDocumentLifecycle = options.registerDocumentLifecycle ?? true;
        this.externalDiagnosticsService = options.diagnosticsService;
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
            this.analyzeDocumentForFolderScan.bind(this),
            this.diagnosticCollection
        );

        // 初始化收集器
        this.collectors = options.collectors ?? this.initializeCollectors();
        this.diagnosticsService = this.createDiagnosticsService();

        // 注册命令和事件
        this.registerCommandsAndEvents(context);
    }

    /**
     * 初始化所有收集器
     */
    private initializeCollectors(): IDiagnosticCollector[] {
        return createDefaultDiagnosticsCollectors(this.macroManager);
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

        if (!this.registerDocumentLifecycle) {
            return;
        }

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
            const documentKey = event.document.uri.toString();
            const debouncedAnalyze = this.debouncer.debounce(
                documentKey,
                () => this.analyzeDocument(event.document, false),
                this.getPerformanceSettings().debounceDelay
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
        }
    }

    /**
     * 分析文档
     */
    public analyzeDocument(document: vscode.TextDocument, showMessage: boolean = false): void {
        if (!this.shouldAnalyzeDocument(document)) {
            this.clearDocumentAnalysisState(document);
            this.diagnosticCollection.delete(document.uri);
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

    public async analyzeDocumentForFolderScan(
        document: vscode.TextDocument,
        showMessage: boolean = false
    ): Promise<vscode.Diagnostic[]> {
        if (!this.shouldAnalyzeDocument(document)) {
            this.clearDocumentAnalysisState(document);
            this.diagnosticCollection.delete(document.uri);
            return [];
        }

        const diagnostics = await this.collectDiagnosticsForDocument(document, { showMessage });

        this.diagnosticCollection.set(document.uri, diagnostics);
        if (showMessage && diagnostics.length === 0) {
            vscode.window.showInformationMessage('代码检查完成，未发现问题');
        }

        return diagnostics;
    }

    /**
     * 异步分析文档
     */
    private async analyzeDocumentAsync(
        document: vscode.TextDocument,
        options: DiagnosticCollectionOptions = {}
    ): Promise<void> {
        const diagnostics = await this.collectDiagnosticsForDocument(document, options);

        this.diagnosticCollection.set(document.uri, diagnostics);

        if (options.showMessage && diagnostics.length === 0) {
            vscode.window.showInformationMessage('代码检查完成，未发现问题');
        }
    }

    /**
     * 同步收集诊断
     */
    private async collectDiagnostics(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const diagnostics = await this.getDiagnosticsService().collectDiagnostics(this.createDiagnosticsRequest(document));
        return toVsCodeDiagnostics(diagnostics);
    }

    /**
     * 异步收集诊断（批量处理）
     */
    private async collectDiagnosticsAsync(
        document: vscode.TextDocument,
        options: DiagnosticCollectionOptions = {}
    ): Promise<vscode.Diagnostic[]> {
        const batchSize = options.batchSize || this.getPerformanceSettings().batchSize;
        const diagnostics = await this.getDiagnosticsService().collectDiagnostics(
            this.createDiagnosticsRequest(document),
            {
                batchSize,
                yieldToMainThread: this.yieldToMainThread.bind(this)
            }
        );

        return toVsCodeDiagnostics(diagnostics);
    }

    private async collectDiagnosticsForDocument(
        document: vscode.TextDocument,
        options: DiagnosticCollectionOptions = {}
    ): Promise<vscode.Diagnostic[]> {
        if (!this.getPerformanceSettings().enableAsyncDiagnostics) {
            return this.collectDiagnostics(document);
        }

        return this.collectDiagnosticsAsync(document, options);
    }

    public async scanFolder(): Promise<void> {
        await this.folderScanner.scanFolder();
    }

    private getDiagnosticsService(): LanguageDiagnosticsService {
        const currentService = this.diagnosticsService as LanguageDiagnosticsService & {
            __collectorSource?: IDiagnosticCollector[];
        };

        if (currentService.__collectorSource !== this.collectors) {
            this.diagnosticsService = this.createDiagnosticsService();
        }

        return this.diagnosticsService;
    }

    private createDiagnosticsRequest(document: vscode.TextDocument): LanguageDiagnosticsRequest {
        return {
            context: {
                document: {
                    uri: document.uri.toString(),
                    version: document.version,
                    getText: () => document.getText()
                },
                workspace: {
                    workspaceRoot: this.resolveWorkspaceRoot(document)
                },
                mode: 'lsp'
            }
        };
    }

    private createDiagnosticsService(): LanguageDiagnosticsService {
        if (this.externalDiagnosticsService) {
            return this.externalDiagnosticsService;
        }

        const service = createSharedDiagnosticsService(this.astManager, this.collectors) as LanguageDiagnosticsService & {
            __collectorSource?: IDiagnosticCollector[];
        };
        service.__collectorSource = this.collectors;
        return service;
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

    private shouldAnalyzeDocument(document: vscode.TextDocument): boolean {
        if (!this.shouldCheckFile(document.fileName)) {
            return false;
        }

        const workspaceRoot = this.tryGetWorkspaceRoot(document);
        if (!workspaceRoot) {
            return false;
        }

        return fs.existsSync(path.join(workspaceRoot, 'lpc-support.json'));
    }

    private clearDocumentAnalysisState(document: vscode.TextDocument): void {
        const documentKey = document.uri.toString();
        this.isAnalyzing.delete(documentKey);
        this.lastAnalysisVersion.delete(documentKey);
    }

    /**
     * 让出主线程
     */
    private async yieldToMainThread(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    private getPerformanceSettings(): DiagnosticsPerformanceSettings {
        const config = vscode.workspace.getConfiguration('lpc.performance');
        return {
            debounceDelay: config.get<number>('debounceDelay', 300),
            enableAsyncDiagnostics: config.get<boolean>('enableAsyncDiagnostics', true),
            batchSize: config.get<number>('batchSize', 3)
        };
    }

    private resolveWorkspaceRoot(document: vscode.TextDocument): string {
        return this.tryGetWorkspaceRoot(document) ?? path.dirname(document.fileName);
    }

    private tryGetWorkspaceRoot(document: vscode.TextDocument): string | undefined {
        return vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
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
