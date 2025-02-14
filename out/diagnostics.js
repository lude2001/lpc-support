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
    analyzeDocument(document, showMessage = false) {
        const text = document.getText();
        const fileName = document.fileName;
        // 如果不是 LPC 文件，不进行检查
        if (!this.shouldCheckFile(fileName)) {
            return;
        }
        const diagnostics = [];
        // 首先检查继承和包含
        const inheritedFiles = this.findInherits(text);
        const includedFiles = this.findIncludes(text);
        // 收集全局变量
        const globalVars = this.findGlobalVariables(document);
        // 收集函数
        const functionDefs = this.findFunctionDefinitions(text);
        // 分析每个函数块中的变量使用情况
        const functionBlocks = this.getFunctionBlocks(text);
        for (const block of functionBlocks) {
            this.analyzeVariablesInFunction(block, globalVars, functionDefs, diagnostics, document);
        }
        this.analyzeApplyFunctions(text, diagnostics, document);
        // 检查文件名规范
        this.checkFileNaming(document, diagnostics);
        // 添加对象访问语法检查
        this.analyzeObjectAccess(text, diagnostics, document);
        // 添加字符串语法检查
        this.analyzeStringLiterals(text, diagnostics, document);
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
        // 添加代码块变量声明检查
        this.checkBlockVariableDeclarations(block.content, block.start, diagnostics, document);
    }
    checkBlockVariableDeclarations(content, blockStart, diagnostics, document) {
        // 用于存储所有代码块的信息
        const blocks = [];
        // 当前正在处理的代码块层级
        let currentLevel = 0;
        let inString = false;
        let stringChar = '';
        let inComment = false;
        let inMultilineComment = false;
        for (let i = 0; i < content.length; i++) {
            // 跳过字符串内容
            if (inString) {
                if (content[i] === stringChar && content[i - 1] !== '\\') {
                    inString = false;
                }
                continue;
            }
            // 跳过注释
            if (inComment) {
                if (content[i] === '\n') {
                    inComment = false;
                }
                continue;
            }
            if (inMultilineComment) {
                if (content[i] === '*' && content[i + 1] === '/') {
                    inMultilineComment = false;
                    i++;
                }
                continue;
            }
            // 检查是否进入字符串
            if (content[i] === '"' || content[i] === '\'') {
                inString = true;
                stringChar = content[i];
                continue;
            }
            // 检查是否进入注释
            if (content[i] === '/' && content[i + 1] === '/') {
                inComment = true;
                i++;
                continue;
            }
            if (content[i] === '/' && content[i + 1] === '*') {
                inMultilineComment = true;
                i++;
                continue;
            }
            // 处理代码块
            if (content[i] === '{') {
                blocks[currentLevel] = {
                    start: i,
                    firstStatement: null
                };
                currentLevel++;
            }
            else if (content[i] === '}') {
                currentLevel--;
            }
            else if (!content[i].match(/[\s\n\r]/)) {
                // 记录第一个非空白字符的位置（可能是语句开始）
                if (currentLevel > 0 && blocks[currentLevel - 1].firstStatement === null) {
                    blocks[currentLevel - 1].firstStatement = i;
                }
            }
            // 检查变量声明
            if (content[i] === ';') {
                const currentPos = i;
                const currentBlock = currentLevel > 0 ? blocks[currentLevel - 1] : null;
                // 向前查找这个语句的开始
                let statementStart = currentPos;
                while (statementStart > 0 && content[statementStart - 1] !== ';' && content[statementStart - 1] !== '{') {
                    statementStart--;
                }
                const statement = content.substring(statementStart, currentPos + 1).trim();
                // 检查是否是变量声明
                const varDeclMatch = statement.match(new RegExp(`^(?:${this.modifiers}\\s+)*(${this.lpcTypes})\\s+[a-zA-Z_][a-zA-Z0-9_]*`));
                if (varDeclMatch && currentBlock) {
                    // 检查在当前块中是否有其他语句在这个声明之前
                    const statementsBeforeDecl = this.findStatementsBeforeDeclaration(content.substring(currentBlock.start, statementStart));
                    if (statementsBeforeDecl) {
                        const range = new vscode.Range(document.positionAt(blockStart + statementStart), document.positionAt(blockStart + currentPos + 1));
                        diagnostics.push(new vscode.Diagnostic(range, '变量声明必须在代码块开头，所有执行语句之前', vscode.DiagnosticSeverity.Error));
                    }
                }
            }
        }
    }
    findStatementsBeforeDeclaration(blockContent) {
        // 移除注释
        const contentWithoutComments = blockContent
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*/g, '');
        // 分析代码，跳过空行
        const lines = contentWithoutComments
            .split('\n')
            .map(line => line.trim())
            .filter(line => line);
        let declarationBlockEnded = false;
        // LPC 变量声明模式
        const declarationPatterns = [
            // 基本类型声明（包括指针和多变量）
            `^(?:${this.lpcTypes})\\s+(?:\\*)?[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*(?:\\*)?[a-zA-Z_][a-zA-Z0-9_]*)*\\s*;$`,
            // 带初始化的变量声明
            `^(?:${this.lpcTypes})\\s+(?:\\*)?[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*=\\s*[^;]+)?(?:\\s*,\\s*(?:\\*)?[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*=\\s*[^;]+)?)*\\s*;$`,
            // mapping 特殊声明
            `^mapping\\s+[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*\\(\\[\\]\\)\\s*;$`
        ];
        // 调试输出
        console.log("Analyzing lines:");
        for (const line of lines) {
            console.log(`Processing line: "${line}"`);
            const isDeclaration = declarationPatterns.some(pattern => {
                const regex = new RegExp(pattern);
                const matches = regex.test(line);
                console.log(`  Testing pattern: ${pattern}`);
                console.log(`  Matches: ${matches}`);
                return matches;
            });
            // 如果不是声明，且不是块标记，那么就是执行语句
            if (!isDeclaration && line !== '{' && line !== '}') {
                console.log(`  Found non-declaration: "${line}"`);
                declarationBlockEnded = true;
            }
            // 如果在执行语句后发现声明，报错
            if (declarationBlockEnded && isDeclaration) {
                console.log(`  Found declaration after statements: "${line}"`);
                return true;
            }
        }
        return false;
    }
    checkVariableUsage(varName, code) {
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
                for (const file of files) {
                    if (token.isCancellationRequested) {
                        outputChannel.appendLine('扫描已取消');
                        return;
                    }
                    // 更新进度
                    progress.report({
                        increment: (1 / totalFiles) * 100,
                        message: `正在检查 ${path.basename(file)} (${++processedFiles}/${totalFiles})`
                    });
                    // 分析文件
                    const document = await vscode.workspace.openTextDocument(file);
                    const diagnostics = [];
                    this.analyzeDocument(document, false);
                    // 获取诊断结果
                    const fileDiagnostics = this.diagnosticCollection.get(document.uri);
                    if (fileDiagnostics && fileDiagnostics.length > 0) {
                        outputChannel.appendLine(`\n文件: ${path.relative(folderPath, file)}`);
                        for (const diagnostic of fileDiagnostics) {
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
        async function walk(dir) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walk(fullPath);
                }
                else if (entry.isFile() && (entry.name.endsWith('.c') || entry.name.endsWith('.h'))) {
                    files.push(fullPath);
                }
            }
        }
        await walk(folderPath);
        return files;
    }
    async analyzeObjectAccess(text, diagnostics, document) {
        // 匹配对象访问语法 ob->func() 和 ob.func
        const objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
        let match;
        while ((match = objectAccessRegex.exec(text)) !== null) {
            const [fullMatch, object, accessor, member] = match;
            // 首先检查是否是宏
            if (/^[A-Z][A-Z0-9_]*_D$/.test(object)) {
                // 强制刷新宏定义
                this.macroManager?.refreshMacros();
                const macro = this.macroManager?.getMacro(object);
                // 检查宏是否可以被解析（通过转到定义功能）
                const canResolveMacro = await this.macroManager?.canResolveMacro(object);
                if (macro || canResolveMacro) {
                    // 如果是已定义的宏或可以被解析的宏，添加信息性诊断
                    const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + object.length));
                    if (macro) {
                        diagnostics.push(new vscode.Diagnostic(range, `宏 '${object}' 的值为: ${macro.value}`, vscode.DiagnosticSeverity.Information));
                    }
                    continue; // 跳过后续的未定义检查
                }
                else {
                    // 如果既不是宏也不能被解析，添加诊断信息
                    const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + object.length));
                    diagnostics.push(new vscode.Diagnostic(range, `'${object}' 符合宏命名规范但未定义为宏`, vscode.DiagnosticSeverity.Warning));
                }
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
            // 可以进一步解析函数返回类型，暂时返回 mixed
            return 'mixed';
        }
        // 其他
        else {
            return 'mixed';
        }
    }
    // 新增一个辅助方法来判断类型兼容性
    areTypesCompatible(varType, inferredType) {
        if (varType === inferredType || inferredType === 'mixed') {
            return true; // 类型完全匹配或表达式类型为混合类型
        }
        // 处理数组类型的兼容性
        if (varType.endsWith('[]') && inferredType === 'array') {
            return true; // 变量声明为数组类型，赋值表达式为数组，类型兼容
        }
        // 可以根据需要添加更多类型兼容性的判断逻辑
        return false; // 类型不兼容
    }
}
exports.LPCDiagnostics = LPCDiagnostics;
//# sourceMappingURL=diagnostics.js.map