import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { literalValue, unknownValue } from '../valueFactories';
import type { StaticEvaluationState } from './StaticEvaluationState';

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
            && operator !== '=='
            && operator !== '==='
            && operator !== '!='
            && operator !== '!=='
        ) {
            return unknownValue();
        }

        const left = this.dependencies.evaluateExpression(node.children[0], state);
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

    private evaluateBinaryAddition(left: SemanticValue, right: SemanticValue): SemanticValue {
        if (left.kind !== 'literal' || right.kind !== 'literal') {
            return unknownValue();
        }

        const leftType = left.valueType;
        const rightType = right.valueType;

        if (leftType === 'string' || rightType === 'string') {
            return literalValue(String(left.value) + String(right.value), 'string');
        }

        if (
            (leftType !== 'int' && leftType !== 'float')
            || (rightType !== 'int' && rightType !== 'float')
        ) {
            return unknownValue();
        }

        const sum = (left.value as number) + (right.value as number);
        if (leftType === 'int' && rightType === 'int' && Number.isInteger(sum)) {
            return literalValue(sum, 'int');
        }

        return literalValue(sum, 'float');
    }
}
