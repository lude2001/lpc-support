import * as path from 'path';
import * as vscode from 'vscode';
import { Symbol, SymbolType } from '../ast/symbolTable';
import { getTypeLookupName, normalizeLpcType } from '../ast/typeNormalization';
import { MacroManager } from '../macroManager';
import { ProjectSymbolIndex } from './projectSymbolIndex';
import {
    CompletionCandidate,
    CompletionContextKind,
    CompletionQueryContext,
    CompletionQueryResult,
    DocumentSemanticSnapshot,
    FileGlobalSummary,
    FunctionSummary,
    TypeDefinitionSummary
} from './types';
import { CompletionContextAnalyzer } from './completionContextAnalyzer';
import { CompletionRequestTrace } from './completionInstrumentation';

type SnapshotProvider = {
    getSnapshot(document: vscode.TextDocument, useCache?: boolean): DocumentSemanticSnapshot;
    getBestAvailableSnapshot?(document: vscode.TextDocument): DocumentSemanticSnapshot;
    hasSnapshot?(document: vscode.TextDocument): boolean;
    hasFreshSnapshot?(document: vscode.TextDocument): boolean;
};
type EfunProvider = {
    getAllFunctions(): string[];
    getAllSimulatedFunctions(): string[];
};

export interface CompletionQueryEngineOptions {
    snapshotProvider: SnapshotProvider;
    projectSymbolIndex: ProjectSymbolIndex;
    contextAnalyzer?: CompletionContextAnalyzer;
    macroManager?: Pick<MacroManager, 'getAllMacros'>;
    efunProvider?: EfunProvider;
    builtinTypes?: string[];
    keywords?: string[];
}

const DEFAULT_BUILTIN_TYPES = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer', 'struct', 'class'];
const DEFAULT_KEYWORDS = ['inherit', 'include', 'if', 'else', 'for', 'while', 'foreach', 'switch', 'return', 'new', 'catch'];
const PREPROCESSOR_KEYWORDS = ['include', 'define', 'ifdef', 'ifndef', 'endif'];
const COMMON_OBJECT_METHODS = [
    { name: 'query', snippet: 'query(${1:prop})', detail: '?????' },
    { name: 'set', snippet: 'set(${1:prop}, ${2:value})', detail: '?????' },
    { name: 'add', snippet: 'add(${1:prop}, ${2:value})', detail: '?????' },
    { name: 'delete', snippet: 'delete(${1:prop})', detail: '????' }
];

export class CompletionQueryEngine {
    private readonly snapshotProvider: SnapshotProvider;
    private readonly projectSymbolIndex: ProjectSymbolIndex;
    private readonly contextAnalyzer: CompletionContextAnalyzer;
    private readonly macroManager?: Pick<MacroManager, 'getAllMacros'>;
    private readonly efunProvider?: EfunProvider;
    private readonly builtinTypes: string[];
    private readonly keywords: string[];

    constructor(options: CompletionQueryEngineOptions) {
        this.snapshotProvider = options.snapshotProvider;
        this.projectSymbolIndex = options.projectSymbolIndex;
        this.contextAnalyzer = options.contextAnalyzer || new CompletionContextAnalyzer();
        this.macroManager = options.macroManager;
        this.efunProvider = options.efunProvider;
        this.builtinTypes = options.builtinTypes || DEFAULT_BUILTIN_TYPES;
        this.keywords = options.keywords || DEFAULT_KEYWORDS;
    }

    public query(
        document: vscode.TextDocument,
        position: vscode.Position,
        _context: vscode.CompletionContext,
        token: vscode.CancellationToken,
        trace?: CompletionRequestTrace
    ): CompletionQueryResult {
        const analyzedContext = trace
            ? trace.measure('context-analysis', () => this.contextAnalyzer.analyze(document, position))
            : this.contextAnalyzer.analyze(document, position);
        if (token.isCancellationRequested) {
            return this.emptyResult(analyzedContext);
        }
        const snapshotCacheHit = this.snapshotProvider.hasSnapshot?.(document) ?? false;
        const snapshot = trace
            ? trace.measure(
                'snapshot-load',
                () => this.snapshotProvider.getBestAvailableSnapshot?.(document) ?? this.snapshotProvider.getSnapshot(document),
                { cacheHit: snapshotCacheHit }
            )
            : this.snapshotProvider.getBestAvailableSnapshot?.(document) ?? this.snapshotProvider.getSnapshot(document);

        const indexCacheHit = this.projectSymbolIndex.getRecord(snapshot.uri)?.version === snapshot.version;
        const inheritedSymbols = trace
            ? trace.measure('project-index-query', () => {
                this.projectSymbolIndex.updateFromSnapshot(snapshot);
                return this.projectSymbolIndex.getInheritedSymbols(snapshot.uri);
            }, { cacheHit: indexCacheHit })
            : (() => {
                this.projectSymbolIndex.updateFromSnapshot(snapshot);
                return this.projectSymbolIndex.getInheritedSymbols(snapshot.uri);
            })();

        if (token.isCancellationRequested) {
            return this.emptyResult(analyzedContext);
        }

        const candidates = trace
            ? trace.measure('candidate-build', () => {
                const rawCandidates = this.buildCandidates(snapshot, position, analyzedContext, inheritedSymbols.functions, inheritedSymbols.types);
                const filteredCandidates = this.filterAndSortCandidates(rawCandidates, analyzedContext.currentWord);
                trace.recordStage('candidate-build', 0, { candidateCount: filteredCandidates.length });
                return filteredCandidates;
            })
            : this.filterAndSortCandidates(
                this.buildCandidates(snapshot, position, analyzedContext, inheritedSymbols.functions, inheritedSymbols.types),
                analyzedContext.currentWord
            );

        return {
            context: analyzedContext,
            candidates,
            isIncomplete: false
        };
    }

    private buildCandidates(
        snapshot: DocumentSemanticSnapshot,
        position: vscode.Position,
        context: CompletionQueryContext,
        inheritedFunctions: FunctionSummary[],
        inheritedTypes: TypeDefinitionSummary[]
    ): CompletionCandidate[] {
        const includedSymbols = this.projectSymbolIndex.getIncludedSymbols(snapshot.uri);
        switch (context.kind) {
            case 'member':
                return this.queryMemberCandidates(snapshot, position, context, [...includedSymbols.types, ...inheritedTypes]);
            case 'preprocessor':
                return this.queryPreprocessorCandidates(snapshot);
            case 'inherit-path':
                return this.queryPathCandidates(snapshot, 'inherit-path');
            case 'include-path':
                return this.queryPathCandidates(snapshot, 'include-path');
            case 'type-position':
                return this.queryTypeCandidates(snapshot, [...includedSymbols.types, ...inheritedTypes]);
            case 'identifier':
            default:
                return this.queryIdentifierCandidates(
                    snapshot,
                    position,
                    includedSymbols.functions,
                    includedSymbols.fileGlobals,
                    inheritedFunctions,
                    [...includedSymbols.types, ...inheritedTypes]
                );
        }
    }
    private queryIdentifierCandidates(
        snapshot: DocumentSemanticSnapshot,
        position: vscode.Position,
        includedFunctions: FunctionSummary[],
        includedGlobals: FileGlobalSummary[],
        inheritedFunctions: FunctionSummary[],
        inheritedTypes: TypeDefinitionSummary[]
    ): CompletionCandidate[] {
        const candidates: CompletionCandidate[] = [];
        const symbols = snapshot.symbolTable.getSymbolsInScope(position);

        for (const symbol of symbols) {
            candidates.push(this.createSymbolCandidate(symbol));
        }

        for (const func of includedFunctions) {
            candidates.push({
                key: `include-function:${func.sourceUri}:${func.name}`,
                label: func.name,
                kind: vscode.CompletionItemKind.Function,
                detail: `${normalizeLpcType(func.returnType)} ${func.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: func.sourceUri,
                    sourceType: 'include',
                    documentationRef: func.name
                }
            });
        }

        for (const global of includedGlobals) {
            candidates.push({
                key: `include-global:${global.sourceUri}:${global.name}`,
                label: global.name,
                kind: vscode.CompletionItemKind.Variable,
                detail: `${normalizeLpcType(global.dataType)} ${global.name}`,
                sortGroup: 'inherited',
                metadata: {
                    sourceUri: global.sourceUri,
                    sourceType: 'include',
                    documentationRef: global.name
                }
            });
        }

        for (const func of inheritedFunctions) {
            candidates.push({
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

        for (const typeDefinition of [...snapshot.typeDefinitions, ...inheritedTypes]) {
            candidates.push({
                key: `type:${typeDefinition.sourceUri}:${typeDefinition.name}`,
                label: typeDefinition.name,
                kind: typeDefinition.kind === 'class'
                    ? vscode.CompletionItemKind.Class
                    : vscode.CompletionItemKind.Struct,
                detail: `${typeDefinition.kind} ${typeDefinition.name}`,
                sortGroup: 'scope',
                metadata: {
                    sourceUri: typeDefinition.sourceUri,
                    sourceType: typeDefinition.sourceUri === snapshot.uri ? 'local' : 'inherited'
                }
            });
        }

        for (const typeName of this.builtinTypes) {
            candidates.push({
                key: `builtin-type:${typeName}`,
                label: typeName,
                kind: vscode.CompletionItemKind.TypeParameter,
                detail: `LPC 类型: ${typeName}`,
                sortGroup: 'builtin',
                metadata: {
                    sourceType: 'keyword'
                }
            });
        }

        for (const keyword of this.keywords) {
            candidates.push({
                key: `keyword:${keyword}`,
                label: keyword,
                kind: vscode.CompletionItemKind.Keyword,
                detail: `LPC 关键字: ${keyword}`,
                sortGroup: 'keyword',
                metadata: {
                    sourceType: 'keyword'
                }
            });
        }

        for (const efun of this.efunProvider?.getAllFunctions() || []) {
            candidates.push({
                key: `efun:${efun}`,
                label: efun,
                kind: vscode.CompletionItemKind.Function,
                detail: `LPC Efun: ${efun}`,
                insertText: `${efun}($1)`,
                sortGroup: 'builtin',
                metadata: {
                    sourceType: 'efun',
                    documentationRef: efun
                }
            });
        }

        for (const efun of this.efunProvider?.getAllSimulatedFunctions() || []) {
            candidates.push({
                key: `simul-efun:${efun}`,
                label: efun,
                kind: vscode.CompletionItemKind.Function,
                detail: `模拟函数库: ${efun}`,
                insertText: `${efun}($1)`,
                sortGroup: 'builtin',
                metadata: {
                    sourceType: 'simul-efun',
                    documentationRef: efun
                }
            });
        }

        return candidates;
    }

    private queryMemberCandidates(
        snapshot: DocumentSemanticSnapshot,
        position: vscode.Position,
        context: CompletionQueryContext,
        inheritedTypes: TypeDefinitionSummary[]
    ): CompletionCandidate[] {
        const candidates: CompletionCandidate[] = [];
        const receiverType = context.receiverChain.length > 0
            ? this.resolveReceiverType(snapshot, position, context.receiverChain, inheritedTypes)
            : undefined;
        const definition = receiverType
            ? this.findTypeDefinition(receiverType, snapshot.typeDefinitions, inheritedTypes)
            : undefined;

        if (definition) {
            candidates.push(...definition.members.map((member): CompletionCandidate => ({
                key: `member:${definition.sourceUri}:${definition.name}:${member.name}`,
                label: member.name,
                kind: member.parameters && member.parameters.length > 0
                    ? vscode.CompletionItemKind.Method
                    : vscode.CompletionItemKind.Field,
                detail: `${normalizeLpcType(member.dataType)} ${member.name}`,
                sortGroup: 'type-member',
                metadata: {
                    sourceUri: definition.sourceUri,
                    sourceType: 'struct-member',
                    documentationRef: member.definition,
                    scope: snapshot.symbolTable.getCurrentScope()
                }
            })));
        }

        if (this.shouldIncludeObjectMethods(context, receiverType)) {
            candidates.push(...this.createObjectMethodCandidates());
        }

        return candidates;
    }

    private queryPreprocessorCandidates(snapshot: DocumentSemanticSnapshot): CompletionCandidate[] {
        const candidates: CompletionCandidate[] = PREPROCESSOR_KEYWORDS.map(keyword => ({
            key: `preprocessor:${keyword}`,
            label: keyword,
            kind: vscode.CompletionItemKind.Keyword,
            detail: `预处理指令: ${keyword}`,
            sortGroup: 'keyword',
            metadata: {
                sourceType: 'keyword'
            }
        }));

        candidates.push(...this.createSnapshotMacroCandidates(snapshot, 'macro'));

        for (const macro of this.macroManager?.getAllMacros() || []) {
            candidates.push({
                key: `macro:${macro.name}`,
                label: macro.name,
                kind: vscode.CompletionItemKind.Constant,
                detail: macro.value,
                sortGroup: 'keyword',
                metadata: {
                    sourceType: 'macro',
                    documentationRef: macro.name
                }
            });
        }

        return candidates;
    }

    private queryPathCandidates(snapshot: DocumentSemanticSnapshot, kind: CompletionContextKind): CompletionCandidate[] {
        const candidates: CompletionCandidate[] = [
            ...this.createSnapshotMacroCandidates(snapshot, `${kind}:macro`)
        ];

        for (const macro of this.macroManager?.getAllMacros() || []) {
            candidates.push({
                key: `${kind}:macro:${macro.name}`,
                label: macro.name,
                kind: vscode.CompletionItemKind.Constant,
                detail: macro.value,
                sortGroup: 'keyword',
                metadata: {
                    sourceType: 'macro',
                    documentationRef: macro.name
                }
            });
        }

        const recordPaths = new Set<string>();
        for (const record of this.projectSymbolIndex.getAllRecords()) {
            const filePath = vscode.Uri.parse(record.uri).fsPath;
            const normalizedPath = filePath.replace(/\\/g, '/').replace(/\.c$/i, '');
            recordPaths.add(normalizedPath);
            recordPaths.add(path.basename(normalizedPath));
        }

        for (const pathLabel of recordPaths) {
            candidates.push({
                key: `${kind}:path:${pathLabel}`,
                label: pathLabel,
                kind: vscode.CompletionItemKind.File,
                detail: kind === 'inherit-path' ? '继承路径' : '包含路径',
                sortGroup: 'keyword',
                metadata: {
                    sourceType: 'keyword'
                }
            });
        }

        return candidates;
    }

    private createSnapshotMacroCandidates(
        snapshot: DocumentSemanticSnapshot,
        keyPrefix: string
    ): CompletionCandidate[] {
        return (snapshot.macroDefinitions || []).map((macro) => ({
            key: `${keyPrefix}:${macro.name}`,
            label: macro.name,
            kind: vscode.CompletionItemKind.Constant,
            detail: macro.value,
            sortGroup: 'keyword',
            metadata: {
                sourceUri: macro.sourceUri,
                sourceType: 'macro',
                documentationRef: macro.name
            }
        }));
    }

    private queryTypeCandidates(
        snapshot: DocumentSemanticSnapshot,
        inheritedTypes: TypeDefinitionSummary[]
    ): CompletionCandidate[] {
        const candidates: CompletionCandidate[] = [];

        for (const typeName of this.builtinTypes) {
            candidates.push({
                key: `type-position:builtin:${typeName}`,
                label: typeName,
                kind: vscode.CompletionItemKind.TypeParameter,
                detail: `LPC 类型: ${typeName}`,
                sortGroup: 'builtin',
                metadata: {
                    sourceType: 'keyword'
                }
            });
        }

        for (const typeDefinition of [...snapshot.typeDefinitions, ...inheritedTypes]) {
            candidates.push({
                key: `type-position:${typeDefinition.sourceUri}:${typeDefinition.name}`,
                label: typeDefinition.kind === 'class'
                    ? `class ${typeDefinition.name}`
                    : typeDefinition.name,
                kind: typeDefinition.kind === 'class'
                    ? vscode.CompletionItemKind.Class
                    : vscode.CompletionItemKind.Struct,
                detail: `${typeDefinition.kind} ${typeDefinition.name}`,
                sortGroup: 'scope',
                metadata: {
                    sourceUri: typeDefinition.sourceUri,
                    sourceType: typeDefinition.sourceUri === snapshot.uri ? 'local' : 'inherited'
                }
            });
        }

        return candidates;
    }

    private createSymbolCandidate(symbol: Symbol): CompletionCandidate {
        const sourceType = symbol.type === SymbolType.FUNCTION ? 'local' : 'local';

        return {
            key: `symbol:${symbol.scope.name}:${symbol.name}`,
            label: symbol.name,
            kind: this.toCompletionKind(symbol.type),
            detail: symbol.type === SymbolType.FUNCTION
                ? `${normalizeLpcType(symbol.dataType)} ${symbol.name}`
                : `${normalizeLpcType(symbol.dataType)} ${symbol.name}`,
            sortGroup: 'scope',
            metadata: {
                sourceType,
                symbol,
                scope: symbol.scope,
                documentationRef: symbol.definition
            }
        };
    }

    private resolveReceiverType(
        snapshot: DocumentSemanticSnapshot,
        position: vscode.Position,
        receiverChain: string[],
        inheritedTypes: TypeDefinitionSummary[]
    ): string | undefined {
        if (receiverChain.length === 0) {
            return undefined;
        }

        const rootSymbol = snapshot.symbolTable.findSymbol(receiverChain[0], position);
        if (!rootSymbol) {
            return undefined;
        }

        let currentType = getTypeLookupName(rootSymbol.dataType);
        for (const segment of receiverChain.slice(1)) {
            const definition = this.findTypeDefinition(currentType, snapshot.typeDefinitions, inheritedTypes);
            const member = definition?.members.find(candidate => candidate.name === segment);
            if (!member) {
                return undefined;
            }

            currentType = getTypeLookupName(member.dataType);
        }

        return currentType;
    }

    private findTypeDefinition(
        typeName: string,
        localTypes: TypeDefinitionSummary[],
        inheritedTypes: TypeDefinitionSummary[]
    ): TypeDefinitionSummary | undefined {
        return localTypes.find(type => type.name === typeName)
            || inheritedTypes.find(type => type.name === typeName)
            || this.projectSymbolIndex.findType(typeName);
    }

    private shouldIncludeObjectMethods(
        context: CompletionQueryContext,
        receiverType?: string
    ): boolean {
        if (receiverType && getTypeLookupName(receiverType) === 'object') {
            return true;
        }

        if (!context.receiverExpression) {
            return false;
        }

        const normalizedExpression = context.receiverExpression.replace(/\s+/g, '');
        return normalizedExpression === 'this_object()'
            || normalizedExpression === 'previous_object()'
            || /\)$/.test(normalizedExpression)
            || /\[[^\]]+\]$/.test(normalizedExpression);
    }

    private createObjectMethodCandidates(): CompletionCandidate[] {
        return COMMON_OBJECT_METHODS.map(method => ({
            key: `object-method:${method.name}`,
            label: method.name,
            kind: vscode.CompletionItemKind.Method,
            detail: method.detail,
            insertText: method.snippet,
            sortGroup: 'builtin',
            metadata: {
                sourceType: 'keyword'
            }
        }));
    }

    private filterAndSortCandidates(candidates: CompletionCandidate[], currentWord: string): CompletionCandidate[] {
        const deduped = new Map<string, CompletionCandidate>();
        const normalizedPrefix = currentWord.toLowerCase();

        for (const candidate of candidates) {
            if (normalizedPrefix && !candidate.label.toLowerCase().startsWith(normalizedPrefix)) {
                continue;
            }

            if (!deduped.has(candidate.key)) {
                deduped.set(candidate.key, candidate);
            }
        }

        return Array.from(deduped.values()).sort((left, right) => {
            const sortGroupOrder = this.getSortGroupOrder(left.sortGroup) - this.getSortGroupOrder(right.sortGroup);
            if (sortGroupOrder !== 0) {
                return sortGroupOrder;
            }

            return left.label.localeCompare(right.label);
        });
    }

    private getSortGroupOrder(group: CompletionCandidate['sortGroup']): number {
        switch (group) {
            case 'scope': return 0;
            case 'type-member': return 1;
            case 'inherited': return 2;
            case 'builtin': return 3;
            case 'keyword': return 4;
            default: return 9;
        }
    }

    private toCompletionKind(symbolType: SymbolType): vscode.CompletionItemKind {
        switch (symbolType) {
            case SymbolType.FUNCTION: return vscode.CompletionItemKind.Function;
            case SymbolType.VARIABLE: return vscode.CompletionItemKind.Variable;
            case SymbolType.PARAMETER: return vscode.CompletionItemKind.Variable;
            case SymbolType.STRUCT: return vscode.CompletionItemKind.Struct;
            case SymbolType.CLASS: return vscode.CompletionItemKind.Class;
            case SymbolType.MEMBER: return vscode.CompletionItemKind.Field;
            case SymbolType.INHERIT: return vscode.CompletionItemKind.Module;
            default: return vscode.CompletionItemKind.Text;
        }
    }

    private emptyResult(context: CompletionQueryContext): CompletionQueryResult {
        return {
            context,
            candidates: [],
            isIncomplete: false
        };
    }
}
