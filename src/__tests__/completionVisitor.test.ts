import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';
import { CompletionVisitor } from '../ast/completionVisitor';
import { SymbolTable } from '../ast/symbolTable';
import { DocumentSemanticSnapshotService } from '../completion/documentSemanticSnapshotService';

function createDocument(content: string, fileName: string = '/virtual/test.c', version: number = 1): vscode.TextDocument {
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
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
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const start = lineStarts[line] ?? 0;
            const nextStart = line + 1 < lineStarts.length ? lineStarts[line + 1] : content.length;
            const end = content[nextStart - 1] === '\n' ? nextStart - 1 : nextStart;

            return {
                text: content.slice(start, end)
            };
        })
    } as unknown as vscode.TextDocument;
}

function createVisitor(source: string): { document: vscode.TextDocument; visitor: CompletionVisitor; symbolTable: SymbolTable } {
    const document = createDocument(source);
    const lexer = new LPCLexer(CharStreams.fromString(source));
    const parser = new LPCParser(new CommonTokenStream(lexer));
    const ast = parser.sourceFile();
    const symbolTable = new SymbolTable(document.uri.toString());
    const visitor = new CompletionVisitor(symbolTable, document);

    visitor.visit(ast);

    return { document, visitor, symbolTable };
}

describe('CompletionVisitor', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
    });

    test('collects explicit declarations but does not infer assignment-only locals', () => {
        const source = [
            'class Payload {',
            '    object *owners;',
            '}',
            '',
            'class Payload build(string *items, object *actors) {',
            '    int explicitLocal;',
            '    class Payload payload;',
            '    inferred = 1;',
            '    sscanf(items[0], "%s", output);',
            '    foreach (string item in items) {',
            '        int nested;',
            '    }',
            '}'
        ].join('\n');

        const { symbolTable } = createVisitor(source);

        expect(symbolTable.findSymbol('build')?.dataType).toBe('class Payload');
        expect(symbolTable.findSymbol('items', new vscode.Position(4, 24))?.dataType).toBe('string *');
        expect(symbolTable.findSymbol('actors', new vscode.Position(4, 39))?.dataType).toBe('object *');
        expect(symbolTable.findSymbol('explicitLocal', new vscode.Position(5, 10))?.dataType).toBe('int');
        expect(symbolTable.findSymbol('payload', new vscode.Position(6, 20))?.dataType).toBe('class Payload');
        expect(symbolTable.findSymbol('item', new vscode.Position(9, 20))?.dataType).toBe('string');
        expect(symbolTable.findSymbol('nested', new vscode.Position(10, 12))?.dataType).toBe('int');
        expect(symbolTable.findStructDefinition('Payload')?.members?.map(member => member.dataType)).toContain('object *');
        expect(symbolTable.findSymbol('inferred', new vscode.Position(7, 8))).toBeUndefined();
        expect(symbolTable.findSymbol('output', new vscode.Position(8, 20))).toBeUndefined();
    });

    test('captures inherit and include directives in the semantic snapshot', () => {
        const source = [
            'inherit "/std/room";',
            'inherit ROOM_D;',
            'include "game/config.h";',
            '',
            'struct Stats {',
            '    int hp;',
            '    string name;',
            '}',
            '',
            'class Payload {',
            '    object owner;',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/directives.c');
        const snapshot = DocumentSemanticSnapshotService.getInstance().getSnapshot(document, false);

        expect(snapshot.inheritStatements).toHaveLength(2);
        expect(snapshot.inheritStatements.map(statement => statement.value)).toEqual(['/std/room', 'ROOM_D']);
        expect(snapshot.inheritStatements.map(statement => statement.expressionKind)).toEqual(['string', 'macro']);

        expect(snapshot.includeStatements).toHaveLength(1);
        expect(snapshot.includeStatements[0].value).toBe('game/config.h');

        expect(snapshot.typeDefinitions.map(definition => definition.name)).toEqual(['Stats', 'Payload']);
        expect(snapshot.typeDefinitions[0].members.map(member => member.name)).toEqual(['hp', 'name']);
        expect(snapshot.typeDefinitions[1].members.map(member => member.name)).toEqual(['owner']);
    });
});
