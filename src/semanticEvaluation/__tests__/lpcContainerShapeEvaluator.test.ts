import * as vscode from 'vscode';
import { describe, expect, test } from '@jest/globals';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import {
    collectStaticStringSet,
    LpcContainerShapeEvaluator
} from '../static/LpcContainerShapeEvaluator';
import { evaluateLpcLiteralNode } from '../static/LpcLiteralEvaluator';
import { createStaticEvaluationContext } from '../static/StaticEvaluationContext';
import {
    createStaticEvaluationState,
    createValueEnvironment,
    getEnvironmentValue
} from '../static/StaticEvaluationState';
import {
    arrayShapeValue,
    candidateSetValue,
    configuredCandidateSetValue,
    literalValue,
    mappingShapeValue,
    unknownValue,
    unionValue
} from '../valueFactories';

function createNode(
    kind: SyntaxKind,
    children: SyntaxNode[] = [],
    metadata?: Readonly<Record<string, unknown>>,
    name?: string
): SyntaxNode {
    return {
        kind,
        category: 'expression',
        range: new vscode.Range(0, 0, 0, 0),
        tokenRange: { start: 0, end: 0 },
        leadingTrivia: [],
        trailingTrivia: [],
        children,
        isMissing: false,
        isOpaque: false,
        metadata,
        name
    };
}

function createIdentifierNode(name: string): SyntaxNode {
    return createNode(SyntaxKind.Identifier, [], { name }, name);
}

function createExpressionListNode(children: SyntaxNode[]): SyntaxNode {
    return createNode(SyntaxKind.ExpressionList, children);
}

function createMappingEntryNode(key: SyntaxNode, value: SyntaxNode): SyntaxNode {
    return createNode(SyntaxKind.MappingEntry, [key, value]);
}

function createMappingLiteralNode(entries: SyntaxNode[]): SyntaxNode {
    return createNode(SyntaxKind.MappingLiteralExpression, entries);
}

function createArrayLiteralNode(elements: SyntaxNode[]): SyntaxNode {
    return createNode(SyntaxKind.ArrayLiteralExpression, [
        createExpressionListNode(elements)
    ]);
}

function createSpreadElementNode(expression: SyntaxNode): SyntaxNode {
    return createNode(SyntaxKind.SpreadElement, [expression]);
}

function createIndexExpressionNode(target: SyntaxNode, index: SyntaxNode): SyntaxNode {
    return createNode(SyntaxKind.IndexExpression, [target, index]);
}

function createContainerEvaluator() {
    let evaluator: LpcContainerShapeEvaluator;

    evaluator = new LpcContainerShapeEvaluator({
        evaluateExpression: (node, state) => {
            if (!node) {
                return unknownValue();
            }

            if (node.kind === SyntaxKind.Literal) {
                return evaluateLpcLiteralNode(node);
            }

            if (node.kind === SyntaxKind.Identifier) {
                return getEnvironmentValue(state.environment, node.name ?? '') ?? unknownValue();
            }

            if (node.kind === SyntaxKind.MappingLiteralExpression) {
                return evaluator.evaluateMappingLiteral(node, state);
            }

            if (node.kind === SyntaxKind.ArrayLiteralExpression) {
                return evaluator.evaluateArrayLiteral(node, state);
            }

            if (node.kind === SyntaxKind.IndexExpression) {
                return evaluator.evaluateIndexExpression(node, state);
            }

            return unknownValue();
        }
    });

    return evaluator;
}

describe('LpcContainerShapeEvaluator', () => {
    test('collects static string sets from unions and candidate sets', () => {
        expect(collectStaticStringSet(unionValue([
            literalValue('path'),
            literalValue('mode')
        ]))).toEqual(['mode', 'path']);

        expect(collectStaticStringSet(candidateSetValue([
            literalValue('login'),
            literalValue('logout')
        ]))).toEqual(['login', 'logout']);

        expect(collectStaticStringSet(configuredCandidateSetValue(
            'provider-a',
            [
                literalValue('login'),
                literalValue('logout')
            ]
        ))).toEqual(['login', 'logout']);
    });

    test('builds static mapping shapes from mapping literals', () => {
        const evaluator = createContainerEvaluator();

        const result = evaluator.evaluateMappingLiteral(
            createMappingLiteralNode([
                createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"path"' }), createNode(SyntaxKind.Literal, [], { text: '"/adm/model/login"' })),
                createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"mode"' }), createNode(SyntaxKind.Literal, [], { text: '"load"' }))
            ]),
            createStaticEvaluationState()
        );

        expect(result).toEqual(mappingShapeValue({
            path: literalValue('/adm/model/login'),
            mode: literalValue('load')
        }));
    });

    test('returns unknown for mapping entries without a static key', () => {
        const evaluator = createContainerEvaluator();

        const result = evaluator.evaluateMappingLiteral(
            createMappingLiteralNode([
                createMappingEntryNode(createIdentifierNode('path'), createNode(SyntaxKind.Literal, [], { text: '"/adm/model/login"' }))
            ]),
            createStaticEvaluationState()
        );

        expect(result).toEqual(unknownValue());
    });

    test('looks up fixed mapping keys and union key sets', () => {
        const evaluator = createContainerEvaluator();

        const mappingValue = evaluator.evaluateMappingLiteral(
            createMappingLiteralNode([
                createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"path"' }), createNode(SyntaxKind.Literal, [], { text: '"/adm/model/login"' })),
                createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"mode"' }), createNode(SyntaxKind.Literal, [], { text: '"load"' }))
            ]),
            createStaticEvaluationState()
        );

        expect(
            evaluator.evaluateIndexExpression(
                createIndexExpressionNode(
                    createMappingLiteralNode([
                        createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"path"' }), createNode(SyntaxKind.Literal, [], { text: '"/adm/model/login"' })),
                        createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"mode"' }), createNode(SyntaxKind.Literal, [], { text: '"load"' }))
                    ]),
                    createNode(SyntaxKind.Literal, [], { text: '"path"' })
                ),
                createStaticEvaluationState()
            )
        ).toEqual(literalValue('/adm/model/login'));

        expect(
            evaluator.evaluateIndexExpression(
                createIndexExpressionNode(
                    createIdentifierNode('mappingValue'),
                    createIdentifierNode('keySet')
                ),
                createStaticEvaluationState({
                    environment: createValueEnvironment({
                        mappingValue,
                        keySet: unionValue([literalValue('path'), literalValue('mode')])
                    })
                })
            )
        ).toEqual(unionValue([
            literalValue('load'),
            literalValue('/adm/model/login')
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                createIndexExpressionNode(
                    createIdentifierNode('mappingValue'),
                    createIdentifierNode('candidateKeys')
                ),
                createStaticEvaluationState({
                    environment: createValueEnvironment({
                        mappingValue,
                        candidateKeys: candidateSetValue([
                            literalValue('path'),
                            literalValue('mode')
                        ])
                    })
                })
            )
        ).toEqual(unionValue([
            literalValue('load'),
            literalValue('/adm/model/login')
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                createIndexExpressionNode(
                    createIdentifierNode('mappingValue'),
                    createIdentifierNode('configuredKeys')
                ),
                createStaticEvaluationState({
                    environment: createValueEnvironment({
                        mappingValue,
                        configuredKeys: configuredCandidateSetValue('provider-a', [
                            literalValue('path'),
                            literalValue('mode')
                        ])
                    })
                })
            )
        ).toEqual(unionValue([
            literalValue('load'),
            literalValue('/adm/model/login')
        ]));
    });

    test('returns unknown for missing mapping keys, array spreads, and non-integer indexes', () => {
        const evaluator = createContainerEvaluator();

        expect(
            evaluator.evaluateIndexExpression(
                createIndexExpressionNode(
                    createMappingLiteralNode([
                        createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"path"' }), createNode(SyntaxKind.Literal, [], { text: '"/adm/model/login"' }))
                    ]),
                    createNode(SyntaxKind.Literal, [], { text: '"mode"' })
                ),
                createStaticEvaluationState()
            )
        ).toEqual(unknownValue());

        expect(
            evaluator.evaluateArrayLiteral(
                createArrayLiteralNode([
                    createNode(SyntaxKind.Literal, [], { text: '"alpha"' }),
                    createNode(SyntaxKind.Literal, [], { text: '"beta"' })
                ]),
                createStaticEvaluationState()
            )
        ).toEqual(arrayShapeValue([
            literalValue('alpha'),
            literalValue('beta')
        ]));

        expect(
            evaluator.evaluateIndexExpression(
                createIndexExpressionNode(
                    createArrayLiteralNode([
                        createNode(SyntaxKind.Literal, [], { text: '"alpha"' }),
                        createNode(SyntaxKind.Literal, [], { text: '"beta"' })
                    ]),
                    createNode(SyntaxKind.Literal, [], { text: '1' })
                ),
                createStaticEvaluationState()
            )
        ).toEqual(literalValue('beta'));

        expect(
            evaluator.evaluateArrayLiteral(
                createNode(SyntaxKind.ArrayLiteralExpression, [
                    createExpressionListNode([
                        createSpreadElementNode(createNode(SyntaxKind.Literal, [], { text: '"alpha"' }))
                    ])
                ]),
                createStaticEvaluationState()
            )
        ).toEqual(unknownValue());
    });

    test('delegates container evaluation through ExpressionEvaluator', () => {
        const evaluator = new ExpressionEvaluator(
            createStaticEvaluationContext({
                metadata: {
                    documentUri: '/virtual/container-eval.c',
                    functionName: 'demo',
                    callDepth: 0
                }
            })
        );

        const result = evaluator.evaluate(
            createIndexExpressionNode(
                createNode(SyntaxKind.MappingLiteralExpression, [
                    createMappingEntryNode(createNode(SyntaxKind.Literal, [], { text: '"path"' }), createNode(SyntaxKind.Literal, [], { text: '"/adm/model/login"' }))
                ]),
                createNode(SyntaxKind.Literal, [], { text: '"path"' })
            ),
            createStaticEvaluationState()
        );

        expect(result).toEqual(literalValue('/adm/model/login'));
    });

    test('indexes mappings through configured candidate sets via ExpressionEvaluator', () => {
        const evaluator = new ExpressionEvaluator(
            createStaticEvaluationContext({
                metadata: {
                    documentUri: '/virtual/container-eval.c',
                    functionName: 'demo',
                    callDepth: 0
                }
            })
        );

        const result = evaluator.evaluate(
            createIndexExpressionNode(
                createIdentifierNode('mappingValue'),
                createIdentifierNode('candidateKeys')
            ),
            createStaticEvaluationState({
                environment: createValueEnvironment({
                    mappingValue: mappingShapeValue({
                        left: literalValue('left-value'),
                        right: literalValue('right-value')
                    }),
                    candidateKeys: configuredCandidateSetValue('test', [
                        literalValue('left'),
                        literalValue('right')
                    ])
                })
            })
        );

        expect(result).toEqual(unionValue([
            literalValue('left-value'),
            literalValue('right-value')
        ]));
    });
});
