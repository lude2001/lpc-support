import * as vscode from 'vscode';
import { SourceFileContext } from '../antlr/LPCParser';
import { CompletionVisitor } from '../ast/completionVisitor';
import { Symbol, SymbolTable, SymbolType } from '../ast/symbolTable';
import { getParsed, ParsedDoc } from '../parseCache';
import {
    DocumentSemanticSnapshot,
    FunctionSummary,
    ScopeSummary,
    SnapshotStats,
    TypeDefinitionSummary
} from './types';

export interface DocumentSemanticAnalysis {
    ast: SourceFileContext;
    symbolTable: SymbolTable;
    visitor: CompletionVisitor;
    parseErrors: vscode.Diagnostic[];
    parsed?: ParsedDoc;
    snapshot: DocumentSemanticSnapshot;
}

export class DocumentSemanticSnapshotService {
    private static instance: DocumentSemanticSnapshotService;
    private readonly analyses = new Map<string, DocumentSemanticAnalysis>();
    private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
    private readonly pendingRefreshVersions = new Map<string, number>();
    private readonly refreshCallbacks = new Map<string, Array<(snapshot: DocumentSemanticSnapshot) => void>>();
    private readonly trackedUris = new Set<string>();
    private readonly maxEntries: number;
    private readonly refreshDebounceMs: number;
    private lastUpdatedAt?: number;

    private constructor() {
        const config = vscode.workspace.getConfiguration('lpc.performance');
        this.maxEntries = config.get<number>('maxCacheSize', 50);
        this.refreshDebounceMs = config.get<number>('debounceDelay', 300);
    }

    public static getInstance(): DocumentSemanticSnapshotService {
        if (!DocumentSemanticSnapshotService.instance) {
            DocumentSemanticSnapshotService.instance = new DocumentSemanticSnapshotService();
        }

        return DocumentSemanticSnapshotService.instance;
    }

    private getDocumentUri(document: vscode.TextDocument): string {
        return document.uri.toString();
    }

    private getCachedAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis | undefined {
        return this.analyses.get(this.getDocumentUri(document));
    }

    private buildAndStoreAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis {
        return this.storeAnalysis(document, this.createAnalysis(document));
    }

    public getAnalysis(
        document: vscode.TextDocument,
        useCache: boolean = true
    ): DocumentSemanticAnalysis {
        const cached = this.getCachedAnalysis(document);
        if (useCache && cached && cached.snapshot.version === document.version) {
            return cached;
        }

        return this.buildAndStoreAnalysis(document);
    }

    public getBestAvailableAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis {
        const cached = this.getCachedAnalysis(document);
        if (!cached) {
            return this.buildAndStoreAnalysis(document);
        }

        if (cached.snapshot.version !== document.version) {
            this.scheduleRefresh(document);
        }

        return cached;
    }

    public getSnapshot(
        document: vscode.TextDocument,
        useCache: boolean = true
    ): DocumentSemanticSnapshot {
        return this.getAnalysis(document, useCache).snapshot;
    }

    public getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot {
        return this.getBestAvailableAnalysis(document).snapshot;
    }

    public hasSnapshot(document: vscode.TextDocument): boolean {
        return this.analyses.has(this.getDocumentUri(document));
    }

    public hasFreshSnapshot(document: vscode.TextDocument): boolean {
        return this.getCachedAnalysis(document)?.snapshot.version === document.version;
    }

    public scheduleRefresh(
        document: vscode.TextDocument,
        onReady?: (snapshot: DocumentSemanticSnapshot) => void
    ): void {
        const uri = document.uri.toString();
        const cached = this.analyses.get(uri);

        if (onReady) {
            const callbacks = this.refreshCallbacks.get(uri) || [];
            callbacks.push(onReady);
            this.refreshCallbacks.set(uri, callbacks);
        }

        if (cached && cached.snapshot.version === document.version) {
            this.flushRefreshCallbacks(uri, cached.snapshot);
            return;
        }

        const pendingVersion = this.pendingRefreshVersions.get(uri);
        if (pendingVersion !== undefined && pendingVersion >= document.version) {
            return;
        }

        this.clearScheduledRefresh(uri);
        this.pendingRefreshVersions.set(uri, document.version);

        const timer = setTimeout(() => {
            this.refreshTimers.delete(uri);
            this.pendingRefreshVersions.delete(uri);

            const latest = this.analyses.get(uri);
            if (latest && latest.snapshot.version >= document.version) {
                this.flushRefreshCallbacks(uri, latest.snapshot);
                return;
            }

            try {
                const analysis = this.buildAndStoreAnalysis(document);
                this.flushRefreshCallbacks(uri, analysis.snapshot);
            } catch (error) {
                console.error('Failed to refresh document semantic snapshot:', error);
                this.refreshCallbacks.delete(uri);
            }
        }, this.refreshDebounceMs);

        this.refreshTimers.set(uri, timer);
    }

    public invalidate(uri: vscode.Uri): void {
        const key = uri.toString();
        this.clearScheduledRefresh(key);
        this.pendingRefreshVersions.delete(key);
        this.refreshCallbacks.delete(key);
        this.analyses.delete(key);
        this.trackedUris.delete(key);
    }

    public clear(): void {
        for (const timer of this.refreshTimers.values()) {
            clearTimeout(timer);
        }

        this.refreshTimers.clear();
        this.pendingRefreshVersions.clear();
        this.refreshCallbacks.clear();
        this.analyses.clear();
        this.trackedUris.clear();
        this.lastUpdatedAt = undefined;
    }

    public getStats(): SnapshotStats {
        return {
            totalSnapshots: this.trackedUris.size,
            activeDocumentUris: Array.from(this.trackedUris),
            lastUpdatedAt: this.lastUpdatedAt
        };
    }

    private storeAnalysis(
        document: vscode.TextDocument,
        analysis: DocumentSemanticAnalysis
    ): DocumentSemanticAnalysis {
        const uri = document.uri.toString();
        this.analyses.set(uri, analysis);
        this.trackedUris.add(uri);
        this.lastUpdatedAt = analysis.snapshot.createdAt;
        this.pruneCache();
        return analysis;
    }

    private pruneCache(): void {
        if (this.analyses.size <= this.maxEntries) {
            return;
        }

        const entries = Array.from(this.analyses.entries())
            .sort((left, right) => left[1].snapshot.createdAt - right[1].snapshot.createdAt);

        while (this.analyses.size > this.maxEntries && entries.length > 0) {
            const [uri] = entries.shift()!;
            this.invalidate(vscode.Uri.parse(uri));
        }
    }

    private clearScheduledRefresh(uri: string): void {
        const timer = this.refreshTimers.get(uri);
        if (timer) {
            clearTimeout(timer);
            this.refreshTimers.delete(uri);
        }
    }

    private flushRefreshCallbacks(uri: string, snapshot: DocumentSemanticSnapshot): void {
        const callbacks = this.refreshCallbacks.get(uri);
        if (!callbacks || callbacks.length === 0) {
            return;
        }

        this.refreshCallbacks.delete(uri);
        for (const callback of callbacks) {
            callback(snapshot);
        }
    }

    private createAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis {
        try {
            const parsed = getParsed(document);
            const ast = parsed.tree as SourceFileContext;
            const symbolTable = new SymbolTable(document.uri.toString());
            const visitor = new CompletionVisitor(symbolTable, document);
            visitor.visit(ast);
            const parseErrors = parsed.diagnostics.slice();

            return {
                ast,
                symbolTable,
                visitor,
                parseErrors,
                parsed,
                snapshot: this.buildSnapshot(document, symbolTable, visitor, parseErrors)
            };
        } catch (error) {
            console.error('Failed to build document semantic snapshot:', error);

            const symbolTable = new SymbolTable(document.uri.toString());
            const visitor = new CompletionVisitor(symbolTable, document);
            const parseErrors: vscode.Diagnostic[] = [];
            const emptyAst = {} as SourceFileContext;

            return {
                ast: emptyAst,
                symbolTable,
                visitor,
                parseErrors,
                snapshot: this.buildSnapshot(document, symbolTable, visitor, parseErrors)
            };
        }
    }

    private buildSnapshot(
        document: vscode.TextDocument,
        symbolTable: SymbolTable,
        visitor: CompletionVisitor,
        parseErrors: vscode.Diagnostic[]
    ): DocumentSemanticSnapshot {
        return {
            uri: document.uri.toString(),
            version: document.version,
            parseDiagnostics: parseErrors,
            exportedFunctions: symbolTable
                .getSymbolsByType(SymbolType.FUNCTION)
                .map(symbol => this.toFunctionSummary(document.uri.toString(), symbol)),
            localScopes: this.collectScopeSummaries(symbolTable.getGlobalScope()),
            typeDefinitions: this.collectTypeDefinitions(document.uri.toString(), symbolTable),
            inheritStatements: visitor.getInheritStatements(),
            includeStatements: visitor.getIncludeStatements(),
            macroReferences: [],
            symbolTable,
            createdAt: Date.now()
        };
    }

    private collectScopeSummaries(rootScope: import('../ast/symbolTable').Scope): ScopeSummary[] {
        const summaries: ScopeSummary[] = [];
        const queue = [rootScope];

        while (queue.length > 0) {
            const currentScope = queue.shift()!;
            summaries.push({
                name: currentScope.name,
                range: currentScope.range,
                symbolNames: Array.from(currentScope.symbols.keys()),
                childScopes: currentScope.children.map(child => child.name),
                parentScopeName: currentScope.parent?.name
            });

            queue.push(...currentScope.children);
        }

        return summaries;
    }

    private collectTypeDefinitions(documentUri: string, symbolTable: SymbolTable): TypeDefinitionSummary[] {
        const structDefinitions = symbolTable
            .getSymbolsByType(SymbolType.STRUCT)
            .map(symbol => this.toTypeDefinitionSummary(documentUri, symbol, 'struct'));
        const classDefinitions = symbolTable
            .getSymbolsByType(SymbolType.CLASS)
            .map(symbol => this.toTypeDefinitionSummary(documentUri, symbol, 'class'));

        return [...structDefinitions, ...classDefinitions];
    }

    private toFunctionSummary(documentUri: string, symbol: Symbol): FunctionSummary {
        return {
            name: symbol.name,
            returnType: symbol.dataType,
            parameters: (symbol.parameters || []).map(parameter => ({
                name: parameter.name,
                dataType: parameter.dataType,
                range: parameter.range,
                documentation: parameter.documentation
            })),
            modifiers: symbol.modifiers || [],
            sourceUri: documentUri,
            range: symbol.range,
            origin: 'local',
            documentation: symbol.documentation,
            definition: symbol.definition
        };
    }

    private toTypeDefinitionSummary(
        documentUri: string,
        symbol: Symbol,
        kind: TypeDefinitionSummary['kind']
    ): TypeDefinitionSummary {
        return {
            name: symbol.name,
            kind,
            members: (symbol.members || []).map(member => ({
                name: member.name,
                dataType: member.dataType,
                range: member.range,
                documentation: member.documentation,
                definition: member.definition,
                parameters: member.parameters?.map(parameter => ({
                    name: parameter.name,
                    dataType: parameter.dataType,
                    range: parameter.range,
                    documentation: parameter.documentation
                })),
                sourceScopeName: member.scope?.name
            })),
            sourceUri: documentUri,
            range: symbol.range,
            definition: symbol.definition
        };
    }
}
