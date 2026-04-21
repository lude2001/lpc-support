import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { literalValue, unknownValue } from '../valueFactories';
import type { StaticEvaluationState } from './StaticEvaluationState';

export interface LpcConstantEvaluatorDependencies {
    evaluateExpression: (node: SyntaxNode | undefined, state: StaticEvaluationState) => SemanticValue;
}

export class LpcConstantEvaluator {
    public constructor(private readonly dependencies: LpcConstantEvaluatorDependencies) {}

    public evaluate(node: SyntaxNode | undefined, state: StaticEvaluationState): SemanticValue | undefined {
        if (!node) {
            return undefined;
        }

        switch (node.kind) {
            case SyntaxKind.ParenthesizedExpression:
                return this.dependencies.evaluateExpression(node.children[0], state);
            case SyntaxKind.BinaryExpression:
                return this.evaluateBinaryExpression(node, state);
            default:
                return undefined;
        }
    }

    private evaluateBinaryExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const operator = node.metadata?.operator;
        if (
            operator !== '=='
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

        return literalValue(left.value !== right.value, 'boolean');
    }
}
