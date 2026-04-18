import * as fs from 'fs';
import * as path from 'path';
import { Token } from 'antlr4ts';
import * as vscode from 'vscode';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { SymbolType } from '../../../ast/symbolTable';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { DocumentSemanticSnapshot } from '../../../semantic/documentSemanticTypes';
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

const KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'foreach', 'inherit', 'in', 'new',
    'private', 'public', 'protected', 'varargs', 'nosave', 'static', 'nomask'
]);

const TYPE_KEYWORDS = new Set([
    'int', 'float', 'string', 'object', 'mixed', 'mapping', 'function',
    'buffer', 'void', 'struct'
]);

const TYPE_TOKENS = new Set<number>([
    LPCLexer.KW_INT,
    LPCLexer.KW_FLOAT,
    LPCLexer.KW_STRING,
    LPCLexer.KW_OBJECT,
    LPCLexer.KW_MIXED,
    LPCLexer.KW_MAPPING,
    LPCLexer.KW_FUNCTION,
    LPCLexer.KW_BUFFER,
    LPCLexer.KW_VOID,
    LPCLexer.KW_STRUCT,
    LPCLexer.KW_CLASS
]);

const TOKEN_TYPE_MAP: Record<number, string> = {
    [LPCLexer.STRING_LITERAL]: TOKEN_TYPES.string,
    [LPCLexer.CHAR_LITERAL]: TOKEN_TYPES.string,
    [LPCLexer.INTEGER]: TOKEN_TYPES.number,
    [LPCLexer.FLOAT]: TOKEN_TYPES.number,
    [LPCLexer.LINE_COMMENT]: TOKEN_TYPES.comment,
    [LPCLexer.BLOCK_COMMENT]: TOKEN_TYPES.comment,
    [LPCLexer.INC]: TOKEN_TYPES.operator,
    [LPCLexer.DEC]: TOKEN_TYPES.operator,
    [LPCLexer.PLUS_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.MINUS_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.STAR_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.DIV_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.PERCENT_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.PLUS]: TOKEN_TYPES.operator,
    [LPCLexer.MINUS]: TOKEN_TYPES.operator,
    [LPCLexer.STAR]: TOKEN_TYPES.operator,
    [LPCLexer.DIV]: TOKEN_TYPES.operator,
    [LPCLexer.PERCENT]: TOKEN_TYPES.operator,
    [LPCLexer.SCOPE]: TOKEN_TYPES.operator,
    [LPCLexer.ELLIPSIS]: TOKEN_TYPES.operator,
    [LPCLexer.RANGE_OP]: TOKEN_TYPES.operator,
    [LPCLexer.ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.GT]: TOKEN_TYPES.operator,
    [LPCLexer.LT]: TOKEN_TYPES.operator,
    [LPCLexer.GE]: TOKEN_TYPES.operator,
    [LPCLexer.LE]: TOKEN_TYPES.operator,
    [LPCLexer.EQ]: TOKEN_TYPES.operator,
    [LPCLexer.NE]: TOKEN_TYPES.operator,
    [LPCLexer.AND]: TOKEN_TYPES.operator,
    [LPCLexer.OR]: TOKEN_TYPES.operator,
    [LPCLexer.NOT]: TOKEN_TYPES.operator,
    [LPCLexer.BIT_AND]: TOKEN_TYPES.operator,
    [LPCLexer.BIT_OR]: TOKEN_TYPES.operator,
    [LPCLexer.BIT_XOR]: TOKEN_TYPES.operator,
    [LPCLexer.BIT_NOT]: TOKEN_TYPES.operator,
    [LPCLexer.BIT_OR_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.BIT_AND_ASSIGN]: TOKEN_TYPES.operator,
    [LPCLexer.SHIFT_LEFT]: TOKEN_TYPES.operator,
    [LPCLexer.SHIFT_RIGHT]: TOKEN_TYPES.operator
};

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
        private readonly analysisService?: Pick<DocumentAnalysisService, 'parseDocument'>
    ) {}

    public async provideSemanticTokens(
        request: LanguageSemanticTokensRequest
    ): Promise<LanguageSemanticTokensResult> {
        const document = request.context.document;
        const analysis = requireLanguageSemanticTokensAnalysisService(this.analysisService).parseDocument(document as any);
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

            const length = (token.text ?? '').length;
            if (length === 0) {
                continue;
            }

            semanticTokens.push({
                line: token.line - 1,
                startCharacter: token.charPositionInLine,
                length,
                tokenType
            });
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
        token: Token,
        tokenIndex: number,
        tokens: Token[],
        snapshot: DocumentSemanticSnapshot
    ): string | undefined {
        if (token.type === LPCLexer.Identifier) {
            return this.classifyIdentifier(token, tokenIndex, tokens, snapshot);
        }

        if (TYPE_TOKENS.has(token.type)) {
            return TOKEN_TYPES.type;
        }

        if (token.type === LPCLexer.KW_NEW || token.type === LPCLexer.MODIFIER) {
            return TOKEN_TYPES.keyword;
        }

        if (token.type >= LPCLexer.IF && token.type <= LPCLexer.IN) {
            return TOKEN_TYPES.keyword;
        }

        return TOKEN_TYPE_MAP[token.type];
    }

    private classifyIdentifier(
        token: Token,
        tokenIndex: number,
        tokens: Token[],
        snapshot: DocumentSemanticSnapshot
    ): string {
        const text = token.text ?? '';
        const lowerText = text.toLowerCase();

        if (/^[A-Z_][A-Z0-9_]*$/.test(text)) {
            return TOKEN_TYPES.macro;
        }

        if (EFUNS.has(text)) {
            return TOKEN_TYPES.builtin;
        }

        if (KEYWORDS.has(lowerText)) {
            return TOKEN_TYPES.keyword;
        }

        if (TYPE_KEYWORDS.has(lowerText)) {
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

    private getContextualIdentifierType(tokenIndex: number, tokens: Token[]): string {
        const previousToken = this.findAdjacentDefaultToken(tokens, tokenIndex, -1);
        if (previousToken && (previousToken.type === LPCLexer.ARROW || previousToken.type === LPCLexer.DOT)) {
            return TOKEN_TYPES.property;
        }

        const nextToken = this.findAdjacentDefaultToken(tokens, tokenIndex, 1);
        if (nextToken && nextToken.type === LPCLexer.LPAREN) {
            return TOKEN_TYPES.function;
        }

        return TOKEN_TYPES.variable;
    }

    private findAdjacentDefaultToken(tokens: Token[], tokenIndex: number, direction: -1 | 1): Token | undefined {
        for (
            let currentIndex = tokenIndex + direction;
            currentIndex >= 0 && currentIndex < tokens.length;
            currentIndex += direction
        ) {
            const token = tokens[currentIndex];
            if (token.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL) {
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

function requireLanguageSemanticTokensAnalysisService(
    service?: Pick<DocumentAnalysisService, 'parseDocument'>
): Pick<DocumentAnalysisService, 'parseDocument'> {
    if (!service) {
        throw new Error('Language semantic tokens analysis service has not been configured');
    }

    return service;
}
