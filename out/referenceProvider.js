"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCReferenceProvider = void 0;
const vscode = require("vscode");
const LPCLexer_1 = require("./antlr/LPCLexer");
const parseCache_1 = require("./parseCache");
class LPCReferenceProvider {
    async provideReferences(document, position, context, _token) {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange)
            return [];
        const word = document.getText(wordRange);
        const { tokens: tokenStream } = (0, parseCache_1.getParsed)(document);
        const locations = [];
        for (const tok of tokenStream.getTokens()) {
            if (tok.channel !== LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                continue;
            if (tok.type === LPCLexer_1.LPCLexer.STRING_LITERAL || tok.type === LPCLexer_1.LPCLexer.LINE_COMMENT || tok.type === LPCLexer_1.LPCLexer.BLOCK_COMMENT)
                continue;
            if (tok.type === LPCLexer_1.LPCLexer.Identifier && tok.text === word) {
                const startPos = document.positionAt(tok.startIndex);
                const endPos = document.positionAt(tok.stopIndex + 1);
                const loc = new vscode.Location(document.uri, new vscode.Range(startPos, endPos));
                // If includeDeclaration is false, filter out declaration tokens (simple heuristic: same line contains type keywords)
                if (!context.includeDeclaration) {
                    const lineText = document.lineAt(startPos.line).text;
                    const typeKeywordRegex = /\b(int|float|string|object|mixed|mapping|buffer|void|struct|class)\b/;
                    if (typeKeywordRegex.test(lineText) && lineText.indexOf(word) > lineText.indexOf(' ')) {
                        continue; // assume declaration
                    }
                }
                locations.push(loc);
            }
        }
        return locations;
    }
}
exports.LPCReferenceProvider = LPCReferenceProvider;
//# sourceMappingURL=referenceProvider.js.map