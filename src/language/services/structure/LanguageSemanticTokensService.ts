import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Symbol, SymbolType } from '../../../ast/symbolTable';
import {
    isLpcBuiltinType,
    isLpcKeyword
} from '../../../frontend/languageFacts';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { DocumentSemanticSnapshot } from '../../../semantic/documentSemanticTypes';
import {
    classifyLexicalSemanticToken,
    isDefaultChannelToken,
    isIdentifierToken,
    type LpcTokenLike
} from '../../../parser/LpcTokenFacts';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import {
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS,
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES
} from './semanticTokenLegend';

export {
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS,
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES
} from './semanticTokenLegend';

export interface LanguageSemanticToken {
    line: number;
    startCharacter: number;
    length: number;
    tokenType: string;
    tokenModifiers?: string[];
}

export interface LanguageSemanticTokensLegend {
    tokenTypes: string[];
    tokenModifiers: string[];
}

export interface LanguageSemanticTokensRequest {
    context: LanguageCapabilityContext;
}

export interface LanguageSemanticTokensResult {
    legend: LanguageSemanticTokensLegend;
    tokens: LanguageSemanticToken[];
}

export interface LanguageSemanticTokensService {
    provideSemanticTokens(
        request: LanguageSemanticTokensRequest
    ): Promise<LanguageSemanticTokensResult>;
}

interface HostPosition {
    line: number;
    character: number;
}

const TOKEN_TYPES = {
    keyword: 'keyword',
    type: 'lpcType',
    variable: 'variable',
    parameter: 'parameter',
    function: 'function',
    method: 'method',
    property: 'property',
    macro: 'macro',
    builtin: 'builtin',
    number: 'number',
    string: 'string',
    comment: 'comment',
    operator: 'operator',
    inactive: 'inactive'
} as const;

interface ClassifiedSemanticToken {
    tokenType: string;
    tokenModifiers?: string[];
}

interface InactiveRangeLike {
    startOffset: number;
    endOffset: number;
}

export function resolveSemanticTokensConfigPath(
    runtimeDir: string = __dirname,
    cwd: string = process.cwd()
): string | undefined {
    const visited = new Set<string>();
    const rootsToSearch = [path.resolve(runtimeDir), path.resolve(cwd)];

    for (const root of rootsToSearch) {
        let current = root;

        while (!visited.has(current)) {
            visited.add(current);
            const candidate = path.join(current, 'config', 'lpc-config.json');
            if (fs.existsSync(candidate)) {
                return candidate;
            }

            const parent = path.dirname(current);
            if (parent === current) {
                break;
            }

            current = parent;
        }
    }

    return undefined;
}

export function loadConfiguredEfunNames(runtimeDir: string = __dirname): Set<string> {
    try {
        const configPath = resolveSemanticTokensConfigPath(runtimeDir);
        if (!configPath) {
            return new Set<string>();
        }

        const raw = fs.readFileSync(configPath, 'utf-8');
        const data = JSON.parse(raw);

        if (data && data.efuns) {
            return new Set(Object.keys(data.efuns));
        }
    } catch {}

    return new Set<string>();
}

const EFUNS = loadConfiguredEfunNames();

export class DefaultLanguageSemanticTokensService implements LanguageSemanticTokensService {
    public constructor(
        private readonly analysisService: Pick<DocumentAnalysisService, 'parseDocument'>
    ) {}

    public async provideSemanticTokens(
        request: LanguageSemanticTokensRequest
    ): Promise<LanguageSemanticTokensResult> {
        const document = request.context.document;
        const analysis = assertAnalysisService(
            'DefaultLanguageSemanticTokensService',
            this.analysisService
        ).parseDocument(document as any);
        const parsed = analysis.parsed;

        if (!parsed) {
            return {
                legend: {
                    tokenTypes: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                    tokenModifiers: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
                },
                tokens: []
            };
        }

        parsed.tokens.fill();
        const tokens = parsed.tokens.getTokens();
        const semanticTokens: LanguageSemanticToken[] = [];
        const context = new SemanticTokenContext(document.getText(), analysis.snapshot, parsed);

        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            if (context.isTokenInactive(token)) {
                continue;
            }

            const classification = this.classifyToken(token, index, tokens, context);
            if (!classification) {
                continue;
            }

            semanticTokens.push(...this.createSemanticTokens(token, classification));
        }

        semanticTokens.push(...context.createInactiveTokens());
        semanticTokens.sort((left, right) =>
            left.line - right.line || left.startCharacter - right.startCharacter || left.length - right.length
        );

        return {
            legend: {
                tokenTypes: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                tokenModifiers: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
            },
            tokens: semanticTokens
        };
    }

    private classifyToken(
        token: LpcTokenLike,
        tokenIndex: number,
        tokens: LpcTokenLike[],
        context: SemanticTokenContext
    ): ClassifiedSemanticToken | undefined {
        if (isIdentifierToken(token)) {
            return this.classifyIdentifier(token, tokenIndex, tokens, context);
        }

        const tokenType = normalizeLexicalTokenType(classifyLexicalSemanticToken(token));
        return tokenType ? { tokenType } : undefined;
    }

    private createSemanticTokens(token: LpcTokenLike, classification: ClassifiedSemanticToken): LanguageSemanticToken[] {
        const text = token.text ?? '';
        if (text.length === 0) {
            return [];
        }

        const lines = text.split(/\r\n|\r|\n/);
        if (lines.length === 1) {
            return [
                {
                    line: token.line - 1,
                    startCharacter: token.charPositionInLine,
                    length: text.length,
                    tokenType: classification.tokenType,
                    ...createModifierData(classification.tokenModifiers)
                }
            ];
        }

        const tokens: LanguageSemanticToken[] = [];
        for (let index = 0; index < lines.length; index++) {
            const length = lines[index].length;
            if (length === 0) {
                continue;
            }

            tokens.push({
                line: token.line - 1 + index,
                startCharacter: index === 0 ? token.charPositionInLine : 0,
                length,
                tokenType: classification.tokenType,
                ...createModifierData(classification.tokenModifiers)
            });
        }

        return tokens;
    }

    private classifyIdentifier(
        token: LpcTokenLike,
        tokenIndex: number,
        tokens: LpcTokenLike[],
        context: SemanticTokenContext
    ): ClassifiedSemanticToken {
        const text = token.text ?? '';
        const lowerText = text.toLowerCase();

        if (this.isMacroReference(token, context.snapshot)) {
            return {
                tokenType: TOKEN_TYPES.macro,
                tokenModifiers: context.getModifiersForToken(token, SymbolType.VARIABLE)
            };
        }

        if (EFUNS.has(text)) {
            return { tokenType: TOKEN_TYPES.builtin, tokenModifiers: ['defaultLibrary'] };
        }

        if (isLpcKeyword(lowerText)) {
            return { tokenType: TOKEN_TYPES.keyword };
        }

        if (isLpcBuiltinType(lowerText)) {
            return { tokenType: TOKEN_TYPES.type };
        }

        const contextualType = this.getContextualIdentifierType(tokenIndex, tokens);
        if (contextualType === TOKEN_TYPES.method || contextualType === TOKEN_TYPES.property) {
            return {
                tokenType: contextualType,
                tokenModifiers: context.getModifiersForToken(token, SymbolType.MEMBER)
            };
        }

        const symbol = context.snapshot.symbolTable.findSymbol(
            text,
            createHostPosition(token.line - 1, token.charPositionInLine) as any
        );
        if (symbol) {
            const tokenType = this.getTokenTypeFromSymbol(symbol.type);
            return {
                tokenType,
                tokenModifiers: context.getModifiersForToken(token, symbol.type, symbol)
            };
        }

        return {
            tokenType: contextualType,
            tokenModifiers: context.getModifiersForToken(token, SymbolType.VARIABLE)
        };
    }

    private isMacroReference(token: LpcTokenLike, snapshot: DocumentSemanticSnapshot): boolean {
        const text = token.text ?? '';
        if (!Array.isArray(snapshot.macroReferences) || !text) {
            return false;
        }

        return snapshot.macroReferences.some((reference) => (
            reference.name === text
            && reference.range.start.line === token.line - 1
            && reference.range.start.character === token.charPositionInLine
        ));
    }

    private getContextualIdentifierType(tokenIndex: number, tokens: LpcTokenLike[]): string {
        const previousToken = this.findAdjacentDefaultToken(tokens, tokenIndex, -1);
        if (previousToken && (previousToken.text === '->' || previousToken.text === '.')) {
            const nextToken = this.findAdjacentDefaultToken(tokens, tokenIndex, 1);
            return nextToken?.text === '(' ? TOKEN_TYPES.method : TOKEN_TYPES.property;
        }

        const nextToken = this.findAdjacentDefaultToken(tokens, tokenIndex, 1);
        if (nextToken && nextToken.text === '(') {
            return TOKEN_TYPES.function;
        }

        return TOKEN_TYPES.variable;
    }

    private findAdjacentDefaultToken(tokens: LpcTokenLike[], tokenIndex: number, direction: -1 | 1): LpcTokenLike | undefined {
        for (
            let currentIndex = tokenIndex + direction;
            currentIndex >= 0 && currentIndex < tokens.length;
            currentIndex += direction
        ) {
            const token = tokens[currentIndex];
            if (isDefaultChannelToken(token)) {
                return token;
            }
        }

        return undefined;
    }

    private getTokenTypeFromSymbol(symbolType: SymbolType): string {
        switch (symbolType) {
            case SymbolType.FUNCTION:
                return TOKEN_TYPES.function;
            case SymbolType.STRUCT:
            case SymbolType.CLASS:
                return TOKEN_TYPES.type;
            case SymbolType.MEMBER:
                return TOKEN_TYPES.property;
            case SymbolType.PARAMETER:
                return TOKEN_TYPES.parameter;
            case SymbolType.VARIABLE:
            case SymbolType.INHERIT:
            default:
                return TOKEN_TYPES.variable;
        }
    }
}

function createHostPosition(line: number, character: number): HostPosition {
    return new vscode.Position(line, character);
}

function createModifierData(tokenModifiers: string[] | undefined): Pick<LanguageSemanticToken, 'tokenModifiers'> {
    return tokenModifiers && tokenModifiers.length > 0 ? { tokenModifiers } : {};
}

class SemanticTokenContext {
    private readonly lineStarts: number[];

    public constructor(
        private readonly text: string,
        public readonly snapshot: DocumentSemanticSnapshot,
        private readonly parsed: any
    ) {
        this.lineStarts = computeLineStarts(text);
    }

    public getModifiersForToken(
        token: LpcTokenLike,
        symbolType: SymbolType,
        symbol?: Symbol
    ): string[] {
        const modifiers = new Set<string>();
        const tokenRange = this.createTokenRange(token);
        const declarationRange = symbol?.selectionRange ?? symbol?.range;

        if (declarationRange && isSameRange(tokenRange, declarationRange)) {
            modifiers.add('declaration');
        }

        if (symbolType === SymbolType.PARAMETER) {
            modifiers.add('local');
            if (!declarationRange || isSameRange(tokenRange, declarationRange)) {
                modifiers.add('declaration');
            }
        }

        if (symbolType === SymbolType.VARIABLE) {
            if (this.isLocalSymbol(symbol)) {
                modifiers.add('local');
            }
            if (declarationRange && isSameRange(tokenRange, declarationRange)) {
                modifiers.add('declaration');
            }
        }

        if (symbolType === SymbolType.FUNCTION && declarationRange && isSameRange(tokenRange, declarationRange)) {
            modifiers.add('declaration');
        }

        return [...modifiers];
    }

    public createInactiveTokens(): LanguageSemanticToken[] {
        const ranges = this.getInactiveRanges();
        return ranges.flatMap((range) =>
            this.createTokensFromOffsets(range.startOffset, range.endOffset, TOKEN_TYPES.inactive)
        );
    }

    public isTokenInactive(token: LpcTokenLike): boolean {
        const startOffset = this.offsetAt(token.line - 1, token.charPositionInLine);
        return this.getInactiveRanges().some((range) =>
            startOffset >= range.startOffset && startOffset < range.endOffset
        );
    }

    private getInactiveRanges(): InactiveRangeLike[] {
        const ranges = this.parsed?.frontend?.preprocessor?.inactiveRanges;
        return Array.isArray(ranges) ? ranges : [];
    }

    private createTokensFromOffsets(startOffset: number, endOffset: number, tokenType: string): LanguageSemanticToken[] {
        const tokens: LanguageSemanticToken[] = [];
        const start = this.positionAt(startOffset);
        const end = this.positionAt(endOffset);

        for (let line = start.line; line <= end.line; line++) {
            const lineStartOffset = this.lineStarts[line] ?? this.text.length;
            const nextLineStartOffset = this.lineStarts[line + 1] ?? this.text.length;
            const lineEndOffset = trimLineBreakEnd(this.text, nextLineStartOffset);
            const startCharacter = line === start.line ? start.character : 0;
            const endCharacter = line === end.line ? end.character : lineEndOffset - lineStartOffset;
            const length = endCharacter - startCharacter;

            if (length > 0) {
                tokens.push({
                    line,
                    startCharacter,
                    length,
                    tokenType
                });
            }
        }

        return tokens;
    }

    private createTokenRange(token: LpcTokenLike): vscode.Range {
        const line = token.line - 1;
        const start = token.charPositionInLine;
        const text = token.text ?? '';
        return new vscode.Range(line, start, line, start + text.length);
    }

    private isLocalSymbol(symbol: Symbol | undefined): boolean {
        if (!symbol) {
            return false;
        }

        const globalScope = typeof this.snapshot.symbolTable.getGlobalScope === 'function'
            ? this.snapshot.symbolTable.getGlobalScope()
            : undefined;

        return Boolean(globalScope && symbol.scope && symbol.scope !== globalScope);
    }

    private positionAt(offset: number): vscode.Position {
        const boundedOffset = Math.max(0, Math.min(offset, this.text.length));
        let low = 0;
        let high = this.lineStarts.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.lineStarts[mid] > boundedOffset) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        const line = Math.max(0, low - 1);
        return new vscode.Position(line, boundedOffset - this.lineStarts[line]);
    }

    private offsetAt(line: number, character: number): number {
        return (this.lineStarts[line] ?? this.text.length) + character;
    }
}

function normalizeLexicalTokenType(tokenType: string | undefined): string | undefined {
    return tokenType === 'type' ? TOKEN_TYPES.type : tokenType;
}

function computeLineStarts(text: string): number[] {
    const starts = [0];
    for (let index = 0; index < text.length; index++) {
        const char = text.charCodeAt(index);
        if (char === 13) {
            if (text.charCodeAt(index + 1) === 10) {
                index++;
            }
            starts.push(index + 1);
        } else if (char === 10) {
            starts.push(index + 1);
        }
    }
    return starts;
}

function trimLineBreakEnd(text: string, lineEndOffset: number): number {
    if (lineEndOffset > 0 && text.charCodeAt(lineEndOffset - 1) === 10) {
        lineEndOffset--;
    }
    if (lineEndOffset > 0 && text.charCodeAt(lineEndOffset - 1) === 13) {
        lineEndOffset--;
    }
    return lineEndOffset;
}

function isSameRange(left: vscode.Range, right: vscode.Range): boolean {
    return left.start.line === right.start.line
        && left.start.character === right.start.character
        && left.end.line === right.end.line
        && left.end.character === right.end.character;
}
