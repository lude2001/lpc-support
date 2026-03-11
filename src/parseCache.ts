import * as vscode from 'vscode';
import {
    clearGlobalParsedDocumentService,
    disposeGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from './parser/ParsedDocumentService';
import type {
    ParsedDocument,
    ParsedDocumentServiceConfig,
    ParsedDocumentStats
} from './parser/types';

/**
 * LEGACY COMPATIBILITY FACADE
 *
 * Allowed:
 * - Backward-compatible imports from older tests and secondary utilities.
 * - Thin forwarding to the global ParsedDocumentService singleton.
 *
 * Forbidden:
 * - Adding new production-path imports from this module.
 * - Introducing parser/cache logic that diverges from ParsedDocumentService.
 *
 * Removal phase:
 * - Delete after legacy/test-only imports are migrated in the final cleanup pass.
 */
export type ParsedDoc = ParsedDocument;
export type ParseCacheConfig = ParsedDocumentServiceConfig;

export function getParsed(document: vscode.TextDocument): ParsedDoc {
    return getGlobalParsedDocumentService().get(document);
}

export function clearParseCache(): void {
    clearGlobalParsedDocumentService();
}

export function deleteDocumentCache(uri: vscode.Uri): boolean {
    const service = getGlobalParsedDocumentService();
    const sizeBefore = service.getStats().size;
    service.invalidate(uri);
    return service.getStats().size < sizeBefore;
}

export function getParserCacheStats(): ParsedDocumentStats {
    return getGlobalParsedDocumentService().getStats();
}

export function disposeParseCache(): void {
    disposeGlobalParsedDocumentService();
}
