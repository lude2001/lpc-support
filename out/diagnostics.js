"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDiagnostics = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
function loadLPCConfig(configPath) {
    try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent);
    }
    catch (error) {
        vscode.window.showErrorMessage(`无法加载配置文件: ${error}`);
        return {
            types: [],
            modifiers: [],
            efuns: {}
        };
    }
}
class LPCDiagnostics {
    constructor(context, macroManager) {
        // 预编译的正则表达式，避免重复创建
        this.objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\()?/g;
        this.macroDefRegex = /\b([A-Z_][A-Z0-9_]*)\b/;
        this.macroManager = macroManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        context.subscriptions.push(this.diagnosticCollection);
        // 加载配置
        const configPath = path.join(context.extensionPath, 'config', 'lpc-config.json');
        this.config = loadLPCConfig(configPath);
        // 初始化类型和修饰符
        this.lpcTypes = this.config.types.join('|');
        this.modifiers = this.config.modifiers.join('|');
        // 初始化排除标识符
        this.excludedIdentifiers = new Set([
            // 从配置的 efuns 中提取所有函数名
            ...Object.keys(this.config.efuns)
        ]);
        // 初始化正则表达式
        this.variableDeclarationRegex = new RegExp(`^\\s*((?:${this.modifiers}\\s+)*)(${this.lpcTypes})\\s+` +
            '(\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*)*);', 'gm');
        this.globalVariableRegex = new RegExp(`^\\s*(?:${this.modifiers}?\\s*)(${this.lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*(?:=\\s*[^;]+)?;', 'gm');
        this.functionDeclRegex = new RegExp(`^\\s*(?:${this.modifiers}\\s+)*(${this.lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*{', 'gm');
        this.inheritRegex = /^\s*inherit\s+([A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*);/gm;
        this.includeRegex = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;
        // 从配置中提取 apply 函数
        this.applyFunctions = new Set([
            'create', 'setup', 'init', 'clean_up', 'reset',
            'receive_object', 'move_object', 'can_move',
            'valid_move', 'query_heart_beat', 'set_heart_beat',
            'catch_tell', 'receive_message', 'write_prompt',
            'process_input', 'do_command',
            'logon', 'connect', 'disconnect', 'net_dead',
            'terminal_type', 'window_size', 'receive_snoop',
            'valid_override', 'valid_seteuid', 'valid_shadow',
            'query_prevent_shadow', 'valid_bind',
            'clean_up', 'reset', 'virtual_start', 'epilog',
            'preload', 'valid_read', 'valid_write'
        ]);
        // 添加右键菜单命令
        let showVariablesCommand = vscode.commands.registerCommand('lpc.showVariables', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                this.showAllVariables(editor.document);
            }
        });
        context.subscriptions.push(showVariablesCommand);
        // 注册文档更改事件
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this)));
        // 注册文档打开事件
        context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(this.analyzeDocument.bind(this)));
        // 注册悬停提供器
        context.subscriptions.push(vscode.languages.registerHoverProvider('lpc', {
            provideHover: async (document, position, token) => {
                const range = document.getWordRangeAtPosition(position);
                if (!range)
                    return;
                const word = document.getText(range);
                if (/^[A-Z][A-Z0-9_]*_D$/.test(word)) {
                    // 获取宏定义
                    const macro = macroManager?.getMacro(word);
                    if (macro) {
                        return new vscode.Hover(macroManager.getMacroHoverContent(macro));
                    }
                    // 尝试解析宏
                    const canResolve = await macroManager?.canResolveMacro(word);
                    if (canResolve) {
                        return new vscode.Hover(`宏 \`${word}\` 已定义但无法获取具体值`);
                    }
                }
            }
        }));
    }
    onDidChangeTextDocument(event) {
        if (event.document.languageId === 'lpc') {
            this.analyzeDocument(event.document, false);
        }
    }
    // 文件过滤函数
    shouldCheckFile(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.c' || ext === '.h';
    }
    collectDiagnostics(document) {
        const diagnostics = [];
        const text = document.getText();
        // 收集所有诊断信息
        this.collectObjectAccessDiagnostics(text, diagnostics, document);
        this.collectStringLiteralDiagnostics(text, diagnostics, document);
        this.collectVariableUsageDiagnostics(text, diagnostics, document);
        this.collectFileNamingDiagnostics(document, diagnostics);
        return diagnostics;
    }
    collectObjectAccessDiagnostics(text, diagnostics, document) {
        const objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\()?/g;
        let match;
        while ((match = objectAccessRegex.exec(text)) !== null) {
            const [fullMatch, object, accessor, member, isFunction] = match;
            const startPos = match.index;
            const endPos = startPos + fullMatch.length;
            // 检查访问符号的使用
            // if (accessor === '.') {
            //     diagnostics.push(this.createDiagnostic(
            //         this.getRange(document, startPos + object.length, 1),
            //         'LPC 中推荐使用 -> 而不是 . 来访问对象成员',
            //         vscode.DiagnosticSeverity.Information
            //     ));
            // }
            // 检查宏定义
            if (/^[A-Z][A-Z0-9_]*_D$/.test(object)) {
                this.checkMacroUsage(object, startPos, document, diagnostics);
                continue;
            }
            // 检查对象命名规范
            if (!/^[A-Z][A-Z0-9_]*(?:_D)?$/.test(object)) {
                diagnostics.push(this.createDiagnostic(this.getRange(document, startPos, object.length), '对象名应该使用大写字母和下划线，例如: USER_OB', vscode.DiagnosticSeverity.Warning));
            }
            // 检查函数调用
            if (isFunction) {
                this.checkFunctionCall(text, startPos, endPos, document, diagnostics);
            }
            // 检查成员命名规范
            // if (!/^[a-z][a-zA-Z0-9_]*$/.test(member)) {
            //     diagnostics.push(this.createDiagnostic(
            //         this.getRange(document, startPos + object.length + accessor.length, member.length),
            //         '成员名应该使用小写字母开头的驼峰命名法',
            //         vscode.DiagnosticSeverity.Warning
            //     ));
            // }
        }
    }
    async checkMacroUsage(object, startPos, document, diagnostics) {
        this.macroManager?.refreshMacros();
        const macro = this.macroManager?.getMacro(object);
        const canResolveMacro = await this.macroManager?.canResolveMacro(object);
        if (macro) {
            diagnostics.push(this.createDiagnostic(this.getRange(document, startPos, object.length), `宏 '${object}' 的值为: ${macro.value}`, vscode.DiagnosticSeverity.Information));
        }
        else if (!canResolveMacro) {
            diagnostics.push(this.createDiagnostic(this.getRange(document, startPos, object.length), `'${object}' 符合宏命名规范但未定义为宏`, vscode.DiagnosticSeverity.Warning));
        }
    }
    checkFunctionCall(text, startPos, endPos, document, diagnostics) {
        let bracketCount = 1;
        let currentPos = endPos;
        let foundClosing = false;
        let inString = false;
        let stringChar = '';
        while (currentPos < text.length) {
            const char = text[currentPos];
            if (inString) {
                if (char === stringChar && text[currentPos - 1] !== '\\') {
                    inString = false;
                }
            }
            else {
                if (char === '"' || char === '\'') {
                    inString = true;
                    stringChar = char;
                }
                else if (char === '(') {
                    bracketCount++;
                }
                else if (char === ')') {
                    bracketCount--;
                    if (bracketCount === 0) {
                        foundClosing = true;
                        break;
                    }
                }
            }
            currentPos++;
        }
        if (!foundClosing) {
            diagnostics.push(this.createDiagnostic(this.getRange(document, startPos, endPos - startPos), '函数调用缺少闭合的括号', vscode.DiagnosticSeverity.Error));
        }
    }
    collectStringLiteralDiagnostics(text, diagnostics, document) {
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;
        let match;
        while ((match = multilineStringRegex.exec(text)) !== null) {
            const content = match[1];
            if (!content.trim()) {
                diagnostics.push(this.createDiagnostic(this.getRange(document, match.index, match[0].length), '空的多行字符串', vscode.DiagnosticSeverity.Warning));
            }
        }
    }
    collectFileNamingDiagnostics(document, diagnostics) {
        const fileName = path.basename(document.fileName);
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        const validExtensions = ['c', 'h'];
        if (!validExtensions.includes(extension.toLowerCase())) {
            return;
        }
        const validNameRegex = /^[a-zA-Z0-9_-]+$/i;
        if (!validNameRegex.test(fileNameWithoutExt)) {
            diagnostics.push(this.createDiagnostic(new vscode.Range(0, 0, 0, 0), 'LPC 文件名只能包含字母、数字、下划线和连字符，扩展名必须为 .c 或 .h', vscode.DiagnosticSeverity.Warning));
        }
    }
    analyzeDocument(document, showMessage = false) {
        if (!this.shouldCheckFile(document.fileName)) {
            return;
        }
        const diagnostics = this.collectDiagnostics(document);
        this.diagnosticCollection.set(document.uri, diagnostics);
        if (showMessage && diagnostics.length === 0) {
            vscode.window.showInformationMessage('代码检查完成，未发现问题');
        }
    }
    findInherits(text) {
        const inherits = new Set();
        let match;
        while ((match = this.inheritRegex.exec(text)) !== null) {
            match[1].split(',').forEach(name => {
                inherits.add(name.trim());
            });
        }
        return inherits;
    }
    findIncludes(text) {
        const includes = new Set();
        let match;
        while ((match = this.includeRegex.exec(text)) !== null) {
            includes.add(match[1]);
        }
        return includes;
    }
    getFunctionBlocks(text) {
        const blocks = [];
        this.functionDeclRegex.lastIndex = 0;
        let match;
        while ((match = this.functionDeclRegex.exec(text)) !== null) {
            const start = match.index;
            let bracketCount = 0;
            let inString = false;
            let stringChar = '';
            let inSingleLineComment = false;
            let inMultiLineComment = false;
            let currentIndex = start;
            while (currentIndex < text.length) {
                const char = text[currentIndex];
                const nextTwoChars = text.substr(currentIndex, 2);
                if (inString) {
                    if (char === stringChar && text[currentIndex - 1] !== '\\') {
                        inString = false;
                    }
                }
                else if (inSingleLineComment) {
                    if (char === '\n') {
                        inSingleLineComment = false;
                    }
                }
                else if (inMultiLineComment) {
                    if (nextTwoChars === '*/') {
                        inMultiLineComment = false;
                        currentIndex++;
                    }
                }
                else {
                    if (nextTwoChars === '//') {
                        inSingleLineComment = true;
                        currentIndex++;
                    }
                    else if (nextTwoChars === '/*') {
                        inMultiLineComment = true;
                        currentIndex++;
                    }
                    else if (char === '"' || char === '\'') {
                        inString = true;
                        stringChar = char;
                    }
                    else if (char === '{') {
                        bracketCount++;
                    }
                    else if (char === '}') {
                        bracketCount--;
                        if (bracketCount === 0) {
                            blocks.push({
                                start: start,
                                content: text.substring(start, currentIndex + 1)
                            });
                            break;
                        }
                    }
                }
                currentIndex++;
            }
        }
        return blocks;
    }
    findGlobalVariables(document) {
        const text = document.getText();
        const globalVariables = new Set();
        // 首先获取所有函数块的范围
        const functionRanges = [];
        this.functionDeclRegex.lastIndex = 0;
        let funcMatch;
        while ((funcMatch = this.functionDeclRegex.exec(text)) !== null) {
            const start = funcMatch.index;
            let bracketCount = 0;
            let inString = false;
            let stringChar = '';
            let currentIndex = start;
            // 找到函数块的结束位置
            while (currentIndex < text.length) {
                const char = text[currentIndex];
                if (inString) {
                    if (char === stringChar && text[currentIndex - 1] !== '\\') {
                        inString = false;
                    }
                }
                else {
                    if (char === '"' || char === '\'') {
                        inString = true;
                        stringChar = char;
                    }
                    else if (char === '{') {
                        bracketCount++;
                    }
                    else if (char === '}') {
                        bracketCount--;
                        if (bracketCount === 0) {
                            functionRanges.push({ start, end: currentIndex });
                            break;
                        }
                    }
                }
                currentIndex++;
            }
        }
        // 重置全局变量正则表达式
        this.globalVariableRegex.lastIndex = 0;
        let match;
        while ((match = this.globalVariableRegex.exec(text))) {
            const matchStart = match.index;
            // 检查这个变量声明是否在任何函数块内
            const isInFunction = functionRanges.some(range => matchStart > range.start && matchStart < range.end);
            // 如果不在函数内，这是一个全局变量
            if (!isInFunction) {
                const varName = match[2];
                if (!this.excludedIdentifiers.has(varName)) {
                    globalVariables.add(varName);
                }
            }
        }
        return globalVariables;
    }
    findFunctionDefinitions(text) {
        const functionDefs = new Set();
        let match;
        this.functionDeclRegex.lastIndex = 0;
        while ((match = this.functionDeclRegex.exec(text)) !== null) {
            functionDefs.add(match[2]);
        }
        return functionDefs;
    }
    async showAllVariables(document) {
        const text = document.getText();
        const globalVars = this.findGlobalVariables(document);
        const localVars = new Map();
        // 查找所有局部变量
        let match;
        this.variableDeclarationRegex.lastIndex = 0;
        while ((match = this.variableDeclarationRegex.exec(text)) !== null) {
            const varType = match[2];
            const varDeclarations = match[3];
            const fullMatchStart = match.index;
            // 分割变量声明，保留每个变量声明的完整形式（包括星号）
            const vars = varDeclarations.split(',');
            let hasArrayInDeclaration = false;
            for (let varDecl of vars) {
                varDecl = varDecl.trim();
                let isArray = false;
                let varName = varDecl;
                // 检查是否是数组声明
                if (varDecl.includes('*')) {
                    isArray = true;
                    hasArrayInDeclaration = true;
                    varName = varDecl.replace('*', '').trim();
                }
                // 如果这个声明中有数组，那么后续的变量都是普通变量
                if (!isArray && hasArrayInDeclaration) {
                    isArray = false;
                }
                if (!this.excludedIdentifiers.has(varName)) {
                    const varRegex = new RegExp(`\\b${varName}\\b`);
                    const varMatch = varRegex.exec(text.slice(fullMatchStart));
                    if (varMatch) {
                        const varIndex = fullMatchStart + varMatch.index;
                        const range = new vscode.Range(document.positionAt(varIndex), document.positionAt(varIndex + varName.length));
                        localVars.set(varName, {
                            type: isArray ? `${varType}[]` : varType,
                            range,
                            declarationIndex: varIndex,
                            isArray
                        });
                    }
                }
            }
        }
        // 找出未使用的变量
        const unusedVars = new Set();
        for (const [varName, info] of localVars) {
            // 在变量声明后的代码中查找变量使用
            const afterDeclaration = text.slice(info.declarationIndex + varName.length);
            // 使用相同的变量使用检测逻辑
            const isUsed = this.checkVariableUsage(varName, afterDeclaration);
            if (!isUsed) {
                unusedVars.add(varName);
            }
        }
        // 创建并显示输出面板
        const panel = vscode.window.createWebviewPanel('lpcVariables', 'LPC 变量列表', vscode.ViewColumn.One, {
            enableScripts: true
        });
        // 准备变量列表的 HTML
        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .variable {
                        cursor: pointer;
                        padding: 2px 5px;
                    }
                    .variable:hover {
                        background-color: #e8e8e8;
                    }
                    .unused {
                        color: #cc0000;
                    }
                    .section {
                        margin-bottom: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="section">
                    <h3>未使用的变量:</h3>
                    ${Array.from(unusedVars).map(varName => {
            const info = localVars.get(varName);
            return `<div class="variable unused" data-line="${info?.range.start.line}" data-char="${info?.range.start.character}">
                            - ${info?.type} ${varName}
                        </div>`;
        }).join('')}
                </div>
                <div class="section">
                    <h3>全局变量:</h3>
                    ${Array.from(globalVars).map(varName => `<div class="variable">- ${varName}</div>`).join('')}
                </div>
                <div class="section">
                    <h3>局部变量:</h3>
                    ${Array.from(localVars.entries()).map(([name, info]) => `<div class="variable" data-line="${info.range.start.line}" data-char="${info.range.start.character}">
                            - ${info.type} ${name}
                        </div>`).join('')}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.querySelectorAll('.variable').forEach(el => {
                        el.addEventListener('click', () => {
                            const line = el.getAttribute('data-line');
                            const char = el.getAttribute('data-char');
                            if (line !== null && char !== null) {
                                vscode.postMessage({
                                    command: 'jumpToVariable',
                                    line: parseInt(line),
                                    character: parseInt(char)
                                });
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
        panel.webview.html = content;
        // 处理从 webview 发来的消息
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'jumpToVariable':
                    const position = new vscode.Position(message.line, message.character);
                    vscode.window.showTextDocument(document, {
                        selection: new vscode.Selection(position, position),
                        preserveFocus: false,
                        preview: false
                    });
                    break;
            }
        }, undefined, []);
    }
    dispose() {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    }
    analyzeVariablesInFunction(block, globalVars, functionDefs, diagnostics, document) {
        const localVars = new Map();
        let match;
        this.variableDeclarationRegex.lastIndex = 0;
        // 查找局部变量声明
        while ((match = this.variableDeclarationRegex.exec(block.content)) !== null) {
            const varType = match[2];
            const varDeclarations = match[3];
            const fullMatchStart = block.start + match.index;
            const fullMatchEnd = fullMatchStart + match[0].length;
            // 分割变量声明，保留每个变量声明的完整形式（包括星号）
            const vars = varDeclarations.split(',');
            let hasArrayInDeclaration = false;
            for (let varDecl of vars) {
                varDecl = varDecl.trim();
                let isArray = false;
                let varName = varDecl;
                // 检查是否是数组声明
                if (varDecl.includes('*')) {
                    isArray = true;
                    hasArrayInDeclaration = true;
                    varName = varDecl.replace('*', '').trim();
                }
                // 如果这个声明中有数组，那么后续的变量都是普通变量
                if (!isArray && hasArrayInDeclaration) {
                    isArray = false;
                }
                if (!this.excludedIdentifiers.has(varName) && !functionDefs.has(varName)) {
                    // 找到这个变量在声明中实际位置
                    const varRegex = new RegExp(`\\b${varName}\\b`);
                    const varMatch = varRegex.exec(block.content.slice(match.index));
                    if (varMatch) {
                        const varIndex = match.index + varMatch.index;
                        const varStart = document.positionAt(block.start + varIndex);
                        const varEnd = document.positionAt(block.start + varIndex + varName.length);
                        const declStart = document.positionAt(fullMatchStart);
                        const declEnd = document.positionAt(fullMatchEnd);
                        // 检查是否是声明时赋值
                        const declarationLine = block.content.slice(match.index, match.index + match[0].length);
                        const isDeclarationWithAssign = declarationLine.includes('=');
                        localVars.set(varName, {
                            range: new vscode.Range(varStart, varEnd),
                            declarationRange: new vscode.Range(declStart, declEnd),
                            declarationIndex: match.index,
                            isArray,
                            type: isArray ? `${varType}[]` : varType,
                            isDeclarationWithAssign
                        });
                    }
                }
            }
        }
        // 检查变量使用
        for (const [varName, info] of localVars) {
            // 在变量声明后的代码中查找变量使用
            const afterDeclaration = block.content.slice(info.declarationIndex + varName.length);
            // 获取变量的类型
            const varType = info.type;
            // 查找变量的赋值表达式
            const assignRegex = new RegExp(`\\b${varName}\\s*=\\s*(.*?);`, 'g');
            let assignMatch;
            while ((assignMatch = assignRegex.exec(afterDeclaration)) !== null) {
                const expression = assignMatch[1];
                const inferredType = this.inferExpressionType(expression);
                // 在类型比较时，使用新的类型兼容性检查函数
                if (!this.areTypesCompatible(varType, inferredType)) {
                    const expressionStart = assignMatch.index + info.declarationIndex + varName.length + assignMatch[0].indexOf(expression);
                    const expressionEnd = expressionStart + expression.length;
                    const range = new vscode.Range(document.positionAt(block.start + expressionStart), document.positionAt(block.start + expressionEnd));
                    diagnostics.push(new vscode.Diagnostic(range, `变量 '${varName}' 声明为 '${varType}'，但赋值的表达式类型为 '${inferredType}'`, vscode.DiagnosticSeverity.Warning));
                }
            }
            // 检查变量使用情况，区分声明时赋值和后续赋值
            const isUsed = info.isDeclarationWithAssign ?
                this.checkActualUsage(varName, afterDeclaration) :
                this.checkActualUsageIncludingAssignment(varName, afterDeclaration);
            if (!isUsed) {
                const diagnostic = new vscode.Diagnostic(info.range, `未使用的变量: '${varName}'${info.isArray ? ' (数组)' : ''}`, vscode.DiagnosticSeverity.Warning);
                diagnostic.code = 'unusedVar';
                diagnostics.push(diagnostic);
            }
        }
    }
    createDiagnostic(range, message, severity, code) {
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        if (code) {
            diagnostic.code = code;
        }
        return diagnostic;
    }
    getRange(document, startPos, length) {
        return new vscode.Range(document.positionAt(startPos), document.positionAt(startPos + length));
    }
    checkVariableInCode(varName, code, patterns) {
        for (const { pattern, description } of patterns) {
            if (pattern.test(code)) {
                return { isUsed: true, usageType: description };
            }
        }
        return { isUsed: false };
    }
    getVariableUsagePatterns(varName) {
        return [
            {
                pattern: new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: '函数参数'
            },
            {
                pattern: new RegExp(`\\b(?!${varName}\\s*=)[a-zA-Z_][a-zA-Z0-9_]*\\s*[+\\-*\\/%]?=\\s*.*\\b${varName}\\b.*?;`, 'g'),
                description: '赋值右值'
            },
            {
                pattern: new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g'),
                description: 'return语句'
            },
            {
                pattern: new RegExp(`\\bif\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'if条件'
            },
            {
                pattern: new RegExp(`\\bwhile\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'while循环'
            },
            {
                pattern: new RegExp(`\\bfor\\s*\\([^;]*;[^;]*\\b${varName}\\b[^;]*;[^)]*\\)`, 'g'),
                description: 'for循环'
            },
            {
                pattern: new RegExp(`\\bswitch\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'switch语句'
            },
            {
                pattern: new RegExp(`\\bcase\\s+${varName}\\b`, 'g'),
                description: 'case语句'
            },
            {
                pattern: new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s*,\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s+in\\b`, 'g'),
                description: 'foreach迭代器'
            },
            {
                pattern: new RegExp(`\\bforeach\\s*\\(\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*${varName}\\s+in\\b`, 'g'),
                description: 'foreach值'
            },
            {
                pattern: new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s+in\\b`, 'g'),
                description: 'foreach单值'
            },
            {
                pattern: new RegExp(`\\bforeach\\s*\\([^)]+in\\s+${varName}\\b`, 'g'),
                description: 'foreach集合'
            },
            {
                pattern: new RegExp(`\\b(?:sscanf|input_to|call_other)\\s*\\([^,]*(?:,\\s*[^,]*)*\\b${varName}\\b`, 'g'),
                description: '特殊函数调用'
            },
            {
                pattern: new RegExp(`->\\s*${varName}\\b`, 'g'),
                description: '对象方法调用'
            },
            {
                pattern: new RegExp(`\\bcall_other\\s*\\([^,]+,\\s*"${varName}"`, 'g'),
                description: 'call_other调用'
            }
        ];
    }
    checkVariableUsage(varName, code) {
        const patterns = this.getVariableUsagePatterns(varName);
        const { isUsed } = this.checkVariableInCode(varName, code, patterns);
        if (isUsed)
            return true;
        // 检查变量是否在数组访问或其他表达式中使用
        const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
        let match;
        while ((match = usagePattern.exec(code)) !== null) {
            const index = match.index;
            const beforeChar = index > 0 ? code[index - 1] : '';
            const afterSlice = code.slice(index + varName.length, index + varName.length + 2);
            // 忽略赋值左侧的情况
            const isAssignmentLeft = /\s*[+\-*\/%]?=/.test(afterSlice);
            if (!isAssignmentLeft) {
                // 检查是否在数组访问、成员访问或其他表达式中使用
                const isArrayAccess = /\s*\[/.test(afterSlice);
                const isMemberAccess = /\s*\.|\s*->/.test(afterSlice);
                const isInExpression = /[-+*\/%&|^<>!?:]/.test(beforeChar) ||
                    /[-+*\/%&|^<>!?:]/.test(afterSlice);
                if (isArrayAccess || isMemberAccess || isInExpression) {
                    return true;
                }
            }
        }
        return false;
    }
    checkActualUsage(varName, code) {
        let isUsed = false;
        // 检查变量是否作为参数传递给函数调用
        const functionCallPattern = new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g');
        if (functionCallPattern.test(code)) {
            isUsed = true;
        }
        // 检查变量是否被赋值给其他变量（作为右值）
        const assignedToVariablePattern = new RegExp(`\\b(?!${varName}\\s*=)[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*.*\\b${varName}\\b.*?;`, 'g');
        if (assignedToVariablePattern.test(code)) {
            isUsed = true;
        }
        // 检查变量是否被 return 语句返回
        const returnPattern = new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g');
        if (returnPattern.test(code)) {
            isUsed = true;
        }
        // 检查变量是否在表达式中使用
        const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
        let match;
        while ((match = usagePattern.exec(code)) !== null) {
            const index = match.index;
            // 忽略赋值左侧的情况
            const isAssignmentLeft = /\s*[+\-*\/%]?=/.test(code.slice(index + varName.length, index + varName.length + 2));
            if (!isAssignmentLeft) {
                // 检查是否在数组访问或其他表达式中使用
                const isArrayAccess = /\s*\[/.test(code.slice(index + varName.length, index + varName.length + 2));
                const isInExpression = /[-+*\/%&|^<>]/.test(code.slice(index - 1, index)) ||
                    /[-+*\/%&|^<>]/.test(code.slice(index + varName.length, index + varName.length + 1));
                if (isArrayAccess || isInExpression) {
                    isUsed = true;
                }
            }
        }
        // 检查foreach语句中的使用
        const foreachPatterns = [
            new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s*,\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s+in\\b`, 'g'),
            new RegExp(`\\bforeach\\s*\\(\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*${varName}\\s+in\\b`, 'g'),
            new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s+in\\b`, 'g'),
            new RegExp(`\\bforeach\\s*\\([^)]+in\\s+${varName}\\b`, 'g')
        ];
        if (foreachPatterns.some(pattern => pattern.test(code))) {
            isUsed = true;
        }
        // 检查sscanf和input_to函数的使用
        const specialFunctionPattern = new RegExp(`\\b(?:sscanf|input_to)\\s*\\([^,]+,\\s*[^,]+,\\s*([^)]*)\\)`, 'g');
        let funcMatch;
        while ((funcMatch = specialFunctionPattern.exec(code)) !== null) {
            const argsString = funcMatch[1];
            const args = argsString.split(',').map(arg => arg.trim());
            if (args.includes(varName)) {
                isUsed = true;
            }
        }
        return isUsed;
    }
    checkActualUsageIncludingAssignment(varName, code) {
        // 首先检查是否有赋值操作（这种情况下认为变量被使用）
        const assignmentPattern = new RegExp(`\\b${varName}\\s*[+\\-*\\/%]?=`, 'g');
        if (assignmentPattern.test(code)) {
            return true;
        }
        // 如果没有赋值，检查其他使用情况
        return this.checkVariableUsage(varName, code);
    }
    analyzeApplyFunctions(text, diagnostics, document) {
        // 暂时关闭检查 apply 函数的返回类型，因为 FluffOS 的 apply 函数返回类型不固定，用户可以自行定义
        return;
    }
    isValidApplyReturnType(funcName, returnType) {
        const typeMap = {
            'create': 'void',
            'setup': 'void',
            'init': 'void',
            'clean_up': 'int',
            'reset': 'void',
            'receive_object': 'int',
            'move_object': 'int',
            'can_move': 'int',
            'valid_move': 'int',
            'catch_tell': 'void',
            'receive_message': 'void',
            'write_prompt': 'void',
            'process_input': 'void',
            'logon': 'void',
            'connect': 'void',
            'disconnect': 'void',
            'net_dead': 'void',
            'valid_override': 'int',
            'valid_seteuid': 'int',
            'valid_shadow': 'int',
            'query_prevent_shadow': 'int',
            'valid_bind': 'int'
        };
        return typeMap[funcName] === returnType;
    }
    getExpectedReturnType(funcName) {
        return this.isValidApplyReturnType(funcName, 'void') ? 'void' : 'int';
    }
    checkFileNaming(document, diagnostics) {
        const fileName = path.basename(document.fileName);
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);
        const validExtensions = ['c', 'h'];
        if (!validExtensions.includes(extension.toLowerCase())) {
            return; // 跳过非 .c 或 .h 文件
        }
        const validNameRegex = /^[a-zA-Z0-9_-]+$/i;
        if (!validNameRegex.test(fileNameWithoutExt)) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), 'LPC 文件名只能包含字母、数字、下划线和连字符，扩展名必须为 .c 或 .h', vscode.DiagnosticSeverity.Warning));
        }
    }
    async scanFolder() {
        // 让用户选择要扫描的文件夹
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择要扫描的文件夹'
        });
        if (!folders || folders.length === 0) {
            return;
        }
        const folderPath = folders[0].fsPath;
        // 创建输出通道
        const outputChannel = vscode.window.createOutputChannel('LPC 变量检查');
        outputChannel.show();
        outputChannel.appendLine(`开始扫描文件夹: ${folderPath}`);
        try {
            // 显示进度条
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "正在扫描 LPC 文件...",
                cancellable: true
            }, async (progress, token) => {
                // 获取所有 .c 文件
                const files = await this.findLPCFiles(folderPath);
                const totalFiles = files.length;
                let processedFiles = 0;
                outputChannel.appendLine(`找到 ${totalFiles} 个 LPC 文件`);
                // 批量处理文件以提高性能
                const batchSize = 10; // 每批处理的文件数
                const diagnosticsByFile = new Map();
                // 将文件分批处理
                for (let i = 0; i < files.length; i += batchSize) {
                    if (token.isCancellationRequested) {
                        outputChannel.appendLine('扫描已取消');
                        return;
                    }
                    const batch = files.slice(i, i + batchSize);
                    // 并行处理每一批文件
                    await Promise.all(batch.map(async (file) => {
                        // 更新进度
                        progress.report({
                            increment: (1 / totalFiles) * 100,
                            message: `正在检查 ${path.basename(file)} (${++processedFiles}/${totalFiles})`
                        });
                        try {
                            // 分析文件
                            const document = await vscode.workspace.openTextDocument(file);
                            this.analyzeDocument(document, false);
                            // 获取诊断结果
                            const fileDiagnostics = this.diagnosticCollection.get(document.uri);
                            if (fileDiagnostics && fileDiagnostics.length > 0) {
                                diagnosticsByFile.set(file, [...fileDiagnostics]);
                            }
                        }
                        catch (error) {
                            outputChannel.appendLine(`处理文件 ${file} 时出错: ${error}`);
                        }
                    }));
                }
                // 处理完毕后，输出所有收集到的诊断信息
                if (diagnosticsByFile.size > 0) {
                    for (const [file, diagnostics] of diagnosticsByFile.entries()) {
                        outputChannel.appendLine(`\n文件: ${path.relative(folderPath, file)}`);
                        for (const diagnostic of diagnostics) {
                            const line = diagnostic.range.start.line + 1;
                            const character = diagnostic.range.start.character + 1;
                            outputChannel.appendLine(`  [行 ${line}, 列 ${character}] ${diagnostic.message}`);
                        }
                    }
                }
                outputChannel.appendLine('\n扫描完成！');
            });
        }
        catch (error) {
            outputChannel.appendLine(`发生错误: ${error}`);
            vscode.window.showErrorMessage('扫描过程中发生错误，请查看输出面板了解详情。');
        }
    }
    // 递归查找所有 LPC 文件
    async findLPCFiles(folderPath) {
        const files = [];
        const fileExtensions = ['.c', '.h'];
        const ignoreDirs = ['node_modules', '.git', '.vscode']; // 常见需要忽略的目录
        async function walk(dir) {
            let entries;
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            }
            catch (error) {
                console.error(`无法读取目录 ${dir}:`, error);
                return;
            }
            // 分离目录和文件以便并行处理
            const directories = [];
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // 跳过忽略的目录
                    if (!ignoreDirs.includes(entry.name)) {
                        directories.push(fullPath);
                    }
                }
                else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
            // 并行处理子目录
            if (directories.length > 0) {
                await Promise.all(directories.map(walk));
            }
        }
        await walk(folderPath);
        return files;
    }
    async analyzeObjectAccess(text, diagnostics, document) {
        // 如果文本过大，分块处理
        const chunkSize = 50000; // 每块50KB
        if (text.length > chunkSize) {
            // 大文件分块处理
            const chunks = Math.ceil(text.length / chunkSize);
            for (let i = 0; i < chunks; i++) {
                const start = i * chunkSize;
                const end = Math.min((i + 1) * chunkSize, text.length);
                const chunk = text.slice(start, end);
                // 对当前块进行分析，需要考虑边界问题
                await this.analyzeObjectAccessChunk(chunk, start, diagnostics, document);
            }
        }
        else {
            // 小文件直接处理
            await this.analyzeObjectAccessChunk(text, 0, diagnostics, document);
        }
    }
    async analyzeObjectAccessChunk(text, offset, diagnostics, document) {
        // 匹配对象访问语法 ob->func() 和 ob.func
        const objectAccessRegex = this.objectAccessRegex;
        objectAccessRegex.lastIndex = 0; // 重置正则状态
        // 预先收集所有匹配项，然后批量处理
        const matches = [];
        let match;
        while ((match = objectAccessRegex.exec(text)) !== null) {
            const startPos = match.index + offset;
            matches.push({ match, startPos });
        }
        // 如果匹配数量很大，分批处理避免阻塞主线程
        const batchSize = 50;
        for (let i = 0; i < matches.length; i += batchSize) {
            const batch = matches.slice(i, i + batchSize);
            // 处理当前批次的匹配
            for (const { match, startPos } of batch) {
                const object = match[1];
                const accessor = match[2];
                const func = match[3];
                const isCall = match[4] !== undefined;
                // 检查是否宏定义
                if (this.macroDefRegex.test(object)) {
                    await this.checkMacroUsage(object, startPos, document, diagnostics);
                }
                // 其他对象方法调用检查
                if (isCall && accessor === '->') {
                    this.checkFunctionCall(text, startPos + match[0].indexOf(func), startPos + match[0].length, document, diagnostics);
                }
            }
            // 每处理一批后让出主线程，防止UI卡顿
            if (i + batchSize < matches.length) {
                // 使用 setTimeout 0 来让出主线程
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }
    analyzeStringLiterals(text, diagnostics, document) {
        // 检查多行字符串语法
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;
        let match;
        while ((match = multilineStringRegex.exec(text)) !== null) {
            // 验证多行字符串的格式
            const content = match[1];
            if (!content.trim()) {
                const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + match[0].length));
                diagnostics.push(new vscode.Diagnostic(range, '空的多行字符串', vscode.DiagnosticSeverity.Warning));
            }
        }
    }
    /**
     * 推断给定表达式的类型
     * 作者：Lu Dexiang
     * @param expression 表达式字符串
     * @returns 推断出的类型
     */
    inferExpressionType(expression) {
        // 简单的类型推断逻辑
        expression = expression.trim();
        // 当表达式为 0 时，返回 'mixed'
        if (expression === '0') {
            return 'mixed';
        }
        // 整数
        if (/^\d+$/.test(expression)) {
            return 'int';
        }
        // 浮点数
        else if (/^\d+\.\d+$/.test(expression)) {
            return 'float';
        }
        // 字符串
        else if (/^"(?:[^"\\]|\\.)*"$/.test(expression)) {
            return 'string';
        }
        // 映射（匹配 ([ ... ]) 的形式）
        else if (/^\(\[\s*(?:[^:\]]+\s*:\s*[^,\]]+\s*,?\s*)*\]\)$/.test(expression)) {
            return 'mapping';
        }
        // 数组
        else if (/^\({.*}\)$/.test(expression) || /^\[.*\]$/.test(expression)) {
            return 'array';
        }
        // 对象
        else if (/^new\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)$/.test(expression)) {
            return 'object';
        }
        // 函数调用
        else if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*\(.*\)$/.test(expression)) {
            const funcName = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1] || '';
            // 检查是否是常见的 efun
            const efunReturnTypes = {
                'sizeof': 'int',
                'strlen': 'int',
                'to_int': 'int',
                'to_float': 'float',
                'to_string': 'string',
                'allocate': 'array',
                'allocate_mapping': 'mapping',
                'clone_object': 'object',
                'new_empty_mapping': 'mapping',
                'keys': 'array',
                'values': 'array',
                'explode': 'array',
                'implode': 'string',
                'member_array': 'int',
                'file_size': 'int',
                'time': 'int',
                'random': 'int'
            };
            return efunReturnTypes[funcName] || 'mixed';
        }
        // 其他
        else {
            return 'mixed';
        }
    }
    // 新增一个辅助方法来判断类型兼容性
    areTypesCompatible(varType, inferredType) {
        // 如果类型完全匹配或表达式类型为混合类型
        if (varType === inferredType || inferredType === 'mixed' || varType === 'mixed') {
            return true;
        }
        // 处理数组类型的兼容性
        if (varType.endsWith('[]') && (inferredType === 'array' || inferredType.endsWith('[]'))) {
            return true;
        }
        // 数值类型的兼容性
        if ((varType === 'float' && inferredType === 'int') ||
            (varType === 'int' && inferredType === 'float')) {
            return true;
        }
        // 对象类型的兼容性
        if (varType === 'object' &&
            (inferredType === 'object' || /^[A-Z][A-Za-z0-9_]*$/.test(inferredType))) {
            return true;
        }
        // 字符串和缓冲区的兼容性
        if ((varType === 'string' && inferredType === 'buffer') ||
            (varType === 'buffer' && inferredType === 'string')) {
            return true;
        }
        // 函数类型的兼容性
        if (varType === 'function' &&
            (inferredType === 'function' || inferredType.startsWith('function'))) {
            return true;
        }
        return false;
    }
    collectVariableUsageDiagnostics(text, diagnostics, document) {
        // 收集全局变量
        const globalVars = this.findGlobalVariables(document);
        // 收集函数
        const functionDefs = this.findFunctionDefinitions(text);
        // 分析每个函数块中的变量使用情况
        const functionBlocks = this.getFunctionBlocks(text);
        for (const block of functionBlocks) {
            this.analyzeVariablesInFunction(block, globalVars, functionDefs, diagnostics, document);
        }
        // 分析 apply 函数
        this.analyzeApplyFunctions(text, diagnostics, document);
    }
}
exports.LPCDiagnostics = LPCDiagnostics;
//# sourceMappingURL=diagnostics.js.map