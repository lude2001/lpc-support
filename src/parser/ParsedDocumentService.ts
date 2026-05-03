import { CharStreams, CommonTokenStream } from 'antlr4ts';
import * as vscode from 'vscode';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';
import { DocumentCache } from '../core/DocumentCache';
import { getGlobalLpcFrontendService, LpcFrontendService } from '../frontend/LpcFrontendService';
import { PreprocessorDiagnostic } from '../frontend/types';
import { CollectingErrorListener } from './CollectingErrorListener';
import { TokenTriviaIndex } from './TokenTriviaIndex';
import {
    ParsedDocument,
    ParsedDocumentServiceConfig,
    ParsedDocumentStats
} from './types';

export class ParsedDocumentService {
    private readonly documentCache: DocumentCache<ParsedDocument>;
    private parseCount = 0;
    private totalParseTime = 0;

    constructor(
        config: ParsedDocumentServiceConfig,
        private readonly frontendService: LpcFrontendService = getGlobalLpcFrontendService()
    ) {
        const vscodeConfig = vscode.workspace.getConfiguration('lpc.performance');

        this.documentCache = new DocumentCache<ParsedDocument>({
            maxSize: config.maxSize ?? vscodeConfig.get<number>('maxCacheSize', 50),
            maxMemory: config.maxMemory ?? vscodeConfig.get<number>('maxCacheMemory', 5_000_000),
            ttl: config.ttl ?? 5 * 60 * 1000,
            cleanupInterval: config.cleanupInterval ?? 60 * 1000,
            enableMonitoring: config.enableMonitoring ?? vscodeConfig.get<boolean>('enableMonitoring', true),
            enableVersionTracking: true,
            autoInvalidateOnChange: true
        });
    }

    public get(document: vscode.TextDocument): ParsedDocument {
        const cached = this.documentCache.get(document);
        if (cached) {
            cached.lastAccessed = Date.now();
            return cached;
        }

        return this.parse(document);
    }

    public invalidate(uri: vscode.Uri): void {
        this.documentCache.invalidateDocument(uri);
        this.frontendService.invalidate(uri);
    }

    public invalidatePattern(pattern: RegExp): number {
        return this.documentCache.invalidatePattern(pattern);
    }

    public clear(): void {
        this.documentCache.clear();
        this.frontendService.clear();
        this.parseCount = 0;
        this.totalParseTime = 0;
    }

    public cleanup(): void {
        this.documentCache.cleanup();
    }

    public dispose(): void {
        this.documentCache.dispose();
    }

    public getStats(): ParsedDocumentStats {
        const cacheStats = this.documentCache.getStats();
        const avgParseTime = this.parseCount > 0 ? this.totalParseTime / this.parseCount : 0;

        return {
            ...cacheStats,
            parseCount: this.parseCount,
            avgParseTime,
            totalParseTime: this.totalParseTime
        };
    }

    private parse(document: vscode.TextDocument): ParsedDocument {
        const startedAt = Date.now();
        const startTime = performance.now();
        const text = document.getText();
        const frontend = this.frontendService.get(document);
        const parseText = frontend.preprocessor.activeView.text;
        const errorListener = new CollectingErrorListener(document);

        try {
            const input = CharStreams.fromString(parseText);
            const lexer = new LPCLexer(input);
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);

            if (typeof lexer.removeErrorListeners === 'function') {
                lexer.removeErrorListeners();
            }
            if (typeof lexer.addErrorListener === 'function') {
                lexer.addErrorListener(errorListener);
            }
            if (typeof parser.removeErrorListeners === 'function') {
                parser.removeErrorListeners();
            }
            if (typeof parser.addErrorListener === 'function') {
                parser.addErrorListener(errorListener);
            }

            const tree = this.safeParseTree(parser);

            const parseTimeMs = performance.now() - startTime;
            this.parseCount++;
            this.totalParseTime += parseTimeMs;

            const allTokens = this.safeReadTokens(tokenStream);
            const visibleTokens = allTokens.filter((token) => token.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL);
            const hiddenTokens = allTokens.filter((token) => token.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL);
            const parsed: ParsedDocument = {
                uri: document.uri.toString(),
                version: document.version,
                text,
                parseText,
                frontend,
                tokenStream,
                tokens: tokenStream,
                allTokens,
                visibleTokens,
                hiddenTokens,
                tokenTriviaIndex: {} as TokenTriviaIndex,
                tree,
                diagnostics: [
                    ...this.safeDiagnostics(errorListener),
                    ...this.toVsCodePreprocessorDiagnostics(frontend.preprocessor.diagnostics)
                ],
                createdAt: startedAt,
                lastAccessed: startedAt,
                parseTimeMs,
                parseTime: parseTimeMs,
                size: text.length,
                layoutTriviaSource: 'lexer-hidden-channel'
            };
            parsed.tokenTriviaIndex = new TokenTriviaIndex(parsed);

            this.documentCache.set(document, parsed, text.length * 2);
            return parsed;
        } catch (error) {
            return this.createFallbackParsedDocument(document, text, startedAt, startTime, error, errorListener);
        }
    }

    private createFallbackParsedDocument(
        document: vscode.TextDocument,
        text: string,
        startedAt: number,
        startTime: number,
        error: unknown,
        errorListener: CollectingErrorListener
    ): ParsedDocument {
        const input = CharStreams.fromString('');
        const lexer = new LPCLexer(input);
        const tokenStream = new CommonTokenStream(lexer);
        const parser = new LPCParser(tokenStream);
        const tree = this.safeParseTree(parser);

        const parseTimeMs = performance.now() - startTime;
        this.parseCount++;
        this.totalParseTime += parseTimeMs;

        const diagnostics = this.safeDiagnostics(errorListener);
        if (diagnostics.length === 0) {
            diagnostics.push(
                new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 1),
                    `Parse error: ${error instanceof Error ? error.message : String(error)}`,
                    vscode.DiagnosticSeverity.Error
                )
            );
        }

        const allTokens = this.safeReadTokens(tokenStream);
        const visibleTokens = allTokens.filter((token) => token.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL);
        const hiddenTokens = allTokens.filter((token) => token.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL);
        const parsed: ParsedDocument = {
            uri: document.uri.toString(),
            version: document.version,
            text,
            parseText: '',
            frontend: undefined,
            tokenStream,
            tokens: tokenStream,
            allTokens,
            visibleTokens,
            hiddenTokens,
            tokenTriviaIndex: {} as TokenTriviaIndex,
            tree,
            diagnostics,
            createdAt: startedAt,
            lastAccessed: startedAt,
            parseTimeMs,
            parseTime: parseTimeMs,
            size: text.length,
            layoutTriviaSource: 'lexer-hidden-channel'
        };
        parsed.tokenTriviaIndex = new TokenTriviaIndex(parsed);

        this.documentCache.set(document, parsed, text.length * 2);
        return parsed;
    }

    private safeParseTree(parser: LPCParser): ReturnType<LPCParser['sourceFile']> {
        try {
            return parser.sourceFile();
        } catch {
            return {} as ReturnType<LPCParser['sourceFile']>;
        }
    }

    private safeReadTokens(tokenStream: CommonTokenStream) {
        try {
            tokenStream.fill();
            return tokenStream.getTokens();
        } catch {
            return [];
        }
    }

    private safeDiagnostics(errorListener: CollectingErrorListener): vscode.Diagnostic[] {
        return Array.isArray(errorListener.diagnostics) ? errorListener.diagnostics.slice() : [];
    }

    private toVsCodePreprocessorDiagnostics(diagnostics: PreprocessorDiagnostic[]): vscode.Diagnostic[] {
        return diagnostics.map((diagnostic) => {
            const result = new vscode.Diagnostic(
                diagnostic.range,
                diagnostic.message,
                diagnostic.severity
            );
            result.source = 'LPC Preprocessor';
            result.code = diagnostic.code;
            return result;
        });
    }
}

let globalParsedDocumentService: ParsedDocumentService | undefined;

export function getGlobalParsedDocumentService(): ParsedDocumentService {
    if (!globalParsedDocumentService) {
        globalParsedDocumentService = new ParsedDocumentService({});
    }

    return globalParsedDocumentService;
}

export function clearGlobalParsedDocumentService(): void {
    getGlobalParsedDocumentService().clear();
}

export function disposeGlobalParsedDocumentService(): void {
    if (!globalParsedDocumentService) {
        return;
    }

    globalParsedDocumentService.dispose();
    globalParsedDocumentService = undefined;
}
