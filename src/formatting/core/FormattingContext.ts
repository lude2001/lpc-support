import { CommonTokenStream } from 'antlr4ts';
import { LPCFormattingOptions } from '../types';
import { IFormattingContext } from '../types/interfaces';
import { ErrorCollector } from './ErrorCollector';
import { IndentManager } from './IndentManager';
import { TokenUtils } from './TokenUtils';
import { LineBreakManager } from './LineBreakManager';
import { FormattingCore } from './FormattingCore';

/**
 * 格式化上下文实现
 * 集成所有核心格式化服务，提供统一的访问接口
 */
export class FormattingContext implements IFormattingContext {
    public readonly errorCollector: ErrorCollector;
    public readonly indentManager: IndentManager;
    public readonly tokenUtils: TokenUtils;
    public readonly lineBreakManager: LineBreakManager;
    public readonly core: FormattingCore;

    /**
     * 构造函数
     * @param tokenStream Token流
     * @param options 格式化选项配置
     */
    constructor(tokenStream: CommonTokenStream, options: LPCFormattingOptions) {
        // 初始化各个核心组件
        this.errorCollector = new ErrorCollector();
        this.indentManager = new IndentManager(options);
        this.tokenUtils = new TokenUtils(tokenStream);
        this.lineBreakManager = new LineBreakManager(options);
        this.core = new FormattingCore(tokenStream, options);

        // 建立组件之间的关联
        this.setupComponentConnections();
    }

    /**
     * 建立组件之间的连接和数据共享
     */
    private setupComponentConnections(): void {
        // 让LineBreakManager知道当前的缩进大小，用于行长度计算
        const updateIndentSize = () => {
            const currentIndent = this.indentManager.getIndent();
            this.lineBreakManager.setCurrentIndentSize(currentIndent.length);
        };

        // 在缩进变化时更新LineBreakManager
        const originalIncreaseIndent = this.indentManager.increaseIndent.bind(this.indentManager);
        const originalDecreaseIndent = this.indentManager.decreaseIndent.bind(this.indentManager);
        const originalSetIndentLevel = this.indentManager.setIndentLevel.bind(this.indentManager);

        this.indentManager.increaseIndent = (delta?: number) => {
            originalIncreaseIndent(delta);
            updateIndentSize();
        };

        this.indentManager.decreaseIndent = (delta?: number) => {
            originalDecreaseIndent(delta);
            updateIndentSize();
        };

        this.indentManager.setIndentLevel = (level: number) => {
            originalSetIndentLevel(level);
            updateIndentSize();
        };

        // 初始更新
        updateIndentSize();
    }

    /**
     * 更新所有组件的配置
     * @param options 新的格式化选项
     */
    updateOptions(options: LPCFormattingOptions): void {
        this.indentManager.updateOptions(options);
        this.lineBreakManager.updateOptions(options);
        this.core.updateOptions(options);
    }

    /**
     * 更新Token流
     * @param tokenStream 新的Token流
     */
    updateTokenStream(tokenStream: CommonTokenStream): void {
        this.tokenUtils.updateTokenStream(tokenStream);
        this.core.updateTokenStream(tokenStream);
    }

    /**
     * 重置所有组件状态
     */
    resetAll(): void {
        this.errorCollector.clearErrors();
        this.indentManager.reset();
        this.core.reset();
    }

    /**
     * 获取完整的格式化报告
     * @returns 格式化报告对象
     */
    getFormattingReport(): {
        errors: string[];
        statistics: {
            nodeCount: number;
            maxNodes: number;
            utilizationRate: number;
            indentLevel: number;
            errorCount: number;
        };
        hasErrors: boolean;
        isValid: boolean;
    } {
        const stats = this.core.getStatistics();
        
        return {
            errors: this.errorCollector.getErrors(),
            statistics: {
                ...stats,
                indentLevel: this.indentManager.getIndentLevel(),
                errorCount: this.errorCollector.getErrorCount()
            },
            hasErrors: this.errorCollector.hasErrors(),
            isValid: this.core.validateOptions() && !this.errorCollector.hasErrors()
        };
    }

    /**
     * 执行带错误捕获的格式化操作
     * @param operation 格式化操作
     * @param errorMessage 错误消息
     * @param fallback 回退值
     * @returns 操作结果
     */
    safeExecute<T>(
        operation: () => T,
        errorMessage: string,
        fallback?: T
    ): T | undefined {
        try {
            if (!this.core.checkNodeLimit()) {
                this.errorCollector.addError('节点访问超出限制', errorMessage);
                return fallback;
            }

            return operation();
        } catch (error) {
            this.errorCollector.addFormattingError(
                errorMessage,
                error instanceof Error ? error : String(error)
            );
            return fallback;
        }
    }

    /**
     * 执行带缩进管理的操作
     * @param indentDelta 缩进变化量
     * @param operation 要执行的操作
     * @returns 操作结果
     */
    withIndent<T>(indentDelta: number, operation: () => T): T {
        return this.indentManager.withIndent(indentDelta, operation);
    }

    /**
     * 检查当前状态是否健康
     * @returns 状态检查结果
     */
    isHealthy(): {
        healthy: boolean;
        issues: string[];
    } {
        const issues: string[] = [];

        // 检查错误数量
        if (this.errorCollector.getErrorCount() > 10) {
            issues.push('错误数量过多');
        }

        // 检查节点访问是否接近限制
        if (this.core.getStatistics().utilizationRate > 0.8) {
            issues.push('节点访问接近限制');
        }

        // 检查缩进级别是否合理
        if (this.indentManager.getIndentLevel() > 20) {
            issues.push('缩进级别过深');
        }

        // 检查配置有效性
        if (!this.core.validateOptions()) {
            issues.push('格式化配置无效');
        }

        return {
            healthy: issues.length === 0,
            issues
        };
    }

    /**
     * 获取性能指标
     * @returns 性能指标对象
     */
    getPerformanceMetrics(): {
        nodeProcessingRate: number;
        errorRate: number;
        memoryUsage: {
            errorCount: number;
            maxErrors: number;
            nodeCount: number;
            maxNodes: number;
        };
    } {
        const stats = this.core.getStatistics();
        
        return {
            nodeProcessingRate: stats.utilizationRate,
            errorRate: this.errorCollector.getErrorCount() / Math.max(stats.nodeCount, 1),
            memoryUsage: {
                errorCount: this.errorCollector.getErrorCount(),
                maxErrors: this.errorCollector.getMaxErrors(),
                nodeCount: stats.nodeCount,
                maxNodes: stats.maxNodes
            }
        };
    }

    /**
     * 创建子上下文
     * 用于嵌套格式化场景，继承当前状态但独立管理某些组件
     * @returns 新的格式化上下文
     */
    createChildContext(): FormattingContext {
        const childContext = new FormattingContext(
            this.tokenUtils.getTokenStream(),
            this.core.getOptions()
        );

        // 同步缩进级别
        childContext.indentManager.setIndentLevel(this.indentManager.getIndentLevel());

        return childContext;
    }

    /**
     * 合并子上下文的结果
     * @param childContext 子上下文
     */
    mergeChildContext(childContext: FormattingContext): void {
        // 合并错误信息
        childContext.errorCollector.getErrors().forEach(error => {
            this.errorCollector.addError(`子上下文错误: ${error}`);
        });

        // 更新节点计数（这里需要小心处理以避免重复计数）
        // 在实际使用中，可能需要更精细的合并策略
    }

    /**
     * 获取调试信息
     * @returns 调试信息字符串
     */
    getDebugInfo(): string {
        const report = this.getFormattingReport();
        const health = this.isHealthy();
        const metrics = this.getPerformanceMetrics();

        return [
            '=== 格式化上下文调试信息 ===',
            `健康状态: ${health.healthy ? '良好' : '有问题'}`,
            health.issues.length > 0 ? `问题: ${health.issues.join(', ')}` : '',
            `错误数量: ${report.statistics.errorCount}`,
            `节点数量: ${report.statistics.nodeCount}/${report.statistics.maxNodes}`,
            `缩进级别: ${report.statistics.indentLevel}`,
            `节点处理率: ${(metrics.nodeProcessingRate * 100).toFixed(1)}%`,
            `错误率: ${(metrics.errorRate * 100).toFixed(1)}%`,
            report.errors.length > 0 ? '\n错误详情:\n' + report.errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n') : ''
        ].filter(line => line !== '').join('\n');
    }
}