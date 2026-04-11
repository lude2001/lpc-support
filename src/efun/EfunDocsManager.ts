import * as vscode from 'vscode';
import { BundledEfunLoader } from './BundledEfunLoader';
import { buildEfunHoverMarkdown, createEfunHover } from './EfunHoverContent';
import { FileFunctionDocTracker } from './FileFunctionDocTracker';
import { RemoteEfunFetcher } from './RemoteEfunFetcher';
import { SimulatedEfunScanner } from './SimulatedEfunScanner';
import type { EfunDoc } from './types';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';

export class EfunDocsManager {
    private bundledLoader: BundledEfunLoader;
    private fileFunctionDocTracker: FileFunctionDocTracker;
    private remoteFetcher: RemoteEfunFetcher;
    private simulatedEfunScanner: SimulatedEfunScanner;
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();
    private remoteDocFetches: Map<string, Promise<EfunDoc | undefined>> = new Map();
    private missingRemoteDocs = new Set<string>();

    constructor(context: vscode.ExtensionContext, projectConfigService?: LpcProjectConfigService) {
        this.bundledLoader = new BundledEfunLoader(context);
        this.fileFunctionDocTracker = new FileFunctionDocTracker();
        this.remoteFetcher = new RemoteEfunFetcher();
        this.simulatedEfunScanner = new SimulatedEfunScanner(projectConfigService);
        this.efunDocs = this.createBundledDocsMap();
        this.efunCategories = this.createBundledCategoriesMap();

        this.registerSimulatedEfunCommand(context);

        this.runBackgroundTask(this.simulatedEfunScanner.load(), '加载模拟函数库文档失败');

        this.registerDocumentListeners(context);

        this.refreshActiveFileDocs();
    }

    private refreshCurrentFileDocs(document: vscode.TextDocument): void {
        this.runBackgroundTask(this.updateCurrentFileDocs(document), '更新当前文件函数文档失败');
    }

    private refreshActiveFileDocs(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !this.isRelevantDocument(activeEditor.document)) {
            return;
        }

        this.refreshCurrentFileDocs(activeEditor.document);
    }

    private registerDocumentListeners(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (this.isRelevantDocument(event.document)) {
                    this.refreshCurrentFileDocs(event.document);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor && this.isRelevantDocument(editor.document)) {
                    this.refreshCurrentFileDocs(editor.document);
                }
            })
        );
    }

    private registerSimulatedEfunCommand(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.configureSimulatedEfuns', () => this.simulatedEfunScanner.configure())
        );
    }

    private createBundledDocsMap(): Map<string, EfunDoc> {
        return new Map(
            this.bundledLoader.getAllNames().map((name) => [name, this.bundledLoader.get(name)!])
        );
    }

    private createBundledCategoriesMap(): Map<string, string[]> {
        return new Map(
            Array.from(this.bundledLoader.getCategories().entries(), ([category, names]) => [category, [...names]])
        );
    }

    private isRelevantDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'lpc' || document.fileName.endsWith('.c');
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

    public createHoverContent(doc: EfunDoc): vscode.Hover {
        return createEfunHover(buildEfunHoverMarkdown(doc));
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
