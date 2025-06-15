"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLPC = parseLPC;
const antlr4ts_1 = require("antlr4ts");
const LPCLexer_1 = require("../antlr/LPCLexer");
const LPCParser_1 = require("../antlr/LPCParser");
/**
 * 使用 ANTLR 生成的词法、语法解析器将 LPC 代码解析为 ParseTree。
 * 如果语法不完整或出现错误，ANTLR 会抛出异常，调用方可捕获进行诊断。
 */
function parseLPC(code) {
    const input = antlr4ts_1.CharStreams.fromString(code);
    const lexer = new LPCLexer_1.LPCLexer(input);
    const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
    const parser = new LPCParser_1.LPCParser(tokenStream);
    // 入口规则与 LPC.g4 中保持一致
    const tree = parser.sourceFile();
    return { parser, tree };
}
//# sourceMappingURL=LPCParserUtil.js.map