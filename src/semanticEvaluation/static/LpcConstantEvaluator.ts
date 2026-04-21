import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { literalValue, unknownValue } from '../valueFactories';
import type { StaticEvaluationState } from './StaticEvaluationState';
import { evaluateLpcTruthiness } from './LpcConditionEvaluator';

export interface LpcConstantEvaluatorDependencies {
    evaluateExpression: (node: SyntaxNode | undefined, state: StaticEvaluationState) => SemanticValue;
}

export class LpcConstantEvaluator {
    public constructor(private readonly dependencies: LpcConstantEvaluatorDependencies) {}

    public evaluate(node: SyntaxNode | undefined, state: StaticEvaluationState): SemanticValue {
        if (!node) {
            return unknownValue();
        }

        switch (node.kind) {
            case SyntaxKind.ParenthesizedExpression:
                return this.dependencies.evaluateExpression(node.children[0], state);
            case SyntaxKind.BinaryExpression:
                return this.evaluateBinaryExpression(node, state);
            default:
                return unknownValue();
        }
    }

    private evaluateBinaryExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const operator = node.metadata?.operator;
        if (
            operator !== '+'
            && operator !== '&&'
            && operator !== '||'
            && operator !== '=='
            && operator !== '==='
            && operator !== '!='
            && operator !== '!=='
        ) {
            return unknownValue();
        }

        const left = this.dependencies.evaluateExpression(node.children[0], state);

        if (operator === '&&' || operator === '||') {
            return this.evaluateLogicalBinaryExpression(operator, left, node.children[1], state);
        }

        const right = this.dependencies.evaluateExpression(node.children[1], state);

        if (left.kind !== 'literal' || right.kind !== 'literal') {
            return unknownValue();
        }

        if (operator === '==' || operator === '===') {
            return literalValue(left.value === right.value, 'boolean');
        }

        if (operator === '+') {
            return this.evaluateBinaryAddition(left, right);
        }

        return literalValue(left.value !== right.value, 'boolean');
    }

    private evaluateLogicalBinaryExpression(
        operator: '&&' | '||',
        left: SemanticValue,
        rightNode: SyntaxNode | undefined,
        state: StaticEvaluationState
    ): SemanticValue {
        const leftTruthiness = evaluateLpcTruthiness(left);

        if (operator === '&&') {
            if (leftTruthiness === false) {
                return literalValue(false, 'boolean');
            }

            if (leftTruthiness !== true) {
                return unknownValue();
            }
        } else {
            if (leftTruthiness === true) {
                return literalValue(true, 'boolean');
            }

            if (leftTruthiness !== false) {
                return unknownValue();
            }
        }

        const right = this.dependencies.evaluateExpression(rightNode, state);
        const rightTruthiness = evaluateLpcTruthiness(right);
        return rightTruthiness === undefined
            ? unknownValue()
            : literalValue(rightTruthiness, 'boolean');
    }

    private evaluateBinaryAddition(left: SemanticValue, right: SemanticValue): SemanticValue {
        if (left.kind !== 'literal' || right.kind !== 'literal') {
            return unknownValue();
        }

        if (left.valueType === 'string' && right.valueType === 'string') {
            return literalValue(`${left.value}${right.value}`, 'string');
        }

        if (
            (left.valueType !== 'int' && left.valueType !== 'float')
            || (right.valueType !== 'int' && right.valueType !== 'float')
        ) {
            return unknownValue();
        }

        const sum = (left.value as number) + (right.value as number);
        if (left.valueType === 'int' && right.valueType === 'int' && Number.isInteger(sum)) {
            return literalValue(sum, 'int');
        }

        return literalValue(sum, 'float');
    }
}
