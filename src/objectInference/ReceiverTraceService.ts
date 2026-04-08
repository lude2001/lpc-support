import * as vscode from 'vscode';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { ObjectCandidate, ObjectInferenceReason, ObjectResolutionOutcome, TracedReceiverResult } from './types';
import { ReturnObjectResolver } from './ReturnObjectResolver';

interface FlowState {
    expressions: SyntaxNode[];
    isConservativeUnknown: boolean;
}

export class ReceiverTraceService {
    constructor(private readonly returnObjectResolver: ReturnObjectResolver) {}

    public async traceIdentifier(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        identifierNode: SyntaxNode
    ): Promise<TracedReceiverResult | undefined> {
        if (!identifierNode.name) {
            return undefined;
        }

        const containingFunction = this.findContainingFunction(syntax, identifierNode.range.start);
        if (!containingFunction) {
            return undefined;
        }

        const binding = this.resolveVisibleBinding(containingFunction, identifierNode.name, identifierNode.range.start);

        return this.traceIdentifierInFunction(
            document,
            containingFunction,
            identifierNode.name,
            identifierNode.range.start,
            new Set<string>(),
            binding
        );
    }

    private findContainingFunction(syntax: SyntaxDocument, position: vscode.Position): SyntaxNode | undefined {
        return [...syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.FunctionDeclaration)
            .filter((node) => node.range.contains(position))
            .sort((left, right) => this.getRangeSize(left.range) - this.getRangeSize(right.range))[0];
    }

    private async traceIdentifierInFunction(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        visited: Set<string>,
        binding: SyntaxNode | undefined = this.resolveVisibleBinding(functionNode, identifierName, usagePosition)
    ): Promise<TracedReceiverResult> {
        const visitKey = `${this.getBindingKey(identifierName, binding)}@${usagePosition.line}:${usagePosition.character}`;
        if (visited.has(visitKey)) {
            return {
                candidates: [],
                hasVisibleBinding: binding !== undefined
            };
        }

        visited.add(visitKey);

        const sourceState = this.collectSourceExpressions(functionNode, identifierName, usagePosition, binding);
        const candidates: ObjectCandidate[] = [];
        let reason: ObjectInferenceReason | undefined;

        for (const expression of sourceState.expressions) {
            const outcome = await this.resolveSourceExpression(
                document,
                functionNode,
                expression,
                usagePosition,
                visited
            );
            candidates.push(...outcome.candidates);
            reason = reason ?? outcome.reason;
        }

        return {
            candidates,
            reason,
            hasVisibleBinding: binding !== undefined
        };
    }

    private collectSourceExpressions(
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
        if (!this.isBeforeOrEqual(node.range.start, usagePosition)) {
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
            if (!this.isBeforeOrEqual(child.range.start, usagePosition)) {
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

    private async resolveSourceExpression(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        expression: SyntaxNode,
        usagePosition: vscode.Position,
        visited: Set<string>
    ): Promise<ObjectResolutionOutcome> {
        const directResolution = await this.returnObjectResolver.resolveExpressionOutcome(document, expression);
        if (directResolution.candidates.length > 0 || directResolution.reason) {
            return directResolution;
        }

        if (expression.kind === SyntaxKind.ParenthesizedExpression && expression.children[0]) {
            return this.resolveSourceExpression(document, functionNode, expression.children[0], usagePosition, visited);
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name) {
            return this.traceIdentifierInFunction(document, functionNode, expression.name, expression.range.start, visited);
        }

        return { candidates: [] };
    }

    private resolveVisibleBinding(
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position
    ): SyntaxNode | undefined {
        let binding = this.findParameterBinding(functionNode, identifierName);

        const walk = (node: SyntaxNode, currentBinding: SyntaxNode | undefined): SyntaxNode | undefined => {
            let visibleBinding = currentBinding;

            for (const child of node.children) {
                if (!this.isBeforeOrEqual(child.range.start, usagePosition)) {
                    break;
                }

                if (child.kind === SyntaxKind.VariableDeclarator && child.name === identifierName) {
                    visibleBinding = child;
                }

                if (this.shouldRecurseForBinding(child, usagePosition)) {
                    visibleBinding = walk(child, visibleBinding);
                }
            }

            return visibleBinding;
        };

        const body = functionNode.children.find((child) => child.kind === SyntaxKind.Block);
        if (!body) {
            return binding;
        }

        binding = walk(body, binding);
        return binding;
    }

    private shouldRecurseForBinding(node: SyntaxNode, usagePosition: vscode.Position): boolean {
        if (node.kind === SyntaxKind.Block) {
            return node.range.contains(usagePosition);
        }

        return true;
    }

    private findParameterBinding(functionNode: SyntaxNode, identifierName: string): SyntaxNode | undefined {
        const parameterList = functionNode.children.find((child) => child.kind === SyntaxKind.ParameterList);
        return parameterList?.children.find(
            (child) => child.kind === SyntaxKind.ParameterDeclaration && child.name === identifierName
        );
    }

    private mightWriteTrackedBinding(
        node: SyntaxNode,
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position,
        binding: SyntaxNode | undefined
    ): boolean {
        if (!this.isBeforeOrEqual(node.range.start, usagePosition) || node.kind === SyntaxKind.FunctionDeclaration) {
            return false;
        }

        if (this.isTrackedDeclaration(node, identifierName, binding)) {
            return true;
        }

        if (this.isTrackedAssignment(node, functionNode, identifierName, binding)) {
            return true;
        }

        for (const child of node.children) {
            if (!this.isBeforeOrEqual(child.range.start, usagePosition)) {
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
            && this.sameBinding(node, binding);
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

        return this.sameBinding(
            this.resolveVisibleBinding(functionNode, identifierName, node.children[0].range.start),
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

    private sameBinding(left: SyntaxNode | undefined, right: SyntaxNode | undefined): boolean {
        return left === right;
    }

    private getBindingKey(identifierName: string, binding: SyntaxNode | undefined): string {
        if (!binding) {
            return `${identifierName}@unbound`;
        }

        return `${binding.kind}:${binding.tokenRange.start}:${binding.tokenRange.end}`;
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

    private isBeforeOrEqual(left: vscode.Position, right: vscode.Position): boolean {
        return left.isBefore(right) || left.isEqual(right);
    }

    private getRangeSize(range: vscode.Range): number {
        return (range.end.line - range.start.line) * 10_000 + (range.end.character - range.start.character);
    }
}
