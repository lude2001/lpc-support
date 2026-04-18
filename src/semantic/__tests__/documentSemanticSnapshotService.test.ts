import * as vscode from 'vscode';
import { afterEach, describe, expect, test } from '@jest/globals';
import { clearGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { DocumentAnalysisService } from '../documentAnalysisService';
import { DocumentSemanticSnapshotService } from '../documentSemanticSnapshotService';

function createDocument(
    content: string,
    fileName: string = '/virtual/document-analysis-service.c',
    version: number = 1
): vscode.TextDocument {
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

describe('DocumentSemanticSnapshotService', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
        clearGlobalParsedDocumentService();
    });

    test('implements the unified document analysis interface from the semantic owner layer', () => {
        const service: DocumentAnalysisService = DocumentSemanticSnapshotService.getInstance();
        const document = createDocument('int demo() { return 1; }');
        const snapshot = service.getSnapshot(document, false);

        expect(snapshot.version).toBe(1);
        expect(snapshot.exportedFunctions.map((item) => item.name)).toEqual(['demo']);
        expect(service.getBestAvailableSemanticSnapshot(document).exportedFunctions.map((item) => item.name)).toEqual(['demo']);
    });
});
