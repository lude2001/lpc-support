import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import {
    literalValue,
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
import { evaluateLpcTruthiness } from './LpcConditionEvaluator';
import { evaluateLpcLiteralNode } from './LpcLiteralEvaluator';
import { LpcContainerShapeEvaluator } from './LpcContainerShapeEvaluator';
import { evaluateLpcObjectSourceValue, isLpcObjectSourceCallName } from './LpcObjectSourceEvaluator';

export interface ExpressionEvaluatorOptions {
    evaluateDirectCall?: (callExpression: SyntaxNode, state: StaticEvaluationState) => SemanticValue;
}

export class ExpressionEvaluator {
    private readonly containerShapeEvaluator: LpcContainerShapeEvaluator;

    public constructor(
        private readonly context: StaticEvaluationContext,
        private readonly options: ExpressionEvaluatorOptions = {}
    ) {
        this.containerShapeEvaluator = new LpcContainerShapeEvaluator({
            evaluateExpression: (node, state) => this.evaluate(node, state)
        });
    }

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
                return this.containerShapeEvaluator.evaluateMappingLiteral(node, state);
            case SyntaxKind.ArrayLiteralExpression:
                return this.containerShapeEvaluator.evaluateArrayLiteral(node, state);
            case SyntaxKind.IndexExpression:
                return this.containerShapeEvaluator.evaluateIndexExpression(node, state);
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
        const truthiness = evaluateLpcTruthiness(conditionValue);

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
            const truthiness = evaluateLpcTruthiness(operandValue);
            return truthiness === undefined
                ? unknownValue()
                : literalValue(!truthiness, 'boolean');
        }

        return unknownValue();
    }

    private evaluateNewExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const targetValue = this.evaluate(node.children[0], state);
        return evaluateLpcObjectSourceValue(targetValue);
    }

    private evaluateCallExpression(node: SyntaxNode, state: StaticEvaluationState): SemanticValue {
        const callee = node.children[0];
        if (callee?.kind === SyntaxKind.Identifier) {
            const typePredicateValue = this.evaluateTypePredicateCall(callee.name, node, state);
            if (typePredicateValue) {
                return typePredicateValue;
            }

            if (isLpcObjectSourceCallName(callee.name)) {
                const argumentList = node.children[1];
                const firstArgument = argumentList?.children[0];
                const targetValue = this.evaluate(firstArgument, state);
                return evaluateLpcObjectSourceValue(targetValue);
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
}
