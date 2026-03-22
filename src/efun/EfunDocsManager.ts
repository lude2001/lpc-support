import * as vscode from 'vscode';
import { BundledEfunLoader } from './BundledEfunLoader';
import { EfunHoverProvider } from './EfunHoverProvider';
import { FileFunctionDocTracker } from './FileFunctionDocTracker';
import { RemoteEfunFetcher } from './RemoteEfunFetcher';
import { SimulatedEfunScanner } from './SimulatedEfunScanner';
import type { EfunDoc } from './types';

export class EfunDocsManager {
    private bundledLoader: BundledEfunLoader;
    private hoverProvider: EfunHoverProvider;
    private fileFunctionDocTracker: FileFunctionDocTracker;
    private remoteFetcher: RemoteEfunFetcher;
    private simulatedEfunScanner: SimulatedEfunScanner;
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();
    private remoteDocFetches: Map<string, Promise<EfunDoc | undefined>> = new Map();
    private missingRemoteDocs = new Set<string>();

    constructor(context: vscode.ExtensionContext) {
        this.bundledLoader = new BundledEfunLoader(context);
        this.fileFunctionDocTracker = new FileFunctionDocTracker();
        this.remoteFetcher = new RemoteEfunFetcher();
        this.simulatedEfunScanner = new SimulatedEfunScanner();
        this.hoverProvider = new EfunHoverProvider(this);
        this.efunDocs = new Map(
            this.bundledLoader.getAllNames().map(name => [name, this.bundledLoader.get(name)!])
        );
        this.efunCategories = new Map(
            Array.from(this.bundledLoader.getCategories().entries(), ([category, names]) => [category, [...names]])
        );

        // 注册悬停提供程序
        context.subscriptions.push(
            vscode.languages.registerHoverProvider('lpc', this.hoverProvider)
        );

        // 注册模拟函数库配置命令
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.configureSimulatedEfuns', () => this.simulatedEfunScanner.configure())
        );

        // 加载模拟函数库文档
        this.runBackgroundTask(this.simulatedEfunScanner.load(), '加载模拟函数库文档失败');

        // 添加文件变更事件监听
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.languageId === 'lpc' || e.document.fileName.endsWith('.c')) {
                    this.refreshCurrentFileDocs(e.document);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && (editor.document.languageId === 'lpc' || editor.document.fileName.endsWith('.c'))) {
                    this.refreshCurrentFileDocs(editor.document);
                }
            })
        );

        // 如果已经有活动编辑器，则立即更新当前文件的文档
        if (vscode.window.activeTextEditor &&
            (vscode.window.activeTextEditor.document.languageId === 'lpc' ||
             vscode.window.activeTextEditor.document.fileName.endsWith('.c'))) {
            this.refreshCurrentFileDocs(vscode.window.activeTextEditor.document);
        }
    }

    private refreshCurrentFileDocs(document: vscode.TextDocument): void {
        this.runBackgroundTask(this.updateCurrentFileDocs(document), '更新当前文件函数文档失败');
    }

    private runBackgroundTask(task: Promise<void>, message: string): void {
        void task.catch(error => {
            console.error(message, error);
        });
    }

    public async prepareHoverLookup(document: vscode.TextDocument): Promise<void> {
        await this.updateCurrentFileDocs(document);
    }

    public getCurrentFileDoc(funcName: string): EfunDoc | undefined {
        return this.fileFunctionDocTracker.getDoc(funcName);
    }

    public getInheritedFileDoc(funcName: string): EfunDoc | undefined {
        return this.fileFunctionDocTracker.getDocFromInherited(funcName);
    }

    public async getIncludedFileDoc(
        document: vscode.TextDocument,
        funcName: string
    ): Promise<EfunDoc | undefined> {
        return this.fileFunctionDocTracker.getDocFromIncludes(document, funcName);
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
            .catch(() => {
                this.missingRemoteDocs.delete(funcName);
                return undefined;
            })
            .finally(() => {
                this.remoteDocFetches.delete(funcName);
            });

        this.remoteDocFetches.set(funcName, request);
        return request;
    }

    /**
     * 更新当前文件的函数文档
     * @param document 当前活动的文档
     */
    private async updateCurrentFileDocs(document: vscode.TextDocument): Promise<void> {
        await this.fileFunctionDocTracker.update(document);
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        return this.hoverProvider.provideHover(document, position);
    }

    public createHoverContent(doc: EfunDoc): vscode.Hover {
        return this.hoverProvider.createHoverContent(doc);
    }

    public getCategories(): Map<string, string[]> {
        return this.efunCategories;
    }

    public getAllFunctions(): string[] {
        return Array.from(this.efunDocs.keys());
    }

    public getAllSimulatedFunctions(): string[] {
        return this.simulatedEfunScanner.getAllNames();
    }

    public getSimulatedDoc(funcName: string): EfunDoc | undefined {
        return this.simulatedEfunScanner.get(funcName);
    }
}
