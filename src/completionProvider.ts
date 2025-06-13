import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';
import { MacroManager } from './macroManager';
import * as Parser from 'web-tree-sitter';

// Module-level variable to hold the loaded language
let LpcLanguage: Parser.Language | undefined = undefined;

// Tree-sitter Queries
const FUNCTION_DEFINITION_QUERY_COMPLETION = `
(function_definition
  name: (identifier) @function.name
  parameters: (parameter_list)? @function.parameters
  return_type: (_type)? @function.return_type
) @function.definition
`;

const VARIABLE_DECLARATION_QUERY_COMPLETION = `
(variable_declaration
  (_variable_declarator
    name: (identifier) @variable.name
    initializer: (initializer_expression)? @variable.initializer
  ) @variable.declarator
  type: (_type) @variable.type
) @variable.declaration
`;

const PARAMETER_DECLARATION_QUERY_COMPLETION = `
(parameter_declaration
  name: (identifier) @parameter.name
  type: (_type) @parameter.type
) @parameter.declaration
`;

// 创建输出通道
const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider {
    private types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer'];
    private modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs'];
    private efunDocsManager: EfunDocsManager;
    private macroManager: MacroManager;
    private functionCache: Map<string, vscode.CompletionItem[]> = new Map();
    private variableCache: Map<string, vscode.CompletionItem[]> = new Map();
    private filePathCache: Map<string, string> = new Map();
    private parser?: Parser;

    constructor(efunDocsManager: EfunDocsManager, macroManager: MacroManager) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        if (LpcLanguage) {
            this.parser = new Parser();
            this.parser.setLanguage(LpcLanguage);
            console.log("LPCCompletionProvider: Parser initialized in constructor.");
        } else {
            console.warn("LPCCompletionProvider: LpcLanguage not available at construction. Parser will be initialized on demand or when language is set.");
        }
    }

    public static setLanguage(lang: Parser.Language) {
        LpcLanguage = lang;
        console.log("LPCCompletionProvider: LpcLanguage static field has been set.");
    }

    // 清除变量缓存的公共方法
    public clearVariableCache(): void {
        this.variableCache.clear();
    }

    // Helper to get text of a node
    private _getNodeText(node: Parser.SyntaxNode, document: vscode.TextDocument): string {
        return document.getText(new vscode.Range(
            document.positionAt(node.startIndex),
            document.positionAt(node.endIndex)
        ));
    }

    // Helper to convert AST node to CompletionItem for functions
    private _functionNodeToCompletionItem(node: Parser.SyntaxNode, query: Parser.Query, document: vscode.TextDocument, source: string = "当前文件"): vscode.CompletionItem | null {
        const captures = query.captures(node);
        const funcNameNode = captures.find(c => c.name === 'function.name')?.node;
        const paramsNode = captures.find(c => c.name === 'function.parameters')?.node;
        const returnTypeNode = captures.find(c => c.name === 'function.return_type')?.node;

        if (!funcNameNode) return null;

        const funcName = this._getNodeText(funcNameNode, document);
        const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);

        let paramText = "()";
        if (paramsNode) {
            // Attempt to get clean parameter text, might need refinement based on grammar structure
            paramText = `(${paramsNode.children.filter(c => c.type !== ',' && c.type !== '(' && c.type !== ')').map(p => this._getNodeText(p,document)).join(', ')})`;
            if (paramText === "()") { // If only parens, make it look like no args for snippet
                 const paramNames = paramsNode.children.filter(c => c.type === 'parameter_declaration').map(pd => pd.childForFieldName('name')?.text).filter(n=>n);
                 if(paramNames.length > 0) {
                    paramText = `(${paramNames.join(', ')})`;
                 }
            }
        }

        let detail = "";
        if(returnTypeNode) detail += `${this._getNodeText(returnTypeNode, document)} `;
        detail += `${funcName}${paramText}`;
        item.detail = `${source}: ${detail}`;

        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(detail, 'lpc');
        item.documentation = markdown;

        // Create snippet with parameters
        let snippetParams = "";
        if (paramsNode) {
            const paramDeclarations = paramsNode.children.filter(c => c.type === 'parameter_declaration');
            snippetParams = paramDeclarations.map((pd, i) => {
                const nameNode = pd.childForFieldName('name');
                return `\${${i+1}:${nameNode ? this._getNodeText(nameNode, document) : 'arg'+(i+1)}}`;
            }).join(", ");
        }
        item.insertText = new vscode.SnippetString(`${funcName}(${snippetParams})`);
        return item;
    }

    // Helper to convert AST node to CompletionItem for variables/parameters
    private _variableNodeToCompletionItem(varNameNode: Parser.SyntaxNode, typeNode: Parser.SyntaxNode | undefined, document: vscode.TextDocument, kind: vscode.CompletionItemKind, detailPrefix: string): vscode.CompletionItem {
        const varName = this._getNodeText(varNameNode, document);
        const item = new vscode.CompletionItem(varName, kind);
        let typeText = typeNode ? this._getNodeText(typeNode, document) : "mixed";
        item.detail = `${detailPrefix}: ${typeText} ${varName}`;

        const markdown = new vscode.MarkdownString();
        markdown.appendCodeblock(`${typeText} ${varName};`, 'lpc');
        item.documentation = markdown;
        item.insertText = varName; // Plain text for variable names
        return item;
    }

    private _addAstLocalFunctionCompletions(tree: Parser.Tree, document: vscode.TextDocument, completionItems: vscode.CompletionItem[]): void {
        if (!LpcLanguage || !this.parser) return;
        // console.log("AST: Adding local function completions");
        try {
            const query = LpcLanguage.query(FUNCTION_DEFINITION_QUERY_COMPLETION);
            const matches = query.matches(tree.rootNode);
            for (const match of matches) {
                 const funcDefNode = match.captures.find(c => c.name === 'function.definition')?.node;
                 if (funcDefNode) { // Check if funcDefNode is found
                    const item = this._functionNodeToCompletionItem(funcDefNode, query, document, "当前文件");
                    if (item) {
                        // Check if an item with the same name already exists from regex-based inherited functions
                        // This is a simple way to avoid duplicates if parseInheritedFunctions (regex) runs first.
                        // A more robust solution would be to clearly separate or prioritize AST results.
                        if (!completionItems.some(ci => ci.label === item.label && ci.kind === vscode.CompletionItemKind.Function)) {
                            completionItems.push(item);
                        }
                    }
                 }
            }
        } catch (e: any) {
            console.error("Error querying local functions from AST:", e.message, e.stack);
        }
    }

    private _addAstScopedVariableCompletions(tree: Parser.Tree, document: vscode.TextDocument, position: vscode.Position, completionItems: vscode.CompletionItem[]): void {
        if (!LpcLanguage || !this.parser) return;
        // console.log("AST: Adding scoped variable completions");

        const offset = document.offsetAt(position);
        let currentNode = tree.rootNode.descendantForOffset(offset);

        // Find enclosing function definition for parameters and local variables
        let enclosingFunctionNode: Parser.SyntaxNode | null = currentNode;
        while (enclosingFunctionNode && enclosingFunctionNode.type !== 'function_definition') {
            enclosingFunctionNode = enclosingFunctionNode.parent;
        }

        if (enclosingFunctionNode) {
            // Add Parameters from the enclosing function
            try {
                const paramQuery = LpcLanguage.query(PARAMETER_DECLARATION_QUERY_COMPLETION);
                // Parameters are direct children of parameter_list, which is a child of function_definition
                const paramListNodes = enclosingFunctionNode.children.filter(c => c.type === 'parameter_list');
                for (const paramListNode of paramListNodes) {
                    // const paramMatches = paramQuery.matches(paramListNode); // Query matches on the paramListNode itself
                     paramListNode.descendantsOfType('parameter_declaration').forEach(paramDeclNode => {
                        const paramCaptures = paramQuery.captures(paramDeclNode); // Use captures on each paramDeclNode
                        for (const pMatch of paramCaptures) { // Iterate captures from each paramDeclNode
                            const paramNameNode = pMatch.name === 'parameter.name' ? pMatch.node : null;
                            const paramTypeNode = pMatch.name === 'parameter.type' ? pMatch.node : null; // Assuming type is also captured, adjust query if not

                            // A bit convoluted due to captures structure, ensure we get name and type for *this* parameter
                            if (paramNameNode) {
                                let actualTypeNode : Parser.SyntaxNode | undefined = paramTypeNode;
                                if(!actualTypeNode) { // If type wasn't captured with name, find it on the same declaration node
                                    const siblingCaptures = paramQuery.captures(paramDeclNode);
                                    actualTypeNode = siblingCaptures.find(c => c.name === 'parameter.type')?.node;
                                }
                                completionItems.push(this._variableNodeToCompletionItem(paramNameNode, actualTypeNode, document, vscode.CompletionItemKind.Variable, "参数"));
                            }
                        }
                    });
                }
            } catch (e: any) { console.error("Error querying parameters from AST:", e.message, e.stack); }

            // Add Local Variables (declared before current position within the current function's blocks)
            try {
                const varQuery = LpcLanguage.query(VARIABLE_DECLARATION_QUERY_COMPLETION);
                // Iterate upwards from current position to find relevant blocks within the function
                let blockScopeNode: Parser.SyntaxNode | null = currentNode; // Start from current node
                while(blockScopeNode && blockScopeNode !== enclosingFunctionNode.parent) { // Stop if we go above the function
                    if (blockScopeNode.type === 'block_statement' && blockScopeNode.startIndex < offset) {
                         blockScopeNode.children.filter(c => c.type === 'variable_declaration' && c.endIndex < offset).forEach(varDeclNode => {
                            // const varMatches = varQuery.matches(varDeclNode); // Query matches on the varDeclNode
                            const varCaptures = varQuery.captures(varDeclNode); // Use captures
                            for (const vMatch of varCaptures) { // Iterate captures
                                const varNameNode = vMatch.name === 'variable.name' ? vMatch.node : null;
                                const varTypeNode = vMatch.name === 'variable.type' ? vMatch.node : null;

                                if (varNameNode) {
                                     let actualTypeNode : Parser.SyntaxNode | undefined = varTypeNode;
                                     if(!actualTypeNode) {
                                         const siblingCaptures = varQuery.captures(varDeclNode);
                                         actualTypeNode = siblingCaptures.find(c => c.name === 'variable.type')?.node;
                                     }
                                     completionItems.push(this._variableNodeToCompletionItem(varNameNode, actualTypeNode, document, vscode.CompletionItemKind.Variable, "局部变量"));
                                }
                            }
                        });
                    }
                    blockScopeNode = blockScopeNode.parent;
                }
            } catch (e: any) { console.error("Error querying local variables from AST:", e.message, e.stack); }
        }
        // Global variable completions could be added here by querying tree.rootNode for variable_declarations
        // that are direct children of source_file, but for this subtask, we focus on local/param.
    }

    private _addAstGlobalVariableCompletions(tree: Parser.Tree, document: vscode.TextDocument, completionItems: vscode.CompletionItem[]): void {
        if (!LpcLanguage || !this.parser) return;
        // console.log("AST: Adding global variable completions");
        try {
            const query = LpcLanguage.query(VARIABLE_DECLARATION_QUERY_COMPLETION);
            // Global variables are direct children of the source_file (root node)
            for (const topLevelNode of tree.rootNode.namedChildren) {
                if (topLevelNode.type === 'variable_declaration') {
                    const captures = query.captures(topLevelNode);
                    // Need to find the name and type from the captures of this specific declaration
                    let varNameNode: Parser.SyntaxNode | undefined;
                    let varTypeNode: Parser.SyntaxNode | undefined;

                    for (const capture of captures) {
                        if (capture.name === 'variable.name') {
                            varNameNode = capture.node;
                        } else if (capture.name === 'variable.type') {
                            varTypeNode = capture.node;
                        }
                    }

                    if (varNameNode) {
                        if (!this.excludedIdentifiers.has(this._getNodeText(varNameNode, document))) {
                             completionItems.push(this._variableNodeToCompletionItem(varNameNode, varTypeNode, document, vscode.CompletionItemKind.Variable, "全局变量"));
                        }
                    }
                }
            }
        } catch (e: any) {
            console.error("Error querying global variables from AST:", e.message, e.stack);
        }
    }


    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        if (!this.parser && LpcLanguage) { // Initialize parser if needed (e.g. if setLanguage was called after constructor)
            this.parser = new Parser();
            this.parser.setLanguage(LpcLanguage);
            console.log("LPCCompletionProvider: Parser initialized on-demand in provideCompletionItems.");
        }

        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems: vscode.CompletionItem[] = [];

        if (this.parser && LpcLanguage) {
            // console.log("LPCCompletionProvider: Using AST-based completions for current file funcs/vars.");
            const tree = this.parser.parse(document.getText());
            this._addAstLocalFunctionCompletions(tree, document, completionItems);
            this._addAstScopedVariableCompletions(tree, document, position, completionItems);
            this._addAstGlobalVariableCompletions(tree, document, completionItems); // Add this call

            // For inherited functions, the existing regex-based method is still used.
            // Note: parseInheritedFunctions internally calls the regex version of parseFunctionsInFileRegex
            await this.parseInheritedFunctions(document, completionItems, false);
        } else {
            console.warn("LPCCompletionProvider: Parser not available. Falling back to regex for local funcs/vars.");
            // Fallback to old regex methods if parser isn't ready
            await this.addLocalFunctionCompletionsRegex(document, completionItems);
            this.addLocalVariableCompletionsRegex(document, position, completionItems);
        }

        // 添加类型提示
        this.types.forEach(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = `LPC 类型: ${type}`;
            completionItems.push(item);
        });

        // 添加修饰符提示
        this.modifiers.forEach(modifier => {
            const item = new vscode.CompletionItem(modifier, vscode.CompletionItemKind.Keyword);
            item.detail = `LPC 修饰符: ${modifier}`;
            completionItems.push(item);
        });

        // 添加标准函数提示
        const efunFunctions = this.efunDocsManager.getAllFunctions();
        efunFunctions.forEach(funcName => {
            const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);
            item.detail = `LPC Efun: ${funcName}`;
            item.documentation = new vscode.MarkdownString(`正在加载 ${funcName} 的文档...`);

            // 异步加载函数文档
            this.efunDocsManager.getEfunDoc(funcName).then(doc => {
                if (doc) {
                    const markdown = new vscode.MarkdownString();
                    if (doc.syntax) {
                        markdown.appendCodeblock(doc.syntax, 'lpc');
                        markdown.appendMarkdown('\n');
                    }
                    if (doc.description) {
                        markdown.appendMarkdown(doc.description);
                    }
                    item.documentation = markdown;
                }
            });

            // 添加基本的代码片段
            item.insertText = new vscode.SnippetString(`${funcName}(\${1})`);
            completionItems.push(item);
        });

        // 添加模拟函数库提示
        const simulatedFunctions = this.efunDocsManager.getAllSimulatedFunctions();
        simulatedFunctions.forEach(funcName => {
            const item = new vscode.CompletionItem(funcName, vscode.CompletionItemKind.Function);
            item.detail = `模拟函数库: ${funcName}`;
            item.documentation = new vscode.MarkdownString(`正在加载 ${funcName} 的文档...`);

            // 获取函数文档
            const doc = this.efunDocsManager.getSimulatedDoc(funcName);
            if (doc) {
                const markdown = new vscode.MarkdownString();
                if (doc.syntax) {
                    markdown.appendCodeblock(doc.syntax, 'lpc');
                    markdown.appendMarkdown('\n');
                }
                if (doc.description) {
                    markdown.appendMarkdown(doc.description);
                }
                item.documentation = markdown;
            }

            // 添加基本的代码片段
            item.insertText = new vscode.SnippetString(`${funcName}(\${1})`);
            completionItems.push(item);
        });

        // 添加特定上下文的提示
        if (linePrefix.endsWith('->')) {
            // 对象方法调用提示
            this.addObjectMethodCompletions(completionItems);
        } else if (linePrefix.match(/^\s*#/)) {
            // 预处理指令提示
            this.addPreprocessorCompletions(completionItems);
        }

        return completionItems;
    }

    // 添加一个公共方法用于手动扫描
    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        // 清除之前的输出
        inheritanceChannel.clear();
        inheritanceChannel.show(true);
        await this.parseInheritedFunctions(document, [], true);
    }

    private async addLocalFunctionCompletionsRegex(document: vscode.TextDocument, completionItems: vscode.CompletionItem[]): Promise<void> {
        // 首先添加当前文件的函数
        this.parseFunctionsInFileRegex(document, completionItems); // Renamed call
        
        // 解析继承文件，但不显示输出
        await this.parseInheritedFunctions(document, completionItems, false); // This still uses regex internally for inherited
    }

    // Renamed old regex-based method
    private addLocalVariableCompletionsRegex(document: vscode.TextDocument, position: vscode.Position, completionItems: vscode.CompletionItem[]): void {
        // 获取当前文件的变量
        const variables = this.parseVariablesInScopeRegex(document, position); // Renamed call
        completionItems.push(...variables);
    }

    // Renamed old regex-based method
    private parseVariablesInScopeRegex(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const text = document.getText();
        const lines = text.split('\n');
        const currentLine = position.line;
        const currentChar = position.character;
        const result: vscode.CompletionItem[] = [];
        
        // 缓存键
        const cacheKey = `${document.uri.toString()}_${currentLine}_${currentChar}`;
        
        // 检查缓存
        if (this.variableCache.has(cacheKey)) {
            return this.variableCache.get(cacheKey) || [];
        }
        
        // 1. 解析全局变量
        this.parseGlobalVariables(text, result);
        
        // 2. 解析当前函数内的局部变量
        this.parseLocalVariables(document, position, result);
        
        // 3. 解析函数参数
        this.parseFunctionParameters(document, position, result);
        
        // 更新缓存
        this.variableCache.set(cacheKey, result);
        
        return result;
    }
    
    // 解析全局变量
    private parseGlobalVariables(text: string, result: vscode.CompletionItem[]): void {
        // 匹配全局变量定义，确保它们在函数外部
        const lines = text.split('\n');
        let inFunction = false;
        let bracketCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 计算大括号来跟踪函数范围
            const openBrackets = (line.match(/{/g) || []).length;
            const closeBrackets = (line.match(/}/g) || []).length;
            bracketCount += openBrackets - closeBrackets;
            
            // 检查是否是函数定义行
            if (!inFunction && bracketCount > 0 && line.match(/(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*{/)) {
                inFunction = true;
                continue;
            }
            
            // 如果括号平衡，说明函数结束
            if (inFunction && bracketCount === 0) {
                inFunction = false;
            }
            
            // 只在函数外部处理全局变量
            if (!inFunction && bracketCount === 0) {
                // 匹配全局变量定义，例如: int global_var;
                const globalVarRegex = /(?:(?:private|public|protected|static|nosave)\s+)*(?:int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:=\s*[^;]+)?\s*;/;
                
                const match = line.match(globalVarRegex);
                if (match) {
                    // 处理可能的多变量声明 (int a, b, c;)
                    const varNames = match[1].split(',').map(v => v.trim());
                    const varDefinition = match[0].trim();
                    
                    for (const varName of varNames) {
                        // 创建补全项
                        const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
                        item.detail = `全局变量: ${varName}`;
                        
                        // 添加变量定义作为文档
                        const markdown = new vscode.MarkdownString();
                        markdown.appendCodeblock(varDefinition, 'lpc');
                        item.documentation = markdown;
                        
                        result.push(item);
                    }
                }
            }
        }
    }
    
    // 解析局部变量
    private parseLocalVariables(document: vscode.TextDocument, position: vscode.Position, result: vscode.CompletionItem[]): void {
        const text = document.getText();
        const lines = text.split('\n');
        const currentLine = position.line;
        
        // 找到当前函数的范围
        let startLine = 0;
        let endLine = lines.length - 1;
        let bracketCount = 0;
        let inFunction = false;
        let functionStartBracketLine = -1;
        
        // 向上查找函数开始
        for (let i = currentLine; i >= 0; i--) {
            const line = lines[i];
            
            // 计算大括号
            const openBrackets = (line.match(/{/g) || []).length;
            const closeBrackets = (line.match(/}/g) || []).length;
            
            // 更新括号计数
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '{') {
                    bracketCount++;
                    if (bracketCount === 1 && functionStartBracketLine === -1) {
                        functionStartBracketLine = i;
                    }
                } else if (line[j] === '}') {
                    bracketCount--;
                    // 如果括号计数变为0，说明我们离开了当前代码块
                    if (bracketCount === 0) {
                        inFunction = false;
                    }
                }
            }
            
            // 检查是否是函数定义行
            if (!inFunction && line.match(/(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)/)) {
                inFunction = true;
                startLine = i;
                break;
            }
        }
        
        // 如果没有找到函数，返回空结果
        if (!inFunction || functionStartBracketLine === -1) {
            return;
        }
        
        // 向下查找函数结束
        bracketCount = 1; // 从函数开始的大括号开始计数
        for (let i = functionStartBracketLine + 1; i <= endLine; i++) {
            const line = lines[i];
            
            // 逐字符计算大括号以处理同一行中的多个大括号
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '{') {
                    bracketCount++;
                } else if (line[j] === '}') {
                    bracketCount--;
                    // 如果括号计数变为0，说明函数结束
                    if (bracketCount === 0) {
                        endLine = i;
                        break;
                    }
                }
            }
            
            if (bracketCount === 0) {
                break;
            }
        }
        
        // 提取函数体内的局部变量
        let continuedLine = '';
        let inMultiLineDeclaration = false;
        
        for (let i = startLine; i < Math.min(currentLine + 1, endLine); i++) {
            let line = lines[i];
            
            // 处理多行声明
            if (inMultiLineDeclaration) {
                continuedLine += line;
                if (line.includes(';')) {
                    line = continuedLine;
                    inMultiLineDeclaration = false;
                    continuedLine = '';
                } else {
                    continue;
                }
            } else if (line.match(/(?:int|string|object|mapping|mixed|float|buffer)\s+[a-zA-Z_][a-zA-Z0-9_]*/) && !line.includes(';')) {
                inMultiLineDeclaration = true;
                continuedLine = line;
                continue;
            }
            
            // 匹配局部变量定义，例如: int local_var = 10;
            const localVarRegex = /(?:int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:=\s*[^;]+)?\s*;/;
            
            const match = line.match(localVarRegex);
            if (match) {
                // 处理可能的多变量声明 (int a, b, c;)
                const varNames = match[1].split(',').map(v => v.trim());
                const varDefinition = match[0].trim();
                
                for (const varName of varNames) {
                    // 创建补全项
                    const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
                    item.detail = `局部变量: ${varName}`;
                    
                    // 添加变量定义作为文档
                    const markdown = new vscode.MarkdownString();
                    markdown.appendCodeblock(varDefinition, 'lpc');
                    item.documentation = markdown;
                    
                    result.push(item);
                }
            }
            
            // 匹配 for 循环中的变量定义
            const forLoopVarRegex = /for\s*\(\s*(?:int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/;
            const forMatch = line.match(forLoopVarRegex);
            if (forMatch) {
                const varName = forMatch[1];
                
                // 创建补全项
                const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
                item.detail = `循环变量: ${varName}`;
                
                result.push(item);
            }
            
            // 匹配 foreach 循环中的变量定义
            const foreachVarRegex = /foreach\s*\(\s*(?:int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:/;
            const foreachMatch = line.match(foreachVarRegex);
            if (foreachMatch) {
                const varName = foreachMatch[1];
                
                // 创建补全项
                const item = new vscode.CompletionItem(varName, vscode.CompletionItemKind.Variable);
                item.detail = `循环变量: ${varName}`;
                
                result.push(item);
            }
        }
    }
    
    // 解析函数参数
    private parseFunctionParameters(document: vscode.TextDocument, position: vscode.Position, result: vscode.CompletionItem[]): void {
        const text = document.getText();
        const lines = text.split('\n');
        const currentLine = position.line;
        
        // 向上查找函数定义
        let functionStartLine = -1;
        let functionParams = '';
        let inMultiLineParams = false;
        let bracketCount = 0;
        
        for (let i = currentLine; i >= 0; i--) {
            const line = lines[i];
            
            // 如果我们已经在处理多行参数
            if (inMultiLineParams) {
                // 添加当前行到参数字符串
                functionParams = line + functionParams;
                
                // 检查是否找到了函数定义的开始
                if (line.match(/(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/)) {
                    functionStartLine = i;
                    break;
                }
                continue;
            }
            
            // 计算括号来跟踪函数定义
            for (let j = line.length - 1; j >= 0; j--) {
                const char = line[j];
                if (char === ')') {
                    bracketCount++;
                    if (bracketCount === 1 && !inMultiLineParams) {
                        // 开始收集参数
                        inMultiLineParams = true;
                        functionParams = line.substring(j);
                    }
                } else if (char === '(' && inMultiLineParams) {
                    bracketCount--;
                    if (bracketCount === 0) {
                        // 找到了完整的参数列表
                        functionStartLine = i;
                        break;
                    }
                }
            }
            
            if (functionStartLine !== -1) {
                break;
            }
            
            // 匹配单行函数定义，例如: void func(int param1, string param2)
            const funcDefRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(([^)]*)\)/;
            
            const match = line.match(funcDefRegex);
            if (match) {
                functionStartLine = i;
                functionParams = match[1];
                break;
            }
        }
        
        // 如果找到了函数定义
        if (functionStartLine !== -1 && functionParams) {
            // 提取参数部分
            const paramRegex = /\(([^)]*)\)/;
            const paramMatch = functionParams.match(paramRegex);
            
            if (paramMatch) {
                const params = paramMatch[1].split(',');
                
                // 解析每个参数
                for (const param of params) {
                    const trimmedParam = param.trim();
                    if (!trimmedParam) continue;
                    
                    // 匹配参数定义，支持各种类型
                    const paramMatch = trimmedParam.match(/(?:int|string|object|mapping|mixed|float|buffer|array)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                    if (paramMatch) {
                        const paramName = paramMatch[1];
                        
                        // 创建补全项
                        const item = new vscode.CompletionItem(paramName, vscode.CompletionItemKind.Variable);
                        item.detail = `函数参数: ${paramName}`;
                        
                        // 添加参数定义作为文档
                        const markdown = new vscode.MarkdownString();
                        markdown.appendCodeblock(trimmedParam, 'lpc');
                        item.documentation = markdown;
                        
                        result.push(item);
                    }
                }
            }
        }
    }

    private async parseInheritedFunctions(
        document: vscode.TextDocument, 
        completionItems: vscode.CompletionItem[],
        showOutput: boolean = false
    ): Promise<void> {
        const text = document.getText();
        
        if (showOutput) {
            inheritanceChannel.appendLine(`正在分析文件: ${document.fileName}`);
            inheritanceChannel.appendLine('----------------------------------------');
        }

        // 支持两种继承语法：字符串形式和宏定义形式
        const inheritRegexes = [
            /inherit\s+"([^"]+)"/g,
            /inherit\s+([A-Z_][A-Z0-9_]*)\s*;/g
        ];

        // 先处理include文件
        const includeRegex = /#include\s+["<]([^">]+)[">]/g;
        let includeMatch;
        const processedIncludes = new Set<string>();

        // 批量处理所有include
        const includeMatches: string[] = [];
        while ((includeMatch = includeRegex.exec(text)) !== null) {
            const includePath = includeMatch[1];
            if (!processedIncludes.has(includePath)) {
                processedIncludes.add(includePath);
                includeMatches.push(includePath);
            }
        }

        // 批量处理所有宏定义
        if (includeMatches.length > 0) {
            if (showOutput) { 
                inheritanceChannel.appendLine(`发现 ${includeMatches.length} 个include文件`); 
                includeMatches.forEach(path => inheritanceChannel.appendLine(`  - ${path}`));
            }
            await this.macroManager.scanMacros();
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        const processedFiles = new Set<string>();
        
        // 收集所有继承条目，准备并行处理
        const inheritTasks: Promise<void>[] = [];
        const allInheritedFiles: Array<{file: string, source: string}> = [];
        
        // 从两种regex中收集所有inherit语句
        for (const inheritRegex of inheritRegexes) {
            let match;
            while ((match = inheritRegex.exec(text)) !== null) {
                let inheritedFile = match[1];
                let macroSource = '';
                
                // 如果是宏定义形式，尝试解析宏
                if (inheritedFile.match(/^[A-Z_][A-Z0-9_]*$/)) {
                    const macro = this.macroManager.getMacro(inheritedFile);
                    if (macro) {
                        inheritedFile = macro.value.replace(/^"(.*)"$/, '$1');
                        if (showOutput) { inheritanceChannel.appendLine(`解析宏 ${macro.name}: ${macro.value} (来自 ${macro.file})`); }
                        
                        let macroPath = path.basename(macro.file);
                        const includePath = this.macroManager.getIncludePath();
                        if (includePath) {
                            macroPath = path.relative(includePath, macro.file);
                        }
                        macroSource = `(通过宏 ${macro.name} 从 ${macroPath})`;
                    } else {
                        if (showOutput) { inheritanceChannel.appendLine(`警告: 未找到宏 ${inheritedFile} 的定义`); }
                        continue; // 如果找不到宏定义，跳过这个继承
                    }
                }

                // 处理文件路径
                if (!inheritedFile.endsWith('.c')) {
                    inheritedFile = inheritedFile + '.c';
                }
                
                allInheritedFiles.push({file: inheritedFile, source: macroSource});
            }
        }
        
        // 并行处理所有继承文件
        if (allInheritedFiles.length > 0) {
            if (showOutput) {
                inheritanceChannel.appendLine(`找到 ${allInheritedFiles.length} 个继承文件，并行处理中...`);
            }
            
            // 创建所有继承文件的处理任务
            for (const {file, source} of allInheritedFiles) {
                inheritTasks.push(this.processInheritedFile(
                    file, 
                    source, 
                    document, 
                    workspaceFolder, 
                    processedFiles, 
                    completionItems, 
                    showOutput
                ));
            }
            
            // 等待所有任务完成
            await Promise.all(inheritTasks);
        }
    }
    
    // 提取单个继承文件的处理为独立方法
    private async processInheritedFile(
        inheritedFile: string,
        macroSource: string,
        document: vscode.TextDocument,
        workspaceFolder: vscode.WorkspaceFolder,
        processedFiles: Set<string>,
        completionItems: vscode.CompletionItem[],
        showOutput: boolean
    ): Promise<void> {
        if (showOutput) { inheritanceChannel.appendLine(`\n正在查找继承文件: ${inheritedFile}`); }
        
        // 检查文件路径缓存
        const cacheKey = `${document.uri.fsPath}:${inheritedFile}`;
        let resolvedPath = this.filePathCache.get(cacheKey);
        let fileFound = false;
        
        if (resolvedPath) {
            // 使用缓存的路径
            if (showOutput) { inheritanceChannel.appendLine(`  使用缓存的文件路径: ${resolvedPath}`); }
            if (fs.existsSync(resolvedPath) && !processedFiles.has(resolvedPath)) {
                fileFound = true;
            }
        } else {
            // 构建可能的文件路径
            const possiblePaths = [];
            
            if (inheritedFile.startsWith('/')) {
                // 绝对路径：移除开头的/，然后从工作区根目录开始查找
                const relativePath = inheritedFile.slice(1);
                possiblePaths.push(
                    path.join(workspaceFolder.uri.fsPath, relativePath),
                    path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', ''))
                );
            } else {
                // 相对路径：先相对于当前文件查找，再从工作区根目录查找
                possiblePaths.push(
                    path.join(path.dirname(document.uri.fsPath), inheritedFile),
                    path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')),
                    path.join(workspaceFolder.uri.fsPath, inheritedFile),
                    path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', ''))
                );
            }

            // 去重路径
            const uniquePaths = [...new Set(possiblePaths)];

            for (const filePath of uniquePaths) {
                if (showOutput) { inheritanceChannel.appendLine(`  尝试路径: ${filePath}`); }
                if (fs.existsSync(filePath) && !processedFiles.has(filePath)) {
                    resolvedPath = filePath;
                    // 缓存解析结果
                    this.filePathCache.set(cacheKey, filePath);
                    fileFound = true;
                    break;
                }
            }
        }

        // 同步检查是否有其他线程已经处理过这个文件
        if (processedFiles.has(resolvedPath || '')) {
            if (showOutput) { inheritanceChannel.appendLine(`  文件已被其他任务处理: ${resolvedPath}`); }
            return;
        }
        
        if (fileFound && resolvedPath) {
            // 标记为已处理
            processedFiles.add(resolvedPath);
            if (showOutput) { inheritanceChannel.appendLine(`  ✓ 找到文件: ${resolvedPath}`); }
            
            try {
                const inheritedDoc = await vscode.workspace.openTextDocument(resolvedPath);
                
                // 检查函数缓存
                const functionCacheKey = resolvedPath;
                if (this.functionCache.has(functionCacheKey)) {
                    const cachedItems = this.functionCache.get(functionCacheKey)!;
                    if (showOutput) { inheritanceChannel.appendLine(`  使用缓存的函数定义`); }
                    // 更新缓存项的来源信息
                    cachedItems.forEach(item => {
                        const originalDetail = item.detail?.split(':')[1] || '';
                        item.detail = `继承自 ${path.basename(resolvedPath!)}${macroSource}: ${originalDetail.trim()}`;
                    });
                    completionItems.push(...cachedItems);
                } else {
                    const inheritedCompletions: vscode.CompletionItem[] = [];
                    await this.parseFunctionsInFile(
                        inheritedDoc, 
                        inheritedCompletions, 
                        `继承自 ${path.basename(resolvedPath)}${macroSource}`
                    );
                    
                    // 更新缓存
                    this.functionCache.set(functionCacheKey, inheritedCompletions);
                    completionItems.push(...inheritedCompletions);
                }

                // 递归处理继承的文件
                await this.parseInheritedFunctions(inheritedDoc, completionItems, showOutput);
            } catch (error) {
                if (showOutput) { inheritanceChannel.appendLine(`  ✗ 错误: 读取继承文件失败: ${resolvedPath}`); }
                console.error(`Error reading inherited file: ${resolvedPath}`, error);
            }
        } else {
            if (showOutput) { inheritanceChannel.appendLine(`  ✗ 未找到文件: ${inheritedFile}`); }
        }
        
        if (showOutput) { inheritanceChannel.appendLine('----------------------------------------'); }
    }

    // Renamed to parseFunctionsInFileRegex
    private parseFunctionsInFileRegex(
        document: vscode.TextDocument,
        completionItems: vscode.CompletionItem[],
        source: string = '当前文件'
    ): void {
        const text = document.getText();
        // const lines = text.split('\n'); // Not used in this version
        
        // 匹配函数定义，支持各种修饰符和返回类型
        const functionRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/g;
        
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const functionDefinition = match[0]; // Full matched definition line
            const params = match[2];

            const item = new vscode.CompletionItem(functionName, vscode.CompletionItemKind.Function);
            item.detail = `${source}: ${functionDefinition}`;
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(functionDefinition.trim() + " { ... }", 'lpc'); // Assume it's a definition
            item.documentation = markdown;
            
            // Create snippet with parameters
            const paramNames = params.split(',').map(p => {
                const parts = p.trim().split(/\s+/); // split by whitespace
                return parts.pop(); // last part is the name
            }).filter(p => p && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)); // Ensure it's a valid identifier

            let snippet = functionName + "(";
            if (paramNames.length > 0) {
                snippet += paramNames.map((name, i) => `\${${i+1}:${name}}`).join(", ");
            }
            snippet += ")";
            item.insertText = new vscode.SnippetString(snippet);

            completionItems.push(item);
        }
    }

    private addFunctionCompletion(
        functionName: string,
        functionDefinition: string,
        comment: string,
        completionItems: vscode.CompletionItem[],
        source: string
    ): void {
        const item = new vscode.CompletionItem(functionName, vscode.CompletionItemKind.Function);
        
        // 统一的函数来源显示格式
        item.detail = `${source}: ${functionName}`;
        
        // 处理注释文档
        const markdown = new vscode.MarkdownString();
        if (comment) {
            const processedComment = this.processJavaDocComment(comment);
            markdown.appendMarkdown(processedComment);
        }
        markdown.appendCodeblock(functionDefinition.trim(), 'lpc');
        item.documentation = markdown;
        
        // 添加代码片段
        item.insertText = new vscode.SnippetString(`${functionName}(\${1})`);
        
        completionItems.push(item);
    }

    private processJavaDocComment(comment: string): string {
        // 移除注释标记和多余的空格
        let lines = comment
            .replace(/\/\*\*|\*\/|\*/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let markdown = '';
        let currentSection = '';

        for (const line of lines) {
            if (line.startsWith('@param')) {
                if (!markdown.includes('### 参数')) {
                    markdown += '\n### 参数\n';
                }
                const paramMatch = line.match(/@param\s+(\S+)\s+(.*)/);
                if (paramMatch) {
                    markdown += `- \`${paramMatch[1]}\`: ${paramMatch[2]}\n`;
                }
            } else if (line.startsWith('@return')) {
                markdown += '\n### 返回值\n';
                markdown += line.replace('@return', '').trim() + '\n';
            } else if (line.startsWith('@example')) {
                markdown += '\n### 示例\n```lpc\n';
                currentSection = 'example';
            } else if (currentSection === 'example') {
                if (line.startsWith('@')) {
                    markdown += '```\n';
                    currentSection = '';
                } else {
                    markdown += line + '\n';
                }
            } else if (!line.startsWith('@')) {
                if (!currentSection) {
                    markdown += line + '\n';
                }
            }
        }

        if (currentSection === 'example') {
            markdown += '```\n';
        }

        return markdown;
    }

    private addObjectMethodCompletions(completionItems: vscode.CompletionItem[]): void {
        const commonMethods = [
            { name: 'query', snippet: 'query(${1:prop})', detail: '查询属性值' },
            { name: 'set', snippet: 'set(${1:prop}, ${2:value})', detail: '设置属性值' },
            { name: 'add', snippet: 'add(${1:prop}, ${2:value})', detail: '添加属性值' },
            { name: 'delete', snippet: 'delete(${1:prop})', detail: '删除属性' }
        ];

        commonMethods.forEach(method => {
            const item = new vscode.CompletionItem(method.name, vscode.CompletionItemKind.Method);
            item.detail = method.detail;
            item.insertText = new vscode.SnippetString(method.snippet);
            completionItems.push(item);
        });
    }

    private addPreprocessorCompletions(completionItems: vscode.CompletionItem[]): void {
        const preprocessors = [
            { name: 'include', snippet: 'include <${1:file}>', detail: '包含头文件' },
            { name: 'define', snippet: 'define ${1:MACRO} ${2:value}', detail: '定义宏' },
            { name: 'ifdef', snippet: 'ifdef ${1:MACRO}\n\t${2}\n#endif', detail: '条件编译' },
            { name: 'ifndef', snippet: 'ifndef ${1:MACRO}\n\t${2}\n#endif', detail: '条件编译' },
            { name: 'endif', snippet: 'endif', detail: '结束条件编译' }
        ];

        preprocessors.forEach(prep => {
            const item = new vscode.CompletionItem(prep.name, vscode.CompletionItemKind.Keyword);
            item.detail = prep.detail;
            item.insertText = new vscode.SnippetString(prep.snippet);
            completionItems.push(item);
        });
    }
} 