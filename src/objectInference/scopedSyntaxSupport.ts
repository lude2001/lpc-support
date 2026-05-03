import * as vscode from 'vscode';
import type { Token } from 'antlr4ts';
import type { SyntaxDocument, SyntaxNode } from '../syntax/types';

const BARE_SCOPE_BOUNDARY_TOKENS = new Set(['(', '[', '{', ';', ',', ':', '=']);

export function isBareScopedPrefixSupportedByTokens(
    document: vscode.TextDocument,
    syntax: SyntaxDocument,
    node: SyntaxNode
): boolean {
    const startOffset = document.offsetAt(node.range.start);
    if (startOffset <= 0) {
        return true;
    }

    const previousToken = findPreviousVisibleToken(syntax.parsed.visibleTokens, startOffset);
    if (!previousToken) {
        return true;
    }

    if (previousToken.stopIndex + 1 < startOffset) {
        return true;
    }

    return BARE_SCOPE_BOUNDARY_TOKENS.has(previousToken.text ?? '');
}

function findPreviousVisibleToken(tokens: readonly Token[], startOffset: number): Token | undefined {
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token.stopIndex >= 0 && token.stopIndex < startOffset) {
            return token;
        }
    }

    return undefined;
}
