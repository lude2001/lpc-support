import * as vscode from 'vscode';
import { describe, expect, test } from '@jest/globals';
import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { literalValue, unknownValue } from '../valueFactories';
import {
    evaluateLpcLiteralNode,
    getMetadataText
} from '../static/LpcLiteralEvaluator';

function createLiteralNode(text?: string): SyntaxNode {
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
        metadata: text === undefined ? undefined : { text }
    };
}

describe('LpcLiteralEvaluator', () => {
    test('reads metadata text when present', () => {
        expect(getMetadataText(createLiteralNode('"login"'))).toBe('"login"');
        expect(getMetadataText(createLiteralNode())).toBeUndefined();
    });

    test('evaluates supported literal texts without changing value shapes', () => {
        expect(evaluateLpcLiteralNode(createLiteralNode('"login"'))).toEqual(literalValue('login'));
        expect(evaluateLpcLiteralNode(createLiteralNode("'x'"))).toEqual(literalValue('x'));
        expect(evaluateLpcLiteralNode(createLiteralNode('true'))).toEqual(literalValue(true, 'boolean'));
        expect(evaluateLpcLiteralNode(createLiteralNode('false'))).toEqual(literalValue(false, 'boolean'));
        expect(evaluateLpcLiteralNode(createLiteralNode('42'))).toEqual(literalValue(42, 'int'));
        expect(evaluateLpcLiteralNode(createLiteralNode('-42'))).toEqual(literalValue(-42, 'int'));
        expect(evaluateLpcLiteralNode(createLiteralNode('3.14'))).toEqual(literalValue(3.14, 'float'));
        expect(evaluateLpcLiteralNode(createLiteralNode('-3.14'))).toEqual(literalValue(-3.14, 'float'));
    });

    test('downgrades unsupported or missing literal text to unknown', () => {
        expect(evaluateLpcLiteralNode(createLiteralNode('login'))).toEqual(unknownValue());
        expect(evaluateLpcLiteralNode(createLiteralNode())).toEqual(unknownValue());
    });
});
