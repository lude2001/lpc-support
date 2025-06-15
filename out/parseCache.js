"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParsed = getParsed;
const antlr4ts_1 = require("antlr4ts");
const LPCLexer_1 = require("./antlr/LPCLexer");
const LPCParser_1 = require("./antlr/LPCParser");
const CollectingErrorListener_1 = require("./parser/CollectingErrorListener");
const cache = new Map();
function getParsed(document) {
    const key = document.uri.toString();
    const existing = cache.get(key);
    if (existing && existing.version === document.version) {
        return existing;
    }
    const input = antlr4ts_1.CharStreams.fromString(document.getText());
    const lexer = new LPCLexer_1.LPCLexer(input);
    const tokens = new antlr4ts_1.CommonTokenStream(lexer);
    const parser = new LPCParser_1.LPCParser(tokens);
    // Attach error listener to collect syntax errors
    const errorListener = new CollectingErrorListener_1.CollectingErrorListener(document);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);
    const tree = parser.sourceFile();
    const parsed = { version: document.version, tokens, tree, diagnostics: errorListener.diagnostics };
    cache.set(key, parsed);
    return parsed;
}
//# sourceMappingURL=parseCache.js.map