"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LPCCompletionItemProvider = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
// 创建输出通道
const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');
class LPCCompletionItemProvider {
    constructor(efunDocsManager, macroManager) {
        this.types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer'];
        this.modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs'];
        this.functionCache = new Map();
        this.variableCache = new Map();
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
    }
    // 清除变量缓存的公共方法
    clearVariableCache() {
        this.variableCache.clear();
    }
    async provideCompletionItems(document, position, token, context) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems = [];
        // 添加当前文件中定义的函数和继承的函数
        await this.addLocalFunctionCompletions(document, completionItems);
        // 添加当前作用域内的变量
        this.addLocalVariableCompletions(document, position, completionItems);
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
        }
        else if (linePrefix.match(/^\s*#/)) {
            // 预处理指令提示
            this.addPreprocessorCompletions(completionItems);
        }
        return completionItems;
    }
    // 添加一个公共方法用于手动扫描
    async scanInheritance(document) {
        // 清除之前的输出
        inheritanceChannel.clear();
        inheritanceChannel.show(true);
        await this.parseInheritedFunctions(document, [], true);
    }
    async addLocalFunctionCompletions(document, completionItems) {
        // 首先添加当前文件的函数
        this.parseFunctionsInFile(document, completionItems);
        // 解析继承文件，但不显示输出
        await this.parseInheritedFunctions(document, completionItems, false);
    }
    // 添加当前作用域内的变量提示
    addLocalVariableCompletions(document, position, completionItems) {
        // 获取当前文件的变量
        const variables = this.parseVariablesInScope(document, position);
        completionItems.push(...variables);
    }
    // 解析当前作用域内的变量
    parseVariablesInScope(document, position) {
        const text = document.getText();
        const lines = text.split('\n');
        const currentLine = position.line;
        const currentChar = position.character;
        const result = [];
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
    parseGlobalVariables(text, result) {
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
    parseLocalVariables(document, position, result) {
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
                }
                else if (line[j] === '}') {
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
                }
                else if (line[j] === '}') {
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
                }
                else {
                    continue;
                }
            }
            else if (line.match(/(?:int|string|object|mapping|mixed|float|buffer)\s+[a-zA-Z_][a-zA-Z0-9_]*/) && !line.includes(';')) {
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
    parseFunctionParameters(document, position, result) {
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
                }
                else if (char === '(' && inMultiLineParams) {
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
                    if (!trimmedParam)
                        continue;
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
    async parseInheritedFunctions(document, completionItems, showOutput = false) {
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
        const processedIncludes = new Set();
        while ((includeMatch = includeRegex.exec(text)) !== null) {
            const includePath = includeMatch[1];
            if (processedIncludes.has(includePath))
                continue;
            processedIncludes.add(includePath);
            if (showOutput) {
                inheritanceChannel.appendLine(`发现include文件: ${includePath}`);
            }
            // 尝试加载include文件中的宏定义
            await this.macroManager.scanMacros();
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return;
        const processedFiles = new Set();
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
                        if (showOutput) {
                            inheritanceChannel.appendLine(`解析宏 ${macro.name}: ${macro.value} (来自 ${macro.file})`);
                        }
                        // 记录宏的来源，用于显示在提示中
                        let macroPath = path.basename(macro.file);
                        const includePath = this.macroManager.getIncludePath();
                        if (includePath) {
                            macroPath = path.relative(includePath, macro.file);
                        }
                        macroSource = `(通过宏 ${macro.name} 从 ${macroPath})`;
                    }
                    else {
                        if (showOutput) {
                            inheritanceChannel.appendLine(`警告: 未找到宏 ${inheritedFile} 的定义`);
                        }
                        continue; // 如果找不到宏定义，跳过这个继承
                    }
                }
                // 处理文件路径
                if (!inheritedFile.endsWith('.c')) {
                    inheritedFile = inheritedFile + '.c';
                }
                if (showOutput) {
                    inheritanceChannel.appendLine(`\n正在查找继承文件: ${inheritedFile}`);
                }
                // 构建可能的文件路径
                const possiblePaths = [];
                if (inheritedFile.startsWith('/')) {
                    // 绝对路径：移除开头的/，然后从工作区根目录开始查找
                    const relativePath = inheritedFile.slice(1);
                    possiblePaths.push(path.join(workspaceFolder.uri.fsPath, relativePath), path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', '')));
                }
                else {
                    // 相对路径：先相对于当前文件查找，再从工作区根目录查找
                    possiblePaths.push(path.join(path.dirname(document.uri.fsPath), inheritedFile), path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')), path.join(workspaceFolder.uri.fsPath, inheritedFile), path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', '')));
                }
                // 去重路径
                const uniquePaths = [...new Set(possiblePaths)];
                let fileFound = false;
                for (const filePath of uniquePaths) {
                    if (showOutput) {
                        inheritanceChannel.appendLine(`  尝试路径: ${filePath}`);
                    }
                    if (fs.existsSync(filePath) && !processedFiles.has(filePath)) {
                        processedFiles.add(filePath);
                        fileFound = true;
                        if (showOutput) {
                            inheritanceChannel.appendLine(`  ✓ 找到文件: ${filePath}`);
                        }
                        try {
                            const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                            // 检查缓存
                            const cacheKey = filePath;
                            if (this.functionCache.has(cacheKey)) {
                                const cachedItems = this.functionCache.get(cacheKey);
                                if (showOutput) {
                                    inheritanceChannel.appendLine(`  使用缓存的函数定义`);
                                }
                                // 更新缓存项的来源信息
                                cachedItems.forEach(item => {
                                    const originalDetail = item.detail?.split(':')[1] || '';
                                    item.detail = `继承自 ${path.basename(filePath)}${macroSource}: ${originalDetail.trim()}`;
                                });
                                completionItems.push(...cachedItems);
                            }
                            else {
                                const inheritedCompletions = [];
                                await this.parseFunctionsInFile(inheritedDoc, inheritedCompletions, `继承自 ${path.basename(filePath)}${macroSource}`);
                                // 更新缓存
                                this.functionCache.set(cacheKey, inheritedCompletions);
                                completionItems.push(...inheritedCompletions);
                            }
                            // 递归处理继承的文件
                            await this.parseInheritedFunctions(inheritedDoc, completionItems, showOutput);
                        }
                        catch (error) {
                            if (showOutput) {
                                inheritanceChannel.appendLine(`  ✗ 错误: 读取继承文件失败: ${filePath}`);
                            }
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        break;
                    }
                }
                if (!fileFound) {
                    if (showOutput) {
                        inheritanceChannel.appendLine(`  ✗ 未找到文件: ${inheritedFile}`);
                    }
                }
                if (showOutput) {
                    inheritanceChannel.appendLine('----------------------------------------');
                }
            }
        }
    }
    parseFunctionsInFile(document, completionItems, source = '当前文件') {
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
    addFunctionCompletion(functionName, functionDefinition, comment, completionItems, source) {
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
    processJavaDocComment(comment) {
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
            }
            else if (line.startsWith('@return')) {
                markdown += '\n### 返回值\n';
                markdown += line.replace('@return', '').trim() + '\n';
            }
            else if (line.startsWith('@example')) {
                markdown += '\n### 示例\n```lpc\n';
                currentSection = 'example';
            }
            else if (currentSection === 'example') {
                if (line.startsWith('@')) {
                    markdown += '```\n';
                    currentSection = '';
                }
                else {
                    markdown += line + '\n';
                }
            }
            else if (!line.startsWith('@')) {
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
    addObjectMethodCompletions(completionItems) {
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
    addPreprocessorCompletions(completionItems) {
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
exports.LPCCompletionItemProvider = LPCCompletionItemProvider;
//# sourceMappingURL=completionProvider.js.map