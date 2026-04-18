import { describe, expect, jest, afterEach, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ASTManager } from '../../../../ast/astManager';
import { SyntaxKind, type SyntaxDocument, type SyntaxNode } from '../../../../syntax/types';
import {
    findScopedMethodIdentifierAtPosition,
    isOnScopedMethodIdentifier
} from '../ScopedMethodIdentifierSupport';

function createTextDocument(filePath: string, source: string): vscode.TextDocument {
    const lines = source.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? source.length;
        return Math.min(lineStart + position.character, source.length);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
        getWordRangeAtPosition: jest.fn(),
        positionAt: jest.fn(),
        offsetAt: jest.fn(offsetAt),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function createSyntaxNode(
    kind: SyntaxKind,
    range: vscode.Range,
    children: readonly SyntaxNode[] = [],
    name?: string,
    metadata?: Readonly<Record<string, unknown>>
): SyntaxNode {
    return {
        kind,
        category: 'expression',
        range,
        tokenRange: { start: 0, end: 0 },
        leadingTrivia: [],
        trailingTrivia: [],
        children,
        name,
        isMissing: false,
        isOpaque: false,
        metadata
    };
}

function createSyntaxDocument(nodes: readonly SyntaxNode[]): SyntaxDocument {
    return {
        uri: 'file:///D:/workspace/demo.c',
        version: 1,
        parsed: {} as never,
        root: createSyntaxNode(SyntaxKind.SourceFile, new vscode.Range(0, 0, 0, 0), nodes),
        nodes,
        nodesByTokenRange: new Map(),
        metadata: {
            createdAt: Date.now(),
            nodeCount: nodes.length,
            opaqueNodeCount: 0,
            missingNodeCount: 0
        }
    };
}

describe('ScopedMethodIdentifierSupport', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        ASTManager.getInstance().clearAllCache();
    });

    test('finds bare ::create() method identifiers', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    ::create();\n}\n');
        const methodIdentifier = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 6, 1, 12),
            [],
            'create',
            { scopeQualifier: '::' }
        );
        const callExpression = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 4, 1, 14),
            [methodIdentifier]
        );
        const syntax = createSyntaxDocument([callExpression, methodIdentifier]);
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(syntax);

        const result = findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 8));

        expect(result).toBe(methodIdentifier);
        expect(isOnScopedMethodIdentifier(document, new vscode.Position(1, 8), 'create')).toBe(true);
    });

    test('finds qualified room::init() method identifiers', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    room::init();\n}\n');
        const qualifier = createSyntaxNode(SyntaxKind.Identifier, new vscode.Range(1, 4, 1, 8), [], 'room');
        const methodIdentifier = createSyntaxNode(SyntaxKind.Identifier, new vscode.Range(1, 10, 1, 14), [], 'init');
        const memberAccess = createSyntaxNode(
            SyntaxKind.MemberAccessExpression,
            new vscode.Range(1, 4, 1, 14),
            [qualifier, methodIdentifier],
            undefined,
            { operator: '::' }
        );
        const callExpression = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 4, 1, 16),
            [memberAccess]
        );
        const syntax = createSyntaxDocument([callExpression, memberAccess, qualifier, methodIdentifier]);
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(syntax);

        const result = findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 11));

        expect(result).toBe(methodIdentifier);
        expect(isOnScopedMethodIdentifier(document, new vscode.Position(1, 11), 'init')).toBe(true);
    });

    test('finds room::init() method identifiers from the parser-backed syntax tree', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    room::init();\n}\n');

        const result = findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 11));

        expect(result?.name).toBe('init');
        expect(isOnScopedMethodIdentifier(document, new vscode.Position(1, 11), 'init')).toBe(true);
    });

    test('uses the smallest containing scoped call when nested calls overlap', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    outer(inner::run());\n}\n');
        const outerMethodIdentifier = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 4, 1, 9),
            [],
            'outer'
        );
        const innerQualifier = createSyntaxNode(SyntaxKind.Identifier, new vscode.Range(1, 10, 1, 15), [], 'inner');
        const innerMethodIdentifier = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 17, 1, 20),
            [],
            'run',
            { scopeQualifier: '::' }
        );
        const innerCall = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 10, 1, 22),
            [innerMethodIdentifier]
        );
        const outerCall = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 4, 1, 24),
            [outerMethodIdentifier, innerCall]
        );
        const syntax = createSyntaxDocument([outerCall, innerCall, outerMethodIdentifier, innerQualifier, innerMethodIdentifier]);
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(syntax);

        const result = findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 18));

        expect(result).toBe(innerMethodIdentifier);
        expect(isOnScopedMethodIdentifier(document, new vscode.Position(1, 18), 'run')).toBe(true);
        expect(isOnScopedMethodIdentifier(document, new vscode.Position(1, 18), 'outer')).toBe(false);
    });

    test('returns undefined for qualifier and argument positions', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    room::init(arg);\n}\n');
        const qualifier = createSyntaxNode(SyntaxKind.Identifier, new vscode.Range(1, 4, 1, 8), [], 'room');
        const methodIdentifier = createSyntaxNode(SyntaxKind.Identifier, new vscode.Range(1, 10, 1, 14), [], 'init');
        const memberAccess = createSyntaxNode(
            SyntaxKind.MemberAccessExpression,
            new vscode.Range(1, 4, 1, 14),
            [qualifier, methodIdentifier],
            undefined,
            { operator: '::' }
        );
        const callExpression = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 4, 1, 19),
            [memberAccess]
        );
        const syntax = createSyntaxDocument([callExpression, memberAccess, qualifier, methodIdentifier]);
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(syntax);

        expect(findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 5))).toBeUndefined();
        expect(findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 15))).toBeUndefined();
    });

    test('returns undefined for malformed partial scoped calls', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    room::\n}\n');
        const qualifier = createSyntaxNode(SyntaxKind.Identifier, new vscode.Range(1, 4, 1, 8), [], 'room');
        const memberAccess = createSyntaxNode(
            SyntaxKind.MemberAccessExpression,
            new vscode.Range(1, 4, 1, 10),
            [qualifier],
            undefined,
            { operator: '::' }
        );
        const callExpression = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 4, 1, 10),
            [memberAccess]
        );
        const syntax = createSyntaxDocument([callExpression, memberAccess, qualifier]);
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(syntax);

        expect(findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 8))).toBeUndefined();
    });

    test('returns false when the method name does not match', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    ::create();\n}\n');
        const methodIdentifier = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 6, 1, 12),
            [],
            'create',
            { scopeQualifier: '::' }
        );
        const callExpression = createSyntaxNode(
            SyntaxKind.CallExpression,
            new vscode.Range(1, 4, 1, 14),
            [methodIdentifier]
        );
        const syntax = createSyntaxDocument([callExpression, methodIdentifier]);
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(syntax);

        expect(isOnScopedMethodIdentifier(document, new vscode.Position(1, 8), 'init')).toBe(false);
    });

    test('returns undefined when no syntax document is available', () => {
        const document = createTextDocument('D:/workspace/demo.c', 'void demo() {\n    ::create();\n}\n');
        jest.spyOn(ASTManager.getInstance(), 'getSyntaxDocument').mockReturnValue(undefined);

        expect(findScopedMethodIdentifierAtPosition(document, new vscode.Position(1, 8))).toBeUndefined();
    });
});
