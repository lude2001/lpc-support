import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { DefaultLanguageSemanticTokensService } from '../LanguageSemanticTokensService';

describe('DefaultLanguageSemanticTokensService', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
    });

    test('maps string tokens back to source positions after object-like macro expansion', async () => {
        const source = [
            '#define NOR "normal-color"',
            'void demo() {',
            '    string message = "before" NOR "after";',
            '}'
        ].join('\n');
        const document = createDocument('/virtual/macro-string-highlight.c', source);
        const service = new DefaultLanguageSemanticTokensService(DocumentSemanticSnapshotService.getInstance());

        const result = await service.provideSemanticTokens({
            context: {
                document,
                workspace: { workspaceRoot: '/virtual' },
                mode: 'lsp',
                cancellation: { isCancellationRequested: false }
            }
        });

        expect(result.tokens).toContainEqual(expect.objectContaining({
            line: 2,
            startCharacter: sourceLine(source, 2).indexOf('"before"'),
            length: '"before"'.length,
            tokenType: 'string'
        }));
        expect(result.tokens).toContainEqual(expect.objectContaining({
            line: 2,
            startCharacter: sourceLine(source, 2).indexOf('"after"'),
            length: '"after"'.length,
            tokenType: 'string'
        }));
        expect(result.tokens).toContainEqual(expect.objectContaining({
            line: 2,
            startCharacter: sourceLine(source, 2).indexOf('NOR'),
            length: 'NOR'.length,
            tokenType: 'macro'
        }));
    });
});

function createDocument(filePath: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = buildLineStarts(content);
    const uri = vscode.Uri.file(filePath);

    const offsetAt = (position: vscode.Position): number =>
        (lineStarts[position.line] ?? content.length) + position.character;

    return {
        uri,
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isClosed: false,
        isDirty: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        save: jest.fn(),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position),
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
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
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position))
    } as unknown as vscode.TextDocument;
}

function buildLineStarts(text: string): number[] {
    const starts = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            starts.push(index + 1);
        }
    }
    return starts;
}

function sourceLine(source: string, line: number): string {
    return source.split(/\r?\n/)[line] ?? '';
}
