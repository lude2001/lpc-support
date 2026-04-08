import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ClassifiedReceiver } from './types';

export class ReceiverClassifier {
    public classify(node: SyntaxNode): ClassifiedReceiver {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.classify(node.children[0]);
        }

        if (node.kind === SyntaxKind.IndexExpression) {
            return {
                kind: 'index',
                reason: 'unsupported-expression',
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
            return { kind: 'identifier', expression: node.name, nodeText: node.name };
        }

        if (node.kind === SyntaxKind.CallExpression) {
            const callee = node.children[0];
            if (callee?.kind === SyntaxKind.Identifier && callee.name) {
                const argumentList = node.children[1];
                const firstArgument = argumentList?.children[0]
                    ? this.getRecoverableArgument(argumentList.children[0])
                    : undefined;

                return {
                    kind: 'call',
                    calleeName: callee.name,
                    firstArgument: firstArgument?.text,
                    unsupportedReason: firstArgument?.reason,
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

    private getRecoverableArgument(node: SyntaxNode): { text?: string; reason?: 'unsupported-expression' } {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.getRecoverableArgument(node.children[0]);
        }

        if (node.kind === SyntaxKind.Identifier) {
            return { text: this.getNodeText(node) };
        }

        if (node.kind === SyntaxKind.Literal) {
            const text = this.getNodeText(node);
            return this.isStringLiteral(text)
                ? { text }
                : { reason: 'unsupported-expression' };
        }

        return { reason: 'unsupported-expression' };
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
