import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { clearGlobalParsedDocumentService, getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { SemanticModelBuilder } from '../../semantic/SemanticModelBuilder';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import { SyntaxBuilder } from '../../syntax/SyntaxBuilder';
import type { SyntaxDocument, SyntaxNode } from '../../syntax/types';
import { SyntaxKind } from '../../syntax/types';
import { createPrimitiveType } from '../LpcType';
import { ExpressionCallableSignature, ExpressionTypeEvaluator } from '../ExpressionTypeEvaluator';
import { ScopeSymbolTypeResolver } from '../ScopeSymbolTypeResolver';

interface AnalysisFixture {
    syntax: SyntaxDocument;
    semantic: SemanticSnapshot;
}

function createDocument(content: string, fileName: string = '/virtual/type-expression.c'): vscode.TextDocument {
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

function findInitializer(syntax: SyntaxDocument, variableName: string): SyntaxNode {
    const declarator = syntax.nodes.find((node) =>
        node.kind === SyntaxKind.VariableDeclarator
        && node.name === variableName
    );
    const initializer = declarator?.children[1];
    if (!initializer) {
        throw new Error(`Missing initializer for ${variableName}`);
    }
    return initializer;
}

function toCallableSignatures(semantic: SemanticSnapshot): ExpressionCallableSignature[] {
    return semantic.exportedFunctions.map((summary) => ({
        name: summary.name,
        requiredParameterCount: summary.requiredParameterCount ?? summary.parameters.length,
        maxParameterCount: summary.maxParameterCount,
        isVariadic: summary.isVariadic === true,
        returnType: summary.returnType,
        parameters: summary.parameters.map((parameter) => ({
            dataType: parameter.dataType,
            optional: parameter.hasDefaultValue,
            variadic: parameter.isVariadic
        }))
    }));
}

function createEvaluator(semantic: SemanticSnapshot): ExpressionTypeEvaluator {
    const scopeResolver = new ScopeSymbolTypeResolver({ semantic });
    return new ExpressionTypeEvaluator({
        scopeResolver,
        callableSignatures: toCallableSignatures(semantic)
    });
}

describe('ExpressionTypeEvaluator', () => {
    afterEach(() => {
        clearGlobalParsedDocumentService();
    });

    test('infers literals, direct call returns, arrays, mappings, members, indexes, and new expressions', () => {
        const { syntax, semantic } = buildAnalysis([
            'class Payload {',
            '    string title;',
            '    int count;',
            '}',
            '',
            'int add(int a, int b) { return a + b; }',
            'string name() { return "ok"; }',
            '',
            'void demo(mixed dynamic, class Payload payload, string *names) {',
            '    int from_call = add(1, 2);',
            '    string from_return = name();',
            '    float numeric = 1 + 2.5;',
            '    string joined = "a" "b";',
            '    string *list = ({ "a", "b" });',
            '    mapping table = ([ "hp": 1, "mp": 2 ]);',
            '    string title = payload->title;',
            '    string first = names[0];',
            '    class Payload fresh = new(class Payload, title : "x");',
            '    object ob = new("/std/object");',
            '    mixed unknown = dynamic->query();',
            '}'
        ].join('\n'));
        const evaluator = createEvaluator(semantic);

        expect(evaluator.evaluate(findInitializer(syntax, 'from_call'))).toMatchObject({ name: 'int' });
        expect(evaluator.evaluate(findInitializer(syntax, 'from_return'))).toMatchObject({ name: 'string' });
        expect(evaluator.evaluate(findInitializer(syntax, 'numeric'))).toMatchObject({ name: 'float' });
        expect(evaluator.evaluate(findInitializer(syntax, 'joined'))).toMatchObject({ name: 'string' });
        expect(evaluator.evaluate(findInitializer(syntax, 'list'))).toMatchObject({
            kind: 'array',
            elementType: {
                name: 'string'
            }
        });
        expect(evaluator.evaluate(findInitializer(syntax, 'table'))).toMatchObject({
            kind: 'mapping',
            keyType: {
                name: 'string'
            },
            valueType: {
                name: 'int'
            }
        });
        expect(evaluator.evaluate(findInitializer(syntax, 'title'))).toMatchObject({ name: 'string' });
        expect(evaluator.evaluate(findInitializer(syntax, 'first'))).toMatchObject({ name: 'string' });
        expect(evaluator.evaluate(findInitializer(syntax, 'fresh'))).toMatchObject({
            kind: 'class',
            name: 'Payload'
        });
        expect(evaluator.evaluate(findInitializer(syntax, 'ob'))).toMatchObject({ name: 'object' });
        expect(evaluator.evaluate(findInitializer(syntax, 'unknown'))).toMatchObject({
            isUnknown: true
        });
    });

    test('uses optional narrowing lookup without introducing flow state', () => {
        const { syntax, semantic } = buildAnalysis([
            'void demo(mixed value) {',
            '    string narrowed = value;',
            '}'
        ].join('\n'));
        const scopeResolver = new ScopeSymbolTypeResolver({ semantic });
        const evaluator = new ExpressionTypeEvaluator({
            scopeResolver,
            narrowingLookup: {
                getNarrowedType(name) {
                    return name === 'value' ? createPrimitiveType('string') : undefined;
                }
            }
        });

        expect(evaluator.evaluate(findInitializer(syntax, 'narrowed'))).toMatchObject({
            kind: 'primitive',
            name: 'string'
        });
    });
});
