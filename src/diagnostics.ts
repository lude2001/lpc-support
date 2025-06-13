import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroManager } from './macroManager';
import Parser from 'web-tree-sitter'; // Import Tree-sitter
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
    private lpcTypes: string;
    private modifiers: string;
    private excludedIdentifiers: Set<string>;
    // variableDeclarationRegex REMOVED
    // globalVariableRegex REMOVED
    // functionDeclRegex REMOVED
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

        // Regexes variableDeclarationRegex, globalVariableRegex, functionDeclRegex were removed.

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
        const parent = usageNode.parent;
        if (!parent) return true;

        const nodeType = parent.type;
        const fieldName = usageNode.fieldName();

        // Rule: Identifier is the name field of a _variable_declarator.
        if (nodeType === '_variable_declarator' && fieldName === 'name') {
            return false;
        }

        // Rule: Identifier is the name field of a parameter_declaration.
        if (nodeType === 'parameter_declaration' && fieldName === 'name') {
            return false;
        }

        // Rule: Identifier is the name field of a function_definition.
        if (nodeType === 'function_definition' && fieldName === 'name') {
            return false;
        }

        // Rule: Identifier is the name field of an inherit_statement's path (if identifier).
        if (nodeType === 'inherit_statement' && fieldName === 'path' && usageNode.type === 'identifier') {
            return false;
        }

        // Rule: Identifier is the name field of a preproc_define.
        if (nodeType === 'preproc_define' && fieldName === 'name') {
            return false;
        }

        // Rule: Identifier is the member field of a member_access_expression.
        if (nodeType === 'member_access_expression' && fieldName === 'member') {
            return false;
        }

        // Rule: Identifier is the function field of a call_expression (direct child).
        if (nodeType === 'call_expression' && parent.childForFieldName('function') === usageNode && usageNode.type === 'identifier') {
            return false;
        }

        // Rule: Identifier is a variable in a foreach statement.
        if (nodeType === 'foreach_variables' && fieldName === 'variable') {
             return false;
        }

        // Rule: Identifier is part of a preprocessor directive that isn't a macro expansion.
        // This is partially covered by preproc_define. Other preproc directives like #ifdef IDENTIFIER
        // would have the IDENTIFIER as a direct child of a node like 'preproc_ifdef'.
        // We assume these are not "variable usages" in the typical sense.
        if (parent.type.startsWith('preproc_') && parent.type !== 'preproc_macro_value') {
            // Check if it's one of the main identifiers for these directives, not an identifier *within* an expression
            // of a #if or #elif, which should be considered a usage.
            if (parent.type === 'preproc_ifdef' || parent.type === 'preproc_ifndef') {
                 // For #ifdef FOO, FOO is usageNode.parent.lastChild (or similar, depends on grammar)
                 // and its fieldName might be null or specific.
                 // A more robust check might be needed if the grammar is complex here.
                 // For now, if it's a child of these, and not in a more specific rule, assume not a usage.
                 // This heuristic might need refinement.
                if (usageNode.previousSibling?.text === '#ifdef' || usageNode.previousSibling?.text === '#ifndef') {
                    return false;
                }
            }
        }

        // Default: If none of the above, it's an actual usage.
        return true;
    }

    /**
     * Collects diagnostics for unused variables using Abstract Syntax Tree (AST) analysis.
     * This method implements a three-pass strategy:
     * 1. Collect Declarations: It traverses the AST to find all variable declarations,
     *    including global variables, function parameters, and local variables within functions.
     *    These are stored in a `scopes` map, where each key is a scope identifier (root node ID
     *    for globals, function definition node ID for function scopes) and the value is another
     *    map of variable names to their declaration nodes and usage status.
     *    The `node.id` provides a unique identifier for each node, suitable for scoping.
     * 2. Mark Usages: It then re-traverses the AST to find all identifier usages. For each usage,
     *    it determines if it's an "actual variable usage" (not a declaration, function name, etc.)
     *    using `this.isActualVariableUsage()`. If it is an actual usage, it resolves the scope
     *    of the usage (current function or global) and marks the corresponding variable in the
     *    `scopes` map as used. The resolution logic checks the current function's scope first;
     *    if not found, it checks the global scope.
     * 3. Report Unused: Finally, it iterates through the `scopes` map. Any variable that was
     *    collected in the first pass but not marked as used in the second pass is reported as
     *    an unused variable diagnostic.
     *
     * Shadowing of parameters by local variables with the same name is handled by prioritizing
     * parameters during collection; if a local variable has the same name as a parameter in the
     * same function, the local variable declaration is not added to the scope map for unused
     * checking (the parameter takes precedence as it's already in `scopes.get(functionScopeId)`).
     */
    private collectAstBasedUnusedVariableDiagnostics(document: vscode.TextDocument, tree: Parser.Tree): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        // Ensure parser and language are available before proceeding.
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
        // Old collectVariableUsageDiagnostics call REMOVED
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

    // Methods from findInherits down to collectVariableUsageDiagnostics (and its helpers) are removed.
    // Kept methods: constructor, setLanguage, onDidChangeTextDocument, shouldCheckFile,
    // getRangeFromNode, isActualVariableUsage (placeholder), collectAstBasedUnusedVariableDiagnostics,
    // collectDiagnostics, collectObjectAccessDiagnostics, checkMacroUsage, checkFunctionCall,
    // collectStringLiteralDiagnostics, collectFileNamingDiagnostics, analyzeDocument, dispose,
    // createDiagnostic, getRange.
    // Also kept scanFolder, findLPCFiles, analyzeObjectAccess, analyzeObjectAccessChunk, analyzeStringLiterals
    // as they are separate utility functions.

    public dispose() {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
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
                            this.analyzeDocument(document, false); // This will call collectDiagnostics

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
        const ignoreDirs = ['node_modules', '.git', '.vscode'];

        async function walk(dir: string) {
            let entries;
            try {
                entries = await fs.promises.readdir(dir, { withFileTypes: true });
            } catch (error) {
                console.error(`无法读取目录 ${dir}:`, error);
                return;
            }
            const directories: string[] = [];
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!ignoreDirs.includes(entry.name)) {
                        directories.push(fullPath);
                    }
                } else if (entry.isFile() && fileExtensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
            if (directories.length > 0) {
                await Promise.all(directories.map(walk));
            }
        }
        await walk(folderPath);
        return files;
    }

    private async analyzeObjectAccess(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const chunkSize = 50000;
        if (text.length > chunkSize) {
            const chunks = Math.ceil(text.length / chunkSize);
            for (let i = 0; i < chunks; i++) {
                const start = i * chunkSize;
                const end = Math.min((i + 1) * chunkSize, text.length);
                const chunk = text.slice(start, end);
                await this.analyzeObjectAccessChunk(chunk, start, diagnostics, document);
            }
        } else {
            await this.analyzeObjectAccessChunk(text, 0, diagnostics, document);
        }
    }

    private async analyzeObjectAccessChunk(text: string, offset: number, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const objectAccessRegex = this.objectAccessRegex; // Should be this.objectAccessRegex
        objectAccessRegex.lastIndex = 0;
        const matches: Array<{match: RegExpExecArray, startPos: number}> = [];
        let match: RegExpExecArray | null;
        while ((match = objectAccessRegex.exec(text)) !== null) {
            const startPos = match.index + offset;
            matches.push({match, startPos});
        }
        const batchSize = 50;
        for (let i = 0; i < matches.length; i += batchSize) {
            const batch = matches.slice(i, i + batchSize);
            for (const {match, startPos} of batch) {
                const object = match[1];
                // const accessor = match[2]; // accessor seems unused
                // const func = match[3]; // func seems unused
                const isCall = match[4] !== undefined;
                if (this.macroDefRegex.test(object)) { // Should be this.macroDefRegex
                    await this.checkMacroUsage(object, startPos, document, diagnostics);
                }
                if (isCall && match[2] === '->') { // use match[2] for accessor
                    this.checkFunctionCall(
                        text,
                        startPos + match[0].indexOf(match[3]), // use match[3] for func
                        startPos + match[0].length,
                        document,
                        diagnostics
                    );
                }
            }
            if (i + batchSize < matches.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    private analyzeStringLiterals(text: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;
        let match;
        while ((match = multilineStringRegex.exec(text)) !== null) {
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
}