import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import type { SemanticValue } from '../types';
import { unknownValue } from '../valueFactories';
import type { StaticEvaluationContext } from './StaticEvaluationContext';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import { createStaticEvaluationState, type StaticEvaluationState } from './StaticEvaluationState';
import { StatementTransfer } from './StatementTransfer';

export class CoreStaticEvaluator {
    private readonly expressionEvaluator: ExpressionEvaluator;
    private readonly statementTransfer: StatementTransfer;
    private remainingStatements: number;

    public constructor(private readonly context: StaticEvaluationContext) {
        this.remainingStatements = context.budget.maxStatements;
        this.expressionEvaluator = new ExpressionEvaluator(context);
        this.statementTransfer = new StatementTransfer(
            context,
            this.expressionEvaluator,
            () => this.consumeStatementBudget()
        );
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
        const finalState = this.statementTransfer.executeBlock(blockNode, initialState);
        if (!finalState) {
            return unknownValue();
        }

        return finalState.returns.values.length > 0
            ? finalState.returns.result
            : unknownValue();
    }

    private consumeStatementBudget(): boolean {
        if (this.remainingStatements <= 0) {
            return false;
        }

        this.remainingStatements -= 1;
        return true;
    }
}
