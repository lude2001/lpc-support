import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';
import { MacroManager } from './macroManager';

// 创建输出通道
const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider {
    private types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer'];
    private modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs'];
    private efunDocsManager: EfunDocsManager;
    private macroManager: MacroManager;
    private functionCache: Map<string, vscode.CompletionItem[]> = new Map();

    constructor(efunDocsManager: EfunDocsManager, macroManager: MacroManager) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems: vscode.CompletionItem[] = [];

        // 添加当前文件中定义的函数和继承的函数
        await this.addLocalFunctionCompletions(document, completionItems);

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

    private async addLocalFunctionCompletions(document: vscode.TextDocument, completionItems: vscode.CompletionItem[]): Promise<void> {
        // 首先添加当前文件的函数
        this.parseFunctionsInFile(document, completionItems);
        
        // 解析继承文件，但不显示输出
        await this.parseInheritedFunctions(document, completionItems, false);
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

        while ((includeMatch = includeRegex.exec(text)) !== null) {
            const includePath = includeMatch[1];
            if (processedIncludes.has(includePath)) continue;
            processedIncludes.add(includePath);
            
            if (showOutput) { inheritanceChannel.appendLine(`发现include文件: ${includePath}`); }
            // 尝试加载include文件中的宏定义
            await this.macroManager.scanMacros();
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        const processedFiles = new Set<string>();

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
                        // 记录宏的来源，用于显示在提示中
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

                if (showOutput) { inheritanceChannel.appendLine(`\n正在查找继承文件: ${inheritedFile}`); }

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

                let fileFound = false;
                for (const filePath of uniquePaths) {
                    if (showOutput) { inheritanceChannel.appendLine(`  尝试路径: ${filePath}`); }
                    if (fs.existsSync(filePath) && !processedFiles.has(filePath)) {
                        processedFiles.add(filePath);
                        fileFound = true;
                        if (showOutput) { inheritanceChannel.appendLine(`  ✓ 找到文件: ${filePath}`); }
                        
                        try {
                            const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                            
                            // 检查缓存
                            const cacheKey = filePath;
                            if (this.functionCache.has(cacheKey)) {
                                const cachedItems = this.functionCache.get(cacheKey)!;
                                if (showOutput) { inheritanceChannel.appendLine(`  使用缓存的函数定义`); }
                                // 更新缓存项的来源信息
                                cachedItems.forEach(item => {
                                    const originalDetail = item.detail?.split(':')[1] || '';
                                    item.detail = `继承自 ${path.basename(filePath)}${macroSource}: ${originalDetail.trim()}`;
                                });
                                completionItems.push(...cachedItems);
                            } else {
                                const inheritedCompletions: vscode.CompletionItem[] = [];
                                await this.parseFunctionsInFile(
                                    inheritedDoc, 
                                    inheritedCompletions, 
                                    `继承自 ${path.basename(filePath)}${macroSource}`
                                );
                                
                                // 更新缓存
                                this.functionCache.set(cacheKey, inheritedCompletions);
                                completionItems.push(...inheritedCompletions);
                            }

                            // 递归处理继承的文件
                            await this.parseInheritedFunctions(inheritedDoc, completionItems, showOutput);
                        } catch (error) {
                            if (showOutput) { inheritanceChannel.appendLine(`  ✗ 错误: 读取继承文件失败: ${filePath}`); }
                            console.error(`Error reading inherited file: ${filePath}`, error);
                        }
                        break;
                    }
                }
                
                if (!fileFound) {
                    if (showOutput) { inheritanceChannel.appendLine(`  ✗ 未找到文件: ${inheritedFile}`); }
                }
                if (showOutput) { inheritanceChannel.appendLine('----------------------------------------'); }
            }
        }
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
} 