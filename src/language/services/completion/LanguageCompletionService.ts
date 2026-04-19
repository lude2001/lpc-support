import * as fs from 'fs';
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

type IndexSnapshot = SemanticSnapshot | ReturnType<DocumentAnalysisService['getSnapshot']>;

interface InheritanceReporter {
    clear(): void;
    show(preserveFocus?: boolean): void;
    appendLine(message: string): void;
}

function createDefaultInheritanceReporter(): InheritanceReporter {
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
    private readonly inheritanceReporter: InheritanceReporter;
    private readonly scopedMethodDiscoveryService: ScopedMethodDiscoveryService;
    private readonly scopedCompletionSupport: ScopedMethodCompletionSupport;

    constructor(
        efunDocsManager: EfunDocsManager,
        macroManager: MacroManager,
        instrumentation?: CompletionInstrumentation,
        objectInferenceService?: ObjectInferenceService,
        inheritanceReporter: InheritanceReporter = createDefaultInheritanceReporter(),
        dependencies?: QueryBackedLanguageCompletionDependencies
    ) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        this.analysisService = assertAnalysisService('QueryBackedLanguageCompletionService', dependencies?.analysisService);
        this.instrumentation = instrumentation ?? new CompletionInstrumentation();
        this.objectInferenceService = objectInferenceService ?? new ObjectInferenceService(macroManager, undefined, this.analysisService);
        this.inheritanceReporter = inheritanceReporter;
        this.scopedMethodDiscoveryService = dependencies?.scopedMethodDiscoveryService
            ?? new ScopedMethodDiscoveryService(macroManager, undefined, this.analysisService);
        this.scopedCompletionSupport = dependencies?.scopedCompletionSupport
            ?? new ScopedMethodCompletionSupport({
                documentationService: dependencies?.documentationService ?? new FunctionDocumentationService(),
                documentLoader: dependencies?.scopedDocumentLoader
                    ?? (async (uri: string) => this.getDocumentForUri(uri))
            });
        this.projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(this.macroManager));
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
            this.warmInheritedIndex(document);

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

            const candidates = await this.resolveCompletionCandidates(document, position, cancellation, result);
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
            this.projectSymbolIndex.updateFromSnapshot(this.getBestAvailableIndexSnapshot(document));
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

    private async resolveCompletionCandidates(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: { isCancellationRequested: boolean },
        result: CompletionQueryResult
    ): Promise<CompletionCandidate[]> {
        const baseCandidates = this.appendInheritedFallbackCandidates(document, result);
        if (result.context.kind === 'scoped-member') {
            const discovery = await this.scopedMethodDiscoveryService.discoverAt(document, position);
            if (token.isCancellationRequested) {
                return [];
            }

            return this.scopedCompletionSupport.buildCandidates(
                discovery,
                document,
                result.context.currentWord
            );
        }

        if (result.context.kind !== 'member') {
            return baseCandidates;
        }

        const inferredAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (!inferredAccess || token.isCancellationRequested) {
            return baseCandidates;
        }

        const inference = inferredAccess.inference;
        if (inference.status === 'unknown' || inference.status === 'unsupported') {
            return baseCandidates;
        }

        const objectCandidates = await this.buildObjectMemberCandidates(document, result, inference, token);
        if (objectCandidates.length === 0) {
            return baseCandidates;
        }

        if (!result.context.currentWord) {
            return this.mergeCandidatesByLabel(objectCandidates, baseCandidates);
        }

        return objectCandidates;
    }

    private mergeCandidatesByLabel(
        preferredCandidates: CompletionCandidate[],
        fallbackCandidates: CompletionCandidate[]
    ): CompletionCandidate[] {
        const merged = new Map<string, CompletionCandidate>();

        for (const candidate of preferredCandidates) {
            merged.set(candidate.label, candidate);
        }

        for (const candidate of fallbackCandidates) {
            if (!merged.has(candidate.label)) {
                merged.set(candidate.label, candidate);
            }
        }

        return Array.from(merged.values());
    }

    private appendInheritedFallbackCandidates(
        document: vscode.TextDocument,
        result: CompletionQueryResult
    ): CompletionCandidate[] {
        if (result.context.kind !== 'identifier' && result.context.kind !== 'type-position') {
            return result.candidates;
        }

        this.refreshInheritedIndex(document);

        const inheritedSymbols = this.projectSymbolIndex.getInheritedSymbols(document.uri.toString());
        if (inheritedSymbols.functions.length === 0 && inheritedSymbols.types.length === 0) {
            return result.candidates;
        }

        const normalizedPrefix = result.context.currentWord.toLowerCase();
        const existingLabels = new Set(result.candidates.map(candidate => candidate.label));
        const merged = [...result.candidates];

        for (const func of inheritedSymbols.functions) {
            if (existingLabels.has(func.name)) {
                continue;
            }
            if (normalizedPrefix && !func.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            existingLabels.add(func.name);
            merged.push({
                key: `inherited-function:${func.sourceUri}:${func.name}`,
                label: func.name,
                kind: vscode.CompletionItemKind.Function,
                detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: func.sourceUri,
                    sourceType: 'inherited',
                    documentationRef: func.name
                }
            });
        }

        for (const typeDefinition of inheritedSymbols.types) {
            if (existingLabels.has(typeDefinition.name)) {
                continue;
            }
            if (normalizedPrefix && !typeDefinition.name.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            existingLabels.add(typeDefinition.name);
            merged.push({
                key: `type:${typeDefinition.sourceUri}:${typeDefinition.name}`,
                label: typeDefinition.name,
                kind: typeDefinition.kind === 'class'
                    ? vscode.CompletionItemKind.Class
                    : vscode.CompletionItemKind.Struct,
                detail: `${typeDefinition.kind} ${typeDefinition.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: typeDefinition.sourceUri,
                    sourceType: 'inherited'
                }
            });
        }

        return merged;
    }

    private async buildObjectMemberCandidates(
        document: vscode.TextDocument,
        result: CompletionQueryResult,
        inference: ObjectInferenceResult,
        token: { isCancellationRequested: boolean }
    ): Promise<CompletionCandidate[]> {
        const currentUri = document.uri.toString();
        const occurrenceCounts = new Map<string, number>();
        const functionsByLabel = new Map<string, FunctionSummary>();

        for (const candidate of inference.candidates) {
            if (token.isCancellationRequested) {
                return [];
            }

            const functions = await this.collectObjectFunctions(document, candidate.path, new Set<string>());
            const visibleFunctions = new Map<string, FunctionSummary>();

            for (const func of functions) {
                if (!visibleFunctions.has(func.name)) {
                    visibleFunctions.set(func.name, func);
                }
            }

            for (const [label, func] of visibleFunctions.entries()) {
                occurrenceCounts.set(label, (occurrenceCounts.get(label) ?? 0) + 1);
                if (!functionsByLabel.has(label)) {
                    functionsByLabel.set(label, func);
                }
            }
        }

        const normalizedPrefix = result.context.currentWord.toLowerCase();
        return Array.from(functionsByLabel.entries())
            .filter(([, func]) => !normalizedPrefix || func.name.toLowerCase().startsWith(normalizedPrefix))
            .sort((left, right) => {
                const leftCount = occurrenceCounts.get(left[0]) ?? 0;
                const rightCount = occurrenceCounts.get(right[0]) ?? 0;
                if (leftCount !== rightCount) {
                    return rightCount - leftCount;
                }

                return left[1].name.localeCompare(right[1].name);
            })
            .map(([label, func]) => {
                const occurrenceCount = occurrenceCounts.get(label) ?? 0;
                const sourceType: CompletionCandidateSourceType = func.sourceUri === currentUri ? 'local' : 'inherited';
                return {
                    key: `object-member:${occurrenceCount > 1 ? 'shared' : 'specific'}:${label}`,
                    label: func.name,
                    kind: vscode.CompletionItemKind.Method,
                    detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                    insertText: this.buildFunctionSnippet(func.name, func.parameters.map(parameter => parameter.name)),
                    sortGroup: 'inherited',
                    metadata: {
                        sourceUri: func.sourceUri,
                        sourceType,
                        documentationRef: func.name
                    }
                };
            });
    }

    private async collectObjectFunctions(
        ownerDocument: vscode.TextDocument,
        filePath: string,
        visited: Set<string>
    ): Promise<FunctionSummary[]> {
        const targetUri = vscode.Uri.file(filePath).toString();
        if (visited.has(targetUri)) {
            return [];
        }

        visited.add(targetUri);

        const targetDocument = targetUri === ownerDocument.uri.toString()
            ? ownerDocument
            : this.getDocumentForUri(targetUri);
        if (!targetDocument) {
            return [];
        }

        let snapshot: SemanticSnapshot;
        try {
            snapshot = this.analysisService.getBestAvailableSemanticSnapshot(targetDocument);
        } catch {
            snapshot = this.analysisService.getSemanticSnapshot(targetDocument, false);
        }

        this.projectSymbolIndex.updateFromSnapshot(snapshot);

        const functions = [...snapshot.exportedFunctions];
        for (const inheritStatement of snapshot.inheritStatements) {
            const inheritTargets = await PathResolver.resolveInheritPath(targetDocument, inheritStatement.value, this.macroManager);
            for (const inheritTarget of inheritTargets) {
                functions.push(...await this.collectObjectFunctions(targetDocument, inheritTarget, visited));
            }
        }

        return functions;
    }

    private warmInheritedIndex(document: vscode.TextDocument): void {
        this.refreshInheritedIndex(document);
    }

    private refreshInheritedIndex(document: vscode.TextDocument): IndexSnapshot {
        const indexSnapshot = this.getBestAvailableIndexSnapshot(document);
        this.projectSymbolIndex.updateFromSnapshot(indexSnapshot);
        this.indexMissingInheritedSnapshots(indexSnapshot.uri, new Set<string>([indexSnapshot.uri]));
        return indexSnapshot;
    }

    private indexMissingInheritedSnapshots(sourceUri: string, visited: Set<string>): void {
        const targets = this.projectSymbolIndex.getResolvedInheritTargets(sourceUri);

        for (const target of targets) {
            if (!target.resolvedUri || visited.has(target.resolvedUri)) {
                continue;
            }

            visited.add(target.resolvedUri);

            if (!this.projectSymbolIndex.getRecord(target.resolvedUri)) {
                const inheritedSnapshot = this.loadSnapshotFromUri(target.resolvedUri);
                if (inheritedSnapshot) {
                    this.projectSymbolIndex.updateFromSnapshot(inheritedSnapshot);
                }
            }

            if (this.projectSymbolIndex.getRecord(target.resolvedUri)) {
                this.indexMissingInheritedSnapshots(target.resolvedUri, visited);
            }
        }
    }

    private loadSnapshotFromUri(uri: string): IndexSnapshot | undefined {
        try {
            const document = this.getDocumentForUri(uri);
            if (!document) {
                return undefined;
            }

            return this.getIndexSnapshot(document, false);
        } catch (error) {
            this.inheritanceReporter.appendLine(`Failed to index inherited file ${uri}: ${error}`);
            return undefined;
        }
    }

    private getOpenDocument(uri: string): vscode.TextDocument | undefined {
        const openDocuments = ((vscode.workspace as typeof vscode.workspace) as typeof vscode.workspace & {
            textDocuments?: vscode.TextDocument[];
        }).textDocuments || [];

        return openDocuments.find(document => document.uri.toString() === uri);
    }

    private normalizeFilePath(filePath: string): string {
        return filePath.replace(/^\/+([A-Za-z]:\/)/, '$1');
    }

    private createReadonlyDocumentFromUri(uri: string): vscode.TextDocument | undefined {
        const filePath = this.normalizeFilePath(vscode.Uri.parse(uri).fsPath);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const version = Math.max(1, Math.trunc(fs.statSync(filePath).mtimeMs));
        return this.createReadonlyDocument(filePath, content, version);
    }

    private createReadonlyDocument(fileName: string, content: string, version: number): vscode.TextDocument {
        const lines = content.split(/\r?\n/);
        const lineStarts = [0];

        for (let index = 0; index < content.length; index += 1) {
            if (content[index] === '\n') {
                lineStarts.push(index + 1);
            }
        }

        const offsetAt = (position: vscode.Position): number => {
            const lineStart = lineStarts[position.line] ?? content.length;
            return Math.min(lineStart + position.character, content.length);
        };

        const positionAt = (offset: number): vscode.Position => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        };

        return {
            uri: vscode.Uri.file(fileName),
            fileName,
            languageId: 'lpc',
            version,
            lineCount: lines.length,
            getText: (range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(offsetAt(range.start), offsetAt(range.end));
            },
            lineAt: (lineOrPosition: number | vscode.Position) => {
                const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
                return { text: lines[line] ?? '' };
            },
            positionAt,
            offsetAt
        } as vscode.TextDocument;
    }

    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        this.inheritanceReporter.clear();
        this.inheritanceReporter.show(true);
        this.inheritanceReporter.appendLine(`正在分析文件: ${document.fileName}`);

        try {
            const snapshot = this.getIndexSnapshot(document, false);
            this.projectSymbolIndex.updateFromSnapshot(snapshot);
            this.indexMissingInheritedSnapshots(snapshot.uri, new Set<string>([snapshot.uri]));

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

    private getDocumentForUri(uri: string): vscode.TextDocument | undefined {
        return this.getOpenDocument(uri) || this.createReadonlyDocumentFromUri(uri);
    }

    private getBestAvailableIndexSnapshot(document: vscode.TextDocument): IndexSnapshot {
        return this.getIndexSnapshot(document, true);
    }

    private getIndexSnapshot(document: vscode.TextDocument, bestAvailable: boolean): IndexSnapshot {
        try {
            return bestAvailable
                ? this.analysisService.getBestAvailableSemanticSnapshot(document)
                : this.analysisService.getSemanticSnapshot(document, false);
        } catch {
            return bestAvailable
                ? this.analysisService.getBestAvailableSnapshot(document)
                : this.analysisService.getSnapshot(document, false);
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
