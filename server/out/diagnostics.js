"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LpcErrorListener = void 0;
const node_1 = require("vscode-languageserver/node");
class LpcErrorListener {
    constructor(document) {
        this.document = document;
        this.diagnostics = [];
    }
    syntaxError(recognizer, offendingSymbol, line, charPositionInLine, msg, e) {
        const range = {
            start: { line: line - 1, character: charPositionInLine },
            end: { line: line - 1, character: charPositionInLine + 1 } // Default to 1 char length
        };
        // If the offending symbol has a start and stop index, use it for a better range
        if (offendingSymbol && offendingSymbol.startIndex && offendingSymbol.stopIndex) {
            const start = this.document.positionAt(offendingSymbol.startIndex);
            const end = this.document.positionAt(offendingSymbol.stopIndex + 1);
            range.start = start;
            range.end = end;
        }
        else {
            // Fallback for when there's no offending symbol info
            const lineText = this.document.getText({
                start: { line: line - 1, character: 0 },
                end: { line: line - 1, character: Number.MAX_VALUE }
            });
            const endChar = charPositionInLine + (lineText.substring(charPositionInLine).match(/^\w+/) || [''])[0].length;
            range.end = { line: line - 1, character: endChar };
        }
        const diagnostic = {
            severity: node_1.DiagnosticSeverity.Error,
            range,
            message: msg,
            source: 'LPC Parser'
        };
        this.diagnostics.push(diagnostic);
    }
    getDiagnostics() {
        return this.diagnostics;
    }
}
exports.LpcErrorListener = LpcErrorListener;
//# sourceMappingURL=diagnostics.js.map