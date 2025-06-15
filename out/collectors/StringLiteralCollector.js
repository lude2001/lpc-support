"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringLiteralCollector = void 0;
const vscode = require("vscode");
/**
 * 检查 LPC 多行字符串语法问题
 */
class StringLiteralCollector {
    collect(document, _parsed) {
        const diagnostics = [];
        const text = document.getText();
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;
        let match;
        while ((match = multilineStringRegex.exec(text)) !== null) {
            const content = match[1];
            if (!content.trim()) {
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length)), '空的多行字符串', vscode.DiagnosticSeverity.Warning));
            }
        }
        return diagnostics;
    }
}
exports.StringLiteralCollector = StringLiteralCollector;
//# sourceMappingURL=StringLiteralCollector.js.map