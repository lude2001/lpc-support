"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCSymbolProvider = void 0;
const vscode = require("vscode");
const parseCache_1 = require("./parseCache");
class LPCSymbolProvider {
    provideDocumentSymbols(document, _token) {
        const { tree } = (0, parseCache_1.getParsed)(document);
        const symbols = [];
        for (const stmt of tree.statement()) {
            const funcCtx = stmt.functionDef();
            if (!funcCtx)
                continue;
            const idToken = funcCtx.Identifier().symbol;
            const funcName = idToken.text || 'function';
            const returnType = funcCtx.typeSpec()?.text || '';
            const start = document.positionAt(funcCtx.start.startIndex);
            const end = document.positionAt(funcCtx.stop.stopIndex + 1);
            const nameStart = document.positionAt(idToken.startIndex);
            const nameEnd = document.positionAt(idToken.stopIndex + 1);
            const fullRange = new vscode.Range(start, end);
            const nameRange = new vscode.Range(nameStart, nameEnd);
            symbols.push(new vscode.DocumentSymbol(funcName, returnType, vscode.SymbolKind.Function, fullRange, nameRange));
        }
        return symbols;
    }
}
exports.LPCSymbolProvider = LPCSymbolProvider;
//# sourceMappingURL=symbolProvider.js.map