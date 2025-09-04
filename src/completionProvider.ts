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

    // 添加结构体成员访问补全
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
        
        // 使用AST获取结构体成员补全
        const structMembers = this.astManager.getStructMemberCompletions(document, position, variableName);
        completionItems.push(...structMembers);
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

    // 简化的继承函数解析
    private async parseInheritedFunctions(
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

            // 构建文件路径
            const possiblePaths = [
                path.join(path.dirname(document.uri.fsPath), inheritedFile),
                path.join(workspaceFolder.uri.fsPath, inheritedFile)
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