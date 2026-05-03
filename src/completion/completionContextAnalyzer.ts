import * as vscode from 'vscode';
import { Token } from 'antlr4ts';
import { LPCParser } from '../antlr/LPCParser';
import { CompletionQueryContext } from './types';
import { FrontendCursorContextService } from '../frontend/FrontendCursorContextService';
import { getGlobalLpcFrontendService } from '../frontend/LpcFrontendService';
import { getGlobalParsedDocumentService } from '../parser/ParsedDocumentService';
import type { ParsedDocument } from '../parser/types';

const TYPE_KEYWORDS = new Set(['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer', 'struct', 'class']);
const MODIFIERS = new Set(['private', 'protected', 'public', 'static', 'nomask', 'varargs']);
const NON_CALL_PAREN_KEYWORDS = new Set(['return', 'if', 'while', 'for', 'switch', 'catch']);

interface ReceiverContext {
    receiverChain: string[];
    receiverExpression?: string;
}

interface ScopedContext {
    currentWord: string;
    receiverExpression: string;
}

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
        const documentPrefix = this.extractDocumentPrefix(document, position);
        const trimmedPrefix = linePrefix.trimLeft();
        const currentWord = this.extractCurrentWord(linePrefix);
        const frontendContext = this.frontendCursorContext.analyze(document, position);

        if (frontendContext.kind === 'include-path' || this.isIncludePathContext(trimmedPrefix)) {
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

        if (this.isInheritPathContext(trimmedPrefix)) {
            return {
                kind: 'inherit-path',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        const scopedContext = this.extractScopedContext(linePrefix, documentPrefix);
        if (scopedContext) {
            return {
                kind: 'scoped-member',
                receiverChain: [],
                receiverExpression: scopedContext.receiverExpression,
                currentWord: scopedContext.currentWord,
                linePrefix
            };
        }

        const receiverContext = this.extractReceiverContext(document, position, linePrefix);
        if (receiverContext.receiverChain.length > 0 || receiverContext.receiverExpression) {
            return {
                kind: 'member',
                receiverChain: receiverContext.receiverChain,
                receiverExpression: receiverContext.receiverExpression,
                currentWord,
                linePrefix
            };
        }

        if (this.isPreprocessorContext(trimmedPrefix)) {
            return {
                kind: 'preprocessor',
                receiverChain: [],
                currentWord,
                linePrefix
            };
        }

        if (this.isTypePositionContext(linePrefix)) {
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

    private extractDocumentPrefix(document: vscode.TextDocument, position: vscode.Position): string {
        const lines: string[] = [];
        for (let line = 0; line < position.line; line += 1) {
            lines.push(document.lineAt(line).text);
        }

        lines.push(document.lineAt(position).text.slice(0, position.character));
        return lines.join('\n');
    }

    private extractScopedContext(linePrefix: string, documentPrefix: string): ScopedContext | undefined {
        const bareMatch = linePrefix.match(/(?:^|[\s([{\],;:=])::([A-Za-z_][A-Za-z0-9_]*)$/);
        if (bareMatch) {
            const scopedStart = bareMatch.index! + bareMatch[0].lastIndexOf('::');
            if (this.isInsideCallArguments(this.extractPrefixBeforeScoped(documentPrefix, linePrefix, scopedStart))) {
                return undefined;
            }

            return {
                currentWord: bareMatch[1],
                receiverExpression: '::'
            };
        }

        const namedMatch = linePrefix.match(/([A-Za-z_][A-Za-z0-9_]*)::([A-Za-z_][A-Za-z0-9_]*)$/);
        if (namedMatch) {
            const scopedStart = namedMatch.index!;
            if (this.isInsideCallArguments(this.extractPrefixBeforeScoped(documentPrefix, linePrefix, scopedStart))) {
                return undefined;
            }

            return {
                currentWord: namedMatch[2],
                receiverExpression: `${namedMatch[1]}::`
            };
        }

        return undefined;
    }

    private extractPrefixBeforeScoped(documentPrefix: string, linePrefix: string, scopedStart: number): string {
        const scopedSuffixLength = linePrefix.length - scopedStart;
        return documentPrefix.slice(0, documentPrefix.length - scopedSuffixLength);
    }

    private isInsideCallArguments(prefixBeforeScoped: string): boolean {
        for (const unmatchedParenIndex of this.findUnmatchedParenIndices(prefixBeforeScoped)) {
            if (this.isCallArgumentParen(prefixBeforeScoped, unmatchedParenIndex)) {
                return true;
            }
        }

        return false;
    }

    private isCallArgumentParen(text: string, openParenIndex: number): boolean {
        const beforeParen = text.slice(0, openParenIndex).trimEnd();
        if (!beforeParen) {
            return false;
        }

        const previousCharacter = beforeParen[beforeParen.length - 1];
        if (!/[A-Za-z0-9_\])}]/.test(previousCharacter)) {
            return false;
        }

        const tokenMatch = beforeParen.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
        if (!tokenMatch) {
            return true;
        }

        return !NON_CALL_PAREN_KEYWORDS.has(tokenMatch[1]);
    }

    private findUnmatchedParenIndices(text: string): number[] {
        const stack: number[] = [];
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;

        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            if (escaped) {
                escaped = false;
                continue;
            }

            if (character === '\\') {
                escaped = true;
                continue;
            }

            if (character === '\'' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
                continue;
            }

            if (character === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
                continue;
            }

            if (inSingleQuote || inDoubleQuote) {
                continue;
            }

            if (character === '(') {
                stack.push(index);
                continue;
            }

            if (character === ')' && stack.length > 0) {
                stack.pop();
            }
        }

        return stack;
    }

    private extractReceiverContext(
        document: vscode.TextDocument,
        position: vscode.Position,
        linePrefix: string
    ): ReceiverContext {
        const tokenBackedContext = this.extractTokenBackedReceiverContext(document, position);
        if (tokenBackedContext) {
            return tokenBackedContext;
        }

        const match = linePrefix.match(/(.+)\s*->\s*[A-Za-z0-9_]*$/);
        if (!match) {
            return { receiverChain: [] };
        }

        const receiverExpression = match[1].trim();
        if (!receiverExpression) {
            return { receiverChain: [] };
        }

        if (/^[A-Za-z_][A-Za-z0-9_]*(?:\s*->\s*[A-Za-z_][A-Za-z0-9_]*)*$/.test(receiverExpression)) {
            return {
                receiverChain: receiverExpression.split('->').map(part => part.trim()).filter(Boolean)
            };
        }

        return {
            receiverChain: [],
            receiverExpression
        };
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
        const arrowTokenIndex = findLastTokenIndexBeforeOffset(
            parsed.visibleTokens,
            '->',
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
        try {
            return this.parsedDocumentService.get(document);
        } catch {
            return undefined;
        }
    }

    private isPreprocessorContext(trimmedPrefix: string): boolean {
        return /^#/.test(trimmedPrefix);
    }

    private isInheritPathContext(trimmedPrefix: string): boolean {
        return /^inherit\s+/.test(trimmedPrefix);
    }

    private isIncludePathContext(trimmedPrefix: string): boolean {
        return /^(#\s*)?include\s+/.test(trimmedPrefix);
    }

    private isTypePositionContext(linePrefix: string): boolean {
        const trimmed = linePrefix.trim();
        if (!trimmed || /[;=(),>#]/.test(trimmed)) {
            return false;
        }

        const tokens = trimmed.split(/\s+/).filter(Boolean);
        if (tokens.length === 0) {
            return false;
        }

        let index = 0;
        while (index < tokens.length && MODIFIERS.has(tokens[index])) {
            index += 1;
        }

        if (index >= tokens.length) {
            return false;
        }

        const token = tokens[index];
        if (TYPE_KEYWORDS.has(token)) {
            return true;
        }

        return token === 'class' || token === 'struct';
    }
}

function findLastTokenIndexBeforeOffset(
    tokens: readonly Token[],
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

function findReceiverStartTokenIndex(tokens: readonly Token[], arrowTokenIndex: number): number {
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

        if (depth === 0 && isReceiverBoundary(tokens[index])) {
            return index + 1;
        }
    }

    return 0;
}

function buildSimpleReceiverChain(tokens: readonly Token[]): string[] {
    const chain: string[] = [];
    let expectIdentifier = true;

    for (const token of tokens) {
        if (expectIdentifier) {
            if (token.type !== LPCParser.Identifier || !token.text) {
                return [];
            }

            chain.push(token.text);
            expectIdentifier = false;
            continue;
        }

        if (token.text !== '->') {
            return [];
        }
        expectIdentifier = true;
    }

    return expectIdentifier ? [] : chain;
}

function isReceiverBoundary(token: Token): boolean {
    const tokenText = token.text ?? '';
    return tokenText === ';'
        || tokenText === ','
        || tokenText === '{'
        || tokenText === '}'
        || tokenText === '='
        || tokenText === '?'
        || tokenText === ':'
        || token.type === LPCParser.RETURN
        || token.type === LPCParser.IF
        || token.type === LPCParser.WHILE
        || token.type === LPCParser.FOR
        || token.type === LPCParser.FOREACH
        || token.type === LPCParser.SWITCH;
}

function isOpeningDelimiter(tokenText: string): boolean {
    return tokenText === '(' || tokenText === '[';
}

function isClosingDelimiter(tokenText: string): boolean {
    return tokenText === ')' || tokenText === ']';
}
