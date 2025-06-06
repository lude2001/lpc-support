import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';
import { MacroManager } from './macroManager';

// ANTLR and Symbol Table Imports
import { CharStreams, CommonTokenStream, Token, ParserRuleContext as AntlrParserRuleContext } from 'antlr4';
import { ParseTreeWalker, TerminalNode, ParseTree } from 'antlr4/src/antlr4/tree/Tree';
import LPCLexer from '../../out/parser/LPCLexer.js';
import LPCParser, { ProgramContext, FunctionDefinitionContext } from '../../out/parser/LPCParser.js'; // Added FunctionDefinitionContext
import { LPCSymbolTableListener } from './parser/lpcSymbolTableListener'; // Adjusted path
import { LPCSymbol, Scope, SymbolKind } from './parser/symbolTable';   // Adjusted path

// 创建输出通道
const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');

// Helper function to get unique elements from an array
const uniquePathsFromArray = (arr: string[]) => [...new Set(arr)];

// Helper to find the most specific scope at a given text offset
// (Similar to the one in LPCHoverProvider)
function findScopeAtOffset(startingScope: Scope, offset: number): Scope {
    let bestMatch: Scope = startingScope;

    function findRecursive(currentScope: Scope) {
        const scopeNode = currentScope.scopeNode;
        let nodeStartOffset = -1;
        let nodeEndOffset = -1;

        if (scopeNode instanceof AntlrParserRuleContext) {
            if (scopeNode.start && scopeNode.stop) {
                nodeStartOffset = scopeNode.start.start;
                nodeEndOffset = scopeNode.stop.stop;
            }
        }

        if (nodeStartOffset !== -1 && nodeEndOffset !== -1 && offset >= nodeStartOffset && offset <= nodeEndOffset) {
            bestMatch = currentScope;
            for (const childScope of currentScope.children) {
                findRecursive(childScope);
            }
        }
    }

    if (startingScope.scopeNode) {
        findRecursive(startingScope);
    }
    return bestMatch;
}

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider {
    private types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer'];
    private modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs', 'nosave']; // Added nosave
    private efunDocsManager: EfunDocsManager;
    private macroManager: MacroManager;
    private functionCache: Map<string, vscode.CompletionItem[]> = new Map(); // For inherited functions (regex-based)
    // private variableCache: Map<string, vscode.CompletionItem[]> = new Map(); // Removed, parser handles locals
    private filePathCache: Map<string, string> = new Map(); // For resolved inherited file paths

    constructor(efunDocsManager: EfunDocsManager, macroManager: MacroManager) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
    }

    // 清除变量缓存的公共方法 - Now clears all relevant caches
    public clearCaches(): void {
        this.functionCache.clear();
        this.filePathCache.clear();
        // console.log("LPCCompletionItemProvider caches cleared.");
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems: vscode.CompletionItem[] = [];

        // Add parser-based completions (local variables, functions, parameters, etc. in current file)
        await this.addParserBasedCompletions(document, position, completionItems, token);
        
        // Regex-based completions for inherited functions
        await this.addInheritedFunctionCompletions(document, completionItems, false);


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

    private async addParserBasedCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        completionItems: vscode.CompletionItem[],
        cancellationToken: vscode.CancellationToken
    ): Promise<void> {
        try {
            const text = document.getText();
            const inputStream = CharStreams.fromString(text);
            const lexer = new LPCLexer(inputStream);
            lexer.removeErrorListeners();
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);
            parser.removeErrorListeners();
            const tree = parser.program();

            if (cancellationToken.isCancellationRequested) return;

            const symbolTableListener = new LPCSymbolTableListener(parser);
            if (tree) {
                symbolTableListener.globalScope.scopeNode = tree;
            }
            ParseTreeWalker.DEFAULT.walk(symbolTableListener, tree);

            if (cancellationToken.isCancellationRequested) return;

            const offset = document.offsetAt(position);
            const currentScope = findScopeAtOffset(symbolTableListener.globalScope, offset);

            let tempScope: Scope | null = currentScope;
            const addedSymbols = new Set<string>(); // To avoid duplicates from different scopes if not shadowed

            while (tempScope) {
                tempScope.symbols.forEach(symbol => {
                    if (addedSymbols.has(symbol.name)) return; // Already added from a more specific scope

                    const item = new vscode.CompletionItem(symbol.name);
                    item.detail = `(${symbol.kind}) ${symbol.type || ''} ${symbol.name}`;

                    let vsKind = vscode.CompletionItemKind.Text;
                    switch(symbol.kind) {
                        case 'function': vsKind = vscode.CompletionItemKind.Function; break;
                        case 'variable': vsKind = vscode.CompletionItemKind.Variable; break;
                        case 'parameter': vsKind = vscode.CompletionItemKind.Variable; item.detail = `(parameter) ${symbol.type || ''} ${symbol.name}`; break;
                        case 'class': vsKind = vscode.CompletionItemKind.Class; break;
                        case 'macro': vsKind = vscode.CompletionItemKind.Snippet; item.detail = `(macro) ${symbol.name} ${symbol.type || ''}`; break; // Type stores value for macros
                        default: vsKind = vscode.CompletionItemKind.Text;
                    }
                    item.kind = vsKind;

                    if (symbol.kind === 'function') {
                        // Attempt to get full function signature from declaration node if it's a FunctionDefinitionContext
                        // The LPCSymbolTableListener stores the IDENTIFIER node for functions. Its parent is FunctionDefinitionContext.
                        if (symbol.declarationNode?.parentCtx instanceof FunctionDefinitionContext) {
                            const funcDefCtx = symbol.declarationNode.parentCtx as FunctionDefinitionContext;
                            const signature = funcDefCtx.getText().split('{')[0].trim(); // Get text up to the opening brace
                            item.documentation = new vscode.MarkdownString().appendCodeblock(signature, 'lpc');
                            // Create a snippet with placeholders for parameters
                            const params = funcDefCtx.parameterList()?.parameterDeclaration();
                            if (params && params.length > 0) {
                                const paramSnippets = params.map((p, i) => `\${${i+1}:${p.IDENTIFIER().getText()}}`);
                                item.insertText = new vscode.SnippetString(`${symbol.name}(${paramSnippets.join(', ')})`);
                            } else {
                                item.insertText = new vscode.SnippetString(`${symbol.name}()`);
                            }
                        } else {
                             item.insertText = new vscode.SnippetString(`${symbol.name}()`);
                        }
                    } else if (symbol.kind === 'macro') {
                        item.insertText = symbol.name; // Macros are just their name
                         const macroDetail = symbol.type?.startsWith("defined as: ") ? symbol.type.substring("defined as: ".length) : symbol.type;
                        item.documentation = new vscode.MarkdownString().appendCodeblock(`#define ${symbol.name} ${macroDetail || ''}`, 'lpc');
                    } else {
                        item.insertText = symbol.name;
                    }

                    completionItems.push(item);
                    addedSymbols.add(symbol.name);
                });
                tempScope = tempScope.parent;
            }

        } catch (error) {
            console.error("Error during parser-based completion gathering:", error);
        }
    }

    // 添加一个公共方法用于手动扫描
    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        // 清除之前的输出
        inheritanceChannel.clear();
        inheritanceChannel.show(true);
        // Call the renamed method that now focuses on inherited functions
        await this.addInheritedFunctionCompletions(document, [], true);
    }

    // Renamed from addLocalFunctionCompletions - now primarily for inherited items
    private async addInheritedFunctionCompletions(
        document: vscode.TextDocument,
        completionItems: vscode.CompletionItem[],
        showOutput: boolean = false // For debugging inheritance scan
    ): Promise<void> {
        // Current file functions are handled by addParserBasedCompletions.
        // This method now focuses on its original strength: cross-file inheritance.
        await this.parseInheritedFunctionsRegex(document, completionItems, showOutput);
    }

    // Old regex-based methods for variable parsing - these are now superseded by addParserBasedCompletions
    // and can be removed or left commented out for reference.
    /*
    private addLocalVariableCompletions(document: vscode.TextDocument, position: vscode.Position, completionItems: vscode.CompletionItem[]): void {
        // ... old code ...
    }
    private parseVariablesInScope(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        // ... old code ...
        return [];
    }
    private parseGlobalVariables(text: string, result: vscode.CompletionItem[]): void {
        // ... old code ...
    }
    private parseLocalVariables(document: vscode.TextDocument, position: vscode.Position, result: vscode.CompletionItem[]): void {
        // ... old code ...
    }
    private parseFunctionParameters(document: vscode.TextDocument, position: vscode.Position, result: vscode.CompletionItem[]): void {
        // ... old code ...
    }
    */

    // Renamed from parseInheritedFunctions to clarify it's regex based and what it does
    private async parseInheritedFunctionsRegex(
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
    private async processInheritedFileRegex( // Renamed
        inheritedFile: string,
        macroSource: string,
        document: vscode.TextDocument,
        workspaceFolder: vscode.WorkspaceFolder,
        processedFiles: Set<string>, // This set should be for the current top-level provideCompletionItems call
        completionItems: vscode.CompletionItem[],
        showOutput: boolean
    ): Promise<void> {
        if (showOutput) { inheritanceChannel.appendLine(`\n正在查找继承文件: ${inheritedFile}`); }
        
        const cacheKeyResolvedPath = `${document.uri.fsPath}:${inheritedFile}`; // Key for resolved path
        let resolvedPath = this.filePathCache.get(cacheKeyResolvedPath);
        let fileFound = false;
        
        if (resolvedPath && fs.existsSync(resolvedPath)) {
            if (showOutput) { inheritanceChannel.appendLine(`  使用缓存的文件路径: ${resolvedPath}`); }
            fileFound = true;
        } else {
            const possiblePaths = [];
            if (inheritedFile.startsWith('/')) {
                const relativePath = inheritedFile.slice(1);
                possiblePaths.push(path.join(workspaceFolder.uri.fsPath, relativePath));
            } else {
                possiblePaths.push(path.join(path.dirname(document.uri.fsPath), inheritedFile));
                possiblePaths.push(path.join(workspaceFolder.uri.fsPath, inheritedFile)); // Fallback to workspace root
            }

            for (const filePath of uniquePathsFromArray(possiblePaths.map(p => p.endsWith('.c') ? p : p + '.c'))) { // Ensure .c, remove duplicates
                if (showOutput) { inheritanceChannel.appendLine(`  尝试路径: ${filePath}`); }
                if (fs.existsSync(filePath)) {
                    resolvedPath = filePath;
                    this.filePathCache.set(cacheKeyResolvedPath, filePath);
                    fileFound = true;
                    break;
                }
            }
        }

        if (processedFiles.has(resolvedPath || '')) {
            if (showOutput) { inheritanceChannel.appendLine(`  文件已被其他任务处理 (本次调用栈): ${resolvedPath}`); }
            return;
        }
        
        if (fileFound && resolvedPath) {
            processedFiles.add(resolvedPath); // Add to processed set for the current scan
            if (showOutput) { inheritanceChannel.appendLine(`  ✓ 找到文件: ${resolvedPath}`); }
            
            try {
                const inheritedDoc = await vscode.workspace.openTextDocument(resolvedPath);
                const functionCacheKey = resolvedPath; // Cache per file path

                if (this.functionCache.has(functionCacheKey)) {
                    const cachedItems = this.functionCache.get(functionCacheKey)!;
                    if (showOutput) { inheritanceChannel.appendLine(`  使用缓存的函数定义 from ${path.basename(resolvedPath)}`); }
                    cachedItems.forEach(item => {
                        const updatedItem = { ...item };
                        updatedItem.detail = `(inherited from ${path.basename(resolvedPath!)}${macroSource}) ${item.label}`;
                        completionItems.push(updatedItem);
                    });
                } else {
                    const inheritedCompletionsFromFile: vscode.CompletionItem[] = [];
                    this.parseFunctionsInFileRegex( // Call renamed regex version
                        inheritedDoc, 
                        inheritedCompletionsFromFile,
                        `(inherited from ${path.basename(resolvedPath)}${macroSource})`
                    );
                    this.functionCache.set(functionCacheKey, inheritedCompletionsFromFile.map(item => ({...item}))); // Cache copies
                    completionItems.push(...inheritedCompletionsFromFile);
                }
                await this.parseInheritedFunctionsRegex(inheritedDoc, completionItems, showOutput); // Recurse
            } catch (error) {
                if (showOutput) { inheritanceChannel.appendLine(`  ✗ 错误: 读取继承文件失败: ${resolvedPath}`); }
                console.error(`Error reading inherited file: ${resolvedPath}`, error);
            }
        } else {
            if (showOutput) { inheritanceChannel.appendLine(`  ✗ 未找到文件: ${inheritedFile}${macroSource}`); }
        }
        
        if (showOutput) { inheritanceChannel.appendLine('----------------------------------------'); }
    }

    // Renamed to clarify it's regex-based
    private parseFunctionsInFileRegex(
        document: vscode.TextDocument,
        completionItems: vscode.CompletionItem[],
        source: string = '当前文件'
    ): void {
        const text = document.getText();
        const lines = text.split('\n');
        
        // 匹配函数定义，支持各种修饰符和返回类型
        const functionRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
        
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const functionDefinition = match[0];
            
            // 获取函数前的注释
            let comment = '';
            let lineIndex = lines.findIndex(line => line.includes(functionDefinition));
            if (lineIndex > 0) {
                // 向上查找注释
                let commentLines = [];
                let i = lineIndex - 1;
                while (i >= 0 && (lines[i].trim().startsWith('*') || lines[i].trim().startsWith('/*'))) {
                    commentLines.unshift(lines[i]);
                    i--;
                }
                if (commentLines.length > 0) {
                    comment = commentLines.join('\n');
                }
            }

            this.addFunctionCompletion(functionName, functionDefinition, comment, completionItems, source);
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