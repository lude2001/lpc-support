import { Token } from 'antlr4ts';
import * as vscode from 'vscode';
import { LPCLexer } from '../antlr/LPCLexer';
import { ParsedDocument, TokenTriviaAccessor, Trivia, TriviaKind } from './types';

export class TokenTriviaIndex implements TokenTriviaAccessor {
    private readonly allTrivia: Trivia[];
    private readonly triviaByHiddenTokenIndex = new Map<number, Trivia[]>();
    private readonly hiddenTokenIndexes = new Set<number>();
    private readonly visibleTokenIndexes: number[];
    private readonly lineStartOffsets: number[];

    constructor(private readonly parsed: ParsedDocument) {
        this.lineStartOffsets = buildLineStartOffsets(parsed.parseText);
        this.visibleTokenIndexes = parsed.visibleTokens.map((token) => token.tokenIndex).filter(isDefined);
        this.allTrivia = this.buildTriviaEntries(parsed.hiddenTokens);
    }

    public getLeadingTrivia(tokenIndex: number): Trivia[] {
        const previousVisibleTokenIndex = this.findPreviousVisibleTokenIndex(tokenIndex);
        return this.getInterveningTrivia(previousVisibleTokenIndex, tokenIndex);
    }

    public getTrailingTrivia(tokenIndex: number): Trivia[] {
        const nextVisibleTokenIndex = this.findNextVisibleTokenIndex(tokenIndex);
        return this.getInterveningTrivia(tokenIndex, nextVisibleTokenIndex);
    }

    public getInterveningTrivia(startTokenIndex: number, endTokenIndex: number): Trivia[] {
        if (endTokenIndex <= startTokenIndex + 1) {
            return [];
        }

        const trivia: Trivia[] = [];
        for (const entry of this.allTrivia) {
            if (entry.tokenIndex > startTokenIndex && entry.tokenIndex < endTokenIndex) {
                trivia.push(entry);
            }
        }

        return trivia;
    }

    public getTriviaForHiddenToken(tokenIndex: number): Trivia[] {
        return [...(this.triviaByHiddenTokenIndex.get(tokenIndex) || [])];
    }

    public getAllTrivia(): Trivia[] {
        return [...this.allTrivia];
    }

    private buildTriviaEntries(hiddenTokens: Token[]): Trivia[] {
        const entries: Trivia[] = [];

        for (const token of hiddenTokens) {
            if (!isDefined(token.tokenIndex)) {
                continue;
            }

            this.hiddenTokenIndexes.add(token.tokenIndex);
            const tokenEntries = this.createTriviaEntriesForToken(token);
            this.triviaByHiddenTokenIndex.set(token.tokenIndex, tokenEntries);
            entries.push(...tokenEntries);
        }

        return entries;
    }

    private createTriviaEntriesForToken(token: Token): Trivia[] {
        const text = token.text ?? '';
        if (!text) {
            return [];
        }

        if (token.type === LPCLexer.WS) {
            return this.splitWhitespaceToken(token, text);
        }

        const kind = this.getTriviaKindForToken(token.type);
        if (!kind) {
            return [];
        }

        return [
            this.createTrivia(
                kind,
                text,
                token.tokenIndex,
                token.startIndex,
                token.stopIndex + 1
            )
        ];
    }

    private splitWhitespaceToken(token: Token, text: string): Trivia[] {
        const entries: Trivia[] = [];
        let segmentStart = 0;
        let index = 0;

        while (index < text.length) {
            const char = text[index];
            if (char === '\r' || char === '\n') {
                if (segmentStart < index) {
                    entries.push(this.createTriviaFromSegment(token, text, 'whitespace', segmentStart, index));
                }

                const newlineStart = index;
                index++;
                if (char === '\r' && text[index] === '\n') {
                    index++;
                }

                entries.push(this.createTriviaFromSegment(token, text, 'newline', newlineStart, index));
                segmentStart = index;
                continue;
            }

            index++;
        }

        if (segmentStart < text.length) {
            entries.push(this.createTriviaFromSegment(token, text, 'whitespace', segmentStart, text.length));
        }

        return entries;
    }

    private createTriviaFromSegment(
        token: Token,
        tokenText: string,
        kind: TriviaKind,
        segmentStart: number,
        segmentEnd: number
    ): Trivia {
        return this.createTrivia(
            kind,
            tokenText.slice(segmentStart, segmentEnd),
            token.tokenIndex,
            token.startIndex + segmentStart,
            token.startIndex + segmentEnd
        );
    }

    private createTrivia(
        kind: TriviaKind,
        text: string,
        tokenIndex: number,
        startOffset: number,
        endOffset: number
    ): Trivia {
        return {
            kind,
            text,
            range: new vscode.Range(
                positionAt(this.lineStartOffsets, startOffset),
                positionAt(this.lineStartOffsets, endOffset)
            ),
            tokenIndex,
            startOffset,
            endOffset
        };
    }

    private getTriviaKindForToken(tokenType: number): TriviaKind | undefined {
        switch (tokenType) {
            case LPCLexer.LINE_COMMENT:
                return 'line-comment';
            case LPCLexer.BLOCK_COMMENT:
                return 'block-comment';
            case LPCLexer.DIRECTIVE:
                return 'directive';
            default:
                return undefined;
        }
    }

    private findPreviousVisibleTokenIndex(tokenIndex: number): number {
        let previous = -1;
        for (const visibleIndex of this.visibleTokenIndexes) {
            if (visibleIndex >= tokenIndex) {
                break;
            }
            previous = visibleIndex;
        }

        return previous;
    }

    private findNextVisibleTokenIndex(tokenIndex: number): number {
        for (const visibleIndex of this.visibleTokenIndexes) {
            if (visibleIndex > tokenIndex) {
                return visibleIndex;
            }
        }

        return Number.MAX_SAFE_INTEGER;
    }
}

function buildLineStartOffsets(text: string): number[] {
    const offsets = [0];

    for (let index = 0; index < text.length; index++) {
        if (text[index] === '\n') {
            offsets.push(index + 1);
        }
    }

    return offsets;
}

function positionAt(lineStartOffsets: number[], offset: number): vscode.Position {
    const normalizedOffset = Math.max(0, offset);
    let low = 0;
    let high = lineStartOffsets.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineStartOffsets[mid] > normalizedOffset) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    const line = Math.max(0, high);
    return new vscode.Position(line, normalizedOffset - lineStartOffsets[line]);
}

function isDefined(value: number | undefined): value is number {
    return value !== undefined && value !== null;
}
