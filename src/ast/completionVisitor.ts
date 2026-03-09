import * as vscode from 'vscode';
import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    BlockContext,
    ClassDefContext,
    ExprStatementContext,
    ExpressionContext,
    ForeachStatementContext,
    ForStatementContext,
    FunctionDefContext,
    IfStatementContext,
    IncludeStatementContext,
    InheritStatementContext,
    LPCParser,
    ParameterContext,
    SourceFileContext,
    StatementContext,
    StructDefContext,
    StructMemberContext,
    StructMemberListContext,
    TypeSpecContext,
    VariableDeclContext,
    WhileStatementContext
} from '../antlr/LPCParser';
import { IncludeDirective, InheritDirective } from '../completion/types';
import { Symbol, SymbolTable, SymbolType, TypeResolver } from './symbolTable';
import { composeLpcType, normalizeLpcType } from './typeNormalization';

export class CompletionVisitor extends AbstractParseTreeVisitor<any> {
    private readonly symbolTable: SymbolTable;
    private readonly typeResolver: TypeResolver;
    private readonly document: vscode.TextDocument;
    private currentFunction?: Symbol;
    private inheritDirectives: InheritDirective[] = [];
    private includeDirectives: IncludeDirective[] = [];

    constructor(symbolTable: SymbolTable, document: vscode.TextDocument) {
        super();
        this.symbolTable = symbolTable;
        this.typeResolver = new TypeResolver(symbolTable);
        this.document = document;
    }

    visitSourceFile(ctx: SourceFileContext): any {
        this.symbolTable.clear();
        this.inheritDirectives = [];
        this.includeDirectives = [];

        this.visitStatements(ctx.statement ? ctx.statement() : []);
        return null;
    }

    visitStatement(ctx: StatementContext): any {
        try {
            const functionDef = ctx.functionDef ? ctx.functionDef() : null;
            if (functionDef) {
                return this.visitFunctionDef(functionDef);
            }

            const variableDecl = ctx.variableDecl ? ctx.variableDecl() : null;
            if (variableDecl) {
                return this.visitVariableDecl(variableDecl);
            }

            const structDef = ctx.structDef ? ctx.structDef() : null;
            if (structDef) {
                return this.visitStructDef(structDef);
            }

            const classDef = ctx.classDef ? ctx.classDef() : null;
            if (classDef) {
                return this.visitClassDef(classDef);
            }

            const inheritStatement = ctx.inheritStatement ? ctx.inheritStatement() : null;
            if (inheritStatement) {
                return this.visitInheritStatement(inheritStatement);
            }

            const includeStatement = ctx.includeStatement ? ctx.includeStatement() : null;
            if (includeStatement) {
                return this.visitIncludeStatement(includeStatement);
            }

            const ifStatement = ctx.ifStatement ? ctx.ifStatement() : null;
            if (ifStatement) {
                return this.visitIfStatement(ifStatement);
            }

            const whileStatement = ctx.whileStatement ? ctx.whileStatement() : null;
            if (whileStatement) {
                return this.visitWhileStatement(whileStatement);
            }

            const forStatement = ctx.forStatement ? ctx.forStatement() : null;
            if (forStatement) {
                return this.visitForStatement(forStatement);
            }

            const foreachStatement = ctx.foreachStatement ? ctx.foreachStatement() : null;
            if (foreachStatement) {
                return this.visitForeachStatement(foreachStatement);
            }

            const block = ctx.block ? ctx.block() : null;
            if (block) {
                return this.visitBlock(block);
            }

            const exprStatement = ctx.exprStatement ? ctx.exprStatement() : null;
            if (exprStatement) {
                return this.visitExprStatement(exprStatement);
            }
        } catch (error) {
            console.debug('Error visiting statement:', error);
        }

        return null;
    }

    visitFunctionDef(ctx: FunctionDefContext): any {
        const functionName = ctx.Identifier()?.text;
        if (!functionName) {
            return null;
        }

        const range = this.getRange(ctx);
        const functionSymbol: Symbol = {
            name: functionName,
            type: SymbolType.FUNCTION,
            dataType: ctx.typeSpec()
                ? this.extractDeclaredType(ctx.typeSpec()!, this.getPointerCount(ctx))
                : 'void',
            range,
            selectionRange: this.getTerminalRange(ctx.Identifier()),
            scope: this.symbolTable.getCurrentScope(),
            modifiers: (ctx.MODIFIER?.() || []).map(modifier => modifier.text),
            parameters: [],
            definition: this.getTextFromContext(ctx)
        };

        this.symbolTable.addSymbol(functionSymbol);
        this.currentFunction = functionSymbol;

        this.symbolTable.enterScope(`function:${functionName}`, range);

        const parameterList = ctx.parameterList();
        if (parameterList) {
            this.visitParameterList(parameterList);
        }

        const block = ctx.block();
        if (block) {
            this.visitBlock(block);
        }

        this.symbolTable.exitScope();
        this.currentFunction = undefined;
        return null;
    }

    visitParameterList(ctx: any): any {
        if (!ctx) {
            return null;
        }

        try {
            this.visitParameters(ctx.parameter ? ctx.parameter() : []);
        } catch (error) {
            console.debug('Error visiting parameter list:', error);
        }

        return null;
    }

    visitParameter(ctx: ParameterContext): any {
        const identifier = ctx.Identifier();
        if (!identifier) {
            return null;
        }

        const parameterSymbol: Symbol = {
            name: identifier.text,
            type: SymbolType.PARAMETER,
            dataType: ctx.typeSpec()
                ? this.extractDeclaredType(ctx.typeSpec()!, this.getPointerCount(ctx))
                : 'mixed',
            range: this.getRange(ctx),
            selectionRange: this.getTerminalRange(identifier),
            scope: this.symbolTable.getCurrentScope(),
            definition: this.getTextFromContext(ctx)
        };

        this.symbolTable.addSymbol(parameterSymbol);

        if (this.currentFunction) {
            this.currentFunction.parameters = this.currentFunction.parameters || [];
            this.currentFunction.parameters.push(parameterSymbol);
        }

        return null;
    }

    visitVariableDecl(ctx: VariableDeclContext): any {
        const typeSpec = ctx.typeSpec();
        if (!typeSpec) {
            return null;
        }

        const baseType = this.extractTypeFromContext(typeSpec);
        const modifiers = (ctx.MODIFIER?.() || []).map(modifier => modifier.text);

        for (const declarator of ctx.variableDeclarator()) {
            const identifier = declarator.Identifier();
            if (!identifier) {
                continue;
            }

            const variableSymbol: Symbol = {
                name: identifier.text,
                type: SymbolType.VARIABLE,
                dataType: composeLpcType(baseType, this.getPointerCount(declarator)),
                range: this.getRange(declarator),
                selectionRange: this.getTerminalRange(identifier),
                scope: this.symbolTable.getCurrentScope(),
                modifiers,
                definition: this.getTextFromContext(ctx)
            };

            this.symbolTable.addSymbol(variableSymbol);
        }

        return null;
    }

    visitStructDef(ctx: StructDefContext): any {
        const structName = ctx.Identifier()?.text;
        if (!structName) {
            return null;
        }

        const range = this.getRange(ctx);
        const structSymbol: Symbol = {
            name: structName,
            type: SymbolType.STRUCT,
            dataType: structName,
            range,
            selectionRange: this.getTerminalRange(ctx.Identifier()),
            scope: this.symbolTable.getCurrentScope(),
            members: [],
            definition: this.getTextFromContext(ctx)
        };

        this.symbolTable.addSymbol(structSymbol);
        this.symbolTable.enterScope(`struct:${structName}`, range);

        const memberList = ctx.structMemberList();
        if (memberList) {
            this.visitStructMemberList(memberList, structSymbol);
        }

        this.symbolTable.exitScope();
        return null;
    }

    visitClassDef(ctx: ClassDefContext): any {
        const className = ctx.Identifier()?.text;
        if (!className) {
            return null;
        }

        const range = this.getRange(ctx);
        const classSymbol: Symbol = {
            name: className,
            type: SymbolType.CLASS,
            dataType: className,
            range,
            selectionRange: this.getTerminalRange(ctx.Identifier()),
            scope: this.symbolTable.getCurrentScope(),
            members: [],
            definition: this.getTextFromContext(ctx)
        };

        this.symbolTable.addSymbol(classSymbol);
        this.symbolTable.enterScope(`class:${className}`, range);

        const memberList = ctx.structMemberList();
        if (memberList) {
            this.visitStructMemberList(memberList, classSymbol);
        }

        this.symbolTable.exitScope();
        return null;
    }

    visitStructMemberList(ctx: StructMemberListContext, parentSymbol: Symbol): any {
        try {
            for (const member of ctx.structMember ? ctx.structMember() : []) {
                this.visitStructMember(member, parentSymbol);
            }
        } catch (error) {
            console.debug('Error visiting struct member list:', error);
        }

        return null;
    }

    visitStructMember(ctx: StructMemberContext, parentSymbol: Symbol): any {
        const typeSpec = ctx.typeSpec();
        const identifier = ctx.Identifier();
        if (!typeSpec || !identifier) {
            return null;
        }

        const memberSymbol: Symbol = {
            name: identifier.text,
            type: SymbolType.MEMBER,
            dataType: this.extractDeclaredType(typeSpec, this.getPointerCount(ctx)),
            range: this.getRange(ctx),
            selectionRange: this.getTerminalRange(identifier),
            scope: this.symbolTable.getCurrentScope(),
            definition: this.getTextFromContext(ctx)
        };

        parentSymbol.members = parentSymbol.members || [];
        parentSymbol.members.push(memberSymbol);
        this.symbolTable.addSymbol(memberSymbol);
        return null;
    }

    visitBlock(ctx: BlockContext): any {
        this.symbolTable.enterScope('block', this.getRange(ctx));
        this.visitStatements(ctx.statement ? ctx.statement() : []);
        this.symbolTable.exitScope();
        return null;
    }

    visitInheritStatement(ctx: InheritStatementContext): any {
        try {
            const expression = ctx.expression();
            if (!expression) {
                return null;
            }

            const value = this.extractDirectiveValue(expression);
            if (!value) {
                return null;
            }

            const range = this.getRange(ctx);
            const rawText = this.getTextFromContext(ctx);
            const directive: InheritDirective = {
                rawText,
                expressionKind: this.getDirectiveExpressionKind(expression, value),
                value,
                range,
                resolvedUri: undefined,
                isResolved: false
            };

            this.inheritDirectives.push(directive);
            this.symbolTable.addSymbol({
                name: value,
                type: SymbolType.INHERIT,
                dataType: 'inherit',
                range,
                scope: this.symbolTable.getCurrentScope(),
                definition: rawText,
                documentation: `继承自: ${value}`
            });
        } catch (error) {
            console.debug('Error visiting inherit statement:', error);
        }

        return null;
    }

    visitIncludeStatement(ctx: IncludeStatementContext): any {
        try {
            const expression = ctx.expression();
            if (!expression) {
                return null;
            }

            const value = this.extractDirectiveValue(expression);
            if (!value) {
                return null;
            }

            const rawText = this.getTextFromContext(ctx);
            this.includeDirectives.push({
                rawText,
                value,
                range: this.getRange(ctx),
                isSystemInclude: rawText.includes('<') && rawText.includes('>'),
                resolvedUri: undefined
            });
        } catch (error) {
            console.debug('Error visiting include statement:', error);
        }

        return null;
    }

    visitIfStatement(ctx: IfStatementContext): any {
        try {
            this.symbolTable.enterScope('if', this.getRange(ctx));
            this.visitStatements(ctx.statement ? ctx.statement() : []);
            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting if statement:', error);
        }

        return null;
    }

    visitWhileStatement(ctx: WhileStatementContext): any {
        try {
            this.symbolTable.enterScope('while', this.getRange(ctx));
            const statement = ctx.statement();
            if (statement) {
                this.visit(statement);
            }
            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting while statement:', error);
        }

        return null;
    }

    visitForStatement(ctx: ForStatementContext): any {
        try {
            this.symbolTable.enterScope('for', this.getRange(ctx));

            const forInit = ctx.forInit();
            const variableDecl = forInit?.variableDecl ? forInit.variableDecl() : null;
            if (variableDecl) {
                this.visitVariableDecl(variableDecl);
            }

            const statement = ctx.statement();
            if (statement) {
                this.visit(statement);
            }

            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting for statement:', error);
        }

        return null;
    }

    visitForeachStatement(ctx: ForeachStatementContext): any {
        try {
            this.symbolTable.enterScope('foreach', this.getRange(ctx));

            const foreachInit = ctx.foreachInit();
            const foreachVars = foreachInit?.foreachVar ? foreachInit.foreachVar() : [];
            for (const foreachVar of Array.isArray(foreachVars) ? foreachVars : [foreachVars]) {
                if (!foreachVar) {
                    continue;
                }

                const identifier = foreachVar.Identifier();
                if (!identifier) {
                    continue;
                }

                this.symbolTable.addSymbol({
                    name: identifier.text,
                    type: SymbolType.VARIABLE,
                    dataType: foreachVar.typeSpec()
                        ? this.extractDeclaredType(foreachVar.typeSpec()!, this.getPointerCount(foreachVar))
                        : 'mixed',
                    range: this.getRange(foreachVar),
                    selectionRange: this.getTerminalRange(identifier),
                    scope: this.symbolTable.getCurrentScope(),
                    definition: this.getTextFromContext(foreachVar),
                    documentation: 'foreach 迭代变量'
                });
            }

            const statement = ctx.statement();
            if (statement) {
                this.visit(statement);
            }

            this.symbolTable.exitScope();
        } catch (error) {
            console.debug('Error visiting foreach statement:', error);
        }

        return null;
    }

    visitExprStatement(_ctx: ExprStatementContext): any {
        return null;
    }

    visitExpression(_ctx: ExpressionContext): any {
        return null;
    }

    getSymbolTable(): SymbolTable {
        return this.symbolTable;
    }

    getTypeResolver(): TypeResolver {
        return this.typeResolver;
    }

    getInheritStatements(): InheritDirective[] {
        return [...this.inheritDirectives];
    }

    getIncludeStatements(): IncludeDirective[] {
        return [...this.includeDirectives];
    }

    protected defaultResult(): any {
        return null;
    }

    private visitStatements(statements: StatementContext[] | StatementContext): void {
        const statementList = Array.isArray(statements) ? statements : [statements];
        for (const statement of statementList) {
            if (statement) {
                this.visit(statement);
            }
        }
    }

    private visitParameters(parameters: ParameterContext[] | ParameterContext): void {
        const parameterList = Array.isArray(parameters) ? parameters : [parameters];
        for (const parameter of parameterList) {
            if (parameter) {
                this.visitParameter(parameter);
            }
        }
    }

    private extractTypeFromContext(ctx: TypeSpecContext): string {
        let baseType = 'mixed';

        if (ctx.KW_INT()) baseType = 'int';
        else if (ctx.KW_FLOAT()) baseType = 'float';
        else if (ctx.KW_STRING()) baseType = 'string';
        else if (ctx.KW_OBJECT()) baseType = 'object';
        else if (ctx.KW_MIXED()) baseType = 'mixed';
        else if (ctx.KW_MAPPING()) baseType = 'mapping';
        else if (ctx.KW_FUNCTION()) baseType = 'function';
        else if (ctx.KW_BUFFER()) baseType = 'buffer';
        else if (ctx.KW_VOID()) baseType = 'void';
        else if (ctx.KW_CLASS() && ctx.Identifier()) baseType = `class ${ctx.Identifier()!.text}`;
        else if (ctx.KW_CLASS()) baseType = 'class';
        else if (ctx.KW_STRUCT() && ctx.Identifier()) baseType = `struct ${ctx.Identifier()!.text}`;
        else if (ctx.KW_STRUCT()) baseType = 'struct';
        else if (ctx.Identifier()) baseType = ctx.Identifier()!.text;

        return composeLpcType(baseType, this.getPointerCount(ctx));
    }

    private extractDeclaredType(ctx: TypeSpecContext, additionalPointers: number): string {
        return composeLpcType(this.extractTypeFromContext(ctx), additionalPointers);
    }

    private getPointerCount(ctx: { STAR?: (() => TerminalNode[] | TerminalNode) | ((i?: number) => TerminalNode | TerminalNode[]) }): number {
        if (!ctx.STAR) {
            return 0;
        }

        const starTokens = ctx.STAR();
        if (Array.isArray(starTokens)) {
            return starTokens.length;
        }

        return starTokens ? 1 : 0;
    }

    private getRange(ctx: ParseTree): vscode.Range {
        try {
            if ('start' in ctx && 'stop' in ctx) {
                const startToken = (ctx as any).start;
                const stopToken = (ctx as any).stop || startToken;

                if (startToken && startToken.line !== undefined && startToken.charPositionInLine !== undefined) {
                    const start = new vscode.Position(
                        Math.max(0, startToken.line - 1),
                        Math.max(0, startToken.charPositionInLine)
                    );

                    const stopText = stopToken?.text || '';
                    const end = new vscode.Position(
                        Math.max(0, (stopToken?.line || startToken.line) - 1),
                        Math.max(0, (stopToken?.charPositionInLine || startToken.charPositionInLine) + Math.max(stopText.length, 1))
                    );

                    if (start.line < end.line || (start.line === end.line && start.character <= end.character)) {
                        return new vscode.Range(start, end);
                    }
                }
            }

            return this.inferRangeFromDocument(ctx);
        } catch (error) {
            console.debug('Error getting range from context:', error);
            return this.getDefaultRange();
        }
    }

    private getTerminalRange(node: TerminalNode | undefined): vscode.Range | undefined {
        if (!node?.symbol) {
            return undefined;
        }

        const start = new vscode.Position(
            Math.max(0, node.symbol.line - 1),
            Math.max(0, node.symbol.charPositionInLine)
        );
        const end = new vscode.Position(
            Math.max(0, node.symbol.line - 1),
            Math.max(0, node.symbol.charPositionInLine + (node.text?.length ?? 1))
        );

        return new vscode.Range(start, end);
    }

    private inferRangeFromDocument(ctx: ParseTree): vscode.Range {
        try {
            const text = this.getTextFromContext(ctx);
            if (!text) {
                return this.getDefaultRange();
            }

            const documentText = this.document.getText();
            const index = documentText.indexOf(text);
            if (index === -1) {
                return this.getDefaultRange();
            }

            return new vscode.Range(
                this.document.positionAt(index),
                this.document.positionAt(index + text.length)
            );
        } catch (error) {
            console.debug('Error inferring range from document:', error);
            return this.getDefaultRange();
        }
    }

    private getDefaultRange(): vscode.Range {
        return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));
    }

    private getTextFromContext(ctx: ParseTree): string {
        return (ctx as { text?: string }).text || '';
    }

    private extractDirectiveValue(expression: ExpressionContext): string | null {
        const stringLiteral = this.findTerminalText(expression, LPCParser.STRING_LITERAL);
        if (stringLiteral) {
            return this.unquote(stringLiteral);
        }

        const identifier = this.findTerminalText(expression, LPCParser.Identifier);
        if (identifier) {
            return identifier;
        }

        const rawText = this.getTextFromContext(expression).trim();
        if (!rawText) {
            return null;
        }

        return this.isQuoted(rawText) ? this.unquote(rawText) : rawText;
    }

    private getDirectiveExpressionKind(
        expression: ExpressionContext,
        value: string
    ): InheritDirective['expressionKind'] {
        if (this.findTerminalText(expression, LPCParser.STRING_LITERAL)) {
            return 'string';
        }

        if (this.findTerminalText(expression, LPCParser.Identifier) && /^[A-Z_][A-Z0-9_]*$/.test(value)) {
            return 'macro';
        }

        return 'unknown';
    }

    private findTerminalText(node: ParseTree, tokenType: number): string | undefined {
        if (this.isTerminalNode(node) && node.symbol.type === tokenType) {
            return node.text;
        }

        const childCount = typeof (node as any).childCount === 'number' ? (node as any).childCount : 0;
        for (let index = 0; index < childCount; index += 1) {
            const child = (node as any).getChild(index) as ParseTree;
            const match = this.findTerminalText(child, tokenType);
            if (match) {
                return match;
            }
        }

        return undefined;
    }

    private isTerminalNode(node: ParseTree): node is TerminalNode {
        return typeof (node as TerminalNode).symbol !== 'undefined';
    }

    private isQuoted(value: string): boolean {
        return (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith('\'') && value.endsWith('\''));
    }

    private unquote(value: string): string {
        return this.isQuoted(value) ? value.slice(1, -1) : value;
    }
}
