import * as vscode from 'vscode';
import { describe, expect, test } from '@jest/globals';
import { createStaticEvaluationContext } from '../static/StaticEvaluationContext';
import { createStaticEvaluationState } from '../static/StaticEvaluationState';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import {
    collectStaticStringSet,
    literalValueToArrayIndex,
    literalValueToStaticKey,
    LpcContainerShapeEvaluator
} from '../static/LpcContainerShapeEvaluator';
import { SyntaxKind, SyntaxNode, createSyntaxNode, createTokenRange } from '../../syntax/types';
import type { SemanticValue } from '../types';
import {
    arrayShapeValue,
    candidateSetValue,
    literalValue,
    mappingShapeValue,
    unionValue,
    unknownValue
} from '../valueFactories';

const TEST_RANGE = new vscode.Range(0, 0, 0, 0);

function makeNode(
    kind: SyntaxKind,
    children: readonly SyntaxNode[] = [],
    options: {
        name?: string;
        metadata?: Readonly<Record<string, unknown>>;
    } = {}
): SyntaxNode {
    return createSyntaxNode({
        kind,
        range: TEST_RANGE,
        tokenRange: createTokenRange(0, 0),
        children,
        name: options.name,
        metadata: options.metadata
    });
}

function makeLiteralNode(text: string): SyntaxNode {
    return makeNode(SyntaxKind.Literal, [], {
        metadata: { text }
    });
}

function parseLiteralNode(node: SyntaxNode): SemanticValue {
    const text = node.metadata?.text;
    if (typeof text !== 'string') {
        return unknownValue();
    }

    if (text.startsWith('"') && text.endsWith('"')) {
        return literalValue(text.slice(1, -1));
    }

    if (text.startsWith("'") && text.endsWith("'")) {
        return literalValue(text.slice(1, -1));
    }

    if (text === 'true' || text === 'false') {
        return literalValue(text === 'true', 'boolean');
    }

    if (/^-?\d+$/.test(text)) {
        return literalValue(Number.parseInt(text, 10), 'int');
    }

    if (/^-?\d+\.\d+$/.test(text)) {
        return literalValue(Number.parseFloat(text), 'float');
    }

    return unknownValue();
}

function makeEvaluator(overrides: Map<SyntaxNode, SemanticValue> = new Map()) {
    return new LpcContainerShapeEvaluator({
        evaluateExpression: (node) => {
            if (!node) {
                return unknownValue();
            }

            return overrides.get(node) ?? parseLiteralNode(node);
        }
    });
}

describe('LpcContainerShapeEvaluator', () => {
    test('literalValueToStaticKey converts static scalar literal values', () => {
        expect(literalValueToStaticKey(literalValue('login'))).toBe('login');
        expect(literalValueToStaticKey(literalValue(12))).toBe('12');
        expect(literalValueToStaticKey(literalValue(true, 'boolean'))).toBe('true');
        expect(literalValueToStaticKey(literalValue(null, 'null'))).toBe('null');
        expect(literalValueToStaticKey(unknownValue())).toBeUndefined();
    });

    test('literalValueToArrayIndex only accepts integer literal values', () => {
        expect(literalValueToArrayIndex(literalValue(3))).toBe(3);
        expect(literalValueToArrayIndex(literalValue(3.5, 'float'))).toBeUndefined();
        expect(literalValueToArrayIndex(literalValue('3'))).toBeUndefined();
    });

    test('collectStaticStringSet collects unions and candidate sets of static strings', () => {
        expect(
            collectStaticStringSet(
                unionValue([
                    literalValue('login'),
                    candidateSetValue([
                        literalValue('logout'),
                        literalValue('login')
                    ])
                ])
            )
        ).toEqual(['login', 'logout']);
    });

    test('builds a static mapping shape from literal keys and values', () => {
        const keyNode = makeLiteralNode('"path"');
        const valueNode = makeLiteralNode('"/adm/model/login"');
        const mappingNode = makeNode(SyntaxKind.MappingLiteralExpression, [
            makeNode(SyntaxKind.MappingEntry, [keyNode, valueNode])
        ]);

        const evaluator = makeEvaluator();
        expect(evaluator.evaluateMappingLiteral(mappingNode, createStaticEvaluationState())).toEqual(
            mappingShapeValue({
                path: literalValue('/adm/model/login')
            })
        );
    });

    test('returns unknown when a mapping entry key is not statically known', () => {
        const mappingNode = makeNode(SyntaxKind.MappingLiteralExpression, [
            makeNode(SyntaxKind.MappingEntry, [
                makeNode(SyntaxKind.Identifier, [], { name: 'dynamic_key' }),
                makeLiteralNode('"/adm/model/login"')
            ])
        ]);

        const evaluator = makeEvaluator();
        expect(evaluator.evaluateMappingLiteral(mappingNode, createStaticEvaluationState())).toEqual(
            unknownValue()
        );
    });

    test('looks up fixed mapping keys and candidate key sets', () => {
        const targetNode = makeNode(SyntaxKind.Identifier, [], { name: 'registry' });
        const indexNode = makeNode(SyntaxKind.Identifier, [], { name: 'lookup' });
        const evaluator = makeEvaluator(new Map([
            [targetNode, mappingShapeValue({
                path: literalValue('/adm/model/login'),
                mode: literalValue('load')
            })],
            [indexNode, candidateSetValue([
                literalValue('path'),
                literalValue('mode')
            ])]
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                makeNode(SyntaxKind.IndexExpression, [targetNode, indexNode]),
                createStaticEvaluationState()
            )
        ).toEqual(unionValue([
            literalValue('load'),
            literalValue('/adm/model/login')
        ]));
    });

    test('looks up union targets by a fixed mapping key', () => {
        const targetNode = makeNode(SyntaxKind.Identifier, [], { name: 'target' });
        const indexNode = makeLiteralNode('"path"');
        const evaluator = makeEvaluator(new Map([
            [targetNode, unionValue([
                mappingShapeValue({ path: literalValue('/adm/model/login') }),
                mappingShapeValue({ path: literalValue('/adm/model/logout') })
            ])]
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                makeNode(SyntaxKind.IndexExpression, [targetNode, indexNode]),
                createStaticEvaluationState()
            )
        ).toEqual(unionValue([
            literalValue('/adm/model/login'),
            literalValue('/adm/model/logout')
        ]));
    });

    test('builds an empty array shape for an empty literal and rejects spread elements', () => {
        const evaluator = makeEvaluator();

        expect(
            evaluator.evaluateArrayLiteral(
                makeNode(SyntaxKind.ArrayLiteralExpression, []),
                createStaticEvaluationState()
            )
        ).toEqual(arrayShapeValue([]));

        expect(
            evaluator.evaluateArrayLiteral(
                makeNode(SyntaxKind.ArrayLiteralExpression, [
                    makeNode(SyntaxKind.ExpressionList, [
                        makeNode(SyntaxKind.SpreadElement, [
                            makeLiteralNode('"ignored"')
                        ])
                    ])
                ]),
                createStaticEvaluationState()
            )
        ).toEqual(unknownValue());
    });

    test('looks up fixed numeric array indexes', () => {
        const targetNode = makeNode(SyntaxKind.Identifier, [], { name: 'items' });
        const indexNode = makeNode(SyntaxKind.Literal, [], {
            metadata: { text: '1' }
        });
        const evaluator = makeEvaluator(new Map([
            [targetNode, arrayShapeValue([
                literalValue('zero'),
                literalValue('one')
            ])]
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                makeNode(SyntaxKind.IndexExpression, [targetNode, indexNode]),
                createStaticEvaluationState()
            )
        ).toEqual(literalValue('one'));
    });

    test('returns unknown for non-static array indices', () => {
        const targetNode = makeNode(SyntaxKind.Identifier, [], { name: 'items' });
        const indexNode = makeNode(SyntaxKind.Identifier, [], { name: 'dynamic_index' });
        const evaluator = makeEvaluator(new Map([
            [targetNode, arrayShapeValue([
                literalValue('zero'),
                literalValue('one')
            ])]
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                makeNode(SyntaxKind.IndexExpression, [targetNode, indexNode]),
                createStaticEvaluationState()
            )
        ).toEqual(unknownValue());
    });
});

describe('ExpressionEvaluator delegation', () => {
    test('delegates mapping literal evaluation through the container helper', () => {
        const context = createStaticEvaluationContext({
            metadata: {
                documentUri: 'file:///virtual/demo.c',
                functionName: 'demo',
                callDepth: 0
            }
        });
        const evaluator = new ExpressionEvaluator(context);
        const mappingNode = makeNode(SyntaxKind.MappingLiteralExpression, [
            makeNode(SyntaxKind.MappingEntry, [
                makeLiteralNode('"path"'),
                makeLiteralNode('"/adm/model/login"')
            ])
        ]);

        expect(evaluator.evaluate(mappingNode, createStaticEvaluationState())).toEqual(
            mappingShapeValue({
                path: literalValue('/adm/model/login')
            })
        );
    });
});
