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
    ExpressionListContext,
    PostfixExpressionContext,
    PrimaryContext
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
 * - 后缀表达式（包含箭头操作符）
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
     * *** 修复6: 改进赋值表达式格式化，正确处理复合赋值运算符 ***
     * 格式化赋值表达式
     * 处理所有类型的赋值运算符（=, +=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=）
     */
    formatAssignmentExpression(ctx: AssignmentExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个逻辑或表达式）
                const logicalOrExprs = this.getLogicalOrExpressions(ctx);
                if (logicalOrExprs.length === 1) {
                    return this.visitNode(logicalOrExprs[0]);
                }

                // 处理赋值运算
                let result = this.visitNode(logicalOrExprs[0]);

                for (let i = 1; i < logicalOrExprs.length; i++) {
                    // 获取赋值运算符
                    const token = this.context.tokenUtils.getTokenBetween(logicalOrExprs[i-1], logicalOrExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '='; // 默认为 =

                    // *** 修复：确保复合赋值运算符作为整体处理 ***
                    // 使用formatOperator方法，标记为赋值运算符
                    result += this.context.core.formatOperator(operator, true);
                    result += this.visitNode(logicalOrExprs[i]);
                }

                return result;
            },
            '格式化赋值表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化加法表达式
     * 处理加法(+)和减法(-)运算符
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
                    // 获取加减法运算符（+ 或 -）
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
     * 格式化乘法表达式
     * 处理乘法(*)、除法(/)和模运算(%)运算符
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
                    // 获取乘除法运算符（*, /, %）
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
                const relationalExprs = ctx.relationalExpression();
                if (relationalExprs.length === 1) {
                    return this.visitNode(relationalExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(relationalExprs[0]);

                for (let i = 1; i < relationalExprs.length; i++) {
                    // 获取相等性运算符（== 或 !=）
                    const token = this.context.tokenUtils.getTokenBetween(relationalExprs[i-1], relationalExprs[i]);
                    const operator = this.context.tokenUtils.getTokenText(token) || '=='; // 默认为 ==

                    // 根据配置添加空格
                    result += this.context.core.formatOperator(operator, false);
                    result += this.visitNode(relationalExprs[i]);
                }

                return result;
            },
            '格式化相等性表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化关系表达式
     * 处理比较运算符 (<, >, <=, >=)
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
                    // 获取关系运算符（<, >, <=, >=）
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
                // 处理简单表达式（只有一个位或表达式）
                const bitwiseOrExprs = ctx.bitwiseOrExpression();
                if (bitwiseOrExprs.length === 1) {
                    return this.visitNode(bitwiseOrExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(bitwiseOrExprs[0]);

                for (let i = 1; i < bitwiseOrExprs.length; i++) {
                    // 逻辑与运算符总是 &&
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
                    // 逻辑或运算符总是 ||
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
     * 格式化位与表达式
     * 处理位与(&)运算符
     */
    formatBitwiseAndExpression(ctx: BitwiseAndExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个相等表达式）
                const bitwiseXorExprs = this.getEqualityExpressions(ctx);
                if (bitwiseXorExprs.length === 1) {
                    return this.visitNode(bitwiseXorExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(bitwiseXorExprs[0]);

                for (let i = 1; i < bitwiseXorExprs.length; i++) {
                    // 位与运算符总是 &
                    result += this.context.core.formatOperator('&', false);
                    result += this.visitNode(bitwiseXorExprs[i]);
                }

                return result;
            },
            '格式化位与表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化位或表达式
     * 处理位或(|)运算符
     */
    formatBitwiseOrExpression(ctx: BitwiseOrExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个位与表达式）
                const bitwiseAndExprs = this.getBitwiseAndExpressions(ctx);
                if (bitwiseAndExprs.length === 1) {
                    return this.visitNode(bitwiseAndExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(bitwiseAndExprs[0]);

                for (let i = 1; i < bitwiseAndExprs.length; i++) {
                    // 位或运算符总是 |
                    result += this.context.core.formatOperator('|', false);
                    result += this.visitNode(bitwiseAndExprs[i]);
                }

                return result;
            },
            '格式化位或表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化位异或表达式
     * 处理位异或(^)运算符
     */
    formatBitwiseXorExpression(ctx: BitwiseXorExpressionContext): string {
        return this.safeExecute(
            () => {
                // 处理简单表达式（只有一个相等性表达式）
                const equalityExprs = this.getEqualityExpressions(ctx);
                if (equalityExprs.length === 1) {
                    return this.visitNode(equalityExprs[0]);
                }

                // 处理二元运算
                let result = this.visitNode(equalityExprs[0]);

                for (let i = 1; i < equalityExprs.length; i++) {
                    // 位异或运算符总是 ^
                    result += this.context.core.formatOperator('^', false);
                    result += this.visitNode(equalityExprs[i]);
                }

                return result;
            },
            '格式化位异或表达式',
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
     * *** 修复7: 改进后缀表达式格式化，正确处理箭头操作符 ***
     * 格式化后缀表达式
     * 处理成员访问 (->)、点访问 (.)、作用域访问 (::)、函数调用、数组访问等
     */
    formatPostfixExpression(ctx: PostfixExpressionContext): string {
        return this.safeExecute(
            () => {
                // 开始处理主表达式
                let result = '';
                const children = ctx.children;
                if (!children || children.length === 0) {
                    return ctx.text || '';
                }

                // 遍历所有子节点，逐一处理
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];

                    // 如果是terminal节点，检查是否为特殊操作符
                    if (child.payload && typeof child.payload.text === 'string') {
                        const text = child.payload.text;

                        // *** 修复：箭头操作符、点操作符和作用域操作符不加空格 ***
                        if (text === '->' || text === '.' || text === '::') {
                            result += text; // 直接添加，不加空格
                            continue;
                        }

                        // 其他terminal节点正常处理
                        result += text;
                    } else {
                        // 非terminal节点，递归访问
                        result += this.visitNode(child);
                    }
                }

                return result;
            },
            '格式化后缀表达式',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * *** 修复8: 改进通用表达式格式化，智能处理子节点 ***
     * 格式化通用表达式
     * 这是表达式层次的入口点，处理各种表达式类型
     */
    formatExpression(ctx: ExpressionContext): string {
        return this.safeExecute(
            () => {
                // 如果有子表达式，智能处理每个子节点
                if (ctx.children && ctx.children.length > 0) {
                    let result = '';

                    for (let i = 0; i < ctx.children.length; i++) {
                        const child = ctx.children[i];

                        // 检查是否为terminal节点
                        if (child.payload && typeof child.payload.text === 'string') {
                            const text = child.payload.text;

                            // *** 修复：特殊处理关键操作符 ***
                            if (text === '->' || text === '.' || text === '::') {
                                // 成员访问操作符：不加空格
                                result += text;
                            } else if (text.match(/^[+\-*/=<>!&|^%]/) && text.length > 1) {
                                // 复合运算符：使用formatOperator处理
                                result += this.context.core.formatOperator(text, text.includes('='));
                            } else {
                                // 其他terminal节点：正常添加
                                result += text;
                            }
                        } else {
                            // 非terminal节点：递归访问
                            result += this.visitNode(child);
                        }
                    }

                    return result;
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
                        result += this.context.indentManager.getIndent();

                        const exprResult = this.visitNode(expressions[i]);

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

    /**
     * 安全获取逻辑或表达式列表
     */
    private getLogicalOrExpressions(ctx: any): any[] {
        try {
            if (ctx.logicalOrExpression && typeof ctx.logicalOrExpression === 'function') {
                const result = ctx.logicalOrExpression();
                return Array.isArray(result) ? result : [result];
            }
            return [];
        } catch (error) {
            this.context.errorCollector.addError(`获取逻辑或表达式失败: ${error}`);
            return [];
        }
    }

    /**
     * 安全获取位异或表达式列表
     */
    private getBitwiseXorExpressions(ctx: any): any[] {
        try {
            if (ctx.bitwiseXorExpression && typeof ctx.bitwiseXorExpression === 'function') {
                const result = ctx.bitwiseXorExpression();
                return Array.isArray(result) ? result : [result];
            }
            return [];
        } catch (error) {
            this.context.errorCollector.addError(`获取位异或表达式失败: ${error}`);
            return [];
        }
    }

    /**
     * 安全获取位与表达式列表
     */
    private getBitwiseAndExpressions(ctx: any): any[] {
        try {
            if (ctx.bitwiseAndExpression && typeof ctx.bitwiseAndExpression === 'function') {
                const result = ctx.bitwiseAndExpression();
                return Array.isArray(result) ? result : [result];
            }
            return [];
        } catch (error) {
            this.context.errorCollector.addError(`获取位与表达式失败: ${error}`);
            return [];
        }
    }

    /**
     * 安全获取相等表达式列表
     */
    private getEqualityExpressions(ctx: any): any[] {
        try {
            if (ctx.equalityExpression && typeof ctx.equalityExpression === 'function') {
                const result = ctx.equalityExpression();
                return Array.isArray(result) ? result : [result];
            }
            return [];
        } catch (error) {
            this.context.errorCollector.addError(`获取相等表达式失败: ${error}`);
            return [];
        }
    }
}