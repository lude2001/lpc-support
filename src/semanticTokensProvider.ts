import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import * as path from 'path';
import * as fs from 'fs';

// 定义语义 token 类型列表（顺序即索引）
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

export const LPCSemanticTokensLegend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

// —— 关键字、类型关键字集合 —— //
const KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
    'continue', 'return', 'foreach', 'inherit', 'in'
]);

const TYPE_KEYWORDS = new Set([
    'int', 'float', 'string', 'object', 'mixed', 'mapping', 'function',
    'buffer', 'void', 'struct'
]);

// 将 LPCLexer token type 映射到 semantic token type 索引
const TOKEN_TYPE_MAP: Record<number, number> = {
    // —— 直接列举 lexer 中的显式符号 ——
    [LPCLexer.STRING_LITERAL]: tokenTypes.indexOf('string'),
    [LPCLexer.CHAR_LITERAL]: tokenTypes.indexOf('string'),
    [LPCLexer.INTEGER]: tokenTypes.indexOf('number'),
    [LPCLexer.FLOAT]: tokenTypes.indexOf('number'),
    [LPCLexer.LINE_COMMENT]: tokenTypes.indexOf('comment'),
    [LPCLexer.BLOCK_COMMENT]: tokenTypes.indexOf('comment'),
    [LPCLexer.PLUS]: tokenTypes.indexOf('operator'),
    [LPCLexer.MINUS]: tokenTypes.indexOf('operator'),
    [LPCLexer.STAR]: tokenTypes.indexOf('operator'),
    [LPCLexer.DIV]: tokenTypes.indexOf('operator'),
    [LPCLexer.PERCENT]: tokenTypes.indexOf('operator'),
    [LPCLexer.ASSIGN]: tokenTypes.indexOf('operator'),
    [LPCLexer.GT]: tokenTypes.indexOf('operator'),
    [LPCLexer.LT]: tokenTypes.indexOf('operator'),
    [LPCLexer.GE]: tokenTypes.indexOf('operator'),
    [LPCLexer.LE]: tokenTypes.indexOf('operator'),
    [LPCLexer.EQ]: tokenTypes.indexOf('operator'),
    [LPCLexer.NE]: tokenTypes.indexOf('operator'),
    [LPCLexer.AND]: tokenTypes.indexOf('operator'),
    [LPCLexer.OR]: tokenTypes.indexOf('operator'),
    [LPCLexer.NOT]: tokenTypes.indexOf('operator'),
    [LPCLexer.BIT_AND]: tokenTypes.indexOf('operator'),
    [LPCLexer.BIT_OR]: tokenTypes.indexOf('operator'),
    [LPCLexer.BIT_XOR]: tokenTypes.indexOf('operator'),
    [LPCLexer.BIT_NOT]: tokenTypes.indexOf('operator'),
    [LPCLexer.SHIFT_LEFT]: tokenTypes.indexOf('operator'),
    [LPCLexer.SHIFT_RIGHT]: tokenTypes.indexOf('operator'),
};

// 读取 efun 名单（只在首次加载时执行）
let EFUNS = new Set<string>();
try {
    const configPath = path.join(__dirname, '..', 'config', 'lpc-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.efuns) {
        EFUNS = new Set(Object.keys(data.efuns));
    }
} catch {}

export class LPCSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens> {
        const text = document.getText();
        const input = CharStreams.fromString(text);
        const lexer = new LPCLexer(input);
        const tokenStream = new CommonTokenStream(lexer);
        tokenStream.fill();
        const tokens = tokenStream.getTokens();

        const builder = new vscode.SemanticTokensBuilder(LPCSemanticTokensLegend);

        for (let idx = 0; idx < tokens.length; idx++) {
            const tok = tokens[idx];
            if (tok.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) {
                continue; // 跳过隐藏 channel（注释、空白等已由显式 token 捕获）
            }

            let tokenTypeIdx: number | undefined = TOKEN_TYPE_MAP[tok.type];

            // Identifier 需根据单词再判断是否关键字/类型/变量
            if (tok.type === LPCLexer.Identifier) {
                const rawText = tok.text ?? '';
                const lower = rawText.toLowerCase();

                // 宏：全部大写并包含下划线或数字
                if (/^[A-Z_][A-Z0-9_]*$/.test(rawText)) {
                    tokenTypeIdx = tokenTypes.indexOf('macro');
                } else if (EFUNS.has(rawText)) {
                    tokenTypeIdx = tokenTypes.indexOf('builtin');
                } else if (KEYWORDS.has(lower)) {
                    tokenTypeIdx = tokenTypes.indexOf('keyword');
                } else if (TYPE_KEYWORDS.has(lower)) {
                    tokenTypeIdx = tokenTypes.indexOf('type');
                } else {
                    // 进一步通过上下文判断 function/property
                    let classified = false;
                    // 查找上一/下一个默认 channel token
                    let prevIdx = idx - 1;
                    let prevTok;
                    while (prevIdx >= 0) {
                        prevTok = tokens[prevIdx];
                        if (prevTok.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL) break;
                        prevIdx--;
                    }
                    let nextIdx = idx + 1;
                    let nextTok;
                    while (nextIdx < tokens.length) {
                        nextTok = tokens[nextIdx];
                        if (nextTok.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL) break;
                        nextIdx++;
                    }
                    if (prevTok && (prevTok.type === LPCLexer.ARROW || prevTok.type === LPCLexer.DOT)) {
                        tokenTypeIdx = tokenTypes.indexOf('property');
                        classified = true;
                    } else if (nextTok && nextTok.type === LPCLexer.LPAREN) {
                        tokenTypeIdx = tokenTypes.indexOf('function');
                        classified = true;
                    }
                    if (!classified) {
                        tokenTypeIdx = tokenTypes.indexOf('variable');
                    }
                }
            }

            // 类型关键字显式 token
            const TYPE_TOKENS = [
                LPCLexer.KW_INT, LPCLexer.KW_FLOAT, LPCLexer.KW_STRING, LPCLexer.KW_OBJECT,
                LPCLexer.KW_MIXED, LPCLexer.KW_MAPPING, LPCLexer.KW_FUNCTION, LPCLexer.KW_BUFFER,
                LPCLexer.KW_VOID, LPCLexer.KW_STRUCT
            ];

            if (TYPE_TOKENS.includes(tok.type)) {
                tokenTypeIdx = tokenTypes.indexOf('type');
            } else if (tok.type >= LPCLexer.IF && tok.type <= LPCLexer.IN) {
                // 显式关键字枚举区间
                tokenTypeIdx = tokenTypes.indexOf('keyword');
            }

            if (tokenTypeIdx === undefined || tokenTypeIdx < 0) {
                continue; // 未映射 token
            }

            const line = tok.line - 1; // VS Code lines 从0开始
            const char = tok.charPositionInLine;
            const length = (tok.text ?? '').length;
            if (length === 0) continue;

            builder.push(line, char, length, tokenTypeIdx, 0);
        }

        return builder.build();
    }
} 