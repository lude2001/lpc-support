import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ClassifiedReceiver } from './types';

export class ReceiverClassifier {
    private static readonly builtinCallArities = new Map<string, number>([
        ['this_object', 0],
        ['this_player', 0],
        ['load_object', 1],
        ['find_object', 1],
        ['clone_object', 1]
    ]);

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
                const argumentCount = argumentList?.children.length ?? 0;
                const firstArgument = argumentList?.children[0]
                    ? this.getRecoverableArgument(argumentList.children[0])
                    : undefined;
                const unsupportedReason = this.getCallUnsupportedReason(callee.name, argumentCount, firstArgument?.reason);

                return {
                    kind: 'call',
                    calleeName: callee.name,
                    argumentCount,
                    firstArgument: firstArgument?.text,
                    unsupportedReason,
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

    private getCallUnsupportedReason(
        calleeName: string,
        argumentCount: number,
        firstArgumentReason?: 'unsupported-expression'
    ): 'unsupported-expression' | undefined {
        const expectedArity = ReceiverClassifier.builtinCallArities.get(calleeName);
        if (expectedArity === undefined) {
            return undefined;
        }

        if (argumentCount !== expectedArity) {
            return 'unsupported-expression';
        }

        return firstArgumentReason;
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
