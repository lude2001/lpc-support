import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from './macroManager';
import * as Parser from 'web-tree-sitter'; // Import Tree-sitter
import { collectVariableDefinitionOrderDiagnostics } from './variableOrderChecker'; // Import the new checker

// Module-level variable to hold the loaded language
let LpcLanguage: Parser.Language | undefined = undefined;

const variableQueriesSource = {
    declarations: `
        (variable_declaration
          (_variable_declarator
            name: (identifier) @variable.name
          )
        ) @variable.declaration
        (parameter_declaration
          name: (identifier) @param.name
        ) @parameter.declaration
    `,
    function_definitions: `
        (function_definition
          name: (identifier) @function.name
          body: (_) @function.body
        ) @function.definition
    `,
    usages: `
        (identifier) @identifier.usage
    `
};

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

interface ForeachIterVariable {
    name: string;
    role: string; // "key", "value", "item" or "unknown"
}

export class LPCDiagnostics {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private macroManager: MacroManager;
    private lpcTypes: string; // Old, for regex
    private modifiers: string; // Old, for regex
    private excludedIdentifiers: Set<string>;
    private variableDeclarationRegex: RegExp; // To be removed/commented
    private globalVariableRegex: RegExp; // To be removed/commented
    private functionDeclRegex: RegExp; // To be removed/commented
    private inheritRegex: RegExp;
    private includeRegex: RegExp;
    private applyFunctions: Set<string>;
    private config: LPCConfig;
    private parser: Parser | undefined; // Tree-sitter parser instance

    // 预编译的正则表达式，避免重复创建
    private objectAccessRegex = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\()?/g;
    private macroDefRegex = /\b([A-Z_][A-Z0-9_]*)\b/;

    constructor(context: vscode.ExtensionContext, macroManager: MacroManager) {
        this.macroManager = macroManager;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        context.subscriptions.push(this.diagnosticCollection);

        // Initialize parser if LpcLanguage is already available
        if (LpcLanguage) {
            this.parser = new Parser();
            this.parser.setLanguage(LpcLanguage);
            console.log("LPCDiagnostics: Parser initialized in constructor.");
        } else {
            console.warn("LPCDiagnostics: LpcLanguage not available at construction. Parser will be initialized later if language is set.");
        }

        // 加载配置
        const configPath = path.join(context.extensionPath, 'config', 'lpc-config.json');
        this.config = loadLPCConfig(configPath);

        // 初始化类型和修饰符 - these might still be used by other diagnostic methods
        this.lpcTypes = this.config.types.join('|');
        this.modifiers = this.config.modifiers.join('|');

        // 初始化排除标识符
        this.excludedIdentifiers = new Set([
            ...Object.keys(this.config.efuns),
            "this_object", "this_player", "previous_object", "this_interactive" // Common LPC implicit identifiers
        ]);

        // Comment out regexes for variable analysis as they will be replaced by Tree-sitter
        // /*
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
            `^\\s*((?:${this.modifiers}\\s+)*)(${this.lpcTypes})\\s+` + // Corrected: removed extra ')'
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*{',
            'gm'
        );
        // */

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
                // this.showAllVariables(editor.document); // TODO: Refactor this method
                vscode.window.showInformationMessage("The 'Show All Variables' command needs to be updated for Tree-sitter analysis.");
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
                    if (/^[A-Z][A-Z0-9_]*_D$/.test(word)) { // Assuming _D is a macro suffix
                        // 获取宏定义
                        const macro = this.macroManager?.getMacro(word);
                        if (macro) {
                            return new vscode.Hover(this.macroManager.getMacroHoverContent(macro));
                        }

                        // 尝试解析宏
                        const canResolve = await this.macroManager?.canResolveMacro(word);
                        if (canResolve) {
                            return new vscode.Hover(`宏 \`${word}\` 已定义但无法获取具体值`);
                        }
                    }
                }
            })
        );
    }

    public static setLanguage(lang: Parser.Language) {
        LpcLanguage = lang;
        console.log("LPCDiagnostics: LpcLanguage static field has been set.");
        // Note: Existing instances won't get this updated parser automatically
        // unless they re-check the static LpcLanguage or are re-created.
    }

    private onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
        if (event.document.languageId === 'lpc') {
            if (!this.parser && LpcLanguage) { // Initialize parser if language is now available
                this.parser = new Parser();
                this.parser.setLanguage(LpcLanguage);
                console.log("LPCDiagnostics: Parser initialized on text document change because LpcLanguage was available.");
            }
            this.analyzeDocument(event.document, false);
        }
    }

    // 文件过滤函数
    private shouldCheckFile(fileName: string): boolean {
        const ext = path.extname(fileName).toLowerCase();
        return ext === '.c' || ext === '.h';
    }

    // --- Start of New AST-based methods (shells for now) ---
    private getRangeFromNode(document: vscode.TextDocument, node: Parser.SyntaxNode): vscode.Range {
        // TODO: Implement actual logic
        return new vscode.Range(document.positionAt(node.startIndex), document.positionAt(node.endIndex));
    }

    private isActualVariableUsage(usageNode: Parser.SyntaxNode): boolean {
        // TODO: Implement actual logic
        // Placeholder:
        const parent = usageNode.parent;
        if (!parent) return true;
        if ((parent.type === '_variable_declarator' && parent.childForFieldName('name') === usageNode) ||
            (parent.type === 'parameter_declaration' && parent.childForFieldName('name') === usageNode)) {
            return false;
        }
        if (parent.type === 'function_definition' && parent.childForFieldName('name') === usageNode) {
            return false;
        }
        if (parent.type === 'call_expression' && parent.childForFieldName('function') === usageNode) {
            return false;
        }
        return true;
    }

    private collectAstBasedUnusedVariableDiagnostics(document: vscode.TextDocument, tree: Parser.Tree): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        if (!LpcLanguage || !this.parser) {
            console.warn("LPCDiagnostics: Parser or Language not ready for AST analysis for document: " + document.uri.fsPath);
            return diagnostics;
        }

        console.log(`LPCDiagnostics: Starting AST-based unused variable analysis for ${document.uri.fsPath}`);

        // Map: scopeId (node.id of function_definition or rootNode) -> Map<varName, {declNode: SyntaxNode, used: boolean, isParam: boolean}>
        const scopes = new Map<number, Map<string, { declNode: Parser.SyntaxNode, used: boolean, isParam: boolean }>>();

        const getNodeText = (node: Parser.SyntaxNode) => document.getText(this.getRangeFromNode(document, node));

        try {
            // --- 1. Collect all declarations ---
            const rootScopeId = tree.rootNode.id;
            scopes.set(rootScopeId, new Map()); // For global variables

            // Collect global variable declarations
            const globalVarQuery = LpcLanguage.query(variableQueriesSource.declarations);
            for (const topLevelNode of tree.rootNode.namedChildren) {
                if (topLevelNode.type === 'variable_declaration') {
                    const captures = globalVarQuery.captures(topLevelNode);
                    for (const capture of captures) {
                        if (capture.name === 'variable.name') {
                            const varName = getNodeText(capture.node);
                            if (!this.excludedIdentifiers.has(varName)) {
                                scopes.get(rootScopeId)!.set(varName, { declNode: capture.node, used: false, isParam: false });
                                // console.log(`Collected global var: ${varName}`);
                            }
                        }
                    }
                }
            }

            // Collect function parameters and local variables
            const functionQuery = LpcLanguage.query(variableQueriesSource.function_definitions);
            const functionMatches = functionQuery.matches(tree.rootNode);

            for (const funcMatch of functionMatches) {
                const functionNodeCapture = funcMatch.captures.find(c => c.name === 'function.definition');
                const functionNode = functionNodeCapture?.node;
                if (!functionNode) continue;

                const functionScopeId = functionNode.id;
                scopes.set(functionScopeId, new Map());

                // const funcNameNode = funcMatch.captures.find(c => c.name === 'function.name')?.node;
                // const funcNameStr = funcNameNode ? getNodeText(funcNameNode) : "anonymous_fn";

                // Collect parameters
                const paramDeclQuery = LpcLanguage.query(variableQueriesSource.declarations);
                const paramListNodes = functionNode.children.filter((c: Parser.SyntaxNode) => c.type === 'parameter_list');
                for (const paramListNode of paramListNodes) {
                     paramListNode.descendantsOfType('parameter_declaration').forEach((paramDeclNode: Parser.SyntaxNode) => {
                        const paramCaptures = paramDeclQuery.captures(paramDeclNode);
                        for (const capture of paramCaptures) {
                            if (capture.name === 'param.name') {
                                const paramName = getNodeText(capture.node);
                                if (!this.excludedIdentifiers.has(paramName)) {
                                    scopes.get(functionScopeId)!.set(paramName, { declNode: capture.node, used: false, isParam: true });
                                    // console.log(`Collected param: ${paramName} in ${funcNameStr}`);
                                }
                            }
                        }
                    });
                }

                // Collect local variables within the function body
                const functionBodyNode = funcMatch.captures.find(c => c.name === 'function.body')?.node;
                if (functionBodyNode) {
                    const localVarQuery = LpcLanguage.query(variableQueriesSource.declarations);
                    functionBodyNode.descendantsOfType('variable_declaration').forEach(varDeclNode => {
                        const localVarCaptures = localVarQuery.captures(varDeclNode);
                        for (const capture of localVarCaptures) {
                             if (capture.name === 'variable.name') {
                                const varName = getNodeText(capture.node);
                                if (!this.excludedIdentifiers.has(varName)) {
                                     // Ensure it's not already declared as a param (shadowing)
                                    if (!scopes.get(functionScopeId)!.has(varName)) {
                                        scopes.get(functionScopeId)!.set(varName, { declNode: capture.node, used: false, isParam: false });
                                        // console.log(`Collected local var: ${varName} in ${funcNameStr}`);
                                    }
                                }
                            }
                        }
                    });
                }
            }

            // --- 2. Mark used variables ---
            const usageQuery = LpcLanguage.query(variableQueriesSource.usages);
            const allUsageCaptures = usageQuery.captures(tree.rootNode);

            for (const usageCapture of allUsageCaptures) {
                if (usageCapture.name === 'identifier.usage') {
                    const usageName = getNodeText(usageCapture.node);
                    const usageNode = usageCapture.node;

                    if (!this.isActualVariableUsage(usageNode)) continue;

                    // Determine scope of usage
                    let currentScopeNode: Parser.SyntaxNode | null = usageNode;
                    let owningFunctionNode: Parser.SyntaxNode | null = null;
                    while(currentScopeNode) {
                        if (currentScopeNode.type === 'function_definition') {
                            owningFunctionNode = currentScopeNode;
                            break;
                        }
                        if (!currentScopeNode.parent) break;
                        currentScopeNode = currentScopeNode.parent;
                    }

                    const usageScopeId = owningFunctionNode ? owningFunctionNode.id : rootScopeId;

                    // Check if used in its own scope (local or param)
                    const localScopeVars = scopes.get(usageScopeId);
                    if (localScopeVars && localScopeVars.has(usageName)) {
                        localScopeVars.get(usageName)!.used = true;
                        // console.log(`Marked used (local/param): ${usageName} in scope ${usageScopeId}`);
                    } else if (!owningFunctionNode) { // If usage is global and var is global
                         const globalScopeVars = scopes.get(rootScopeId);
                         if (globalScopeVars && globalScopeVars.has(usageName)) {
                            globalScopeVars.get(usageName)!.used = true;
                            // console.log(`Marked used (global from global): ${usageName}`);
                         }
                    } else { // Usage is in a function, but not a local/param - check globals
                        const globalScopeVars = scopes.get(rootScopeId);
                        if (globalScopeVars && globalScopeVars.has(usageName)) {
                           globalScopeVars.get(usageName)!.used = true;
                           // console.log(`Marked used (global from function ${owningFunctionNode?.id}): ${usageName}`);
                        }
                    }
                }
            }

            // --- 3. Generate diagnostics for unused variables ---
            for (const [scopeId, declarationsInScope] of scopes) {
                for (const [varName, { declNode, used, isParam }] of declarationsInScope) {
                    if (!used) {
                        let messageType = "";
                        let diagnosticCode = "";
                        if (scopeId === rootScopeId) { // Global
                            messageType = "全局变量";
                            diagnosticCode = "unusedGlobalVar";
                        } else { // Function scope
                            messageType = isParam ? "参数" : "局部变量";
                            diagnosticCode = isParam ? "unusedParameter" : "unusedLocalVar";
                        }
                        diagnostics.push(this.createDiagnostic(
                            this.getRangeFromNode(document, declNode),
                            `未使用的${messageType}: '${varName}'`,
                            vscode.DiagnosticSeverity.Warning,
                            diagnosticCode
                        ));
                        console.log(`Reported unused ${messageType}: ${varName}`);
                    }
                }
            }
            console.log(`LPCDiagnostics: Finished AST-based unused variable analysis for ${document.uri.fsPath}. Found ${diagnostics.length} unused variables.`);

        } catch (e: any) {
            console.error(`Error during AST-based unused variable analysis for ${document.uri.fsPath}:`, e.message, e.stack);
        }

        return diagnostics;
    }
    // --- End of New AST-based methods ---

    private collectDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 收集所有诊断信息
        this.collectObjectAccessDiagnostics(text, diagnostics, document);
        this.collectStringLiteralDiagnostics(text, diagnostics, document);
        // this.collectVariableUsageDiagnostics(text, diagnostics, document); // To be replaced
        if (this.parser && LpcLanguage) {
            const tree = this.parser.parse(text); // Parse once
            try {
                diagnostics.push(...this.collectAstBasedUnusedVariableDiagnostics(document, tree));
                // Call the new variable definition order checker
                collectVariableDefinitionOrderDiagnostics(tree.rootNode, document, diagnostics, LpcLanguage);
            } catch (e: any) {
                console.error(`Error during AST diagnostics: ${document.uri.fsPath}`, e.message, e.stack);
            }
        } else {
             console.warn(`LPCDiagnostics: Parser not ready for ${document.uri.fsPath}. Skipping AST-based checks.`);
        }
        this.collectFileNamingDiagnostics(document, diagnostics);

        return diagnostics;
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

    private async checkMacroUsage(
        object: string,
        startPos: number,
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ): Promise<void> {
        this.macroManager?.refreshMacros();
        const macro = this.macroManager?.getMacro(object);
        const canResolveMacro = await this.macroManager?.canResolveMacro(object);

        if (macro) {
            diagnostics.push(this.createDiagnostic(
                this.getRange(document, startPos, object.length),
                `宏 '${object}' 的值为: ${macro.value}`,
                vscode.DiagnosticSeverity.Information
            ));
        } else if (!canResolveMacro) {
            diagnostics.push(this.createDiagnostic(
                this.getRange(document, startPos, object.length),
                `'${object}' 符合宏命名规范但未定义为宏`,
                vscode.DiagnosticSeverity.Warning
            ));
        }
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

        const diagnostics = this.collectDiagnostics(document);
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
            type: string,
            isDeclarationWithAssign: boolean
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

        const processedForeachVars = new Set<string>();

        // Find and analyze foreach loops first
        const foreachRegex = /\bforeach\s*\(([^)]+)\)\s*\{/g; // Captures header and start of body
        let foreachMatch;
        while ((foreachMatch = foreachRegex.exec(block.content)) !== null) {
            const foreachHeaderString = foreachMatch[1]; // Full string inside foreach(...), e.g., "string k, v in m"
            const loopBodyStartIndex = foreachMatch.index + foreachMatch[0].length; // Index of char after "{"
            const loopBodyContent = this.extractBlockContent(block.content, loopBodyStartIndex - 1); // Pass index of "{"

            if (loopBodyContent === null) continue;

            const iterVars: ForeachIterVariable[] = this.parseForeachHeader(foreachHeaderString);
            
            // 检查是否是mapping迭代 (有两个变量且第一个是key)
            const isMappingIteration = iterVars.length === 2 && 
                                      iterVars[0].role === "key" && 
                                      iterVars[1].role === "value";

            for (const iterVar of iterVars) {
                const varName = iterVar.name;
                
                // 对于mapping迭代中的key变量，即使未使用也不要警告
                if (isMappingIteration && iterVar.role === "key") {
                    processedForeachVars.add(varName);
                    continue;
                }
                
                // Find the precise start index of varName within the foreachHeaderString for accurate diagnostic range
                const varNameRegex = new RegExp(`\\b(${varName})\\b`);
                const nameMatchInHeader = varNameRegex.exec(foreachHeaderString);
                
                if (!nameMatchInHeader) continue; // Should be found if parseForeachHeader worked
                
                const varNameOffsetInHeader = nameMatchInHeader.index;

                // Calculate global offset for the diagnostic
                const varStartOffset = block.start + foreachMatch.index + "foreach(".length + varNameOffsetInHeader;
                const varRange = new vscode.Range(
                    document.positionAt(varStartOffset),
                    document.positionAt(varStartOffset + varName.length)
                );

                const isUsed = this.checkVariableUsage(varName, loopBodyContent);
                if (!isUsed) {
                    const diagnostic = new vscode.Diagnostic(
                        varRange,
                        `未使用的 foreach 迭代变量: '${varName}'`,
                        vscode.DiagnosticSeverity.Warning
                    );
                    diagnostic.code = 'unusedForeachVar';
                    diagnostics.push(diagnostic);
                }
                // Add to processed set to avoid re-checking if they happen to be also declared vars (though less common for iter vars)
                processedForeachVars.add(varName); 
            }
        }

        // Check normal variable usage, skipping those already processed as foreach iteration variables
        for (const [varName, info] of localVars) {
            if (processedForeachVars.has(varName)) {
                continue;
            }

            const afterDeclaration = block.content.slice(info.declarationIndex + varName.length);
            const varType = info.type;

            const assignRegex = new RegExp(`\\b${varName}\\s*=\\s*(.*?);`, 'g');
            let assignMatch;
            while ((assignMatch = assignRegex.exec(afterDeclaration)) !== null) {
                const expression = assignMatch[1];
                const inferredType = this.inferExpressionType(expression);
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

            const isUsed = info.isDeclarationWithAssign ? 
                this.checkActualUsage(varName, afterDeclaration) :
                this.checkActualUsageIncludingAssignment(varName, afterDeclaration);

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

    /**
     * Extracts the content of a block enclosed by braces {}.
     * @param text The text containing the block.
     * @param startIndex The index of the opening brace '{'.
     * @returns The content of the block (excluding braces), or null if not found.
     */
    private extractBlockContent(text: string, startIndex: number): string | null {
        if (text[startIndex] !== '{') {
            return null;
        }

        let braceDepth = 1;
        for (let i = startIndex + 1; i < text.length; i++) {
            if (text[i] === '{') {
                braceDepth++;
            } else if (text[i] === '}') {
                braceDepth--;
                if (braceDepth === 0) {
                    return text.substring(startIndex + 1, i);
                }
            }
        }
        return null; // Unmatched brace
    }

    /**
     * Parses the header of a foreach loop to extract iteration variables.
     * E.g., "key, val in mapping" -> [{name: "key", role: "key"}, {name: "val", role: "value"}]
     * E.g., "item in array" -> [{name: "item", role: "item"}]
     * @param headerString The content inside foreach(...), e.g., "string k, string v in m".
     * @returns An array of objects containing iteration variable names and roles.
     */
    private parseForeachHeader(headerString: string): ForeachIterVariable[] {
        const result: ForeachIterVariable[] = [];
        const inKeyword = " in ";
        const inIndex = headerString.lastIndexOf(inKeyword); // Use lastIndexOf to correctly handle "in" in var names if possible (though unlikely for iter vars)

        if (inIndex === -1) return result;

        const iterVarDeclarations = headerString.substring(0, inIndex).trim();
        const collectionName = headerString.substring(inIndex + inKeyword.length).trim(); // Now used for detecting mapping iteration

        if (!iterVarDeclarations) return result;

        const vars = iterVarDeclarations.split(',').map(vDecl => {
            const trimmedDecl = vDecl.trim();
            // Extract the last word, which should be the variable name (e.g., "string foo" -> "foo")
            const nameMatch = trimmedDecl.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
            const varName = nameMatch ? nameMatch[0] : "";
            return { name: varName };
        }).filter(v => v.name.length > 0 && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.name)); // Ensure it's a valid C-like identifier

        // Determine variable roles based on count and pattern
        if (vars.length === 1) {
            // Single variable is always an array item or the only mapping value if used alone
            result.push({ name: vars[0].name, role: "item" });
        } else if (vars.length === 2) {
            // Two variables indicate a key-value pair for mapping iteration
            result.push({ name: vars[0].name, role: "key" });
            result.push({ name: vars[1].name, role: "value" });
        } else {
            // For any other case, just use generic role
            vars.forEach(v => result.push({ name: v.name, role: "unknown" }));
        }

        return result;
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

    private checkVariableInCode( // This helper function seems unused now, can be removed if checkVariableUsage is refactored.
        varName: string,
        code: string,
        patterns: { pattern: RegExp, description: string }[]
    ): { isUsed: boolean, usageType?: string } {
        for (const { pattern, description } of patterns) {
            pattern.lastIndex = 0; // Reset lastIndex for global regexes
            if (pattern.test(code)) {
                return { isUsed: true, usageType: description };
            }
        }
        return { isUsed: false };
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

    // checkActualUsage is for variables declared WITH an assignment.
    // It needs to check if the variable is *read* after its declaration.
    // It can now directly use checkVariableUsage, as checkVariableUsage
    // is designed to find "read" operations (not just assignments to the variable).
    private checkActualUsage(varName: string, code: string): boolean {
        return this.checkVariableUsage(varName, code);
    }

    private checkActualUsageIncludingAssignment(varName: string, code: string): boolean {
        // A variable is considered "used" if it's read from or its address is taken (like in sscanf),
        // or it's part of a compound assignment (like x += 1).
        // Simple assignment TO the variable (e.g., x = 5) doesn't make it "used" in terms of its prior value.
        // Its subsequent use (reading the assigned value) makes it used.
        // This function now relies entirely on checkVariableUsage to determine if a meaningful "read" or "by-reference modification" occurs.
        return this.checkVariableUsage(varName, code);
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
            const funcName = expression.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1] || '';
            
            // 检查是否是常见的 efun
            const efunReturnTypes: { [key: string]: string } = {
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
    private areTypesCompatible(varType: string, inferredType: string): boolean {
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

    private collectVariableUsageDiagnostics(
        text: string,
        diagnostics: vscode.Diagnostic[],
        document: vscode.TextDocument
    ): void {
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