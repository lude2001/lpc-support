"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCRenameProvider = void 0;
const vscode = require("vscode");
const parseCache_1 = require("./parseCache");
const LPCLexer_1 = require("./antlr/LPCLexer");
class LPCRenameProvider {
    async prepareRename(document, position, _token) {
        const wordRange = document.getWordRangeAtPosition(position);
        return wordRange; // allow rename if have word
    }
    async provideRenameEdits(document, position, newName, _token) {
        const edit = new vscode.WorkspaceEdit();
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange)
            return edit;
        const oldName = document.getText(wordRange);
        const { tokens: tokenStream } = (0, parseCache_1.getParsed)(document);
        for (const tok of tokenStream.getTokens()) {
            if (tok.channel !== LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                continue;
            if (tok.type === LPCLexer_1.LPCLexer.STRING_LITERAL || tok.type === LPCLexer_1.LPCLexer.LINE_COMMENT || tok.type === LPCLexer_1.LPCLexer.BLOCK_COMMENT)
                continue;
            if (tok.type === LPCLexer_1.LPCLexer.Identifier && tok.text === oldName) {
                const start = document.positionAt(tok.startIndex);
                const end = document.positionAt(tok.stopIndex + 1);
                edit.replace(document.uri, new vscode.Range(start, end), newName);
            }
        }
        return edit;
    }
}
exports.LPCRenameProvider = LPCRenameProvider;
//# sourceMappingURL=renameProvider.js.map