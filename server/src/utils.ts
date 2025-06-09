import { Token } from 'antlr4ts';
import { IdentifierContext } from './parser/LPCParser';

export function getIdentifierInfo(ctx: IdentifierContext): { name: string, token: Token } | undefined {
    const terminalNode = ctx.IDENTIFIER() ?? ctx.keywordIdentifier()?.children?.[0];

    if (terminalNode && 'symbol' in terminalNode) {
        return {
            name: terminalNode.text,
            token: terminalNode.symbol,
        };
    }

    return undefined;
} 