import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SymbolType } from '../../../ast/symbolTable';
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

export const DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES = [
    'keyword',
    'type',
    'variable',
    'function',
    'property',
    'macro',
    'builtin',
    'number',
    'string',
    'comment',
    'operator'
];

export const DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS: string[] = [];

const TOKEN_TYPES = {
    keyword: 'keyword',
    type: 'type',
    variable: 'variable',
    function: 'function',
    property: 'property',
    macro: 'macro',
    builtin: 'builtin',
    number: 'number',
    string: 'string',
    comment: 'comment',
    operator: 'operator'
} as const;

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

        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            const tokenType = this.classifyToken(token, index, tokens, analysis.snapshot);
            if (!tokenType) {
                continue;
            }

            semanticTokens.push(...this.createSemanticTokens(token, tokenType));
        }

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
        snapshot: DocumentSemanticSnapshot
    ): string | undefined {
        if (isIdentifierToken(token)) {
            return this.classifyIdentifier(token, tokenIndex, tokens, snapshot);
        }

        return classifyLexicalSemanticToken(token);
    }

    private createSemanticTokens(token: LpcTokenLike, tokenType: string): LanguageSemanticToken[] {
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
                    tokenType
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
                tokenType
            });
        }

        return tokens;
    }

    private classifyIdentifier(
        token: LpcTokenLike,
        tokenIndex: number,
        tokens: LpcTokenLike[],
        snapshot: DocumentSemanticSnapshot
    ): string {
        const text = token.text ?? '';
        const lowerText = text.toLowerCase();

        if (this.isMacroReference(token, snapshot)) {
            return TOKEN_TYPES.macro;
        }

        if (EFUNS.has(text)) {
            return TOKEN_TYPES.builtin;
        }

        if (isLpcKeyword(lowerText)) {
            return TOKEN_TYPES.keyword;
        }

        if (isLpcBuiltinType(lowerText)) {
            return TOKEN_TYPES.type;
        }

        const symbol = snapshot.symbolTable.findSymbol(
            text,
            createHostPosition(token.line - 1, token.charPositionInLine) as any
        );
        if (symbol) {
            return this.getTokenTypeFromSymbol(symbol.type);
        }

        return this.getContextualIdentifierType(tokenIndex, tokens);
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
            return TOKEN_TYPES.property;
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
