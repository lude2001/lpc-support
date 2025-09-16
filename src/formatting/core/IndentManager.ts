import { IIndentManager } from '../types/interfaces';
import { LPCFormattingOptions } from '../types';
import { IndentContext } from '../types/interfaces';

/**
 * 缩进管理器实现
 * 负责管理代码缩进级别和生成对应的缩进字符串
 */
export class IndentManager implements IIndentManager {
    private indentLevel: number = 0;
    private options: LPCFormattingOptions;

    /**
     * 构造函数
     * @param options 格式化选项配置
     */
    constructor(options: LPCFormattingOptions) {
        this.options = options;
    }

    /**
     * 获取当前缩进级别
     */
    getIndentLevel(): number {
        return this.indentLevel;
    }

    /**
     * 增加缩进级别
     * @param delta 增加的级别数，默认为1
     */
    increaseIndent(delta: number = 1): void {
        this.indentLevel += Math.max(0, delta);
    }

    /**
     * 减少缩进级别
     * @param delta 减少的级别数，默认为1
     */
    decreaseIndent(delta: number = 1): void {
        this.indentLevel = Math.max(0, this.indentLevel - delta);
    }

    /**
     * 设置缩进级别
     * @param level 目标缩进级别
     */
    setIndentLevel(level: number): void {
        this.indentLevel = Math.max(0, level);
    }

    /**
     * 获取当前缩进级别对应的缩进字符串
     * @param level 可选的特定缩进级别，默认使用当前级别
     * @returns 缩进字符串（空格或制表符）
     */
    getIndent(level?: number): string {
        const targetLevel = level !== undefined ? level : this.indentLevel;
        const indentSize = Math.max(0, targetLevel * this.options.indentSize);

        if (this.options.insertSpaces) {
            // 使用空格缩进
            return ' '.repeat(indentSize);
        } else {
            // 使用制表符缩进
            const tabs = Math.floor(indentSize / this.options.tabSize);
            const spaces = indentSize % this.options.tabSize;
            return '\t'.repeat(tabs) + ' '.repeat(spaces);
        }
    }

    /**
     * 计算指定上下文的缩进级别
     * @param context 上下文类型
     * @returns 计算后的缩进级别
     */
    calculateIndentLevel(context?: string): number {
        let level = this.indentLevel;

        // 根据上下文调整缩进级别
        switch (context) {
            case 'case':
                // switch语句中的case标签
                if (this.options.switchCaseAlignment === 'indent') {
                    level += 1;
                }
                break;
            case 'nested':
                // 嵌套结构（如映射中的数组）
                level += Math.floor(this.options.nestedStructureIndent / this.options.indentSize);
                break;
            case 'parameter':
                // 参数列表缩进
                level += 1;
                break;
            case 'expression':
                // 表达式缩进
                level += 1;
                break;
            default:
                // 保持当前级别
                break;
        }

        return Math.max(0, level);
    }

    /**
     * 获取特定上下文的缩进字符串
     * @param context 上下文类型
     * @returns 对应的缩进字符串
     */
    getContextIndent(context: IndentContext): string {
        const level = this.calculateIndentLevel(context);
        return this.getIndent(level);
    }

    /**
     * 临时增加缩进并执行操作
     * @param delta 临时增加的缩进级别
     * @param operation 要执行的操作
     * @returns 操作的返回值
     */
    withIndent<T>(delta: number, operation: () => T): T {
        this.increaseIndent(delta);
        try {
            return operation();
        } finally {
            this.decreaseIndent(delta);
        }
    }

    /**
     * 获取相对缩进字符串
     * 相对于当前缩进级别增加指定级别
     * @param relativeDelta 相对增加的缩进级别
     * @returns 相对缩进字符串
     */
    getRelativeIndent(relativeDelta: number): string {
        const targetLevel = this.indentLevel + relativeDelta;
        return this.getIndent(Math.max(0, targetLevel));
    }

    /**
     * 更新格式化选项
     * @param options 新的格式化选项
     */
    updateOptions(options: LPCFormattingOptions): void {
        this.options = options;
    }

    /**
     * 重置缩进级别为0
     */
    reset(): void {
        this.indentLevel = 0;
    }

    /**
     * 获取当前缩进字符串
     * @returns 当前缩进字符串
     */
    getCurrentIndent(): string {
        return this.getIndent();
    }

    /**
     * 获取当前配置的缩进字符
     * @returns 单个缩进级别对应的字符串
     */
    getIndentUnit(): string {
        if (this.options.insertSpaces) {
            return ' '.repeat(this.options.indentSize);
        } else {
            return '\t';
        }
    }

    /**
     * 计算字符串的缩进级别
     * 分析字符串开头的空白字符，计算对应的缩进级别
     * @param line 要分析的行
     * @returns 缩进级别
     */
    calculateLineIndentLevel(line: string): number {
        let indentSize = 0;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === ' ') {
                indentSize++;
            } else if (char === '\t') {
                indentSize += this.options.tabSize;
            } else {
                break; // 遇到非空白字符，停止计算
            }
        }
        return Math.floor(indentSize / this.options.indentSize);
    }

    /**
     * 标准化行的缩进
     * 将行开头的空白字符标准化为配置的缩进方式
     * @param line 要标准化的行
     * @param targetLevel 目标缩进级别，如果不指定则保持当前级别
     * @returns 标准化后的行
     */
    normalizeLineIndent(line: string, targetLevel?: number): string {
        const trimmed = line.trimStart();
        if (trimmed === '') {
            return ''; // 空行直接返回
        }

        const level = targetLevel !== undefined ? targetLevel : this.calculateLineIndentLevel(line);
        return this.getIndent(level) + trimmed;
    }
}