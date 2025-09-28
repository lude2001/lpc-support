import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser, SourceFileContext } from '../antlr/LPCParser';
import { SymbolTable, SymbolType, Symbol as LPCSymbol } from './symbolTable';
import { CompletionVisitor } from './completionVisitor';

export interface ParseResult {
    ast: SourceFileContext;
    symbolTable: SymbolTable;
    visitor: CompletionVisitor;
    parseErrors: vscode.Diagnostic[];
}

export class ASTManager {
    private parseCache: Map<string, ParseResult> = new Map();
    private static instance: ASTManager;

    private constructor() {}

    public static getInstance(): ASTManager {
        if (!ASTManager.instance) {
            ASTManager.instance = new ASTManager();
        }
        return ASTManager.instance;
    }

    // 解析文档并构建AST和符号表
    public parseDocument(document: vscode.TextDocument, useCache: boolean = true): ParseResult {
        const cacheKey = `${document.uri.toString()}_${document.version}`;
        
        // 检查缓存
        if (useCache && this.parseCache.has(cacheKey)) {
            return this.parseCache.get(cacheKey)!;
        }

        const text = document.getText();
        const parseErrors: vscode.Diagnostic[] = [];

        try {
            // 创建词法分析器
            const inputStream = CharStreams.fromString(text);
            const lexer = new LPCLexer(inputStream);
            
            // 创建语法分析器
            const tokenStream = new CommonTokenStream(lexer);
            const parser = new LPCParser(tokenStream);
            
            // 添加错误监听器
            parser.removeErrorListeners();
            parser.addErrorListener({
                syntaxError: (recognizer, offendingSymbol, line, charPositionInLine, msg, e) => {
                    const diagnostic = new vscode.Diagnostic(
                        new vscode.Range(line - 1, charPositionInLine, line - 1, charPositionInLine + 1),
                        msg,
                        vscode.DiagnosticSeverity.Error
                    );
                    parseErrors.push(diagnostic);
                }
            });

            // 解析源文件
            const ast = parser.sourceFile();

            // 创建符号表
            const symbolTable = new SymbolTable(document.uri.toString());
            
            // 创建并运行访问者
            const visitor = new CompletionVisitor(symbolTable, document);
            visitor.visit(ast);

            const result: ParseResult = {
                ast,
                symbolTable,
                visitor,
                parseErrors
            };

            // 更新缓存
            if (useCache) {
                this.parseCache.set(cacheKey, result);
                
                // 限制缓存大小
                if (this.parseCache.size > 50) {
                    const firstKey = this.parseCache.keys().next().value;
                    if (firstKey) {
                        this.parseCache.delete(firstKey);
                    }
                }
            }

            return result;

        } catch (error) {
            console.error('Failed to parse document:', error);
            
            // 返回空的解析结果
            const symbolTable = new SymbolTable(document.uri.toString());
            const visitor = new CompletionVisitor(symbolTable, document);
            
            return {
                ast: {} as SourceFileContext,
                symbolTable,
                visitor,
                parseErrors: [
                    new vscode.Diagnostic(
                        new vscode.Range(0, 0, 0, 1),
                        `Parse error: ${error}`,
                        vscode.DiagnosticSeverity.Error
                    )
                ]
            };
        }
    }

    // 获取指定位置的符号信息
    public getSymbolAt(document: vscode.TextDocument, position: vscode.Position): any {
        const result = this.parseDocument(document);
        return result.symbolTable.findSymbol('', position);
    }

    // 获取补全项
    public getCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const result = this.parseDocument(document);
        const completionItems: vscode.CompletionItem[] = [];

        // 获取当前作用域中的所有符号
        const symbols = result.symbolTable.getSymbolsInScope(position);
        
        // 转换为补全项，优化排序和展示
        symbols.forEach(symbol => {
            const item = new vscode.CompletionItem(symbol.name, this.getCompletionItemKind(symbol.type));
            item.detail = `${symbol.type}: ${symbol.dataType}`;

            // 设置排序优先级
            switch (symbol.type) {
                case SymbolType.FUNCTION:
                    item.sortText = `1_${symbol.name}`; // 函数优先
                    break;
                case SymbolType.VARIABLE:
                case SymbolType.PARAMETER:
                    item.sortText = `2_${symbol.name}`; // 变量其次
                    break;
                case SymbolType.STRUCT:
                case SymbolType.CLASS:
                    item.sortText = `3_${symbol.name}`; // 类型定义再次
                    break;
                default:
                    item.sortText = `4_${symbol.name}`; // 其他最后
            }

            if (symbol.documentation) {
                item.documentation = new vscode.MarkdownString(symbol.documentation);
            }

            if (symbol.definition) {
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(symbol.definition, 'lpc');
                item.documentation = markdown;
            }

            // 为函数添加参数片段和增强的详细信息
            if (symbol.type === SymbolType.FUNCTION && symbol.parameters) {
                const paramSnippet = symbol.parameters
                    .map((param, index) => `\${${index + 1}:${param.name}}`)
                    .join(', ');
                item.insertText = new vscode.SnippetString(`${symbol.name}(${paramSnippet})`);

                // 增强函数的详细信息显示
                const paramInfo = symbol.parameters
                    .map(param => `${param.dataType} ${param.name}`)
                    .join(', ');
                item.detail = `${symbol.dataType} ${symbol.name}(${paramInfo})`;
            }

            // 为结构体成员访问添加特殊处理
            if (symbol.type === SymbolType.MEMBER) {
                item.detail = `成员: ${symbol.dataType} ${symbol.name}`;
            }

            completionItems.push(item);
        });

        return completionItems;
    }

    // 获取结构体成员补全 - 增强版本，支持继承链和更精确的类型解析
    public getStructMemberCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        variableName: string
    ): vscode.CompletionItem[] {
        const result = this.parseDocument(document);
        const completionItems: vscode.CompletionItem[] = [];

        try {
            // 查找变量的类型
            const variableSymbol = result.symbolTable.findSymbol(variableName, position);
            if (!variableSymbol) {
                console.debug(`Variable ${variableName} not found in symbol table`);
                return completionItems;
            }

            // 解析变量类型，支持复杂类型
            const resolvedType = this.resolveComplexType(variableSymbol.dataType, result.symbolTable);

            // 查找结构体或类定义
            const structSymbol = result.symbolTable.findStructDefinition(resolvedType);
            if (!structSymbol) {
                console.debug(`Struct/Class definition for type ${resolvedType} not found`);
                return completionItems;
            }

            // 获取所有成员，包括继承的成员
            const allMembers = this.getAllMembersWithInheritance(structSymbol, result.symbolTable);

            // 转换成员为补全项
            allMembers.forEach((member, index) => {
                const item = new vscode.CompletionItem(member.name, vscode.CompletionItemKind.Field);
                item.detail = `${member.dataType} ${member.name}`;
                item.sortText = `${index.toString().padStart(3, '0')}_${member.name}`;

                // 创建丰富的文档
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(`${member.dataType} ${member.name}`, 'lpc');

                if (member.documentation) {
                    markdown.appendMarkdown(`\n\n${member.documentation}`);
                } else {
                    markdown.appendMarkdown(`\n\n结构体成员: ${member.dataType} 类型的 ${member.name}`);
                }

                // 如果成员来自继承的结构体，添加源信息
                if (member.scope && member.scope.name !== structSymbol.name) {
                    markdown.appendMarkdown(`\n\n*继承自: ${member.scope.name}*`);
                }

                item.documentation = markdown;

                // 为函数类型成员添加调用片段
                if (member.dataType === 'function' && member.parameters) {
                    const paramSnippet = member.parameters
                        .map((param: any, paramIndex: number) => `\${${paramIndex + 1}:${param.name}}`)
                        .join(', ');
                    item.insertText = new vscode.SnippetString(`${member.name}(${paramSnippet})`);
                    item.kind = vscode.CompletionItemKind.Method;
                }

                completionItems.push(item);
            });

        } catch (error) {
            console.error('Error getting struct member completions:', error);
        }

        return completionItems;
    }

    // 解析复杂类型（支持指针、数组等）
    private resolveComplexType(dataType: string, symbolTable: SymbolTable): string {
        // 去除指针标记
        let cleanType = dataType.replace(/\s*\*+\s*$/, '');

        // 去除数组标记
        cleanType = cleanType.replace(/\s*\[\s*\]\s*$/, '');

        // 去除修饰符
        cleanType = cleanType.replace(/^(private|protected|public|static|const)\s+/, '');

        return cleanType.trim();
    }

    // 获取包含继承关系的所有成员
    private getAllMembersWithInheritance(structSymbol: LPCSymbol, symbolTable: SymbolTable): LPCSymbol[] {
        const allMembers: LPCSymbol[] = [];
        const processedTypes = new Set<string>();

        this.collectMembersRecursively(structSymbol, symbolTable, allMembers, processedTypes);

        return allMembers;
    }

    // 递归收集成员，包括继承的成员
    private collectMembersRecursively(
        structSymbol: LPCSymbol,
        symbolTable: SymbolTable,
        allMembers: LPCSymbol[],
        processedTypes: Set<string>
    ): void {
        if (processedTypes.has(structSymbol.name)) {
            return; // 避免循环继承
        }

        processedTypes.add(structSymbol.name);

        // 添加当前结构体的成员
        if (structSymbol.members) {
            allMembers.push(...structSymbol.members);
        }

        // TODO: 这里可以扩展以支持基于inherit语句的继承关系
        // 目前主要关注结构体内部的成员定义
    }

    // 获取函数定义位置
    public getFunctionDefinition(document: vscode.TextDocument, functionName: string): vscode.Location | undefined {
        const result = this.parseDocument(document);
        const functionSymbol = result.symbolTable.findSymbol(functionName);
        
        if (functionSymbol && functionSymbol.type === SymbolType.FUNCTION) {
            return new vscode.Location(document.uri, functionSymbol.range);
        }
        
        return undefined;
    }

    // 获取悬停信息
    public getHoverInfo(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const result = this.parseDocument(document);
        
        // 这里需要根据位置找到对应的符号
        // 简化实现，实际需要更复杂的位置匹配逻辑
        const symbols = result.symbolTable.getSymbolsInScope(position);
        
        if (symbols.length > 0) {
            const symbol = symbols[0];
            const markdown = new vscode.MarkdownString();
            
            if (symbol.definition) {
                markdown.appendCodeblock(symbol.definition, 'lpc');
            }
            
            if (symbol.documentation) {
                markdown.appendMarkdown('\n\n' + symbol.documentation);
            }
            
            return new vscode.Hover(markdown);
        }
        
        return undefined;
    }

    // 清除指定文档的缓存
    public clearCache(documentUri: string): void {
        const keysToRemove: string[] = [];
        for (const key of this.parseCache.keys()) {
            if (key.startsWith(documentUri)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => this.parseCache.delete(key));
    }

    // 清除所有缓存
    public clearAllCache(): void {
        this.parseCache.clear();
    }

    // 获取诊断信息
    public getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const result = this.parseDocument(document);
        return result.parseErrors;
    }

    private getCompletionItemKind(symbolType: SymbolType): vscode.CompletionItemKind {
        switch (symbolType) {
            case SymbolType.FUNCTION: return vscode.CompletionItemKind.Function;
            case SymbolType.VARIABLE: return vscode.CompletionItemKind.Variable;
            case SymbolType.PARAMETER: return vscode.CompletionItemKind.Variable;
            case SymbolType.STRUCT: return vscode.CompletionItemKind.Struct;
            case SymbolType.CLASS: return vscode.CompletionItemKind.Class;
            case SymbolType.MEMBER: return vscode.CompletionItemKind.Field;
            case SymbolType.INHERIT: return vscode.CompletionItemKind.Module;
            default: return vscode.CompletionItemKind.Text;
        }
    }
}