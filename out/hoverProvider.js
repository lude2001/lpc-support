"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCHoverProvider = void 0;
const vscode = require("vscode");
const efunDocs_1 = require("./efunDocs");
class LPCHoverProvider {
    provideHover(document, position, token) {
        const range = document.getWordRangeAtPosition(position);
        if (!range)
            return null;
        const word = document.getText(range);
        const doc = efunDocs_1.efunDocumentations[word];
        if (doc) {
            return new vscode.Hover(new vscode.MarkdownString(doc), range);
        }
        return null;
    }
}
exports.LPCHoverProvider = LPCHoverProvider;
//# sourceMappingURL=hoverProvider.js.map