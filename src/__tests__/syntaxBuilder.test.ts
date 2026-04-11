import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { SyntaxKind } from '../syntax/types';
import { DocumentSemanticSnapshotService } from '../completion/documentSemanticSnapshotService';

function createDocument(content: string, fileName: string = '/virtual/syntax.c', version: number = 1): vscode.TextDocument {
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

describe('SyntaxBuilder', () => {
    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        DocumentSemanticSnapshotService.getInstance().clear();
        clearGlobalParsedDocumentService();
    });

    test('builds structured syntax nodes for declarations, control flow, and expressions', () => {
        const source = [
            'inherit "/std/object";',
            '',
            'int compute(int value) {',
            '    for (int i = 0; i < value; i++) {',
            '        if (value > i) {',
            '            return items[i] + foo->bar(value);',
            '        }',
            '    }',
            '    return value;',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
        const kinds = syntaxDocument.nodes.map((node) => node.kind);

        expect(syntaxDocument.root.children.map((node) => node.kind)).toEqual([
            SyntaxKind.InheritDirective,
            SyntaxKind.FunctionDeclaration
        ]);
        expect(kinds).toContain(SyntaxKind.ForStatement);
        expect(kinds).toContain(SyntaxKind.IfStatement);
        expect(kinds).toContain(SyntaxKind.ReturnStatement);
        expect(kinds).toContain(SyntaxKind.BinaryExpression);
        expect(kinds).toContain(SyntaxKind.IndexExpression);
        expect(kinds).toContain(SyntaxKind.MemberAccessExpression);
        expect(kinds).toContain(SyntaxKind.CallExpression);
        expect(syntaxDocument.metadata.opaqueNodeCount).toBe(0);
    });

    test('tracks repeated identifiers with distinct token-backed ranges', () => {
        const source = [
            'int compute(int alpha) {',
            '    return alpha + alpha;',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/repeated.c');
        const syntaxDocument = ASTManager.getInstance().parseDocument(document, false).syntax!;
        const alphaNodes = syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.Identifier && node.name === 'alpha');

        expect(alphaNodes).toHaveLength(3);
        expect(alphaNodes[0].range.start.line).toBe(0);
        expect(alphaNodes[1].range.start.line).toBe(1);
        expect(alphaNodes[2].range.start.line).toBe(1);
        expect(alphaNodes[1].range.start.character).toBeLessThan(alphaNodes[2].range.start.character);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
