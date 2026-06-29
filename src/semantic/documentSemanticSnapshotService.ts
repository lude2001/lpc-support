import * as vscode from 'vscode';
import { SymbolTable } from '../ast/symbolTable';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { ParsedDocument as ParsedDoc } from '../parser/types';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { SyntaxDocument } from '../syntax/types';
import {
    CompleteDocumentSemanticAnalysis,
    DocumentAnalysisService,
    DocumentSemanticAnalysis,
    SnapshotAccessMode
} from './documentAnalysisService';
import { DocumentSemanticSnapshot, SnapshotStats } from './documentSemanticTypes';
import { SemanticModelBuilder } from './SemanticModelBuilder';
import { SemanticSnapshot, toDocumentSemanticSnapshot } from './semanticSnapshot';

export class DocumentSemanticSnapshotService implements DocumentAnalysisService {
    private static instance: DocumentSemanticSnapshotService;
    private readonly analyses = new Map<string, DocumentSemanticAnalysis>();
    private readonly refreshTimers = new Map<string, NodeJS.Timeout>();
    private readonly pendingRefreshVersions = new Map<string, number>();
    private readonly refreshCallbacks = new Map<string, Array<(snapshot: DocumentSemanticSnapshot) => void>>();
    private readonly trackedUris = new Set<string>();
    private readonly maxEntries: number;
    private readonly refreshDebounceMs: number;
    private lastUpdatedAt?: number;
    private buildCount = 0;
    private totalBuildTimeMs = 0;
    private readonly buildStatsByUri = new Map<string, { count: number; totalTimeMs: number }>();

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

    public parseDocument(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): DocumentSemanticAnalysis {
        return this.getAnalysis(document, mode);
    }

    public getAnalysis(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): DocumentSemanticAnalysis {
        const useCache = this.shouldUseCache(mode);
        const cached = this.getCachedAnalysis(document);
        if (useCache && cached && this.isAnalysisFresh(cached, document)) {
            return cached;
        }

        if (this.shouldInvalidateParsedDocument(mode) || this.hasSameVersionWithDifferentText(cached, document)) {
            getGlobalParsedDocumentService().invalidate(document.uri);
        }

        return this.buildAndStoreAnalysis(document);
    }

    public getBestAvailableAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis {
        const cached = this.getCachedAnalysis(document);
        if (!cached) {
            return this.buildAndStoreAnalysis(document);
        }

        if (!this.isAnalysisFresh(cached, document)) {
            this.scheduleRefresh(document);
        }

        return cached;
    }

    public getSyntaxDocument(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): SyntaxDocument | undefined {
        return this.getAnalysis(document, mode).syntax;
    }

    public getSnapshot(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): DocumentSemanticSnapshot {
        return this.getAnalysis(document, mode).snapshot;
    }

    public getSemanticAnalysis(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): CompleteDocumentSemanticAnalysis {
        const analysis = this.getAnalysis(document, mode);
        if (!analysis.parsed || !analysis.syntax || !analysis.semantic) {
            throw new Error(`Semantic analysis is unavailable for ${document.uri.toString()}`);
        }

        return analysis as CompleteDocumentSemanticAnalysis;
    }

    public getSemanticSnapshot(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): SemanticSnapshot {
        return this.getSemanticAnalysis(document, mode).semantic;
    }

    public getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot {
        return this.getBestAvailableAnalysis(document).snapshot;
    }

    public getBestAvailableSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot {
        const cached = this.getCachedAnalysis(document);
        if (!cached) {
            return this.getSemanticSnapshot(document, false);
        }

        if (!this.isAnalysisFresh(cached, document)) {
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
        const cached = this.getCachedAnalysis(document);
        return cached ? this.isAnalysisFresh(cached, document) : false;
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

        if (cached && this.isAnalysisFresh(cached, document)) {
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
            if (latest && this.isAnalysisFresh(latest, document)) {
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

    public clearCache(uri: vscode.Uri | string): void {
        const key = typeof uri === 'string' ? vscode.Uri.parse(uri).toString() : uri.toString();
        this.clearScheduledRefresh(key);
        this.pendingRefreshVersions.delete(key);
        this.refreshCallbacks.delete(key);
        this.analyses.delete(key);
        this.trackedUris.delete(key);
    }

    public clearAllCache(): void {
        for (const timer of this.refreshTimers.values()) {
            clearTimeout(timer);
        }

        this.refreshTimers.clear();
        this.pendingRefreshVersions.clear();
        this.refreshCallbacks.clear();
        this.analyses.clear();
        this.trackedUris.clear();
        this.lastUpdatedAt = undefined;
        this.buildCount = 0;
        this.totalBuildTimeMs = 0;
        this.buildStatsByUri.clear();
    }

    public getStats(): SnapshotStats {
        return {
            totalSnapshots: this.trackedUris.size,
            activeDocumentUris: Array.from(this.trackedUris),
            lastUpdatedAt: this.lastUpdatedAt,
            buildCount: this.buildCount,
            totalBuildTimeMs: this.totalBuildTimeMs,
            buildFiles: Array.from(this.buildStatsByUri.entries()).map(([uri, stats]) => ({
                uri,
                count: stats.count,
                totalTimeMs: stats.totalTimeMs
            }))
        };
    }

    public invalidate(uri: vscode.Uri): void {
        this.clearCache(uri);
    }

    public clear(): void {
        this.clearAllCache();
    }

    private getDocumentUri(document: vscode.TextDocument): string {
        return document.uri.toString();
    }

    private getCachedAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis | undefined {
        return this.analyses.get(this.getDocumentUri(document));
    }

    private isAnalysisFresh(analysis: DocumentSemanticAnalysis, document: vscode.TextDocument): boolean {
        return analysis.snapshot.version === document.version
            && !this.hasSameVersionWithDifferentText(analysis, document);
    }

    private hasSameVersionWithDifferentText(
        analysis: DocumentSemanticAnalysis | undefined,
        document: vscode.TextDocument
    ): boolean {
        return Boolean(
            analysis?.parsed
            && analysis.snapshot.version === document.version
            && analysis.parsed.text !== document.getText()
        );
    }

    private shouldUseCache(mode: boolean | SnapshotAccessMode): boolean {
        if (typeof mode === 'boolean') {
            return mode;
        }

        return mode !== 'forceRefresh';
    }

    private shouldInvalidateParsedDocument(mode: boolean | SnapshotAccessMode): boolean {
        if (typeof mode === 'boolean') {
            return !mode;
        }

        return mode === 'forceRefresh';
    }

    private buildAndStoreAnalysis(document: vscode.TextDocument): DocumentSemanticAnalysis {
        const startedAt = performance.now();
        const analysis = this.storeAnalysis(document, this.createAnalysis(document));
        const elapsedMs = performance.now() - startedAt;
        this.buildCount += 1;
        this.totalBuildTimeMs += elapsedMs;
        this.recordBuild(document.uri.toString(), elapsedMs);
        return analysis;
    }

    private recordBuild(uri: string, elapsedMs: number): void {
        const stats = this.buildStatsByUri.get(uri) ?? { count: 0, totalTimeMs: 0 };
        stats.count += 1;
        stats.totalTimeMs += elapsedMs;
        this.buildStatsByUri.set(uri, stats);
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
            this.clearCache(vscode.Uri.parse(uri));
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
            if (parsed.degraded) {
                return this.createFallbackAnalysis(
                    document,
                    new Error(parsed.failureReason ?? 'Parsed document is degraded.'),
                    parsed,
                    syntax
                );
            }

            const parseErrors = parsed.diagnostics.slice();
            syntax = new SyntaxBuilder(parsed).build();
            const semantic = new SemanticModelBuilder().build(syntax);
            const snapshot = toDocumentSemanticSnapshot(semantic);

            return {
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
        const symbolTable = new SymbolTable(document.uri.toString());
        const failureReason = error instanceof Error ? error.message : String(error);
        const parseErrors = parsed?.diagnostics.length
            ? parsed.diagnostics.slice()
            : [
                new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 1),
                    `Semantic snapshot error: ${failureReason}`,
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
                symbols: [],
                localScopes: [],
                typeDefinitions: [],
                fileGlobals: [],
                inheritStatements: [],
                includeStatements: [],
                macroReferences: [],
                symbolTable,
                degraded: true,
                failureReason,
                createdAt: Date.now()
            }
            : undefined;
        const snapshot: DocumentSemanticSnapshot = {
            uri: document.uri.toString(),
            version: document.version,
            parseDiagnostics: parseErrors,
            exportedFunctions: [],
            symbols: [],
            localScopes: [],
            typeDefinitions: [],
            fileGlobals: [],
            inheritStatements: [],
            includeStatements: [],
            macroReferences: [],
            symbolTable,
            degraded: true,
            failureReason,
            createdAt: Date.now()
        };

        return {
            symbolTable,
            parseErrors,
            parsed,
            syntax,
            semantic,
            snapshot
        };
    }
}
