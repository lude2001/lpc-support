"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParseTreeString = getParseTreeString;
const Trees_1 = require("antlr4ts/tree/Trees");
const LPCParserUtil_1 = require("./LPCParserUtil");
/**
 * 将 LPC 源代码解析并以 Lisp-风格式输出语法树，方便调试。
 */
function getParseTreeString(code) {
    const { parser, tree } = (0, LPCParserUtil_1.parseLPC)(code);
    return Trees_1.Trees.toStringTree(tree, parser);
}
//# sourceMappingURL=ParseTreePrinter.js.map