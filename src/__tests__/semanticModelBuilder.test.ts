import * as vscode from 'vscode';
import { clearParseCache, getParsed } from '../parseCache';
import { SemanticModelBuilder } from '../semantic/SemanticModelBuilder';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { DocumentSemanticSnapshotService } from '../completion/documentSemanticSnapshotService';

function createDocument(content: string, fileName: string = '/virtual/semantic.c', version: number = 1): vscode.TextDocument {
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
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            const startOffset = lineStarts[range.start.line] + range.start.character;
            const endOffset = lineStarts[range.end.line] + range.end.character;
            return content.slice(startOffset, endOffset);
        }),
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
        offsetAt: jest.fn((position: vscode.Position) => lineStarts[position.line] + position.character),
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

describe('SemanticModelBuilder', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
        clearParseCache();
    });

    test('builds symbols, scopes, type summaries, and directives from syntax nodes', () => {
        const source = [
            'inherit "/std/room";',
            'include "game/config.h";',
            '',
            'struct Stats {',
            '    int hp;',
            '    string name;',
            '}',
            '',
            'class Payload {',
            '    object owner;',
            '}',
            '',
            'class Payload build(string *items, object *actors) {',
            '    int explicitLocal;',
            '    foreach (string item in items) {',
            '        int nested;',
            '    }',
            '    return 0;',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const parsed = getParsed(document);
        const syntax = new SyntaxBuilder(parsed).build();
        const snapshot = new SemanticModelBuilder().build(syntax);

        expect(snapshot.parseDiagnostics).toHaveLength(0);
        expect(snapshot.exportedFunctions.map((item) => item.name)).toEqual(['build']);
        expect(snapshot.exportedFunctions[0].returnType).toBe('class Payload');
        expect(snapshot.exportedFunctions[0].parameters.map((item) => item.dataType)).toEqual(['string *', 'object *']);

        expect(snapshot.symbolTable.findSymbol('build')?.dataType).toBe('class Payload');
        expect(snapshot.symbolTable.findSymbol('items', new vscode.Position(12, 32))?.dataType).toBe('string *');
        expect(snapshot.symbolTable.findSymbol('actors', new vscode.Position(12, 46))?.dataType).toBe('object *');
        expect(snapshot.symbolTable.findSymbol('explicitLocal', new vscode.Position(13, 10))?.dataType).toBe('int');
        expect(snapshot.symbolTable.findSymbol('item', new vscode.Position(14, 24))?.dataType).toBe('string');
        expect(snapshot.symbolTable.findSymbol('nested', new vscode.Position(15, 12))?.dataType).toBe('int');

        expect(snapshot.inheritStatements.map((statement) => statement.value)).toEqual(['/std/room']);
        expect(snapshot.inheritStatements[0].expressionKind).toBe('string');
        expect(snapshot.includeStatements.map((statement) => statement.value)).toEqual(['game/config.h']);

        expect(snapshot.typeDefinitions.map((item) => item.name)).toEqual(['Stats', 'Payload']);
        expect(snapshot.typeDefinitions[0].members.map((member) => member.name)).toEqual(['hp', 'name']);
        expect(snapshot.typeDefinitions[1].members.map((member) => member.name)).toEqual(['owner']);
        expect(snapshot.localScopes.some((scope) => scope.name === 'function:build')).toBe(true);
        expect(snapshot.localScopes.some((scope) => scope.name === 'foreach')).toBe(true);
    });

    test('DocumentSemanticSnapshotService returns semantic snapshot built from syntax layer', () => {
        const source = [
            'int demo() {',
            '    for (int i = 0; i < 3; i++) {',
            '        int inner;',
            '    }',
            '    return 1;',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/semantic-service.c');
        const snapshot = DocumentSemanticSnapshotService.getInstance().getSnapshot(document, false);

        expect(snapshot.exportedFunctions.map((item) => item.name)).toEqual(['demo']);
        expect(snapshot.symbolTable.findSymbol('i', new vscode.Position(1, 18))?.dataType).toBe('int');
        expect(snapshot.symbolTable.findSymbol('inner', new vscode.Position(2, 12))?.dataType).toBe('int');
    });

    test('keeps implementation definitions ahead of trailing prototypes in the same scope', () => {
        const source = [
            'int demo() {',
            '    return 1;',
            '}',
            '',
            'int demo();'
        ].join('\n');
        const document = createDocument(source, '/virtual/prototype-precedence.c');
        const parsed = getParsed(document);
        const syntax = new SyntaxBuilder(parsed).build();
        const snapshot = new SemanticModelBuilder().build(syntax);

        expect(snapshot.exportedFunctions.map((item) => item.name)).toEqual(['demo']);
        expect(snapshot.symbolTable.findSymbol('demo')?.range.start.line).toBe(0);
    });
});
