import { CommonTokenStream, Token } from 'antlr4ts';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { LPCFormattingOptions } from './types';

/**
 * 格式化工具类
 * 包含所有通用的格式化辅助方法和工具函数
 */
export class FormattingUtils {
    public options: LPCFormattingOptions;
    private tokenStream: CommonTokenStream;
    private indentLevel: number = 0;
    
    constructor(options: LPCFormattingOptions, tokenStream: CommonTokenStream) {
        this.options = options;
        this.tokenStream = tokenStream;
    }

    /**
     * 获取当前缩进字符串
     * 根据配置使用空格或制表符
     */
    getIndent(level?: number): string {
        const currentLevel = level !== undefined ? level : this.indentLevel;
        const indentSize = currentLevel * this.options.indentSize;
        
        if (this.options.insertSpaces) {
            return ' '.repeat(indentSize);
        } else {
            const tabs = Math.floor(indentSize / this.options.tabSize);
            const spaces = indentSize % this.options.tabSize;
            return '\t'.repeat(tabs) + ' '.repeat(spaces);
        }
    }

    /**
     * 创建指定级别的缩进
     */
    createIndent(level: number): string {
        const indentSize = level * this.options.indentSize;
        
        if (this.options.insertSpaces) {
            return ' '.repeat(indentSize);
        } else {
            const tabs = Math.floor(indentSize / this.options.tabSize);
            const spaces = indentSize % this.options.tabSize;
            return '\t'.repeat(tabs) + ' '.repeat(spaces);
        }
    }

    /**
     * 格式化运算符
     * 统一处理各种运算符的空格格式
     */
    formatOperator(operator: string, isAssignment: boolean = false): string {
        if (isAssignment && this.options.spaceAroundAssignmentOperators) {
            return ` ${operator} `;
        } else if (!isAssignment && this.options.spaceAroundBinaryOperators) {
            return ` ${operator} `;
        }
        return operator;
    }

    /**
     * 格式化分隔符列表的通用方法
     * 用于参数列表、表达式列表等
     */
    formatDelimitedList<T>(
        elements: T[], 
        formatter: (element: T) => string,
        separator: string = ',',
        options?: {
            forceWrap?: boolean;
            maxInlineElements?: number;
            addSpaceAfterSeparator?: boolean;
            wrapThreshold?: number;
        }
    ): string {
        if (elements.length === 0) return '';
        
        const opts = {
            forceWrap: false,
            maxInlineElements: 4,
            addSpaceAfterSeparator: this.options.spaceAfterComma,
            wrapThreshold: Math.floor(this.options.maxLineLength * 0.8),
            ...options
        };
        
        const shouldWrap = this.shouldWrapLine(elements.map(formatter), separator, opts.wrapThreshold) ||
                          opts.forceWrap ||
                          elements.length > opts.maxInlineElements;
        
        if (shouldWrap) {
            // 多行格式
            let result = '\n';
            this.indentLevel++;
            
            for (let i = 0; i < elements.length; i++) {
                result += this.getIndent() + formatter(elements[i]);
                if (i < elements.length - 1) {
                    result += separator;
                }
                result += '\n';
            }
            
            this.indentLevel--;
            result += this.getIndent();
            return result;
        } else {
            // 单行格式
            return elements.map(formatter).join(
                separator + (opts.addSpaceAfterSeparator ? ' ' : '')
            );
        }
    }

    /**
     * 智能换行决策
     * 基于多个因素决定是否需要换行
     */
    shouldWrapLine(elements: string[], separator: string = ', ', threshold?: number): boolean {
        if (elements.length <= 1) return false;
        
        const actualThreshold = threshold || Math.floor(this.options.maxLineLength * 0.8);
        const estimatedLength = this.estimateLineLength(
            elements.join(separator)
        );
        
        return estimatedLength > actualThreshold || elements.length > 5;
    }

    /**
     * 增强的行长度估算
     * 考虑缩进和内容复杂度
     */
    estimateLineLength(text: string, includeIndent: boolean = true): number {
        const baseLength = text.length;
        const indentLength = includeIndent ? this.indentLevel * this.options.indentSize : 0;
        
        // 对于包含操作符的复杂表达式，增加额外的长度估算
        const operatorCount = (text.match(/[+\-*/=<>!&|]/g) || []).length;
        const complexityFactor = Math.min(operatorCount * 2, 10);
        
        return baseLength + indentLength + complexityFactor;
    }

    /**
     * 计算指定上下文的缩进级别
     */
    calculateIndentLevel(context?: string): number {
        let level = this.indentLevel;
        
        // 根据上下文调整缩进级别
        if (context === 'case') {
            if (this.options.switchCaseAlignment === 'indent') {
                level += 1;
            }
        }
        
        return level;
    }

    /**
     * 获取两个上下文之间的令牌
     */
    getTokenBetween(left: any, right: any): Token | undefined {
        if (!left || !right || !left.stop || !right.start) {
            return undefined;
        }
        
        const leftIndex = left.stop.tokenIndex;
        const rightIndex = right.start.tokenIndex;
        
        if (rightIndex > leftIndex + 1) {
            return this.tokenStream.get(leftIndex + 1);
        }
        
        return undefined;
    }

    /**
     * 格式化修饰符列表
     */
    formatModifiers(modifiers: string[]): string {
        if (modifiers.length === 0) return '';
        
        // 根据配置的顺序排序修饰符
        const ordered = modifiers.sort((a, b) => {
            const orderA = this.options.functionModifierOrder.indexOf(a);
            const orderB = this.options.functionModifierOrder.indexOf(b);
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
        });
        
        return ordered.join(' ');
    }

    /**
     * 检查多行表达式的处理
     */
    processMultilineExpression(exprResult: string, additionalIndent: number = 0): string {
        if (!exprResult.includes('\n')) {
            return exprResult;
        }

        const lines = exprResult.split('\n');
        let result = lines[0]; // 第一行不需要额外缩进

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() !== '') {
                const extraIndent = ' '.repeat(additionalIndent || this.options.nestedStructureIndent);
                result += '\n' + this.getIndent() + extraIndent + lines[i].trimStart();
            } else {
                result += '\n' + lines[i];
            }
        }

        return result;
    }

    /**
     * 获取当前缩进级别
     */
    get currentIndentLevel(): number {
        return this.indentLevel;
    }

    /**
     * 设置缩进级别
     */
    set currentIndentLevel(level: number) {
        this.indentLevel = level;
    }

    /**
     * 增加缩进级别
     */
    increaseIndent(): void {
        this.indentLevel++;
    }

    /**
     * 减少缩进级别
     */
    decreaseIndent(): void {
        if (this.indentLevel > 0) {
            this.indentLevel--;
        }
    }

    /**
     * 处理终端节点
     */
    visitTerminal(node: TerminalNode): string {
        return node.text;
    }
}

/**
 * 格式化基础接口
 * 定义所有格式化访问者需要实现的基础功能
 */
export interface BaseFormattingVisitor {
    /** 格式化工具实例 */
    utils: FormattingUtils;
    /** 错误收集 */
    errors: string[];
    /** 节点计数 */
    nodeCount: number;
    /** 最大节点限制 */
    maxNodes: number;

    /** 添加错误信息 */
    addError(message: string, context?: string): void;
    /** 检查节点限制 */
    checkNodeLimit(): boolean;
}

/**
 * 抽象基础格式化访问者
 * 为所有专门的格式化访问者提供公共功能
 */
export abstract class AbstractFormattingVisitor implements BaseFormattingVisitor {
    utils: FormattingUtils;
    errors: string[] = [];
    nodeCount: number = 0;
    maxNodes: number = 10000;

    constructor(utils: FormattingUtils) {
        this.utils = utils;
    }

    addError(message: string, context?: string): void {
        const errorMsg = context ? `${message} (context: ${context})` : message;
        this.errors.push(errorMsg);
        console.warn('Formatting error:', errorMsg);
    }

    checkNodeLimit(): boolean {
        this.nodeCount++;
        if (this.nodeCount > this.maxNodes) {
            this.addError(`访问节点数量超过限制 (${this.maxNodes})，可能存在无限递归`);
            return false;
        }
        return true;
    }

    /**
     * 获取所有错误信息
     */
    getErrors(): string[] {
        return this.errors;
    }

    /**
     * 清除错误信息
     */
    clearErrors(): void {
        this.errors = [];
    }
}