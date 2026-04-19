import * as vscode from 'vscode';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from '../language/shared/WorkspaceDocumentPathSupport';
import { BundledEfunLoader } from './BundledEfunLoader';
import { buildEfunHoverMarkdown, createEfunHover } from './EfunHoverContent';
import { FileFunctionDocTracker, type FunctionDocLookup } from './FileFunctionDocTracker';
import { SimulatedEfunScanner } from './SimulatedEfunScanner';
import type { EfunDoc, StructuredEfunDoc, StructuredEfunParameter, StructuredEfunSignature } from './types';
import type { CallableDoc, CallableParameter, CallableSignature } from '../language/documentation/types';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import type { MacroManager } from '../macroManager';

export class EfunDocsManager {
    private bundledLoader: BundledEfunLoader;
    private fileFunctionDocTracker: FileFunctionDocTracker;
    private simulatedEfunScanner: SimulatedEfunScanner;
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();

    constructor(
        context: vscode.ExtensionContext,
        projectConfigService?: LpcProjectConfigService,
        analysisService?: Pick<DocumentAnalysisService, 'parseDocument'>,
        macroManager?: Pick<MacroManager, 'getMacro'>,
        documentationService?: FunctionDocumentationService,
        pathSupport?: WorkspaceDocumentPathSupport
    ) {
        const resolvedAnalysisService = assertAnalysisService('EfunDocsManager', analysisService);
        const resolvedDocumentationService = assertDocumentationService('EfunDocsManager', documentationService);
        const resolvedPathSupport = assertDocumentPathSupport('EfunDocsManager', pathSupport);
        this.bundledLoader = new BundledEfunLoader(context);
        this.fileFunctionDocTracker = new FileFunctionDocTracker({
            macroManager,
            documentationService: resolvedDocumentationService,
            pathSupport: resolvedPathSupport
        });
        this.simulatedEfunScanner = new SimulatedEfunScanner(projectConfigService, resolvedAnalysisService);
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

    public async getCurrentFileDocForDocument(
        document: vscode.TextDocument,
        funcName: string
    ): Promise<EfunDoc | undefined> {
        return this.fileFunctionDocTracker.getDocForDocument(document, funcName);
    }

    public getInheritedFileDoc(funcName: string): EfunDoc | undefined {
        return this.fileFunctionDocTracker.getDocFromInherited(funcName);
    }

    public async getInheritedFileDocForDocument(
        document: vscode.TextDocument,
        funcName: string,
        options?: { forceFresh?: boolean }
    ): Promise<EfunDoc | undefined> {
        return this.fileFunctionDocTracker.getDocFromInheritedForDocument(document, funcName, options);
    }

    public async getIncludedFileDoc(
        document: vscode.TextDocument,
        funcName: string,
        options?: { forceFresh?: boolean }
    ): Promise<EfunDoc | undefined> {
        return this.fileFunctionDocTracker.getDocFromIncludes(document, funcName, options);
    }

    public async getFunctionDocLookupForDocument(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<FunctionDocLookup> {
        return this.fileFunctionDocTracker.getFunctionDocLookup(document, options);
    }

    public getStandardDoc(funcName: string): EfunDoc | undefined {
        return this.efunDocs.get(funcName);
    }

    public getStandardCallableDoc(funcName: string): CallableDoc | undefined {
        const structuredDoc = this.bundledLoader.getStructuredDoc(funcName);
        return structuredDoc ? materializeCallableDoc(structuredDoc) : undefined;
    }

    public async getEfunDoc(funcName: string): Promise<EfunDoc | undefined> {
        return this.getStandardDoc(funcName);
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

function materializeCallableDoc(structuredDoc: StructuredEfunDoc): CallableDoc {
    return {
        name: structuredDoc.name,
        declarationKey: `efun:${structuredDoc.name}`,
        signatures: structuredDoc.signatures.map(materializeCallableSignature),
        summary: structuredDoc.summary,
        details: structuredDoc.details,
        note: structuredDoc.note,
        sourceKind: 'efun'
    };
}

function materializeCallableSignature(signature: StructuredEfunSignature): CallableSignature {
    return {
        label: signature.label,
        returnType: signature.returnType,
        parameters: signature.parameters.map(materializeCallableParameter),
        isVariadic: signature.isVariadic,
        rawSyntax: signature.label
    };
}

function materializeCallableParameter(parameter: StructuredEfunParameter): CallableParameter {
    return {
        name: parameter.name,
        type: parameter.type,
        description: parameter.description,
        optional: parameter.optional,
        variadic: parameter.variadic
    };
}
