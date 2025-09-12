import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { CommonTokenStream, Token } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';

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
    InheritStatementContext,
    IncludeStatementContext,
    IfStatementContext,
    WhileStatementContext,
    ForStatementContext,
    DoWhileStatementContext,
    ForeachStatementContext,
    SwitchStatementContext,
    SwitchSectionContext,
    BreakStatementContext,
    ContinueStatementContext,
    ReturnStatementContext,
    ExpressionContext,
    MappingLiteralContext,
    ArrayLiteralContext,
    ExprStatementContext,
    StructMemberContext,
    StructMemberListContext,
    ParameterListContext,
    AssignmentExpressionContext,
    AdditiveExpressionContext,
    MultiplicativeExpressionContext,
    EqualityExpressionContext,
    RelationalExpressionContext,
    LogicalAndExpressionContext,
    LogicalOrExpressionContext,
    BitwiseAndExpressionContext,
    BitwiseOrExpressionContext,
    BitwiseXorExpressionContext,
    ShiftExpressionContext,
    ExpressionListContext
} from '../antlr/LPCParser';

import { LPCFormattingOptions } from './types';
import { INodeVisitor } from './types/interfaces';
import { ExtendedFormattingContext, createExtendedFormattingContext } from './core';

export class FormattingVisitor extends AbstractParseTreeVisitor<string> implements INodeVisitor {
    private context: ExtendedFormattingContext;
    private currentLineLength: number = 0;

    constructor(tokenStream: CommonTokenStream, options: LPCFormattingOptions) {
        super();
        this.context = createExtendedFormattingContext(tokenStream, options);
        // 设置节点访问器，使专用格式化器能够调用回这个类
        this.context.setNodeVisitor(this);
    }

    getErrors(): string[] {
        return this.context.errorCollector.getErrors();
    }

    private addError(message: string, context?: string): void {
        this.context.errorCollector.addError(message, context);
    }

    private checkNodeLimit(): boolean {
        return this.context.core.checkNodeLimit();
    }

    protected defaultResult(): string {
        return '';
    }

    protected aggregateResult(aggregate: string, nextResult: string): string {
        return aggregate + nextResult;
    }

    visitSourceFile(ctx: SourceFileContext): string {
        if (!this.checkNodeLimit()) return '';
        
        try {
            let result = '';
            const statements = ctx.statement ? ctx.statement() : [];
            
            for (let i = 0; i < statements.length; i++) {
                try {
                    const stmt = statements[i];
                    const formattedStmt = this.visit(stmt);
                    
                    result += formattedStmt;
                    
                    // 在语句之间添加适当的空行
                    if (i < statements.length - 1) {
                        result += this.context.lineBreakManager.getStatementSeparator(stmt, statements[i + 1]);
                    }
                } catch (error) {
                    this.addError(`格式化语句 ${i} 时出错: ${error instanceof Error ? error.message : '未知错误'}`);
                    // 继续处理其他语句
                    continue;
                }
            }

            // 添加最终换行符
            if (this.context.core.getOptions().insertFinalNewline && !result.endsWith('\n')) {
                result += '\n';
            }

            return result;
        } catch (error) {
            this.addError(`格式化源文件时出错: ${error instanceof Error ? error.message : '未知错误'}`);
            return '';
        }
    }

    visitFunctionDef(ctx: FunctionDefContext): string {
        let result = '';
        
        // 处理函数修饰符
        const modifiers = this.extractModifiers(ctx);
        if (modifiers.length > 0) {
            result += this.context.core.formatModifiers(modifiers) + ' ';
        }

        // 处理返回类型
        if (ctx.typeSpec && ctx.typeSpec()) {
            const typeSpec = ctx.typeSpec();
            if (typeSpec) {
                result += this.visit(typeSpec) + ' ';
            }
        }

        // 处理函数名
        if (ctx.Identifier && ctx.Identifier()) {
            result += ctx.Identifier().text;
        }

        // 处理参数列表
        result += '(';
        const paramList = ctx.parameterList();
        if (paramList) {
            const params = paramList.parameter ? paramList.parameter() : [];
            for (let i = 0; i < params.length; i++) {
                if (i > 0) {
                    result += this.context.core.getOptions().spaceAfterComma ? ', ' : ',';
                }
                result += this.visit(params[i]);
            }
        }
        result += ')';

        // 处理函数体
        if (ctx.block && ctx.block()) {
            if (this.context.core.getOptions().bracesOnNewLine) {
                result += '\n' + this.getIndent();
            } else {
                result += this.context.core.getOptions().spaceBeforeOpenParen ? ' ' : '';
            }
            result += this.visit(ctx.block());
        }

        return result + '\n';
    }

    /**
     * 格式化代码块（委托给专用格式化器）
     */
    visitBlock(ctx: BlockContext): string {
        return this.context.blockFormatter.formatBlock(ctx);
    }

    /**
     * 格式化类型规范
     * 处理基础类型和复合类型（如 mapping, int *, mapping * 等）
     * 支持 spaceAfterTypeBeforeStar 配置选项
     * 
     * @param ctx 类型规范上下文
     * @returns 格式化后的类型字符串
     */
    visitTypeSpec(ctx: TypeSpecContext): string {
        // 获取类型文本
        let typeText = ctx.text || '';
        
        // 检查是否需要在类型名和星号之间添加空格
        // 这主要处理语法中直接包含星号的情况，如 "mapping*" -> "mapping *"
        if (this.context.core.getOptions().spaceAfterTypeBeforeStar && typeText.includes('*')) {
            // 将类型名和星号分离，并在中间添加空格
            typeText = typeText.replace(/(\w)(\*+)/g, '$1 $2');
        }
        
        return typeText;
    }

    visitVariableDecl(ctx: VariableDeclContext): string {
        let result = '';

        // 处理类型
        const typeSpec = ctx.typeSpec();
        if (typeSpec) {
            result += this.visit(typeSpec) + ' ';
        }

        // 处理变量声明符列表
        const declarators = ctx.variableDeclarator();
        for (let i = 0; i < declarators.length; i++) {
            if (i > 0) {
                result += this.context.core.getOptions().spaceAfterComma ? ', ' : ',';
            }
            result += this.visit(declarators[i]);
        }

        return result + ';';
    }

    /**
     * 格式化变量声明器
     * 处理变量名前的星号（数组标记）和初始化表达式
     * 
     * 支持的格式：
     * - var          (简单变量)
     * - *var         (一级指针/数组)
     * - **var        (二级指针/数组)
     * - var = expr   (带初始化)
     * - *var = expr  (数组带初始化)
     */
    visitVariableDeclarator(ctx: any): string {
        return this.context.declarationFormatter.formatVariableDeclarator(ctx);
    }

    visitIncludeStatement(ctx: IncludeStatementContext): string {
        return this.context.declarationFormatter.formatIncludeStatement(ctx);
    }

    visitInheritStatement(ctx: InheritStatementContext): string {
        return this.context.declarationFormatter.formatInheritStatement(ctx);
    }

    visitIfStatement(ctx: IfStatementContext): string {
        return this.context.statementFormatter.formatIfStatement(ctx);
    }

    visitWhileStatement(ctx: WhileStatementContext): string {
        return this.context.statementFormatter.formatWhileStatement(ctx);
    }

    visitForStatement(ctx: ForStatementContext): string {
        return this.context.statementFormatter.formatForStatement(ctx);
    }

    visitDoWhileStatement(ctx: DoWhileStatementContext): string {
        return this.context.statementFormatter.formatDoWhileStatement(ctx);
    }

    visitForeachStatement(ctx: ForeachStatementContext): string {
        return this.context.statementFormatter.formatForeachStatement(ctx);
    }

    visitSwitchStatement(ctx: SwitchStatementContext): string {
        return this.context.statementFormatter.formatSwitchStatement(ctx);
    }

    visitBreakStatement(ctx: BreakStatementContext): string {
        return this.context.statementFormatter.formatBreakStatement(ctx);
    }

    visitContinueStatement(ctx: ContinueStatementContext): string {
        return this.context.statementFormatter.formatContinueStatement(ctx);
    }

    visitReturnStatement(ctx: ReturnStatementContext): string {
        return this.context.statementFormatter.formatReturnStatement(ctx);
    }

    /**
     * 格式化表达式语句（委托给专用格式化器）
     */
    visitExprStatement(ctx: ExprStatementContext): string {
        return this.context.statementFormatter.formatExprStatement(ctx);
    }

    /**
     * 格式化映射字面量（委托给专用格式化器）
     */
    visitMappingLiteral(ctx: MappingLiteralContext): string {
        return this.context.literalFormatter.formatMappingLiteral(ctx);
    }

    /**
     * 格式化数组字面量（委托给专用格式化器）
     */
    visitArrayLiteral(ctx: ArrayLiteralContext): string {
        return this.context.literalFormatter.formatArrayLiteral(ctx);
    }

    visitStructDef(ctx: StructDefContext): string {
        return this.context.declarationFormatter.formatStructDef(ctx);
    }

    visitClassDef(ctx: ClassDefContext): string {
        return this.context.declarationFormatter.formatClassDef(ctx);
    }

    visitStructMemberList(ctx: StructMemberListContext): string {
        return this.context.declarationFormatter.formatStructMemberList(ctx);
    }

    visitStructMember(ctx: StructMemberContext): string {
        return this.context.declarationFormatter.formatStructMember(ctx);
    }

    visitParameterList(ctx: ParameterListContext): string {
        return this.context.declarationFormatter.formatParameterList(ctx);
    }

    /**
     * 格式化单个参数（委托给专用格式化器）
     */
    visitParameter(ctx: ParameterContext): string {
        return this.context.declarationFormatter.formatParameter(ctx);
    }

    /**
     * 格式化表达式列表（委托给专用格式化器）
     */
    visitExpressionList(ctx: ExpressionListContext): string {
        return this.context.expressionFormatter.formatExpressionList(ctx);
    }

    visitTerminal(node: TerminalNode): string {
        return node.text;
    }

    private getIndent(): string {
        return this.context.indentManager.getIndent();
    }

    private extractModifiers(ctx: FunctionDefContext): string[] {
        const modifiers: string[] = [];
        // 这里需要根据具体的语法结构来提取修饰符
        // 暂时返回空数组
        return modifiers;
    }

    private formatModifiers(modifiers: string[]): string {
        return this.context.core.formatModifiers(modifiers);
    }

    private formatOperator(operator: string, isAssignment: boolean = false): string {
        return this.context.core.formatOperator(operator, isAssignment);
    }

    private getStatementSeparator(current: StatementContext, next: StatementContext): string {
        return this.context.lineBreakManager.getStatementSeparator(current, next);
    }

    private isFunctionDef(stmt: StatementContext): boolean {
        return this.context.lineBreakManager.isStatementType(stmt, 'function');
    }

    private isIncludeStatement(stmt: StatementContext): boolean {
        return this.context.lineBreakManager.isStatementType(stmt, 'include');
    }

    private isBlock(stmt: StatementContext): boolean {
        return this.context.lineBreakManager.isStatementType(stmt, 'block');
    }

    // 赋值表达式处理（委托给专用格式化器）
    visitAssignmentExpression(ctx: AssignmentExpressionContext): string {
        return this.context.expressionFormatter.formatAssignmentExpression(ctx);
    }

    // 加法和减法表达式处理（委托给专用格式化器）
    visitAdditiveExpression(ctx: AdditiveExpressionContext): string {
        return this.context.expressionFormatter.formatAdditiveExpression(ctx);
    }

    // 乘法、除法和取模表达式处理（委托给专用格式化器）
    visitMultiplicativeExpression(ctx: MultiplicativeExpressionContext): string {
        return this.context.expressionFormatter.formatMultiplicativeExpression(ctx);
    }

    // 相等性表达式处理（委托给专用格式化器）
    visitEqualityExpression(ctx: EqualityExpressionContext): string {
        return this.context.expressionFormatter.formatEqualityExpression(ctx);
    }

    // 关系表达式处理（委托给专用格式化器）
    visitRelationalExpression(ctx: RelationalExpressionContext): string {
        return this.context.expressionFormatter.formatRelationalExpression(ctx);
    }

    // 逻辑与表达式处理（委托给专用格式化器）
    visitLogicalAndExpression(ctx: LogicalAndExpressionContext): string {
        return this.context.expressionFormatter.formatLogicalAndExpression(ctx);
    }

    // 逻辑或表达式处理（委托给专用格式化器）
    visitLogicalOrExpression(ctx: LogicalOrExpressionContext): string {
        return this.context.expressionFormatter.formatLogicalOrExpression(ctx);
    }

    // 按位与表达式处理（委托给专用格式化器）
    visitBitwiseAndExpression(ctx: BitwiseAndExpressionContext): string {
        return this.context.expressionFormatter.formatBitwiseAndExpression(ctx);
    }

    // 按位或表达式处理（委托给专用格式化器）
    visitBitwiseOrExpression(ctx: BitwiseOrExpressionContext): string {
        return this.context.expressionFormatter.formatBitwiseOrExpression(ctx);
    }

    // 按位异或表达式处理（委托给专用格式化器）
    visitBitwiseXorExpression(ctx: BitwiseXorExpressionContext): string {
        return this.context.expressionFormatter.formatBitwiseXorExpression(ctx);
    }

    // 移位表达式处理（委托给专用格式化器）
    visitShiftExpression(ctx: ShiftExpressionContext): string {
        return this.context.expressionFormatter.formatShiftExpression(ctx);
    }

    /**
     * 格式化一般表达式（委托给专用格式化器）
     */
    visitExpression(ctx: ExpressionContext): string {
        return this.context.expressionFormatter.formatExpression(ctx);
    }

    /**
     * 格式化switch节（委托给专用格式化器）
     */
    visitSwitchSection(ctx: SwitchSectionContext): string {
        return this.context.statementFormatter.formatSwitchSection(ctx);
    }

    /**
     * 处理缺失的访问者方法
     * 为所有可能遇到的上下文类型提供默认处理
     */
    public visitChildren(node: any): string {
        if (!node || !node.children) {
            return '';
        }
        
        let result = '';
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            if (child) {
                result += this.visit(child);
            }
        }
        
        return result;
    }

    // 辅助方法：获取两个上下文之间的令牌
    private getTokenBetween(left: any, right: any): Token | undefined {
        return this.context.tokenUtils.getTokenBetween(left, right);
    }

    /**
     * 改进的缩进计算方法
     * 支持更精确的缩进控制
     */
    private calculateIndentLevel(context?: string): number {
        return this.context.indentManager.calculateIndentLevel(context);
    }

    /**
     * 增强的行长度估算
     * 考虑缩进和内容复杂度
     */
    private estimateLineLength(text: string, includeIndent: boolean = true): number {
        return this.context.lineBreakManager.estimateLineLength(text, includeIndent);
    }

    /**
     * 智能换行决策
     * 基于多个因素决定是否需要换行
     */
    private shouldWrapLine(elements: any[], separator: string = ', ', threshold?: number): boolean {
        return this.context.lineBreakManager.shouldWrapLine(elements, separator, threshold);
    }

    /**
     * 格式化分隔符列表的通用方法
     * 用于参数列表、表达式列表等
     */
    private formatDelimitedList<T>(
        elements: T[], 
        formatter: (element: T) => string,
        separator: string = ',',
        options?: {
            forceWrap?: boolean;
            maxInlineElements?: number;
            addSpaceAfterSeparator?: boolean;
        }
    ): string {
        if (elements.length === 0) return '';
        
        const opts = {
            forceWrap: false,
            maxInlineElements: 4,
            addSpaceAfterSeparator: this.context.core.getOptions().spaceAfterComma,
            ...options
        };
        
        const shouldWrap = opts.forceWrap || 
            elements.length > opts.maxInlineElements ||
            this.shouldWrapLine(elements.map(formatter));
        
        if (shouldWrap) {
            // 多行格式
            let result = '\n';
            this.context.indentManager.increaseIndent();
            
            for (let i = 0; i < elements.length; i++) {
                result += this.getIndent() + formatter(elements[i]);
                if (i < elements.length - 1) {
                    result += separator;
                }
                result += '\n';
            }
            
            this.context.indentManager.decreaseIndent();
            result += this.getIndent();
            return result;
        } else {
            // 单行格式
            return elements.map(formatter).join(
                separator + (opts.addSpaceAfterSeparator ? ' ' : '')
            );
        }
    }
}