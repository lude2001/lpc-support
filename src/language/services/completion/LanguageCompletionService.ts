import * as vscode from 'vscode';
import { CompletionContextAnalyzer } from '../../../completion/completionContextAnalyzer';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { CompletionQueryEngine } from '../../../completion/completionQueryEngine';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import {
    CompletionCandidate,
    CompletionQueryResult
} from '../../../completion/types';
import { EfunDocsManager } from '../../../efunDocs';
import { MacroManager } from '../../../macroManager';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import { ScopedMethodDiscoveryService } from '../../../objectInference/ScopedMethodDiscoveryService';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../../documentation/assertDocumentationService';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageMarkupContent } from '../../contracts/LanguageMarkup';
import type { LanguagePosition } from '../../contracts/LanguagePosition';
import { CompletionCandidateResolver } from './CompletionCandidateResolver';
import {
    CompletionInheritedIndexService,
    type CompletionInheritanceReporter
} from './CompletionInheritedIndexService';
import { CompletionItemPresentationService } from './CompletionItemPresentationService';
import { ScopedMethodCompletionSupport } from './ScopedMethodCompletionSupport';

export interface LanguageCompletionRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
    triggerKind?: number;
    triggerCharacter?: string;
}

export interface LanguageCompletionItemData {
    candidate: CompletionCandidate;
    context: CompletionQueryResult['context'];
    documentUri: string;
    documentVersion: number;
    resolved?: boolean;
}

export interface LanguageCompletionItem {
    label: string;
    kind?: string;
    detail?: string;
    documentation?: LanguageMarkupContent;
    insertText?: string;
    sortText?: string;
    filterText?: string;
    data?: LanguageCompletionItemData;
}

export interface LanguageCompletionResult {
    items: LanguageCompletionItem[];
    isIncomplete?: boolean;
}

export interface LanguageCompletionResolveRequest {
    context: LanguageCapabilityContext;
    item: LanguageCompletionItem;
}

export interface LanguageCompletionService {
    provideCompletion(request: LanguageCompletionRequest): Promise<LanguageCompletionResult>;
    resolveCompletionItem?(
        request: LanguageCompletionResolveRequest
    ): Promise<LanguageCompletionItem>;
    handleDocumentChange?(document: vscode.TextDocument): void;
    clearCache?(document?: vscode.TextDocument): void;
    getInstrumentation?(): CompletionInstrumentation;
    scanInheritance?(document: vscode.TextDocument): Promise<void>;
}

type CompletionAnalysisService = Pick<
    DocumentAnalysisService,
    | 'getSyntaxDocument'
    | 'getSnapshot'
    | 'getBestAvailableSnapshot'
    | 'getSemanticSnapshot'
    | 'getBestAvailableSemanticSnapshot'
    | 'scheduleRefresh'
    | 'clearCache'
    | 'clearAllCache'
    | 'hasSnapshot'
    | 'hasFreshSnapshot'
>;

function createDefaultInheritanceReporter(): CompletionInheritanceReporter {
    return vscode.window.createOutputChannel('LPC Inheritance');
}

interface QueryBackedLanguageCompletionDependencies {
    analysisService: CompletionAnalysisService;
    scopedMethodDiscoveryService: ScopedMethodDiscoveryService;
    documentationService?: FunctionDocumentationService;
    scopedCompletionSupport: ScopedMethodCompletionSupport;
}

export class QueryBackedLanguageCompletionService implements LanguageCompletionService {
    private readonly efunDocsManager: EfunDocsManager;
    private readonly macroManager: MacroManager;
    private readonly analysisService: CompletionAnalysisService;
    private readonly projectSymbolIndex: ProjectSymbolIndex;
    private readonly queryEngine: CompletionQueryEngine;
    private readonly instrumentation: CompletionInstrumentation;
    private readonly objectInferenceService: ObjectInferenceService;
    private readonly inheritanceReporter: CompletionInheritanceReporter;
    private readonly inheritedIndexService: CompletionInheritedIndexService;
    private readonly candidateResolver: CompletionCandidateResolver;
    private readonly presentationService: CompletionItemPresentationService;
    private readonly scopedMethodDiscoveryService: ScopedMethodDiscoveryService;
    private readonly scopedCompletionSupport: ScopedMethodCompletionSupport;

    constructor(
        efunDocsManager: EfunDocsManager,
        macroManager: MacroManager,
        instrumentation?: CompletionInstrumentation,
        objectInferenceService: ObjectInferenceService,
        inheritanceReporter: CompletionInheritanceReporter = createDefaultInheritanceReporter(),
        dependencies?: QueryBackedLanguageCompletionDependencies
    ) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        this.analysisService = assertAnalysisService('QueryBackedLanguageCompletionService', dependencies?.analysisService);
        this.instrumentation = instrumentation ?? new CompletionInstrumentation();
        if (!dependencies?.scopedMethodDiscoveryService) {
            throw new Error('QueryBackedLanguageCompletionService requires an injected ScopedMethodDiscoveryService');
        }
        if (!dependencies?.scopedCompletionSupport) {
            throw new Error('QueryBackedLanguageCompletionService requires an injected ScopedMethodCompletionSupport');
        }
        assertDocumentationService(
            'QueryBackedLanguageCompletionService',
            dependencies?.documentationService
        );
        this.objectInferenceService = objectInferenceService;
        this.inheritanceReporter = inheritanceReporter;
        this.projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(this.macroManager));
        this.inheritedIndexService = new CompletionInheritedIndexService(
            this.analysisService,
            this.projectSymbolIndex,
            this.inheritanceReporter
        );
        this.scopedMethodDiscoveryService = dependencies.scopedMethodDiscoveryService;
        this.scopedCompletionSupport = dependencies.scopedCompletionSupport;
        this.candidateResolver = new CompletionCandidateResolver(
            this.objectInferenceService,
            this.scopedMethodDiscoveryService,
            this.scopedCompletionSupport,
            this.inheritedIndexService
        );
        this.presentationService = new CompletionItemPresentationService(
            this.efunDocsManager,
            this.macroManager,
            this.projectSymbolIndex,
            this.scopedCompletionSupport
        );
        this.queryEngine = new CompletionQueryEngine({
            snapshotProvider: this.analysisService,
            projectSymbolIndex: this.projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer(),
            macroManager: this.macroManager,
            efunProvider: {
                getAllFunctions: () => this.efunDocsManager.getAllFunctions(),
                getAllSimulatedFunctions: () => this.efunDocsManager.getAllSimulatedFunctions()
            }
        });
    }

    public async provideCompletion(request: LanguageCompletionRequest): Promise<LanguageCompletionResult> {
        const document = this.requireTextDocument(request.context);
        const position = new vscode.Position(request.position.line, request.position.character);
        const cancellation = request.context.cancellation ?? { isCancellationRequested: false };
        const completionContext = {
            triggerKind: request.triggerKind,
            triggerCharacter: request.triggerCharacter
        } as vscode.CompletionContext;
        const trace = this.instrumentation.startRequest({
            documentUri: document.uri.toString(),
            documentVersion: document.version,
            triggerKind: completionContext.triggerKind,
            triggerCharacter: completionContext.triggerCharacter
        });

        try {
            this.inheritedIndexService.warmInheritedIndex(document);

            const result = this.queryEngine.query(
                document,
                position,
                completionContext,
                cancellation as vscode.CancellationToken,
                trace
            );
            if (cancellation.isCancellationRequested) {
                trace.complete(result.context.kind, 0);
                return { items: [] };
            }

            const candidates = await this.candidateResolver.resolveCompletionCandidates(
                document,
                position,
                cancellation,
                result
            );
            const items = candidates.map(candidate => this.presentationService.createCompletionItem(candidate, result, document));
            trace.complete(result.context.kind, items.length);
            return { items, isIncomplete: false };
        } catch (error) {
            console.error('Error providing completions:', error);
            trace.complete('identifier', 0);
            return { items: [] };
        }
    }

    public async resolveCompletionItem(
        request: LanguageCompletionResolveRequest
    ): Promise<LanguageCompletionItem> {
        const cancellation = request.context.cancellation ?? { isCancellationRequested: false };
        if (cancellation.isCancellationRequested) {
            return request.item;
        }

        const data = request.item.data;
        if (!data || data.resolved) {
            return request.item;
        }

        const trace = this.instrumentation.startRequest({
            documentUri: data.documentUri,
            documentVersion: data.documentVersion
        });
        const candidate = data.candidate;
        let resolvedItem: LanguageCompletionItem = {
            ...request.item
        };

        await trace.measureAsync('item-resolve', async () => {
            resolvedItem = await this.presentationService.resolveCompletionItem(resolvedItem, candidate);
        }, { candidateCount: 1 });

        resolvedItem.data = {
            ...data,
            resolved: true
        };
        trace.complete(data.context.kind, 1);
        return resolvedItem;
    }

    public handleDocumentChange(document: vscode.TextDocument): void {
        this.inheritedIndexService.handleDocumentChange(document);
    }

    public clearCache(document?: vscode.TextDocument): void {
        this.inheritedIndexService.clearCache(document);
    }

    public getInstrumentation(): CompletionInstrumentation {
        return this.instrumentation;
    }

    private requireTextDocument(context: LanguageCapabilityContext): vscode.TextDocument {
        return context.document as unknown as vscode.TextDocument;
    }

    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        await this.inheritedIndexService.scanInheritance(document);
    }

}
