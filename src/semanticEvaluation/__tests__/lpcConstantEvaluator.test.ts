import * as vscode from 'vscode';
import { describe, expect, test } from '@jest/globals';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { ExpressionEvaluator } from '../static/ExpressionEvaluator';
import { LpcConstantEvaluator } from '../static/LpcConstantEvaluator';
import { createStaticEvaluationContext } from '../static/StaticEvaluationContext';
import { createStaticEvaluationState } from '../static/StaticEvaluationState';
import { literalValue, unknownValue } from '../valueFactories';

function createLiteralNode(text: string): SyntaxNode {
    return {
        kind: SyntaxKind.Literal,
        category: 'expression',
        range: new vscode.Range(0, 0, 0, 0),
        tokenRange: { start: 0, end: 0 },
        leadingTrivia: [],
        trailingTrivia: [],
        children: [],
        isMissing: false,
        isOpaque: false,
        metadata: { text }
    };
}

function createParenthesizedNode(child: SyntaxNode): SyntaxNode {
    return {
        kind: SyntaxKind.ParenthesizedExpression,
        category: 'expression',
        range: new vscode.Range(0, 0, 0, 0),
        tokenRange: { start: 0, end: 0 },
        leadingTrivia: [],
        trailingTrivia: [],
        children: [child],
        isMissing: false,
        isOpaque: false
    };
}

function createBinaryNode(operator: string, left: SyntaxNode, right: SyntaxNode): SyntaxNode {
    return {
        kind: SyntaxKind.BinaryExpression,
        category: 'expression',
        range: new vscode.Range(0, 0, 0, 0),
        tokenRange: { start: 0, end: 0 },
        leadingTrivia: [],
        trailingTrivia: [],
        children: [left, right],
        isMissing: false,
        isOpaque: false,
        metadata: { operator }
    };
}

describe('LpcConstantEvaluator', () => {
    test('delegates parenthesized expressions to the wrapped child', () => {
        const child = createLiteralNode('"login"');
        const evaluator = new LpcConstantEvaluator({
            evaluateExpression: (node) => node === child ? literalValue('login') : unknownValue()
        });

        expect(evaluator.evaluate(createParenthesizedNode(child), createStaticEvaluationState()))
            .toEqual(literalValue('login'));
    });

    test('folds literal equality into a boolean literal', () => {
        const left = createLiteralNode('"login"');
        const right = createLiteralNode('"login"');
        const evaluator = new LpcConstantEvaluator({
            evaluateExpression: (node) => {
                if (node === left || node === right) {
                    return literalValue('login');
                }

                return unknownValue();
            }
        });

        expect(evaluator.evaluate(createBinaryNode('==', left, right), createStaticEvaluationState()))
            .toEqual(literalValue(true, 'boolean'));
    });

    test('folds literal inequality into a boolean literal', () => {
        const left = createLiteralNode('"login"');
        const right = createLiteralNode('"logout"');
        const evaluator = new LpcConstantEvaluator({
            evaluateExpression: (node) => {
                if (node === left) {
                    return literalValue('login');
                }

                if (node === right) {
                    return literalValue('logout');
                }

                return unknownValue();
            }
        });

        expect(evaluator.evaluate(createBinaryNode('!=', left, right), createStaticEvaluationState()))
            .toEqual(literalValue(true, 'boolean'));
    });

    test('returns unknown for mixed literal and unknown operands', () => {
        const left = createLiteralNode('"login"');
        const right = createLiteralNode('alias');
        const evaluator = new LpcConstantEvaluator({
            evaluateExpression: (node) => {
                if (node === left) {
                    return literalValue('login');
                }

                if (node === right) {
                    return unknownValue();
                }

                return unknownValue();
            }
        });

        expect(evaluator.evaluate(createBinaryNode('===', left, right), createStaticEvaluationState()))
            .toEqual(unknownValue());
    });
});

describe('ExpressionEvaluator constant delegation', () => {
    const evaluator = new ExpressionEvaluator(
        createStaticEvaluationContext({
            metadata: {
                documentUri: '/virtual/constant-eval.c',
                functionName: 'demo',
                callDepth: 0
            }
        })
    );

    function evaluateBinary(operator: string, left: SyntaxNode, right: SyntaxNode) {
        return evaluator.evaluate(createBinaryNode(operator, left, right), createStaticEvaluationState());
    }

    test('evaluates parenthesized expressions through the facade', () => {
        const child = createLiteralNode('"delegated"');

        expect(evaluator.evaluate(createParenthesizedNode(child), createStaticEvaluationState()))
            .toEqual(literalValue('delegated'));
    });

    test('folds equality through the public facade', () => {
        expect(
            evaluateBinary('==', createLiteralNode('"login"'), createLiteralNode('"login"'))
        ).toEqual(literalValue(true, 'boolean'));
        expect(
            evaluateBinary('===', createLiteralNode('42'), createLiteralNode('42'))
        ).toEqual(literalValue(true, 'boolean'));
    });

    test('folds inequality through the public facade', () => {
        expect(
            evaluateBinary('!=', createLiteralNode('"login"'), createLiteralNode('"logout"'))
        ).toEqual(literalValue(true, 'boolean'));
        expect(
            evaluateBinary('!==', createLiteralNode('42'), createLiteralNode('7'))
        ).toEqual(literalValue(true, 'boolean'));
    });

    test('returns unknown for unsupported binary operators through the public facade', () => {
        expect(
            evaluateBinary('+', createLiteralNode('1'), createLiteralNode('2'))
        ).toEqual(unknownValue());
    });
});
