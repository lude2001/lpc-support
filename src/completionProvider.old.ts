import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';
import { MacroManager } from './macroManager';

// 创建输出通道
const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider {
    private types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer', 'struct', 'class'];
    private modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs'];
    private keywords = ['new', 'catch', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'foreach', 'inherit', 'include'];
    private efunDocsManager: EfunDocsManager;
    private macroManager: MacroManager;
    private functionCache: Map<string, vscode.CompletionItem[]> = new Map();
    private variableCache: Map<string, vscode.CompletionItem[]> = new Map();
    private filePathCache: Map<string, string> = new Map();
    private staticItems: vscode.CompletionItem[];

    constructor(efunDocsManager: EfunDocsManager, macroManager: MacroManager) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;

        // 预构造类型 / 修饰符 / efun / 模拟 efun 静态 CompletionItem
        this.staticItems = [];
        this.types.forEach(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = `LPC 类型: ${type}`;
            this.staticItems.push(item);
        });

        this.modifiers.forEach(mod => {
            const item = new vscode.CompletionItem(mod, vscode.CompletionItemKind.Keyword);
            item.detail = `LPC 修饰符: ${mod}`;
            this.staticItems.push(item);
        });

        this.keywords.forEach(kw => {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            item.detail = `LPC 关键字: ${kw}`;
            // 为new关键字添加特殊的snippet
            if (kw === 'new') {
                item.insertText = new vscode.SnippetString('new(${1:struct_type}${2:, ${3:field1}: ${4:value1}${5:, ${6:field2}: ${7:value2}}})');
                item.detail = 'LPC new 表达式 - 创建结构体实例';
                item.documentation = new vscode.MarkdownString('创建结构体或类的实例\n\n**语法:**\n```lpc\nnew(struct_type, field1: value1, field2: value2, ...)\n```');
            }
            this.staticItems.push(item);
        });

        this.efunDocsManager.getAllFunctions().forEach(fn => {
            const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
            item.detail = `LPC Efun: ${fn}`;
            item.insertText = new vscode.SnippetString(`${fn}($1)`);
            // 延迟文档加载保持原逻辑
            this.efunDocsManager.getEfunDoc(fn).then(doc => {
                if (doc) {
                    const md = new vscode.MarkdownString();
                    if (doc.syntax) md.appendCodeblock(doc.syntax, 'lpc');
                    if (doc.description) md.appendMarkdown(doc.description);
                    item.documentation = md;
                }
            });
            this.staticItems.push(item);
        });

        this.efunDocsManager.getAllSimulatedFunctions().forEach(fn => {
            const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
            item.detail = `模拟函数库: ${fn}`;
            item.insertText = new vscode.SnippetString(`${fn}($1)`);
            const doc = this.efunDocsManager.getSimulatedDoc(fn);
            if (doc) {
                const md = new vscode.MarkdownString();
                if (doc.syntax) md.appendCodeblock(doc.syntax, 'lpc');
                if (doc.description) md.appendMarkdown(doc.description);
                item.documentation = md;
            }
            this.staticItems.push(item);
        });
    }

    // 清除变量缓存的公共方法
    public clearVariableCache(): void {
        this.variableCache.clear();
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems: vscode.CompletionItem[] = [...this.staticItems];

        // 添加当前文件中定义的函数和继承的函数
        await this.addLocalFunctionCompletions(document, completionItems);
        
        // 添加当前作用域内的变量
        this.addLocalVariableCompletions(document, position, completionItems);

        // 添加特定上下文的提示
        if (linePrefix.endsWith('->')) {
            // 对象方法调用提示和结构体成员访问提示
            this.addObjectMethodCompletions(completionItems);
            this.addStructMemberCompletions(document, position, linePrefix, completionItems);
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

    private async addLocalFunctionCompletions(document: vscode.TextDocument, completionItems: vscode.CompletionItem[]): Promise<void> {
        // 首先添加当前文件的函数
        this.parseFunctionsInFile(document, completionItems);
        
        // 解析继承文件，但不显示输出
        await this.parseInheritedFunctions(document, completionItems, false);
    }

    // 添加当前作用域内的变量提示
    private addLocalVariableCompletions(document: vscode.TextDocument, position: vscode.Position, completionItems: vscode.CompletionItem[]): void {
        // 获取当前文件的变量
        const variables = this.parseVariablesInScope(document, position);
        completionItems.push(...variables);
    }

    // 解析当前作用域内的变量
    private parseVariablesInScope(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
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

    private parseFunctionsInFile(
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

    // 添加结构体成员访问提示
    private addStructMemberCompletions(
        document: vscode.TextDocument, 
        position: vscode.Position, 
        linePrefix: string, 
        completionItems: vscode.CompletionItem[]
    ): void {
        // 提取变量名 (-> 前的标识符)
        const match = linePrefix.match(/(\w+)\s*->\s*$/);
        if (!match) return;

        const variableName = match[1];
        
        // 查找该变量的类型定义
        const structMembers = this.findStructMembers(document, variableName);
        
        structMembers.forEach(member => {
            const item = new vscode.CompletionItem(member.name, vscode.CompletionItemKind.Field);
            item.detail = `${member.type} ${member.name}`;
            item.documentation = `结构体成员: ${member.type} 类型的 ${member.name}`;
            completionItems.push(item);
        });
    }

    // 查找结构体成员
    private findStructMembers(document: vscode.TextDocument, variableName: string): {name: string, type: string}[] {
        const text = document.getText();
        const members: {name: string, type: string}[] = [];
        
        // 1. 首先查找变量声明，获取其类型
        const variableType = this.findVariableType(text, variableName);
        if (!variableType) return members;
        
        // 2. 查找该类型的结构体定义
        const structDef = this.findStructDefinition(text, variableType);
        if (structDef) {
            return structDef;
        }
        
        return members;
    }

    // 查找变量的类型
    private findVariableType(text: string, variableName: string): string | null {
        // 匹配各种变量声明格式
        const patterns = [
            // struct/class 类型声明: struct Person var; 或 class Person var;
            new RegExp(`\\b(?:struct|class)\\s+(\\w+)\\s+(?:\\*\\s*)?${variableName}\\b`),
            // typedef定义: Person var;
            new RegExp(`\\b(\\w+)\\s+(?:\\*\\s*)?${variableName}\\b`)
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }

    // 查找结构体定义
    private findStructDefinition(text: string, typeName: string): {name: string, type: string}[] {
        const members: {name: string, type: string}[] = [];
        
        // 匹配结构体定义: struct TypeName { ... }
        const structRegex = new RegExp(
            `(?:struct|class)\\s+${typeName}\\s*\\{([^}]+)\\}`,
            'gm'
        );
        
        const match = structRegex.exec(text);
        if (!match) return members;
        
        const structBody = match[1];
        
        // 解析结构体成员
        const memberRegex = /(?:^|\n)\s*(\w+(?:\s*\*)*)\s+(\w+)\s*;/gm;
        let memberMatch;
        
        while ((memberMatch = memberRegex.exec(structBody)) !== null) {
            const type = memberMatch[1].trim();
            const name = memberMatch[2];
            members.push({ name, type });
        }
        
        return members;
    }
} 