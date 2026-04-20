import * as vscode from 'vscode';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from '../language/shared/WorkspaceDocumentPathSupport';
import { BundledEfunLoader } from './BundledEfunLoader';
import { FileFunctionDocTracker, type FunctionDocLookup } from './FileFunctionDocTracker';
import { FunctionDocCompatMaterializer } from './FunctionDocCompatMaterializer';
import { FunctionDocLookupBuilder } from './FunctionDocLookupBuilder';
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
        pathSupport?: WorkspaceDocumentPathSupport,
        compatMaterializer?: FunctionDocCompatMaterializer,
        lookupBuilder?: FunctionDocLookupBuilder
    ) {
        const resolvedAnalysisService = assertAnalysisService('EfunDocsManager', analysisService);
        const resolvedDocumentationService = assertDocumentationService('EfunDocsManager', documentationService);
        const resolvedPathSupport = assertDocumentPathSupport('EfunDocsManager', pathSupport);
        const resolvedCompatMaterializer = compatMaterializer
            ?? (() => {
                throw new Error('EfunDocsManager requires an injected FunctionDocCompatMaterializer');
            })();
        const resolvedLookupBuilder = lookupBuilder
            ?? (() => {
                throw new Error('EfunDocsManager requires an injected FunctionDocLookupBuilder');
            })();
        this.bundledLoader = new BundledEfunLoader(context);
        this.fileFunctionDocTracker = new FileFunctionDocTracker({
            documentationService: resolvedDocumentationService,
            compatMaterializer: resolvedCompatMaterializer,
            lookupBuilder: resolvedLookupBuilder
        });
        this.simulatedEfunScanner = new SimulatedEfunScanner(
            projectConfigService,
            resolvedAnalysisService,
            resolvedDocumentationService,
            resolvedCompatMaterializer
        );
        this.efunDocs = this.createBundledDocsMap();
        this.efunCategories = this.createBundledCategoriesMap();

        this.registerSimulatedEfunCommand(context);

        this.runBackgroundTask(this.simulatedEfunScanner.load(), '加载模拟函数库文档失败');
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

    private runBackgroundTask(task: Promise<void>, message: string): void {
        void task.catch(error => {
            console.error(message, error);
        });
    }

    public async getCurrentFileDocForDocument(
        document: vscode.TextDocument,
        funcName: string
    ): Promise<EfunDoc | undefined> {
        return this.fileFunctionDocTracker.getDocForDocument(document, funcName);
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

    public async getSimulatedDocAsync(funcName: string): Promise<EfunDoc | undefined> {
        return this.simulatedEfunScanner.getAsync(funcName);
    }

    public async refreshWorkspaceState(): Promise<void> {
        await this.simulatedEfunScanner.refreshWorkspaceState(true);
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
