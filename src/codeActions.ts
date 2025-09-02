import * as vscode from 'vscode';
import { GLM4Client } from './glm4Client';
import { LPCFunctionParser } from './functionParser';

export class LPCCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly unusedVarDiagnosticCode = 'unusedVar';
    public static readonly unusedParamDiagnosticCode = 'unusedParam';
    public static readonly unusedGlobalVarDiagnosticCode = 'unusedGlobalVar';
    public static readonly applyReturnMismatchDiagnosticCode = 'applyReturnMismatch';

    private static commandsRegistered = false;

    constructor() {
        if (LPCCodeActionProvider.commandsRegistered) return;

        const registerRenameCmd = (id: string) => {
            vscode.commands.registerCommand(id, async (
                uri: vscode.Uri,
                position: vscode.Position,
                newName: string
            ) => {
                const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
                    'vscode.executeDocumentRenameProvider',
                    uri,
                    position,
                    newName
                );
                if (edit) {
                    await vscode.workspace.applyEdit(edit);
                }
            });
        };

        registerRenameCmd('lpc.renameVarToSnakeCase');
        registerRenameCmd('lpc.renameVarToCamelCase');

        // 注册生成Javadoc注释的命令
        vscode.commands.registerCommand('lpc.generateJavadoc', async () => {
            await this.generateJavadocCommand();
        });

        LPCCodeActionProvider.commandsRegistered = true;
    }

    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        // 遍历诊断信息
        for (const diagnostic of context.diagnostics) {
            const diagCode = diagnostic.code?.toString();

            // === 未使用变量 / 参数 / 全局变量 ===
            if (
                diagCode === LPCCodeActionProvider.unusedVarDiagnosticCode ||
                diagCode === LPCCodeActionProvider.unusedParamDiagnosticCode ||
                diagCode === LPCCodeActionProvider.unusedGlobalVarDiagnosticCode
            ) {
                // 修改删除变量的代码操作
                const removeVarAction = this.createRemoveVariableAction(document, diagnostic);
                if (removeVarAction) {
                    actions.push(removeVarAction);
                }

                // 添加注释未使用的变量的代码操作
                const commentVarAction = this.createCommentVariableAction(document, diagnostic);
                if (commentVarAction) {
                    actions.push(commentVarAction);
                }

                // 创建将变量标记为全局变量的代码操作
                const makeGlobalAction = this.createMakeGlobalAction(document, diagnostic);
                if (makeGlobalAction) {
                    actions.push(makeGlobalAction);
                }

                // —— 提供改名蛇形 / 驼峰 ——
                const snakeCaseAction = this.createRenameVariableCaseAction(document, diagnostic, 'snake');
                if (snakeCaseAction) {
                    actions.push(snakeCaseAction);
                }

                const camelCaseAction = this.createRenameVariableCaseAction(document, diagnostic, 'camel');
                if (camelCaseAction) {
                    actions.push(camelCaseAction);
                }
            }

            // === apply 返回类型不匹配 ===
            if (diagCode === LPCCodeActionProvider.applyReturnMismatchDiagnosticCode) {
                const fixReturnTypeAction = this.createFixApplyReturnTypeAction(document, diagnostic);
                if (fixReturnTypeAction) {
                    actions.push(fixReturnTypeAction);
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

        const edit = new vscode.WorkspaceEdit();

        // 获取变量所在的行
        const line = document.lineAt(diagnostic.range.start.line);
        let lineText = line.text;

        // 计算变量在行内的位置
        let varStartCol = diagnostic.range.start.character;
        const varEndCol = diagnostic.range.end.character;

        // 向左扩展, 将指针符 * 及其前的空白一并删除
        let i = varStartCol - 1;
        while (i >= 0 && /[ \t\*]/.test(lineText[i])) {
            i--;
        }

        // 判断被删除变量前是否有逗号
        const hadCommaBefore = i >= 0 && lineText[i] === ',';

        if (hadCommaBefore) {
            varStartCol = i; // 同时删除前面的逗号
        } else {
            varStartCol = i + 1; // 仅删除 * 与空白
        }

        const before = lineText.slice(0, varStartCol);
        const after = lineText.slice(varEndCol);

        let newLineText = '';
        const afterTrimStart = after.replace(/^\s*/, '');

        if (hadCommaBefore) {
            // 前面已经删除了一个逗号, 保留后方的逗号(如果有)以分隔其它变量
            newLineText = before + after; // 不做额外处理
        } else if (/^,/.test(afterTrimStart)) {
            // 变量位于最前, 需要去掉紧随其后的逗号
            const trimmedAfter = afterTrimStart.replace(/^,/, '');
            newLineText = before + trimmedAfter;
        } else {
            // 单变量声明, 删除整行
            newLineText = '';
        }

        // 如果整行被清空或仅剩类型关键字, 删除整行
        if (/^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\*?\s*;?\s*$/.test(newLineText) || newLineText.trim() === '') {
            edit.delete(document.uri, line.rangeIncludingLineBreak);
        } else {
            edit.replace(document.uri, line.range, newLineText);
        }

        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = true;

        return action;
    }

    private createCommentVariableAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            '注释未使用的变量',
            vscode.CodeActionKind.QuickFix
        );

        const edit = new vscode.WorkspaceEdit();

        const data = (diagnostic as any).data;

        if (data && typeof data.start === 'number' && typeof data.end === 'number') {
            // 根据绝对偏移构造精确范围
            let start = data.start as number;
            let end = data.end as number;

            const docText = document.getText();

            // ---- 向前扩展: 指针符、空白、逗号 ----
            let i = start - 1;
            while (i >= 0 && /[ \t\*]/.test(docText[i])) i--; // * 与空白
            if (i >= 0 && docText[i] === ',') {
                start = i; // 包含前逗号
            } else {
                start = i + 1; // 包含 * 与空白
            }

            // ---- 向后扩展: 逗号 ----
            i = end;
            while (i < docText.length && /[ \t]/.test(docText[i])) i++;
            if (i < docText.length && docText[i] === ',') {
                end = i + 1; // 包含后逗号
            }

            const replaceRange = new vscode.Range(
                document.positionAt(start),
                document.positionAt(end)
            );
            const original = document.getText(replaceRange);
            edit.replace(document.uri, replaceRange, `/*${original}*/`);
        } else {
            // 回退到整行注释
            const line = document.lineAt(diagnostic.range.start.line);
            edit.replace(document.uri, line.range, `/*${line.text}*/`);
        }

        action.edit = edit;
        action.diagnostics = [diagnostic];

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

    /**
     * 将变量重命名为 snake_case 或 camelCase
     */
    private createRenameVariableCaseAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        mode: 'snake' | 'camel'
    ): vscode.CodeAction | undefined {
        const oldName = document.getText(diagnostic.range).trim();
        if (!oldName) return;

        const newName = mode === 'snake' ? this.toSnakeCase(oldName) : this.toCamelCase(oldName);
        if (newName === oldName) return;

        const title = `改名为${mode === 'snake' ? '蛇形' : '驼峰'}: ${newName}`;
        const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);

        // 通过命令触发 renameProvider，以便同时更新所有引用
        action.command = {
            title,
            command: mode === 'snake' ? 'lpc.renameVarToSnakeCase' : 'lpc.renameVarToCamelCase',
            arguments: [document.uri, diagnostic.range.start, newName]
        };
        action.diagnostics = [diagnostic];
        return action;
    }

    private toSnakeCase(name: string): string {
        return name
            .replace(/([A-Z])/g, '_$1')
            .replace(/__/g, '_')
            .toLowerCase();
    }

    private toCamelCase(name: string): string {
        return name.replace(/_([a-zA-Z])/g, (_, g1: string) => g1.toUpperCase());
    }

    /**
     * 针对 apply 返回类型不匹配, 将返回类型修正为期望值。
     */
    private createFixApplyReturnTypeAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const msg = diagnostic.message;
        const match = /返回类型应为 '([^']+)'，当前为 '([^']+)'/.exec(msg);
        if (!match) return;
        const [, expected, actual] = match;

        // 函数定义所在行
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;

        // 尝试在当前行替换类型
        const typePattern = new RegExp(`\\b${actual}\\b`);
        if (!typePattern.test(lineText)) return;

        const newText = lineText.replace(typePattern, expected);

        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, line.range, newText);

        const action = new vscode.CodeAction('修正返回类型为 ' + expected, vscode.CodeActionKind.QuickFix);
        action.edit = edit;
        action.diagnostics = [diagnostic];
        return action;
    }

    /**
     * 生成Javadoc注释的命令处理函数
     */
    private async generateJavadocCommand(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showErrorMessage('请在LPC文件中选择一个函数');
            return;
        }

        const config = vscode.workspace.getConfiguration('lpc');
        const enableAutoGeneration = config.get<boolean>('javadoc.enableAutoGeneration', true);
        
        if (!enableAutoGeneration) {
            vscode.window.showInformationMessage('Javadoc自动生成功能已禁用');
            return;
        }

        const selection = editor.selection;
        
        try {
            // 显示进度条
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在生成Javadoc注释...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0 });

                // 解析函数 - 优先使用选中的文本，否则使用光标位置
                let functionInfo: any = null;
                if (!selection.isEmpty) {
                    functionInfo = LPCFunctionParser.parseFunctionFromSelection(editor.document, selection);
                } else {
                    // 使用光标位置自动检测函数
                    functionInfo = LPCFunctionParser.parseFunctionFromCursor(editor.document, selection.active);
                }
                
                if (!functionInfo) {
                    vscode.window.showErrorMessage('无法找到函数定义，请确保光标位于函数内部或选择完整的函数');
                    return;
                }

                progress.report({ increment: 30, message: '解析函数信息...' });

                const alwaysShowModelSelector = config.get<boolean>('glm4.alwaysShowModelSelector', false);
                const rememberLastModel = config.get<boolean>('glm4.rememberLastModel', true);
                const lastSelectedModel = config.get<string>('glm4.lastSelectedModel', '');
                
                let selectedModel: string | undefined;
                let glm4Client: GLM4Client;
                
                if (alwaysShowModelSelector) {
                    // 总是显示模型选择界面
                    selectedModel = await GLM4Client.selectModel();
                    if (!selectedModel) {
                        vscode.window.showInformationMessage('已取消生成Javadoc注释');
                        return;
                    }
                    glm4Client = GLM4Client.fromVSCodeConfigWithModel(selectedModel);
                } else if (rememberLastModel && lastSelectedModel) {
                    // 使用记住的上次选择的模型
                    selectedModel = lastSelectedModel;
                    glm4Client = GLM4Client.fromVSCodeConfigWithModel(selectedModel);
                } else {
                    // 让用户选择模型
                    selectedModel = await GLM4Client.selectModel();
                    if (!selectedModel) {
                        vscode.window.showInformationMessage('已取消生成Javadoc注释');
                        return;
                    }
                    glm4Client = GLM4Client.fromVSCodeConfigWithModel(selectedModel);
                }
                
                progress.report({ increment: 50, message: `使用模型 ${selectedModel} 调用API...` });

                // 生成Javadoc注释
                const javadocComment = await glm4Client.generateJavadoc(functionInfo.fullText);
                
                progress.report({ increment: 80, message: '插入注释...' });

                // 查找函数开始位置
                const functionStartLine = this.findFunctionStartLine(editor.document, selection, functionInfo);
                
                // 插入注释
                const insertPosition = new vscode.Position(functionStartLine, 0);
                const indent = this.getLineIndentation(editor.document, functionStartLine);
                
                // 格式化注释（添加适当的缩进）
                const formattedComment = this.formatJavadocComment(javadocComment, indent);
                
                await editor.edit(editBuilder => {
                    editBuilder.insert(insertPosition, formattedComment + '\n');
                });

                progress.report({ increment: 100, message: '完成' });
                
                vscode.window.showInformationMessage('Javadoc注释生成成功！');
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`生成Javadoc注释失败: ${errorMessage}`);
        }
    }

    /**
     * 查找函数开始行
     */
    private findFunctionStartLine(document: vscode.TextDocument, selection: vscode.Selection, functionInfo: any): number {
        // 使用AST信息直接获取函数定义的开始行
        const functionName = functionInfo.name;
        const text = document.getText();
        
        // 在函数的完整文本中查找函数名的位置
        const functionText = functionInfo.fullText;
        const functionTextIndex = text.indexOf(functionText);
        
        if (functionTextIndex !== -1) {
            // 在函数文本中查找函数名的位置
            const functionNameInText = functionText.indexOf(functionName + '(');
            if (functionNameInText !== -1) {
                const absolutePosition = functionTextIndex + functionNameInText;
                const position = document.positionAt(absolutePosition);
                return position.line;
            }
        }
        
        // 回退方案：在整个文档中查找函数名
        const functionNameIndex = text.indexOf(functionName + '(');
        if (functionNameIndex !== -1) {
            const position = document.positionAt(functionNameIndex);
            return position.line;
        }
        
        // 最后的回退：使用光标位置
        return selection.active.line;
    }

    /**
     * 获取指定行的缩进
     */
    private getLineIndentation(document: vscode.TextDocument, lineNumber: number): string {
        const line = document.lineAt(lineNumber);
        const match = line.text.match(/^(\s*)/);
        return match ? match[1] : '';
    }

    /**
     * 格式化Javadoc注释，添加适当的缩进
     */
    private formatJavadocComment(comment: string, indent: string): string {
        const lines = comment.split('\n');
        return lines.map(line => {
            if (line.trim() === '') {
                return indent;
            }
            return indent + line;
        }).join('\n');
    }
}

