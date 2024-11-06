"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDocumentSymbolProvider = void 0;
const vscode = require("vscode");
class LPCDocumentSymbolProvider {
    provideDocumentSymbols(document, token) {
        return new Promise((resolve) => {
            const symbols = [];
            const text = document.getText();
            // 匹配函数定义
            const functionRegex = /\b(\w+)\s+(\w+)\s*\([^)]*\)\s*{/g;
            let match;
            while ((match = functionRegex.exec(text)) !== null) {
                const [fullMatch, returnType, functionName] = match;
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + fullMatch.length);
                symbols.push(new vscode.DocumentSymbol(functionName, returnType, vscode.SymbolKind.Function, new vscode.Range(startPos, endPos), new vscode.Range(startPos, endPos)));
            }
            resolve(symbols);
        });
    }
}
exports.LPCDocumentSymbolProvider = LPCDocumentSymbolProvider;
//# sourceMappingURL=documentSymbolProvider.js.map