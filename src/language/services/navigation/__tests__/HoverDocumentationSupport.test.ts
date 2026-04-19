import { describe, expect, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';

declare const require: any;

function createCompleteDocument(filePath: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
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

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({ text: lines[line] ?? '' }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

function loadSupport(): any {
    return require('../hover/HoverDocumentationSupport');
}

describe('HoverDocumentationSupport', () => {
    test('complete resolved documents pass through without synthetic shim rebuilding', () => {
        const { toDocumentationTextDocument } = loadSupport();
        const document = createCompleteDocument(
            path.join(process.cwd(), '.tmp-hover-doc-support', 'base_room.c'),
            'void create() {}\n',
            7
        );

        const resolved = toDocumentationTextDocument({
            path: document.fileName,
            documentText: document.getText(),
            document
        });

        expect(resolved).toBe(document);
    });

    test('partial resolved documents get a stable synthetic TextDocument', () => {
        const { toDocumentationTextDocument } = loadSupport();
        const filePath = path.join(process.cwd(), '.tmp-hover-doc-support', 'room.c');

        const resolved = toDocumentationTextDocument({
            path: filePath,
            documentText: 'string query_name() {\r\n    return "room";\r\n}\r\n',
            document: {
                getText: () => 'string query_name() {\r\n    return "room";\r\n}\r\n',
                languageId: 'lpc',
                version: 11
            }
        });

        expect(resolved.fileName).toBe(filePath);
        expect(resolved.languageId).toBe('lpc');
        expect(resolved.version).toBe(11);
        expect(resolved.getText()).toBe('string query_name() {\n    return "room";\n}\n');
        expect(resolved.lineCount).toBe(4);
        expect(resolved.positionAt(22)).toEqual(expect.objectContaining({ line: 1 }));
        expect(resolved.offsetAt(new vscode.Position(1, 4))).toBe(26);
    });

    test('synthetic documentation uris stay deterministic for the same content', () => {
        const { toDocumentationTextDocument } = loadSupport();
        const filePath = path.join(process.cwd(), '.tmp-hover-doc-support', 'npc.c');
        const partial = {
            getText: () => 'string query_name() {\n    return "npc";\n}\n'
        };

        const first = toDocumentationTextDocument({
            path: filePath,
            documentText: partial.getText(),
            document: partial
        });
        const second = toDocumentationTextDocument({
            path: filePath,
            documentText: partial.getText(),
            document: partial
        });

        expect(first.uri.toString()).toBe(second.uri.toString());
        expect(first.getText()).toBe(second.getText());
    });
});
