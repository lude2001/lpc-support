import * as vscode from 'vscode';
import {
    createSyntaxDocument,
    createSyntaxNode,
    createSyntaxTrivia,
    createSyntaxTriviaList,
    createTokenRange,
    flattenSyntaxTree,
    getTokenRangeKey,
    SyntaxKind,
    syntaxTriviaFromParsedTrivia
} from '../syntax/types';

describe('syntax model contracts', () => {
    test('creates syntax trivia contracts from parser trivia', () => {
        const parsedTrivia = {
            kind: 'line-comment' as const,
            text: '// note',
            range: new vscode.Range(0, 0, 0, 7),
            tokenIndex: 3,
            startOffset: 0,
            endOffset: 7
        };

        const trivia = syntaxTriviaFromParsedTrivia(parsedTrivia, 'leading');
        const list = createSyntaxTriviaList([trivia]);

        expect(trivia.placement).toBe('leading');
        expect(trivia.source).toBe('parser');
        expect(list.hasComments).toBe(true);
        expect(list.hasDirectives).toBe(false);
    });

    test('creates syntax nodes with inferred categories and defaults', () => {
        const node = createSyntaxNode({
            kind: SyntaxKind.ReturnStatement,
            range: new vscode.Range(1, 4, 1, 10),
            tokenRange: createTokenRange(10, 12)
        });

        expect(node.category).toBe('statement');
        expect(node.children).toEqual([]);
        expect(node.leadingTrivia).toEqual([]);
        expect(node.isMissing).toBe(false);
        expect(node.isOpaque).toBe(false);
    });

    test('creates syntax documents and token-range indexes from tree nodes', () => {
        const leadingTrivia = createSyntaxTrivia({
            kind: 'newline',
            text: '\n',
            range: new vscode.Range(0, 0, 1, 0),
            tokenIndex: 0,
            startOffset: 0,
            endOffset: 1,
            placement: 'leading'
        });

        const child = createSyntaxNode({
            kind: SyntaxKind.FunctionDeclaration,
            range: new vscode.Range(1, 0, 3, 1),
            tokenRange: createTokenRange(4, 20),
            leadingTrivia: [leadingTrivia]
        });
        const root = createSyntaxNode({
            kind: SyntaxKind.SourceFile,
            range: new vscode.Range(0, 0, 3, 1),
            tokenRange: createTokenRange(0, 21),
            children: [child]
        });

        const syntaxDocument = createSyntaxDocument({
            parsed: {
                uri: 'file:///syntax.c',
                version: 1
            } as any,
            root: root as any
        });

        expect(flattenSyntaxTree(root)).toHaveLength(2);
        expect(syntaxDocument.metadata.nodeCount).toBe(2);
        expect(syntaxDocument.nodesByTokenRange.get(getTokenRangeKey(child.tokenRange))).toBe(child);
    });
});
