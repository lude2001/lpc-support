import * as vscode from 'vscode';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ReceiverBindingResolver } from './ReceiverBindingResolver';
import { FlowState } from './ReceiverTraceTypes';
import { isBeforeOrEqual } from './ReceiverTraceSupport';

export class ReceiverFlowCollector {
    public constructor(private readonly bindingResolver: ReceiverBindingResolver) {}

    public collectSourceExpressions(
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        binding: SyntaxNode | undefined
    ): FlowState {
        const body = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
        if (!body) {
            return this.createFlowState();
        }

        return this.collectFlowExpressions(body, functionNode, identifierName, usagePosition, binding, this.createFlowState());
    }

    private collectFlowExpressions(
        node: SyntaxNode,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        binding: SyntaxNode | undefined,
        currentState: FlowState
    ): FlowState {
        if (!isBeforeOrEqual(node.range.start, usagePosition)) {
            return currentState;
        }

        if (node.kind === SyntaxKind.FunctionDeclaration) {
            return currentState;
        }

        if (this.isUnsupportedControlFlow(node) && this.mightWriteTrackedBinding(node, functionNode, identifierName, usagePosition, binding)) {
            return this.createFlowState([], true);
        }

        if (node.kind === SyntaxKind.IfStatement) {
            return this.collectIfFlowExpressions(node, functionNode, identifierName, usagePosition, binding, currentState);
        }

        if (this.isTrackedDeclaration(node, identifierName, binding) && node.children[1]) {
            return this.createFlowState([node.children[1]]);
        }

        if (
            this.isTrackedAssignment(node, functionNode, identifierName, binding)
            && node.children[1]
        ) {
            return this.createFlowState([node.children[1]]);
        }

        let state = currentState;
        for (const child of node.children) {
            if (!isBeforeOrEqual(child.range.start, usagePosition)) {
                break;
            }

            state = this.collectFlowExpressions(child, functionNode, identifierName, usagePosition, binding, state);
        }

        return state;
    }

    private collectIfFlowExpressions(
        node: SyntaxNode,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        binding: SyntaxNode | undefined,
        currentState: FlowState
    ): FlowState {
        const thenBranch = node.children[1];
        const elseBranch = node.children[2];

        if (thenBranch?.range.contains(usagePosition)) {
            return this.collectFlowExpressions(thenBranch, functionNode, identifierName, usagePosition, binding, currentState);
        }

        if (elseBranch?.range.contains(usagePosition)) {
            return this.collectFlowExpressions(elseBranch, functionNode, identifierName, usagePosition, binding, currentState);
        }

        const thenState = thenBranch
            ? this.collectFlowExpressions(thenBranch, functionNode, identifierName, usagePosition, binding, currentState)
            : currentState;
        const elseState = elseBranch
            ? this.collectFlowExpressions(elseBranch, functionNode, identifierName, usagePosition, binding, currentState)
            : currentState;

        return this.mergeBranchStates(currentState, thenState, elseState);
    }

    private mergeBranchStates(currentState: FlowState, left: FlowState, right: FlowState): FlowState {
        if (
            left.isConservativeUnknown
            || right.isConservativeUnknown
            || this.branchLeavesReceiverUnresolved(currentState, left, right)
        ) {
            return this.createFlowState([], true);
        }

        return this.createFlowState(this.mergeExpressions(left.expressions, right.expressions));
    }

    private mergeExpressions(left: SyntaxNode[], right: SyntaxNode[]): SyntaxNode[] {
        const merged = [...left];

        for (const expression of right) {
            if (!merged.some((candidate) => candidate === expression)) {
                merged.push(expression);
            }
        }

        return merged;
    }

    private mightWriteTrackedBinding(
        node: SyntaxNode,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        binding: SyntaxNode | undefined
    ): boolean {
        if (!isBeforeOrEqual(node.range.start, usagePosition) || node.kind === SyntaxKind.FunctionDeclaration) {
            return false;
        }

        if (this.isTrackedDeclaration(node, identifierName, binding)) {
            return true;
        }

        if (this.isTrackedAssignment(node, functionNode, identifierName, binding)) {
            return true;
        }

        for (const child of node.children) {
            if (!isBeforeOrEqual(child.range.start, usagePosition)) {
                break;
            }

            if (this.mightWriteTrackedBinding(child, functionNode, identifierName, usagePosition, binding)) {
                return true;
            }
        }

        return false;
    }

    private isTrackedDeclaration(node: SyntaxNode, identifierName: string, binding: SyntaxNode | undefined): boolean {
        return node.kind === SyntaxKind.VariableDeclarator
            && node.name === identifierName
            && this.bindingResolver.sameBinding(node, binding);
    }

    private isTrackedAssignment(
        node: SyntaxNode,
        functionNode: SyntaxNode,
        identifierName: string,
        binding: SyntaxNode | undefined
    ): boolean {
        if (
            node.kind !== SyntaxKind.AssignmentExpression
            || node.metadata?.operator !== '='
            || node.children[0]?.kind !== SyntaxKind.Identifier
            || node.children[0].name !== identifierName
        ) {
            return false;
        }

        return this.bindingResolver.sameBinding(
            this.bindingResolver.resolveVisibleBinding(functionNode, identifierName, node.children[0].range.start),
            binding
        );
    }

    private branchLeavesReceiverUnresolved(currentState: FlowState, left: FlowState, right: FlowState): boolean {
        if (!this.isUnresolvedState(currentState)) {
            return false;
        }

        return !this.sameFlowState(left, right)
            && (this.sameFlowState(left, currentState) || this.sameFlowState(right, currentState));
    }

    private isUnresolvedState(state: FlowState): boolean {
        return !state.isConservativeUnknown && state.expressions.length === 0;
    }

    private sameFlowState(left: FlowState, right: FlowState): boolean {
        return left.isConservativeUnknown === right.isConservativeUnknown
            && this.sameExpressions(left.expressions, right.expressions);
    }

    private sameExpressions(left: SyntaxNode[], right: SyntaxNode[]): boolean {
        return left.length === right.length
            && left.every((expression) => right.includes(expression));
    }

    private createFlowState(expressions: SyntaxNode[] = [], isConservativeUnknown = false): FlowState {
        return {
            expressions,
            isConservativeUnknown
        };
    }

    private isUnsupportedControlFlow(node: SyntaxNode): boolean {
        return node.kind === SyntaxKind.WhileStatement
            || node.kind === SyntaxKind.DoWhileStatement
            || node.kind === SyntaxKind.ForStatement
            || node.kind === SyntaxKind.ForeachStatement
            || node.kind === SyntaxKind.SwitchStatement;
    }
}
