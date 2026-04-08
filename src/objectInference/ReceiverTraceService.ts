import * as vscode from 'vscode';
import { SyntaxDocument, SyntaxKind, SyntaxNode } from '../syntax/types';
import { ObjectCandidate } from './types';
import { ReturnObjectResolver } from './ReturnObjectResolver';

export class ReceiverTraceService {
    constructor(private readonly returnObjectResolver: ReturnObjectResolver) {}

    public async traceIdentifier(
        document: vscode.TextDocument,
        syntax: SyntaxDocument,
        identifierNode: SyntaxNode
    ): Promise<ObjectCandidate[] | undefined> {
        if (!identifierNode.name) {
            return undefined;
        }

        const containingFunction = this.findContainingFunction(syntax, identifierNode.range.start);
        if (!containingFunction) {
            return undefined;
        }

        return this.traceIdentifierInFunction(
            document,
            containingFunction,
            identifierNode.name,
            identifierNode.range.start,
            new Set<string>()
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
        visited: Set<string>
    ): Promise<ObjectCandidate[]> {
        const visitKey = `${identifierName}@${usagePosition.line}:${usagePosition.character}`;
        if (visited.has(visitKey)) {
            return [];
        }

        visited.add(visitKey);

        const sourceExpressions = this.collectSourceExpressions(functionNode, identifierName, usagePosition);
        const candidates: ObjectCandidate[] = [];

        for (const expression of sourceExpressions) {
            candidates.push(...await this.resolveSourceExpression(
                document,
                functionNode,
                expression,
                usagePosition,
                visited
            ));
        }

        return candidates;
    }

    private collectSourceExpressions(
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position
    ): SyntaxNode[] {
        const expressions: SyntaxNode[] = [];

        const visit = (node: SyntaxNode, isRoot = false): void => {
            if (!this.isBeforeOrEqual(node.range.start, usagePosition)) {
                return;
            }

            if (!isRoot && node.kind === SyntaxKind.FunctionDeclaration) {
                return;
            }

            if (this.isUnsupportedControlFlow(node)) {
                return;
            }

            if (node.kind === SyntaxKind.VariableDeclarator && node.name === identifierName && node.children[1]) {
                expressions.push(node.children[1]);
            }

            if (
                node.kind === SyntaxKind.AssignmentExpression
                && node.metadata?.operator === '='
                && node.children[0]?.kind === SyntaxKind.Identifier
                && node.children[0].name === identifierName
                && node.children[1]
            ) {
                expressions.push(node.children[1]);
            }

            for (const child of node.children) {
                visit(child);
            }
        };

        visit(functionNode, true);
        return expressions;
    }

    private async resolveSourceExpression(
        document: vscode.TextDocument,
        functionNode: SyntaxNode,
        expression: SyntaxNode,
        usagePosition: vscode.Position,
        visited: Set<string>
    ): Promise<ObjectCandidate[]> {
        const directCandidates = await this.returnObjectResolver.resolveExpression(document, expression);
        if (directCandidates.length > 0) {
            return directCandidates;
        }

        if (expression.kind === SyntaxKind.ParenthesizedExpression && expression.children[0]) {
            return this.resolveSourceExpression(document, functionNode, expression.children[0], usagePosition, visited);
        }

        if (expression.kind === SyntaxKind.Identifier && expression.name) {
            return this.traceIdentifierInFunction(document, functionNode, expression.name, expression.range.start, visited);
        }

        return [];
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
