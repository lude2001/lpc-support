import * as vscode from 'vscode';
import { ParsedDocumentService } from '../parser/ParsedDocumentService';
import { Trivia } from '../parser/types';
import { TestHelper } from './utils/TestHelper';

function findVisibleTokenIndex(documentText: string, tokenText: string, fromOffset = 0): number {
    const offset = documentText.indexOf(tokenText, fromOffset);
    expect(offset).toBeGreaterThanOrEqual(0);
    return offset;
}

function findVisibleTokenByText(parsed: ReturnType<ParsedDocumentService['get']>, tokenText: string, fromOffset = 0) {
    const targetOffset = findVisibleTokenIndex(parsed.text, tokenText, fromOffset);
    const token = parsed.visibleTokens.find(
        (candidate) => candidate.startIndex === targetOffset && candidate.text === tokenText
    );

    expect(token).toBeDefined();
    return token!;
}

function triviaKinds(entries: Trivia[]): string[] {
    return entries.map((entry) => entry.kind);
}

describe('TokenTriviaIndex', () => {
    const parsedDocumentService = new ParsedDocumentService();

    afterEach(() => {
        parsedDocumentService.clear();
    });

    test('exposes block comments and layout trivia before the first visible token', () => {
        const source = `/* header */\n\ninherit "/std/object";\n`;
        const document = TestHelper.createMockDocument(source, 'lpc', 'trivia-header.c');
        const parsed = parsedDocumentService.get(document);
        const inheritToken = findVisibleTokenByText(parsed, 'inherit');

        const leadingTrivia = parsed.tokenTriviaIndex.getLeadingTrivia(inheritToken.tokenIndex);

        expect(triviaKinds(leadingTrivia)).toEqual(['block-comment', 'newline', 'newline']);
        expect(leadingTrivia[0].text).toBe('/* header */');
        expect(leadingTrivia[1].text).toBe('\n');
        expect(leadingTrivia[2].text).toBe('\n');
    });

    test('exposes directives as trivia before the next visible token', () => {
        const source = `#include "/sys/test.h"\nint value;\n`;
        const document = TestHelper.createMockDocument(source, 'lpc', 'trivia-directive.c');
        const parsed = parsedDocumentService.get(document);
        const intToken = findVisibleTokenByText(parsed, 'int');

        const leadingTrivia = parsed.tokenTriviaIndex.getLeadingTrivia(intToken.tokenIndex);

        expect(triviaKinds(leadingTrivia)).toEqual(['directive']);
        expect(leadingTrivia[0].text).toContain('#include');
    });

    test('splits whitespace and newline trivia between visible tokens', () => {
        const source = `int value =\n    42;\n`;
        const document = TestHelper.createMockDocument(source, 'lpc', 'trivia-layout.c');
        const parsed = parsedDocumentService.get(document);
        const assignToken = findVisibleTokenByText(parsed, '=');
        const numberToken = findVisibleTokenByText(parsed, '42');

        const trivia = parsed.tokenTriviaIndex.getInterveningTrivia(assignToken.tokenIndex, numberToken.tokenIndex);

        expect(triviaKinds(trivia)).toEqual(['newline', 'whitespace']);
        expect(trivia[0].range.start).toEqual(new vscode.Position(0, 11));
        expect(trivia[1].text).toBe('    ');
    });

    test('exposes trailing line comments after a visible token', () => {
        const source = `return foo; // trailing comment\n`;
        const document = TestHelper.createMockDocument(source, 'lpc', 'trivia-trailing.c');
        const parsed = parsedDocumentService.get(document);
        const semiToken = findVisibleTokenByText(parsed, ';');

        const trailingTrivia = parsed.tokenTriviaIndex.getTrailingTrivia(semiToken.tokenIndex);

        expect(triviaKinds(trailingTrivia)).toEqual(['whitespace', 'line-comment', 'newline']);
        expect(trailingTrivia[1].text).toBe('// trailing comment');
    });
});
