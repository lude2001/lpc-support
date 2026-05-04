import { Token } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';

export interface LpcTokenLike {
    type: number;
    text?: string | null;
    line: number;
    tokenIndex: number;
    startIndex: number;
    stopIndex: number;
    channel: number;
    charPositionInLine: number;
}

export type LpcLexicalSemanticTokenKind =
    | 'keyword'
    | 'type'
    | 'number'
    | 'string'
    | 'comment'
    | 'operator';

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
    LPCLexer.KW_CLASS,
    LPCLexer.KW_ARRAY,
    LPCLexer.KW_CLOSURE,
    LPCLexer.KW_TREE
]);

const OPERATOR_TOKENS = new Set<number>([
    LPCLexer.INC,
    LPCLexer.DEC,
    LPCLexer.PLUS_ASSIGN,
    LPCLexer.MINUS_ASSIGN,
    LPCLexer.STAR_ASSIGN,
    LPCLexer.DIV_ASSIGN,
    LPCLexer.PERCENT_ASSIGN,
    LPCLexer.BIT_XOR_ASSIGN,
    LPCLexer.SHIFT_LEFT_ASSIGN,
    LPCLexer.SHIFT_RIGHT_ASSIGN,
    LPCLexer.ARROW,
    LPCLexer.DOT,
    LPCLexer.PLUS,
    LPCLexer.MINUS,
    LPCLexer.STAR,
    LPCLexer.DIV,
    LPCLexer.PERCENT,
    LPCLexer.SCOPE,
    LPCLexer.ELLIPSIS,
    LPCLexer.RANGE_OP,
    LPCLexer.ASSIGN,
    LPCLexer.GT,
    LPCLexer.LT,
    LPCLexer.GE,
    LPCLexer.LE,
    LPCLexer.EQ,
    LPCLexer.NE,
    LPCLexer.AND,
    LPCLexer.OR,
    LPCLexer.NOT,
    LPCLexer.BIT_AND,
    LPCLexer.BIT_OR,
    LPCLexer.BIT_XOR,
    LPCLexer.BIT_NOT,
    LPCLexer.BIT_OR_ASSIGN,
    LPCLexer.BIT_AND_ASSIGN,
    LPCLexer.SHIFT_LEFT,
    LPCLexer.SHIFT_RIGHT,
    LPCLexer.QUESTION,
    LPCLexer.COLON
]);

export function isEofToken(token: LpcTokenLike): boolean {
    return token.type === Token.EOF;
}

export function isGeneratedToken(token: LpcTokenLike): boolean {
    return token.type > 0;
}

export function isDefaultChannelToken(token: LpcTokenLike): boolean {
    return token.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL;
}

export function isIdentifierToken(token: LpcTokenLike | undefined): boolean {
    return Boolean(token) && token!.type === LPCLexer.Identifier;
}

export function isScopeToken(token: LpcTokenLike | undefined): token is LpcTokenLike {
    return Boolean(token) && token!.type === LPCParser.SCOPE;
}

export function isIncludeDirectiveToken(token: LpcTokenLike | undefined): boolean {
    return token?.type === LPCParser.INCLUDE;
}

export function isInheritDirectiveToken(token: LpcTokenLike | undefined): boolean {
    return token?.type === LPCParser.INHERIT;
}

export function isSemicolonToken(token: LpcTokenLike): boolean {
    return token.type === LPCParser.SEMI;
}

export function isModifierToken(token: LpcTokenLike): boolean {
    return token.type === LPCParser.MODIFIER;
}

export function isLeftParenToken(token: LpcTokenLike): boolean {
    return token.type === LPCParser.LPAREN;
}

export function isRightParenToken(token: LpcTokenLike): boolean {
    return token.type === LPCParser.RPAREN;
}

export function isTypeKeywordToken(token: LpcTokenLike): boolean {
    return TYPE_TOKENS.has(token.type);
}

export function isTypePositionBoundaryToken(token: LpcTokenLike): boolean {
    return token.type === LPCParser.SEMI
        || token.type === LPCParser.ASSIGN
        || token.type === LPCParser.LPAREN
        || token.type === LPCParser.RPAREN
        || token.type === LPCParser.COMMA
        || token.type === LPCParser.GT;
}

export function isCallableExpressionEndToken(token: LpcTokenLike): boolean {
    return token.type === LPCParser.Identifier
        || token.type === LPCParser.RPAREN
        || token.type === LPCParser.RBRACK
        || token.type === LPCParser.RBRACE;
}

export function isReceiverBoundaryToken(token: LpcTokenLike): boolean {
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

export function classifyLexicalSemanticToken(token: LpcTokenLike): LpcLexicalSemanticTokenKind | undefined {
    if (isTypeKeywordToken(token)) {
        return 'type';
    }

    if (token.type === LPCLexer.STRING_LITERAL || token.type === LPCLexer.CHAR_LITERAL) {
        return 'string';
    }

    if (token.type === LPCLexer.INTEGER || token.type === LPCLexer.FLOAT) {
        return 'number';
    }

    if (token.type === LPCLexer.LINE_COMMENT || token.type === LPCLexer.BLOCK_COMMENT) {
        return 'comment';
    }

    if (token.type === LPCLexer.KW_NEW || token.type === LPCLexer.MODIFIER) {
        return 'keyword';
    }

    if (token.type >= LPCLexer.IF && token.type <= LPCLexer.IN) {
        return 'keyword';
    }

    if (OPERATOR_TOKENS.has(token.type)) {
        return 'operator';
    }

    return undefined;
}
