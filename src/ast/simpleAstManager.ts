import * as vscode from 'vscode';
import { SymbolTable, Symbol, SymbolType } from './symbolTable';

// 简化的AST管理器，用于在编译问题解决前提供基本功能
export class SimpleASTManager {
    private symbolTables: Map<string, SymbolTable> = new Map();
    private static instance: SimpleASTManager;

    private constructor() {}

    public static getInstance(): SimpleASTManager {
        if (!SimpleASTManager.instance) {
            SimpleASTManager.instance = new SimpleASTManager();
        }
        return SimpleASTManager.instance;
    }

    // 解析文档并构建基本的符号表（使用简化的正则解析）
    public parseDocument(document: vscode.TextDocument): SymbolTable {
        const cacheKey = `${document.uri.toString()}_${document.version}`;
        
        if (this.symbolTables.has(cacheKey)) {
            return this.symbolTables.get(cacheKey)!;
        }

        const symbolTable = new SymbolTable(document.uri.toString());
        const text = document.getText();
        const lines = text.split('\n');

        // 解析函数定义
        this.parseFunctions(text, lines, symbolTable);
        
        // 解析变量声明
        this.parseVariables(text, lines, symbolTable);
        
        // 解析结构体/类定义
        this.parseStructsAndClasses(text, lines, symbolTable);

        // 缓存结果
        this.symbolTables.set(cacheKey, symbolTable);
        
        // 限制缓存大小
        if (this.symbolTables.size > 50) {
            const firstKey = this.symbolTables.keys().next().value;
            if (firstKey) {
                this.symbolTables.delete(firstKey);
            }
        }

        return symbolTable;
    }

    private parseFunctions(text: string, lines: string[], symbolTable: SymbolTable): void {
        // 匹配函数定义
        const functionRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer|struct|class|\w+)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
        
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const functionDefinition = match[0];
            
            // 找到函数的行号
            const lineIndex = this.findLineIndex(lines, functionDefinition);
            const range = new vscode.Range(lineIndex, 0, lineIndex, functionDefinition.length);
            
            // 解析返回类型
            const returnTypeMatch = functionDefinition.match(/(?:private|public|protected|static|nomask|varargs\s+)*(\w+)\s+\w+\s*\(/);
            const returnType = returnTypeMatch ? returnTypeMatch[1] : 'mixed';
            
            const functionSymbol: Symbol = {
                name: functionName,
                type: SymbolType.FUNCTION,
                dataType: returnType,
                range: range,
                scope: symbolTable.getGlobalScope(),
                definition: functionDefinition,
                parameters: []
            };

            symbolTable.addSymbol(functionSymbol);
        }
    }

    private parseVariables(text: string, lines: string[], symbolTable: SymbolTable): void {
        // 匹配变量声明
        const variableRegex = /(?:(?:private|public|protected|static|nosave)\s+)*(?:int|string|object|mapping|mixed|float|buffer|struct|class|\w+)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:=\s*[^;]+)?\s*;/g;
        
        let match;
        while ((match = variableRegex.exec(text)) !== null) {
            const variableDefinition = match[0];
            const variableNames = match[1];
            
            // 解析变量类型
            const typeMatch = variableDefinition.match(/(?:private|public|protected|static|nosave\s+)*(\w+)\s+/);
            const dataType = typeMatch ? typeMatch[1] : 'mixed';
            
            // 处理多个变量声明
            const names = variableNames.split(',').map(name => name.trim());
            const lineIndex = this.findLineIndex(lines, variableDefinition);
            
            names.forEach(varName => {
                const range = new vscode.Range(lineIndex, 0, lineIndex, variableDefinition.length);
                
                const variableSymbol: Symbol = {
                    name: varName,
                    type: SymbolType.VARIABLE,
                    dataType: dataType,
                    range: range,
                    scope: symbolTable.getGlobalScope(),
                    definition: variableDefinition
                };

                symbolTable.addSymbol(variableSymbol);
            });
        }
    }

    private parseStructsAndClasses(text: string, lines: string[], symbolTable: SymbolTable): void {
        // 匹配结构体/类定义
        const structRegex = /(?:struct|class)\s+(\w+)\s*\{([^}]+)\}/g;
        
        let match;
        while ((match = structRegex.exec(text)) !== null) {
            const typeName = match[1];
            const structBody = match[2];
            const structDefinition = match[0];
            
            const lineIndex = this.findLineIndex(lines, structDefinition);
            const range = new vscode.Range(lineIndex, 0, lineIndex + structDefinition.split('\n').length, 0);
            
            const structSymbol: Symbol = {
                name: typeName,
                type: SymbolType.STRUCT,
                dataType: typeName,
                range: range,
                scope: symbolTable.getGlobalScope(),
                definition: structDefinition,
                members: []
            };

            // 解析结构体成员
            const memberRegex = /(?:^|\n)\s*(\w+(?:\s*\*)*)\s+(\w+)\s*;/gm;
            let memberMatch;
            
            while ((memberMatch = memberRegex.exec(structBody)) !== null) {
                const memberType = memberMatch[1].trim();
                const memberName = memberMatch[2];
                
                const memberSymbol: Symbol = {
                    name: memberName,
                    type: SymbolType.MEMBER,
                    dataType: memberType,
                    range: range, // 简化：使用结构体的范围
                    scope: symbolTable.getGlobalScope(),
                    definition: `${memberType} ${memberName};`
                };

                structSymbol.members!.push(memberSymbol);
            }

            symbolTable.addSymbol(structSymbol);
        }
    }

    private findLineIndex(lines: string[], text: string): number {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(text.split('\n')[0])) {
                return i;
            }
        }
        return 0;
    }

    // 获取补全项
    public getCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
        const symbolTable = this.parseDocument(document);
        const completionItems: vscode.CompletionItem[] = [];

        // 获取所有符号并转换为补全项
        const allSymbols = symbolTable.getSymbolsInScope(position);
        
        allSymbols.forEach(symbol => {
            const item = new vscode.CompletionItem(symbol.name, this.getCompletionItemKind(symbol.type));
            item.detail = `${symbol.type}: ${symbol.dataType}`;
            
            if (symbol.definition) {
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(symbol.definition, 'lpc');
                item.documentation = markdown;
            }

            // 为函数添加参数片段
            if (symbol.type === SymbolType.FUNCTION) {
                item.insertText = new vscode.SnippetString(`${symbol.name}($1)`);
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
        const symbolTable = this.parseDocument(document);
        const completionItems: vscode.CompletionItem[] = [];

        // 查找变量的类型
        const variableSymbol = symbolTable.findSymbol(variableName, position);
        if (!variableSymbol) return completionItems;

        // 查找结构体定义
        const structSymbol = symbolTable.findStructDefinition(variableSymbol.dataType);
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

    // 清除指定文档的缓存
    public clearCache(documentUri: string): void {
        const keysToRemove: string[] = [];
        for (const key of this.symbolTables.keys()) {
            if (key.startsWith(documentUri)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => this.symbolTables.delete(key));
    }

    // 清除所有缓存
    public clearAllCache(): void {
        this.symbolTables.clear();
    }

    private getCompletionItemKind(symbolType: SymbolType): vscode.CompletionItemKind {
        switch (symbolType) {
            case SymbolType.FUNCTION: return vscode.CompletionItemKind.Function;
            case SymbolType.VARIABLE: return vscode.CompletionItemKind.Variable;
            case SymbolType.PARAMETER: return vscode.CompletionItemKind.Variable;
            case SymbolType.STRUCT: return vscode.CompletionItemKind.Struct;
            case SymbolType.CLASS: return vscode.CompletionItemKind.Class;
            case SymbolType.MEMBER: return vscode.CompletionItemKind.Field;
            default: return vscode.CompletionItemKind.Text;
        }
    }
}