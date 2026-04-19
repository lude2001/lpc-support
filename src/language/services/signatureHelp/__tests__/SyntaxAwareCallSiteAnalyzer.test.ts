import * as vscode from 'vscode';
import { describe, expect, test } from '@jest/globals';
import { createSyntaxNode, createSyntaxDocument, createTokenRange, SyntaxKind } from '../../../../syntax/types';
import {
    countActiveParameterIndex,
    createSyntaxAwareCallSiteAnalyzer
} from '../SyntaxAwareCallSiteAnalyzer';
import { createDocument } from './testSupport';

describe('SyntaxAwareCallSiteAnalyzer', () => {
    test('selects the innermost call site and computes active parameter index', () => {
        const document = createDocument('outer(inner(1, 2), 3);');
        const analyzer = createSyntaxAwareCallSiteAnalyzer({
            getSyntaxDocument: () => createNestedCallSyntaxDocument()
        });
        const position = new vscode.Position(0, 14);

        const analyzed = analyzer.analyze(document, position);

        expect(analyzed).toEqual(expect.objectContaining({
            calleeName: 'inner',
            callKind: 'function'
        }));
        expect(countActiveParameterIndex(document, position, analyzed!)).toBe(1);
    });

    test('classifies object and scoped methods correctly', () => {
        const document = createDocument('ob->query_name(1); ::create(2);');
        const analyzer = createSyntaxAwareCallSiteAnalyzer({
            getSyntaxDocument: () => createMemberAndScopedSyntaxDocument()
        });

        const objectCall = analyzer.analyze(document, new vscode.Position(0, 15));
        const scopedCall = analyzer.analyze(document, new vscode.Position(0, 28));

        expect(objectCall).toEqual(expect.objectContaining({
            calleeName: 'query_name',
            callKind: 'objectMethod',
            calleeLookupPosition: new vscode.Position(0, 4)
        }));
        expect(scopedCall).toEqual(expect.objectContaining({
            calleeName: 'create',
            callKind: 'scopedMethod',
            calleeLookupPosition: new vscode.Position(0, 21)
        }));
    });
});

function createNestedCallSyntaxDocument() {
    const innerIdentifier = createSyntaxNode({
        kind: SyntaxKind.Identifier,
        range: new vscode.Range(0, 6, 0, 11),
        tokenRange: createTokenRange(0, 0),
        name: 'inner'
    });
    const innerArg1 = createSyntaxNode({
        kind: SyntaxKind.Literal,
        range: new vscode.Range(0, 12, 0, 13),
        tokenRange: createTokenRange(2, 2)
    });
    const innerArg2 = createSyntaxNode({
        kind: SyntaxKind.Literal,
        range: new vscode.Range(0, 15, 0, 16),
        tokenRange: createTokenRange(4, 4)
    });
    const innerArgs = createSyntaxNode({
        kind: SyntaxKind.ArgumentList,
        range: new vscode.Range(0, 11, 0, 17),
        tokenRange: createTokenRange(1, 5),
        children: [innerArg1, innerArg2]
    });
    const innerCall = createSyntaxNode({
        kind: SyntaxKind.CallExpression,
        range: new vscode.Range(0, 6, 0, 17),
        tokenRange: createTokenRange(0, 5),
        children: [innerIdentifier, innerArgs]
    });

    const outerIdentifier = createSyntaxNode({
        kind: SyntaxKind.Identifier,
        range: new vscode.Range(0, 0, 0, 5),
        tokenRange: createTokenRange(6, 6),
        name: 'outer'
    });
    const outerArg2 = createSyntaxNode({
        kind: SyntaxKind.Literal,
        range: new vscode.Range(0, 19, 0, 20),
        tokenRange: createTokenRange(10, 10)
    });
    const outerArgs = createSyntaxNode({
        kind: SyntaxKind.ArgumentList,
        range: new vscode.Range(0, 5, 0, 21),
        tokenRange: createTokenRange(7, 11),
        children: [innerCall, outerArg2]
    });
    const outerCall = createSyntaxNode({
        kind: SyntaxKind.CallExpression,
        range: new vscode.Range(0, 0, 0, 21),
        tokenRange: createTokenRange(6, 11),
        children: [outerIdentifier, outerArgs]
    });

    const root = createSyntaxNode({
        kind: SyntaxKind.SourceFile,
        range: new vscode.Range(0, 0, 0, 21),
        tokenRange: createTokenRange(0, 11),
        children: [outerCall]
    });

    return createSyntaxDocument({
        parsed: {
            uri: 'file:///D:/workspace/nested-signature.c',
            version: 1,
            text: 'outer(inner(1, 2), 3);',
            visibleTokens: [
                { tokenIndex: 0, text: 'inner' },
                { tokenIndex: 1, text: '(', startIndex: 11, stopIndex: 11 },
                { tokenIndex: 2, text: '1' },
                { tokenIndex: 3, text: ',', startIndex: 13, stopIndex: 13 },
                { tokenIndex: 4, text: '2' },
                { tokenIndex: 5, text: ')', startIndex: 16, stopIndex: 16 },
                { tokenIndex: 6, text: 'outer' },
                { tokenIndex: 7, text: '(' },
                { tokenIndex: 8, text: ',' },
                { tokenIndex: 9, text: '3' },
                { tokenIndex: 10, text: ')' },
                { tokenIndex: 11, text: ';' }
            ]
        } as any,
        root,
        nodes: [root, outerCall, outerIdentifier, outerArgs, innerCall, innerIdentifier, innerArgs, innerArg1, innerArg2, outerArg2]
    });
}

function createMemberAndScopedSyntaxDocument() {
    const memberName = createSyntaxNode({
        kind: SyntaxKind.Identifier,
        range: new vscode.Range(0, 4, 0, 14),
        tokenRange: createTokenRange(2, 2),
        name: 'query_name'
    });
    const memberAccess = createSyntaxNode({
        kind: SyntaxKind.MemberAccessExpression,
        range: new vscode.Range(0, 0, 0, 14),
        tokenRange: createTokenRange(0, 2),
        children: [
            createSyntaxNode({
                kind: SyntaxKind.Identifier,
                range: new vscode.Range(0, 0, 0, 2),
                tokenRange: createTokenRange(0, 0),
                name: 'ob'
            }),
            memberName
        ],
        metadata: { operator: '->' }
    });
    const objectArgs = createSyntaxNode({
        kind: SyntaxKind.ArgumentList,
        range: new vscode.Range(0, 14, 0, 17),
        tokenRange: createTokenRange(3, 5),
        children: [
            createSyntaxNode({
                kind: SyntaxKind.Literal,
                range: new vscode.Range(0, 15, 0, 16),
                tokenRange: createTokenRange(4, 4)
            })
        ]
    });
    const objectCall = createSyntaxNode({
        kind: SyntaxKind.CallExpression,
        range: new vscode.Range(0, 0, 0, 17),
        tokenRange: createTokenRange(0, 5),
        children: [memberAccess, objectArgs]
    });

    const scopedIdentifier = createSyntaxNode({
        kind: SyntaxKind.Identifier,
        range: new vscode.Range(0, 21, 0, 27),
        tokenRange: createTokenRange(6, 6),
        name: 'create',
        metadata: { scopeQualifier: '::' }
    });
    const scopedArgs = createSyntaxNode({
        kind: SyntaxKind.ArgumentList,
        range: new vscode.Range(0, 27, 0, 30),
        tokenRange: createTokenRange(7, 9),
        children: [
            createSyntaxNode({
                kind: SyntaxKind.Literal,
                range: new vscode.Range(0, 28, 0, 29),
                tokenRange: createTokenRange(8, 8)
            })
        ]
    });
    const scopedCall = createSyntaxNode({
        kind: SyntaxKind.CallExpression,
        range: new vscode.Range(0, 19, 0, 30),
        tokenRange: createTokenRange(6, 9),
        children: [scopedIdentifier, scopedArgs]
    });

    const root = createSyntaxNode({
        kind: SyntaxKind.SourceFile,
        range: new vscode.Range(0, 0, 0, 31),
        tokenRange: createTokenRange(0, 10),
        children: [objectCall, scopedCall]
    });

    return createSyntaxDocument({
        parsed: {
            uri: 'file:///D:/workspace/member-scoped-signature.c',
            version: 1,
            text: 'ob->query_name(1); ::create(2);',
            visibleTokens: [
                { tokenIndex: 0, text: 'ob' },
                { tokenIndex: 1, text: '->' },
                { tokenIndex: 2, text: 'query_name' },
                { tokenIndex: 3, text: '(', startIndex: 14, stopIndex: 14 },
                { tokenIndex: 4, text: '1' },
                { tokenIndex: 5, text: ')', startIndex: 16, stopIndex: 16 },
                { tokenIndex: 6, text: 'create' },
                { tokenIndex: 7, text: '(', startIndex: 27, stopIndex: 27 },
                { tokenIndex: 8, text: '2' },
                { tokenIndex: 9, text: ')', startIndex: 29, stopIndex: 29 },
                { tokenIndex: 10, text: ';' }
            ]
        } as any,
        root,
        nodes: [root, objectCall, memberAccess, memberName, objectArgs, scopedCall, scopedIdentifier, scopedArgs]
    });
}
