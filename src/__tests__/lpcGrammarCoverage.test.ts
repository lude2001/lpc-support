import * as vscode from 'vscode';
import { ANTLRErrorListener, RecognitionException, Recognizer } from 'antlr4ts';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { ParsedDocumentService } from '../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { SyntaxKind } from '../syntax/types';

let documentSequence = 0;

function createDocument(content: string, fileName?: string): vscode.TextDocument {
    documentSequence += 1;
    const resolvedFileName = fileName ?? `/virtual/lpc-grammar-coverage-${documentSequence}.c`;
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file(resolvedFileName),
        fileName: resolvedFileName,
        languageId: 'lpc',
        version: documentSequence,
        lineCount: lineStarts.length,
        getText: jest.fn(() => content),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        })
    } as unknown as vscode.TextDocument;
}

function parseDiagnostics(source: string): string[] {
    const service = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: false });
    const parsed = service.get(createDocument(source));

    service.dispose();
    return parsed.diagnostics.map((diagnostic) => diagnostic.message);
}

function buildSyntaxNodes(source: string): any[] {
    const service = new ParsedDocumentService({ cleanupInterval: 0, enableMonitoring: false });
    const parsed = service.get(createDocument(source));
    const syntax = new SyntaxBuilder(parsed).build();

    service.dispose();
    return syntax.nodes;
}

class CollectingLexerErrorListener implements ANTLRErrorListener<number> {
    public readonly messages: string[] = [];

    public syntaxError<T>(
        _recognizer: Recognizer<T, unknown>,
        _offendingSymbol: T | undefined,
        line: number,
        charPositionInLine: number,
        msg: string,
        _e: RecognitionException | undefined
    ): void {
        this.messages.push(`${line}:${charPositionInLine} ${msg}`);
    }
}

function lexingMessages(source: string): string[] {
    const lexer = new LPCLexer(CharStreams.fromString(source));
    const listener = new CollectingLexerErrorListener();
    lexer.removeErrorListeners();
    lexer.addErrorListener(listener);
    new CommonTokenStream(lexer).fill();
    return listener.messages;
}

describe('LPC grammar coverage baseline', () => {
    test('accepts sizeof expressions and type operands', () => {
        const diagnostics = parseDiagnostics([
            'int demo(mixed value) {',
            '    return sizeof(value) + sizeof(int);',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts missing compound assignment operators from the LPC outline', () => {
        const diagnostics = parseDiagnostics([
            'void demo(int value, int mask) {',
            '    value ^= mask;',
            '    value <<= 1;',
            '    value >>= 1;',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts LPC default parameter closure syntax', () => {
        const diagnostics = parseDiagnostics([
            'varargs void demo(int amount : (: 1 :), string name : (: "none" :)) {',
            '    return;',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts efun scoped calls', () => {
        const diagnostics = parseDiagnostics([
            'mixed demo(object who) {',
            '    return efun::query_privs(who);',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts function pointer calls', () => {
        const diagnostics = parseDiagnostics([
            'mixed demo(function callback, mixed arg) {',
            '    return (*callback)(arg);',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts closure preset arguments and closure capture forms', () => {
        const diagnostics = parseDiagnostics([
            'void demo(mixed *args, mixed local_var) {',
            '    function f1 = (: call_other, this_object(), "query", args... :);',
            '    function f2 = (: $1 + $2 :);',
            '    function f3 = (: $local_var :);',
            '    function f4 = (: $(local_var) :);',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts LPC special type keywords from the outline', () => {
        const diagnostics = parseDiagnostics([
            'array values;',
            'closure callback;',
            '__TREE__ tree;',
            'void demo(array values, closure callback, __TREE__ tree) {',
            '    return;',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts foreach ref binding without an explicit type', () => {
        const diagnostics = parseDiagnostics([
            'void demo(mixed *items) {',
            '    foreach (ref item in items) {',
            '        item += 1;',
            '    }',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts literal forms from the LPC outline', () => {
        const diagnostics = parseDiagnostics([
            'void demo() {',
            '    int decimal = 1_000_000;',
            '    int hex = 0xFF;',
            '    int binary = 0b1010;',
            "    int ch = '\\n';",
            '    float ratio = 3_14_15.9_2_6;',
            '    string text = "line one',
            'line two";',
            '    string heredoc = @TEXT',
            'hello',
            'TEXT',
            '    ;',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts array delimiter literals', () => {
        const diagnostics = parseDiagnostics([
            'void demo() {',
            '    mixed *items = @@ITEMS',
            'alpha',
            'beta',
            'ITEMS;',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('lexes heredoc and array delimiter markers with trailing whitespace', () => {
        const messages = lexingMessages([
            'void demo() {',
            '    string text = @text   ',
            'hello',
            'text',
            '    ;',
            '    mixed *items = @@items   ',
            'alpha',
            'items;',
            '}'
        ].join('\n'));

        expect(messages).toEqual([]);
    });

    test('accepts LPC slice and right-index forms', () => {
        const diagnostics = parseDiagnostics([
            'void demo(string text, mixed *items) {',
            '    mixed a = text[0];',
            '    mixed b = text[1..3];',
            '    mixed c = text[<1];',
            '    mixed d = text[1..];',
            '    mixed e = text[..<2];',
            '    mixed f = items[<3..<1];',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts switch string and range cases', () => {
        const diagnostics = parseDiagnostics([
            'void demo(mixed value) {',
            '    switch (value) {',
            '    case "ready":',
            '        break;',
            '    case 1..3:',
            '        break;',
            '    case ..0:',
            '        break;',
            '    case 10..:',
            '        break;',
            '    default:',
            '        break;',
            '    }',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts function prototypes, pointer returns, variadic pointer parameters, and anonymous functions', () => {
        const diagnostics = parseDiagnostics([
            'mixed *query_values(string, object *);',
            'varargs mixed *query_values(string name, mixed *args...) {',
            '    function mapper = function(mixed value) {',
            '        return value;',
            '    };',
            '    return ({ mapper(name) });',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts mapping literals, new class initializers, and object new path expressions', () => {
        const diagnostics = parseDiagnostics([
            'class item {',
            '    string name;',
            '    int amount;',
            '}',
            'void demo() {',
            '    mapping data = ([ "name" : "sword", "amount" : 1 ]);',
            '    class item entry = new(class item, name : "sword", amount : data["amount"]);',
            '    object ob = new("/std/object");',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts catch expression and catch block forms', () => {
        const diagnostics = parseDiagnostics([
            'void demo() {',
            '    mixed error = catch(call_other(this_object(), "create"));',
            '    mixed block_error = catch {',
            '        call_other(this_object(), "reset");',
            '    };',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts optional for expressions and foreach key value bindings', () => {
        const diagnostics = parseDiagnostics([
            'void demo(mapping data) {',
            '    for (;;) {',
            '        break;',
            '    }',
            '    foreach (string key, mixed value in data) {',
            '        continue;',
            '    }',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('accepts class scope calls and unary/postfix operators', () => {
        const diagnostics = parseDiagnostics([
            'int demo(object target, int value) {',
            '    ++value;',
            '    value--;',
            '    target::reset();',
            '    return !value || ~value;',
            '}'
        ].join('\n'));

        expect(diagnostics).toEqual([]);
    });

    test('represents sizeof as a structured unary expression', () => {
        const nodes = buildSyntaxNodes([
            'int demo(mixed value) {',
            '    return sizeof(value);',
            '}'
        ].join('\n'));
        const sizeofNode = nodes.find((node) =>
            node.kind === SyntaxKind.UnaryExpression
            && node.metadata?.operator === 'sizeof'
        );

        expect(sizeofNode).toBeDefined();
        expect(sizeofNode.children.map((child: any) => child.kind)).toEqual([SyntaxKind.Identifier]);
    });

    test('preserves new compound assignment operators in syntax metadata', () => {
        const nodes = buildSyntaxNodes([
            'void demo(int value, int mask) {',
            '    value ^= mask;',
            '    value <<= 1;',
            '    value >>= 1;',
            '}'
        ].join('\n'));
        const operators = nodes
            .filter((node) => node.kind === SyntaxKind.AssignmentExpression)
            .map((node) => node.metadata?.operator);

        expect(operators).toEqual(['^=', '<<=', '>>=']);
    });

    test('represents efun scoped calls with the scoped qualifier metadata', () => {
        const nodes = buildSyntaxNodes([
            'mixed demo(object who) {',
            '    return efun::query_privs(who);',
            '}'
        ].join('\n'));
        const scopedIdentifier = nodes.find((node) =>
            node.kind === SyntaxKind.Identifier
            && node.name === 'query_privs'
            && node.metadata?.scopeQualifier === 'efun::'
        );

        expect(scopedIdentifier).toBeDefined();
    });

    test('preserves closure capture markers in formatted output', async () => {
        const { FormattingService } = await import('../formatter/FormattingService');
        const { clearGlobalParsedDocumentService } = await import('../parser/ParsedDocumentService');
        const { TestHelper } = await import('./utils/TestHelper');
        const source = [
            'void demo(mixed *args, mixed local_var){',
            'function f1=(:call_other,this_object(),"query",args...:);',
            'function f2=(:$1+$2:);',
            'function f3=(:$local_var:);',
            'function f4=(:$(local_var):);',
            '}'
        ].join('\n');

        clearGlobalParsedDocumentService();
        const service = new FormattingService();
        const document = TestHelper.createMockDocument(source, 'lpc', `closure-${Date.now()}.c`);
        const edits = await service.formatDocument(document);
        const output = edits[0]?.newText ?? source;

        expect(output).toContain('(: call_other, this_object(), "query", args... :)');
        expect(output).toContain('(: $1 + $2 :)');
        expect(output).toContain('(: $local_var :)');
        expect(output).toContain('(: $(local_var) :)');
    });
});
