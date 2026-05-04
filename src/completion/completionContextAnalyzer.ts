import * as vscode from 'vscode';
import { CompletionQueryContext } from './types';
import { FrontendCursorContextService } from '../frontend/FrontendCursorContextService';
import {
    isLpcBuiltinType,
    isLpcIdentifierLikeText,
    isLpcNonCallParenKeyword
} from '../frontend/languageFacts';
import { getGlobalLpcFrontendService } from '../frontend/LpcFrontendService';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import {
    isCallableExpressionEndToken,
    isEofToken,
    isIdentifierToken,
    isIncludeDirectiveToken,
    isInheritDirectiveToken,
    isLeftParenToken,
    isModifierToken,
    isReceiverBoundaryToken,
    isRightParenToken,
    isSemicolonToken,
    isTypeKeywordToken,
    isTypePositionBoundaryToken,
    type LpcTokenLike
} from '../parser/LpcTokenFacts';
import type { ParsedDocument } from '../parser/types';

interface ReceiverContext {
    receiverChain: string[];
    receiverExpression?: string;
}

interface ScopedContext {
    currentWord: string;
    receiverExpression: string;
}

type ScopedContextResult = ScopedContext | null | undefined;

export class CompletionContextAnalyzer {
    private readonly frontendCursorContext: FrontendCursorContextService;
    private readonly parsedDocumentService: { get(document: vscode.TextDocument): ParsedDocument };

    public constructor(
        frontendCursorContext?: FrontendCursorContextService,
        parsedDocumentService?: { get(document: vscode.TextDocument): ParsedDocument }
    ) {
        this.frontendCursorContext = frontendCursorContext
            ?? new FrontendCursorContextService(getGlobalLpcFrontendService());
        this.parsedDocumentService = parsedDocumentService ?? getGlobalParsedDocumentService();
    }

    public analyze(document: vscode.TextDocument, position: vscode.Position): CompletionQueryContext {
        const lineText = document.lineAt(position).text;
        const linePrefix = lineText.slice(0, position.character);
        const currentWord = this.extractCurrentWord(linePrefix);
        const frontendContext = this.frontendCursorContext.analyze(document, position);

        if (frontendContext.kind === 'include-path' || this.isIncludePathContext(document, position)) {
            return {
                kind: 'include-path',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        if (frontendContext.kind === 'preprocessor') {
            return {
                kind: 'preprocessor',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        if (this.isInheritPathContext(document, position)) {
            return {
                kind: 'inherit-path',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        const scopedContext = this.extractScopedContext(document, position, linePrefix);
        if (scopedContext) {
            return {
                kind: 'scoped-member',
                receiverChain: [],
                receiverExpression: scopedContext.receiverExpression,
                currentWord: scopedContext.currentWord,
                linePrefix
            };
        }

        const receiverContext = this.extractReceiverContext(document, position);
        if (receiverContext.receiverChain.length > 0 || receiverContext.receiverExpression) {
            return {
                kind: 'member',
                receiverChain: receiverContext.receiverChain,
                receiverExpression: receiverContext.receiverExpression,
                currentWord,
                linePrefix
            };
        }

        if (this.isTypePositionContext(document, position)) {
            return {
                kind: 'type-position',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        return {
            kind: 'identifier',
            receiverChain: [],
            currentWord,
            linePrefix
        };
    }

    private extractCurrentWord(linePrefix: string): string {
        const match = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
        return match ? match[1] : '';
    }

    private extractScopedContext(
        document: vscode.TextDocument,
        position: vscode.Position,
        linePrefix: string
    ): ScopedContextResult {
        return this.extractTokenBackedScopedContext(document, position, linePrefix);
    }

    private extractTokenBackedScopedContext(
        document: vscode.TextDocument,
        position: vscode.Position,
        linePrefix: string
    ): ScopedContextResult {
        if (isInsideLineStringOrComment(linePrefix)) {
            return null;
        }

        const parsed = this.safeGetParsedDocument(document);
        if (!parsed) {
            return undefined;
        }

        const cursorOffset = document.offsetAt(position);
        const scopeTokenIndex = findLastTokenIndexBeforeOffset(
            parsed.visibleTokens,
            '::',
            cursorOffset,
            position.line + 1
        );
        if (scopeTokenIndex < 0) {
            return undefined;
        }

        const currentWord = this.extractCurrentWord(linePrefix);
        const scopeToken = parsed.visibleTokens[scopeTokenIndex];
        const tokensAfterScope = parsed.visibleTokens.filter((token) =>
            token.line === scopeToken.line
            && token.tokenIndex > scopeToken.tokenIndex
            && !isEofToken(token)
            && token.startIndex >= 0
            && token.startIndex < cursorOffset
        );
        if (!isScopedMemberNameSuffix(tokensAfterScope)) {
            return null;
        }

        if (this.isInsideCallArguments(parsed.visibleTokens, scopeTokenIndex)) {
            return null;
        }

        const qualifierToken = parsed.visibleTokens[scopeTokenIndex - 1];
        if (
            isIdentifierToken(qualifierToken)
            && qualifierToken.line === scopeToken.line
            && qualifierToken.stopIndex + 1 === scopeToken.startIndex
        ) {
            return {
                currentWord,
                receiverExpression: `${qualifierToken.text}::`
            };
        }

        return {
            currentWord,
            receiverExpression: '::'
        };
    }

    private isInsideCallArguments(tokens: readonly LpcTokenLike[], scopeTokenIndex: number): boolean {
        for (const openParenTokenIndex of findUnmatchedOpenParenTokenIndices(tokens, scopeTokenIndex)) {
            if (this.isCallArgumentParen(tokens, openParenTokenIndex)) {
                return true;
            }
        }

        return false;
    }

    private isCallArgumentParen(tokens: readonly LpcTokenLike[], openParenTokenIndex: number): boolean {
        const previousToken = tokens[openParenTokenIndex - 1];
        if (!previousToken) {
            return false;
        }

        return isCallableExpressionEndToken(previousToken)
            && !isLpcNonCallParenKeyword(previousToken.text ?? '');
    }

    private extractReceiverContext(
        document: vscode.TextDocument,
        position: vscode.Position
    ): ReceiverContext {
        const tokenBackedContext = this.extractTokenBackedReceiverContext(document, position);
        if (tokenBackedContext) {
            return tokenBackedContext;
        }

        return { receiverChain: [] };
    }

    private extractTokenBackedReceiverContext(
        document: vscode.TextDocument,
        position: vscode.Position
    ): ReceiverContext | undefined {
        const parsed = this.safeGetParsedDocument(document);
        if (!parsed) {
            return undefined;
        }

        const cursorOffset = document.offsetAt(position);
        const arrowTokenIndex = findLastMemberOperatorIndexBeforeOffset(
            parsed.visibleTokens,
            cursorOffset,
            position.line + 1
        );
        if (arrowTokenIndex < 0) {
            return undefined;
        }

        const receiverStartTokenIndex = findReceiverStartTokenIndex(parsed.visibleTokens, arrowTokenIndex);
        if (receiverStartTokenIndex < 0 || receiverStartTokenIndex >= arrowTokenIndex) {
            return undefined;
        }

        const arrowToken = parsed.visibleTokens[arrowTokenIndex];
        const receiverTokens = parsed.visibleTokens.slice(receiverStartTokenIndex, arrowTokenIndex);
        const receiverExpression = parsed.text.slice(receiverTokens[0].startIndex, arrowToken.startIndex).trim();
        if (!receiverExpression) {
            return undefined;
        }

        const receiverChain = buildSimpleReceiverChain(receiverTokens);
        if (receiverChain.length > 0) {
            return { receiverChain };
        }

        return {
            receiverChain: [],
            receiverExpression
        };
    }

    private safeGetParsedDocument(document: vscode.TextDocument): ParsedDocument | undefined {
        const parsed = this.parsedDocumentService.get(document);
        if (parsed.degraded) {
            throw new Error(`Parsed document is degraded: ${parsed.failureReason ?? document.uri.toString()}`);
        }

        return parsed;
    }

    private isInheritPathContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const tokens = this.getVisibleLineTokensBeforeCursor(document, position);
        return this.isDirectiveLikePathContext(tokens, isInheritDirectiveToken);
    }

    private isIncludePathContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const tokens = this.getVisibleLineTokensBeforeCursor(document, position);
        return this.isDirectiveLikePathContext(tokens, isIncludeDirectiveToken);
    }

    private isDirectiveLikePathContext(
        tokens: readonly LpcTokenLike[],
        isDirectiveToken: (token: LpcTokenLike | undefined) => boolean
    ): boolean {
        const firstToken = tokens[0];
        return isDirectiveToken(firstToken) && !tokens.some(isSemicolonToken);
    }

    private isTypePositionContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const tokens = this.getVisibleLineTokensBeforeCursor(document, position);
        if (tokens.length === 0 || tokens.some((token) => isTypePositionBoundaryToken(token))) {
            return false;
        }

        let index = 0;
        while (index < tokens.length && isModifierToken(tokens[index])) {
            index += 1;
        }

        if (index >= tokens.length) {
            return index > 0;
        }

        const token = tokens[index];
        if (isLpcTypeToken(token)) {
            return true;
        }

        return isIdentifierToken(token) && isLpcBuiltinType(token.text ?? '');
    }

    private getVisibleLineTokensBeforeCursor(document: vscode.TextDocument, position: vscode.Position): LpcTokenLike[] {
        const parsed = this.safeGetParsedDocument(document);
        if (!parsed) {
            return [];
        }

        const cursorOffset = document.offsetAt(position);
        const antlrLine = position.line + 1;

        return parsed.visibleTokens.filter((token) =>
            !isEofToken(token)
            && token.line === antlrLine
            && token.startIndex >= 0
            && token.startIndex < cursorOffset
        );
    }
}

function findLastTokenIndexBeforeOffset(
    tokens: readonly LpcTokenLike[],
    tokenText: string,
    offset: number,
    line: number
): number {
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token.startIndex >= offset) {
            continue;
        }

        if (token.line === line && token.text === tokenText) {
            return index;
        }
    }

    return -1;
}

function findLastMemberOperatorIndexBeforeOffset(
    tokens: readonly LpcTokenLike[],
    offset: number,
    line: number
): number {
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const token = tokens[index];
        if (token.startIndex >= offset) {
            continue;
        }

        if (token.line === line && (token.text === '->' || token.text === '.')) {
            return index;
        }
    }

    return -1;
}

function findReceiverStartTokenIndex(tokens: readonly LpcTokenLike[], arrowTokenIndex: number): number {
    let depth = 0;
    const arrowLine = tokens[arrowTokenIndex].line;

    for (let index = arrowTokenIndex - 1; index >= 0; index -= 1) {
        const tokenText = tokens[index].text ?? '';

        if (depth === 0 && tokens[index].line < arrowLine) {
            return index + 1;
        }

        if (isClosingDelimiter(tokenText)) {
            depth += 1;
            continue;
        }

        if (isOpeningDelimiter(tokenText)) {
            if (depth > 0) {
                depth -= 1;
                continue;
            }

            return index + 1;
        }

            if (depth === 0 && isReceiverBoundaryToken(tokens[index])) {
            return index + 1;
        }
    }

    return 0;
}

function findUnmatchedOpenParenTokenIndices(tokens: readonly LpcTokenLike[], endTokenIndex: number): number[] {
    const stack: number[] = [];

    for (let index = 0; index < endTokenIndex; index += 1) {
        const token = tokens[index];
        if (isLeftParenToken(token)) {
            stack.push(index);
            continue;
        }

        if (isRightParenToken(token) && stack.length > 0) {
            stack.pop();
        }
    }

    return stack;
}

function buildSimpleReceiverChain(tokens: readonly LpcTokenLike[]): string[] {
    const chain: string[] = [];
    let expectIdentifier = true;

    for (const token of tokens) {
        if (expectIdentifier) {
            if (!isIdentifierToken(token) || !token.text) {
                return [];
            }

            chain.push(token.text);
            expectIdentifier = false;
            continue;
        }

        if (token.text !== '->' && token.text !== '.') {
            return [];
        }
        expectIdentifier = true;
    }

    return expectIdentifier ? [] : chain;
}

function isOpeningDelimiter(tokenText: string): boolean {
    return tokenText === '(' || tokenText === '[';
}

function isClosingDelimiter(tokenText: string): boolean {
    return tokenText === ')' || tokenText === ']';
}

function isScopedMemberNameSuffix(tokensAfterScope: readonly LpcTokenLike[]): boolean {
    return tokensAfterScope.length <= 1
        && tokensAfterScope.every((token) => isIdentifierLikeToken(token));
}

function isIdentifierLikeToken(token: LpcTokenLike): boolean {
    return isIdentifierToken(token) || isLpcIdentifierLikeText(token.text ?? undefined);
}

function isLpcTypeToken(token: LpcTokenLike): boolean {
    return isTypeKeywordToken(token);
}

function isInsideLineStringOrComment(linePrefix: string): boolean {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let index = 0; index < linePrefix.length; index += 1) {
        const character = linePrefix[index];
        const nextCharacter = linePrefix[index + 1];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (character === '\\') {
            escaped = true;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote && character === '/' && nextCharacter === '/') {
            return true;
        }

        if (character === '\'' && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (character === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
        }
    }

    return inSingleQuote || inDoubleQuote;
}
