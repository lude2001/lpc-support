"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const diagnostics_1 = require("./diagnostics");
const codeActions_1 = require("./codeActions");
const completionProvider_1 = require("./completionProvider");
const config_1 = require("./config");
const compiler_1 = require("./compiler");
const macroManager_1 = require("./macroManager");
const definitionProvider_1 = require("./definitionProvider");
function activate(context) {
    // 初始化诊断功能
    const macroManager = new macroManager_1.MacroManager();
    const diagnostics = new diagnostics_1.LPCDiagnostics(context, macroManager);
    // 注册代码操作提供程序
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('lpc', new codeActions_1.LPCCodeActionProvider(), {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    }));
    // 注册格式化提供程序
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('lpc', {
        provideDocumentFormattingEdits(document) {
            const text = document.getText();
            const formatted = formatLPCCode(text);
            const range = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
            return [vscode.TextEdit.replace(range, formatted)];
        }
    }));
    // 分析当前打开的文档
    if (vscode.window.activeTextEditor) {
        diagnostics.analyzeDocument(vscode.window.activeTextEditor.document);
    }
    // 注册右键菜单命令
    let disposable = vscode.commands.registerCommand('lpc-support.checkUnusedVariables', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            diagnostics.analyzeDocument(editor.document, true);
            vscode.window.showInformationMessage('已完成未使用变量检查');
        }
    });
    context.subscriptions.push(disposable);
    // 在 activate 函数中添加
    let scanFolderCommand = vscode.commands.registerCommand('lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });
    context.subscriptions.push(scanFolderCommand);
    // 注册代码补全提供程序
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lpc', new completionProvider_1.LPCCompletionItemProvider(), '.', '->', '#' // 触发补全的字符
    ));
    // 初始化配置管理器和编译器
    const configManager = new config_1.LPCConfigManager(context);
    const compiler = new compiler_1.LPCCompiler(configManager);
    // 注册服务器管理命令
    context.subscriptions.push(vscode.commands.registerCommand('lpc.addServer', () => configManager.addServer()), vscode.commands.registerCommand('lpc.selectServer', () => configManager.selectServer()), vscode.commands.registerCommand('lpc.removeServer', () => configManager.removeServer()), vscode.commands.registerCommand('lpc.manageServers', () => configManager.showServerManager()));
    // 注册编译命令
    context.subscriptions.push(vscode.commands.registerCommand('lpc.compileFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'lpc') {
            await compiler.compileFile(editor.document.fileName);
        }
    }));
    // 注册宏相关命令
    context.subscriptions.push(vscode.commands.registerCommand('lpc.showMacros', () => macroManager.showMacrosList()), vscode.commands.registerCommand('lpc.configureMacroPath', () => macroManager.configurePath()));
    // 将宏管理器添加到清理列表
    context.subscriptions.push(macroManager);
    // 注册定义提供程序
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('lpc', new definitionProvider_1.LPCDefinitionProvider(macroManager)));
}
exports.activate = activate;
function formatLPCCode(code) {
    // 作者：Lu Dexiang
    const lines = code.split(/\r?\n/);
    let formatted = '';
    let indentLevel = 0;
    const indentSize = 4;
    let inMultilineComment = false;
    let inSingleLineComment = false;
    let inString = false;
    let inChar = false;
    let inSpecialBlock = false; // 标记是否在 @LONG/@TEXT/@HELP 等特殊块中
    const specialBlockStart = ['@LONG', '@TEXT', '@HELP'];
    const specialBlockEnd = ['LONG', 'TEXT', 'HELP'];
    for (let line of lines) {
        let trimmedLine = line.trim();
        // 检查特殊块的开始
        if (specialBlockStart.some(tag => trimmedLine.startsWith(tag))) {
            inSpecialBlock = true;
        }
        // 在特殊块中，直接添加，不处理缩进
        if (inSpecialBlock) {
            formatted += line + '\n';
            // 检查特殊块的结束
            if (specialBlockEnd.some(tag => trimmedLine === tag || trimmedLine.endsWith(tag))) {
                inSpecialBlock = false;
            }
            continue;
        }
        // 忽略空行
        if (trimmedLine.length === 0) {
            formatted += '\n';
            continue;
        }
        let i = 0;
        let lineLength = line.length;
        let char = '';
        let nextChar = '';
        let previousChar = '';
        let tempIndentLevel = indentLevel;
        let shouldDecreaseIndent = false;
        inSingleLineComment = false;
        // 检查当前行是否需要减少缩进
        while (i < lineLength) {
            char = line[i];
            nextChar = i + 1 < lineLength ? line[i + 1] : '';
            // 处理单行注释
            if (!inString && !inChar && !inMultilineComment && char === '/' && nextChar === '/') {
                inSingleLineComment = true;
                break;
            }
            // 处理多行注释的开始
            if (!inString && !inChar && !inMultilineComment && char === '/' && nextChar === '*') {
                inMultilineComment = true;
                i++;
                previousChar = char;
                continue;
            }
            // 处理多行注释的结束
            if (inMultilineComment && char === '*' && nextChar === '/') {
                inMultilineComment = false;
                i++;
                previousChar = char;
                continue;
            }
            // 处理字符串的开始和结束
            if (!inSingleLineComment && !inMultilineComment) {
                if (!inString && !inChar && char === '"') {
                    inString = true;
                }
                else if (inString && char === '"' && previousChar !== '\\') {
                    inString = false;
                }
                if (!inString && !inChar && char === "'") {
                    inChar = true;
                }
                else if (inChar && char === "'" && previousChar !== '\\') {
                    inChar = false;
                }
            }
            // 检查是否需要减少缩进
            if (!inString && !inChar && !inSingleLineComment && !inMultilineComment) {
                if (char === '}' && line.trim().startsWith('}')) {
                    tempIndentLevel = Math.max(tempIndentLevel - 1, 0);
                    shouldDecreaseIndent = true;
                    break;
                }
            }
            previousChar = char;
            i++;
        }
        // 应用缩进
        let currentIndent = shouldDecreaseIndent ? tempIndentLevel : indentLevel;
        formatted += ' '.repeat(currentIndent * indentSize) + trimmedLine + '\n';
        // 更新缩进级别
        i = 0;
        inString = false;
        inChar = false;
        previousChar = '';
        while (i < lineLength) {
            char = line[i];
            nextChar = i + 1 < lineLength ? line[i + 1] : '';
            if (!inString && !inChar && !inSingleLineComment && !inMultilineComment) {
                if (char === '{') {
                    indentLevel++;
                }
                else if (char === '}') {
                    indentLevel = Math.max(indentLevel - 1, 0);
                }
            }
            // 更新状态
            if (!inString && !inChar && char === '/' && nextChar === '/') {
                break; // 剩余部分为单行注释，忽略
            }
            if (!inString && !inChar && char === '/' && nextChar === '*') {
                inMultilineComment = true;
                i++;
            }
            else if (inMultilineComment && char === '*' && nextChar === '/') {
                inMultilineComment = false;
                i++;
            }
            else if (!inString && !inChar && char === '"') {
                inString = true;
            }
            else if (inString && char === '"' && previousChar !== '\\') {
                inString = false;
            }
            else if (!inString && !inChar && char === "'") {
                inChar = true;
            }
            else if (inChar && char === "'" && previousChar !== '\\') {
                inChar = false;
            }
            previousChar = char;
            i++;
        }
        // 重置单行注释标志
        inSingleLineComment = false;
    }
    return formatted;
}
// 停用扩展时调用
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map