"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnusedVariableCollector = void 0;
const vscode = require("vscode");
const LPCParser_1 = require("../antlr/LPCParser");
const LPCLexer_1 = require("../antlr/LPCLexer");
/**
 * 使用 ANTLR 语法树检测局部未使用变量。
 * 当前实现仅处理函数体内由 variableDecl 声明的局部变量。
 */
class UnusedVariableCollector {
    collect(document, parsed) {
        const diagnostics = [];
        const { tree, tokens } = parsed;
        // 遍历函数定义
        const visit = (ctx) => {
            if (ctx instanceof LPCParser_1.FunctionDefContext) {
                this.collectInFunction(ctx, tokens, document, diagnostics);
            }
            // 递归遍历孩子
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
    collectInFunction(funcCtx, tokens, document, diagnostics) {
        // 收集变量声明 token
        const declared = new Map();
        const gatherVars = (ctx) => {
            if (ctx instanceof LPCParser_1.VariableDeclContext) {
                for (const v of ctx.variableDeclarator()) {
                    const id = v.Identifier();
                    if (id) {
                        declared.set(id.text, id.symbol);
                    }
                }
            }
            for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                const child = ctx.getChild(i);
                if (child && typeof child === 'object' && child.symbol === undefined) {
                    gatherVars(child);
                }
            }
        };
        gatherVars(funcCtx);
        if (declared.size === 0)
            return;
        // 计算函数体起止位置（包含大括号内）
        const funcStart = funcCtx.start ? funcCtx.start.startIndex : undefined;
        const funcEnd = funcCtx.stop ? funcCtx.stop.stopIndex : undefined;
        // 遍历 token 流，标记使用
        const used = new Set();
        for (const tok of tokens.getTokens()) {
            if (tok.channel !== LPCLexer_1.LPCLexer.DEFAULT_TOKEN_CHANNEL)
                continue;
            if (tok.type !== LPCLexer_1.LPCLexer.Identifier)
                continue;
            // 仅统计位于当前函数体内部的标识符
            if ((funcStart !== undefined && tok.startIndex < funcStart) ||
                (funcEnd !== undefined && tok.startIndex > funcEnd)) {
                continue;
            }
            const word = tok.text ?? '';
            if (declared.has(word)) {
                // 跳过声明自身
                const declTok = declared.get(word);
                if (tok.startIndex === declTok.startIndex)
                    continue;
                used.add(word);
            }
        }
        // 未使用的变量
        for (const [name, tok] of declared) {
            if (used.has(name))
                continue;
            const range = new vscode.Range(document.positionAt(tok.startIndex), document.positionAt(tok.stopIndex + 1));
            const diagnostic = new vscode.Diagnostic(range, `局部变量 '${name}' 未被使用`, vscode.DiagnosticSeverity.Information);
            diagnostic.code = 'unusedVar';
            diagnostic.data = {
                kind: 'var',
                start: tok.startIndex,
                end: tok.stopIndex + 1
            };
            diagnostics.push(diagnostic);
        }
    }
}
exports.UnusedVariableCollector = UnusedVariableCollector;
//# sourceMappingURL=UnusedVariableCollector.js.map