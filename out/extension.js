"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const diagnostics_1 = require("./diagnostics");
const codeActions_1 = require("./codeActions");
const completionProvider_1 = require("./completionProvider");
const config_1 = require("./config");
const compiler_1 = require("./compiler");
const macroManager_1 = require("./macroManager");
const definitionProvider_1 = require("./definitionProvider");
const efunDocs_1 = require("./efunDocs");
function activate(context) {
    // 初始化诊断功能
    const macroManager = new macroManager_1.MacroManager();
    const diagnostics = new diagnostics_1.LPCDiagnostics(context, macroManager);
    // 初始化 Efun 文档管理器
    const efunDocsManager = new efunDocs_1.EfunDocsManager(context);
    // 注册 efun 文档设置命令
    context.subscriptions.push(vscode.commands.registerCommand('lpc.efunDocsSettings', async () => {
        const items = [
            {
                label: "更新 Efun 文档",
                description: "从在线文档更新 Efun 函数文档",
                command: 'lpc.updateEfunDocs'
            },
            {
                label: "配置模拟函数库目录",
                description: "设置模拟函数库的目录路径",
                command: 'lpc.configureSimulatedEfuns'
            }
        ];
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'efun文档设置'
        });
        if (selected) {
            vscode.commands.executeCommand(selected.command);
        }
    }));
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
    // 注册批量编译命令
    let compileFolderCommand = vscode.commands.registerCommand('lpc.compileFolder', async (uri) => {
        let targetFolder;
        if (uri) {
            // 如果是从右键菜单调用，使用选中的文件夹
            targetFolder = uri.fsPath;
        }
        else {
            // 如果是从命令面板调用，让用户选择工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('请先打开一个工作区');
                return;
            }
            const folders = workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                uri: folder.uri
            }));
            // 如果只有一个工作区文件夹，直接使用它
            if (folders.length === 1) {
                targetFolder = folders[0].uri.fsPath;
            }
            else {
                // 如果有多个工作区文件夹，让用户选择
                const selected = await vscode.window.showQuickPick(folders, {
                    placeHolder: '选择要编译的文件夹'
                });
                if (!selected) {
                    return;
                }
                targetFolder = selected.uri.fsPath;
            }
        }
        await compiler.compileFolder(targetFolder);
    });
    context.subscriptions.push(compileFolderCommand);
    // 注册代码补全提供程序
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lpc', new completionProvider_1.LPCCompletionItemProvider(efunDocsManager), '.', '->', '#' // 触发补全的字符
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
function formatLPCCode(code) {
    const lines = code.split(/\r?\n/);
    const result = [];
    let indentLevel = 0;
    const indentSize = 4;
    const state = {
        inBlockComment: false,
        inSpecialBlock: false,
        inString: false,
        inChar: false,
        escapeActive: false,
        inMultiLineCondition: false,
        pendingIf: false,
        pendingElse: false,
        extraIndent: 0
    };
    const specialBlocks = {
        start: new Set(["@LONG", "@TEXT", "@HELP"]),
        end: new Set(["LONG", "TEXT", "HELP"])
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';
        // 处理特殊块
        if (!state.inSpecialBlock && specialBlocks.start.has(trimmed)) {
            state.inSpecialBlock = true;
            result.push(line);
            continue;
        }
        if (state.inSpecialBlock) {
            result.push(line);
            if (specialBlocks.end.has(trimmed)) {
                state.inSpecialBlock = false;
            }
            continue;
        }
        // 处理缩进
        let effectiveIndent = indentLevel;
        // 处理多行条件
        if (trimmed.match(/^\|\|/)) {
            state.extraIndent = 1;
        }
        else if (trimmed.startsWith("}") || trimmed.endsWith("{")) {
            state.extraIndent = Math.max(indentLevel - (trimmed.startsWith("}") ? 1 : 0), 0);
        }
        else if (trimmed.startsWith("\"") && !trimmed.endsWith("\"") && !line.endsWith(";")) {
            state.extraIndent = indentLevel;
        }
        else {
            state.extraIndent = 0;
        }
        // 处理条件语句
        if (/^(if|else\s+if|else)(\s*\(.*\))?\s*$/g.test(trimmed) && !trimmed.endsWith('{')) {
            state.pendingIf = !state.inMultiLineCondition;
            state.pendingElse = /^else/.test(trimmed);
        }
        if (state.pendingIf || state.pendingElse) {
            if (trimmed === "{") {
                state.extraIndent = 0;
                state.pendingIf = false;
                state.pendingElse = false;
            }
            else {
                state.extraIndent = 1;
                if (!/^(if|else|while|for)\b/.test(trimmed)) {
                    state.pendingIf = false;
                    state.pendingElse = false;
                }
            }
        }
        // 计算最终缩进
        effectiveIndent = Math.max(0, state.inMultiLineCondition ? indentLevel - 1 :
            trimmed.startsWith("}") ? indentLevel - 1 : indentLevel);
        // 应用缩进
        const indentStr = " ".repeat((effectiveIndent + state.extraIndent) * indentSize);
        result.push(indentStr + trimmed);
        // 更新缩进级别
        updateIndentLevel(trimmed, state, indentLevel);
        // 检查多行条件结束
        if (state.inMultiLineCondition && !trimmed.match(/(\|\||&&)\s*$/)) {
            state.inMultiLineCondition = false;
            state.pendingIf = true;
        }
    }
    return result.join('\n');
}
function updateIndentLevel(line, state, indentLevel) {
    let newLevel = indentLevel;
    let inString = state.inString;
    let inChar = state.inChar;
    let escapeActive = state.escapeActive;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const nextCh = i + 1 < line.length ? line[i + 1] : '';
        if (state.inBlockComment) {
            if (ch === '*' && nextCh === '/') {
                state.inBlockComment = false;
                i++;
            }
            continue;
        }
        if (!inString && !inChar) {
            if (ch === '/' && nextCh === '*') {
                state.inBlockComment = true;
                i++;
                continue;
            }
            if (ch === '/' && nextCh === '/') {
                break;
            }
            if (ch === '{')
                newLevel++;
            if (ch === '}')
                newLevel = Math.max(0, newLevel - 1);
        }
        if (inString) {
            if (!escapeActive && ch === '\\') {
                escapeActive = true;
            }
            else if (escapeActive) {
                escapeActive = false;
            }
            else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (!inString && !inChar && ch === '"') {
            inString = true;
        }
    }
    return newLevel;
}
// 停用扩展时调用
function deactivate() { }
//# sourceMappingURL=extension.js.map