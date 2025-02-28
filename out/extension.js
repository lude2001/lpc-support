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
        inFunctionDeclaration: false,
        inFunctionParams: false,
        inSwitchBlock: false,
        inCaseBlock: false,
        inMapping: false,
        inArray: false,
        inMultiLineString: false,
        inInheritBlock: false,
        inVarargs: false,
        inDocComment: false,
        extraIndent: 0,
        bracketStack: [], // 用于跟踪括号匹配
        lastIndentLevel: 0, // 记录上一行的缩进级别
        inIfBlock: false, // 是否在if块内
        ifWithoutBrace: false, // 是否是没有大括号的if语句
        pendingCloseBrace: false, // 是否有待关闭的大括号
        functionCommentBlock: false, // 是否在函数注释块内
        inFunctionBody: false, // 是否在函数体内
        lastLineWasBrace: false, // 上一行是否是大括号
        lastLineWasIf: false // 上一行是否是if语句
    };
    const specialBlocks = {
        start: new Set(["@LONG", "@TEXT", "@HELP"]),
        end: new Set(["LONG", "TEXT", "HELP"])
    };
    // 预处理：检测函数声明
    const functionPattern = /^([\w\*]+\s+)+[\w_]+\s*\(/;
    const inheritPattern = /^\s*inherit\s+/;
    const includePattern = /^\s*#include\s+/;
    const definePattern = /^\s*#define\s+/;
    const mappingPattern = /\bmapping\s*\(/;
    const arrayPattern = /\(\{\s*$/;
    const switchPattern = /\bswitch\s*\(/;
    const casePattern = /^\s*case\s+/;
    const defaultPattern = /^\s*default\s*:/;
    const inheritBlockPattern = /^\s*::\s*\{/;
    const arrowPattern = /->/;
    const varargsPattern = /\.\.\./;
    const ifPattern = /^\s*if\s*\(/;
    const elsePattern = /^\s*else\s*/;
    const elseIfPattern = /^\s*else\s+if\s*\(/;
    const forPattern = /^\s*for\s*\(/;
    const whilePattern = /^\s*while\s*\(/;
    const doPattern = /^\s*do\s*/;
    const returnPattern = /^\s*return\s+/;
    const functionCommentPattern = /^\s*\/\*\*\s*/;
    const commentEndPattern = /\*\/\s*$/;
    const singleLineCommentPattern = /^\s*\/\//;
    const blockCommentStartPattern = /^\s*\/\*/;
    const blockCommentEndPattern = /\*\/\s*$/;
    // 处理连续空行
    let consecutiveEmptyLines = 0;
    const maxConsecutiveEmptyLines = 2;
    // 第一遍：分析代码结构
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 分析括号匹配
        if (line.includes('{') && !state.inString && !state.inChar && !state.inBlockComment) {
            state.bracketStack.push('{');
        }
        if (line.includes('}') && !state.inString && !state.inChar && !state.inBlockComment) {
            if (state.bracketStack.length > 0 && state.bracketStack[state.bracketStack.length - 1] === '{') {
                state.bracketStack.pop();
            }
        }
        // 分析if语句
        if (ifPattern.test(line) && !line.includes('{') && !line.endsWith(';')) {
            state.ifWithoutBrace = true;
        }
        // 分析函数声明
        if (functionPattern.test(line) && !line.endsWith(";")) {
            // 查找前面的注释块
            let j = i - 1;
            while (j >= 0 && (lines[j].trim() === '' || singleLineCommentPattern.test(lines[j]))) {
                j--;
            }
            if (j >= 0 && blockCommentStartPattern.test(lines[j])) {
                // 找到了函数注释块
                let k = j;
                while (k >= 0 && !blockCommentEndPattern.test(lines[k])) {
                    k--;
                }
                if (k < j) {
                    // 这是一个多行注释块
                    for (let l = k; l <= j; l++) {
                        lines[l] = lines[l].trim();
                    }
                }
            }
        }
    }
    // 第二遍：格式化代码
    state.bracketStack = []; // 重置括号栈
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';
        const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
        // 处理特殊块（如@LONG...LONG）
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
        // 处理函数注释块 (/** ... */)
        if (functionCommentPattern.test(trimmed) && !state.inBlockComment) {
            // 函数注释块不缩进
            result.push(trimmed);
            if (!commentEndPattern.test(trimmed)) {
                state.functionCommentBlock = true;
            }
            continue;
        }
        if (state.functionCommentBlock) {
            result.push(trimmed);
            if (commentEndPattern.test(trimmed)) {
                state.functionCommentBlock = false;
            }
            continue;
        }
        // 处理普通文档注释块 (/* ... */)
        if (blockCommentStartPattern.test(trimmed) && !functionCommentPattern.test(trimmed) && !state.inBlockComment) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            if (!blockCommentEndPattern.test(trimmed)) {
                state.inBlockComment = true;
            }
            continue;
        }
        if (state.inBlockComment) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            if (blockCommentEndPattern.test(trimmed)) {
                state.inBlockComment = false;
            }
            continue;
        }
        // 处理空行
        if (trimmed === '') {
            // 限制连续空行数量
            if (consecutiveEmptyLines < maxConsecutiveEmptyLines) {
                result.push('');
                consecutiveEmptyLines++;
            }
            continue;
        }
        else {
            consecutiveEmptyLines = 0;
        }
        // 处理单行注释
        if (singleLineCommentPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理预处理指令（#include, #define等）
        if (includePattern.test(trimmed) || definePattern.test(trimmed)) {
            result.push(trimmed);
            continue;
        }
        // 处理inherit语句
        if (inheritPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理::继承块
        if (inheritBlockPattern.test(trimmed)) {
            state.inInheritBlock = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            continue;
        }
        // 处理多行字符串
        if (state.inMultiLineString) {
            if (trimmed.includes('"') && !trimmed.startsWith('\\')) {
                state.inMultiLineString = false;
                // 多行字符串结束行使用当前缩进
                const indentStr = " ".repeat(indentLevel * indentSize);
                result.push(indentStr + trimmed);
            }
            else {
                // 多行字符串内容保持原样或增加一级缩进
                const indentStr = " ".repeat((indentLevel + 1) * indentSize);
                result.push(indentStr + trimmed);
            }
            continue;
        }
        // 检测多行字符串开始
        if (trimmed.startsWith('"') && !trimmed.endsWith('"') &&
            !trimmed.endsWith('\\') && !trimmed.endsWith(';')) {
            state.inMultiLineString = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理函数声明
        if (functionPattern.test(trimmed) && !trimmed.endsWith(";")) {
            state.inFunctionDeclaration = true;
            state.inFunctionBody = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 检查是否有函数参数
            if (trimmed.includes('(') && !trimmed.includes(')')) {
                state.inFunctionParams = true;
            }
            // 如果函数声明后面跟着{，增加缩进级别
            if (trimmed.endsWith('{')) {
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            continue;
        }
        // 处理函数参数
        if (state.inFunctionParams) {
            const indentStr = " ".repeat((indentLevel + 1) * indentSize);
            result.push(indentStr + trimmed);
            if (trimmed.includes(')')) {
                state.inFunctionParams = false;
                // 如果函数参数后面跟着{，增加缩进级别
                if (trimmed.endsWith('{')) {
                    indentLevel++;
                    state.lastLineWasBrace = true;
                }
            }
            continue;
        }
        // 处理if语句
        if (ifPattern.test(trimmed) || elseIfPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            state.lastLineWasIf = true;
            // 如果if语句后面没有{，但也没有;结尾，则增加缩进
            if (!trimmed.includes('{') && !trimmed.endsWith(';')) {
                indentLevel++;
                state.ifWithoutBrace = true;
            }
            else if (trimmed.endsWith('{')) {
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            continue;
        }
        // 处理else语句
        if (elsePattern.test(trimmed) && !elseIfPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 如果else语句后面有{，增加缩进
            if (trimmed.endsWith('{')) {
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else if (!trimmed.endsWith(';')) {
                // 如果else后面没有{，但也不是单行语句，增加缩进
                indentLevel++;
                state.ifWithoutBrace = true;
            }
            continue;
        }
        // 处理for/while/do语句
        if (forPattern.test(trimmed) || whilePattern.test(trimmed) || doPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 如果语句后面有{，增加缩进
            if (trimmed.endsWith('{')) {
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            else if (!trimmed.endsWith(';')) {
                // 如果语句后面没有{，但也不是单行语句，增加缩进
                indentLevel++;
            }
            continue;
        }
        // 处理return语句
        if (returnPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 如果是没有大括号的if块中的return语句，减少缩进
            if (state.ifWithoutBrace && trimmed.endsWith(';')) {
                indentLevel--;
                state.ifWithoutBrace = false;
            }
            continue;
        }
        // 处理可变参数
        if (varargsPattern.test(trimmed)) {
            state.inVarargs = true;
        }
        // 处理switch语句
        if (switchPattern.test(trimmed)) {
            state.inSwitchBlock = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 如果switch语句后面有{，增加缩进
            if (trimmed.endsWith('{')) {
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            continue;
        }
        // 处理case语句
        if (state.inSwitchBlock && (casePattern.test(trimmed) || defaultPattern.test(trimmed))) {
            state.inCaseBlock = true;
            // case语句缩进比switch少一级
            const indentStr = " ".repeat((indentLevel - 1) * indentSize);
            result.push(indentStr + trimmed);
            continue;
        }
        // 处理mapping和数组
        if (mappingPattern.test(trimmed)) {
            state.inMapping = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            // 如果mapping后面有{，增加缩进
            if (trimmed.endsWith('{')) {
                indentLevel++;
                state.lastLineWasBrace = true;
            }
            continue;
        }
        if (arrayPattern.test(trimmed)) {
            state.inArray = true;
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            state.lastLineWasBrace = true;
            continue;
        }
        // 处理大括号
        if (trimmed === '{') {
            const indentStr = " ".repeat(indentLevel * indentSize);
            result.push(indentStr + trimmed);
            indentLevel++;
            state.lastLineWasBrace = true;
            continue;
        }
        if (trimmed === '}' || trimmed.startsWith('}')) {
            // 减少缩进级别
            indentLevel = Math.max(0, indentLevel - 1);
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            // 结束各种块
            if (state.inSwitchBlock && trimmed === '}') {
                state.inSwitchBlock = false;
            }
            if (state.inCaseBlock && trimmed === '}') {
                state.inCaseBlock = false;
            }
            if (state.inMapping && trimmed === '}') {
                state.inMapping = false;
            }
            if (state.inArray && trimmed.includes('})')) {
                state.inArray = false;
            }
            if (state.inFunctionDeclaration && trimmed === '}') {
                state.inFunctionDeclaration = false;
                state.inFunctionBody = false;
            }
            if (state.inInheritBlock && trimmed === '}') {
                state.inInheritBlock = false;
            }
            // 如果是没有大括号的if块中的语句结束，减少缩进
            if (state.ifWithoutBrace && trimmed.endsWith(';')) {
                state.ifWithoutBrace = false;
            }
            state.lastLineWasBrace = true;
            continue;
        }
        else {
            state.lastLineWasBrace = false;
        }
        // 处理case块内的语句
        if (state.inCaseBlock && !casePattern.test(trimmed) && !defaultPattern.test(trimmed)) {
            const indentStr = " ".repeat(indentLevel * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 处理mapping和数组内的元素
        if ((state.inMapping || state.inArray) && !trimmed.startsWith('mapping') &&
            !trimmed.startsWith('({') && !trimmed.startsWith('}') && !trimmed.startsWith(')')) {
            const indentStr = " ".repeat((indentLevel + 1) * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 处理->箭头操作符的链式调用
        if (arrowPattern.test(trimmed) && trimmed.startsWith('->')) {
            const indentStr = " ".repeat((indentLevel + 1) * indentSize);
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
            continue;
        }
        // 应用缩进
        const indentStr = " ".repeat(indentLevel * indentSize);
        // 不要修改多行字符串的内容
        if (state.inString && !state.escapeActive && trimmed.indexOf('"') === -1) {
            result.push(line); // 保持原样
        }
        else {
            // 格式化操作符周围的空格，但保护字符串内容
            let formattedLine = formatLinePreservingStrings(trimmed);
            // 处理LPC特有的格式
            formattedLine = formatLPCSpecificSyntax(formattedLine);
            result.push(indentStr + formattedLine);
        }
        // 如果是没有大括号的if块中的语句结束，减少缩进
        if (state.ifWithoutBrace && trimmed.endsWith(';')) {
            indentLevel = Math.max(0, indentLevel - 1);
            state.ifWithoutBrace = false;
        }
        // 重置上一行状态
        state.lastLineWasIf = false;
    }
    return result.join('\n');
}
// 格式化一行代码，但保护字符串内容不被修改
function formatLinePreservingStrings(line) {
    // 提取所有字符串
    const strings = [];
    const stringPlaceholder = "___STRING_PLACEHOLDER___";
    // 临时替换字符串为占位符
    let processedLine = line.replace(/"(?:\\"|[^"])*"/g, (match) => {
        strings.push(match);
        return stringPlaceholder + (strings.length - 1);
    });
    // 提取所有字符
    const chars = [];
    const charPlaceholder = "___CHAR_PLACEHOLDER___";
    // 临时替换字符为占位符
    processedLine = processedLine.replace(/'(?:\\'|[^'])*'/g, (match) => {
        chars.push(match);
        return charPlaceholder + (chars.length - 1);
    });
    // 提取所有注释
    const comments = [];
    const commentPlaceholder = "___COMMENT_PLACEHOLDER___";
    // 临时替换单行注释为占位符
    processedLine = processedLine.replace(/\/\/.*$/g, (match) => {
        comments.push(match);
        return commentPlaceholder + (comments.length - 1);
    });
    // 保存原始操作符，避免被错误分割
    // 保存复合操作符
    const compoundOps = [];
    const compoundOpPlaceholder = "___COMPOUND_OP_PLACEHOLDER___";
    // 保存 ==, !=, >=, <=
    processedLine = processedLine.replace(/(==|!=|>=|<=)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 +=, -=, *=, /=, %=
    processedLine = processedLine.replace(/(\+=|-=|\*=|\/=|%=)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 &&, ||
    processedLine = processedLine.replace(/(&&|\|\|)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 ->
    processedLine = processedLine.replace(/(->)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 保存 ::
    processedLine = processedLine.replace(/(::)/g, (match) => {
        compoundOps.push(match);
        return compoundOpPlaceholder + (compoundOps.length - 1);
    });
    // 格式化单个操作符周围的空格
    // 格式化算术操作符（+, -, *, /, %）
    processedLine = processedLine.replace(/([^+\-*\/%= ])\s*([+\-*\/%])\s*([^= ])/g, '$1 $2 $3');
    // 格式化比较操作符（>, <）
    processedLine = processedLine.replace(/([^><= ])\s*([><])\s*([^= ])/g, '$1 $2 $3');
    // 格式化赋值操作符（=）
    processedLine = processedLine.replace(/([^+\-*\/%= ])\s*(=)\s*/g, '$1 $2 ');
    // 恢复复合操作符并添加适当的空格
    for (let i = 0; i < compoundOps.length; i++) {
        const op = compoundOps[i];
        if (op === '->') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' -> ');
        }
        else if (op === '::') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' :: ');
        }
        else if (op === '==' || op === '!=' || op === '>=' || op === '<=') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' ' + op + ' ');
        }
        else if (op === '&&' || op === '||') {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' ' + op + ' ');
        }
        else {
            processedLine = processedLine.replace(compoundOpPlaceholder + i, ' ' + op + ' ');
        }
    }
    // 修复逗号后面的空格
    processedLine = processedLine.replace(/,\s*/g, ', ');
    // 修复分号前的空格
    processedLine = processedLine.replace(/\s*;/g, ';');
    // 修复括号内外的空格
    processedLine = processedLine.replace(/\(\s+/g, '(');
    processedLine = processedLine.replace(/\s+\)/g, ')');
    // 修复方括号内外的空格
    processedLine = processedLine.replace(/\[\s+/g, '[');
    processedLine = processedLine.replace(/\s+\]/g, ']');
    // 修复大括号内外的空格
    processedLine = processedLine.replace(/\{\s+/g, '{ ');
    processedLine = processedLine.replace(/\s+\}/g, ' }');
    // 修复多余的空格
    processedLine = processedLine.replace(/\s{2,}/g, ' ');
    // 恢复注释
    for (let i = 0; i < comments.length; i++) {
        processedLine = processedLine.replace(commentPlaceholder + i, comments[i]);
    }
    // 恢复字符
    for (let i = 0; i < chars.length; i++) {
        processedLine = processedLine.replace(charPlaceholder + i, chars[i]);
    }
    // 恢复字符串
    for (let i = 0; i < strings.length; i++) {
        processedLine = processedLine.replace(stringPlaceholder + i, strings[i]);
    }
    return processedLine;
}
function updateIndentLevel(line, state, indentLevel) {
    let newLevel = indentLevel;
    // 处理多行注释
    if (line.includes("/*") && !line.includes("*/")) {
        state.inBlockComment = true;
        return newLevel;
    }
    if (state.inBlockComment) {
        if (line.includes("*/")) {
            state.inBlockComment = false;
        }
        return newLevel;
    }
    // 跳过单行注释
    if (line.trim().startsWith("//")) {
        return newLevel;
    }
    // 处理字符串和字符
    let inString = state.inString;
    let inChar = state.inChar;
    let escapeActive = state.escapeActive;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const nextCh = i + 1 < line.length ? line[i + 1] : '';
        // 跳过注释内容
        if (!inString && !inChar) {
            if (ch === '/' && nextCh === '/') {
                break; // 跳过行内剩余部分
            }
            if (ch === '/' && nextCh === '*') {
                state.inBlockComment = true;
                i++;
                continue;
            }
        }
        if (state.inBlockComment) {
            if (ch === '*' && nextCh === '/') {
                state.inBlockComment = false;
                i++;
            }
            continue;
        }
        // 处理字符串
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
            continue;
        }
        // 处理字符
        if (inChar) {
            if (!escapeActive && ch === '\\') {
                escapeActive = true;
            }
            else if (escapeActive) {
                escapeActive = false;
            }
            else if (ch === '\'') {
                inChar = false;
            }
            continue;
        }
        if (!inString && !inChar && ch === '\'') {
            inChar = true;
            continue;
        }
        // 处理缩进
        if (!inString && !inChar) {
            if (ch === '{') {
                newLevel++;
            }
            else if (ch === '}') {
                newLevel = Math.max(0, newLevel - 1);
            }
        }
    }
    // 更新状态
    state.inString = inString;
    state.inChar = inChar;
    state.escapeActive = escapeActive;
    // 处理特殊情况
    const trimmed = line.trim();
    // 处理::继承块
    if (/^\s*::\s*\{/.test(trimmed)) {
        state.inInheritBlock = true;
        newLevel++;
    }
    // 如果行以 "if", "else if", "else", "for", "while", "foreach", "switch" 开头但不以 '{' 结尾
    // 且不以 ';' 结尾（表示不是单行语句），则增加缩进
    if (/^(if|else\s+if|else|for|while|foreach|switch)\s*\(.*\)\s*$/.test(trimmed) &&
        !trimmed.endsWith("{") && !trimmed.endsWith(";")) {
        newLevel++;
    }
    // 处理do-while结构
    if (/^do\s*$/.test(trimmed) || /^do\s*\{/.test(trimmed)) {
        if (!trimmed.endsWith("{")) {
            newLevel++;
        }
    }
    // 处理case语句
    if (/^case\s+.*:/.test(trimmed) || /^default\s*:/.test(trimmed)) {
        if (state.inSwitchBlock) {
            // case语句后的代码块需要缩进
            newLevel++;
        }
    }
    // 处理多行条件
    if ((trimmed.endsWith("&&") || trimmed.endsWith("||")) &&
        !trimmed.startsWith("if") && !trimmed.startsWith("while") && !trimmed.startsWith("for")) {
        state.inMultiLineCondition = true;
    }
    else if (state.inMultiLineCondition &&
        !trimmed.endsWith("&&") && !trimmed.endsWith("||")) {
        state.inMultiLineCondition = false;
    }
    // 处理函数参数
    if (trimmed.includes('(') && !trimmed.includes(')') &&
        /^([\w\*]+\s+)+[\w_]+\s*\(/.test(trimmed)) {
        state.inFunctionParams = true;
    }
    else if (state.inFunctionParams && trimmed.includes(')')) {
        state.inFunctionParams = false;
    }
    // 处理mapping和数组
    if (trimmed.includes("mapping") && trimmed.includes("(") && !trimmed.includes(")")) {
        state.inMapping = true;
    }
    else if (state.inMapping && trimmed.includes(")")) {
        state.inMapping = false;
    }
    if (trimmed.includes("({") && !trimmed.includes("})")) {
        state.inArray = true;
    }
    else if (state.inArray && trimmed.includes("})")) {
        state.inArray = false;
    }
    // 检测多行字符串
    if (trimmed.startsWith('"') && !trimmed.endsWith('"') &&
        !trimmed.endsWith('\\') && !trimmed.endsWith(';')) {
        state.inMultiLineString = true;
    }
    else if (state.inMultiLineString && trimmed.includes('"') && !trimmed.startsWith('\\')) {
        state.inMultiLineString = false;
    }
    // 检测可变参数
    if (trimmed.includes('...')) {
        state.inVarargs = true;
    }
    else if (state.inVarargs && trimmed.includes(')')) {
        state.inVarargs = false;
    }
    return newLevel;
}
// 格式化LPC特有的语法
function formatLPCSpecificSyntax(line) {
    let result = line;
    // 格式化类型转换 ((type)var)
    result = result.replace(/\(\s*(\w+)\s*\)\s*(\w+)/g, '($1)$2');
    // 格式化数组访问 (arr[idx])
    result = result.replace(/(\w+)\s*\[\s*(\w+|\d+)\s*\]/g, '$1[$2]');
    // 格式化函数调用 (func(args))
    result = result.replace(/(\w+)\s*\(\s*/g, '$1(');
    result = result.replace(/\s*\)/g, ')');
    // 格式化mapping访问 (map["key"])
    result = result.replace(/(\w+)\s*\[\s*"([^"]*)"\s*\]/g, '$1["$2"]');
    // 格式化可变参数语法 (...)
    result = result.replace(/\s*\.\.\.\s*/g, '...');
    return result;
}
// 停用扩展时调用
function deactivate() { }
//# sourceMappingURL=extension.js.map