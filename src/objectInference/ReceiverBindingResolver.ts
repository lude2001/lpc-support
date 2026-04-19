import * as vscode from 'vscode';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { isBeforeOrEqual, sameBinding } from './ReceiverTraceSupport';

export class ReceiverBindingResolver {
    public resolveVisibleBinding(
        functionNode: SyntaxNode,
        identifierName: string,
        usagePosition: vscode.Position
    ): SyntaxNode | undefined {
        let binding = this.findParameterBinding(functionNode, identifierName);

        const walk = (node: SyntaxNode, currentBinding: SyntaxNode | undefined): SyntaxNode | undefined => {
            let visibleBinding = currentBinding;

            for (const child of node.children) {
                if (!isBeforeOrEqual(child.range.start, usagePosition)) {
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

    public bindingKey(identifierName: string, binding: SyntaxNode | undefined): string {
        if (!binding) {
            return `${identifierName}@unbound`;
        }

        return `${binding.kind}:${binding.tokenRange.start}:${binding.tokenRange.end}`;
    }

    public sameBinding(left: SyntaxNode | undefined, right: SyntaxNode | undefined): boolean {
        return sameBinding(left, right);
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
}
