"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCWorkspaceSymbolProvider = void 0;
const vscode = require("vscode");
class LPCWorkspaceSymbolProvider {
    async provideWorkspaceSymbols(query, token) {
        const symbols = [];
        // 查找工作区中的所有 LPC 文件
        const files = await vscode.workspace.findFiles('**/*.{c,h,lpc}', '**/node_modules/**');
        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            // 匹配函数定义
            const functionRegex = /\b(\w+)\s+(\w+)\s*\([^)]*\)\s*{/g;
            let match;
            while ((match = functionRegex.exec(text)) !== null) {
                const [_, returnType, functionName] = match;
                if (functionName.toLowerCase().includes(query.toLowerCase())) {
                    const pos = document.positionAt(match.index);
                    symbols.push(new vscode.SymbolInformation(functionName, vscode.SymbolKind.Function, returnType, new vscode.Location(document.uri, pos)));
                }
            }
        }
        return symbols;
    }
}
exports.LPCWorkspaceSymbolProvider = LPCWorkspaceSymbolProvider;
//# sourceMappingURL=workspaceSymbolProvider.js.map