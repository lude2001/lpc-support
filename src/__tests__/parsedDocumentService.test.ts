import * as vscode from 'vscode';
import {
    ParsedDocumentService,
    clearGlobalParsedDocumentService,
    disposeGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../parser/ParsedDocumentService';

function createDocument(
    content: string,
    fileName: string = '/virtual/parsed-service.c',
    version: number = 1
): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: content.split(/\r?\n/).length,
        getText: jest.fn(() => content)
    } as unknown as vscode.TextDocument;
}

describe('ParsedDocumentService', () => {
    afterEach(() => {
        clearGlobalParsedDocumentService();
        disposeGlobalParsedDocumentService();
        jest.restoreAllMocks();
    });

    test('caches parsed documents and exposes lexer-backed trivia metadata', () => {
        const service = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: true });
        const document = createDocument([
            'inherit "/std/object";',
            '',
            '// note',
            'int demo() {',
            '    return 1;',
            '}'
        ].join('\n'));

        const first = service.get(document);
        const second = service.get(document);
        const triviaKinds = first.tokenTriviaIndex.getAllTrivia().map((entry) => entry.kind);

        expect(second).toBe(first);
        expect(first.layoutTriviaSource).toBe('lexer-hidden-channel');
        expect(first.visibleTokens.length).toBeGreaterThan(0);
        expect(first.hiddenTokens.length).toBeGreaterThan(0);
        expect(triviaKinds).toEqual(expect.arrayContaining(['newline', 'line-comment', 'whitespace']));

        const stats = service.getStats();
        expect(stats.parseCount).toBe(1);
        expect(stats.size).toBe(1);
        expect(stats.hits).toBeGreaterThanOrEqual(1);
    });

    test('disposing the global parsed document service recreates a fresh singleton on next access', () => {
        const first = getGlobalParsedDocumentService();

        disposeGlobalParsedDocumentService();

        const second = getGlobalParsedDocumentService();
        expect(second).not.toBe(first);
    });

    test('accepts top-level macro invocation lines whose expansion owns the semicolon', () => {
        const service = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: true });
        const document = createDocument([
            '#define RequestType(f_name,http_type) string f_name = http_type;',
            '',
            'inherit "/external_system_package/http/base.c";',
            '',
            'RequestType(pay_add,"POST")',
            'public mapping pay_add(string userid,mixed rmb)',
            '{',
            '    return ([]);',
            '}'
        ].join('\n'), '/virtual/http-controller.c');

        const parsed = service.get(document);

        expect(parsed.diagnostics).toHaveLength(0);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
