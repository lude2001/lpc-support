import {
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
    ExpressionContext,
    ExpressionListContext
} from '../../antlr/LPCParser';

import { IExpressionFormatter, IFormattingContext, INodeVisitor } from '../types/interfaces';

/**
 * 表达式格式化器
 * 专门处理各种表达式的格式化逻辑
 * 
 * 包含以下表达式类型：
 * - 赋值表达式 (=, +=, -=, etc.)
 * - 算数表达式 (+, -, *, /, %)
 * - 比较表达式 (==, !=, <, >, <=, >=)
 * - 逻辑表达式 (&&, ||)
 * - 位运算表达式 (&, |, ^, <<, >>)
 * - 表达式列表
 */
export class ExpressionFormatter implements IExpressionFormatter {
    readonly context: IFormattingContext;
    readonly visitor: INodeVisitor;

    constructor(context: IFormattingContext, visitor: INodeVisitor) {
        this.context = context;
        this.visitor = visitor;
    }

    /**
     * 安全执行格式化操作
     * 提供统一的错误处理和回退机制
     */
    safeExecute<T>(operation: () => T, errorMessage: string, fallback?: T): T | undefined {
        try {
            if (!this.context.core.checkNodeLimit()) {
                return fallback;
            }
            return operation();
        } catch (error) {
            this.context.errorCollector.addError(
                `${errorMessage}: ${error instanceof Error ? error.message : '未知错误'}`
            );
            return fallback;
        }
    }

    /**
     * 格式化赋值表达式
     * 处理各种赋值操作符：=, +=, -=, *=, /=, %=, |=, &=
     */
    formatAssignmentExpression(ctx: AssignmentExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（没有赋值操作符）
                const conditionalExpr = ctx.conditionalExpression();
                const rightExpr = ctx.expression();
                
                if (!rightExpr) {
                    // 没有赋值操作，直接返回条件表达式
                    return this.visitNode(conditionalExpr);
                }

                // 处理赋值表达式
                let result = '';
                
                // 左侧表达式
                result += this.visitNode(conditionalExpr);

                // 获取赋值操作符
                let operator = '='; // 默认赋值操作符
                if (ctx.ASSIGN()) operator = '=';
                else if (ctx.PLUS_ASSIGN()) operator = '+=';
                else if (ctx.MINUS_ASSIGN()) operator = '-=';
                else if (ctx.STAR_ASSIGN()) operator = '*=';
                else if (ctx.DIV_ASSIGN()) operator = '/=';
                else if (ctx.PERCENT_ASSIGN()) operator = '%=';
                else if (ctx.BIT_OR_ASSIGN()) operator = '|=';
                else if (ctx.BIT_AND_ASSIGN()) operator = '&=';

                // 添加赋值操作符和空格
                result += this.context.core.formatOperator(operator, true);

                // 右侧表达式
                result += this.visitNode(rightExpr);

                return result;
            },
            '格式化赋值表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化加法和减法表达式
     * 处理加号(+)和减号(-)运算符
     */
    formatAdditiveExpression(ctx: AdditiveExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个乘法表达式）
                const multExprs = ctx.multiplicativeExpression();
                if (multExprs.length === 1) {
                    return this.visitNode(multExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(multExprs[0]);
                
                for (let i = 1; i < multExprs.length; i++) {
                    // 获取运算符（+ 或 -）
                    const token = this.context.tokenUtils.getTokenBetween(multExprs[i-1], multExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '+'; // 默认为 +
                    
                    // 根据配置添加空格
                    result += this.context.core.formatOperator(operator, false);
                    result += this.visitNode(multExprs[i]);
                }

                return result;
            },
            '格式化加法表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化乘法、除法和取模表达式
     * 处理乘号(*)、除号(/)和取模(%)运算符
     */
    formatMultiplicativeExpression(ctx: MultiplicativeExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个一元表达式）
                const unaryExprs = ctx.unaryExpression();
                if (unaryExprs.length === 1) {
                    return this.visitNode(unaryExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(unaryExprs[0]);
                
                for (let i = 1; i < unaryExprs.length; i++) {
                    // 获取运算符（*, /, %）
                    const token = this.context.tokenUtils.getTokenBetween(unaryExprs[i-1], unaryExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '*'; // 默认为 *
                    
                    // 根据配置添加空格
                    result += this.context.core.formatOperator(operator, false);
                    result += this.visitNode(unaryExprs[i]);
                }

                return result;
            },
            '格式化乘法表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化相等性表达式
     * 处理相等(==)和不等(!=)运算符
     */
    formatEqualityExpression(ctx: EqualityExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个关系表达式）
                const relExprs = ctx.relationalExpression();
                if (relExprs.length === 1) {
                    return this.visitNode(relExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(relExprs[0]);
                
                for (let i = 1; i < relExprs.length; i++) {
                    // 获取运算符（== 或 !=）
                    const token = this.context.tokenUtils.getTokenBetween(relExprs[i-1], relExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '=='; // 默认为 ==
                    
                    // 根据配置添加空格
                    result += this.context.core.formatOperator(operator, false);
                    result += this.visitNode(relExprs[i]);
                }

                return result;
            },
            '格式化相等表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化关系表达式
     * 处理小于(<)、大于(>)、小于等于(<=)、大于等于(>=)运算符
     */
    formatRelationalExpression(ctx: RelationalExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个移位表达式）
                const shiftExprs = ctx.shiftExpression();
                if (shiftExprs.length === 1) {
                    return this.visitNode(shiftExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(shiftExprs[0]);
                
                for (let i = 1; i < shiftExprs.length; i++) {
                    // 获取运算符（<, >, <=, >=）
                    const token = this.context.tokenUtils.getTokenBetween(shiftExprs[i-1], shiftExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '<'; // 默认为 <
                    
                    // 根据配置添加空格
                    result += this.context.core.formatOperator(operator, false);
                    result += this.visitNode(shiftExprs[i]);
                }

                return result;
            },
            '格式化关系表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化逻辑与表达式
     * 处理逻辑与(&&)运算符
     */
    formatLogicalAndExpression(ctx: LogicalAndExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个按位或表达式）
                const bitwiseOrExprs = ctx.bitwiseOrExpression();
                if (bitwiseOrExprs.length === 1) {
                    return this.visitNode(bitwiseOrExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(bitwiseOrExprs[0]);
                
                for (let i = 1; i < bitwiseOrExprs.length; i++) {
                    // 逻辑与操作符
                    result += this.context.core.formatOperator('&&', false);
                    result += this.visitNode(bitwiseOrExprs[i]);
                }

                return result;
            },
            '格式化逻辑与表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化逻辑或表达式
     * 处理逻辑或(||)运算符
     */
    formatLogicalOrExpression(ctx: LogicalOrExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个逻辑与表达式）
                const logicalAndExprs = ctx.logicalAndExpression();
                if (logicalAndExprs.length === 1) {
                    return this.visitNode(logicalAndExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(logicalAndExprs[0]);
                
                for (let i = 1; i < logicalAndExprs.length; i++) {
                    // 逻辑或操作符
                    result += this.context.core.formatOperator('||', false);
                    result += this.visitNode(logicalAndExprs[i]);
                }

                return result;
            },
            '格式化逻辑或表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化按位与表达式
     * 处理按位与(&)运算符
     */
    formatBitwiseAndExpression(ctx: BitwiseAndExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个相等表达式）
                const equalityExprs = ctx.equalityExpression();
                if (equalityExprs.length === 1) {
                    return this.visitNode(equalityExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(equalityExprs[0]);
                
                for (let i = 1; i < equalityExprs.length; i++) {
                    // 按位与操作符
                    result += this.context.core.formatOperator('&', false);
                    result += this.visitNode(equalityExprs[i]);
                }

                return result;
            },
            '格式化按位与表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化按位或表达式
     * 处理按位或(|)运算符
     */
    formatBitwiseOrExpression(ctx: BitwiseOrExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个按位异或表达式）
                const bitwiseXorExprs = ctx.bitwiseXorExpression();
                if (bitwiseXorExprs.length === 1) {
                    return this.visitNode(bitwiseXorExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(bitwiseXorExprs[0]);
                
                for (let i = 1; i < bitwiseXorExprs.length; i++) {
                    // 按位或操作符
                    result += this.context.core.formatOperator('|', false);
                    result += this.visitNode(bitwiseXorExprs[i]);
                }

                return result;
            },
            '格式化按位或表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化按位异或表达式
     * 处理按位异或(^)运算符
     */
    formatBitwiseXorExpression(ctx: BitwiseXorExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个按位与表达式）
                const bitwiseAndExprs = ctx.bitwiseAndExpression();
                if (bitwiseAndExprs.length === 1) {
                    return this.visitNode(bitwiseAndExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(bitwiseAndExprs[0]);
                
                for (let i = 1; i < bitwiseAndExprs.length; i++) {
                    // 按位异或操作符
                    result += this.context.core.formatOperator('^', false);
                    result += this.visitNode(bitwiseAndExprs[i]);
                }

                return result;
            },
            '格式化按位异或表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化移位表达式
     * 处理左移(<<)和右移(>>)运算符
     */
    formatShiftExpression(ctx: ShiftExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个加法表达式）
                const additiveExprs = ctx.additiveExpression();
                if (additiveExprs.length === 1) {
                    return this.visitNode(additiveExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(additiveExprs[0]);
                
                for (let i = 1; i < additiveExprs.length; i++) {
                    // 获取移位运算符（<< 或 >>）
                    const token = this.context.tokenUtils.getTokenBetween(additiveExprs[i-1], additiveExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '<<'; // 默认为 <<
                    
                    // 根据配置添加空格
                    result += this.context.core.formatOperator(operator, false);
                    result += this.visitNode(additiveExprs[i]);
                }

                return result;
            },
            '格式化移位表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化通用表达式
     * 这是表达式层次的入口点，处理各种表达式类型
     */
    formatExpression(ctx: ExpressionContext): string {
        return this.safeExecute(
            () => {
                // 如果有子表达式，直接访问
                if (ctx.children && ctx.children.length > 0) {
                    return ctx.children.map(child => this.visitNode(child)).join('');
                }
                
                // 否则返回文本内容
                return ctx.text || '';
            },
            '格式化表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化表达式列表
     * 用于函数调用参数、数组元素等场合
     * 
     * 支持自动换行决策：
     * - 基于表达式数量
     * - 基于预估行长度
     * - 支持多行表达式的正确缩进
     */
    formatExpressionList(ctx: ExpressionListContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const expressions = ctx.expression();
                
                if (expressions.length === 0) {
                    return result;
                }

                const options = this.context.core.getOptions();

                // 检查是否需要换行（基于表达式数量和预估长度）
                const shouldWrap = expressions.length > 4 || 
                    this.context.lineBreakManager.estimateLineLength(
                        expressions.map(expr => this.visitNode(expr)).join(', ')
                    ) > options.maxLineLength;

                if (shouldWrap) {
                    // 多行格式
                    result += '\n';
                    this.context.indentManager.increaseIndent();
                    
                    for (let i = 0; i < expressions.length; i++) {
                        const expr = expressions[i];
                        result += this.context.indentManager.getIndent();
                        
                        const exprResult = this.visitNode(expr);
                        
                        // 处理多行表达式
                        if (exprResult.includes('\n')) {
                            const lines = exprResult.split('\n');
                            result += lines[0];
                            for (let j = 1; j < lines.length; j++) {
                                if (lines[j].trim() !== '') {
                                    result += '\n' + this.context.indentManager.getIndent() + '    ' + lines[j].trimStart();
                                } else {
                                    result += '\n' + lines[j];
                                }
                            }
                        } else {
                            result += exprResult;
                        }
                        
                        if (i < expressions.length - 1) {
                            result += ',';
                        }
                        result += '\n';
                    }
                    
                    this.context.indentManager.decreaseIndent();
                    result += this.context.indentManager.getIndent();
                } else {
                    // 单行格式
                    for (let i = 0; i < expressions.length; i++) {
                        result += this.visitNode(expressions[i]);
                        if (i < expressions.length - 1) {
                            result += options.spaceAfterComma ? ', ' : ',';
                        }
                    }
                }

                return result;
            },
            '格式化表达式列表',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 辅助方法：访问节点
     * 通过注入的访问器委托给主访问器
     */
    private visitNode(node: any): string {
        if (!node) return '';
        return this.visitor.visit(node);
    }
}