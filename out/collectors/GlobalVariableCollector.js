"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalVariableCollector = void 0;
const vscode = require("vscode");
const LPCParser_1 = require("../antlr/LPCParser");
const LPCLexer_1 = require("../antlr/LPCLexer");
/**
 * 检测全局变量是否未使用。
 * 规则：源文件顶层 (非函数内部) 的 variableDecl 声明的变量若未在其他位置被引用，则给出提示。
 */
class GlobalVariableCollector {
    collect(document, parsed) {
        const cfg = vscode.workspace.getConfiguration('lpc');
        if (cfg.get('enableUnusedGlobalVarCheck') === false) {
            return [];
        }
        const diagnostics = [];
        const { tree, tokens } = parsed;
        if (!(tree instanceof LPCParser_1.SourceFileContext)) {
            return diagnostics;
        }
        // 收集顶层 VariableDeclContext
        const declared = new Map();
        for (const stmt of tree.statement()) {
            const vd = stmt.variableDecl();
            if (!vd)
                continue; // 不是变量声明
            // 确认该声明不在函数体内 (顶层 statement 已确保)
            this.collectFromVariableDecl(vd, declared);
        }
        if (declared.size === 0)
            return diagnostics;
        // 遍历 token 流，寻找使用
        const used = new Set();
        for (const tok of tokens.getTokens()) {
            if (tok.channel !== LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                continue;
            if (tok.type !== LPCLexer_1.LPCLexer.Identifier)
                continue;
            const word = tok.text ?? '';
            if (declared.has(word)) {
                // 跳过声明本身
                const declTok = declared.get(word);
                if (tok.startIndex === declTok.startIndex)
                    continue;
                used.add(word);
            }
        }
        // 报告未使用
        for (const [name, tok] of declared) {
            if (used.has(name))
                continue;
            const range = new vscode.Range(document.positionAt(tok.startIndex), document.positionAt(tok.stopIndex + 1));
            const diag = new vscode.Diagnostic(range, `全局变量 '${name}' 未被使用`, vscode.DiagnosticSeverity.Warning);
            diag.code = 'unusedGlobalVar';
            diag.data = {
                kind: 'global',
                start: tok.startIndex,
                end: tok.stopIndex + 1
            };
            diagnostics.push(diag);
        }
        return diagnostics;
    }
    collectFromVariableDecl(vd, map) {
        for (const declarator of vd.variableDeclarator()) {
            const id = declarator.Identifier();
            if (id) {
                map.set(id.text ?? '', id.symbol);
            }
        }
    }
}
exports.GlobalVariableCollector = GlobalVariableCollector;
//# sourceMappingURL=GlobalVariableCollector.js.map