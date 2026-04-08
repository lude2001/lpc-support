import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ClassifiedReceiver } from './types';

const MACRO_NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

export class ReceiverClassifier {
    public classify(node: SyntaxNode): ClassifiedReceiver {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.classify(node.children[0]);
        }

        if (node.kind === SyntaxKind.IndexExpression) {
            return {
                kind: 'index',
                reason: this.classifyIndexReason(node),
                nodeText: this.getNodeText(node)
            };
        }

        if (node.kind === SyntaxKind.Literal) {
            const expression = typeof node.metadata?.text === 'string' ? node.metadata.text : this.getNodeText(node);

            if (!this.isStringLiteral(expression)) {
                return {
                    kind: 'unsupported',
                    reason: 'unsupported-expression',
                    nodeText: this.getNodeText(node)
                };
            }

            return { kind: 'literal', expression, nodeText: this.getNodeText(node) };
        }

        if (node.kind === SyntaxKind.Identifier && node.name) {
            if (MACRO_NAME_PATTERN.test(node.name)) {
                return { kind: 'macro', expression: node.name, nodeText: node.name };
            }

            return { kind: 'identifier', expression: node.name, nodeText: node.name };
        }

        if (node.kind === SyntaxKind.CallExpression) {
            const callee = node.children[0];
            if (callee?.kind === SyntaxKind.Identifier && callee.name) {
                const argumentList = node.children[1];
                const firstArgument = argumentList?.children[0]
                    ? this.getRecoverableArgumentText(argumentList.children[0])
                    : undefined;

                return {
                    kind: 'call',
                    calleeName: callee.name,
                    firstArgument,
                    nodeText: this.getNodeText(node)
                };
            }
        }

        return {
            kind: 'unsupported',
            reason: 'unsupported-expression',
            nodeText: this.getNodeText(node)
        };
    }

    private classifyIndexReason(node: SyntaxNode): 'array-element' | 'unsupported-expression' {
        return 'unsupported-expression';
    }

    private getRecoverableArgumentText(node: SyntaxNode): string {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.getRecoverableArgumentText(node.children[0]);
        }

        return this.getNodeText(node);
    }

    private isStringLiteral(expression: string): boolean {
        return expression.length >= 2 && expression.startsWith('"') && expression.endsWith('"');
    }

    private getNodeText(node: SyntaxNode): string {
        if (typeof node.metadata?.text === 'string') {
            return node.metadata.text;
        }

        return node.name ?? '';
    }
}
