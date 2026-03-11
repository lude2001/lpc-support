import * as vscode from 'vscode';
import {
    ParsedDocumentService,
    clearGlobalParsedDocumentService,
    disposeGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../parser/ParsedDocumentService';
import {
    clearParseCache,
    disposeParseCache,
    getParsed
} from '../parseCache';

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
        clearParseCache();
        disposeParseCache();
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

    test('legacy parseCache facade forwards to the global parsed document singleton', () => {
        const document = createDocument('int demo() { return 1; }', '/virtual/facade.c');

        const facadeResult = getParsed(document);
        const singletonResult = getGlobalParsedDocumentService().get(document);

        expect(singletonResult).toBe(facadeResult);
        expect(getGlobalParsedDocumentService().getStats().parseCount).toBe(1);

        clearParseCache();

        const reparsed = getParsed(document);
        expect(reparsed).not.toBe(facadeResult);
        expect(getGlobalParsedDocumentService().getStats().parseCount).toBe(1);
    });

    test('disposing the global parsed document service recreates a fresh singleton on next access', () => {
        const first = getGlobalParsedDocumentService();

        disposeGlobalParsedDocumentService();

        const second = getGlobalParsedDocumentService();
        expect(second).not.toBe(first);
    });
});
