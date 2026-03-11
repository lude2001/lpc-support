import * as vscode from 'vscode';
import {
    getGlobalParsedDocumentService,
    ParsedDocumentService
} from '../parser/ParsedDocumentService';
import type {
    ParsedDocument,
    ParsedDocumentServiceConfig,
    ParsedDocumentStats
} from '../parser/types';
import {
    clearParseCache as clearLegacyParseCache,
    disposeParseCache as disposeLegacyParseCache,
    getParsed as getLegacyParsed,
    getParserCacheStats as getLegacyParserCacheStats
} from '../parseCache';

export type ParsedDoc = ParsedDocument;
export type ParseCacheConfig = ParsedDocumentServiceConfig;

/**
 * LEGACY COMPATIBILITY WRAPPER
 *
 * Allowed:
 * - Existing examples or compatibility imports that still expect a ParseCache class.
 * - Delegation to ParsedDocumentService without creating an alternative production truth source.
 *
 * Forbidden:
 * - Using this module as the primary parser/cache entry point for production features.
 * - Reintroducing a second global singleton or custom parser logic here.
 *
 * Removal phase:
 * - Delete after remaining compatibility/example imports are migrated.
 */
export class ParseCache {
    private readonly parsedDocumentService: ParsedDocumentService;

    constructor(config: ParseCacheConfig = {}, parsedDocumentService?: ParsedDocumentService) {
        this.parsedDocumentService = parsedDocumentService ?? new ParsedDocumentService(config);
    }

    getParsed(document: vscode.TextDocument): ParsedDoc {
        return this.parsedDocumentService.get(document);
    }

    invalidate(uri: vscode.Uri): void {
        this.parsedDocumentService.invalidate(uri);
    }

    invalidatePattern(pattern: RegExp): number {
        return this.parsedDocumentService.invalidatePattern(pattern);
    }

    clear(): void {
        this.parsedDocumentService.clear();
    }

    getStats(): ParsedDocumentStats {
        return this.parsedDocumentService.getStats();
    }

    cleanup(): void {
        this.parsedDocumentService.cleanup();
    }

    dispose(): void {
        this.parsedDocumentService.dispose();
    }
}

let globalParseCache: ParseCache | undefined;

export function getGlobalParseCache(): ParseCache {
    if (!globalParseCache) {
        globalParseCache = new ParseCache({}, getGlobalParsedDocumentService());
    }

    return globalParseCache;
}

export function getParsed(document: vscode.TextDocument): ParsedDoc {
    return getLegacyParsed(document);
}

export function clearParseCache(): void {
    clearLegacyParseCache();
}

export function getParserCacheStats(): ParsedDocumentStats {
    return getLegacyParserCacheStats();
}

export function disposeParseCache(): void {
    disposeLegacyParseCache();
    globalParseCache = undefined;
}
