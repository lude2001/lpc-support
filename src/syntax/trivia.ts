import * as vscode from 'vscode';
import type { Trivia as ParsedTrivia, TriviaKind as ParsedTriviaKind } from '../parser/types';

export type SyntaxTriviaKind = ParsedTriviaKind;
export type SyntaxTriviaPlacement = 'leading' | 'trailing' | 'detached';

export interface SyntaxTrivia {
    kind: SyntaxTriviaKind;
    text: string;
    range: vscode.Range;
    tokenIndex: number;
    startOffset: number;
    endOffset: number;
    placement: SyntaxTriviaPlacement;
    source: 'parser';
}

export interface SyntaxTriviaList {
    items: readonly SyntaxTrivia[];
    hasComments: boolean;
    hasDirectives: boolean;
    hasLayout: boolean;
}

export interface CreateSyntaxTriviaOptions {
    kind: SyntaxTriviaKind;
    text: string;
    range: vscode.Range;
    tokenIndex: number;
    startOffset: number;
    endOffset: number;
    placement?: SyntaxTriviaPlacement;
}

export function createSyntaxTrivia(options: CreateSyntaxTriviaOptions): SyntaxTrivia {
    return {
        kind: options.kind,
        text: options.text,
        range: options.range,
        tokenIndex: options.tokenIndex,
        startOffset: options.startOffset,
        endOffset: options.endOffset,
        placement: options.placement ?? 'detached',
        source: 'parser'
    };
}

export function syntaxTriviaFromParsedTrivia(
    trivia: ParsedTrivia,
    placement: SyntaxTriviaPlacement = 'detached'
): SyntaxTrivia {
    return createSyntaxTrivia({
        kind: trivia.kind,
        text: trivia.text,
        range: trivia.range,
        tokenIndex: trivia.tokenIndex,
        startOffset: trivia.startOffset,
        endOffset: trivia.endOffset,
        placement
    });
}

export function createSyntaxTriviaList(items: readonly SyntaxTrivia[] = []): SyntaxTriviaList {
    return {
        items,
        hasComments: items.some((item) => item.kind === 'line-comment' || item.kind === 'block-comment'),
        hasDirectives: items.some((item) => item.kind === 'directive'),
        hasLayout: items.some((item) => item.kind === 'whitespace' || item.kind === 'newline')
    };
}
