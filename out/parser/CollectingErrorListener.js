"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectingErrorListener = void 0;
const vscode = require("vscode");
class CollectingErrorListener {
    constructor(document) {
        this.document = document;
        this.diagnostics = [];
    }
    syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
        // ANTLR 的行号从 1 开始，而 VSCode 的 Position 从 0 开始
        const lineIndex = line - 1;
        const startColumn = charPositionInLine;
        let length = 1;
        if (offendingSymbol && typeof offendingSymbol.text === 'string') {
            length = offendingSymbol.text.length || 1;
        }
        const range = new vscode.Range(new vscode.Position(lineIndex, startColumn), new vscode.Position(lineIndex, startColumn + length));
        const diagnostic = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
        diagnostic.source = 'ANTLR';
        this.diagnostics.push(diagnostic);
    }
}
exports.CollectingErrorListener = CollectingErrorListener;
//# sourceMappingURL=CollectingErrorListener.js.map