import { SyntaxKind, SyntaxNode } from '../../syntax/types';
import { unknownValue } from '../valueFactories';
import { ExpressionEvaluator } from './ExpressionEvaluator';
import type { StaticEvaluationContext } from './StaticEvaluationContext';
import {
    appendReturnValue,
    bindEnvironmentValue,
    createControlFlowState,
    createStaticEvaluationState,
    createValueEnvironment,
    getEnvironmentValue,
    joinStaticEvaluationStates,
    type StaticEvaluationState
} from './StaticEvaluationState';

function isDefinitelyTruthy(nodeValue: ReturnType<ExpressionEvaluator['evaluate']>): boolean | undefined {
    if (nodeValue.kind === 'object') {
        return true;
    }

    if (nodeValue.kind !== 'literal') {
        return undefined;
    }

    if (typeof nodeValue.value === 'boolean') {
        return nodeValue.value;
    }

    if (typeof nodeValue.value === 'number') {
        return nodeValue.value !== 0;
    }

    if (nodeValue.value === null) {
        return false;
    }

    if (typeof nodeValue.value === 'string') {
        return nodeValue.value.length > 0;
    }

    return undefined;
}

export class StatementTransfer {
    public constructor(
        private readonly context: StaticEvaluationContext,
        private readonly expressionEvaluator: ExpressionEvaluator,
        private readonly consumeStatementBudget: () => boolean
    ) {}

    public executeBlock(
        blockNode: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState | undefined {
        let currentState = state;

        for (const child of blockNode.children) {
            if (!currentState.controlFlow.reachable || currentState.controlFlow.hasReturned) {
                break;
            }

            const nextState = this.transfer(child, currentState);
            if (!nextState) {
                return undefined;
            }

            currentState = nextState;
        }

        return currentState;
    }

    public transfer(
        node: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState | undefined {
        if (node.kind === SyntaxKind.Block) {
            return this.executeBlock(node, state);
        }

        if (!this.consumeStatementBudget()) {
            return undefined;
        }

        switch (node.kind) {
            case SyntaxKind.VariableDeclaration:
                return this.transferVariableDeclaration(node, state);
            case SyntaxKind.ExpressionStatement:
                return this.transferExpressionStatement(node, state);
            case SyntaxKind.IfStatement:
                return this.transferIfStatement(node, state);
            case SyntaxKind.ReturnStatement:
                return this.transferReturnStatement(node, state);
            case SyntaxKind.WhileStatement:
            case SyntaxKind.DoWhileStatement:
            case SyntaxKind.ForStatement:
            case SyntaxKind.ForeachStatement:
                return this.downgradeEnvironmentToUnknown(state);
            default:
                return this.downgradeEnvironmentToUnknown(state);
        }
    }

    private transferVariableDeclaration(
        node: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState {
        let nextEnvironment = state.environment;

        for (const child of node.children) {
            if (child.kind !== SyntaxKind.VariableDeclarator) {
                continue;
            }

            const identifierNode = child.children.find((entry) => entry.kind === SyntaxKind.Identifier);
            if (!identifierNode?.name) {
                continue;
            }

            const initializer = child.children.find((entry) => entry.kind !== SyntaxKind.Identifier);
            const initializerValue = initializer
                ? this.expressionEvaluator.evaluate(initializer, {
                    ...state,
                    environment: nextEnvironment
                })
                : unknownValue();

            nextEnvironment = bindEnvironmentValue(nextEnvironment, identifierNode.name, initializerValue);
        }

        return {
            ...state,
            environment: nextEnvironment
        };
    }

    private transferExpressionStatement(
        node: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState {
        const expression = node.children[0];
        if (!expression) {
            return state;
        }

        if (expression.kind === SyntaxKind.AssignmentExpression) {
            return this.applyAssignmentExpression(expression, state);
        }

        this.expressionEvaluator.evaluate(expression, state);
        return state;
    }

    private applyAssignmentExpression(
        node: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState {
        const operator = node.metadata?.operator;
        const left = node.children[0];
        const right = node.children[1];

        if (operator !== '=' || left?.kind !== SyntaxKind.Identifier || !left.name || !right) {
            return this.downgradeEnvironmentToUnknown(state);
        }

        const rightValue = this.expressionEvaluator.evaluate(right, state);
        return {
            ...state,
            environment: bindEnvironmentValue(state.environment, left.name, rightValue)
        };
    }

    private transferIfStatement(
        node: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState | undefined {
        const condition = node.children[0];
        const thenStatement = node.children[1];
        const elseStatement = node.children[2];
        const conditionValue = this.expressionEvaluator.evaluate(condition, state);
        const truthiness = isDefinitelyTruthy(conditionValue);

        if (truthiness === true) {
            return thenStatement ? this.transfer(thenStatement, state) : state;
        }

        if (truthiness === false) {
            return elseStatement ? this.transfer(elseStatement, state) : state;
        }

        const thenState = thenStatement ? this.transfer(thenStatement, state) : state;
        const elseState = elseStatement ? this.transfer(elseStatement, state) : state;

        if (!thenState || !elseState) {
            return undefined;
        }

        return joinStaticEvaluationStates([thenState, elseState]);
    }

    private transferReturnStatement(
        node: SyntaxNode,
        state: StaticEvaluationState
    ): StaticEvaluationState {
        const returnValue = node.children[0]
            ? this.expressionEvaluator.evaluate(node.children[0], state)
            : unknownValue();

        return {
            ...state,
            controlFlow: createControlFlowState({
                reachable: true,
                hasReturned: true,
                termination: 'return'
            }),
            returns: appendReturnValue(state.returns, returnValue)
        };
    }

    private downgradeEnvironmentToUnknown(
        state: StaticEvaluationState
    ): StaticEvaluationState {
        if (state.environment.bindings.size === 0) {
            return state;
        }

        const downgradedBindings = new Map<string, ReturnType<typeof unknownValue>>();
        for (const [symbolName] of state.environment.bindings.entries()) {
            downgradedBindings.set(symbolName, unknownValue());
        }

        return createStaticEvaluationState({
            environment: createValueEnvironment(downgradedBindings),
            controlFlow: state.controlFlow,
            returns: state.returns
        });
    }
}
