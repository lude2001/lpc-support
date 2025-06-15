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
const functionDocPanel_1 = require("./functionDocPanel");
const formatter_1 = require("./formatter"); // 从 formatter.ts 导入
const ParseTreePrinter_1 = require("./parser/ParseTreePrinter");
const DebugErrorListener_1 = require("./parser/DebugErrorListener");
const antlr4ts_1 = require("antlr4ts");
const LPCLexer_1 = require("./antlr/LPCLexer");
const LPCParser_1 = require("./antlr/LPCParser");
const semanticTokensProvider_1 = require("./semanticTokensProvider");
const symbolProvider_1 = require("./symbolProvider");
const referenceProvider_1 = require("./referenceProvider");
const renameProvider_1 = require("./renameProvider");
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
            const formatted = (0, formatter_1.formatLPCCode)(text);
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
    // 注册函数文档面板命令
    let showFunctionDocCommand = vscode.commands.registerCommand('lpc.showFunctionDoc', () => {
        functionDocPanel_1.FunctionDocPanel.createOrShow(context, macroManager);
    });
    context.subscriptions.push(showFunctionDocCommand);
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
    // 注册显示解析树命令（调试用）
    const parseTreeCommand = vscode.commands.registerCommand('lpc.showParseTree', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showWarningMessage('请在 LPC 文件中使用此命令。');
            return;
        }
        try {
            const parseTreeStr = (0, ParseTreePrinter_1.getParseTreeString)(editor.document.getText());
            const output = vscode.window.createOutputChannel('LPC ParseTree');
            output.clear();
            output.appendLine(parseTreeStr);
            output.show(true);
        }
        catch (err) {
            vscode.window.showErrorMessage(`解析 LPC 代码时发生错误: ${err.message || err}`);
        }
    });
    context.subscriptions.push(parseTreeCommand);
    // —— 调试语法错误命令 ——
    const debugParseCmd = vscode.commands.registerCommand('lpc.debugParseErrors', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showWarningMessage('请在 LPC 文件中使用此命令');
            return;
        }
        const code = editor.document.getText();
        const input = antlr4ts_1.CharStreams.fromString(code);
        const lexer = new LPCLexer_1.LPCLexer(input);
        const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
        const parser = new LPCParser_1.LPCParser(tokenStream);
        const debugListener = new DebugErrorListener_1.DebugErrorListener();
        parser.removeErrorListeners();
        parser.addErrorListener(debugListener);
        // 解析
        parser.sourceFile();
        const output = vscode.window.createOutputChannel('LPC Parse Debug');
        output.clear();
        if (debugListener.errors.length === 0) {
            output.appendLine('未发现 ANTLR 语法错误。');
        }
        else {
            debugListener.errors.forEach((err, idx) => {
                output.appendLine(`错误 ${idx + 1}: 行 ${err.line}, 列 ${err.column}`);
                output.appendLine(`  token: ${err.offendingToken}`);
                output.appendLine(`  message: ${err.message}`);
                if (err.ruleStack.length) {
                    output.appendLine(`  rule stack: ${err.ruleStack.join(' -> ')}`);
                }
                output.appendLine('');
            });
        }
        output.show(true);
    });
    context.subscriptions.push(debugParseCmd);
    // 初始化代码补全提供程序
    const completionProvider = new completionProvider_1.LPCCompletionItemProvider(efunDocsManager, macroManager);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('lpc', completionProvider, '.', '->', '#' // 触发补全的字符
    ));
    // 注册文档变更事件，自动清除变量缓存
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'lpc') {
            completionProvider.clearVariableCache();
        }
    }));
    // 注册清除变量缓存命令
    context.subscriptions.push(vscode.commands.registerCommand('lpc.clearVariableCache', () => {
        completionProvider.clearVariableCache();
        vscode.window.showInformationMessage('已清除变量缓存');
    }));
    // 注册定义跳转提供程序
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('lpc', new definitionProvider_1.LPCDefinitionProvider(macroManager, efunDocsManager)));
    // 注册扫描继承关系命令
    context.subscriptions.push(vscode.commands.registerCommand('lpc.scanInheritance', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'lpc') {
            completionProvider.scanInheritance(editor.document);
        }
        else {
            vscode.window.showWarningMessage('请在LPC文件中使用此命令');
        }
    }));
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
    // 注册语义标记提供程序
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'lpc' }, new semanticTokensProvider_1.LPCSemanticTokensProvider(), semanticTokensProvider_1.LPCSemanticTokensLegend));
    // 注册文档符号提供程序 (大纲)
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: 'lpc' }, new symbolProvider_1.LPCSymbolProvider()));
    // 注册引用提供程序
    context.subscriptions.push(vscode.languages.registerReferenceProvider('lpc', new referenceProvider_1.LPCReferenceProvider()));
    // 注册重命名提供程序
    context.subscriptions.push(vscode.languages.registerRenameProvider('lpc', new renameProvider_1.LPCRenameProvider()));
}
// 停用扩展时调用
function deactivate() { }
//# sourceMappingURL=extension.js.map