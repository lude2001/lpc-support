import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DiagnosticCollectionOptions } from './types';
import { VariableAnalyzer } from './analyzers/VariableAnalyzer';
import { VariableInspectorPanel } from './VariableInspectorPanel';
import { FolderScanner } from './FolderScanner';
import { toVsCodeDiagnostics } from '../language/adapters/vscode/diagnosticsAdapter';
import type {
    LanguageDiagnosticsRequest,
    LanguageDiagnosticsService
} from '../language/services/diagnostics/LanguageDiagnosticsService';

/**
 * LPC配置接口
 */
interface LPCConfig {
    types: string[];
    modifiers: string[];
    efuns: { [key: string]: { snippet: string; detail: string } };
}

interface DiagnosticsOrchestratorOptions {
    diagnosticsService: LanguageDiagnosticsService;
}

interface DiagnosticsPerformanceSettings {
    debounceDelay: number;
    enableAsyncDiagnostics: boolean;
    batchSize: number;
}

/**
 * 诊断协调器
 * 负责管理和协调所有诊断收集器的执行
 */
export class DiagnosticsOrchestrator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private diagnosticsService: LanguageDiagnosticsService;
    private variableAnalyzer: VariableAnalyzer;
    private variableInspector: VariableInspectorPanel;
    private folderScanner: FolderScanner;

    // 配置相关
    private config: LPCConfig;
    private excludedIdentifiers: Set<string>;

    constructor(
        context: vscode.ExtensionContext,
        options: DiagnosticsOrchestratorOptions
    ) {
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
            this.analyzeDocumentForFolderScan.bind(this),
            this.diagnosticCollection
        );

        this.diagnosticsService = options.diagnosticsService;

        this.registerCommands(context);
    }

    /**
     * 注册命令
     */
    private registerCommands(context: vscode.ExtensionContext): void {
        // 注册显示变量命令
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.showVariables', () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.languageId === 'lpc') {
                    return this.variableInspector.show(editor.document);
                }
            })
        );
    }

    /**
     * 分析文档
     */
    public analyzeDocument(document: vscode.TextDocument, showMessage: boolean = false): void {
        if (!this.shouldAnalyzeDocument(document)) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }

        // 异步分析
        this.analyzeDocumentAsync(document, { showMessage })
            .catch(error => {
                console.error('分析文档时发生错误:', error);
            });
    }

    public async analyzeDocumentForFolderScan(
        document: vscode.TextDocument,
        showMessage: boolean = false
    ): Promise<vscode.Diagnostic[]> {
        if (!this.shouldAnalyzeDocument(document)) {
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
        const diagnostics = await this.diagnosticsService.collectDiagnostics(this.createDiagnosticsRequest(document));
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
        const diagnostics = await this.diagnosticsService.collectDiagnostics(
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
    }
}
