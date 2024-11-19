import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from './macroManager';

// 加载配置文件
interface LPCConfig {
    types: string[];
    modifiers: string[];
    efuns: { [key: string]: { snippet: string; detail: string } };
}

function loadLPCConfig(configPath: string): LPCConfig {
    try {
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent) as LPCConfig;
    } catch (error) {
        vscode.window.showErrorMessage(`无法加载配置文件: ${error}`);
        return {
            types: [],
            modifiers: [],
            efuns: {}
        };
    }
}

export class LPCDiagnostics {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private macroManager: MacroManager;
    private lpcTypes: string;
    private modifiers: string;
    private excludedIdentifiers: Set<string>;
    private variableDeclarationRegex: RegExp;
    private globalVariableRegex: RegExp;
    private functionDeclRegex: RegExp;
    private inheritRegex: RegExp;
    private includeRegex: RegExp;
    private applyFunctions: Set<string>;
    private config: LPCConfig;

    constructor(context: vscode.ExtensionContext, macroManager: MacroManager) {
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
        this.variableDeclarationRegex = new RegExp(
            `^\\s*((?:${this.modifiers}\\s+)*)(${this.lpcTypes})\\s+` +
            '(\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*)*);',
            'gm'
        );

        this.globalVariableRegex = new RegExp(
            `^\\s*(?:${this.modifiers}?\\s*)(${this.lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*(?:=\\s*[^;]+)?;',
            'gm'
        );

        this.functionDeclRegex = new RegExp(
            `^\\s*(?:${this.modifiers}\\s+)*(${this.lpcTypes})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*{',
            'gm'
        );

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
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this))
        );

        // 注册文档打开事件
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument(this.analyzeDocument.bind(this))
        );

        // 注册悬停提供器
        context.subscriptions.push(
            vscode.languages.registerHoverProvider('lpc', {
                provideHover: async (document, position, token) => {
                    const range = document.getWordRangeAtPosition(position);
                    if (!range) return;

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
            })
        );
    }

    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
        if (event.document.languageId === 'lpc') {
            this.analyzeDocument(event.document, false);
        }
    }

    // 文件过滤函数
    private shouldCheckFile(fileName: string): boolean {
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.c' || ext === '.h';
    }

    public analyzeDocument(document: vscode.TextDocument, showMessage: boolean = false) {
        const text = document.getText();
        const fileName = document.fileName;

        // 如果不是 LPC 文件，不进行检查
        if (!this.shouldCheckFile(fileName)) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];

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

    private findInherits(text: string): Set<string> {
        const inherits = new Set<string>();
        let match;
        while ((match = this.inheritRegex.exec(text)) !== null) {
            match[1].split(',').forEach(name => {
                inherits.add(name.trim());
            });
        }
        return inherits;
    }

    private findIncludes(text: string): Set<string> {
        const includes = new Set<string>();
        let match;
        while ((match = this.includeRegex.exec(text)) !== null) {
            includes.add(match[1]);
        }
        return includes;
    }

    private getFunctionBlocks(text: string): Array<{ start: number, content: string }> {
        const blocks: Array<{ start: number, content: string }> = [];
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
                } else if (inSingleLineComment) {
                    if (char === '\n') {
                        inSingleLineComment = false;
                    }
                } else if (inMultiLineComment) {
                    if (nextTwoChars === '*/') {
                        inMultiLineComment = false;
                        currentIndex++;
                    }
                } else {
                    if (nextTwoChars === '//') {
                        inSingleLineComment = true;
                        currentIndex++;
                    } else if (nextTwoChars === '/*') {
                        inMultiLineComment = true;
                        currentIndex++;
                    } else if (char === '"' || char === '\'') {
                        inString = true;
                        stringChar = char;
                    } else if (char === '{') {
                        bracketCount++;
                    } else if (char === '}') {
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

    private findGlobalVariables(document: vscode.TextDocument): Set<string> {
        const text = document.getText();
        const globalVariables = new Set<string>();

        // 首先获取所有函数块的范围
        const functionRanges: { start: number, end: number }[] = [];
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
                } else {
                    if (char === '"' || char === '\'') {
                        inString = true;
                        stringChar = char;
                    } else if (char === '{') {
                        bracketCount++;
                    } else if (char === '}') {
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
            const isInFunction = functionRanges.some(range =>
                matchStart > range.start && matchStart < range.end
            );

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

    private findFunctionDefinitions(text: string): Set<string> {
        const functionDefs = new Set<string>();
        let match;
        this.functionDeclRegex.lastIndex = 0;
        while ((match = this.functionDeclRegex.exec(text)) !== null) {
            functionDefs.add(match[2]);
        }
        return functionDefs;
    }

    private async showAllVariables(document: vscode.TextDocument) {
        const text = document.getText();
        const globalVars = this.findGlobalVariables(document);
        const localVars = new Map<string, {
            type: string,
            range: vscode.Range,
            declarationIndex: number,
            isArray: boolean
        }>();

        // 查找所有局部变量
        let match: RegExpExecArray | null;
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
                        const range = new vscode.Range(
                            document.positionAt(varIndex),
                            document.positionAt(varIndex + varName.length)
                        );
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
        const unusedVars = new Set<string>();
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
        const panel = vscode.window.createWebviewPanel(
            'lpcVariables',
            'LPC 变量列表',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

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
                    ${Array.from(globalVars).map(varName =>
            `<div class="variable">- ${varName}</div>`
        ).join('')}
                </div>
                <div class="section">
                    <h3>局部变量:</h3>
                    ${Array.from(localVars.entries()).map(([name, info]) =>
            `<div class="variable" data-line="${info.range.start.line}" data-char="${info.range.start.character}">
                            - ${info.type} ${name}
                        </div>`
        ).join('')}
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
        panel.webview.onDidReceiveMessage(
            message => {
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
            },
            undefined,
            []
        );
    }

    public dispose() {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    }

    private analyzeVariablesInFunction(
        block: { start: number; content: string },
        globalVars: Set<string>,
        functionDefs: Set<string>,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ) {
        const localVars = new Map<string, {
            range: vscode.Range,
            declarationRange: vscode.Range,
            declarationIndex: number,
            isArray: boolean,
            type: string
        }>();
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
                    const range = new vscode.Range(
                        document.positionAt(block.start + expressionStart),
                        document.positionAt(block.start + expressionEnd)
                    );
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `变量 '${varName}' 声明为 '${varType}'，但赋值的表达式类型为 '${inferredType}'`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }

            // 检查是否被赋值或作为引用参数使用
            const isUsed = this.checkVariableUsage(varName, afterDeclaration);

            if (!isUsed) {
                const diagnostic = new vscode.Diagnostic(
                    info.range,
                    `未使用的变量: '${varName}'${info.isArray ? ' (数组)' : ''}`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.code = 'unusedVar';
                diagnostics.push(diagnostic);
            }
        }
    }

    private checkVariableUsage(varName: string, code: string): boolean {


        //定义一个布尔类型，用于记录是否被使用
        let isUsed = false;

        // 添加 foreach 语法的检查
        const patterns = [
            // 保持原有的基础模式
            new RegExp(`\\b${varName}\\s*=`, 'g'),
            new RegExp(`\\b${varName}\\s*[+\\-*/%]?=`, 'g'),
            new RegExp(`\\b${varName}\\s*[+\\-]{2}`, 'g'),
            new RegExp(`\\b${varName}\\s*\\[[^\\]]*\\]\\s*=`, 'g'),

            // foreach的三种使用场景
            // 1. 作为第一个变量: foreach (varName, xxx in yyy)
            new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s*,\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s+in\\b`, 'g'),
            // 2. 作为第二个变量: foreach (xxx, varName in yyy)
            new RegExp(`\\bforeach\\s*\\(\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*${varName}\\s+in\\b`, 'g'),
            // 3. 作为单个变量: foreach (varName in yyy)
            new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s+in\\b`, 'g'),
            // 4. 作为集合变量
            new RegExp(`\\bforeach\\s*\\([^)]+in\\s+${varName}\\b`, 'g')
        ];


        // 检查是否匹配任一模式
        isUsed = patterns.some(pattern => pattern.test(code));

        //如果没有匹配到，则检查sscanf和input_to函数
        if (!isUsed) {
            // 匹配sscanf和input_to函数的第3个参数开始的所有参数
            const functionCallPattern = new RegExp(`\\b(?:sscanf|input_to)\\s*\\([^,]+,\\s*[^,]+,\\s*([^)]*)\\)`, 'g');
            let funcMatch;
            while ((funcMatch = functionCallPattern.exec(code)) !== null) {
                // 截取第3个参数开始的所有参数
                const argsString = funcMatch[1];
                // 将参数字符串按逗号分割成数组
                const args = argsString.split(',').map(arg => arg.trim());
                // 检查参数是否包含varName
                if (args.includes(varName)) {
                    isUsed = true;
                }
            }
        }

        //所有变量检测已经有明确的赋值，代表了有明确的意义，这个时候开始检测是否被使用
        if (isUsed) {
            // 添加检查：如果变量仅被赋值，但未被使用，应视为未使用
            // 如果变量被以下情况使用，则视为已使用：
            // 1. 被赋值给其他变量
            // 2. 作为参数传递给函数调用
            // 3. 被 return 语句返回

            // 检查变量是否被赋值给其他变量（右值）
            const assignedToVariablePattern = new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*=\\s*${varName}\\b`, 'g');


            //未通过检查，视为有意义但是没有使用的变量
            isUsed = false;

            if (assignedToVariablePattern.test(code)) {
                isUsed = true;
            }

            // 检查变量是否作为参数传递给函数调用
            const functionCallPattern = new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g');
            if (functionCallPattern.test(code)) {
                isUsed = true;
            }

            // 检查变量是否被 return 语句返回
            const returnPattern = new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g');
            if (returnPattern.test(code)) {
                isUsed = true;
            }

            // 检查变量是否在表达式中使用（非赋值左侧）
            const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
            let match;
            while ((match = usagePattern.exec(code)) !== null) {
                const index = match.index;
                const beforeChar = code[index - 1];
                const afterChar = code[index + varName.length];

                // 忽略赋值左侧的情况
                const isAssignmentLeft = /\s*=/.test(code.slice(index + varName.length, index + varName.length + 2));
                if (!isAssignmentLeft) {
                    isUsed = true;
                }
            }


        }

        return isUsed;
    }

    private analyzeApplyFunctions(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        // 暂时关闭检查 apply 函数的返回类型，因为 FluffOS 的 apply 函数返回类型不固定，用户可以自行定义
        return;
    }

    private isValidApplyReturnType(funcName: string, returnType: string): boolean {
        const typeMap: { [key: string]: string } = {
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

    private getExpectedReturnType(funcName: string): string {
        return this.isValidApplyReturnType(funcName, 'void') ? 'void' : 'int';
    }

    private checkFileNaming(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) {
        const fileName = path.basename(document.fileName);
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

        const validExtensions = ['c', 'h'];
        if (!validExtensions.includes(extension.toLowerCase())) {
            return; // 跳过非 .c 或 .h 文件
        }

        const validNameRegex = /^[a-zA-Z0-9_-]+$/i;

        if (!validNameRegex.test(fileNameWithoutExt)) {
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0),
                'LPC 文件名只能包含字母、数字、下划线和连字符，扩展名必须为 .c 或 .h',
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    public async scanFolder() {
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
                    const diagnostics: vscode.Diagnostic[] = [];
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
        } catch (error) {
            outputChannel.appendLine(`发生错误: ${error}`);
            vscode.window.showErrorMessage('扫描过程中发生错误，请查看输出面板了解详情。');
        }
    }

    // 递归查找所有 LPC 文件
    private async findLPCFiles(folderPath: string): Promise<string[]> {
        const files: string[] = [];

        async function walk(dir: string) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile() && (entry.name.endsWith('.c') || entry.name.endsWith('.h'))) {
                    files.push(fullPath);
                }
            }
        }

        await walk(folderPath);
        return files;
    }

    private async analyzeObjectAccess(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
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
                    const range = new vscode.Range(
                        document.positionAt(match.index),
                        document.positionAt(match.index + object.length)
                    );
                    if (macro) {
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `宏 '${object}' 的值为: ${macro.value}`,
                            vscode.DiagnosticSeverity.Information
                        ));
                    }
                    continue; // 跳过后续的未定义检查
                } else {
                    // 如果既不是宏也不能被解析，添加诊断信息
                    const range = new vscode.Range(
                        document.positionAt(match.index),
                        document.positionAt(match.index + object.length)
                    );
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `'${object}' 符合宏命名规范但未定义为宏`,
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        }
    }

    private analyzeStringLiterals(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        // 检查多行字符串语法
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;

        let match;
        while ((match = multilineStringRegex.exec(text)) !== null) {
            // 验证多行字符串的格式
            const content = match[1];
            if (!content.trim()) {
                const range = new vscode.Range(
                    document.positionAt(match.index),
                    document.positionAt(match.index + match[0].length)
                );

                diagnostics.push(new vscode.Diagnostic(
                    range,
                    '空的多行字符串',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    }

    /**
     * 推断给定表达式的类型
     * 作者：Lu Dexiang
     * @param expression 表达式字符串
     * @returns 推断出的类型
     */
    private inferExpressionType(expression: string): string {
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
    private areTypesCompatible(varType: string, inferredType: string): boolean {
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