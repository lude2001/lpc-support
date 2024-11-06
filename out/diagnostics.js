"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCDiagnostics = void 0;
const vscode = require("vscode");
const path = require("path");
class LPCDiagnostics {
    constructor(context, macroManager) {
        // 更新 lpcTypes，添加更多 LPC 支持的类型
        this.lpcTypes = 'void|int|string|object|array|mapping|float|buffer|mixed|function|class|struct|status|closure|symbol|pointer';
        // 添加 modifiers 定义
        this.modifiers = 'private|public|protected|static|nosave|varargs|nomask';
        // 更新预定义标识符，按类别组织
        this.excludedIdentifiers = new Set([
            // 数组相关函数
            'allocate', 'arrayp', 'element_of', 'filter_array', 'map_array', 'member_array', 'pointerp', 'shuffle', 'sort_array', 'unique_array',
            // 缓冲区相关函数
            'allocate_buffer', 'bufferp', 'buffer_transcode', 'crc32', 'read_buffer', 'write_buffer',
            // 调用相关函数
            'call_other', 'call_out', 'call_out_walltime', 'call_stack', 'catch', 'origin', 'previous_object', 'query_shadowing', 'remove_call_out', 'shadow', 'this_object', 'throw',
            // 数据库相关函数
            'db_close', 'db_commit', 'db_connect', 'db_exec', 'db_fetch', 'db_rollback', 'db_status',
            // 文件系统相关函数
            'cp', 'file_size', 'get_dir', 'link', 'mkdir', 'read_bytes', 'read_file', 'rename', 'rm', 'rmdir', 'stat', 'write_bytes', 'write_file',
            // 浮点运算相关函数
            'acos', 'angle', 'asin', 'atan', 'ceil', 'cos', 'distance', 'dotprod', 'exp', 'floatp', 'floor', 'log', 'pow', 'round', 'sin', 'sqrt', 'tan',
            // 函数相关函数
            'bind', 'evaluate', 'functionp',
            // 常规函数
            'filter', 'map', 'nullp', 'restore_variable', 'save_variable', 'sizeof', 'typeof', 'undefinedp',
            // 互动对象相关函数
            'add_action', 'command', 'commands', 'disable_commands', 'enable_commands', 'exec', 'find_player', 'get_char', 'in_edit', 'in_input', 'input_to', 'interactive', 'message', 'notify_fail', 'printf', 'query_ip_name', 'query_ip_number', 'say', 'shout', 'tell_object', 'tell_room', 'this_player', 'write',
            // 映射相关函数
            'allocate_mapping', 'filter_mapping', 'keys', 'map_delete', 'map_mapping', 'mapp', 'values',
            // MUDLIB相关函数
            'find_living', 'geteuid', 'getuid', 'living', 'livings', 'set_light', 'set_living_name', 'seteuid',
            // 对象相关函数
            'all_inventory', 'children', 'clone_object', 'clonep', 'deep_inventory', 'destruct', 'environment', 'file_name', 'find_object', 'first_inventory', 'load_object', 'move_object', 'new', 'next_inventory', 'objectp', 'present',
            // 字符串相关函数
            'capitalize', 'explode', 'implode', 'lower_case', 'replace_string', 'sprintf', 'sscanf', 'strcmp', 'stringp', 'strlen', 'strsrch',
            // 系统相关函数
            'ctime', 'localtime', 'time', 'uptime',
            // FluffOS新增函数
            'abs', 'base_name', 'copy', 'max', 'min', 'pluralize', 'upper_case'
        ]);
        // 改进变量声明的正则表达式，支持带星号的数组声明和多变量声明
        this.variableDeclarationRegex = new RegExp(`^\\s*((?:${this.modifiers}\\s+)*)(${this.lpcTypes})\\s+` +
            '(\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*)*);', 'gm');
        // 改进全局变量检测，只匹配函数外的变量声明
        this.globalVariableRegex = new RegExp(`^\\s*(?:private|public|protected|nosave)?\\s*(${this.lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*(?:=\\s*[^;]+)?;', 'gm');
        // 改进函数声明检测
        this.functionDeclRegex = new RegExp(`^\\s*(?:private|public|protected|static|nomask|varargs)?\\s*(${this.lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*{', 'gm');
        // 添加继承相关的检测
        this.inheritRegex = /^\s*inherit\s+([A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*);/gm;
        this.includeRegex = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;
        // 更新 apply 函数列表
        this.applyFunctions = new Set([
            // 基础 apply 函数
            'create', 'setup', 'init', 'clean_up', 'reset',
            // 对象相关
            'receive_object', 'move_object', 'can_move',
            'valid_move', 'query_heart_beat', 'set_heart_beat',
            // 玩家交互相关
            'catch_tell', 'receive_message', 'write_prompt',
            'process_input', 'do_command',
            // 连接相关
            'logon', 'connect', 'disconnect', 'net_dead',
            'terminal_type', 'window_size', 'receive_snoop',
            // 安全相关
            'valid_override', 'valid_seteuid', 'valid_shadow',
            'query_prevent_shadow', 'valid_bind',
            // 其他系统相关
            'clean_up', 'reset', 'virtual_start', 'epilog',
            'preload', 'valid_read', 'valid_write'
        ]);
        this.macroManager = macroManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        context.subscriptions.push(this.diagnosticCollection);
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
    analyzeDocument(document, showMessage = false) {
        const text = document.getText();
        const diagnostics = [];
        // 首先检查继承和包含
        const inheritedFiles = this.findInherits(text);
        const includedFiles = this.findIncludes(text);
        // 收集全局变量
        const globalVars = this.findGlobalVariables(document);
        // 收集函
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
        // 添加数字字面量检查（支持下划线分隔符）
        this.analyzeNumericLiterals(text, diagnostics, document);
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
            let inComment = false;
            let currentIndex = start;
            while (currentIndex < text.length) {
                const char = text[currentIndex];
                const nextTwoChars = text.substr(currentIndex, 2);
                if (inString) {
                    if (char === stringChar) {
                        inString = false;
                    }
                    else if (char === '\\') {
                        currentIndex++;
                    }
                }
                else if (inComment) {
                    if (nextTwoChars === '*/') {
                        inComment = false;
                        currentIndex++;
                    }
                }
                else {
                    if (nextTwoChars === '//' || nextTwoChars === '/*') {
                        inComment = true;
                        if (nextTwoChars === '//') {
                            currentIndex = text.indexOf('\n', currentIndex);
                            if (currentIndex === -1)
                                break;
                        }
                        else {
                            currentIndex++;
                        }
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
            // 分割变量明，保留每个变量声明的完整形式（包括星号）
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
                        localVars.set(varName, {
                            range: new vscode.Range(varStart, varEnd),
                            declarationRange: new vscode.Range(declStart, declEnd),
                            declarationIndex: match.index,
                            isArray,
                            type: isArray ? `${varType}[]` : varType
                        });
                    }
                }
            }
        }
        // 检查变量使用
        for (const [varName, info] of localVars) {
            // 在变量声明后的代码中查找变量使用
            const afterDeclaration = block.content.slice(info.declarationIndex + varName.length);
            // 检查是否被赋值或作为引用参数使用
            const isUsed = this.checkVariableUsage(varName, afterDeclaration);
            if (!isUsed) {
                const diagnostic = new vscode.Diagnostic(info.range, `未使用的变量: '${varName}'${info.isArray ? ' (数组)' : ''}`, vscode.DiagnosticSeverity.Warning);
                diagnostic.code = 'unusedVar';
                diagnostics.push(diagnostic);
            }
        }
    }
    checkVariableUsage(varName, code) {
        // 创建正则表达式来匹配变量的各种使用情况
        const patterns = [
            // 接赋值
            new RegExp(`\\b${varName}\\s*=`, 'g'),
            // 复合赋值
            new RegExp(`\\b${varName}\\s*[+\\-*/%]?=`, 'g'),
            // 自增自减
            new RegExp(`\\b${varName}\\s*[+\\-]{2}`, 'g'),
            // 作为 sscanf 的引用参数
            new RegExp(`sscanf\\([^)]*,\\s*[^,]*,\\s*${varName}\\b`, 'g'),
            // 其他常见的引用参数函数
            new RegExp(`(?:fscanf|scanf|parse_arg)\\([^)]*,\\s*${varName}\\b`, 'g'),
            // 数组赋值
            new RegExp(`\\b${varName}\\s*\\[[^\\]]*\\]\\s*=`, 'g'),
            // mapping 赋值
            new RegExp(`\\b${varName}\\s*\\[[^\\]]*\\]\\s*=`, 'g')
        ];
        // 检查是否匹配任一模式
        return patterns.some(pattern => pattern.test(code));
    }
    analyzeApplyFunctions(text, diagnostics, document) {
        for (const applyFunc of this.applyFunctions) {
            const regex = new RegExp(`^\\s*(?:${this.modifiers}\\s+)*(${this.lpcTypes})\\s+${applyFunc}\\s*\\(`, 'gm');
            let match;
            while ((match = regex.exec(text)) !== null) {
                // 检查 apply 函数的返回类型是否正确
                const returnType = match[1];
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                if (!this.isValidApplyReturnType(applyFunc, returnType)) {
                    const diagnostic = new vscode.Diagnostic(new vscode.Range(startPos, endPos), `apply 函数 ${applyFunc} 的返回类型应该是 ${this.getExpectedReturnType(applyFunc)}`, vscode.DiagnosticSeverity.Warning);
                    diagnostics.push(diagnostic);
                }
            }
        }
    }
    // 添加 LPC 特有的函数返回类型检查
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
        const fileNameRegex = /^[a-zA-Z0-9_]+\.(c|h)$/i;
        if (!fileNameRegex.test(fileName)) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), 'LPC 文件名只能包含字母、数字和下划线，扩展名必须为 .c 或 .h', vscode.DiagnosticSeverity.Warning));
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
            // 显进度条
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
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                const fullPath = path.join(dir, name);
                if (type === vscode.FileType.Directory) {
                    await walk(fullPath);
                }
                else if (type === vscode.FileType.File && name.endsWith('.c')) {
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
            // 检查对象是否已定义（如果不是宏的话）
            if (!this.isObjectDefined(object, text)) {
                const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + object.length));
                diagnostics.push(new vscode.Diagnostic(range, `未定义的对象: '${object}'`, vscode.DiagnosticSeverity.Warning));
            }
        }
    }
    isObjectDefined(objectName, text) {
        // 首先检查是否是宏定义
        if (this.macroManager?.getMacro(objectName)) {
            return true; // 如果是宏定义，直接返回 true
        }
        // 检查是否是预定义对象
        if (this.excludedIdentifiers.has(objectName)) {
            return true;
        }
        // 检查是否是通过inherit获得的对象
        const inheritMatch = /inherit\s+([A-Z_][A-Z0-9_]*)/g.exec(text);
        if (inheritMatch && inheritMatch[1] === objectName) {
            return true;
        }
        // 检查是否是局部变量
        const varDeclaration = new RegExp(`\\b(?:object|class)\\s+${objectName}\\b`, 'g');
        // 检查是否是全局变量
        const globalVarDeclaration = new RegExp(`^\\s*(?:private|public|protected|nosave)?\\s*(?:object|class)\\s+${objectName}\\b`, 'gm');
        return varDeclaration.test(text) || globalVarDeclaration.test(text);
    }
    analyzeNumericLiterals(text, diagnostics, document) {
        // 支持带下划线的数字字面量，如: 1_000_000
        const numericRegex = /\b\d+(_\d+)*(\.\d+(_\d+)*)?\b/g;
        let match;
        while ((match = numericRegex.exec(text)) !== null) {
            // 验证数字格式的正确性
            const number = match[0];
            if (number.startsWith('_') || number.endsWith('_') || number.includes('__')) {
                const range = new vscode.Range(document.positionAt(match.index), document.positionAt(match.index + number.length));
                diagnostics.push(new vscode.Diagnostic(range, '数字字面量中的下划线使用不正确', vscode.DiagnosticSeverity.Error));
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
}
exports.LPCDiagnostics = LPCDiagnostics;
//# sourceMappingURL=diagnostics.js.map