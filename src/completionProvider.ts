import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';
import { MacroManager } from './macroManager';
import { ASTManager } from './ast/astManager';
import { SymbolType } from './ast/symbolTable';

// 创建输出通道
const inheritanceChannel = vscode.window.createOutputChannel('LPC Inheritance');

export class LPCCompletionItemProvider implements vscode.CompletionItemProvider {
    private types = ['void', 'int', 'string', 'object', 'mapping', 'mixed', 'float', 'buffer', 'struct', 'class'];
    private modifiers = ['private', 'protected', 'public', 'static', 'nomask', 'varargs'];
    private keywords = ['new', 'catch', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'foreach', 'inherit', 'include'];
    private efunDocsManager: EfunDocsManager;
    private macroManager: MacroManager;
    private astManager: ASTManager;
    private staticItems: vscode.CompletionItem[];

    constructor(efunDocsManager: EfunDocsManager, macroManager: MacroManager) {
        this.efunDocsManager = efunDocsManager;
        this.macroManager = macroManager;
        this.astManager = ASTManager.getInstance();

        // 预构造静态补全项
        this.staticItems = [];
        this.initializeStaticItems();
    }

    private initializeStaticItems(): void {
        // 添加类型补全
        this.types.forEach(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = `LPC 类型: ${type}`;
            this.staticItems.push(item);
        });

        // 添加修饰符补全
        this.modifiers.forEach(mod => {
            const item = new vscode.CompletionItem(mod, vscode.CompletionItemKind.Keyword);
            item.detail = `LPC 修饰符: ${mod}`;
            this.staticItems.push(item);
        });

        // 添加关键字补全
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

        // 添加Efun补全
        this.efunDocsManager.getAllFunctions().forEach(fn => {
            const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
            item.detail = `LPC Efun: ${fn}`;
            item.insertText = new vscode.SnippetString(`${fn}($1)`);
            
            // 延迟文档加载
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

        // 添加模拟函数补全
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

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const completionItems: vscode.CompletionItem[] = [...this.staticItems];

        try {
            // 使用AST获取基于作用域的补全
            const astCompletions = this.astManager.getCompletionItems(document, position);
            completionItems.push(...astCompletions);

            // 添加继承函数补全
            await this.addInheritedFunctionCompletions(document, completionItems);

            // 处理特定上下文的补全
            if (linePrefix.endsWith('->')) {
                // 结构体成员访问补全
                this.addStructMemberCompletions(document, position, linePrefix, completionItems);
                // 对象方法补全
                this.addObjectMethodCompletions(completionItems);
            } else if (linePrefix.match(/^\s*#/)) {
                // 预处理指令补全
                this.addPreprocessorCompletions(completionItems);
            }

            return completionItems;

        } catch (error) {
            console.error('Error providing completions:', error);
            return completionItems; // 返回基本补全项
        }
    }

    // 添加结构体成员访问补全 - 增强版本，支持更复杂的表达式
    private addStructMemberCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        linePrefix: string,
        completionItems: vscode.CompletionItem[]
    ): void {
        try {
            // 支持更复杂的表达式模式和链式访问
            const patterns = [
                /(\w+)\s*->\s*$/, // 简单变量: var->
                /(\w+)\s*\[\s*\w*\s*\]\s*->\s*$/, // 数组元素: var[index]->
                /(\w+)\s*\(\s*[^)]*\s*\)\s*->\s*$/, // 函数调用: func()->
                /(\w+)(\s*->\s*\w+)+\s*->\s*$/, // 链式调用: var->member1->member2->
                /(\w+)\s*\[\s*["']\w*["']\s*\]\s*->\s*$/, // 映射访问: mapping["key"]->
                /this_object\(\s*\)\s*->\s*$/, // this_object()->
                /previous_object\(\s*\)\s*->\s*$/ // previous_object()->
            ];

            let expressionChain: string[] = [];
            let matchedPattern: string | null = null;

            // 尝试匹配各种模式
            for (const pattern of patterns) {
                const match = linePrefix.match(pattern);
                if (match) {
                    matchedPattern = pattern.source;

                    // 解析表达式链
                    if (pattern.source.includes('->.*->')) {
                        // 链式访问：解析完整的访问链
                        const chainMatch = linePrefix.match(/(\w+(?:\s*->\s*\w+)*)\s*->\s*$/);
                        if (chainMatch) {
                            expressionChain = chainMatch[1].split('->').map(part => part.trim());
                        }
                    } else {
                        // 简单访问
                        expressionChain = [match[1]];
                    }
                    break;
                }
            }

            if (expressionChain.length === 0) {
                console.debug('No valid expression chain found in line prefix:', linePrefix);
                return;
            }

            // 获取结构体成员补全
            let structMembers: vscode.CompletionItem[] = [];

            if (expressionChain.length === 1) {
                // 简单访问：直接获取变量的成员
                const variableName = expressionChain[0];
                structMembers = this.astManager.getStructMemberCompletions(document, position, variableName);
            } else {
                // 链式访问：需要类型推断
                structMembers = this.getChainedMemberCompletions(document, position, expressionChain);
            }

            // 为成员添加上下文信息
            structMembers.forEach(item => {
                // 添加来源信息
                const sourceInfo = expressionChain.join('->');
                if (item.detail && !item.detail.includes('来自')) {
                    item.detail = `来自 ${sourceInfo}: ${item.detail}`;
                }

                // 为结构体成员设置特殊的排序
                if (!item.sortText) {
                    item.sortText = `0_${item.label}`; // 结构体成员优先显示
                }

                // 为链式访问添加特殊标记
                if (expressionChain.length > 1) {
                    const currentDoc = item.documentation as vscode.MarkdownString;
                    if (currentDoc) {
                        currentDoc.appendMarkdown(`\n\n*通过链式访问: ${sourceInfo}*`);
                    } else {
                        item.documentation = new vscode.MarkdownString(`*通过链式访问: ${sourceInfo}*`);
                    }
                }
            });

            completionItems.push(...structMembers);

        } catch (error) {
            console.error('Error adding struct member completions:', error);
        }
    }

    // 获取链式成员补全 - 支持复杂的类型推断
    private getChainedMemberCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        expressionChain: string[]
    ): vscode.CompletionItem[] {
        try {
            const parseResult = this.astManager.parseDocument(document);
            const typeResolver = parseResult.visitor.getTypeResolver();

            // 从第一个变量开始，逐步推断每一级的类型
            let currentType = this.getInitialType(expressionChain[0], parseResult, position);

            if (!currentType) {
                console.debug(`Cannot resolve initial type for ${expressionChain[0]}`);
                return [];
            }

            // 遍历访问链，推断每一级的类型
            for (let i = 1; i < expressionChain.length; i++) {
                const memberName = expressionChain[i];
                const newType = this.resolveMemberType(currentType, memberName, parseResult);

                if (!newType) {
                    console.debug(`Cannot resolve member type for ${memberName} in ${currentType}`);
                    return [];
                }

                currentType = newType;
            }

            // 获取最终类型的成员补全
            const structSymbol = parseResult.symbolTable.findStructDefinition(currentType);
            if (!structSymbol || !structSymbol.members) {
                console.debug(`No struct definition found for final type: ${currentType}`);
                return [];
            }

            // 转换成员为补全项
            return this.convertMembersToCompletionItems(structSymbol.members, expressionChain);

        } catch (error) {
            console.error('Error in chained member completion:', error);
            return [];
        }
    }

    // 获取初始类型（处理特殊函数调用）
    private getInitialType(initialExpression: string, parseResult: any, position: vscode.Position): string | null {
        // 处理特殊的内置函数
        if (initialExpression === 'this_object()') {
            return 'object'; // 返回当前对象类型
        }

        if (initialExpression === 'previous_object()') {
            return 'object'; // 返回调用对象类型
        }

        // 查找普通变量的类型
        const symbol = parseResult.symbolTable.findSymbol(initialExpression, position);
        if (symbol) {
            return this.cleanTypeName(symbol.dataType);
        }

        return null;
    }

    // 解析成员类型
    private resolveMemberType(parentType: string, memberName: string, parseResult: any): string | null {
        const structSymbol = parseResult.symbolTable.findStructDefinition(parentType);
        if (!structSymbol || !structSymbol.members) {
            return null;
        }

        const member = structSymbol.members.find((m: any) => m.name === memberName);
        if (member) {
            return this.cleanTypeName(member.dataType);
        }

        return null;
    }

    // 清理类型名称（去除修饰符和指针）
    private cleanTypeName(typeName: string): string {
        return typeName
            .replace(/^(private|protected|public|static|const)\s+/, '')
            .replace(/\s*\*+\s*$/, '')
            .replace(/\s*\[\s*\]\s*$/, '')
            .trim();
    }

    // 转换成员为补全项
    private convertMembersToCompletionItems(members: any[], expressionChain: string[]): vscode.CompletionItem[] {
        return members.map((member, index) => {
            const item = new vscode.CompletionItem(member.name, vscode.CompletionItemKind.Field);
            item.detail = `${member.dataType} ${member.name}`;
            item.sortText = `${index.toString().padStart(3, '0')}_${member.name}`;

            // 创建详细文档
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(`${member.dataType} ${member.name}`, 'lpc');
            markdown.appendMarkdown(`\n\n通过链式访问获得: ${expressionChain.join(' -> ')}`);

            if (member.documentation) {
                markdown.appendMarkdown(`\n\n${member.documentation}`);
            }

            item.documentation = markdown;

            // 为函数类型添加调用片段
            if (member.dataType.includes('function') && member.parameters) {
                const paramSnippet = member.parameters
                    .map((param: any, paramIndex: number) => `\${${paramIndex + 1}:${param.name}}`)
                    .join(', ');
                item.insertText = new vscode.SnippetString(`${member.name}(${paramSnippet})`);
                item.kind = vscode.CompletionItemKind.Method;
            }

            return item;
        });
    }

    // 添加继承函数补全
    private async addInheritedFunctionCompletions(
        document: vscode.TextDocument,
        completionItems: vscode.CompletionItem[]
    ): Promise<void> {
        try {
            // 这里可以扩展为基于AST的继承解析
            // 目前保持简化的继承处理
            await this.parseInheritedFunctions(document, completionItems);
        } catch (error) {
            console.error('Error adding inherited functions:', error);
        }
    }

    // 基于AST的继承函数解析 - 替换正则表达式实现
    private async parseInheritedFunctions(
        document: vscode.TextDocument,
        completionItems: vscode.CompletionItem[]
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) return;

        try {
            // 使用AST获取继承信息
            const parseResult = this.astManager.parseDocument(document);
            const inheritedFiles = parseResult.symbolTable.getInheritedFiles();
            const processedFiles = new Set<string>();

            for (const inheritedFile of inheritedFiles) {
                let normalizedFile = inheritedFile;
                if (!normalizedFile.endsWith('.c')) {
                    normalizedFile += '.c';
                }

                // 构建文件路径
                const possiblePaths = [
                    path.join(path.dirname(document.uri.fsPath), normalizedFile),
                    path.join(workspaceFolder.uri.fsPath, normalizedFile),
                    // 支持相对路径和绝对路径
                    path.resolve(workspaceFolder.uri.fsPath, normalizedFile)
                ];

                for (const filePath of possiblePaths) {
                    if (fs.existsSync(filePath) && !processedFiles.has(filePath)) {
                        processedFiles.add(filePath);
                        try {
                            const inheritedDoc = await vscode.workspace.openTextDocument(filePath);

                            // 使用AST解析继承文件的函数
                            const inheritedCompletions = this.astManager.getCompletionItems(inheritedDoc, new vscode.Position(0, 0));

                            // 标记为继承函数并添加到补全列表
                            inheritedCompletions.forEach(item => {
                                if (item.kind === vscode.CompletionItemKind.Function) {
                                    const inheritedItem = new vscode.CompletionItem(item.label as string, item.kind);
                                    inheritedItem.detail = `继承自 ${path.basename(filePath)}: ${item.detail}`;
                                    inheritedItem.documentation = item.documentation;
                                    inheritedItem.insertText = item.insertText;
                                    // 为继承函数设置特殊排序优先级
                                    inheritedItem.sortText = `2_${item.label}`; // 继承函数排在本地函数之后
                                    completionItems.push(inheritedItem);
                                }
                            });
                        } catch (error) {
                            console.error(`Error processing inherited file ${filePath}:`, error);
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing inherited functions with AST:', error);
            // 如果AST解析失败，fallback到原有实现
            await this.fallbackParseInheritedFunctions(document, completionItems);
        }
    }

    // 备用继承解析方法（在AST解析失败时使用）
    private async fallbackParseInheritedFunctions(
        document: vscode.TextDocument,
        completionItems: vscode.CompletionItem[]
    ): Promise<void> {
        const text = document.getText();
        const inheritRegex = /inherit\s+["']([^"']+)["']/g;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

        if (!workspaceFolder) return;

        let match;
        const processedFiles = new Set<string>();

        while ((match = inheritRegex.exec(text)) !== null) {
            let inheritedFile = match[1];
            if (!inheritedFile.endsWith('.c')) {
                inheritedFile += '.c';
            }

            const possiblePaths = [
                path.join(path.dirname(document.uri.fsPath), inheritedFile),
                path.join(workspaceFolder.uri.fsPath, inheritedFile)
            ];

            for (const filePath of possiblePaths) {
                if (fs.existsSync(filePath) && !processedFiles.has(filePath)) {
                    processedFiles.add(filePath);
                    try {
                        const inheritedDoc = await vscode.workspace.openTextDocument(filePath);
                        const inheritedCompletions = this.astManager.getCompletionItems(inheritedDoc, new vscode.Position(0, 0));

                        inheritedCompletions.forEach(item => {
                            if (item.kind === vscode.CompletionItemKind.Function) {
                                const inheritedItem = new vscode.CompletionItem(item.label as string, item.kind);
                                inheritedItem.detail = `继承自 ${path.basename(filePath)} (fallback): ${item.detail}`;
                                inheritedItem.documentation = item.documentation;
                                inheritedItem.insertText = item.insertText;
                                completionItems.push(inheritedItem);
                            }
                        });
                    } catch (error) {
                        console.error(`Error processing inherited file ${filePath}:`, error);
                    }
                    break;
                }
            }
        }
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

    // 清除缓存的公共方法
    public clearCache(document?: vscode.TextDocument): void {
        if (document) {
            this.astManager.clearCache(document.uri.toString());
        } else {
            this.astManager.clearAllCache();
        }
    }

    // 手动扫描继承的公共方法（用于命令）
    public async scanInheritance(document: vscode.TextDocument): Promise<void> {
        inheritanceChannel.clear();
        inheritanceChannel.show(true);
        inheritanceChannel.appendLine(`正在分析文件: ${document.fileName}`);
        inheritanceChannel.appendLine('使用基于AST的解析...');
        
        try {
            // 使用AST解析当前文档
            const parseResult = this.astManager.parseDocument(document);
            const symbolTable = parseResult.symbolTable;
            const functions = symbolTable.getSymbolsByType(SymbolType.FUNCTION);
            const variables = symbolTable.getSymbolsByType(SymbolType.VARIABLE);
            const structs = symbolTable.getSymbolsByType(SymbolType.STRUCT);
            
            inheritanceChannel.appendLine(`解析完成:`);
            inheritanceChannel.appendLine(`  - 发现 ${functions.length} 个函数`);
            inheritanceChannel.appendLine(`  - 发现 ${variables.length} 个变量`);
            inheritanceChannel.appendLine(`  - 发现 ${structs.length} 个结构体/类`);
            
            // 列出函数
            if (functions.length > 0) {
                inheritanceChannel.appendLine(`\n函数列表:`);
                functions.forEach(func => {
                    inheritanceChannel.appendLine(`  - ${func.dataType} ${func.name}()`);
                });
            }
            
            // 列出结构体
            if (structs.length > 0) {
                inheritanceChannel.appendLine(`\n结构体/类列表:`);
                structs.forEach(struct => {
                    inheritanceChannel.appendLine(`  - ${struct.name} (${struct.members?.length || 0} 个成员)`);
                });
            }
        } catch (error) {
            inheritanceChannel.appendLine(`错误: ${error}`);
        }
    }
}