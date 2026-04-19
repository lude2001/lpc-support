import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import { SyntaxBuilder } from '../syntax/SyntaxBuilder';
import { SyntaxKind } from '../syntax/types';
import {
    configureAstManagerSingletonForTests,
    getAstManagerForTests,
    resetAstManagerSingletonForTests
} from './testAstManagerSingleton';

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

function buildSyntaxDocument(document: vscode.TextDocument): any {
    return getAstManagerForTests().parseDocument(document, false).syntax!;
}

function getFunctionDeclarations(syntaxDocument: any): any[] {
    return syntaxDocument.root.children.filter((node: any) => node.kind === SyntaxKind.FunctionDeclaration);
}

describe('SyntaxBuilder', () => {
    beforeEach(() => {
        configureAstManagerSingletonForTests();
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
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
        const syntaxDocument = getAstManagerForTests().parseDocument(document, false).syntax!;
        const alphaNodes = syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.Identifier && node.name === 'alpha');

        expect(alphaNodes).toHaveLength(3);
        expect(alphaNodes[0].range.start.line).toBe(0);
        expect(alphaNodes[1].range.start.line).toBe(1);
        expect(alphaNodes[2].range.start.line).toBe(1);
        expect(alphaNodes[1].range.start.character).toBeLessThan(alphaNodes[2].range.start.character);
    });

    test('falls back to an opaque scope identifier node for malformed scoped syntax', () => {
        const source = [
            'void demo() {',
            '    ::;',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/malformed-scope.c');
        const syntaxDocument = new SyntaxBuilder(getGlobalParsedDocumentService().get(document)).build();
        const opaqueNodes = syntaxDocument.nodes.filter((node) => node.kind === SyntaxKind.OpaqueExpression);

        expect(opaqueNodes.length).toBeGreaterThan(0);
        expect(opaqueNodes.some((node) => node.metadata?.reason === 'scope-identifier-fallback')).toBe(true);
    });

    test('attaches Javadoc blocks directly above modifiers', () => {
        const source = [
            '/**',
            ' * @brief direct binding',
            ' */',
            'public nomask int direct_case() {',
            '    return 1;',
            '}'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/direct-binding.c'));
        const [functionNode] = getFunctionDeclarations(syntaxDocument);
        const attachedDocComment = functionNode.attachedDocComment;

        expect(attachedDocComment).toBeDefined();
        expect(attachedDocComment.kind).toBe('javadoc');
        expect(attachedDocComment.text).toBe('/**\n * @brief direct binding\n */');
        expect(attachedDocComment.range.start).toEqual({ line: 0, character: 0 });
        expect(attachedDocComment.range.end).toEqual({ line: 2, character: 3 });
    });

    test('attaches Javadoc blocks across exactly one blank line', () => {
        const source = [
            '/**',
            ' * @brief blank line binding',
            ' */',
            '',
            'private int blank_line_case() {',
            '    return 1;',
            '}'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/blank-line-binding.c'));
        const [functionNode] = getFunctionDeclarations(syntaxDocument);
        const attachedDocComment = functionNode.attachedDocComment;

        expect(attachedDocComment).toBeDefined();
        expect(attachedDocComment.kind).toBe('javadoc');
        expect(attachedDocComment.text).toBe('/**\n * @brief blank line binding\n */');
        expect(attachedDocComment.range.start).toEqual({ line: 0, character: 0 });
        expect(attachedDocComment.range.end).toEqual({ line: 2, character: 3 });
    });

    test('does not attach Javadoc blocks across preprocessor directives', () => {
        const source = [
            '/**',
            ' * @brief directive gap',
            ' */',
            '#define FOO 1',
            'int directive_gap_case() {',
            '    return 1;',
            '}'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/directive-gap.c'));
        const [functionNode] = getFunctionDeclarations(syntaxDocument);

        expect(functionNode.attachedDocComment).toBeUndefined();
    });

    test('does not attach Javadoc blocks across two blank lines', () => {
        const source = [
            '/**',
            ' * @brief too far',
            ' */',
            '',
            '',
            'int too_far_case() {',
            '    return 1;',
            '}'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/two-blank-lines.c'));
        const [functionNode] = getFunctionDeclarations(syntaxDocument);

        expect(functionNode.attachedDocComment).toBeUndefined();
    });

    test('prefers the nearest Javadoc block when multiple blocks precede one declaration', () => {
        const source = [
            '/**',
            ' * @brief older block',
            ' */',
            '/**',
            ' * @brief newer block',
            ' */',
            'public int nearest_block_case() {',
            '    return 1;',
            '}'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/nearest-block.c'));
        const [functionNode] = getFunctionDeclarations(syntaxDocument);
        const attachedDocComment = functionNode.attachedDocComment;

        expect(attachedDocComment).toBeDefined();
        expect(attachedDocComment.text).toBe('/**\n * @brief newer block\n */');
    });

    test('binds a Javadoc block only to the first following declaration', () => {
        const source = [
            '/**',
            ' * @brief one-shot block',
            ' */',
            'int first_attached() {',
            '    return 1;',
            '}',
            'int second_unattached() {',
            '    return 2;',
            '}'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/one-shot-block.c'));
        const [firstFunction, secondFunction] = getFunctionDeclarations(syntaxDocument);

        expect(firstFunction.attachedDocComment).toBeDefined();
        expect(firstFunction.attachedDocComment.text).toBe('/**\n * @brief one-shot block\n */');
        expect(secondFunction.attachedDocComment).toBeUndefined();
    });

    test('attaches Javadoc blocks to prototype declarations as well', () => {
        const source = [
            '/**',
            ' * @brief prototype binding',
            ' */',
            'public int prototype_case(int value);'
        ].join('\n');
        const syntaxDocument = buildSyntaxDocument(createDocument(source, '/virtual/prototype-binding.c'));
        const [functionNode] = getFunctionDeclarations(syntaxDocument);
        const attachedDocComment = functionNode.attachedDocComment;

        expect(attachedDocComment).toBeDefined();
        expect(attachedDocComment.kind).toBe('javadoc');
        expect(attachedDocComment.text).toBe('/**\n * @brief prototype binding\n */');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
