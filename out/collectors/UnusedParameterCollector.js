"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnusedParameterCollector = void 0;
const vscode = require("vscode");
const LPCParser_1 = require("../antlr/LPCParser");
const LPCLexer_1 = require("../antlr/LPCLexer");
/**
 * 检测函数参数未使用 (基于 ANTLR 语法树)
 */
class UnusedParameterCollector {
    collect(document, parsed) {
        const cfg = vscode.workspace.getConfiguration('lpc');
        if (cfg.get('enableUnusedParameterCheck') === false) {
            return [];
        }
        const diagnostics = [];
        const { tree, tokens } = parsed;
        const visit = (ctx) => {
            if (ctx instanceof LPCParser_1.FunctionDefContext) {
                this.collectInFunction(ctx, tokens, document, diagnostics);
            }
            for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                const child = ctx.getChild(i);
                if (child && typeof child === 'object' && child.symbol === undefined) {
                    visit(child);
                }
            }
        };
        visit(tree);
        return diagnostics;
    }
    collectInFunction(funcCtx, tokenStream, document, diagnostics) {
        const params = new Map();
        const paramListCtx = funcCtx.parameterList();
        if (paramListCtx) {
            for (const param of paramListCtx.parameter()) {
                const idToken = param.Identifier()?.symbol;
                if (idToken) {
                    params.set(idToken.text ?? '', idToken);
                }
            }
        }
        if (params.size === 0)
            return;
        const funcEnd = funcCtx.stop ? funcCtx.stop.stopIndex : undefined;
        const used = new Set();
        for (const tok of tokenStream.getTokens()) {
            if (tok.channel !== LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                continue;
            if (tok.type !== LPCLexer_1.LPCLexer.Identifier)
                continue;
            if (!funcEnd || tok.startIndex > funcEnd)
                continue;
            const word = tok.text ?? '';
            if (params.has(word)) {
                const declTok = params.get(word);
                if (tok.startIndex === declTok.startIndex)
                    continue;
                used.add(word);
            }
        }
        for (const [name, tok] of params) {
            if (used.has(name))
                continue;
            const range = new vscode.Range(document.positionAt(tok.startIndex), document.positionAt(tok.stopIndex + 1));
            const diag = new vscode.Diagnostic(range, `参数 '${name}' 未被使用`, vscode.DiagnosticSeverity.Information);
            diag.code = 'unusedParam';
            diag.data = {
                kind: 'param',
                start: tok.startIndex,
                end: tok.stopIndex + 1
            };
            diagnostics.push(diag);
        }
    }
}
exports.UnusedParameterCollector = UnusedParameterCollector;
//# sourceMappingURL=UnusedParameterCollector.js.map