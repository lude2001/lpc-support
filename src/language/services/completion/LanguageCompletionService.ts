import * as vscode from 'vscode';
import { normalizeLpcType } from '../../../ast/typeNormalization';
import { SymbolType } from '../../../ast/symbolTable';
import { CompletionContextAnalyzer } from '../../../completion/completionContextAnalyzer';
import { CompletionInstrumentation } from '../../../completion/completionInstrumentation';
import { CompletionQueryEngine } from '../../../completion/completionQueryEngine';
import { InheritanceResolver } from '../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import {
    CompletionCandidate,
    CompletionCandidateSourceType,
    CompletionQueryResult,
    FunctionSummary,
    TypeDefinitionSummary
} from '../../../completion/types';
import { EfunDoc, EfunDocsManager } from '../../../efunDocs';
import { MacroManager } from '../../../macroManager';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import { ScopedMethodDiscoveryService } from '../../../objectInference/ScopedMethodDiscoveryService';
import { ObjectInferenceResult } from '../../../objectInference/types';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { PathResolver } from '../../../utils/pathResolver';
import { FunctionDocumentationService } from '../../documentation/FunctionDocumentationService';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageMarkupContent } from '../../contracts/LanguageMarkup';
import type { LanguagePosition } from '../../contracts/LanguagePosition';
import { CompletionCandidateResolver } from './CompletionCandidateResolver';
import {
    CompletionInheritedIndexService,
    type CompletionInheritanceReporter
} from './CompletionInheritedIndexService';
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
    scopedMethodDiscoveryService?: ScopedMethodDiscoveryService;
    documentationService?: FunctionDocumentationService;
    scopedDocumentLoader?: (uri: string) => Promise<vscode.TextDocument | undefined>;
    scopedCompletionSupport?: ScopedMethodCompletionSupport;
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
    private readonly scopedMethodDiscoveryService: ScopedMethodDiscoveryService;
    private readonly scopedCompletionSupport: ScopedMethodCompletionSupport;

    constructor(
        efunDocsManager: EfunDocsManager,
        macroManager: MacroManager,
        instrumentation?: CompletionInstrumentation,
        objectInferenceService?: ObjectInferenceService,
        inheritanceReporter: CompletionInheritanceReporter = createDefaultInheritanceReporter(),
        dependencies?: QueryBackedLanguageCompletionDependencies
    ) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        this.analysisService = assertAnalysisService('QueryBackedLanguageCompletionService', dependencies?.analysisService);
        this.instrumentation = instrumentation ?? new CompletionInstrumentation();
        this.objectInferenceService = objectInferenceService ?? new ObjectInferenceService(macroManager, undefined, this.analysisService);
        this.inheritanceReporter = inheritanceReporter;
        this.projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(this.macroManager));
        this.inheritedIndexService = new CompletionInheritedIndexService(
            this.analysisService,
            this.projectSymbolIndex,
            this.inheritanceReporter
        );
        this.scopedMethodDiscoveryService = dependencies?.scopedMethodDiscoveryService
            ?? new ScopedMethodDiscoveryService(macroManager, undefined, this.analysisService);
        this.scopedCompletionSupport = dependencies?.scopedCompletionSupport
            ?? new ScopedMethodCompletionSupport({
                documentationService: dependencies?.documentationService ?? new FunctionDocumentationService(),
                documentLoader: dependencies?.scopedDocumentLoader
                    ?? (async (uri: string) => this.inheritedIndexService.getDocumentForUri(uri))
            });
        this.candidateResolver = new CompletionCandidateResolver(
            this.projectSymbolIndex,
            this.objectInferenceService,
            this.scopedMethodDiscoveryService,
            this.scopedCompletionSupport,
            this.inheritedIndexService
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
            const items = candidates.map(candidate => this.createCompletionItem(candidate, result, document));
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
        const resolvedItem: LanguageCompletionItem = {
            ...request.item
        };

        await trace.measureAsync('item-resolve', async () => {
            if (candidate.insertText) {
                resolvedItem.insertText = candidate.insertText;
            }

            switch (candidate.metadata.sourceType) {
                case 'efun':
                    this.applyEfunDocumentation(resolvedItem, this.efunDocsManager.getStandardDoc(candidate.label));
                    break;
                case 'simul-efun':
                    this.applyEfunDocumentation(resolvedItem, this.efunDocsManager.getSimulatedDoc(candidate.label));
                    break;
                case 'macro':
                    this.applyMacroDocumentation(resolvedItem, candidate.label);
                    break;
                case 'scoped-method':
                    await this.scopedCompletionSupport.applyScopedDocumentation(resolvedItem, candidate);
                    break;
                case 'local':
                case 'inherited':
                case 'struct-member':
                    this.applyStructuredDocumentation(resolvedItem, candidate);
                    break;
                case 'keyword':
                default:
                    this.applyKeywordDocumentation(resolvedItem, candidate);
                    break;
            }
        }, { candidateCount: 1 });

        resolvedItem.data = {
            ...data,
            resolved: true
        };
        trace.complete(data.context.kind, 1);
        return resolvedItem;
    }

    public handleDocumentChange(document: vscode.TextDocument): void {
        this.analysisService.scheduleRefresh(document, () => {
            this.projectSymbolIndex.updateFromSnapshot(this.inheritedIndexService.getBestAvailableIndexSnapshot(document));
        });
    }

    public clearCache(document?: vscode.TextDocument): void {
        if (document) {
            this.analysisService.clearCache(document.uri.toString());
            this.projectSymbolIndex.removeFile(document.uri.toString());
            return;
        }

        this.analysisService.clearAllCache();
        this.projectSymbolIndex.clear();
    }

    public getInstrumentation(): CompletionInstrumentation {
        return this.instrumentation;
    }

    private requireTextDocument(context: LanguageCapabilityContext): vscode.TextDocument {
        return context.document as unknown as vscode.TextDocument;
    }

    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        this.inheritanceReporter.clear();
        this.inheritanceReporter.show(true);
        this.inheritanceReporter.appendLine(`正在分析文件: ${document.fileName}`);

        try {
            const snapshot = this.inheritedIndexService.getIndexSnapshot(document, false);
            this.projectSymbolIndex.updateFromSnapshot(snapshot);
            this.inheritedIndexService.refreshInheritedIndex(document);

            const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(document.uri.toString());
            this.inheritanceReporter.appendLine('解析完成:');
            this.inheritanceReporter.appendLine(`  - 当前文件导出函数: ${snapshot.exportedFunctions.length}`);
            this.inheritanceReporter.appendLine(`  - 当前文件类型定义: ${snapshot.typeDefinitions.length}`);
            this.inheritanceReporter.appendLine(`  - 继承链长度: ${inheritedSymbols.chain.length}`);

            if (snapshot.inheritStatements.length > 0) {
                this.inheritanceReporter.appendLine('\ninherit 列表:');
                snapshot.inheritStatements.forEach(statement => {
                    this.inheritanceReporter.appendLine(`  - ${statement.value} (${statement.expressionKind})`);
                });
            }

            if (inheritedSymbols.functions.length > 0) {
                this.inheritanceReporter.appendLine('\n继承函数:');
                inheritedSymbols.functions.forEach(func => {
                    this.inheritanceReporter.appendLine(`  - ${normalizeLpcType(func.returnType)} ${func.name}()`);
                });
            }

            if (inheritedSymbols.unresolvedTargets.length > 0) {
                this.inheritanceReporter.appendLine('\n未解析继承目标:');
                inheritedSymbols.unresolvedTargets.forEach(target => {
                    this.inheritanceReporter.appendLine(`  - ${target.rawValue}`);
                });
            }
        } catch (error) {
            this.inheritanceReporter.appendLine(`错误: ${error}`);
        }
    }

    private createCompletionItem(
        candidate: CompletionCandidate,
        result: CompletionQueryResult,
        document: vscode.TextDocument
    ): LanguageCompletionItem {
        return {
            label: candidate.label,
            kind: this.mapCompletionKind(candidate.kind),
            detail: candidate.detail,
            sortText: `${this.getSortPrefix(candidate.sortGroup)}_${this.getCandidateSortBucket(candidate)}_${candidate.label}`,
            data: {
                candidate,
                context: result.context,
                documentUri: document.uri.toString(),
                documentVersion: document.version,
                resolved: false
            }
        };
    }

    private mapCompletionKind(kind: vscode.CompletionItemKind): string {
        switch (kind) {
            case vscode.CompletionItemKind.Method:
                return 'method';
            case vscode.CompletionItemKind.Function:
                return 'function';
            case vscode.CompletionItemKind.Struct:
                return 'struct';
            case vscode.CompletionItemKind.Class:
                return 'class';
            case vscode.CompletionItemKind.Field:
                return 'field';
            case vscode.CompletionItemKind.Variable:
                return 'variable';
            case vscode.CompletionItemKind.Keyword:
                return 'keyword';
            default:
                return 'text';
        }
    }

    private getSortPrefix(group: CompletionCandidate['sortGroup']): string {
        switch (group) {
            case 'scope': return '0';
            case 'type-member': return '1';
            case 'inherited': return '2';
            case 'builtin': return '3';
            case 'keyword': return '4';
            default: return '9';
        }
    }

    private applyEfunDocumentation(item: LanguageCompletionItem, doc?: EfunDoc): void {
        if (!doc) {
            return;
        }

        const sections: string[] = [];
        if (doc.syntax) {
            sections.push(`\`\`\`lpc\n${doc.syntax}\n\`\`\``);
        }
        if (doc.returnType) {
            sections.push(`**Return Type:** \`${doc.returnType}\``);
        }
        if (doc.description) {
            sections.push(doc.description);
        }
        if (doc.example) {
            sections.push(`**Example**\n\`\`\`lpc\n${doc.example}\n\`\`\``);
        }

        item.documentation = {
            kind: 'markdown',
            value: sections.join('\n\n')
        };
        item.detail = doc.returnType ? `${doc.returnType} ${item.label}` : item.detail;
        item.insertText = `${item.label}($1)`;
    }

    private applyMacroDocumentation(item: LanguageCompletionItem, macroName: string): void {
        const macro = this.macroManager.getMacro(macroName);
        if (!macro) {
            return;
        }

        const documentation = this.macroManager.getMacroHoverContent(macro);
        if (documentation) {
            item.documentation = {
                kind: 'markdown',
                value: documentation.value
            };
        }
    }

    private applyStructuredDocumentation(item: LanguageCompletionItem, candidate: CompletionCandidate): void {
        const sections: string[] = [];
        const record = candidate.metadata.sourceUri ? this.projectSymbolIndex.getRecord(candidate.metadata.sourceUri) : undefined;
        const symbol = candidate.metadata.symbol;
        const exportedFunction = record?.exportedFunctions.find(func => func.name === candidate.label);

        if (symbol?.definition) {
            sections.push(`\`\`\`lpc\n${symbol.definition}\n\`\`\``);
        } else if (exportedFunction?.definition) {
            sections.push(`\`\`\`lpc\n${exportedFunction.definition}\n\`\`\``);
        } else if (candidate.detail) {
            sections.push(`\`\`\`lpc\n${candidate.detail}\n\`\`\``);
        }

        if (symbol?.documentation) {
            sections.push(symbol.documentation);
        } else if (exportedFunction?.documentation) {
            sections.push(exportedFunction.documentation);
        }

        if (candidate.metadata.sourceType === 'inherited' && candidate.metadata.sourceUri) {
            sections.push(`*Inherited from* \`${vscode.Uri.parse(candidate.metadata.sourceUri).fsPath}\``);
        }

        if (candidate.metadata.sourceType === 'struct-member' && candidate.metadata.sourceUri) {
            const member = this.findMemberDefinition(candidate.label, record?.typeDefinitions || []);
            if (member?.definition) {
                sections.push(`**Member Definition**\n\`\`\`lpc\n${member.definition}\n\`\`\``);
            }
        }

        if (sections.length > 0) {
            item.documentation = {
                kind: 'markdown',
                value: sections.join('\n\n')
            };
        }

        if (symbol?.type === SymbolType.FUNCTION && symbol.parameters && symbol.parameters.length > 0) {
            item.insertText = this.buildFunctionSnippet(symbol.name, symbol.parameters.map(parameter => parameter.name));
        }

        if ((candidate.metadata.sourceType === 'local' || candidate.metadata.sourceType === 'inherited') && exportedFunction) {
            item.insertText = this.buildFunctionSnippet(
                exportedFunction.name,
                exportedFunction.parameters.map(parameter => parameter.name)
            );
        }
    }

    private getCandidateSortBucket(candidate: CompletionCandidate): string {
        if (candidate.key.startsWith('object-member:shared:')) {
            return '0';
        }

        if (candidate.key.startsWith('object-member:specific:')) {
            return '1';
        }

        return '9';
    }

    private applyKeywordDocumentation(item: LanguageCompletionItem, candidate: CompletionCandidate): void {
        item.documentation = {
            kind: 'markdown',
            value: `\`\`\`lpc\n${candidate.label}\n\`\`\`\n\n${candidate.detail}`
        };

        if (candidate.label === 'new') {
            item.insertText = 'new(${1:struct_type}${2:, ${3:field1}: ${4:value1}})';
        }
    }

    private buildFunctionSnippet(name: string, parameterNames: string[]): string {
        if (parameterNames.length === 0) {
            return `${name}()`;
        }

        const params = parameterNames
            .map((parameterName, index) => `\${${index + 1}:${parameterName}}`)
            .join(', ');
        return `${name}(${params})`;
    }

    private findMemberDefinition(
        memberName: string,
        definitions: TypeDefinitionSummary[]
    ): TypeDefinitionSummary['members'][number] | undefined {
        for (const definition of definitions) {
            const member = definition.members.find(candidate => candidate.name === memberName);
            if (member) {
                return member;
            }
        }

        return undefined;
    }
}
