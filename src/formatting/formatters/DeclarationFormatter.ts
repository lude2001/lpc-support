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
                        result += this.visitNode(typeSpec) + ' ';
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
     * 处理类型和变量声明符列表
     */
    formatVariableDecl(ctx: VariableDeclContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();

                // 处理类型
                const typeSpec = ctx.typeSpec();
                if (typeSpec) {
                    result += this.visitNode(typeSpec) + ' ';
                }

                // 处理变量声明符列表
                const declarators = ctx.variableDeclarator();
                for (let i = 0; i < declarators.length; i++) {
                    if (i > 0) {
                        result += options.spaceAfterComma ? ', ' : ',';
                    }
                    result += this.visitNode(declarators[i]);
                }

                return result + ';';
            },
            '格式化变量声明',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化变量声明符
     * 处理变量名前的星号（数组标记）和初始化表达式
     * 
     * 支持的格式：
     * - var          (简单变量)
     * - *var         (一级指针/数组)
     * - **var        (二级指针/数组)
     * - var = expr   (带初始化)
     * - *var = expr  (数组带初始化)
     */
    formatVariableDeclarator(ctx: any): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();

                // 处理星号标记（数组/指针声明）
                if (ctx.STAR && ctx.STAR()) {
                    const stars = ctx.STAR();
                    for (const star of stars) {
                        // 根据配置决定星号的空格位置
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

                // 处理变量名
                if (ctx.Identifier && ctx.Identifier()) {
                    const identifier = ctx.Identifier().text;
                    
                    // 如果星号配置为'after'且没有额外空格，直接连接变量名
                    if (ctx.STAR && ctx.STAR() && (options as any).starSpacePosition === 'after') {
                        result += identifier;
                    } else if (ctx.STAR && ctx.STAR() && (options as any).starSpacePosition !== 'both') {
                        // 为'before'模式添加空格
                        result += ' ' + identifier;
                    } else {
                        result += identifier;
                    }
                }

                // 处理初始化表达式
                if (ctx.expression && ctx.expression()) {
                    result += options.spaceAroundAssignmentOperators ? ' = ' : '=';
                    result += this.visitNode(ctx.expression());
                }

                return result;
            },
            '格式化变量声明符',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化单个参数
     * 处理参数类型、修饰符、参数名和默认值
     */
    formatParameter(ctx: ParameterContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();

                // 处理参数类型
                const typeSpec = ctx.typeSpec();
                if (typeSpec) {
                    result += this.visitNode(typeSpec);
                }

                // 处理星号（数组/指针参数）
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

                // 处理参数名
                const identifierNode = ctx.Identifier();
                if (identifierNode) {
                    const identifier = identifierNode.text;
                    
                    // 根据星号位置决定是否需要空格
                    if (result !== '' && !result.endsWith(' ') && !result.endsWith('*')) {
                        result += ' ';
                    } else if (result.endsWith('*') && (options as any).starSpacePosition === 'after') {
                        // 不添加额外空格
                    } else if (result.endsWith('*')) {
                        result += ' ';
                    }
                    
                    result += identifier;
                }

                return result;
            },
            '格式化参数',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化参数列表
     * 支持自动换行和适当的缩进
     */
    formatParameterList(ctx: ParameterListContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                const options = this.context.core.getOptions();
                
                const params = ctx.parameter();
                
                // 检查参数列表是否应该换行
                const shouldWrapParams = params.length > 3 || 
                    this.context.lineBreakManager.estimateLineLength(
                        params.map(p => this.visitNode(p)).join(', ')
                    ) > options.maxLineLength;
                
                if (shouldWrapParams) {
                    result += '\n';
                    this.context.indentManager.increaseIndent();
                    
                    for (let i = 0; i < params.length; i++) {
                        result += this.getIndent() + this.visitNode(params[i]);
                        if (i < params.length - 1) {
                            result += ',';
                        }
                        result += '\n';
                    }
                    
                    this.context.indentManager.decreaseIndent();
                    result += this.getIndent();
                } else {
                    // 单行参数列表
                    for (let i = 0; i < params.length; i++) {
                        result += this.visitNode(params[i]);
                        if (i < params.length - 1) {
                            result += options.spaceAfterComma ? ', ' : ',';
                        }
                    }
                }

                return result;
            },
            '格式化参数列表',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化类型规范
     * 处理基础类型和复合类型（如 mapping, int *, mapping * 等）
     * 支持 spaceAfterTypeBeforeStar 配置选项
     */
    formatTypeSpec(ctx: TypeSpecContext): string {
        return this.safeExecute(
            () => {
                // 获取类型文本
                let typeText = ctx.text || '';
                const options = this.context.core.getOptions();
                
                // 检查是否需要在类型名和星号之间添加空格
                // 这主要处理语法中直接包含星号的情况，如 "mapping*" -> "mapping *"
                if ((options as any).spaceAfterTypeBeforeStar && typeText.includes('*')) {
                    // 将类型名和星号分离，并在中间添加空格
                    typeText = typeText.replace(/(\w)(\*+)/g, '$1 $2');
                }
                
                return typeText;
            },
            '格式化类型规范',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化结构定义
     * 处理结构名和成员列表
     */
    formatStructDef(ctx: StructDefContext): string {
        return this.safeExecute(
            () => {
                let result = 'struct ';
                const options = this.context.core.getOptions();
                
                if (ctx.Identifier && ctx.Identifier()) {
                    result += ctx.Identifier().text;
                }

                if (options.bracesOnNewLine) {
                    result += '\n' + this.getIndent() + '{\n';
                } else {
                    result += ' {\n';
                }

                this.context.indentManager.increaseIndent();

                const memberList = ctx.structMemberList();
                if (memberList) {
                    result += this.visitNode(memberList);
                }

                this.context.indentManager.decreaseIndent();
                result += this.getIndent() + '}';

                return result;
            },
            '格式化结构定义',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化类定义
     * 处理类名和成员列表
     */
    formatClassDef(ctx: ClassDefContext): string {
        return this.safeExecute(
            () => {
                let result = 'class ';
                const options = this.context.core.getOptions();
                
                if (ctx.Identifier && ctx.Identifier()) {
                    result += ctx.Identifier().text;
                }

                if (options.bracesOnNewLine) {
                    result += '\n' + this.getIndent() + '{\n';
                } else {
                    result += ' {\n';
                }

                this.context.indentManager.increaseIndent();

                const memberList = ctx.structMemberList();
                if (memberList) {
                    result += this.visitNode(memberList);
                }

                this.context.indentManager.decreaseIndent();
                result += this.getIndent() + '}';

                return result;
            },
            '格式化类定义',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化结构成员
     * 处理成员类型、指针标记和成员名
     */
    formatStructMember(ctx: StructMemberContext): string {
        return this.safeExecute(
            () => {
                let result = '';

                // 处理类型
                if (ctx.typeSpec && ctx.typeSpec()) {
                    result += this.visitNode(ctx.typeSpec());
                }

                // 处理指针标记
                if (ctx.STAR && ctx.STAR()) {
                    for (const star of ctx.STAR()) {
                        result += '*';
                    }
                }

                result += ' ';

                // 处理成员名
                if (ctx.Identifier && ctx.Identifier()) {
                    result += ctx.Identifier().text;
                }

                return result + ';';
            },
            '格式化结构成员',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化结构成员列表
     * 处理所有结构成员的格式化和缩进
     */
    formatStructMemberList(ctx: StructMemberListContext): string {
        return this.safeExecute(
            () => {
                let result = '';
                
                const members = ctx.structMember();
                for (const member of members) {
                    result += this.getIndent() + this.visitNode(member) + '\n';
                }

                return result;
            },
            '格式化结构成员列表',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化include语句
     * 处理包含路径表达式
     */
    formatIncludeStatement(ctx: IncludeStatementContext): string {
        return this.safeExecute(
            () => {
                let result = '#include ';
                
                // 处理包含路径表达式
                const expr = ctx.expression();
                if (expr) {
                    result += this.visitNode(expr);
                }

                return result;
            },
            '格式化include语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化inherit语句
     * 处理继承路径表达式
     */
    formatInheritStatement(ctx: InheritStatementContext): string {
        return this.safeExecute(
            () => {
                let result = 'inherit ';
                
                // 处理继承路径表达式
                const expr = ctx.expression();
                if (expr) {
                    result += this.visitNode(expr);
                }

                return result + ';';
            },
            '格式化inherit语句',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 辅助方法：提取函数修饰符
     */
    private extractModifiers(ctx: FunctionDefContext): string[] {
        const modifiers: string[] = [];
        // 这里需要根据具体的语法结构来提取修饰符
        // 暂时返回空数组
        return modifiers;
    }

    /**
     * 辅助方法：获取当前缩进
     */
    private getIndent(): string {
        return this.context.indentManager.getIndent();
    }

    /**
     * 辅助方法：访问节点
     */
    private visitNode(node: any): string {
        if (!node) return '';
        return this.visitor.visit(node);
    }
}