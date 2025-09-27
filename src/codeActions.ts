import * as vscode from 'vscode';
import { GLM4Client } from './glm4Client';
import { LPCFunctionParser } from './functionParser';

export class LPCCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly unusedVarDiagnosticCode = 'unusedVar';
    public static readonly unusedParamDiagnosticCode = 'unusedParam';
    public static readonly unusedGlobalVarDiagnosticCode = 'unusedGlobalVar';
    public static readonly localVariablePositionCode = 'localVariableDeclarationPosition';

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


            // === 局部变量定义位置错误 ===
            if (diagCode === LPCCodeActionProvider.localVariablePositionCode) {
                // 移动变量到当前代码块开头
                const moveToBlockStartAction = this.createMoveVariableToBlockStartAction(document, diagnostic);
                if (moveToBlockStartAction) {
                    actions.push(moveToBlockStartAction);
                }

                // 移动变量到函数开头
                const moveToFunctionStartAction = this.createMoveVariableToFunctionStartAction(document, diagnostic);
                if (moveToFunctionStartAction) {
                    actions.push(moveToFunctionStartAction);
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

    /**
     * 创建将变量移动到当前代码块开头的快速修复动作
     */
    private createMoveVariableToBlockStartAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            '移动变量声明到当前代码块开头',
            vscode.CodeActionKind.QuickFix
        );

        const edit = new vscode.WorkspaceEdit();
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();

        // 找到包含这个变量声明的代码块的开头
        const blockStartLine = this.findBlockStart(document, diagnostic.range.start.line);
        if (blockStartLine === -1) {
            return undefined;
        }

        // 获取代码块开头的缩进
        const blockStartLineObj = document.lineAt(blockStartLine);
        const blockIndent = this.getLineIndentation(document, blockStartLine);

        // 找到代码块开头后的第一个可执行位置（跳过已有的变量声明）
        let insertLine = blockStartLine + 1;
        while (insertLine < document.lineCount) {
            const line = document.lineAt(insertLine);
            const lineText = line.text.trim();

            // 跳过空行和注释
            if (lineText === '' || lineText.startsWith('//') || lineText.startsWith('/*')) {
                insertLine++;
                continue;
            }

            // 如果是变量声明，继续跳过
            if (this.isVariableDeclaration(lineText)) {
                insertLine++;
                continue;
            }

            // 找到第一个非变量声明的位置
            break;
        }

        // 格式化变量声明（保持适当缩进）
        const indentedVariableText = blockIndent + '    ' + variableText;

        // 删除原来的变量声明行
        edit.delete(document.uri, variableLine.rangeIncludingLineBreak);

        // 在代码块开头插入变量声明
        const insertPosition = new vscode.Position(insertLine, 0);
        edit.insert(document.uri, insertPosition, indentedVariableText + '\n');

        action.edit = edit;
        action.diagnostics = [diagnostic];
        action.isPreferred = true;

        return action;
    }

    /**
     * 创建将变量移动到函数开头的快速修复动作
     */
    private createMoveVariableToFunctionStartAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        const action = new vscode.CodeAction(
            '移动变量声明到函数开头',
            vscode.CodeActionKind.QuickFix
        );

        const edit = new vscode.WorkspaceEdit();
        const variableLine = document.lineAt(diagnostic.range.start.line);
        const variableText = variableLine.text.trim();

        // 找到包含这个变量声明的函数开头
        const functionStartLine = this.findFunctionStart(document, diagnostic.range.start.line);
        if (functionStartLine === -1) {
            return undefined;
        }

        // 找到函数体的开始位置（{后的第一行）
        let functionBodyStart = functionStartLine;
        for (let line = functionStartLine; line < document.lineCount; line++) {
            if (document.lineAt(line).text.includes('{')) {
                functionBodyStart = line + 1;
                break;
            }
        }

        // 找到函数体中第一个非变量声明的位置
        let insertLine = functionBodyStart;
        while (insertLine < document.lineCount) {
            const line = document.lineAt(insertLine);
            const lineText = line.text.trim();

            // 跳过空行和注释
            if (lineText === '' || lineText.startsWith('//') || lineText.startsWith('/*')) {
                insertLine++;
                continue;
            }

            // 如果是变量声明，继续跳过
            if (this.isVariableDeclaration(lineText)) {
                insertLine++;
                continue;
            }

            // 找到第一个非变量声明的位置
            break;
        }

        // 获取函数体的缩进
        const functionIndent = this.getLineIndentation(document, functionBodyStart) || '    ';
        const indentedVariableText = functionIndent + variableText;

        // 删除原来的变量声明行
        edit.delete(document.uri, variableLine.rangeIncludingLineBreak);

        // 在函数开头插入变量声明
        const insertPosition = new vscode.Position(insertLine, 0);
        edit.insert(document.uri, insertPosition, indentedVariableText + '\n');

        action.edit = edit;
        action.diagnostics = [diagnostic];

        return action;
    }

    /**
     * 找到包含指定行的代码块的开始行号
     */
    private findBlockStart(document: vscode.TextDocument, lineNumber: number): number {
        let braceCount = 0;
        let foundOpenBrace = false;

        // 从当前行向上查找，找到对应的开放大括号
        for (let line = lineNumber; line >= 0; line--) {
            const lineText = document.lineAt(line).text;

            // 从右到左计算大括号
            for (let i = lineText.length - 1; i >= 0; i--) {
                const char = lineText[i];
                if (char === '}') {
                    braceCount++;
                } else if (char === '{') {
                    if (braceCount === 0) {
                        foundOpenBrace = true;
                        return line;
                    }
                    braceCount--;
                }
            }

            if (foundOpenBrace) {
                break;
            }
        }

        return -1;
    }

    /**
     * 找到包含指定行的函数的开始行号
     */
    private findFunctionStart(document: vscode.TextDocument, lineNumber: number): number {
        // 向上查找函数定义的开始
        for (let line = lineNumber; line >= 0; line--) {
            const lineText = document.lineAt(line).text.trim();

            // 匹配函数定义的模式：type functionName(parameters) 或 functionName(parameters)
            if (/^(?:(?:public|private|protected|static|nosave|varargs)\s+)*(?:int|string|object|mixed|void|float|mapping|status)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)/.test(lineText)) {
                return line;
            }
        }

        return -1;
    }

    /**
     * 判断一行文本是否是变量声明
     */
    private isVariableDeclaration(lineText: string): boolean {
        // 匹配变量声明的模式
        return /^\s*(?:(?:public|private|protected|static|nosave)\s+)*(?:int|string|object|mixed|void|float|mapping|status)\s+[a-zA-Z_][a-zA-Z0-9_*\s,]*;/.test(lineText);
    }
}

