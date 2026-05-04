import * as vscode from 'vscode';
import { GlobalVariableCollector } from '../collectors/GlobalVariableCollector';
import { StringLiteralCollector } from '../collectors/StringLiteralCollector';
import { UnusedVariableCollector } from '../collectors/UnusedVariableCollector';
import { ObjectAccessCollector } from '../diagnostics/collectors/ObjectAccessCollector';
import { MacroUsageCollector } from '../diagnostics/collectors/MacroUsageCollector';
import { DiagnosticContext } from '../diagnostics/types';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { TestHelper } from './utils/TestHelper';

function createDocument(content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);

    return {
        uri: vscode.Uri.file('/virtual/collector-test.c'),
        fileName: '/virtual/collector-test.c',
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: jest.fn(() => content),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        })
    } as unknown as vscode.TextDocument;
}

function createSyntaxNode(
    kind: SyntaxKind,
    range: vscode.Range,
    children: readonly SyntaxNode[] = [],
    extras: Partial<SyntaxNode> = {}
): SyntaxNode {
    return {
        kind,
        category: 'expression',
        range,
        tokenRange: { start: 0, end: 0 },
        leadingTrivia: [],
        trailingTrivia: [],
        children,
        isMissing: false,
        isOpaque: false,
        ...extras
    };
}

describe('syntax-backed diagnostic collectors', () => {
    test('StringLiteralCollector flags empty multiline literal from syntax nodes', () => {
        const collector = new StringLiteralCollector();
        const document = createDocument('string message = @text\n\ntext@;');
        const literalNode = createSyntaxNode(
            SyntaxKind.Literal,
            new vscode.Range(0, 17, 1, 5),
            [],
            { metadata: { text: '@text\n\ntext@' } }
        );
        const context: DiagnosticContext = {
            parsed: {} as any,
            syntax: {
                uri: document.uri.toString(),
                version: 1,
                parsed: {} as any,
                root: createSyntaxNode(SyntaxKind.SourceFile, new vscode.Range(0, 0, 1, 5)) as any,
                nodes: [literalNode],
                nodesByTokenRange: new Map(),
                metadata: { createdAt: Date.now(), nodeCount: 1, opaqueNodeCount: 0, missingNodeCount: 0 }
            }
        };

        const diagnostics = collector.collect(document, {} as any, context);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toBe('空的多行字符串');
        expect(diagnostics[0].range.start.line).toBe(literalNode.range.start.line);
        expect(diagnostics[0].range.start.character).toBe(literalNode.range.start.character);
        expect(diagnostics[0].range.end.line).toBe(literalNode.range.end.line);
        expect(diagnostics[0].range.end.character).toBe(literalNode.range.end.character);
    });

    test('ObjectAccessCollector validates macro-style receiver names from syntax tree', async () => {
        const collector = new ObjectAccessCollector();
        const document = createDocument('_USER_D->query_name();');
        const receiver = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(0, 0, 0, 7),
            [],
            { name: '_USER_D', category: 'expression' }
        );
        const member = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(0, 9, 0, 19),
            [],
            { name: 'query_name', category: 'expression' }
        );
        const memberAccess = createSyntaxNode(
            SyntaxKind.MemberAccessExpression,
            new vscode.Range(0, 0, 0, 19),
            [receiver, member],
            { metadata: { operator: '->' } }
        );
        const context: DiagnosticContext = {
            parsed: {} as any,
            syntax: {
                uri: document.uri.toString(),
                version: 1,
                parsed: {} as any,
                root: createSyntaxNode(SyntaxKind.SourceFile, new vscode.Range(0, 0, 0, 19)) as any,
                nodes: [memberAccess, receiver, member],
                nodesByTokenRange: new Map(),
                metadata: { createdAt: Date.now(), nodeCount: 3, opaqueNodeCount: 0, missingNodeCount: 0 }
            }
        };

        const diagnostics = await collector.collect(document, {} as any, context);

        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0].message).toContain('对象名应该使用大写字母和下划线');
        expect(diagnostics[0].range.start.line).toBe(receiver.range.start.line);
        expect(diagnostics[0].range.start.character).toBe(receiver.range.start.character);
        expect(diagnostics[0].range.end.line).toBe(receiver.range.end.line);
        expect(diagnostics[0].range.end.character).toBe(receiver.range.end.character);
    });

    test('ObjectAccessCollector uses semantic macro references without a secondary macro lookup', async () => {
        const collector = new ObjectAccessCollector();
        const document = createDocument('#define USER_D "/adm/user"\nUSER_D->query_name();');
        const receiver = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 0, 1, 6),
            [],
            { name: 'USER_D', category: 'expression' }
        );
        const member = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 8, 1, 18),
            [],
            { name: 'query_name', category: 'expression' }
        );
        const memberAccess = createSyntaxNode(
            SyntaxKind.MemberAccessExpression,
            new vscode.Range(1, 0, 1, 18),
            [receiver, member],
            { metadata: { operator: '->' } }
        );
        const context: DiagnosticContext = {
            parsed: {} as any,
            syntax: {
                uri: document.uri.toString(),
                version: 1,
                parsed: {} as any,
                root: createSyntaxNode(SyntaxKind.SourceFile, new vscode.Range(0, 0, 1, 21)) as any,
                nodes: [memberAccess, receiver, member],
                nodesByTokenRange: new Map(),
                metadata: { createdAt: Date.now(), nodeCount: 3, opaqueNodeCount: 0, missingNodeCount: 0 }
            },
            semantic: {
                macroReferences: [{
                    name: 'USER_D',
                    range: receiver.range,
                    resolvedValue: '"/adm/user"'
                }]
            } as any
        };

        const diagnostics = await collector.collect(document, {} as any, context);

        expect(diagnostics).toEqual([]);
    });

    test('MacroUsageCollector ignores syntax identifiers without semantic macro facts', async () => {
        const collector = new MacroUsageCollector();
        const document = createDocument('USER_D->query_name();');
        const identifier = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(0, 0, 0, 6),
            [],
            { name: 'USER_D', category: 'expression' }
        );
        const context: DiagnosticContext = {
            parsed: {} as any,
            syntax: {
                uri: document.uri.toString(),
                version: 1,
                parsed: {} as any,
                root: createSyntaxNode(SyntaxKind.SourceFile, new vscode.Range(0, 0, 0, 21)) as any,
                nodes: [identifier],
                nodesByTokenRange: new Map(),
                metadata: { createdAt: Date.now(), nodeCount: 1, opaqueNodeCount: 0, missingNodeCount: 0 }
            }
        };

        const diagnostics = await collector.collect(document, {} as any, context);

        expect(diagnostics).toEqual([]);
    });

    test('MacroUsageCollector consumes semantic macro references without legacy lookup', async () => {
        const collector = new MacroUsageCollector();
        const document = createDocument('#define USER_D "/adm/user"\nUSER_D->query_name();');
        const identifier = createSyntaxNode(
            SyntaxKind.Identifier,
            new vscode.Range(1, 0, 1, 6),
            [],
            { name: 'USER_D', category: 'expression' }
        );
        const context: DiagnosticContext = {
            parsed: {} as any,
            syntax: {
                uri: document.uri.toString(),
                version: 1,
                parsed: {} as any,
                root: createSyntaxNode(SyntaxKind.SourceFile, new vscode.Range(0, 0, 1, 21)) as any,
                nodes: [identifier],
                nodesByTokenRange: new Map(),
                metadata: { createdAt: Date.now(), nodeCount: 1, opaqueNodeCount: 0, missingNodeCount: 0 }
            },
            semantic: {
                macroReferences: [{
                    name: 'USER_D',
                    range: identifier.range,
                    resolvedValue: '"/adm/user"'
                }]
            } as any
        };

        const diagnostics = await collector.collect(document, {} as any, context);

        expect(diagnostics).toEqual([]);
    });

    test('UnusedVariableCollector does not count member names as local variable usages', () => {
        const collector = new UnusedVariableCollector();
        const document = TestHelper.createMockDocument([
            'void demo(object ob) {',
            '    int amount;',
            '    ob->amount;',
            '}'
        ].join('\n'), 'lpc', 'unused-local-member.c');
        const analysis = DocumentSemanticSnapshotService.getInstance().parseDocument(document, false);
        const context: DiagnosticContext = {
            parsed: analysis.parsed!,
            syntax: analysis.syntax,
            semantic: analysis.semantic
        };

        const diagnostics = collector.collect(document, analysis.parsed!, context);

        expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('unusedVar');
        expect(diagnostics[0].range).toEqual(new vscode.Range(1, 8, 1, 14));
    });

    test('GlobalVariableCollector does not count member names as global variable usages', () => {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'enableUnusedGlobalVarCheck') {
                    return true;
                }
                return defaultValue;
            })
        });
        const collector = new GlobalVariableCollector();
        const document = TestHelper.createMockDocument([
            'int amount;',
            'void demo(object ob) {',
            '    ob->amount;',
            '}'
        ].join('\n'), 'lpc', 'unused-global-member.c');
        const analysis = DocumentSemanticSnapshotService.getInstance().parseDocument(document, false);
        const context: DiagnosticContext = {
            parsed: analysis.parsed!,
            syntax: analysis.syntax,
            semantic: analysis.semantic
        };

        const diagnostics = collector.collect(document, analysis.parsed!, context);

        expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('unusedGlobalVar');
        expect(diagnostics[0].range).toEqual(new vscode.Range(0, 4, 0, 10));
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
