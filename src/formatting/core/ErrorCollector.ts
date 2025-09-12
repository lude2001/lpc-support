import { IErrorCollector } from '../types/interfaces';

/**
 * 错误收集器实现
 * 负责收集、管理和报告格式化过程中的错误信息
 */
export class ErrorCollector implements IErrorCollector {
    private errors: string[] = [];
    private maxErrors: number;

    /**
     * 构造函数
     * @param maxErrors 最大错误数量，超过后停止收集，默认为50
     */
    constructor(maxErrors: number = 50) {
        this.maxErrors = maxErrors;
    }

    /**
     * 添加错误信息
     * @param message 错误消息
     * @param context 可选的上下文信息
     */
    addError(message: string, context?: string): void {
        if (this.errors.length >= this.maxErrors) {
            return; // 达到最大错误数量，停止收集
        }

        const errorMsg = context ? `${message} (context: ${context})` : message;
        this.errors.push(errorMsg);
        
        // 输出警告到控制台，便于调试
        console.warn('Formatting error:', errorMsg);
    }

    /**
     * 获取所有收集的错误
     * @returns 错误消息数组
     */
    getErrors(): string[] {
        return [...this.errors]; // 返回副本，防止外部修改
    }

    /**
     * 清空所有错误
     */
    clearErrors(): void {
        this.errors = [];
    }

    /**
     * 获取错误数量
     * @returns 错误总数
     */
    getErrorCount(): number {
        return this.errors.length;
    }

    /**
     * 检查是否有错误
     * @returns 是否存在错误
     */
    hasErrors(): boolean {
        return this.errors.length > 0;
    }

    /**
     * 获取最近的错误
     * @param count 获取的错误数量，默认为1
     * @returns 最近的错误消息数组
     */
    getRecentErrors(count: number = 1): string[] {
        const start = Math.max(0, this.errors.length - count);
        return this.errors.slice(start);
    }

    /**
     * 添加格式化的错误消息
     * 包含更详细的错误信息格式
     * @param operation 执行的操作
     * @param error 错误对象或错误消息
     * @param context 上下文信息
     */
    addFormattingError(operation: string, error: Error | string, context?: string): void {
        const errorMessage = error instanceof Error ? error.message : error;
        const fullMessage = `${operation}时出错: ${errorMessage}`;
        this.addError(fullMessage, context);
    }

    /**
     * 获取格式化的错误报告
     * @returns 格式化的错误报告字符串
     */
    getErrorReport(): string {
        if (this.errors.length === 0) {
            return 'No errors found.';
        }

        const report = [
            `格式化错误报告 (总共 ${this.errors.length} 个错误):`,
            '=' .repeat(50),
            ...this.errors.map((error, index) => `${index + 1}. ${error}`),
        ];

        if (this.errors.length >= this.maxErrors) {
            report.push('', `注意: 错误数量已达到上限 (${this.maxErrors})，可能还有更多错误未显示。`);
        }

        return report.join('\n');
    }

    /**
     * 设置最大错误数量
     * @param maxErrors 新的最大错误数量
     */
    setMaxErrors(maxErrors: number): void {
        this.maxErrors = Math.max(1, maxErrors); // 至少允许1个错误
    }

    /**
     * 获取最大错误数量
     * @returns 当前的最大错误数量
     */
    getMaxErrors(): number {
        return this.maxErrors;
    }

    /**
     * 检查是否已达到错误数量上限
     * @returns 是否已达到上限
     */
    isAtErrorLimit(): boolean {
        return this.errors.length >= this.maxErrors;
    }
}