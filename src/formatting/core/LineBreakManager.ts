import { ILineBreakManager } from '../types/interfaces';
import { LPCFormattingOptions } from '../types';
import { StatementType } from '../types/interfaces';

/**
 * 换行管理器实现
 * 负责决定何时换行以及行长度的管理
 */
export class LineBreakManager implements ILineBreakManager {
    private options: LPCFormattingOptions;
    private indentSize: number = 0; // 当前上下文的缩进大小

    /**
     * 构造函数
     * @param options 格式化选项配置
     */
    constructor(options: LPCFormattingOptions) {
        this.options = options;
    }

    /**
     * 设置当前缩进大小（用于行长度计算）
     * @param indentSize 缩进字符数
     */
    setCurrentIndentSize(indentSize: number): void {
        this.indentSize = Math.max(0, indentSize);
    }

    /**
     * 判断是否需要换行
     * @param elements 元素数组
     * @param separator 分隔符，默认为', '
     * @param threshold 可选的阈值，默认使用配置值
     * @returns 是否需要换行
     */
    shouldWrapLine(elements: any[], separator: string = ', ', threshold?: number): boolean {
        if (elements.length <= 1) {
            return false;
        }

        const actualThreshold = threshold || Math.floor(this.options.maxLineLength * 0.8);
        
        // 如果元素数量过多，直接换行
        if (elements.length > 5) {
            return true;
        }

        // 估算总行长度
        const estimatedLength = this.estimateLineLength(
            elements.map(e => this.elementToString(e)).join(separator)
        );

        return estimatedLength > actualThreshold;
    }

    /**
     * 估算行长度
     * @param text 文本内容
     * @param includeIndent 是否包含缩进，默认为true
     * @returns 估算的行长度
     */
    estimateLineLength(text: string, includeIndent: boolean = true): number {
        const baseLength = text.length;
        const indentLength = includeIndent ? this.indentSize : 0;

        // 对于包含操作符的复杂表达式，增加额外的长度估算
        const operatorCount = (text.match(/[+\-*/=<>!&|]/g) || []).length;
        const complexityFactor = Math.min(operatorCount * 2, 10);

        return baseLength + indentLength + complexityFactor;
    }

    /**
     * 获取语句分隔符
     * @param current 当前语句
     * @param next 下一个语句
     * @returns 分隔符字符串
     */
    getStatementSeparator(current: any, next: any): string {
        let separator = '\n';

        // 在函数定义之间添加额外空行
        if (this.isStatementType(current, 'function') || this.isStatementType(next, 'function')) {
            separator += '\n';
        }

        // 在include语句组之后添加空行
        if (this.isStatementType(current, 'include') && !this.isStatementType(next, 'include')) {
            separator += '\n';
        }

        // 在变量声明块之后添加空行
        if (this.isStatementType(current, 'variable') && 
            !this.isStatementType(next, 'variable') && 
            !this.isStatementType(next, 'include')) {
            separator += '\n';
        }

        return separator;
    }

    /**
     * 检查是否为特定类型的语句
     * @param stmt 语句上下文
     * @param type 语句类型
     * @returns 是否匹配
     */
    isStatementType(stmt: any, type: 'function' | 'include' | 'block' | 'variable'): boolean {
        if (!stmt) {
            return false;
        }

        switch (type) {
            case 'function':
                return stmt.functionDef && stmt.functionDef() !== undefined;
            case 'include':
                return stmt.includeStatement && stmt.includeStatement() !== undefined;
            case 'block':
                return stmt.block && stmt.block() !== undefined;
            case 'variable':
                return stmt.variableDecl && stmt.variableDecl() !== undefined;
            default:
                return false;
        }
    }

    /**
     * 检查是否应该在特定上下文换行
     * @param context 上下文类型
     * @param elementCount 元素数量
     * @returns 是否应该换行
     */
    shouldWrapInContext(context: string, elementCount: number): boolean {
        switch (context) {
            case 'parameters':
                return elementCount > 3 || this.estimateParameterLength(elementCount) > this.options.maxLineLength * 0.7;
            case 'arguments':
                return elementCount > 4;
            case 'array':
                return elementCount > this.options.arrayLiteralWrapThreshold;
            case 'mapping':
                return this.options.mappingLiteralFormat === 'expanded' ||
                       (this.options.mappingLiteralFormat === 'auto' && elementCount > 3);
            case 'expressions':
                return elementCount > 4;
            default:
                return elementCount > 5;
        }
    }

    /**
     * 获取换行后的缩进字符串
     * @param baseIndent 基础缩进
     * @param extraIndent 额外缩进级别
     * @returns 完整的缩进字符串
     */
    getWrappedLineIndent(baseIndent: string, extraIndent: number = 1): string {
        const extraSpaces = extraIndent * this.options.indentSize;
        if (this.options.insertSpaces) {
            return baseIndent + ' '.repeat(extraSpaces);
        } else {
            const extraTabs = Math.floor(extraSpaces / this.options.tabSize);
            const remainingSpaces = extraSpaces % this.options.tabSize;
            return baseIndent + '\t'.repeat(extraTabs) + ' '.repeat(remainingSpaces);
        }
    }

    /**
     * 计算多行内容的总长度
     * @param lines 行数组
     * @returns 最长行的长度
     */
    calculateMultilineLength(lines: string[]): number {
        return Math.max(...lines.map(line => line.length));
    }

    /**
     * 智能断行决策
     * 考虑多种因素的综合断行策略
     * @param content 内容
     * @param context 上下文
     * @param currentIndent 当前缩进
     * @returns 是否应该断行
     */
    shouldBreakLine(content: string, context?: string, currentIndent: number = 0): boolean {
        const totalLength = content.length + currentIndent;

        // 基于内容长度的判断
        if (totalLength > this.options.maxLineLength) {
            return true;
        }

        // 基于内容复杂度的判断
        if (this.isComplexContent(content)) {
            return totalLength > this.options.maxLineLength * 0.8;
        }

        // 基于上下文的判断
        if (context === 'nested' && totalLength > this.options.maxLineLength * 0.7) {
            return true;
        }

        return false;
    }

    /**
     * 获取适合的换行位置
     * @param text 文本内容
     * @param maxLength 最大长度
     * @returns 换行位置数组
     */
    findBreakPoints(text: string, maxLength: number): number[] {
        const breakPoints: number[] = [];
        let currentLength = 0;

        // 简单的按逗号和运算符断行策略
        const breakChars = [',', '+', '-', '&&', '||', '('];
        
        for (let i = 0; i < text.length; i++) {
            currentLength++;
            
            if (currentLength > maxLength) {
                // 寻找最近的断点
                for (let j = i; j >= i - 20 && j >= 0; j--) {
                    if (breakChars.some(char => text.substring(j, j + char.length) === char)) {
                        breakPoints.push(j + 1);
                        currentLength = i - j;
                        break;
                    }
                }
            }
        }

        return breakPoints;
    }

    /**
     * 更新格式化选项
     * @param options 新的格式化选项
     */
    updateOptions(options: LPCFormattingOptions): void {
        this.options = options;
    }

    /**
     * 私有辅助方法：将元素转换为字符串
     * @param element 要转换的元素
     * @returns 字符串表示
     */
    private elementToString(element: any): string {
        if (typeof element === 'string') {
            return element;
        }
        if (element && typeof element.text === 'string') {
            return element.text;
        }
        return String(element || '');
    }

    /**
     * 私有辅助方法：估算参数长度
     * @param paramCount 参数数量
     * @returns 估算的长度
     */
    private estimateParameterLength(paramCount: number): number {
        // 假设每个参数平均15个字符，包括类型、名称和分隔符
        return paramCount * 15 + 20; // 额外的括号和空格
    }

    /**
     * 私有辅助方法：检查内容是否复杂
     * @param content 内容字符串
     * @returns 是否为复杂内容
     */
    private isComplexContent(content: string): boolean {
        // 包含多个操作符、嵌套结构等被认为是复杂内容
        const operatorCount = (content.match(/[+\-*/=<>!&|]/g) || []).length;
        const nestingLevel = (content.match(/[\[\{\(]/g) || []).length;
        
        return operatorCount > 2 || nestingLevel > 1 || content.includes('([') || content.includes('({');
    }

    /**
     * 检查是否应该在操作符处断行
     * @param operator 操作符
     * @param context 上下文
     * @returns 是否应该断行
     */
    shouldBreakAtOperator(operator: string, context?: string): boolean {
        // 逻辑操作符倾向于断行
        if (['&&', '||', '?', ':'].includes(operator)) {
            return true;
        }

        // 在复杂表达式中的算术操作符
        if (context === 'complex-expression' && ['+', '-'].includes(operator)) {
            return true;
        }

        return false;
    }

    /**
     * 获取操作符断行的缩进
     * @param baseIndent 基础缩进
     * @param operator 操作符
     * @returns 操作符缩进字符串
     */
    getOperatorIndent(baseIndent: string, operator: string): string {
        // 对于某些操作符，使用对齐缩进
        if (['&&', '||'].includes(operator)) {
            return baseIndent + '    '; // 额外的4个空格对齐
        }

        return baseIndent;
    }
}