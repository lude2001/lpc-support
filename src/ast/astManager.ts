import * as vscode from 'vscode';
import { SourceFileContext } from '../antlr/LPCParser';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../parser/ParsedDocumentService';
import { SymbolTable, SymbolType, Symbol as LPCSymbol } from './symbolTable';
import { getTypeLookupName, normalizeLpcType } from './typeNormalization';
import {
    DocumentAnalysisService,
    DocumentSemanticAnalysis
} from '../semantic/documentAnalysisService';
import { DocumentSemanticSnapshot } from '../semantic/documentSemanticTypes';
import { DocumentSemanticSnapshotService } from '../semantic/documentSemanticSnapshotService';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { SyntaxDocument } from '../syntax/types';
import { ParsedDocument as ParsedDoc } from '../parser/types';

export interface ParseResult {
    ast: SourceFileContext;
    symbolTable: SymbolTable;
    parseErrors: vscode.Diagnostic[];
    parsed?: ParsedDoc;
    syntax?: SyntaxDocument;
    semantic?: SemanticSnapshot;
    snapshot: DocumentSemanticSnapshot;
}

export class ASTManager {
    private static instance: ASTManager;
    private readonly snapshotService: DocumentAnalysisService;

    private constructor(snapshotService: DocumentAnalysisService = DocumentSemanticSnapshotService.getInstance()) {
        this.snapshotService = snapshotService;
    }

    public static getInstance(): ASTManager {
        if (!ASTManager.instance) {
            ASTManager.instance = new ASTManager();
        }
        return ASTManager.instance;
    }

    // 解析文档并构建AST和符号表
    public parseDocument(document: vscode.TextDocument, useCache: boolean = true): ParseResult {
        const analysis = this.snapshotService.parseDocument(document, useCache);
        return this.toParseResult(analysis);
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
            item.detail = `${symbol.type}: ${normalizeLpcType(symbol.dataType)}`;

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
                item.detail = `${normalizeLpcType(symbol.dataType)} ${symbol.name}(${paramInfo})`;
            }

            // 为结构体成员访问添加特殊处理
            if (symbol.type === SymbolType.MEMBER) {
                item.detail = `成员: ${normalizeLpcType(symbol.dataType)} ${symbol.name}`;
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
            const resolvedType = this.resolveComplexType(variableSymbol.dataType);

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
                item.detail = `${normalizeLpcType(member.dataType)} ${member.name}`;
                item.sortText = `${index.toString().padStart(3, '0')}_${member.name}`;

                // 创建丰富的文档
                const markdown = new vscode.MarkdownString();
                markdown.appendCodeblock(`${normalizeLpcType(member.dataType)} ${member.name}`, 'lpc');

                if (member.documentation) {
                    markdown.appendMarkdown(`\n\n${member.documentation}`);
                } else {
                    markdown.appendMarkdown(`\n\n结构体成员: ${normalizeLpcType(member.dataType)} 类型的 ${member.name}`);
                }

                // 如果成员来自继承的结构体，添加源信息
                if (member.scope && member.scope.name !== structSymbol.name) {
                    markdown.appendMarkdown(`\n\n*继承自: ${member.scope.name}*`);
                }

                item.documentation = markdown;

                // 为函数类型成员添加调用片段
                if (getTypeLookupName(member.dataType) === 'function' && member.parameters) {
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
    private resolveComplexType(dataType: string): string {
        return getTypeLookupName(dataType);
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

        // 处理基于inherit语句的继承关系
        // 查找当前文档中的所有inherit语句
        const inheritedFiles = symbolTable.getInheritedFiles();

        // 对于每个继承的文件，尝试查找匹配的结构体或类定义
        for (const inheritedFile of inheritedFiles) {
            // 从继承的文件路径中提取可能的类型名
            // 例如: /std/object -> object, /base/creature -> creature
            const possibleTypeName = this.extractTypeNameFromPath(inheritedFile);

            // 尝试查找该类型的定义
            const inheritedSymbol = symbolTable.findStructDefinition(possibleTypeName);
            if (inheritedSymbol && inheritedSymbol.name !== structSymbol.name) {
                // 递归收集继承类型的成员
                this.collectMembersRecursively(inheritedSymbol, symbolTable, allMembers, processedTypes);
            }
        }

        // 检查当前结构体是否有显式的基类声明(如果语法支持)
        // 这部分留待未来扩展，当LPC语法规则中有明确的基类引用时
    }

    // 从文件路径提取类型名
    private extractTypeNameFromPath(filePath: string): string {
        // 移除文件扩展名
        let typeName = filePath.replace(/\.(c|h)$/i, '');

        // 获取文件名部分(移除路径)
        const parts = typeName.split('/');
        typeName = parts[parts.length - 1];

        // 移除前导下划线
        typeName = typeName.replace(/^_+/, '');

        return typeName;
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
            markdown.isTrusted = true;
            markdown.supportHtml = true;

            // 定义/签名
            if (symbol.definition) {
                markdown.appendMarkdown(`\`\`\`lpc\n${symbol.definition}\n\`\`\`\n\n`);
            }

            // 符号类型标签
            const typeLabel = this.getSymbolTypeLabel(symbol.type);
            if (symbol.scope && symbol.scope.name) {
                markdown.appendMarkdown(`<sub>${typeLabel} · ${symbol.scope.name}</sub>\n\n`);
            } else {
                markdown.appendMarkdown(`<sub>${typeLabel}</sub>\n\n`);
            }

            markdown.appendMarkdown(`---\n\n`);

            // 文档注释
            if (symbol.documentation) {
                markdown.appendMarkdown(symbol.documentation + '\n\n');
            }

            // 类型信息
            if (symbol.dataType && symbol.type !== SymbolType.FUNCTION) {
                markdown.appendMarkdown(`**Type:** \`${symbol.dataType}\`\n\n`);
            }

            // 函数参数信息 - 使用表格
            if (symbol.type === SymbolType.FUNCTION && symbol.parameters && symbol.parameters.length > 0) {
                markdown.appendMarkdown(`#### Parameters\n\n`);
                markdown.appendMarkdown(`| Name | Type |\n`);
                markdown.appendMarkdown(`|------|------|\n`);
                symbol.parameters.forEach((param: any) => {
                    markdown.appendMarkdown(`| \`${param.name}\` | \`${param.dataType}\` |\n`);
                });
                markdown.appendMarkdown(`\n`);
            }

            return new vscode.Hover(markdown);
        }

        return undefined;
    }

    /**
     * 获取符号类型的文本标签
     */
    private getSymbolTypeLabel(symbolType: SymbolType): string {
        switch (symbolType) {
            case SymbolType.FUNCTION:
                return 'Function';
            case SymbolType.VARIABLE:
                return 'Variable';
            case SymbolType.PARAMETER:
                return 'Parameter';
            case SymbolType.STRUCT:
                return 'Struct';
            case SymbolType.CLASS:
                return 'Class';
            case SymbolType.MEMBER:
                return 'Member';
            case SymbolType.INHERIT:
                return 'Inherit';
            default:
                return 'Symbol';
        }
    }

    // 清除指定文档的缓存
    public clearCache(documentUri: string): void {
        this.snapshotService.clearCache(documentUri);
        const uri = vscode.Uri.parse(documentUri);
        getGlobalParsedDocumentService().invalidate(uri);
    }

    // 清除所有缓存
    public clearAllCache(): void {
        this.snapshotService.clearAllCache();
        clearGlobalParsedDocumentService();
    }

    // 获取诊断信息
    public getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const result = this.parseDocument(document);
        return result.parseErrors;
    }

    public getSnapshot(document: vscode.TextDocument, useCache: boolean = true): DocumentSemanticSnapshot {
        return this.snapshotService.getSnapshot(document, useCache);
    }

    public getBestAvailableSnapshot(document: vscode.TextDocument): DocumentSemanticSnapshot {
        return this.snapshotService.getBestAvailableSnapshot(document);
    }

    public getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.snapshotService.getSemanticSnapshot(document, useCache);
    }

    public getBestAvailableSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot {
        return this.snapshotService.getBestAvailableSemanticSnapshot(document);
    }

    public scheduleSnapshotRefresh(
        document: vscode.TextDocument,
        onReady?: (snapshot: DocumentSemanticSnapshot) => void
    ): void {
        this.snapshotService.scheduleRefresh(document, onReady);
    }

    public hasSnapshot(document: vscode.TextDocument): boolean {
        return this.snapshotService.hasSnapshot(document);
    }

    public hasFreshSnapshot(document: vscode.TextDocument): boolean {
        return this.snapshotService.hasFreshSnapshot(document);
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

    public getSyntaxDocument(document: vscode.TextDocument, useCache: boolean = true): SyntaxDocument | undefined {
        return this.snapshotService.getSyntaxDocument(document, useCache);
    }

    private toParseResult(analysis: DocumentSemanticAnalysis): ParseResult {
        return {
            ast: analysis.ast,
            symbolTable: analysis.symbolTable,
            parseErrors: analysis.parseErrors,
            parsed: analysis.parsed,
            syntax: analysis.syntax,
            semantic: analysis.semantic,
            snapshot: analysis.snapshot
        };
    }
}
