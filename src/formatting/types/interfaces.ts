import { Token } from 'antlr4ts';
import * as vscode from 'vscode';
import { LPCFormattingOptions } from '../types';

/**
 * 错误收集器接口
 * 负责收集和管理格式化过程中的错误信息
 */
export interface IErrorCollector {
    /**
     * 添加错误信息
     * @param message 错误消息
     * @param context 可选的上下文信息
     */
    addError(message: string, context?: string): void;

    /**
     * 获取所有收集的错误
     * @returns 错误消息数组
     */
    getErrors(): string[];

    /**
     * 清空所有错误
     */
    clearErrors(): void;

    /**
     * 获取错误数量
     * @returns 错误总数
     */
    getErrorCount(): number;
}

/**
 * 缩进管理器接口
 * 负责管理代码缩进相关的逻辑
 */
export interface IIndentManager {
    /**
     * 获取当前缩进级别
     */
    getIndentLevel(): number;

    /**
     * 增加缩进级别
     * @param delta 增加的级别数，默认为1
     */
    increaseIndent(delta?: number): void;

    /**
     * 减少缩进级别
     * @param delta 减少的级别数，默认为1
     */
    decreaseIndent(delta?: number): void;

    /**
     * 设置缩进级别
     * @param level 目标缩进级别
     */
    setIndentLevel(level: number): void;

    /**
     * 获取当前缩进级别对应的缩进字符串
     * @param level 可选的特定缩进级别，默认使用当前级别
     * @returns 缩进字符串（空格或制表符）
     */
    getIndent(level?: number): string;

    /**
     * 计算指定上下文的缩进级别
     * @param context 上下文类型
     * @returns 计算后的缩进级别
     */
    calculateIndentLevel(context?: string): number;
}

/**
 * Token工具接口
 * 提供Token流相关的操作方法
 */
export interface ITokenUtils {
    /**
     * 获取两个上下文之间的Token
     * @param left 左侧上下文
     * @param right 右侧上下文
     * @returns Token或undefined
     */
    getTokenBetween(left: any, right: any): Token | undefined;

    /**
     * 检查Token是否为指定类型
     * @param token Token对象
     * @param type Token类型
     * @returns 是否匹配
     */
    isTokenType(token: Token | undefined, type: number): boolean;

    /**
     * 获取Token的文本内容
     * @param token Token对象
     * @returns 文本内容或空字符串
     */
    getTokenText(token: Token | undefined): string;
}

/**
 * 换行管理器接口
 * 负责换行和行长度相关的判断和管理
 */
export interface ILineBreakManager {
    /**
     * 判断是否需要换行
     * @param elements 元素数组
     * @param separator 分隔符，默认为', '
     * @param threshold 可选的阈值，默认使用配置值
     * @returns 是否需要换行
     */
    shouldWrapLine(elements: any[], separator?: string, threshold?: number): boolean;

    /**
     * 估算行长度
     * @param text 文本内容
     * @param includeIndent 是否包含缩进，默认为true
     * @returns 估算的行长度
     */
    estimateLineLength(text: string, includeIndent?: boolean): number;

    /**
     * 获取语句分隔符
     * @param current 当前语句
     * @param next 下一个语句
     * @returns 分隔符字符串
     */
    getStatementSeparator(current: any, next: any): string;

    /**
     * 检查是否为特定类型的语句
     * @param stmt 语句上下文
     * @param type 语句类型
     * @returns 是否匹配
     */
    isStatementType(stmt: any, type: 'function' | 'include' | 'block' | 'variable'): boolean;
}

/**
 * 格式化核心接口
 * 提供核心的格式化功能和实用方法
 */
export interface IFormattingCore {
    /**
     * 获取格式化选项
     * @returns 当前的格式化选项
     */
    getOptions(): LPCFormattingOptions;

    /**
     * 格式化运算符
     * @param operator 运算符字符串
     * @param isAssignment 是否为赋值运算符，默认为false
     * @returns 格式化后的运算符（包含空格）
     */
    formatOperator(operator: string, isAssignment?: boolean): string;

    /**
     * 检查节点访问限制
     * 防止无限递归
     * @returns 是否可以继续访问节点
     */
    checkNodeLimit(): boolean;

    /**
     * 重置节点计数器
     */
    resetNodeCount(): void;

    /**
     * 获取当前节点访问数量
     * @returns 节点访问数量
     */
    getNodeCount(): number;

    /**
     * 格式化修饰符列表
     * @param modifiers 修饰符数组
     * @returns 格式化后的修饰符字符串
     */
    formatModifiers(modifiers: string[]): string;
}

/**
 * 格式化上下文接口
 * 提供格式化过程中需要的所有核心服务
 */
export interface IFormattingContext {
    /** 错误收集器 */
    errorCollector: IErrorCollector;
    /** 缩进管理器 */
    indentManager: IIndentManager;
    /** Token工具 */
    tokenUtils: ITokenUtils;
    /** 换行管理器 */
    lineBreakManager: ILineBreakManager;
    /** 格式化核心 */
    core: IFormattingCore;
}

/**
 * 通用分隔列表格式化选项
 */
export interface DelimitedListOptions {
    /** 强制换行 */
    forceWrap?: boolean;
    /** 内联显示的最大元素数量 */
    maxInlineElements?: number;
    /** 是否在分隔符后添加空格 */
    addSpaceAfterSeparator?: boolean;
    /** 自定义分隔符 */
    separator?: string;
}

/**
 * 格式化策略枚举
 */
export enum FormattingStrategy {
    COMPACT = 'compact',
    EXPANDED = 'expanded',
    AUTO = 'auto'
}

/**
 * 缩进上下文类型
 */
export type IndentContext = 'normal' | 'case' | 'nested' | 'parameter' | 'expression';

/**
 * 语句类型枚举
 */
export enum StatementType {
    FUNCTION = 'function',
    INCLUDE = 'include',
    BLOCK = 'block',
    VARIABLE = 'variable',
    EXPRESSION = 'expression'
}

/**
 * 节点访问器接口
 * 用于在专用格式化器中访问 AST 节点
 */
export interface INodeVisitor {
    /**
     * 访问指定节点
     * @param node AST节点
     * @returns 格式化结果
     */
    visit(node: any): string;
}

/**
 * 专用格式化器基础接口
 * 所有专用格式化器都应该实现此接口
 */
export interface ISpecializedFormatter {
    /**
     * 格式化上下文引用
     */
    readonly context: IFormattingContext;
    
    /**
     * 节点访问器引用
     */
    readonly visitor: INodeVisitor;
    
    /**
     * 安全执行格式化操作
     * @param operation 格式化操作函数
     * @param errorMessage 错误消息
     * @param fallback 失败时的回退值
     * @returns 格式化结果
     */
    safeExecute<T>(operation: () => T, errorMessage: string, fallback?: T): T | undefined;
}

/**
 * 表达式格式化器接口
 * 专门处理各种表达式的格式化
 */
export interface IExpressionFormatter extends ISpecializedFormatter {
    /**
     * 格式化赋值表达式
     */
    formatAssignmentExpression(ctx: any): string;
    
    /**
     * 格式化加减表达式
     */
    formatAdditiveExpression(ctx: any): string;
    
    /**
     * 格式化乘除表达式
     */
    formatMultiplicativeExpression(ctx: any): string;
    
    /**
     * 格式化相等表达式
     */
    formatEqualityExpression(ctx: any): string;
    
    /**
     * 格式化关系表达式
     */
    formatRelationalExpression(ctx: any): string;
    
    /**
     * 格式化逻辑与表达式
     */
    formatLogicalAndExpression(ctx: any): string;
    
    /**
     * 格式化逻辑或表达式
     */
    formatLogicalOrExpression(ctx: any): string;
    
    /**
     * 格式化按位与表达式
     */
    formatBitwiseAndExpression(ctx: any): string;
    
    /**
     * 格式化按位或表达式
     */
    formatBitwiseOrExpression(ctx: any): string;
    
    /**
     * 格式化按位异或表达式
     */
    formatBitwiseXorExpression(ctx: any): string;
    
    /**
     * 格式化移位表达式
     */
    formatShiftExpression(ctx: any): string;
    
    /**
     * 格式化通用表达式
     */
    formatExpression(ctx: any): string;
    
    /**
     * 格式化表达式列表
     */
    formatExpressionList(ctx: any): string;
}

/**
 * 语句格式化器接口
 * 专门处理各种语句的格式化
 */
export interface IStatementFormatter extends ISpecializedFormatter {
    /**
     * 格式化if语句
     */
    formatIfStatement(ctx: any): string;
    
    /**
     * 格式化while语句
     */
    formatWhileStatement(ctx: any): string;
    
    /**
     * 格式化for语句
     */
    formatForStatement(ctx: any): string;
    
    /**
     * 格式化do-while语句
     */
    formatDoWhileStatement(ctx: any): string;
    
    /**
     * 格式化foreach语句
     */
    formatForeachStatement(ctx: any): string;
    
    /**
     * 格式化switch语句
     */
    formatSwitchStatement(ctx: any): string;
    
    /**
     * 格式化switch节
     */
    formatSwitchSection(ctx: any): string;
    
    /**
     * 格式化break语句
     */
    formatBreakStatement(ctx: any): string;
    
    /**
     * 格式化continue语句
     */
    formatContinueStatement(ctx: any): string;
    
    /**
     * 格式化return语句
     */
    formatReturnStatement(ctx: any): string;
    
    /**
     * 格式化表达式语句
     */
    formatExprStatement(ctx: any): string;
}

/**
 * 字面量格式化器接口
 * 专门处理各种字面量的格式化
 */
export interface ILiteralFormatter extends ISpecializedFormatter {
    /**
     * 格式化映射字面量
     */
    formatMappingLiteral(ctx: any): string;
    
    /**
     * 格式化数组字面量
     */
    formatArrayLiteral(ctx: any): string;
}

/**
 * 声明格式化器接口
 * 专门处理各种声明的格式化
 */
export interface IDeclarationFormatter extends ISpecializedFormatter {
    /**
     * 格式化函数定义
     */
    formatFunctionDef(ctx: any): string;
    
    /**
     * 格式化变量声明
     */
    formatVariableDecl(ctx: any): string;
    
    /**
     * 格式化变量声明符
     */
    formatVariableDeclarator(ctx: any): string;
    
    /**
     * 格式化参数
     */
    formatParameter(ctx: any): string;
    
    /**
     * 格式化参数列表
     */
    formatParameterList(ctx: any): string;
    
    /**
     * 格式化类型规范
     */
    formatTypeSpec(ctx: any): string;
    
    /**
     * 格式化结构定义
     */
    formatStructDef(ctx: any): string;
    
    /**
     * 格式化类定义
     */
    formatClassDef(ctx: any): string;
    
    /**
     * 格式化结构成员
     */
    formatStructMember(ctx: any): string;
    
    /**
     * 格式化结构成员列表
     */
    formatStructMemberList(ctx: any): string;
    
    /**
     * 格式化include语句
     */
    formatIncludeStatement(ctx: any): string;
    
    /**
     * 格式化inherit语句
     */
    formatInheritStatement(ctx: any): string;
}

/**
 * 代码块格式化器接口
 * 专门处理代码块的格式化
 */
export interface IBlockFormatter extends ISpecializedFormatter {
    /**
     * 格式化代码块
     */
    formatBlock(ctx: any): string;
}

/**
 * 扩展的格式化上下文接口
 * 包含所有专用格式化器
 */
export interface IExtendedFormattingContext extends IFormattingContext {
    /** 表达式格式化器 */
    expressionFormatter?: IExpressionFormatter;
    /** 语句格式化器 */
    statementFormatter?: IStatementFormatter;
    /** 字面量格式化器 */
    literalFormatter?: ILiteralFormatter;
    /** 声明格式化器 */
    declarationFormatter?: IDeclarationFormatter;
    /** 代码块格式化器 */
    blockFormatter?: IBlockFormatter;
    
    /**
     * 安全执行辅助方法
     * @param operation 操作函数
     * @param errorMessage 错误消息
     * @param fallback 回退值
     */
    safeExecute<T>(operation: () => T, errorMessage: string, fallback?: T): T | undefined;
}