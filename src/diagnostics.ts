import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from './macroManager';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import { LPCParser } from './antlr/LPCParser';
import { CollectingErrorListener } from './parser/CollectingErrorListener';
import { getParsed } from './parseCache';
import { StringLiteralCollector } from './collectors/StringLiteralCollector';
import { FileNamingCollector } from './collectors/FileNamingCollector';
import { UnusedVariableCollector } from './collectors/UnusedVariableCollector';
// import { UnusedParameterCollector } from './collectors/UnusedParameterCollector'; // 已移除：取消函数参数使用情况检查
import { GlobalVariableCollector } from './collectors/GlobalVariableCollector';
import { ApplyFunctionReturnCollector } from './collectors/ApplyFunctionReturnCollector';
import { LocalVariableDeclarationCollector } from './collectors/LocalVariableDeclarationCollector';
import { Debouncer, Throttler } from './utils/debounce';

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
    private config: LPCConfig;
    private collectors: Array<{ collect: (doc: vscode.TextDocument, parsed: ReturnType<typeof getParsed>) => vscode.Diagnostic[] }>;

    // 预编译的正则表达式，避免重复创建
    private objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)(\()?/g;
    private macroDefRegex = /\b([A-Z_][A-Z0-9_]*)\b/;

    // 性能优化相关
    private debouncer = new Debouncer();
    private throttler = new Throttler();
    private isAnalyzing = new Set<string>(); // 防止重复分析
    private lastAnalysisVersion = new Map<string, number>(); // 记录上次分析的文档版本

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

        // 添加右键菜单命令
        let showVariablesCommand = vscode.commands.registerCommand('lpc.showVariables', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'lpc') {
                this.showAllVariables(editor.document);
            }
        });
        context.subscriptions.push(showVariablesCommand);

        // 初始化子诊断收集器
        this.collectors = [
            new StringLiteralCollector(),
            new FileNamingCollector(),
            new UnusedVariableCollector(),
            // new UnusedParameterCollector(), // 已移除：取消函数参数使用情况检查
            new GlobalVariableCollector(),
            new ApplyFunctionReturnCollector(),
            new LocalVariableDeclarationCollector(),
        ];

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
            // 从配置获取防抖延迟时间
            const config = vscode.workspace.getConfiguration('lpc.performance');
            const debounceDelay = config.get<number>('debounceDelay', 300);
            
            const documentKey = event.document.uri.toString();
            const debouncedAnalyze = this.debouncer.debounce(
                documentKey,
                () => this.analyzeDocument(event.document, false),
                debounceDelay
            );
            debouncedAnalyze();
        }
    }

    // 文件过滤函数
    private shouldCheckFile(fileName: string): boolean {
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.c' || ext === '.h';
    }

    private collectDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 收集旧的诊断信息
        this.collectObjectAccessDiagnostics(text, diagnostics, document);

        // 调用模块化收集器
        const parsed = getParsed(document);
        for (const c of this.collectors) {
            diagnostics.push(...c.collect(document, parsed));
        }

        // 使用 ParseCache 中的解析结果，避免重复解析并收集语法错误
        try {
            const { diagnostics: parseDiags } = getParsed(document);
            diagnostics.push(...parseDiags);
        } catch (err) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`解析 LPC 失败: ${err.message}`);
            }
        }

        return diagnostics;
    }

    private async collectDiagnosticsAsync(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 收集旧的诊断信息（异步处理）
        await this.collectObjectAccessDiagnosticsAsync(text, diagnostics, document);

        // 调用模块化收集器（批量异步处理）
        const parsed = getParsed(document);
        
        // 从配置获取批次大小
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const configBatchSize = config.get<number>('batchSize', 50);
        
        // 分批处理收集器，避免长时间阻塞
        const batchSize = Math.min(3, this.collectors.length); // 收集器批次大小
        for (let i = 0; i < this.collectors.length; i += batchSize) {
            const batch = this.collectors.slice(i, i + batchSize);
            
            // 并行处理当前批次的收集器
            const batchResults = await Promise.all(
                batch.map(async (collector) => {
                    // 让出主线程
                    await this.yieldToMainThread();
                    return collector.collect(document, parsed);
                })
            );
            
            for (const result of batchResults) {
                diagnostics.push(...result);
            }
        }

        // 使用 ParseCache 中的解析结果，避免重复解析并收集语法错误
        try {
            const { diagnostics: parseDiags } = getParsed(document);
            diagnostics.push(...parseDiags);
        } catch (err) {
            if (err instanceof Error) {
                vscode.window.showErrorMessage(`解析 LPC 失败: ${err.message}`);
            }
        }

        return diagnostics;
    }

    private async yieldToMainThread(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    private collectObjectAccessDiagnostics(
        text: string,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ): void {
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
                diagnostics.push(this.createDiagnostic(
                    this.getRange(document, startPos, object.length),
                    '对象名应该使用大写字母和下划线，例如: USER_OB',
                    vscode.DiagnosticSeverity.Warning
                ));
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

    private async collectObjectAccessDiagnosticsAsync(
        text: string,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ): Promise<void> {
        const objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\()?/g;
        let match;
        let processedCount = 0;
        
        // 从配置获取批次大小
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const batchSize = config.get<number>('batchSize', 50);

        while ((match = objectAccessRegex.exec(text)) !== null) {
            const [fullMatch, object, accessor, member, isFunction] = match;
            const startPos = match.index;
            const endPos = startPos + fullMatch.length;

            // 检查宏定义
            if (/^[A-Z][A-Z0-9_]*_D$/.test(object)) {
                await this.checkMacroUsage(object, startPos, document, diagnostics);
                continue;
            }

            // 检查对象命名规范
            if (!/^[A-Z][A-Z0-9_]*(?:_D)?$/.test(object)) {
                diagnostics.push(this.createDiagnostic(
                    this.getRange(document, startPos, object.length),
                    '对象名应该使用大写字母和下划线，例如: USER_OB',
                    vscode.DiagnosticSeverity.Warning
                ));
            }

            // 检查函数调用
            if (isFunction) {
                this.checkFunctionCall(text, startPos, endPos, document, diagnostics);
            }

            processedCount++;
            // 每处理一定数量的匹配项后让出主线程
            if (processedCount % batchSize === 0) {
                await this.yieldToMainThread();
            }
        }
    }

    private async checkMacroUsage(
        object: string,
        startPos: number,
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ): Promise<void> {
        const macro = this.macroManager?.getMacro(object);
        const canResolveMacro = await this.macroManager?.canResolveMacro(object);

        // 只对真正未定义的宏显示警告，不显示已定义宏的信息
        // if (!macro && !canResolveMacro) {
        //     diagnostics.push(this.createDiagnostic(
        //         this.getRange(document, startPos, object.length),
        //         `'${object}' 符合宏命名规范但未定义为宏`,
        //         vscode.DiagnosticSeverity.Warning
        //     ));
        // }
        // 对于已定义的宏，不添加任何诊断信息，保持问题面板清洁
    }

    private checkFunctionCall(
        text: string,
        startPos: number,
        endPos: number,
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ): void {
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
            } else {
                if (char === '"' || char === '\'') {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') {
                    bracketCount++;
                } else if (char === ')') {
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
            diagnostics.push(this.createDiagnostic(
                this.getRange(document, startPos, endPos - startPos),
                '函数调用缺少闭合的括号',
                vscode.DiagnosticSeverity.Error
            ));
        }
    }

    private collectStringLiteralDiagnostics(
        text: string,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ): void {
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;
        let match;

        while ((match = multilineStringRegex.exec(text)) !== null) {
            const content = match[1];
            if (!content.trim()) {
                diagnostics.push(this.createDiagnostic(
                    this.getRange(document, match.index, match[0].length),
                    '空的多行字符串',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
    }

    private collectFileNamingDiagnostics(
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ): void {
        const fileName = path.basename(document.fileName);
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

        const validExtensions = ['c', 'h'];
        if (!validExtensions.includes(extension.toLowerCase())) {
            return;
        }

        const validNameRegex = /^[a-zA-Z0-9_-]+$/i;
        if (!validNameRegex.test(fileNameWithoutExt)) {
            diagnostics.push(this.createDiagnostic(
                new vscode.Range(0, 0, 0, 0),
                'LPC 文件名只能包含字母、数字、下划线和连字符，扩展名必须为 .c 或 .h',
                vscode.DiagnosticSeverity.Warning
            ));
        }
    }

    public analyzeDocument(document: vscode.TextDocument, showMessage: boolean = false): void {
        if (!this.shouldCheckFile(document.fileName)) {
            return;
        }

        const documentKey = document.uri.toString();
        
        // 检查是否正在分析中，避免重复分析
        if (this.isAnalyzing.has(documentKey)) {
            return;
        }

        // 检查文档版本是否已经分析过
        const lastVersion = this.lastAnalysisVersion.get(documentKey);
        if (lastVersion === document.version) {
            return;
        }

        this.isAnalyzing.add(documentKey);
        
        try {
            // 使用异步方式进行分析，避免阻塞主线程
            this.analyzeDocumentAsync(document, showMessage).finally(() => {
                this.isAnalyzing.delete(documentKey);
                this.lastAnalysisVersion.set(documentKey, document.version);
            });
        } catch (error) {
            this.isAnalyzing.delete(documentKey);
            console.error('分析文档时发生错误:', error);
        }
    }

    private async analyzeDocumentAsync(document: vscode.TextDocument, showMessage: boolean): Promise<void> {
        // 检查是否启用异步诊断
        const config = vscode.workspace.getConfiguration('lpc.performance');
        const enableAsync = config.get<boolean>('enableAsyncDiagnostics', true);
        
        const diagnostics = enableAsync 
            ? await this.collectDiagnosticsAsync(document)
            : this.collectDiagnostics(document);
            
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
        
        // 清理性能优化相关的资源
        this.debouncer.clear();
        this.isAnalyzing.clear();
        this.lastAnalysisVersion.clear();
    }

    private createDiagnostic(
        range: vscode.Range,
        message: string,
        severity: vscode.DiagnosticSeverity,
        code?: string
    ): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        if (code) {
            diagnostic.code = code;
        }
        return diagnostic;
    }

    private getRange(
        document: vscode.TextDocument,
        startPos: number,
        length: number
    ): vscode.Range {
        return new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + length)
        );
    }

    private getVariableUsagePatterns(varName: string): { pattern: RegExp, description: string }[] {
        // Patterns for when a variable's value is read or it's passed by reference (like sscanf).
        return [
            {
                // varName as a function argument: foo(varName), foo(x, varName, y)
                pattern: new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: '函数参数'
            },
            {
                // varName on the RHS of an assignment: x = varName; y = z + varName;
                // Negative lookahead (?!...) ensures varName is not on LHS of simple assignment like "varName = value"
                // It allows varName on LHS of compound assignment "varName += value" because that's handled by '复合赋值'
                pattern: new RegExp(`\\b(?!${varName}\\s*=[^=])[a-zA-Z_][a-zA-Z0-9_]*\\s*[+\\-*\\/%]?=\\s*.*\\b${varName}\\b.*?;`, 'g'),
                description: '赋值右值'
            },
            {
                // varName in a return statement: return varName; return obj->method(varName);
                pattern: new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g'),
                description: 'return语句'
            },
            {
                // varName in an if condition: if (varName), if (varName > 0)
                pattern: new RegExp(`\\bif\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'if条件'
            },
            {
                // varName in a while condition: while (varName), while (varName--)
                pattern: new RegExp(`\\bwhile\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'while循环'
            },
            {
                // varName in a for loop's condition or increment part (not initializer if it's LHS of simple assignment):
                // for (...; varName; ...), for (...; ; varName++)
                pattern: new RegExp(`\\bfor\\s*\\([^;]*;[^;]*\\b${varName}\\b[^;]*;[^)]*\\)`, 'g'),
                description: 'for循环'
            },
            {
                // varName in a switch statement: switch (varName)
                pattern: new RegExp(`\\bswitch\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'switch语句'
            },
            {
                // varName in a case statement: case varName:
                pattern: new RegExp(`\\bcase\\s+\\b${varName}\\b`, 'g'),
                description: 'case语句'
            },
            // The following foreach patterns are for varName as LHS (iteration variable), so NOT a read.
            // {
            //     pattern: new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s*,\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s+in\\b`, 'g'),
            //     description: 'foreach迭代器 (LHS)'
            // },
            // {
            //     pattern: new RegExp(`\\bforeach\\s*\\(\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*,\\s*${varName}\\s+in\\b`, 'g'),
            //     description: 'foreach值 (LHS)'
            // },
            // {
            //     pattern: new RegExp(`\\bforeach\\s*\\(\\s*${varName}\\s+in\\b`, 'g'),
            //     description: 'foreach单值 (LHS)'
            // },
            { 
                // varName is the collection being iterated (RHS usage): foreach (x in varName)
                pattern: new RegExp(`\\bforeach\\s*\\([^)]+in\\s+\\b${varName}\\b`, 'g'),
                description: 'foreach集合 (RHS)'
            },
            { 
                // For sscanf, input_to, the variable's address is effectively taken.
                // For call_other, if varName is an argument, its value is read.
                // Matches varName when it's one of the arguments, not just the first or specific one.
                pattern: new RegExp(`\\b(?:sscanf|input_to|call_other)\\s*\\((?:[^(),]*\\(\\s*[^()]*\\s*\\)[^(),]*|[^(),])*\\b${varName}\\b`, 'g'),
                description: '特殊函数调用 (sscanf, input_to, call_other arg)'
            },
            { 
                // varName is an object, and its member/method is accessed: varName->prop, varName->method()
                pattern: new RegExp(`\\b${varName}\\s*->`, 'g'),
                description: '对象成员访问'
            },
            // Removed: `->\\s*${varName}\\b` (varName as method name, not a variable read)
            // Removed: `\\bcall_other\\s*\\([^,]+,\\s*"${varName}"` (varName as string literal for func name)
            { 
                // Compound assignment: varName += value; varName -= value; etc. This is a read.
                pattern: new RegExp(`\\b${varName}\\s*(?:\\+=|-=|\\*=|\\/=|%=)\\s*[^;]+`, 'g'),
                description: '复合赋值'
            }
        ];
    }

    private checkVariableUsage(varName: string, code: string): boolean {
        const patterns = this.getVariableUsagePatterns(varName);
        for (const { pattern } of patterns) {
            pattern.lastIndex = 0; // Reset lastIndex for global regexes before each test
            if (pattern.test(code)) {
                return true;
            }
        }

        // Fallback: Check for other usages of varName, ensuring it's not just on the LHS of a simple assignment.
        // A simple assignment is like "varName = value;"
        // A compound assignment like "varName += value;" is covered by getVariableUsagePatterns.
        // Usage in an expression "x = varName + y", "if (varName)", "foo(varName)" (if not caught by specific patterns) should be caught.
        const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
        let match;
        while ((match = usagePattern.exec(code)) !== null) {
            const index = match.index;

            // Check context around varName to see if it's LHS of a simple assignment.
            // Look at characters immediately after varName. e.g., "varName =", "varName  ="
            const postVariableContext = code.substring(index + varName.length);
            // Regex: starts with optional whitespace, then '=', then NOT another '=', then anything or end of line.
            const simpleAssignmentLHSRegex = /^\s*=\s*([^=]|$)/; 
            
            if (!simpleAssignmentLHSRegex.test(postVariableContext)) {
                // It's not on the LHS of a simple assignment like "varName = value".
                // This means it's used in an expression, as a function argument (if not caught above),
                // as an array index, part of a comparison, on RHS of assignment, etc.
                return true;
            }
        }
        return false;
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

                // 批量处理文件以提高性能
                const batchSize = 10; // 每批处理的文件数
                const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

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
                        } catch (error) {
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
        } catch (error) {
            outputChannel.appendLine(`发生错误: ${error}`);
            vscode.window.showErrorMessage('扫描过程中发生错误，请查看输出面板了解详情。');
        }
    }

    // 递归查找所有 LPC 文件
    private async findLPCFiles(folderPath: string): Promise<string[]> {
        const files: string[] = [];
        const fileExtensions = ['.c', '.h'];
        const ignoreDirs = ['node_modules', '.git', '.vscode']; // 常见需要忽略的目录

        async function walk(dir: string) {
            let entries;
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch (error) {
                console.error(`无法读取目录 ${dir}:`, error);
                return;
            }

            // 分离目录和文件以便并行处理
            const directories: string[] = [];
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // 跳过忽略的目录
                    if (!ignoreDirs.includes(entry.name)) {
                        directories.push(fullPath);
                    }
                } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
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

    private async analyzeObjectAccess(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
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
        } else {
            // 小文件直接处理
            await this.analyzeObjectAccessChunk(text, 0, diagnostics, document);
        }
    }

    private async analyzeObjectAccessChunk(text: string, offset: number, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        // 匹配对象访问语法 ob->func() 和 ob.func
        const objectAccessRegex = this.objectAccessRegex;
        objectAccessRegex.lastIndex = 0; // 重置正则状态
        
        // 预先收集所有匹配项，然后批量处理
        const matches: Array<{match: RegExpExecArray, startPos: number}> = [];
        let match: RegExpExecArray | null;
        
        while ((match = objectAccessRegex.exec(text)) !== null) {
            const startPos = match.index + offset;
            matches.push({match, startPos});
        }
        
        // 如果匹配数量很大，分批处理避免阻塞主线程
        const batchSize = 50;
        for (let i = 0; i < matches.length; i += batchSize) {
            const batch = matches.slice(i, i + batchSize);
            
            // 处理当前批次的匹配
            for (const {match, startPos} of batch) {
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
                    this.checkFunctionCall(
                        text,
                        startPos + match[0].indexOf(func),
                        startPos + match[0].length,
                        document,
                        diagnostics
                    );
                }
            }
            
            // 每处理一批后让出主线程，防止UI卡顿
            if (i + batchSize < matches.length) {
                // 使用 setTimeout 0 来让出主线程
                await new Promise(resolve => setTimeout(resolve, 0));
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

    private inferExpressionType(expression: string): string {
        // 简化实现: 仅区分数字/字符串/数组/映射，其余返回 mixed
        expression = expression.trim();
        if (/^\d+$/.test(expression)) return 'int';
        if (/^\d+\.\d+$/.test(expression)) return 'float';
        if (/^".*"$/.test(expression)) return 'string';
        if (/^\(\[.*\]\)$/.test(expression) || /^\[.*\]$/.test(expression)) return 'mapping';
        if (/^\({.*}\)$/.test(expression)) return 'array';
        return 'mixed';
    }

    private areTypesCompatible(varType: string, inferredType: string): boolean {
        if (varType === inferredType || inferredType === 'mixed' || varType === 'mixed') return true;
        if (varType.endsWith('[]') && (inferredType === 'array' || inferredType.endsWith('[]'))) return true;
        if ((varType === 'float' && inferredType === 'int') || (varType === 'int' && inferredType === 'float')) return true;
        return false;
    }
}