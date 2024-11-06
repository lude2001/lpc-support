"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCCodeActionProvider = void 0;
const vscode = require("vscode");
class LPCCodeActionProvider {
    provideCodeActions(document, range, context) {
        const actions = [];
        // 遍历诊断信息
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.code === LPCCodeActionProvider.unusedVarDiagnosticCode) {
                // 创建删除变量的代码操作
                const removeVarAction = this.createRemoveVariableAction(document, diagnostic);
                if (removeVarAction) {
                    actions.push(removeVarAction);
                }
                // 创建将变量标记为全局变量的代码操作
                const makeGlobalAction = this.createMakeGlobalAction(document, diagnostic);
                if (makeGlobalAction) {
                    actions.push(makeGlobalAction);
                }
            }
        }
        return actions;
    }
    createRemoveVariableAction(document, diagnostic) {
        const action = new vscode.CodeAction('删除未使用的变量', vscode.CodeActionKind.QuickFix);
        // 获取整行的文本
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;
        // 创建编辑
        const edit = new vscode.WorkspaceEdit();
        edit.delete(document.uri, line.range);
        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        return action;
    }
    createMakeGlobalAction(document, diagnostic) {
        const action = new vscode.CodeAction('将变量标记为全局变量', vscode.CodeActionKind.QuickFix);
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;
        // 在变量声明前添加 nosave 关键字
        const newText = lineText.replace(/^\s*/, '$&nosave ');
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, line.range, newText);
        action.edit = edit;
        action.diagnostics = [diagnostic];
        return action;
    }
}
exports.LPCCodeActionProvider = LPCCodeActionProvider;
LPCCodeActionProvider.unusedVarDiagnosticCode = 'unusedVar';
//# sourceMappingURL=codeActions.js.map