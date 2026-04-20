import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import {
    arrayShapeValue,
    literalValue,
    mappingShapeValue,
    objectValue,
    unknownValue
} from '../valueFactories';
import { joinSemanticValues } from '../valueJoin';
import type { StaticEvaluationContext } from './StaticEvaluationContext';
import {
    getEnvironmentValue,
    type StaticEvaluationState
} from './StaticEvaluationState';

function getMetadataText(node: SyntaxNode): string | undefined {
    const text = node.metadata?.text;
    return typeof text === 'string' ? text : undefined;
}

function parseLiteralNode(node: SyntaxNode): SemanticValue {
    const text = getMetadataText(node);
    if (!text) {
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

function literalValueToStaticKey(value: SemanticValue): string | undefined {
    if (value.kind !== 'literal') {
        return undefined;
    }

    if (typeof value.value === 'string') {
        return value.value;
    }

    if (typeof value.value === 'number' || typeof value.value === 'boolean') {
        return String(value.value);
    }

    if (value.value === null) {
        return 'null';
    }

    return undefined;
}

function literalValueToArrayIndex(value: SemanticValue): number | undefined {
    if (value.kind !== 'literal' || typeof value.value !== 'number' || !Number.isInteger(value.value)) {
        return undefined;
    }

    return value.value;
}

function isDefinitelyTruthy(value: SemanticValue): boolean | undefined {
    if (value.kind !== 'literal') {
        return undefined;
    }

    if (typeof value.value === 'boolean') {
        return value.value;
    }

    if (typeof value.value === 'number') {
        return value.value !== 0;
    }

    if (value.value === null) {
        return false;
    }

    if (typeof value.value === 'string') {
        return value.value.length > 0;
    }

    return undefined;
}

export class ExpressionEvaluator {
    public constructor(private readonly context: StaticEvaluationContext) {}

    public evaluate(node: SyntaxNode | undefined, state: StaticEvaluationState): SemanticValue {
        if (!node) {
            return unknownValue();
        }

        switch (node.kind) {
            case SyntaxKind.Literal:
                return parseLiteralNode(node);
            case SyntaxKind.Identifier:
                return getEnvironmentValue(state.environment, node.name ?? '') ?? unknownValue();
            case SyntaxKind.ParenthesizedExpression:
                return this.evaluate(node.children[0], state);
            case SyntaxKind.MappingLiteralExpression:
                return this.evaluateMappingLiteral(node, state);
            case SyntaxKind.ArrayLiteralExpression:
                return this.evaluateArrayLiteral(node, state);
            case SyntaxKind.IndexExpression:
                return this.evaluateIndexExpression(node, state);
            case SyntaxKind.ConditionalExpression:
                return this.evaluateConditionalExpression(node, state);
            case SyntaxKind.NewExpression:
                return this.evaluateNewExpression(node, state);
            case SyntaxKind.CallExpression:
                return this.evaluateCallExpression(node, state);
            default:
                return unknownValue();
        }
    }

    private evaluateMappingLiteral(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const entries: Record<string, SemanticValue> = {};

        for (const entryNode of node.children) {
            if (entryNode.kind !== SyntaxKind.MappingEntry || entryNode.children.length < 2) {
                return unknownValue();
            }

            const keyValue = this.evaluate(entryNode.children[0], state);
            const entryKey = literalValueToStaticKey(keyValue);
            if (entryKey === undefined) {
                return unknownValue();
            }

            entries[entryKey] = this.evaluate(entryNode.children[1], state);
        }

        return mappingShapeValue(entries);
    }

    private evaluateArrayLiteral(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const expressionList = node.children[0];
        if (!expressionList) {
            return arrayShapeValue([]);
        }

        const elements: SemanticValue[] = [];
        for (const child of expressionList.children) {
            if (child.kind === SyntaxKind.SpreadElement) {
                return unknownValue();
            }

            elements.push(this.evaluate(child, state));
        }

        return arrayShapeValue(elements);
    }

    private evaluateIndexExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const target = this.evaluate(node.children[0], state);
        const index = this.evaluate(node.children[1], state);

        if (target.kind === 'mapping-shape') {
            const entryKey = literalValueToStaticKey(index);
            if (entryKey === undefined) {
                return unknownValue();
            }

            return target.entries[entryKey] ?? unknownValue();
        }

        if (target.kind === 'array-shape') {
            const elementIndex = literalValueToArrayIndex(index);
            if (elementIndex === undefined || elementIndex < 0 || elementIndex >= target.elements.length) {
                return unknownValue();
            }

            return target.elements[elementIndex];
        }

        return unknownValue();
    }

    private evaluateConditionalExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const conditionValue = this.evaluate(node.children[0], state);
        const truthiness = isDefinitelyTruthy(conditionValue);

        if (truthiness === true) {
            return this.evaluate(node.children[1], state);
        }

        if (truthiness === false) {
            return this.evaluate(node.children[2], state);
        }

        return joinSemanticValues([
            this.evaluate(node.children[1], state),
            this.evaluate(node.children[2], state)
        ]);
    }

    private evaluateNewExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const targetValue = this.evaluate(node.children[0], state);
        return this.asExactObjectValue(targetValue);
    }

    private evaluateCallExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const callee = node.children[0];
        if (!callee || callee.kind !== SyntaxKind.Identifier) {
            return unknownValue();
        }

        if (callee.name !== 'load_object' && callee.name !== 'find_object') {
            return unknownValue();
        }

        const argumentList = node.children[1];
        const firstArgument = argumentList?.children[0];
        const targetValue = this.evaluate(firstArgument, state);
        return this.asExactObjectValue(targetValue);
    }

    private asExactObjectValue(targetValue: SemanticValue): SemanticValue {
        if (targetValue.kind === 'literal' && typeof targetValue.value === 'string') {
            return objectValue(targetValue.value);
        }

        return unknownValue();
    }
}
