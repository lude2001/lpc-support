import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { unknownValue } from '../valueFactories';
import type { StaticEvaluationContext } from './StaticEvaluationContext';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { createStaticEvaluationState, type StaticEvaluationState } from './StaticEvaluationState';
import { StatementTransfer } from './StatementTransfer';

export class CoreStaticEvaluator {
    private readonly expressionEvaluator: ExpressionEvaluator;

    public constructor(private readonly context: StaticEvaluationContext) {
        this.expressionEvaluator = new ExpressionEvaluator(context);
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
}
