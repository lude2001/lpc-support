import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { clearGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { LPCFunctionParser } from '../functionParser';

function createDocument(fileName: string, content: string): vscode.TextDocument {
    const lineStarts = [0];
    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version: 1,
        lineCount: lineStarts.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
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
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position)),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: content.split(/\r?\n/)[line] ?? '' };
        })
    } as unknown as vscode.TextDocument;
}

function positionAfter(source: string, marker: string): vscode.Position {
    const offset = source.indexOf(marker);
    if (offset < 0) {
        throw new Error(`Marker not found: ${marker}`);
    }

    const prefix = source.slice(0, offset + marker.length);
    const lines = prefix.split('\n');
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
}

describe('LPCFunctionParser', () => {
    afterEach(() => {
        clearGlobalParsedDocumentService();
    });

    test('reads function info from syntax document facts', () => {
        const source = [
            '/**',
            ' * @brief 创建对象',
            ' */',
            'object *create_model(ref string name, int count) {',
            '    return ({});',
            '}',
            '',
            'void prototype_only();'
        ].join('\n');
        const document = createDocument('D:/workspace/room.c', source);

        const functions = LPCFunctionParser.parseAllFunctions(document, '当前文件');
        const cursorInfo = LPCFunctionParser.parseFunctionFromCursor(
            document,
            positionAfter(source, 'return')
        );

        expect(functions).toHaveLength(1);
        expect(functions[0]).toEqual(expect.objectContaining({
            name: 'create_model',
            definition: 'object *create_model(ref string name, int count)',
            returnType: 'object *',
            parameters: [
                { type: 'string', name: 'name' },
                { type: 'int', name: 'count' }
            ],
            comment: '/**\n * @brief 创建对象\n */',
            briefDescription: '创建对象',
            line: 3
        }));
        expect(functions[0].body).toContain('return ({})');
        expect(cursorInfo?.name).toBe('create_model');
    });
});
