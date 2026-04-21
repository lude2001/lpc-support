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
import {
    createResolvedEnvironmentCallKey,
    type StaticEvaluationContext
} from './StaticEvaluationContext';
import {
    getEnvironmentValue,
    type StaticEvaluationState
} from './StaticEvaluationState';
import {
    evaluateLpcTypePredicate,
    isLpcTypePredicateName
} from './LpcTypePredicateEvaluator';
import { evaluateLpcLiteralNode } from './LpcLiteralEvaluator';

export interface ExpressionEvaluatorOptions {
    evaluateDirectCall?: (callExpression: SyntaxNode, state: StaticEvaluationState) => SemanticValue;
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

function collectStaticStringSet(value: SemanticValue): string[] | undefined {
    if (value.kind === 'literal' && typeof value.value === 'string') {
        return [value.value];
    }

    if (
        value.kind === 'union'
        || value.kind === 'candidate-set'
        || value.kind === 'configured-candidate-set'
    ) {
        const parts = value.values
            .map((entry) => collectStaticStringSet(entry))
            .filter((entry): entry is string[] => Boolean(entry));
        if (parts.length !== value.values.length) {
            return undefined;
        }

        return [...new Set(parts.flat())].sort();
    }

    return undefined;
}

function isDefinitelyTruthy(value: SemanticValue): boolean | undefined {
    if (value.kind === 'object') {
        return true;
    }

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
    public constructor(
        private readonly context: StaticEvaluationContext,
        private readonly options: ExpressionEvaluatorOptions = {}
    ) {}

    public evaluate(node: SyntaxNode | undefined, state: StaticEvaluationState): SemanticValue {
        if (!node) {
            return unknownValue();
        }

        switch (node.kind) {
            case SyntaxKind.Literal:
                return evaluateLpcLiteralNode(node);
            case SyntaxKind.Identifier:
                return getEnvironmentValue(state.environment, node.name ?? '') ?? unknownValue();
            case SyntaxKind.ParenthesizedExpression:
                return this.evaluate(node.children[0], state);
            case SyntaxKind.UnaryExpression:
                return this.evaluateUnaryExpression(node, state);
            case SyntaxKind.MappingLiteralExpression:
                return this.evaluateMappingLiteral(node, state);
            case SyntaxKind.ArrayLiteralExpression:
                return this.evaluateArrayLiteral(node, state);
            case SyntaxKind.IndexExpression:
                return this.evaluateIndexExpression(node, state);
            case SyntaxKind.BinaryExpression:
                return this.evaluateBinaryExpression(node, state);
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

        return this.evaluateIndexOnTarget(target, index);
    }

    private evaluateIndexOnTarget(target: SemanticValue, index: SemanticValue): SemanticValue {
        if (target.kind === 'union') {
            return joinSemanticValues(
                target.values.map((entry) => this.evaluateIndexOnTarget(entry, index))
            );
        }

        if (target.kind === 'mapping-shape') {
            const entryKeys = collectStaticStringSet(index);
            if (!entryKeys || entryKeys.length === 0) {
                return unknownValue();
            }

            const values: SemanticValue[] = [];
            for (const entryKey of entryKeys) {
                const entryValue = target.entries[entryKey];
                if (!entryValue) {
                    return unknownValue();
                }

                values.push(entryValue);
            }

            return joinSemanticValues(values);
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

    private evaluateBinaryExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const operator = node.metadata?.operator;
        const left = this.evaluate(node.children[0], state);
        const right = this.evaluate(node.children[1], state);

        if ((operator === '==' || operator === '===') && left.kind === 'literal' && right.kind === 'literal') {
            return literalValue(left.value === right.value, 'boolean');
        }

        if ((operator === '!=' || operator === '!==') && left.kind === 'literal' && right.kind === 'literal') {
            return literalValue(left.value !== right.value, 'boolean');
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

    private evaluateUnaryExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const operator = node.metadata?.operator;
        const operandValue = this.evaluate(node.children[node.children.length - 1], state);

        if (operator === '!') {
            const truthiness = isDefinitelyTruthy(operandValue);
            return truthiness === undefined
                ? unknownValue()
                : literalValue(!truthiness, 'boolean');
        }

        return unknownValue();
    }

    private evaluateNewExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const targetValue = this.evaluate(node.children[0], state);
        return this.asObjectSourceValue(targetValue);
    }

    private evaluateCallExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const callee = node.children[0];
        if (callee?.kind === SyntaxKind.Identifier) {
            const typePredicateValue = this.evaluateTypePredicateCall(callee.name, node, state);
            if (typePredicateValue) {
                return typePredicateValue;
            }

            if (callee.name === 'load_object' || callee.name === 'find_object') {
                const argumentList = node.children[1];
                const firstArgument = argumentList?.children[0];
                const targetValue = this.evaluate(firstArgument, state);
                return this.asObjectSourceValue(targetValue);
            }

            const naturalValue = this.options.evaluateDirectCall
                ? this.options.evaluateDirectCall(node, state)
                : unknownValue();
            if (naturalValue.kind !== 'unknown') {
                return naturalValue;
            }

            if (!callee.name) {
                return naturalValue;
            }

            const argumentCount = node.children.find((child) => child.kind === SyntaxKind.ArgumentList)?.children.length ?? 0;
            const resolvedEnvironmentValue = this.context.resolvedEnvironmentCalls?.get(
                createResolvedEnvironmentCallKey(
                    this.context.metadata.documentUri,
                    callee.name,
                    argumentCount
                )
            );
            if (resolvedEnvironmentValue) {
                return resolvedEnvironmentValue;
            }

            return naturalValue;
        }

        return this.options.evaluateDirectCall
            ? this.options.evaluateDirectCall(node, state)
            : unknownValue();
    }

    private evaluateTypePredicateCall(
        calleeName: string | undefined,
        node: SyntaxNode,
        state: StaticEvaluationState
    ): SemanticValue | undefined {
        if (!isLpcTypePredicateName(calleeName)) {
            return undefined;
        }

        const argumentList = node.children.find((child) => child.kind === SyntaxKind.ArgumentList);
        if (argumentList?.children.length !== 1) {
            return unknownValue();
        }

        const argumentValue = this.evaluate(argumentList.children[0], state);
        const predicateResult = evaluateLpcTypePredicate(calleeName, argumentValue);
        return predicateResult === undefined
            ? unknownValue()
            : literalValue(predicateResult, 'boolean');
    }

    private asObjectSourceValue(targetValue: SemanticValue): SemanticValue {
        const targetPaths = collectStaticStringSet(targetValue);
        if (targetPaths?.length) {
            return joinSemanticValues(targetPaths.map((targetPath) => objectValue(targetPath)));
        }

        return unknownValue();
    }
}
