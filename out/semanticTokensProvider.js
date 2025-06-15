"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCSemanticTokensProvider = exports.LPCSemanticTokensLegend = void 0;
const vscode = require("vscode");
const antlr4ts_1 = require("antlr4ts");
const LPCLexer_1 = require("./antlr/LPCLexer");
const path = require("path");
const fs = require("fs");
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
const tokenModifiers = [];
exports.LPCSemanticTokensLegend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
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
const TOKEN_TYPE_MAP = {
    // —— 直接列举 lexer 中的显式符号 ——
    [LPCLexer_1.LPCLexer.STRING_LITERAL]: tokenTypes.indexOf('string'),
    [LPCLexer_1.LPCLexer.CHAR_LITERAL]: tokenTypes.indexOf('string'),
    [LPCLexer_1.LPCLexer.INTEGER]: tokenTypes.indexOf('number'),
    [LPCLexer_1.LPCLexer.FLOAT]: tokenTypes.indexOf('number'),
    [LPCLexer_1.LPCLexer.LINE_COMMENT]: tokenTypes.indexOf('comment'),
    [LPCLexer_1.LPCLexer.BLOCK_COMMENT]: tokenTypes.indexOf('comment'),
    [LPCLexer_1.LPCLexer.PLUS]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.MINUS]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.STAR]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.DIV]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.PERCENT]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.ASSIGN]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.GT]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.LT]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.GE]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.LE]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.EQ]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.NE]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.AND]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.OR]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.NOT]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.BIT_AND]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.BIT_OR]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.BIT_XOR]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.BIT_NOT]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.SHIFT_LEFT]: tokenTypes.indexOf('operator'),
    [LPCLexer_1.LPCLexer.SHIFT_RIGHT]: tokenTypes.indexOf('operator'),
};
// 读取 efun 名单（只在首次加载时执行）
let EFUNS = new Set();
try {
    const configPath = path.join(__dirname, '..', 'config', 'lpc-config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data && data.efuns) {
        EFUNS = new Set(Object.keys(data.efuns));
    }
}
catch { }
class LPCSemanticTokensProvider {
    async provideDocumentSemanticTokens(document, _token) {
        const text = document.getText();
        const input = antlr4ts_1.CharStreams.fromString(text);
        const lexer = new LPCLexer_1.LPCLexer(input);
        const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
        tokenStream.fill();
        const tokens = tokenStream.getTokens();
        const builder = new vscode.SemanticTokensBuilder(exports.LPCSemanticTokensLegend);
        for (let idx = 0; idx < tokens.length; idx++) {
            const tok = tokens[idx];
            if (tok.channel !== LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL) {
                continue; // 跳过隐藏 channel（注释、空白等已由显式 token 捕获）
            }
            let tokenTypeIdx = TOKEN_TYPE_MAP[tok.type];
            // Identifier 需根据单词再判断是否关键字/类型/变量
            if (tok.type === LPCLexer_1.LPCLexer.Identifier) {
                const rawText = tok.text ?? '';
                const lower = rawText.toLowerCase();
                // 宏：全部大写并包含下划线或数字
                if (/^[A-Z_][A-Z0-9_]*$/.test(rawText)) {
                    tokenTypeIdx = tokenTypes.indexOf('macro');
                }
                else if (EFUNS.has(rawText)) {
                    tokenTypeIdx = tokenTypes.indexOf('builtin');
                }
                else if (KEYWORDS.has(lower)) {
                    tokenTypeIdx = tokenTypes.indexOf('keyword');
                }
                else if (TYPE_KEYWORDS.has(lower)) {
                    tokenTypeIdx = tokenTypes.indexOf('type');
                }
                else {
                    // 进一步通过上下文判断 function/property
                    let classified = false;
                    // 查找上一/下一个默认 channel token
                    let prevIdx = idx - 1;
                    let prevTok;
                    while (prevIdx >= 0) {
                        prevTok = tokens[prevIdx];
                        if (prevTok.channel === LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                            break;
                        prevIdx--;
                    }
                    let nextIdx = idx + 1;
                    let nextTok;
                    while (nextIdx < tokens.length) {
                        nextTok = tokens[nextIdx];
                        if (nextTok.channel === LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                            break;
                        nextIdx++;
                    }
                    if (prevTok && (prevTok.type === LPCLexer_1.LPCLexer.ARROW || prevTok.type === LPCLexer_1.LPCLexer.DOT)) {
                        tokenTypeIdx = tokenTypes.indexOf('property');
                        classified = true;
                    }
                    else if (nextTok && nextTok.type === LPCLexer_1.LPCLexer.T__1 /* '(' */) {
                        tokenTypeIdx = tokenTypes.indexOf('function');
                        classified = true;
                    }
                    if (!classified) {
                        tokenTypeIdx = tokenTypes.indexOf('variable');
                    }
                }
            }
            // 隐式类型关键字 token (T__4 ~ T__13)
            if (tok.type >= LPCLexer_1.LPCLexer.T__4 && tok.type <= LPCLexer_1.LPCLexer.T__13) {
                tokenTypeIdx = tokenTypes.indexOf('type');
            }
            else if (tok.type >= LPCLexer_1.LPCLexer.IF && tok.type <= LPCLexer_1.LPCLexer.IN) {
                // 显式关键字枚举区间
                tokenTypeIdx = tokenTypes.indexOf('keyword');
            }
            if (tokenTypeIdx === undefined || tokenTypeIdx < 0) {
                continue; // 未映射 token
            }
            const line = tok.line - 1; // VS Code lines 从0开始
            const char = tok.charPositionInLine;
            const length = (tok.text ?? '').length;
            if (length === 0)
                continue;
            builder.push(line, char, length, tokenTypeIdx, 0);
        }
        return builder.build();
    }
}
exports.LPCSemanticTokensProvider = LPCSemanticTokensProvider;
//# sourceMappingURL=semanticTokensProvider.js.map