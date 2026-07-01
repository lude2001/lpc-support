import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { SemanticModelBuilder } from '../../semantic/SemanticModelBuilder';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import type { SyntaxDocument, SyntaxNode } from '../../syntax/types';
import { SyntaxKind } from '../../syntax/types';
import { ScopeSymbolTypeResolver } from '../ScopeSymbolTypeResolver';

interface AnalysisFixture {
    syntax: SyntaxDocument;
    semantic: SemanticSnapshot;
}

function createDocument(content: string, fileName: string = '/virtual/type-scope.c'): vscode.TextDocument {
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
        version: 1,
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
            return { text: content.slice(start, end) };
        })
    } as unknown as vscode.TextDocument;
}

function buildAnalysis(source: string): AnalysisFixture {
    const parsed = getGlobalParsedDocumentService().get(createDocument(source));
    const syntax = new SyntaxBuilder(parsed).build();
    const semantic = new SemanticModelBuilder().build(syntax);
    return { syntax, semantic };
}

function findIdentifier(syntax: SyntaxDocument, name: string, line: number): SyntaxNode {
    const node = syntax.nodes.find((candidate) =>
        candidate.kind === SyntaxKind.Identifier
        && candidate.name === name
        && candidate.range.start.line === line
    );

    if (!node) {
        throw new Error(`Missing identifier ${name} on line ${line}`);
    }
    return node;
}

describe('ScopeSymbolTypeResolver', () => {
    afterEach(() => {
        clearGlobalParsedDocumentService();
    });

    test('resolves local and parameter types without seeing later declarations in the same block', () => {
        const { syntax, semantic } = buildAnalysis([
            'string shadow;',
            'void demo(string param) {',
            '    param;',
            '    shadow;',
            '    int shadow;',
            '    shadow;',
            '}'
        ].join('\n'));
        const resolver = new ScopeSymbolTypeResolver({ semantic });

        expect(resolver.resolveIdentifierType('param', findIdentifier(syntax, 'param', 2).range.start)).toMatchObject({
            kind: 'primitive',
            name: 'string'
        });
        expect(resolver.resolveIdentifierType('shadow', findIdentifier(syntax, 'shadow', 3).range.start)).toMatchObject({
            kind: 'primitive',
            name: 'string'
        });
        expect(resolver.resolveIdentifierType('shadow', findIdentifier(syntax, 'shadow', 5).range.start)).toMatchObject({
            kind: 'primitive',
            name: 'int'
        });
    });

    test('uses visible file globals and resolves class members through semantic type definitions', () => {
        const { semantic } = buildAnalysis([
            'class Payload {',
            '    string title;',
            '}',
            'void demo() {',
            '    shared;',
            '}'
        ].join('\n'));
        const resolver = new ScopeSymbolTypeResolver({
            semantic,
            visibleTypeDefinitions: semantic.typeDefinitions,
            visibleFileGlobals: [{
                name: 'shared',
                dataType: 'object',
                sourceUri: 'file:///include/shared.h',
                range: new vscode.Range(0, 0, 0, 0)
            }]
        });

        expect(resolver.resolveIdentifierType('shared', { line: 4, character: 4 })).toMatchObject({
            kind: 'primitive',
            name: 'object'
        });
        expect(resolver.parseType('Payload')).toMatchObject({
            kind: 'class',
            name: 'Payload'
        });
        expect(resolver.resolveMemberType(resolver.parseType('Payload'), 'title')).toMatchObject({
            kind: 'primitive',
            name: 'string'
        });
    });
});
