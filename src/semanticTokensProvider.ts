import * as fs from 'fs';
import { Token } from 'antlr4ts';
import * as vscode from 'vscode';
import { LPCLexer } from './antlr/LPCLexer';
import { ASTManager } from './ast/astManager';
import { SymbolType } from './ast/symbolTable';
import { DocumentSemanticSnapshot } from './completion/types';
import { getParsed } from './parseCache';
import * as path from 'path';

const tokenTypes = [
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
    'operator',
];

const tokenModifiers: string[] = [];

const TOKEN_TYPE_INDEX = {
    keyword: tokenTypes.indexOf('keyword'),
    type: tokenTypes.indexOf('type'),
    variable: tokenTypes.indexOf('variable'),
    function: tokenTypes.indexOf('function'),
    property: tokenTypes.indexOf('property'),
    macro: tokenTypes.indexOf('macro'),
    builtin: tokenTypes.indexOf('builtin'),
    number: tokenTypes.indexOf('number'),
    string: tokenTypes.indexOf('string'),
    comment: tokenTypes.indexOf('comment'),
    operator: tokenTypes.indexOf('operator')
};

const KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'foreach', 'inherit', 'in'
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
    LPCLexer.KW_STRUCT
]);

const TOKEN_TYPE_MAP: Record<number, number> = {
    [LPCLexer.STRING_LITERAL]: TOKEN_TYPE_INDEX.string,
    [LPCLexer.CHAR_LITERAL]: TOKEN_TYPE_INDEX.string,
    [LPCLexer.INTEGER]: TOKEN_TYPE_INDEX.number,
    [LPCLexer.FLOAT]: TOKEN_TYPE_INDEX.number,
    [LPCLexer.LINE_COMMENT]: TOKEN_TYPE_INDEX.comment,
    [LPCLexer.BLOCK_COMMENT]: TOKEN_TYPE_INDEX.comment,
    [LPCLexer.PLUS]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.MINUS]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.STAR]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.DIV]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.PERCENT]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.ASSIGN]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.GT]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.LT]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.GE]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.LE]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.EQ]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.NE]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.AND]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.OR]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.NOT]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.BIT_AND]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.BIT_OR]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.BIT_XOR]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.BIT_NOT]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.SHIFT_LEFT]: TOKEN_TYPE_INDEX.operator,
    [LPCLexer.SHIFT_RIGHT]: TOKEN_TYPE_INDEX.operator,
};

let EFUNS = new Set<string>();

try {
    const configPath = path.join(__dirname, '..', 'config', 'lpc-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);

    if (data && data.efuns) {
        EFUNS = new Set(Object.keys(data.efuns));
    }
} catch {}

export const LPCSemanticTokensLegend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

export class LPCSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    private readonly astManager = ASTManager.getInstance();

    public async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens> {
        const analysis = this.astManager.parseDocument(document);
        const parsed = analysis.parsed || getParsed(document);
        parsed.tokens.fill();

        const builder = new vscode.SemanticTokensBuilder(LPCSemanticTokensLegend);
        const tokens = parsed.tokens.getTokens();

        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            if (token.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) {
                continue;
            }

            const tokenType = this.classifyToken(token, index, tokens, analysis.snapshot);
            if (tokenType === undefined || tokenType < 0) {
                continue;
            }

            const length = (token.text ?? '').length;
            if (length === 0) {
                continue;
            }

            builder.push(token.line - 1, token.charPositionInLine, length, tokenType, 0);
        }

        return builder.build();
    }

    private classifyToken(
        token: Token,
        tokenIndex: number,
        tokens: Token[],
        snapshot: DocumentSemanticSnapshot
    ): number | undefined {
        if (token.type === LPCLexer.Identifier) {
            return this.classifyIdentifier(token, tokenIndex, tokens, snapshot);
        }

        if (TYPE_TOKENS.has(token.type)) {
            return TOKEN_TYPE_INDEX.type;
        }

        if (token.type >= LPCLexer.IF && token.type <= LPCLexer.IN) {
            return TOKEN_TYPE_INDEX.keyword;
        }

        return TOKEN_TYPE_MAP[token.type];
    }

    private classifyIdentifier(
        token: Token,
        tokenIndex: number,
        tokens: Token[],
        snapshot: DocumentSemanticSnapshot
    ): number {
        const text = token.text ?? '';
        const lowerText = text.toLowerCase();

        if (/^[A-Z_][A-Z0-9_]*$/.test(text)) {
            return TOKEN_TYPE_INDEX.macro;
        }

        if (EFUNS.has(text)) {
            return TOKEN_TYPE_INDEX.builtin;
        }

        if (KEYWORDS.has(lowerText)) {
            return TOKEN_TYPE_INDEX.keyword;
        }

        if (TYPE_KEYWORDS.has(lowerText)) {
            return TOKEN_TYPE_INDEX.type;
        }

        const symbol = snapshot.symbolTable.findSymbol(
            text,
            new vscode.Position(token.line - 1, token.charPositionInLine)
        );
        if (symbol) {
            return this.getTokenTypeFromSymbol(symbol.type);
        }

        return this.getContextualIdentifierType(tokenIndex, tokens);
    }

    private getContextualIdentifierType(tokenIndex: number, tokens: Token[]): number {
        const previousToken = this.findAdjacentDefaultToken(tokens, tokenIndex, -1);
        if (previousToken && (previousToken.type === LPCLexer.ARROW || previousToken.type === LPCLexer.DOT)) {
            return TOKEN_TYPE_INDEX.property;
        }

        const nextToken = this.findAdjacentDefaultToken(tokens, tokenIndex, 1);
        if (nextToken && nextToken.type === LPCLexer.LPAREN) {
            return TOKEN_TYPE_INDEX.function;
        }

        return TOKEN_TYPE_INDEX.variable;
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

    private getTokenTypeFromSymbol(symbolType: SymbolType): number {
        switch (symbolType) {
            case SymbolType.FUNCTION:
                return TOKEN_TYPE_INDEX.function;
            case SymbolType.STRUCT:
            case SymbolType.CLASS:
                return TOKEN_TYPE_INDEX.type;
            case SymbolType.MEMBER:
                return TOKEN_TYPE_INDEX.property;
            case SymbolType.PARAMETER:
            case SymbolType.VARIABLE:
            case SymbolType.INHERIT:
            default:
                return TOKEN_TYPE_INDEX.variable;
        }
    }
}
