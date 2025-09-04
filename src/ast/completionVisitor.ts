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
    StructMemberContext
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

    // 访问语句 - 这是关键的缺失方法
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

            // 检查是否是代码块
            const block = ctx.block ? ctx.block() : null;
            if (block) {
                return this.visitBlock(block);
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

    // 从解析树上下文获取范围
    private getRange(ctx: ParseTree): vscode.Range {
        try {
            // 尝试获取token信息
            if ('start' in ctx && 'stop' in ctx) {
                const startToken = (ctx as any).start;
                const stopToken = (ctx as any).stop || startToken;
                
                if (startToken && startToken.line !== undefined && startToken.charPositionInLine !== undefined) {
                    const startPos = new vscode.Position(
                        startToken.line - 1, // ANTLR行号从1开始，VSCode从0开始
                        startToken.charPositionInLine
                    );
                    
                    const endPos = stopToken && stopToken.line !== undefined ? 
                        new vscode.Position(
                            stopToken.line - 1,
                            stopToken.charPositionInLine + (stopToken.text ? stopToken.text.length : 1)
                        ) : 
                        new vscode.Position(startPos.line, startPos.character + 1);
                    
                    return new vscode.Range(startPos, endPos);
                }
            }
        } catch (error) {
            // 如果无法获取位置信息，返回默认范围
        }
        
        // 默认范围
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

    // 获取类型解析器
    getTypeResolver(): TypeResolver {
        return this.typeResolver;
    }

    // 默认访问方法
    protected defaultResult(): any {
        return null;
    }
}