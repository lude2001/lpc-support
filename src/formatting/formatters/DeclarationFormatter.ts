import {
    FunctionDefContext,
    VariableDeclContext,
    ParameterContext,
    ParameterListContext,
    TypeSpecContext,
    StructDefContext,
    ClassDefContext,
    StructMemberContext,
    StructMemberListContext,
    IncludeStatementContext,
    InheritStatementContext
} from '../../antlr/LPCParser';

import { IDeclarationFormatter, IFormattingContext, INodeVisitor } from '../types/interfaces';

/**
 * 声明格式化器
 * 专门处理各种声明的格式化逻辑
 *
 * 包含以下声明类型：
 * - 函数定义
 * - 变量声明和声明符
 * - 参数和参数列表
 * - 类型规范
 * - 结构定义和成员
 * - 类定义
 * - include和inherit语句
 */
export class DeclarationFormatter implements IDeclarationFormatter {
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
     * 格式化函数定义
     * 处理函数修饰符、返回类型、函数名、参数列表和函数体
     */
    formatFunctionDef(ctx: FunctionDefContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();

                // 处理函数修饰符
                const modifiers = this.extractModifiers(ctx);
                if (modifiers.length > 0) {
                    result += this.context.core.formatModifiers(modifiers) + ' ';
                }

                // 处理返回类型
                if (ctx.typeSpec && ctx.typeSpec()) {
                    const typeSpec = ctx.typeSpec();
                    if (typeSpec) {
                        result += this.visitNode(typeSpec);
                    }
                }

                // 处理返回类型后的星号（根据语法：typeSpec? STAR* Identifier）
                if (ctx.STAR && ctx.STAR()) {
                    const stars = ctx.STAR();
                    for (const star of stars) {
                        switch ((options as any).starSpacePosition) {
                            case 'before':
                                result += ' *';
                                break;
                            case 'after':
                                result += '*';
                                break;
                            case 'both':
                                result += ' * ';
                                break;
                            default:
                                result += '*';
                        }
                    }
                }

                // *** 修复1: 确保在返回类型（含星号）和函数名之间有且仅有一个空格 ***
                if (ctx.typeSpec && ctx.typeSpec() || ctx.STAR && ctx.STAR()) {
                    // 确保在函数名前有且仅有一个空格
                    if (!result.endsWith(' ')) {
                        result += ' ';
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
                            result += options.spaceAfterComma ? ', ' : ',';
                        }
                        result += this.visitNode(params[i]);
                    }
                }
                result += ')';

                // 处理函数体
                if (ctx.block && ctx.block()) {
                    if (options.bracesOnNewLine) {
                        result += '\n' + this.getIndent();
                    } else {
                        result += options.spaceBeforeOpenParen ? ' ' : '';
                    }
                    result += this.visitNode(ctx.block());
                }

                return result + '\n';
            },
            '格式化函数定义',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化变量声明
     * 处理类型、星号、变量名和初始值
     */
    formatVariableDecl(ctx: VariableDeclContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();

                // *** 修复2: 处理变量声明中的类型和变量名 ***
                // 处理类型规范
                if (ctx.typeSpec && ctx.typeSpec()) {
                    result += this.visitNode(ctx.typeSpec());
                }

                // 处理星号 - 安全访问STAR tokens
                const starTokens = this.getStarTokens(ctx);
                for (const star of starTokens) {
                    switch ((options as any).starSpacePosition) {
                        case 'before':
                            result += ' *';
                            break;
                        case 'after':
                            result += '*';
                            break;
                        case 'both':
                            result += ' * ';
                            break;
                        default:
                            result += ' *'; // 默认在星号前加空格
                    }
                }

                // 在类型和变量名之间添加空格
                if (ctx.typeSpec && ctx.typeSpec()) {
                    if (!result.endsWith(' ')) {
                        result += ' ';
                    }
                }

                // 处理变量名 - 安全访问Identifier
                const identifier = this.getIdentifierToken(ctx);
                if (identifier) {
                    result += identifier;
                }

                // 处理初始值 - 安全访问assignment expression
                const assignExpr = this.getAssignmentExpression(ctx);
                if (assignExpr) {
                    result += this.context.core.formatOperator('=', true);
                    result += this.visitNode(assignExpr);
                }

                // *** 修复3: 确保每个变量声明只有一个分号 ***
                return result;
            },
            '格式化变量声明',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化参数
     * 处理参数类型、星号和参数名
     */
    formatParameter(ctx: ParameterContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();

                // 处理类型规范
                if (ctx.typeSpec && ctx.typeSpec()) {
                    result += this.visitNode(ctx.typeSpec());
                }

                // 处理星号 (正确处理指针参数)
                if (ctx.STAR && ctx.STAR()) {
                    const stars = ctx.STAR();
                    for (const star of stars) {
                        switch ((options as any).starSpacePosition) {
                            case 'before':
                                result += ' *';
                                break;
                            case 'after':
                                result += '*';
                                break;
                            case 'both':
                                result += ' * ';
                                break;
                            default:
                                result += ' *'; // 默认格式：int *ptr
                        }
                    }
                }

                // 在类型和参数名之间添加空格
                if (ctx.typeSpec && ctx.typeSpec()) {
                    if (!result.endsWith(' ')) {
                        result += ' ';
                    }
                }

                // 处理参数名 - 安全访问
                const paramName = this.getIdentifierToken(ctx);
                if (paramName) {
                    result += paramName;
                }

                // 处理省略号
                if (ctx.ELLIPSIS && ctx.ELLIPSIS()) {
                    result += '...';
                }

                return result;
            },
            '格式化参数',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化参数列表
     * 处理多个参数及其分隔符
     */
    formatParameterList(ctx: ParameterListContext): string {
        return this.safeExecute(
            () => {
                const options = this.context.core.getOptions();
                const params = ctx.parameter ? ctx.parameter() : [];
                let result = '';

                for (let i = 0; i < params.length; i++) {
                    if (i > 0) {
                        result += options.spaceAfterComma ? ', ' : ',';
                    }
                    result += this.visitNode(params[i]);
                }

                return result;
            },
            '格式化参数列表',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * *** 修复4: 改进类型规范格式化，正确处理指针类型 ***
     * 格式化类型规范
     * 处理基础类型和复合类型（如 mapping, int *, mapping * 等）
     * 支持 spaceAfterTypeBeforeStar 配置选项
     *
     * @param ctx 类型规范上下文
     * @returns 格式化后的类型字符串
     */
    formatTypeSpec(ctx: TypeSpecContext): string {
        return this.safeExecute(
            () => {
                // 直接返回类型文本，不在这里处理星号
                // 星号在上级节点中处理，避免重复处理
                let typeText = ctx.text || '';

                // 移除类型名中的多余空格，但保留基本的类型名
                typeText = typeText.replace(/\s+/g, ' ').trim();

                return typeText;
            },
            '格式化类型规范',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化结构定义
     */
    formatStructDef(ctx: StructDefContext): string {
        return this.safeExecute(
            () => {
                let result = 'struct ';
                const options = this.context.core.getOptions();

                // 处理结构名
                if (ctx.Identifier && ctx.Identifier()) {
                    result += ctx.Identifier().text;
                }

                // 处理结构体
                if (options.bracesOnNewLine) {
                    result += '\n' + this.getIndent() + '{';
                } else {
                    result += ' {';
                }

                // 处理成员列表
                if (ctx.structMemberList && ctx.structMemberList()) {
                    const memberList = this.visitNode(ctx.structMemberList());
                    if (memberList) {
                        result += '\n' + this.context.indentManager.increaseIndent();
                        result += memberList;
                        result += '\n' + this.context.indentManager.decreaseIndent();
                    }
                }

                result += '}';
                return result;
            },
            '格式化结构定义',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化类定义
     */
    formatClassDef(ctx: ClassDefContext): string {
        return this.safeExecute(
            () => {
                let result = 'class ';
                const options = this.context.core.getOptions();

                // 处理类名
                if (ctx.Identifier && ctx.Identifier()) {
                    result += ctx.Identifier().text;
                }

                // 处理继承 - 安全访问继承列表
                const inheritanceList = this.getInheritanceList(ctx);
                if (inheritanceList) {
                    result += ' : ';
                    result += this.visitNode(inheritanceList);
                }

                // 处理类体
                if (options.bracesOnNewLine) {
                    result += '\n' + this.getIndent() + '{';
                } else {
                    result += ' {';
                }

                // 处理成员列表 - 安全访问类成员列表
                const memberList = this.getClassMemberList(ctx);
                if (memberList) {
                    const formattedMemberList = this.visitNode(memberList);
                    if (formattedMemberList) {
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        result += this.context.indentManager.getCurrentIndent() + formattedMemberList;
                        this.context.indentManager.decreaseIndent();
                        result += '\n' + this.context.indentManager.getCurrentIndent();
                    }
                }

                result += '}';
                return result;
            },
            '格式化类定义',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化结构成员
     */
    formatStructMember(ctx: StructMemberContext): string {
        return this.safeExecute(
            () => {
                let result = '';

                // 处理类型规范
                if (ctx.typeSpec && ctx.typeSpec()) {
                    result += this.visitNode(ctx.typeSpec());
                }

                // 处理星号
                if (ctx.STAR && ctx.STAR()) {
                    const stars = ctx.STAR();
                    for (const star of stars) {
                        result += ' *';
                    }
                }

                // 在类型和成员名之间添加空格
                if (ctx.typeSpec && ctx.typeSpec()) {
                    if (!result.endsWith(' ')) {
                        result += ' ';
                    }
                }

                // 处理成员名
                if (ctx.Identifier && ctx.Identifier()) {
                    result += ctx.Identifier().text;
                }

                // 处理数组维度 - 安全访问方括号
                if (this.hasBrackets(ctx)) {
                    result += '[]';
                }

                return result + ';';
            },
            '格式化结构成员',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化结构成员列表
     */
    formatStructMemberList(ctx: StructMemberListContext): string {
        return this.safeExecute(
            () => {
                const members = ctx.structMember ? ctx.structMember() : [];
                let result = '';

                for (let i = 0; i < members.length; i++) {
                    if (i > 0) {
                        result += '\n';
                    }
                    result += this.context.indentManager.getCurrentIndent();
                    result += this.visitNode(members[i]);
                }

                return result;
            },
            '格式化结构成员列表',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化包含语句
     */
    formatIncludeStatement(ctx: IncludeStatementContext): string {
        return this.safeExecute(
            () => {
                let result = '#include ';

                const stringLiteral = this.getStringLiteral(ctx);
                if (stringLiteral) {
                    result += stringLiteral;
                }

                return result;
            },
            '格式化包含语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化继承语句
     */
    formatInheritStatement(ctx: InheritStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'inherit ';

                const inheritValue = this.getInheritValue(ctx);
                if (inheritValue) {
                    result += inheritValue;
                }

                return result;
            },
            '格式化继承语句',
            ctx.text
        ) || ctx.text || '';
    }

    // === 辅助方法 ===

    /**
     * 访问子节点
     */
    private visitNode(node: any): string {
        return this.visitor.visit ? this.visitor.visit(node) || '' : '';
    }

    /**
     * 获取当前缩进
     */
    private getIndent(): string {
        return this.context.indentManager.getCurrentIndent();
    }

    /**
     * 提取函数修饰符
     * @param ctx 函数定义上下文
     * @returns 修饰符数组
     */
    private extractModifiers(ctx: FunctionDefContext): string[] {
        const modifiers: string[] = [];

        // 检查各种修饰符token
        // 这里需要根据实际的语法规则来实现
        // 目前返回空数组，因为需要访问具体的token

        return modifiers;
    }

    /**
     * 安全获取STAR tokens
     */
    private getStarTokens(ctx: any): string[] {
        try {
            if (ctx.STAR) {
                if (typeof ctx.STAR === 'function') {
                    const stars = ctx.STAR();
                    return Array.isArray(stars) ? stars.map(() => '*') : ['*'];
                }
            }
            return [];
        } catch (error) {
            this.context.errorCollector.addError(`获取STAR tokens失败: ${error}`);
            return [];
        }
    }

    /**
     * 安全获取Identifier
     */
    private getIdentifierToken(ctx: any): string | null {
        try {
            if (ctx.Identifier) {
                if (typeof ctx.Identifier === 'function') {
                    const identifier = ctx.Identifier();
                    return identifier ? (identifier.text || identifier.getText ? identifier.getText() : '') : null;
                }
            }
            // 尝试通过子节点查找
            if (ctx.children) {
                for (const child of ctx.children) {
                    if (child.symbol && child.symbol.text) {
                        return child.symbol.text;
                    }
                }
            }
            return null;
        } catch (error) {
            this.context.errorCollector.addError(`获取Identifier失败: ${error}`);
            return null;
        }
    }

    /**
     * 安全获取赋值表达式
     */
    private getAssignmentExpression(ctx: any): any {
        try {
            if (ctx.assignmentExpression && typeof ctx.assignmentExpression === 'function') {
                return ctx.assignmentExpression();
            }
            return null;
        } catch (error) {
            this.context.errorCollector.addError(`获取赋值表达式失败: ${error}`);
            return null;
        }
    }

    /**
     * 安全获取继承列表
     */
    private getInheritanceList(ctx: any): any {
        try {
            if (ctx.inheritanceList && typeof ctx.inheritanceList === 'function') {
                return ctx.inheritanceList();
            }
            return null;
        } catch (error) {
            this.context.errorCollector.addError(`获取继承列表失败: ${error}`);
            return null;
        }
    }

    /**
     * 安全获取类成员列表
     */
    private getClassMemberList(ctx: any): any {
        try {
            if (ctx.classMemberList && typeof ctx.classMemberList === 'function') {
                return ctx.classMemberList();
            }
            return null;
        } catch (error) {
            this.context.errorCollector.addError(`获取类成员列表失败: ${error}`);
            return null;
        }
    }

    /**
     * 安全检查是否有方括号
     */
    private hasBrackets(ctx: any): boolean {
        try {
            return (ctx.LBRACK && ctx.RBRACK) ||
                   (ctx.getChild && ctx.getChild(0) && ctx.getChild(0).symbol &&
                    ctx.getChild(0).symbol.text === '[');
        } catch (error) {
            this.context.errorCollector.addError(`检查方括号失败: ${error}`);
            return false;
        }
    }

    /**
     * 安全获取字符串字面量
     */
    private getStringLiteral(ctx: any): string | null {
        try {
            if (ctx.STRING_LITERAL && typeof ctx.STRING_LITERAL === 'function') {
                const literal = ctx.STRING_LITERAL();
                return literal ? literal.text : null;
            }
            if (ctx.ANGLE_STRING_LITERAL && typeof ctx.ANGLE_STRING_LITERAL === 'function') {
                const literal = ctx.ANGLE_STRING_LITERAL();
                return literal ? literal.text : null;
            }
            return null;
        } catch (error) {
            this.context.errorCollector.addError(`获取字符串字面量失败: ${error}`);
            return null;
        }
    }

    /**
     * 安全获取inherit值
     */
    private getInheritValue(ctx: any): string | null {
        try {
            const stringLiteral = this.getStringLiteral(ctx);
            if (stringLiteral) {
                return stringLiteral;
            }

            const identifier = this.getIdentifierToken(ctx);
            if (identifier) {
                return identifier;
            }

            return null;
        } catch (error) {
            this.context.errorCollector.addError(`获取inherit值失败: ${error}`);
            return null;
        }
    }
}