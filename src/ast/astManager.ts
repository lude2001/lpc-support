import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser, SourceFileContext } from '../antlr/LPCParser';
import { SymbolTable } from './symbolTable';
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
        
        // 转换为补全项
        symbols.forEach(symbol => {
            const item = new vscode.CompletionItem(symbol.name, this.getCompletionItemKind(symbol.type));
            item.detail = `${symbol.type}: ${symbol.dataType}`;
            
            if (symbol.documentation) {
                item.documentation = new vscode.MarkdownString(symbol.documentation);
            }
            
            if (symbol.definition) {
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(symbol.definition, 'lpc');
                item.documentation = markdown;
            }

            // 为函数添加参数片段
            if (symbol.type === 'function' && symbol.parameters) {
                const paramSnippet = symbol.parameters
                    .map((param, index) => `\${${index + 1}:${param.name}}`)
                    .join(', ');
                item.insertText = new vscode.SnippetString(`${symbol.name}(${paramSnippet})`);
            }

            completionItems.push(item);
        });

        return completionItems;
    }

    // 获取结构体成员补全
    public getStructMemberCompletions(
        document: vscode.TextDocument, 
        position: vscode.Position, 
        variableName: string
    ): vscode.CompletionItem[] {
        const result = this.parseDocument(document);
        const completionItems: vscode.CompletionItem[] = [];

        // 查找变量的类型
        const variableSymbol = result.symbolTable.findSymbol(variableName, position);
        if (!variableSymbol) return completionItems;

        // 查找结构体定义
        const structSymbol = result.symbolTable.findStructDefinition(variableSymbol.dataType);
        if (!structSymbol || !structSymbol.members) return completionItems;

        // 转换成员为补全项
        structSymbol.members.forEach(member => {
            const item = new vscode.CompletionItem(member.name, vscode.CompletionItemKind.Field);
            item.detail = `${member.dataType} ${member.name}`;
            item.documentation = `结构体成员: ${member.dataType} 类型的 ${member.name}`;
            completionItems.push(item);
        });

        return completionItems;
    }

    // 获取函数定义位置
    public getFunctionDefinition(document: vscode.TextDocument, functionName: string): vscode.Location | undefined {
        const result = this.parseDocument(document);
        const functionSymbol = result.symbolTable.findSymbol(functionName);
        
        if (functionSymbol && functionSymbol.type === 'function') {
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

    private getCompletionItemKind(symbolType: string): vscode.CompletionItemKind {
        switch (symbolType) {
            case 'function': return vscode.CompletionItemKind.Function;
            case 'variable': return vscode.CompletionItemKind.Variable;
            case 'parameter': return vscode.CompletionItemKind.Variable;
            case 'struct': return vscode.CompletionItemKind.Struct;
            case 'class': return vscode.CompletionItemKind.Class;
            case 'member': return vscode.CompletionItemKind.Field;
            default: return vscode.CompletionItemKind.Text;
        }
    }
}