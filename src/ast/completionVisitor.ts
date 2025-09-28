import * as vscode from 'vscode';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';

// Import available context types from the generated parser
import {
    SourceFileContext,
    FunctionDefContext,
    VariableDeclContext,
    TypeSpecContext,
    ParameterContext,
    BlockContext,
    StatementContext,
    StructDefContext,
    ClassDefContext,
    StructMemberListContext,
    StructMemberContext,
    InheritStatementContext,
    ExpressionContext,
    IncludeStatementContext,
    IfStatementContext,
    WhileStatementContext,
    ForStatementContext,
    ForeachStatementContext,
    ExprStatementContext
} from '../antlr/LPCParser';

import { SymbolTable, Symbol, SymbolType, TypeResolver } from './symbolTable';

export class CompletionVisitor extends AbstractParseTreeVisitor<any> {
    private symbolTable: SymbolTable;
    private typeResolver: TypeResolver;
    private document: vscode.TextDocument;
    private currentFunction?: Symbol;

    constructor(symbolTable: SymbolTable, document: vscode.TextDocument) {
        super();
        this.symbolTable = symbolTable;
        this.typeResolver = new TypeResolver(symbolTable);
        this.document = document;
    }

    // 访问源文件根节点
    visitSourceFile(ctx: SourceFileContext): any {
        // 清空之前的符号表
        this.symbolTable.clear();
        
        // 手动访问所有语句
        try {
            const statements = ctx.statement ? ctx.statement() : [];
            if (Array.isArray(statements)) {
                statements.forEach((stmt: any) => this.visit(stmt));
            }
        } catch (error) {
            // 忽略语句解析错误
        }
        
        return null;
    }

    // 访问语句 - 增强版本，支持更多语句类型
    visitStatement(ctx: StatementContext): any {
        try {
            // 检查是否是函数定义
            const functionDef = ctx.functionDef ? ctx.functionDef() : null;
            if (functionDef) {
                return this.visitFunctionDef(functionDef);
            }

            // 检查是否是变量声明
            const variableDecl = ctx.variableDecl ? ctx.variableDecl() : null;
            if (variableDecl) {
                return this.visitVariableDecl(variableDecl);
            }

            // 检查是否是结构体定义
            const structDef = ctx.structDef ? ctx.structDef() : null;
            if (structDef) {
                return this.visitStructDef(structDef);
            }

            // 检查是否是类定义
            const classDef = ctx.classDef ? ctx.classDef() : null;
            if (classDef) {
                return this.visitClassDef(classDef);
            }

            // 检查是否是继承语句
            const inheritStmt = ctx.inheritStatement ? ctx.inheritStatement() : null;
            if (inheritStmt) {
                return this.visitInheritStatement(inheritStmt);
            }

            // 检查是否是包含语句
            const includeStmt = ctx.includeStatement ? ctx.includeStatement() : null;
            if (includeStmt) {
                return this.visitIncludeStatement(includeStmt);
            }

            // 检查是否是控制流语句
            const ifStmt = ctx.ifStatement ? ctx.ifStatement() : null;
            if (ifStmt) {
                return this.visitIfStatement(ifStmt);
            }

            const whileStmt = ctx.whileStatement ? ctx.whileStatement() : null;
            if (whileStmt) {
                return this.visitWhileStatement(whileStmt);
            }

            const forStmt = ctx.forStatement ? ctx.forStatement() : null;
            if (forStmt) {
                return this.visitForStatement(forStmt);
            }

            const foreachStmt = ctx.foreachStatement ? ctx.foreachStatement() : null;
            if (foreachStmt) {
                return this.visitForeachStatement(foreachStmt);
            }

            // 检查是否是代码块
            const block = ctx.block ? ctx.block() : null;
            if (block) {
                return this.visitBlock(block);
            }

            // 检查是否是表达式语句
            const exprStmt = ctx.exprStatement ? ctx.exprStatement() : null;
            if (exprStmt) {
                return this.visitExprStatement(exprStmt);
            }

            // 对于其他类型的语句，继续递归访问子节点
            if (ctx.children) {
                ctx.children.forEach(child => this.visit(child));
            }

        } catch (error) {
            // 忽略语句解析错误，但记录日志
            console.debug('Error visiting statement:', error);
        }

        return null;
    }

    // 访问函数定义
    visitFunctionDef(ctx: FunctionDefContext): any {
        const functionName = ctx.Identifier()?.text;
        if (!functionName) return;

        const range = this.getRange(ctx);
        const typeSpec = ctx.typeSpec();
        const returnType = typeSpec ? this.extractTypeFromContext(typeSpec) : 'void';
        
        // 提取修饰符
        const modifiers: string[] = [];
        if (ctx.MODIFIER()) {
            ctx.MODIFIER().forEach(mod => {
                modifiers.push(mod.text);
            });
        }

        // 创建函数符号
        const functionSymbol: Symbol = {
            name: functionName,
            type: SymbolType.FUNCTION,
            dataType: returnType,
            range: range,
            scope: this.symbolTable.getCurrentScope(),
            modifiers: modifiers,
            parameters: [],
            definition: this.getTextFromContext(ctx)
        };

        // 添加到符号表
        this.symbolTable.addSymbol(functionSymbol);
        this.currentFunction = functionSymbol;

        // 进入函数作用域
        const functionScope = this.symbolTable.enterScope(`function:${functionName}`, range);

        // 处理参数
        const paramList = ctx.parameterList();
        if (paramList) {
            this.visitParameterList(paramList);
        }

        // 访问函数体
        const block = ctx.block();
        if (block) {
            this.visitBlock(block);
        }

        // 退出函数作用域
        this.symbolTable.exitScope();
        this.currentFunction = undefined;

        return null;
    }

    // 访问参数列表
    visitParameterList(ctx: any): any {
        if (!ctx) return;

        try {
            const parameters = ctx.parameter ? ctx.parameter() : [];
            if (Array.isArray(parameters)) {
                parameters.forEach((param: any) => {
                    this.visitParameter(param);
                });
            }
        } catch (error) {
            // 忽略参数解析错误
        }
    }

    // 访问单个参数
    visitParameter(ctx: ParameterContext): any {
        const identifier = ctx.Identifier();
        if (!identifier) return;

        const paramName = identifier.text;
        const typeSpec = ctx.typeSpec();
        const paramType = typeSpec ? this.extractTypeFromContext(typeSpec) : 'mixed';
        
        const paramSymbol: Symbol = {
            name: paramName,
            type: SymbolType.PARAMETER,
            dataType: paramType,
            range: this.getRange(ctx),
            scope: this.symbolTable.getCurrentScope(),
            definition: this.getTextFromContext(ctx)
        };

        this.symbolTable.addSymbol(paramSymbol);
        
        // 添加到当前函数的参数列表
        if (this.currentFunction) {
            this.currentFunction.parameters = this.currentFunction.parameters || [];
            this.currentFunction.parameters.push(paramSymbol);
        }
    }

    // 访问变量声明
    visitVariableDecl(ctx: VariableDeclContext): any {
        const typeSpec = ctx.typeSpec();
        if (!typeSpec) return;

        const dataType = this.extractTypeFromContext(typeSpec);
        const modifiers: string[] = [];
        
        if (ctx.MODIFIER()) {
            ctx.MODIFIER().forEach(mod => {
                modifiers.push(mod.text);
            });
        }

        // 处理变量声明器
        const declarators = ctx.variableDeclarator();
        declarators.forEach(declarator => {
            const identifier = declarator.Identifier();
            if (identifier) {
                const varName = identifier.text;
                const varSymbol: Symbol = {
                    name: varName,
                    type: SymbolType.VARIABLE,
                    dataType: dataType,
                    range: this.getRange(declarator),
                    scope: this.symbolTable.getCurrentScope(),
                    modifiers: modifiers,
                    definition: this.getTextFromContext(ctx)
                };

                this.symbolTable.addSymbol(varSymbol);
            }
        });

        // 手动访问子节点
        try {
            const declarators = ctx.variableDeclarator ? ctx.variableDeclarator() : [];
            if (Array.isArray(declarators)) {
                declarators.forEach((declarator: any) => {
                    this.visit(declarator);
                });
            }
        } catch (error) {
            // 忽略声明器解析错误
        }
        return null;
    }

    // 访问结构体定义
    visitStructDef(ctx: StructDefContext): any {
        const structName = ctx.Identifier()?.text;
        if (!structName) return null;

        const range = this.getRange(ctx);
        
        // 创建结构体符号
        const structSymbol: Symbol = {
            name: structName,
            type: SymbolType.STRUCT,
            dataType: structName,
            range: range,
            scope: this.symbolTable.getCurrentScope(),
            members: [],
            definition: this.getTextFromContext(ctx)
        };

        // 添加到符号表
        this.symbolTable.addSymbol(structSymbol);

        // 进入结构体作用域
        const structScope = this.symbolTable.enterScope(`struct:${structName}`, range);

        // 处理结构体成员
        const memberList = ctx.structMemberList();
        if (memberList) {
            this.visitStructMemberList(memberList, structSymbol);
        }

        // 退出结构体作用域
        this.symbolTable.exitScope();

        return null;
    }

    // 访问类定义
    visitClassDef(ctx: ClassDefContext): any {
        const className = ctx.Identifier()?.text;
        if (!className) return null;

        const range = this.getRange(ctx);
        
        // 创建类符号
        const classSymbol: Symbol = {
            name: className,
            type: SymbolType.CLASS,
            dataType: className,
            range: range,
            scope: this.symbolTable.getCurrentScope(),
            members: [],
            definition: this.getTextFromContext(ctx)
        };

        // 添加到符号表
        this.symbolTable.addSymbol(classSymbol);

        // 进入类作用域
        const classScope = this.symbolTable.enterScope(`class:${className}`, range);

        // 处理类成员 (与结构体成员处理相同)
        const memberList = ctx.structMemberList();
        if (memberList) {
            this.visitStructMemberList(memberList, classSymbol);
        }

        // 退出类作用域
        this.symbolTable.exitScope();

        return null;
    }

    // 访问结构体成员列表
    visitStructMemberList(ctx: StructMemberListContext, parentSymbol: Symbol): any {
        try {
            const members = ctx.structMember ? ctx.structMember() : [];
            if (Array.isArray(members)) {
                members.forEach((member: any) => {
                    this.visitStructMember(member, parentSymbol);
                });
            }
        } catch (error) {
            console.debug('Error visiting struct member list:', error);
        }
        return null;
    }

    // 访问结构体成员
    visitStructMember(ctx: StructMemberContext, parentSymbol: Symbol): any {
        const typeSpec = ctx.typeSpec();
        if (!typeSpec) return null;

        const dataType = this.extractTypeFromContext(typeSpec);
        const identifier = ctx.Identifier();
        
        if (identifier) {
            const memberName = identifier.text;
            const memberSymbol: Symbol = {
                name: memberName,
                type: SymbolType.MEMBER,
                dataType: dataType,
                range: this.getRange(ctx),
                scope: this.symbolTable.getCurrentScope(),
                definition: this.getTextFromContext(ctx)
            };

            // 添加到父符号的成员列表
            if (parentSymbol.members) {
                parentSymbol.members.push(memberSymbol);
            }

            // 也添加到符号表中
            this.symbolTable.addSymbol(memberSymbol);
        }

        return null;
    }

    // 访问代码块
    visitBlock(ctx: BlockContext): any {
        const range = this.getRange(ctx);
        const blockScope = this.symbolTable.enterScope('block', range);
        
        // 手动访问块中的语句
        try {
            const statements = ctx.statement ? ctx.statement() : [];
            if (Array.isArray(statements)) {
                statements.forEach((stmt: any) => this.visit(stmt));
            }
        } catch (error) {
            // 忽略语句解析错误
        }
        
        this.symbolTable.exitScope();
        return null;
    }

    // 从类型规范上下文中提取类型字符串
    private extractTypeFromContext(ctx: TypeSpecContext): string {
        if (ctx.KW_INT()) return 'int';
        if (ctx.KW_FLOAT()) return 'float';
        if (ctx.KW_STRING()) return 'string';
        if (ctx.KW_OBJECT()) return 'object';
        if (ctx.KW_MIXED()) return 'mixed';
        if (ctx.KW_MAPPING()) return 'mapping';
        if (ctx.KW_FUNCTION()) return 'function';
        if (ctx.KW_BUFFER()) return 'buffer';
        if (ctx.KW_VOID()) return 'void';
        if (ctx.KW_STRUCT()) return 'struct';
        // KW_CLASS 暂时不可用，等待ANTLR重新生成
        // if (ctx.KW_CLASS()) return 'class';
        
        const identifier = ctx.Identifier();
        if (identifier) {
            return identifier.text;
        }
        
        return 'mixed';
    }

    // 从解析树上下文获取范围 - 增强版本，更好的位置映射
    private getRange(ctx: ParseTree): vscode.Range {
        try {
            // 尝试获取token信息
            if ('start' in ctx && 'stop' in ctx) {
                const startToken = (ctx as any).start;
                const stopToken = (ctx as any).stop || startToken;

                if (startToken && startToken.line !== undefined && startToken.charPositionInLine !== undefined) {
                    // 确保位置计算的准确性
                    const startLine = Math.max(0, startToken.line - 1); // ANTLR行号从1开始，VSCode从0开始
                    const startChar = Math.max(0, startToken.charPositionInLine);

                    const startPos = new vscode.Position(startLine, startChar);

                    let endPos: vscode.Position;
                    if (stopToken && stopToken.line !== undefined && stopToken.charPositionInLine !== undefined) {
                        const endLine = Math.max(0, stopToken.line - 1);
                        const tokenLength = stopToken.text ? stopToken.text.length : 1;
                        const endChar = Math.max(0, stopToken.charPositionInLine + tokenLength);
                        endPos = new vscode.Position(endLine, endChar);
                    } else {
                        // 如果没有停止token，估算结束位置
                        const estimatedLength = this.estimateTokenLength(ctx);
                        endPos = new vscode.Position(startLine, startChar + estimatedLength);
                    }

                    // 验证范围的有效性
                    if (this.isValidRange(startPos, endPos)) {
                        return new vscode.Range(startPos, endPos);
                    }
                }
            }

            // 尝试从文档位置推断范围
            return this.inferRangeFromDocument(ctx);

        } catch (error) {
            console.debug('Error getting range from context:', error);
        }

        // 返回更智能的默认范围
        return this.getDefaultRange();
    }

    // 估算token长度
    private estimateTokenLength(ctx: ParseTree): number {
        const text = ctx.text;
        if (text) {
            return text.length;
        }

        // 根据节点类型估算
        const typeName = ctx.constructor.name;
        switch (typeName) {
            case 'FunctionDefContext': return 10;
            case 'VariableDeclContext': return 8;
            case 'IdentifierContext': return 5;
            default: return 1;
        }
    }

    // 验证范围的有效性
    private isValidRange(start: vscode.Position, end: vscode.Position): boolean {
        return start.line <= end.line &&
               (start.line < end.line || start.character <= end.character);
    }

    // 从文档推断范围
    private inferRangeFromDocument(ctx: ParseTree): vscode.Range {
        try {
            const text = ctx.text;
            if (text && this.document) {
                // 在文档中查找匹配的文本
                const documentText = this.document.getText();
                const index = documentText.indexOf(text);
                if (index !== -1) {
                    const startPos = this.document.positionAt(index);
                    const endPos = this.document.positionAt(index + text.length);
                    return new vscode.Range(startPos, endPos);
                }
            }
        } catch (error) {
            console.debug('Error inferring range from document:', error);
        }

        return this.getDefaultRange();
    }

    // 获取默认范围
    private getDefaultRange(): vscode.Range {
        const start = new vscode.Position(0, 0);
        const end = new vscode.Position(0, 1);
        return new vscode.Range(start, end);
    }

    // 从上下文获取文本内容
    private getTextFromContext(ctx: ParseTree): string {
        return ctx.text || '';
    }

    // 获取符号表
    getSymbolTable(): SymbolTable {
        return this.symbolTable;
    }

    // 访问继承语句
    visitInheritStatement(ctx: InheritStatementContext): any {
        try {
            const expression = ctx.expression();
            if (!expression) return null;

            // 提取继承的文件路径
            const inheritPath = this.extractInheritPath(expression);
            if (!inheritPath) return null;

            const range = this.getRange(ctx);

            // 创建继承符号
            const inheritSymbol: Symbol = {
                name: inheritPath,
                type: SymbolType.INHERIT,
                dataType: 'inherit',
                range: range,
                scope: this.symbolTable.getCurrentScope(),
                definition: this.getTextFromContext(ctx),
                documentation: `继承自: ${inheritPath}`
            };

            // 添加到符号表
            this.symbolTable.addSymbol(inheritSymbol);

        } catch (error) {
            console.debug('Error visiting inherit statement:', error);
        }

        return null;
    }

    // 从表达式中提取继承路径
    private extractInheritPath(expression: ExpressionContext): string | null {
        try {
            // 获取表达式的文本内容
            const text = expression.text;

            // 处理字符串字面量 "path" 或 'path'
            const stringMatch = text.match(/^["'](.+)["']$/);
            if (stringMatch) {
                return stringMatch[1];
            }

            // 如果不是字符串字面量，直接返回文本
            return text;
        } catch (error) {
            console.debug('Error extracting inherit path:', error);
            return null;
        }
    }

    // 获取类型解析器
    getTypeResolver(): TypeResolver {
        return this.typeResolver;
    }

    // 访问包含语句
    visitIncludeStatement(ctx: IncludeStatementContext): any {
        try {
            // Include语句通常不需要添加到符号表，但可以记录依赖关系
            const range = this.getRange(ctx);
            console.debug('Include statement visited at range:', range);
        } catch (error) {
            console.debug('Error visiting include statement:', error);
        }
        return null;
    }

    // 访问if语句 - 处理局部变量作用域
    visitIfStatement(ctx: IfStatementContext): any {
        try {
            const range = this.getRange(ctx);
            const ifScope = this.symbolTable.enterScope('if', range);

            // 访问条件表达式和语句体
            if (ctx.children) {
                ctx.children.forEach(child => this.visit(child));
            }

            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting if statement:', error);
        }
        return null;
    }

    // 访问while语句 - 处理循环变量作用域
    visitWhileStatement(ctx: WhileStatementContext): any {
        try {
            const range = this.getRange(ctx);
            const whileScope = this.symbolTable.enterScope('while', range);

            // 访问条件表达式和语句体
            if (ctx.children) {
                ctx.children.forEach(child => this.visit(child));
            }

            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting while statement:', error);
        }
        return null;
    }

    // 访问for语句 - 特殊处理for循环变量
    visitForStatement(ctx: ForStatementContext): any {
        try {
            const range = this.getRange(ctx);
            const forScope = this.symbolTable.enterScope('for', range);

            // 访问初始化、条件、更新表达式和语句体
            if (ctx.children) {
                ctx.children.forEach(child => this.visit(child));
            }

            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting for statement:', error);
        }
        return null;
    }

    // 访问foreach语句 - 处理迭代变量
    visitForeachStatement(ctx: ForeachStatementContext): any {
        try {
            const range = this.getRange(ctx);
            const foreachScope = this.symbolTable.enterScope('foreach', range);

            // TODO: 提取foreach迭代变量并添加到作用域
            // foreach语句的具体实现需要根据ANTLR语法规则来处理

            // 访问语句体
            if (ctx.children) {
                ctx.children.forEach(child => this.visit(child));
            }

            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting foreach statement:', error);
        }
        return null;
    }

    // 访问表达式语句 - 增强局部变量识别
    visitExprStatement(ctx: ExprStatementContext): any {
        try {
            // 访问表达式，可能包含变量赋值等
            const expression = ctx.expression();
            if (expression) {
                this.visitExpression(expression);
            }
        } catch (error) {
            console.debug('Error visiting expression statement:', error);
        }
        return null;
    }

    // 访问表达式 - 增强类型推断
    visitExpression(ctx: ExpressionContext): any {
        try {
            // 分析可能的局部变量赋值
            this.analyzeLocalVariableAssignment(ctx);

            // 分析函数调用的返回类型
            this.analyzeFunctionCallTypes(ctx);

            // 分析对象创建表达式
            this.analyzeObjectCreation(ctx);

            // 递归访问子表达式
            if (ctx.children) {
                ctx.children.forEach(child => this.visit(child));
            }
        } catch (error) {
            console.debug('Error visiting expression:', error);
        }
        return null;
    }

    // 增强的局部变量识别方法
    private analyzeLocalVariableAssignment(ctx: ExpressionContext): void {
        try {
            const text = ctx.text;

            // 分析多种赋值模式
            const patterns = [
                // 简单赋值: var = value
                /(\w+)\s*=\s*(.+)/,
                // 数组元素赋值: var[index] = value
                /(\w+)\s*\[\s*[^\]]*\s*\]\s*=\s*(.+)/,
                // 成员赋值: obj->member = value
                /(\w+)\s*->\s*(\w+)\s*=\s*(.+)/,
                // 映射赋值: mapping[key] = value
                /(\w+)\s*\[\s*["'][^"']*["']\s*\]\s*=\s*(.+)/
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    this.processAssignmentMatch(match, pattern, ctx);
                    break;
                }
            }

            // 分析foreach循环变量
            this.analyzeForeachVariables(ctx);

            // 分析函数参数中的隐式变量
            this.analyzeImplicitParameters(ctx);

        } catch (error) {
            console.debug('Error analyzing local variable assignment:', error);
        }
    }

    // 处理赋值匹配
    private processAssignmentMatch(match: RegExpMatchArray, pattern: RegExp, ctx: ExpressionContext): void {
        if (pattern.source.includes('->')) {
            // 成员赋值 - 不创建新变量，但可以用于类型推断
            return;
        }

        const varName = match[1];
        const value = match[match.length - 1]; // 最后一个捕获组是值

        // 检查变量是否已存在
        const existingSymbol = this.symbolTable.findSymbol(varName);
        if (existingSymbol) {
            // 更新现有变量的类型（类型推断）
            const inferredType = this.typeResolver.inferExpressionType(value, new vscode.Position(0, 0));
            if (inferredType !== 'mixed' && inferredType !== existingSymbol.dataType) {
                console.debug(`Type inference: ${varName} type refined from ${existingSymbol.dataType} to ${inferredType}`);
            }
            return;
        }

        // 推断类型并创建新的局部变量符号
        const inferredType = this.typeResolver.inferExpressionType(value, new vscode.Position(0, 0));

        const varSymbol: Symbol = {
            name: varName,
            type: SymbolType.VARIABLE,
            dataType: inferredType,
            range: this.getRange(ctx),
            scope: this.symbolTable.getCurrentScope(),
            definition: match[0],
            documentation: `局部变量 (类型推断: ${inferredType})`
        };

        this.symbolTable.addSymbol(varSymbol);
    }

    // 分析foreach循环变量
    private analyzeForeachVariables(ctx: ExpressionContext): void {
        const text = ctx.text;

        // foreach语句模式: foreach(var in array) 或 foreach(key, value in mapping)
        const foreachPatterns = [
            /foreach\s*\(\s*(\w+)\s+in\s+(.+)\s*\)/, // foreach(var in array)
            /foreach\s*\(\s*(\w+)\s*,\s*(\w+)\s+in\s+(.+)\s*\)/ // foreach(key, value in mapping)
        ];

        for (const pattern of foreachPatterns) {
            const match = text.match(pattern);
            if (match) {
                this.createForeachVariables(match, ctx);
                break;
            }
        }
    }

    // 创建foreach变量
    private createForeachVariables(match: RegExpMatchArray, ctx: ExpressionContext): void {
        const range = this.getRange(ctx);

        if (match.length === 3) {
            // 单变量foreach: foreach(var in array)
            const varName = match[1];
            const arrayExpr = match[2];
            const elementType = this.inferArrayElementType(arrayExpr);

            const varSymbol: Symbol = {
                name: varName,
                type: SymbolType.VARIABLE,
                dataType: elementType,
                range: range,
                scope: this.symbolTable.getCurrentScope(),
                definition: `foreach variable: ${varName}`,
                documentation: `Foreach循环变量 (元素类型: ${elementType})`
            };

            this.symbolTable.addSymbol(varSymbol);
        } else if (match.length === 4) {
            // 双变量foreach: foreach(key, value in mapping)
            const keyName = match[1];
            const valueName = match[2];
            const mappingExpr = match[3];

            // 键通常是字符串或整数
            const keySymbol: Symbol = {
                name: keyName,
                type: SymbolType.VARIABLE,
                dataType: 'mixed', // 键类型可能是string或int
                range: range,
                scope: this.symbolTable.getCurrentScope(),
                definition: `foreach key: ${keyName}`,
                documentation: 'Foreach循环键变量'
            };

            // 值类型从映射推断
            const valueType = this.inferMappingValueType(mappingExpr);
            const valueSymbol: Symbol = {
                name: valueName,
                type: SymbolType.VARIABLE,
                dataType: valueType,
                range: range,
                scope: this.symbolTable.getCurrentScope(),
                definition: `foreach value: ${valueName}`,
                documentation: `Foreach循环值变量 (类型: ${valueType})`
            };

            this.symbolTable.addSymbol(keySymbol);
            this.symbolTable.addSymbol(valueSymbol);
        }
    }

    // 推断数组元素类型
    private inferArrayElementType(arrayExpr: string): string {
        // 简化的类型推断
        if (arrayExpr.includes('string')) return 'string';
        if (arrayExpr.includes('int')) return 'int';
        if (arrayExpr.includes('object')) return 'object';

        // 查找变量类型
        const varMatch = arrayExpr.match(/^\s*(\w+)\s*$/);
        if (varMatch) {
            const varSymbol = this.symbolTable.findSymbol(varMatch[1]);
            if (varSymbol && varSymbol.dataType.endsWith('*')) {
                return varSymbol.dataType.slice(0, -1); // 去除*号得到元素类型
            }
        }

        return 'mixed';
    }

    // 推断映射值类型
    private inferMappingValueType(mappingExpr: string): string {
        // 这是一个简化版本，实际应该更复杂
        const varMatch = mappingExpr.match(/^\s*(\w+)\s*$/);
        if (varMatch) {
            const varSymbol = this.symbolTable.findSymbol(varMatch[1]);
            if (varSymbol && varSymbol.dataType === 'mapping') {
                // 如果有类型注释信息，可以进一步解析
                return 'mixed';
            }
        }
        return 'mixed';
    }

    // 分析隐式参数
    private analyzeImplicitParameters(ctx: ExpressionContext): void {
        // 分析形如 sscanf(str, "%s %d", var1, var2) 的情况
        // 其中var1, var2会被隐式赋值
        const text = ctx.text;

        const sscanfPattern = /sscanf\s*\([^,]+,\s*["'][^"']*["']\s*,\s*(.+)\)/;
        const match = text.match(sscanfPattern);

        if (match) {
            const variables = match[1].split(',').map(v => v.trim());
            variables.forEach(varName => {
                if (varName.match(/^\w+$/)) { // 简单变量名
                    // 这些变量会被sscanf赋值，类型根据格式字符串推断
                    const inferredType = 'mixed'; // 简化版本

                    const varSymbol: Symbol = {
                        name: varName,
                        type: SymbolType.VARIABLE,
                        dataType: inferredType,
                        range: this.getRange(ctx),
                        scope: this.symbolTable.getCurrentScope(),
                        definition: `sscanf output: ${varName}`,
                        documentation: '通过sscanf函数赋值的变量'
                    };

                    // 只在变量不存在时添加
                    if (!this.symbolTable.findSymbol(varName)) {
                        this.symbolTable.addSymbol(varSymbol);
                    }
                }
            });
        }
    }

    // 分析函数调用类型
    private analyzeFunctionCallTypes(ctx: ExpressionContext): void {
        try {
            const text = ctx.text;

            // 识别函数调用模式
            const functionCallPattern = /(\w+)\s*\(/;
            const match = text.match(functionCallPattern);

            if (match) {
                const functionName = match[1];

                // 查找函数定义获取返回类型
                const functionSymbol = this.symbolTable.findSymbol(functionName);
                if (functionSymbol && functionSymbol.type === SymbolType.FUNCTION) {
                    // 这个信息可以用于后续的类型推断
                    console.debug(`Function call detected: ${functionName} returns ${functionSymbol.dataType}`);
                }
            }
        } catch (error) {
            console.debug('Error analyzing function call types:', error);
        }
    }

    // 分析对象创建表达式
    private analyzeObjectCreation(ctx: ExpressionContext): void {
        try {
            const text = ctx.text;

            // new()表达式用于创建结构体实例
            const newExprPattern = /new\s*\(\s*(\w+)(?:\s*,\s*[^)]+)?\s*\)/;
            const match = text.match(newExprPattern);

            if (match) {
                const structType = match[1];
                console.debug(`Object creation detected: new(${structType})`);

                // 这个信息可以用于类型推断
                // 如果这个表达式被赋值给变量，那个变量的类型就是structType
            }
        } catch (error) {
            console.debug('Error analyzing object creation:', error);
        }
    }

    // 默认访问方法
    protected defaultResult(): any {
        return null;
    }
}