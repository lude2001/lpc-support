import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { unknownValue } from '../valueFactories';
import type { StaticEvaluationContext } from './StaticEvaluationContext';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import {
    bindEnvironmentValue,
    createStaticEvaluationState,
    createValueEnvironment,
    type StaticEvaluationState
} from './StaticEvaluationState';
import { StatementTransfer } from './StatementTransfer';

export class CoreStaticEvaluator {
    private readonly expressionEvaluator: ExpressionEvaluator;

    public constructor(private readonly context: StaticEvaluationContext) {
        this.expressionEvaluator = new ExpressionEvaluator(context, {
            evaluateDirectCall: (callExpression, state) => this.evaluateDirectCallExpression(callExpression, state)
        });
    }

    public evaluateFunction(functionNode: SyntaxNode): SemanticValue {
        const blockNode = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
        if (!blockNode) {
            return unknownValue();
        }

        return this.evaluateBlock(blockNode);
    }

    public evaluateBlock(
        blockNode: SyntaxNode,
        initialState: StaticEvaluationState = createStaticEvaluationState({
            environment: this.context.initialEnvironment
        })
    ): SemanticValue {
        let remainingStatements = this.context.budget.maxStatements;
        const statementTransfer = new StatementTransfer(
            this.context,
            this.expressionEvaluator,
            () => {
                if (remainingStatements <= 0) {
                    return false;
                }

                remainingStatements -= 1;
                return true;
            }
        );

        const finalState = statementTransfer.executeBlock(blockNode, initialState);
        if (!finalState) {
            return unknownValue();
        }

        return finalState.returns.values.length > 0
            ? finalState.returns.result
            : unknownValue();
    }

    private evaluateDirectCallExpression(
        callExpression: SyntaxNode,
        state: StaticEvaluationState
    ): SemanticValue {
        const callee = callExpression.children[0];
        if (!this.context.syntax || !this.context.semantic || callee?.kind !== SyntaxKind.Identifier || !callee.name) {
            return unknownValue();
        }

        const nextCallDepth = this.context.metadata.callDepth + 1;
        if (nextCallDepth > this.context.budget.maxCallDepth) {
            return unknownValue();
        }

        const functionSummary = this.context.semantic.exportedFunctions.find((entry) => entry.name === callee.name);
        if (!functionSummary) {
            return unknownValue();
        }

        const functionNode = this.context.syntax.nodes.find((node) =>
            node.kind === SyntaxKind.FunctionDeclaration
            && node.name === callee.name
            && node.children.some((child) => child.kind === SyntaxKind.Block)
        );
        if (!functionNode) {
            return unknownValue();
        }

        const argumentList = callExpression.children[1];
        const argumentValues = argumentList?.children.map((argument) =>
            this.expressionEvaluator.evaluate(argument, state)
        ) ?? [];

        let initialEnvironment = createValueEnvironment();
        for (let index = 0; index < functionSummary.parameters.length; index += 1) {
            const parameter = functionSummary.parameters[index];
            initialEnvironment = bindEnvironmentValue(
                initialEnvironment,
                parameter.name,
                argumentValues[index] ?? unknownValue()
            );
        }

        return new CoreStaticEvaluator({
            ...this.context,
            functionSummary,
            metadata: {
                ...this.context.metadata,
                functionName: functionSummary.name,
                callDepth: nextCallDepth
            },
            initialEnvironment
        }).evaluateFunction(functionNode);
    }
}
