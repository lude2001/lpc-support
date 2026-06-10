import * as vscode from 'vscode';
import { GlobalVariableCollector } from '../collectors/GlobalVariableCollector';
import { StringLiteralCollector } from '../collectors/StringLiteralCollector';
import { UnusedVariableCollector } from '../collectors/UnusedVariableCollector';
import { ObjectAccessCollector } from '../diagnostics/collectors/ObjectAccessCollector';
import { BasicSemanticDiagnosticsCollector } from '../diagnostics/collectors/BasicSemanticDiagnosticsCollector';
import { MacroUsageCollector } from '../diagnostics/collectors/MacroUsageCollector';
import { isFluffOSPredefinedMacro } from '../diagnostics/semantic/FluffOSPredefinedMacros';
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

function analyzeCollectorSource(content: string, fileName: string): {
    document: vscode.TextDocument;
    parsed: any;
    context: DiagnosticContext;
} {
    const document = TestHelper.createMockDocument(content, 'lpc', `/virtual/${fileName}`);
    const analysis = DocumentSemanticSnapshotService.getInstance().parseDocument(document, false);
    return {
        document,
        parsed: analysis.parsed!,
        context: {
            parsed: analysis.parsed!,
            syntax: analysis.syntax,
            semantic: analysis.semantic
        }
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

    test('BasicSemanticDiagnosticsCollector reports current-file argument count mismatches', async () => {
        const collector = new BasicSemanticDiagnosticsCollector();
        const { document, parsed, context } = analyzeCollectorSource([
            'void callee(int amount) {}',
            'void demo() {',
            '    callee();',
            '    callee(1);',
            '    callee(1, 2);',
            '}'
        ].join('\n'), 'basic-semantic-arity.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            'lpc.argumentCountMismatch',
            'lpc.argumentCountMismatch'
        ]);
        expect(diagnostics.every((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Warning)).toBe(true);
    });

    test('BasicSemanticDiagnosticsCollector reports undefined symbols and direct calls conservatively', async () => {
        const collector = new BasicSemanticDiagnosticsCollector();
        const { document, parsed, context } = analyzeCollectorSource([
            'void demo(object ob) {',
            '    missing_value;',
            '    missing_call();',
            '    ob->missing_member();',
            '    call_other(ob, "missing_dynamic");',
            '}'
        ].join('\n'), 'basic-semantic-undefined.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics).toHaveLength(2);
        expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
            'lpc.undefinedSymbol',
            'lpc.undefinedFunction'
        ]));
        expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual(expect.arrayContaining([
            '未定义符号: missing_value',
            '未定义函数: missing_call'
        ]));
    });

    test('BasicSemanticDiagnosticsCollector suppresses undefined diagnostics without resolver when dependencies exist', async () => {
        const collector = new BasicSemanticDiagnosticsCollector();
        const { document, parsed, context } = analyzeCollectorSource([
            'inherit ROOM;',
            '',
            'void create() {',
            '    set("short", "room");',
            '    setup();',
            '    ROOM_D;',
            '}'
        ].join('\n'), 'basic-semantic-unresolved-dependency.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics).toEqual([]);
    });

    test('BasicSemanticDiagnosticsCollector recognizes comma-separated initialized local variables', async () => {
        const collector = new BasicSemanticDiagnosticsCollector();
        const { document, parsed, context } = analyzeCollectorSource([
            'void demo() {',
            '    string str1="", str2="", str3f="", str3d="", me_att="", you_def="", damage_msg="", other_msg="";',
            '    str3f = str1 + str2;',
            '    str3d = str3f;',
            '    me_att = damage_msg;',
            '    you_def = other_msg;',
            '}'
        ].join('\n'), 'basic-semantic-comma-locals.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(context.semantic).toBeDefined();
        expect(context.semantic?.degraded).toBeFalsy();
        expect(diagnostics).toEqual([]);
    });

    test('BasicSemanticDiagnosticsCollector handles variadic, macro, and degraded cases without noise', async () => {
        const collector = new BasicSemanticDiagnosticsCollector();
        const { document, parsed, context } = analyzeCollectorSource([
            '#define USER_D "/adm/user"',
            'void variadic(int head, mixed * rest...) {}',
            'void demo() {',
            '    USER_D;',
            '    variadic(1, 2, 3);',
            '}'
        ].join('\n'), 'basic-semantic-quiet.c');

        const diagnostics = await collector.collect(document, parsed, context);
        const degradedDiagnostics = await collector.collect(document, parsed, {
            ...context,
            semantic: {
                ...context.semantic!,
                degraded: true
            }
        });

        expect(diagnostics).toEqual([]);
        expect(degradedDiagnostics).toEqual([]);
    });

    test('BasicSemanticDiagnosticsCollector recognizes FluffOS predefined macros', async () => {
        const collector = new BasicSemanticDiagnosticsCollector();
        const { document, parsed, context } = analyzeCollectorSource([
            'void demo() {',
            '    string dir = __DIR__;',
            '    string file = __FILE__;',
            '    int line = __LINE__;',
            '    int hasDb = __PACKAGE_DB__;',
            '    int maxDepth = __CFG_MAX_CALL_DEPTH__;',
            '    missing_symbol;',
            '}'
        ].join('\n'), 'basic-semantic-predefined-macros.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
            '未定义符号: missing_symbol'
        ]);
    });

    test('FluffOS predefined macro helper covers generated driver option families', () => {
        expect(isFluffOSPredefinedMacro('__DIR__')).toBe(true);
        expect(isFluffOSPredefinedMacro('__LINE__')).toBe(true);
        expect(isFluffOSPredefinedMacro('__PACKAGE_CRYPTO__')).toBe(true);
        expect(isFluffOSPredefinedMacro('__HAVE_UNISTD_H__')).toBe(true);
        expect(isFluffOSPredefinedMacro('__CFG_MAX_ARRAY_SIZE__')).toBe(true);
        expect(isFluffOSPredefinedMacro('__NOT_A_DRIVER_PREDEFINED__')).toBe(false);
    });

    test('BasicSemanticDiagnosticsCollector consumes injected callable signatures for efun-style targets', async () => {
        const collector = new BasicSemanticDiagnosticsCollector({
            resolveVisibleSymbols: jest.fn((_document, semantic) => ({
                functions: semantic.exportedFunctions,
                symbols: semantic.symbols,
                fileGlobals: semantic.fileGlobals ?? [],
                types: semantic.typeDefinitions,
                macros: semantic.macroDefinitions ?? [],
                macroReferences: semantic.macroReferences,
                callableSignatures: [{
                    name: 'write',
                    requiredParameterCount: 1,
                    maxParameterCount: 1,
                    isVariadic: false,
                    source: 'efun'
                }],
                hasUnresolvedDependencies: false
            }))
        });
        const { document, parsed, context } = analyzeCollectorSource([
            'void demo() {',
            '    write("ok");',
            '    write();',
            '}'
        ].join('\n'), 'basic-semantic-efun.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['lpc.argumentCountMismatch']);
        expect(diagnostics[0].message).toContain('write');
    });

    test('BasicSemanticDiagnosticsCollector accepts efun optional argument ranges', async () => {
        const collector = new BasicSemanticDiagnosticsCollector({
            resolveVisibleSymbols: jest.fn((_document, semantic) => ({
                functions: semantic.exportedFunctions,
                symbols: semantic.symbols,
                fileGlobals: semantic.fileGlobals ?? [],
                types: semantic.typeDefinitions,
                macros: semantic.macroDefinitions ?? [],
                macroReferences: semantic.macroReferences,
                callableSignatures: [{
                    name: 'member_array',
                    requiredParameterCount: 2,
                    maxParameterCount: 4,
                    isVariadic: false,
                    source: 'efun'
                }],
                hasUnresolvedDependencies: false
            }))
        });
        const { document, parsed, context } = analyzeCollectorSource([
            'void demo(mixed item, mixed *arr) {',
            '    member_array(item, arr);',
            '    member_array(item, arr, 0, 0, 1);',
            '}'
        ].join('\n'), 'basic-semantic-efun-optional.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['lpc.argumentCountMismatch']);
        expect(diagnostics[0].message).toContain('member_array');
        expect(diagnostics[0].message).toContain('期望 2-4 个');
    });

    test('BasicSemanticDiagnosticsCollector accepts tell_room without exclude argument', async () => {
        const collector = new BasicSemanticDiagnosticsCollector({
            resolveVisibleSymbols: jest.fn((_document, semantic) => ({
                functions: semantic.exportedFunctions,
                symbols: semantic.symbols,
                fileGlobals: semantic.fileGlobals ?? [],
                types: semantic.typeDefinitions,
                macros: semantic.macroDefinitions ?? [],
                macroReferences: semantic.macroReferences,
                callableSignatures: [{
                    name: 'tell_room',
                    requiredParameterCount: 2,
                    maxParameterCount: 3,
                    isVariadic: false,
                    source: 'efun'
                }],
                hasUnresolvedDependencies: false
            }))
        });
        const { document, parsed, context } = analyzeCollectorSource([
            'void demo(object room, string msg, object *exclude) {',
            '    tell_room(room, msg);',
            '    tell_room(room, msg, exclude);',
            '    tell_room(room);',
            '}'
        ].join('\n'), 'basic-semantic-tell-room.c');

        const diagnostics = await collector.collect(document, parsed, context);

        expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['lpc.argumentCountMismatch']);
        expect(diagnostics[0].message).toContain('tell_room');
        expect(diagnostics[0].message).toContain('期望 2-3 个');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
