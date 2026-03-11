import * as vscode from 'vscode';
import { SourceFileContext } from '../antlr/LPCParser';
import { SymbolTable } from '../ast/symbolTable';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { ParsedDocument as ParsedDoc } from '../parser/types';
import { SemanticModelBuilder } from '../semantic/SemanticModelBuilder';
import { SemanticSnapshot, toDocumentSemanticSnapshot } from '../semantic/semanticSnapshot';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { SyntaxDocument } from '../syntax/types';
import {
    DocumentSemanticSnapshot,
    SnapshotStats
} from './types';

export interface DocumentSemanticAnalysis {
    ast: SourceFileContext;
    symbolTable: SymbolTable;
    parseErrors: vscode.Diagnostic[];
    parsed?: ParsedDoc;
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    snapshot: DocumentSemanticSnapshot;
}

export interface CompleteDocumentSemanticAnalysis extends DocumentSemanticAnalysis {
    parsed: ParsedDoc;
    syntax: SyntaxDocument;
    semantic: SemanticSnapshot;
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

    public getSemanticAnalysis(
        document: vscode.TextDocument,
        useCache: boolean = true
    ): CompleteDocumentSemanticAnalysis {
        const analysis = this.getAnalysis(document, useCache);
        if (!analysis.parsed || !analysis.syntax || !analysis.semantic) {
            throw new Error(`Semantic analysis is unavailable for ${document.uri.toString()}`);
        }

        return analysis as CompleteDocumentSemanticAnalysis;
    }

    public getSemanticSnapshot(
        document: vscode.TextDocument,
        useCache: boolean = true
    ): SemanticSnapshot {
        return this.getSemanticAnalysis(document, useCache).semantic;
    }

    public getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot {
        return this.getBestAvailableAnalysis(document).snapshot;
    }

    public getBestAvailableSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot {
        const cached = this.getCachedAnalysis(document);
        if (!cached) {
            return this.getSemanticSnapshot(document, false);
        }

        if (cached.snapshot.version !== document.version) {
            this.scheduleRefresh(document);
        }

        if (cached.semantic) {
            return cached.semantic;
        }

        return this.getSemanticSnapshot(document, false);
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
        let parsed: ParsedDoc | undefined;
        let syntax: SyntaxDocument | undefined;

        try {
            parsed = getGlobalParsedDocumentService().get(document);
            const ast = parsed.tree as SourceFileContext;
            const parseErrors = parsed.diagnostics.slice();
            syntax = new SyntaxBuilder(parsed).build();
            const semantic = new SemanticModelBuilder().build(syntax);
            const snapshot = toDocumentSemanticSnapshot(semantic);

            return {
                ast,
                symbolTable: semantic.symbolTable,
                parseErrors,
                parsed,
                syntax,
                semantic,
                snapshot
            };
        } catch (error) {
            console.error('Failed to build document semantic snapshot:', error);
            return this.createFallbackAnalysis(document, error, parsed, syntax);
        }
    }

    private createFallbackAnalysis(
        document: vscode.TextDocument,
        error: unknown,
        parsed?: ParsedDoc,
        syntax?: SyntaxDocument
    ): DocumentSemanticAnalysis {
        const ast = {} as SourceFileContext;
        const symbolTable = new SymbolTable(document.uri.toString());
        const parseErrors = [
            new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                `Semantic snapshot error: ${error instanceof Error ? error.message : String(error)}`,
                vscode.DiagnosticSeverity.Error
            )
        ];
        const semantic = syntax
            ? {
                uri: document.uri.toString(),
                version: document.version,
                syntax,
                parseDiagnostics: parseErrors,
                exportedFunctions: [],
                localScopes: [],
                typeDefinitions: [],
                inheritStatements: [],
                includeStatements: [],
                macroReferences: [],
                symbolTable,
                createdAt: Date.now()
            }
            : undefined;
        const snapshot: DocumentSemanticSnapshot = {
            uri: document.uri.toString(),
            version: document.version,
            parseDiagnostics: parseErrors,
            exportedFunctions: [],
            localScopes: [],
            typeDefinitions: [],
            inheritStatements: [],
            includeStatements: [],
            macroReferences: [],
            symbolTable,
            createdAt: Date.now()
        };

        return {
            ast,
            symbolTable,
            parseErrors,
            parsed,
            syntax,
            semantic,
            snapshot
        };
    }
}
