import {
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
    ExprStatementContext
} from '../../antlr/LPCParser';

import { IStatementFormatter, IFormattingContext, INodeVisitor } from '../types/interfaces';

/**
 * 语句格式化器
 * 专门处理各种语句的格式化逻辑
 * 
 * 包含以下语句类型：
 * - 控制流语句 (if, while, for, do-while, foreach, switch)
 * - 跳转语句 (break, continue, return)
 * - 表达式语句
 * - switch节处理
 */
export class StatementFormatter implements IStatementFormatter {
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
     * 格式化if语句
     * 处理if条件、if体和else部分
     * 支持括号配置和缩进控制
     */
    formatIfStatement(ctx: IfStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'if';
                const options = this.context.core.getOptions();
                
                if (options.spaceBeforeOpenParen) {
                    result += ' ';
                }

                result += '(';
                
                if (ctx.expression && ctx.expression()) {
                    result += this.visitNode(ctx.expression());
                }
                
                result += ')';

                // 处理if体
                if (ctx.statement && ctx.statement().length > 0) {
                    const stmt = ctx.statement(0);
                    if (this.isBlock(stmt)) {
                        result += options.bracesOnNewLine ? '\n' + this.getIndent() : ' ';
                        result += this.visitNode(stmt);
                    } else {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.getIndent() + this.visitNode(stmt).trim();
                        this.context.indentManager.decreaseIndent();
                    }
                }

                // 处理else部分
                if (ctx.statement && ctx.statement().length > 1) {
                    result += '\n' + this.getIndent() + 'else';
                    const elseStmt = ctx.statement(1);
                    if (this.isBlock(elseStmt)) {
                        result += options.bracesOnNewLine ? '\n' + this.getIndent() : ' ';
                        result += this.visitNode(elseStmt);
                    } else {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.getIndent() + this.visitNode(elseStmt).trim();
                        this.context.indentManager.decreaseIndent();
                    }
                }

                return result;
            },
            '格式化if语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化while语句
     * 处理while条件和循环体
     */
    formatWhileStatement(ctx: WhileStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'while';
                const options = this.context.core.getOptions();
                
                if (options.spaceBeforeOpenParen) {
                    result += ' ';
                }

                result += '(';
                
                if (ctx.expression && ctx.expression()) {
                    result += this.visitNode(ctx.expression());
                }
                
                result += ')';

                // 处理while体
                if (ctx.statement && ctx.statement()) {
                    if (this.isBlock(ctx.statement())) {
                        result += options.bracesOnNewLine ? '\n' + this.getIndent() : ' ';
                        result += this.visitNode(ctx.statement());
                    } else {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.getIndent() + this.visitNode(ctx.statement()).trim();
                        this.context.indentManager.decreaseIndent();
                    }
                }

                return result;
            },
            '格式化while语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化for语句
     * 处理for初始化、条件、更新和循环体
     */
    formatForStatement(ctx: ForStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'for';
                const options = this.context.core.getOptions();
                
                if (options.spaceBeforeOpenParen) {
                    result += ' ';
                }

                result += '(';
                
                // 处理for初始化部分
                const forInit = ctx.forInit();
                if (forInit) {
                    result += this.visitNode(forInit);
                }
                result += ';';
                
                // 处理条件表达式
                const condition = ctx.expression();
                if (condition) {
                    result += ' ' + this.visitNode(condition);
                }
                result += ';';
                
                // 处理表达式列表
                const exprList = ctx.expressionList();
                if (exprList) {
                    result += ' ' + this.visitNode(exprList);
                }
                
                result += ')';

                // 处理for体
                if (ctx.statement && ctx.statement()) {
                    if (this.isBlock(ctx.statement())) {
                        result += options.bracesOnNewLine ? '\n' + this.getIndent() : ' ';
                        result += this.visitNode(ctx.statement());
                    } else {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.getIndent() + this.visitNode(ctx.statement()).trim();
                        this.context.indentManager.decreaseIndent();
                    }
                }

                return result;
            },
            '格式化for语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化do-while语句
     * 处理do体和while条件
     */
    formatDoWhileStatement(ctx: DoWhileStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'do';
                const options = this.context.core.getOptions();
                
                // 处理do体
                if (ctx.statement && ctx.statement()) {
                    if (this.isBlock(ctx.statement())) {
                        result += options.bracesOnNewLine ? '\n' + this.getIndent() : ' ';
                        result += this.visitNode(ctx.statement());
                    } else {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.getIndent() + this.visitNode(ctx.statement()).trim();
                        this.context.indentManager.decreaseIndent();
                        result += '\n' + this.getIndent();
                    }
                }

                result += 'while';
                
                if (options.spaceBeforeOpenParen) {
                    result += ' ';
                }

                result += '(';
                
                const condition = ctx.expression();
                if (condition) {
                    result += this.visitNode(condition);
                }
                
                result += ');';

                return result;
            },
            '格式化do-while语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化foreach语句
     * 处理foreach初始化、迭代对象和循环体
     */
    formatForeachStatement(ctx: ForeachStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'foreach';
                const options = this.context.core.getOptions();
                
                if (options.spaceBeforeOpenParen) {
                    result += ' ';
                }

                result += '(';
                
                // 处理foreach初始化
                const foreachInit = ctx.foreachInit();
                if (foreachInit) {
                    result += this.visitNode(foreachInit);
                }
                
                result += ' in ';
                
                const expr = ctx.expression();
                if (expr) {
                    result += this.visitNode(expr);
                }
                
                result += ')';

                // 处理foreach体
                if (ctx.statement && ctx.statement()) {
                    if (this.isBlock(ctx.statement())) {
                        result += options.bracesOnNewLine ? '\n' + this.getIndent() : ' ';
                        result += this.visitNode(ctx.statement());
                    } else {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.getIndent() + this.visitNode(ctx.statement()).trim();
                        this.context.indentManager.decreaseIndent();
                    }
                }

                return result;
            },
            '格式化foreach语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化switch语句
     * 处理switch表达式和switch体
     */
    formatSwitchStatement(ctx: SwitchStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'switch';
                const options = this.context.core.getOptions();
                
                if (options.spaceBeforeOpenParen) {
                    result += ' ';
                }

                result += '(';
                
                const expr = ctx.expression();
                if (expr) {
                    result += this.visitNode(expr);
                }
                
                result += ')';

                if (options.bracesOnNewLine) {
                    result += '\n' + this.getIndent() + '{\n';
                } else {
                    result += ' {\n';
                }

                this.context.indentManager.increaseIndent();

                // 处理switch节
                const sections = ctx.switchSection();
                for (const section of sections) {
                    result += this.visitNode(section);
                }

                this.context.indentManager.decreaseIndent();
                result += this.getIndent() + '}';

                return result;
            },
            '格式化switch语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化switch节
     * 处理case标签和对应的语句
     */
    formatSwitchSection(ctx: SwitchSectionContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();
                
                // 处理case标签
                const labels = ctx.switchLabelWithColon ? ctx.switchLabelWithColon() : [];
                for (const label of labels) {
                    if ((options as any).switchCaseAlignment === 'switch') {
                        // 与switch对齐
                        result += this.getIndent() + this.visitNode(label) + '\n';
                    } else {
                        // 缩进对齐
                        result += this.getIndent() + this.visitNode(label) + '\n';
                    }
                }
                
                // 处理case对应的语句
                this.context.indentManager.increaseIndent();
                const statements = ctx.statement ? ctx.statement() : [];
                for (const stmt of statements) {
                    const formattedStmt = this.visitNode(stmt);
                    if (formattedStmt.trim() !== '') {
                        result += this.getIndent() + formattedStmt.trim() + '\n';
                    }
                }
                this.context.indentManager.decreaseIndent();
                
                return result;
            },
            '格式化switch节',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化break语句
     */
    formatBreakStatement(ctx: BreakStatementContext): string {
        return 'break;';
    }

    /**
     * 格式化continue语句
     */
    formatContinueStatement(ctx: ContinueStatementContext): string {
        return 'continue;';
    }

    /**
     * 格式化return语句
     * 处理可选的返回表达式
     */
    formatReturnStatement(ctx: ReturnStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'return';
                
                const expr = ctx.expression();
                if (expr) {
                    result += ' ' + this.visitNode(expr);
                }
                
                return result + ';';
            },
            '格式化return语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化表达式语句
     * 确保分号紧跟表达式，不会被移到下一行
     */
    formatExprStatement(ctx: ExprStatementContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                
                const expr = ctx.expression();
                if (expr) {
                    result = this.visitNode(expr);
                }
                
                return result + ';';
            },
            '格式化表达式语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 辅助方法：获取当前缩进
     */
    private getIndent(): string {
        return this.context.indentManager.getIndent();
    }

    /**
     * 辅助方法：判断是否为代码块
     */
    private isBlock(stmt: any): boolean {
        return this.context.lineBreakManager.isStatementType(stmt, 'block');
    }

    /**
     * 辅助方法：访问节点
     */
    private visitNode(node: any): string {
        if (!node) return '';
        return this.visitor.visit(node);
    }
}