import { CommonTokenStream } from 'antlr4ts';
import { IFormattingCore } from '../types/interfaces';
import { LPCFormattingOptions } from '../types';

/**
 * 格式化核心实现
 * 提供核心的格式化功能和实用方法
 */
export class FormattingCore implements IFormattingCore {
    private tokenStream: CommonTokenStream;
    private options: LPCFormattingOptions;
    private nodeCount: number = 0;
    private maxNodes: number = 10000; // 防止无限递归

    /**
     * 构造函数
     * @param tokenStream Token流
     * @param options 格式化选项配置
     */
    constructor(tokenStream: CommonTokenStream, options: LPCFormattingOptions) {
        this.tokenStream = tokenStream;
        this.options = options;
    }

    /**
     * 获取格式化选项
     * @returns 当前的格式化选项
     */
    getOptions(): LPCFormattingOptions {
        return this.options;
    }

    /**
     * *** 修复5: 改进运算符格式化，正确处理箭头操作符和复合赋值运算符 ***
     * 格式化运算符
     * @param operator 运算符字符串
     * @param isAssignment 是否为赋值运算符，默认为false
     * @returns 格式化后的运算符（包含空格）
     */
    formatOperator(operator: string, isAssignment: boolean = false): string {
        // 获取配置选项，使用合理的默认值
        const options = this.options as any;

        // 特殊处理：箭头操作符和成员访问符不应该有空格
        if (operator === '->' || operator === '.' || operator === '::') {
            return operator; // 直接返回，不添加空格
        }

        // 特殊处理：复合赋值运算符（+=, -=, *=, /=, etc.）
        if (operator.endsWith('=') && operator.length > 1) {
            // 复合赋值运算符，确保作为一个整体处理
            const useSpace = options.spaceAroundAssignmentOperators !== false &&
                            (options.spaceAroundAssignmentOperators || options.spaceAroundOperators);
            return useSpace ? ` ${operator} ` : operator;
        }

        if (isAssignment) {
            // 单纯赋值运算符空格处理
            const useSpace = options.spaceAroundAssignmentOperators !== false &&
                            (options.spaceAroundAssignmentOperators || options.spaceAroundOperators);
            return useSpace ? ` ${operator} ` : operator;
        } else {
            // 二元运算符空格处理
            const useSpace = options.spaceAroundBinaryOperators !== false &&
                            (options.spaceAroundBinaryOperators || options.spaceAroundOperators);
            return useSpace ? ` ${operator} ` : operator;
        }
    }

    /**
     * 检查节点访问限制
     * 防止无限递归
     * @returns 是否可以继续访问节点
     */
    checkNodeLimit(): boolean {
        this.nodeCount++;
        if (this.nodeCount > this.maxNodes) {
            console.warn(`访问节点数量超过限制 (${this.maxNodes})，可能存在无限递归`);
            return false;
        }
        return true;
    }

    /**
     * 重置节点计数器
     */
    resetNodeCount(): void {
        this.nodeCount = 0;
    }

    /**
     * 获取当前节点访问数量
     * @returns 节点访问数量
     */
    getNodeCount(): number {
        return this.nodeCount;
    }

    /**
     * 格式化修饰符列表
     * @param modifiers 修饰符数组
     * @returns 格式化后的修饰符字符串
     */
    formatModifiers(modifiers: string[]): string {
        if (modifiers.length === 0) {
            return '';
        }

        // 根据配置的顺序排序修饰符
        const ordered = modifiers.sort((a, b) => {
            const orderA = this.options.functionModifierOrder.indexOf(a);
            const orderB = this.options.functionModifierOrder.indexOf(b);
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
        });

        return ordered.join(' ');
    }

    /**
     * 设置节点访问限制
     * @param maxNodes 最大节点数量
     */
    setMaxNodes(maxNodes: number): void {
        this.maxNodes = Math.max(1000, maxNodes); // 至少1000个节点
    }

    /**
     * 获取节点访问限制
     * @returns 最大节点数量
     */
    getMaxNodes(): number {
        return this.maxNodes;
    }

    /**
     * 检查是否达到节点限制
     * @returns 是否已达到限制
     */
    isAtNodeLimit(): boolean {
        return this.nodeCount >= this.maxNodes;
    }

    /**
     * 格式化逗号（确保逗号后有适当空格）
     * @param addSpace 是否强制添加空格，默认使用配置
     * @returns 格式化后的逗号字符串
     */
    formatComma(addSpace?: boolean): string {
        const shouldAddSpace = addSpace !== undefined ? addSpace : this.options.spaceAfterComma;
        return shouldAddSpace ? ', ' : ',';
    }

    /**
     * 格式化冒号（确保冒号周围有适当空格）
     * @returns 格式化后的冒号字符串
     */
    formatColon(): string {
        const options = this.options as any;
        const useSpace = options.spaceAroundOperators !== false;
        return useSpace ? ' : ' : ':';
    }

    /**
     * 格式化函数参数列表
     * @param params 参数数组
     * @param formatter 参数格式化函数
     * @returns 格式化后的参数字符串
     */
    formatParameterList<T>(params: T[], formatter: (param: T) => string): string {
        if (params.length === 0) {
            return '';
        }

        return params.map(formatter).join(this.formatComma());
    }

    /**
     * 格式化表达式列表
     * @param expressions 表达式数组
     * @param formatter 表达式格式化函数
     * @returns 格式化后的表达式字符串
     */
    formatExpressionList<T>(expressions: T[], formatter: (expr: T) => string): string {
        if (expressions.length === 0) {
            return '';
        }

        return expressions.map(formatter).join(this.formatComma());
    }

    /**
     * 格式化括号内容
     * @param content 括号内的内容
     * @param openBrace 开括号字符
     * @param closeBrace 闭括号字符
     * @returns 格式化后的括号内容
     */
    formatBracedContent(content: string, openBrace: string = '(', closeBrace: string = ')'): string {
        let result = openBrace;

        if (this.options.spaceAfterOpenParen) {
            result += ' ';
        }

        result += content;

        if (this.options.spaceBeforeCloseParen) {
            result += ' ';
        }

        result += closeBrace;
        return result;
    }

    /**
     * 检查是否需要在关键字后添加空格
     * @param keyword 关键字
     * @returns 是否需要添加空格
     */
    shouldAddSpaceAfterKeyword(keyword: string): boolean {
        if (!this.options.insertSpaceAfterKeywords) {
            return false;
        }

        // 某些关键字后总是需要空格
        const spaceRequiredKeywords = ['if', 'while', 'for', 'switch', 'catch', 'return'];
        return spaceRequiredKeywords.includes(keyword.toLowerCase());
    }

    /**
     * 格式化关键字
     * @param keyword 关键字
     * @returns 格式化后的关键字（可能包含后续空格）
     */
    formatKeyword(keyword: string): string {
        return this.shouldAddSpaceAfterKeyword(keyword) ? `${keyword} ` : keyword;
    }

    /**
     * 检查是否应该在操作符周围添加空格
     * @param operator 操作符
     * @returns 是否应该添加空格
     */
    shouldAddSpaceAroundOperator(operator: string): boolean {
        // 箭头操作符和成员访问符不需要空格
        if (operator === '->' || operator === '.' || operator === '::') {
            return false;
        }

        // 一元操作符通常不需要空格
        const unaryOperators = ['++', '--', '!', '~', '+', '-'];
        if (unaryOperators.includes(operator)) {
            return false;
        }

        // 其他操作符根据配置决定
        return this.options.spaceAroundBinaryOperators;
    }

    /**
     * 格式化类型规范
     * @param typeText 类型文本
     * @returns 格式化后的类型文本
     */
    formatTypeSpec(typeText: string): string {
        if (!typeText) {
            return '';
        }

        // 检查是否需要在类型名和星号之间添加空格
        if (this.options.spaceAfterTypeBeforeStar && typeText.includes('*')) {
            // 将类型名和星号分离，并在中间添加空格
            return typeText.replace(/(\w)(\*+)/g, '$1 $2');
        }

        return typeText;
    }

    /**
     * 格式化星号标记（指针/数组标记）
     * @param starCount 星号数量
     * @returns 格式化后的星号字符串
     */
    formatStarMarkers(starCount: number): string {
        if (starCount <= 0) {
            return '';
        }

        const stars = '*'.repeat(starCount);

        switch (this.options.starSpacePosition) {
            case 'before':
                return ` ${stars}`;
            case 'after':
                return stars;
            case 'both':
                return ` ${stars} `;
            default:
                return stars;
        }
    }

    /**
     * 检查是否应该使用紧凑格式
     * @param itemCount 项目数量
     * @param estimatedLength 估算长度
     * @returns 是否使用紧凑格式
     */
    shouldUseCompactFormat(itemCount: number, estimatedLength: number): boolean {
        return itemCount <= 3 && estimatedLength <= this.options.maxLineLength * 0.7;
    }

    /**
     * 格式化分号
     * @param requiresSemicolon 是否需要分号
     * @returns 分号字符串（可能为空）
     */
    formatSemicolon(requiresSemicolon: boolean = true): string {
        if (!requiresSemicolon) {
            return '';
        }

        return this.options.spaceAfterSemicolon ? '; ' : ';';
    }

    /**
     * 更新格式化选项
     * @param options 新的格式化选项
     */
    updateOptions(options: LPCFormattingOptions): void {
        this.options = options;
    }

    /**
     * 更新Token流
     * @param tokenStream 新的Token流
     */
    updateTokenStream(tokenStream: CommonTokenStream): void {
        this.tokenStream = tokenStream;
    }

    /**
     * 获取Token流
     * @returns 当前的Token流
     */
    getTokenStream(): CommonTokenStream {
        return this.tokenStream;
    }

    /**
     * 检查配置是否有效
     * @returns 配置是否有效
     */
    validateOptions(): boolean {
        if (this.options.indentSize <= 0) {
            console.warn('Invalid indentSize, must be positive');
            return false;
        }

        if (this.options.maxLineLength <= 0) {
            console.warn('Invalid maxLineLength, must be positive');
            return false;
        }

        if (this.options.tabSize <= 0) {
            console.warn('Invalid tabSize, must be positive');
            return false;
        }

        return true;
    }

    /**
     * 获取格式化统计信息
     * @returns 统计信息对象
     */
    getStatistics(): {
        nodeCount: number;
        maxNodes: number;
        utilizationRate: number;
    } {
        return {
            nodeCount: this.nodeCount,
            maxNodes: this.maxNodes,
            utilizationRate: this.nodeCount / this.maxNodes
        };
    }

    /**
     * 重置所有状态
     */
    reset(): void {
        this.resetNodeCount();
    }
}