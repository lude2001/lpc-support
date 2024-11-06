import * as vscode from 'vscode';

export class LPCCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly unusedVarDiagnosticCode = 'unusedVar';

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

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

    private createRemoveVariableAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            '删除未使用的变量',
            vscode.CodeActionKind.QuickFix
        );
        
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

    private createMakeGlobalAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            '将变量标记为全局变量',
            vscode.CodeActionKind.QuickFix
        );

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