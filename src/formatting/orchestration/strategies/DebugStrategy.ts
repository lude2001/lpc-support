/**
 * 调试策略
 *
 * 专为调试场景设计的格式化策略，提供：
 * 1. 详细的格式化过程日志
 * 2. 调试友好的代码布局
 * 3. 额外的空白和注释保留
 * 4. 错误和警告的详细标记
 * 5. 性能分析信息
 */

import {
    IFormattingStrategy,
    FormattingStrategyType,
    IFormattingRequest
} from '../types';
import { IExtendedFormattingContext } from '../../types/interfaces';
import { ParseTree } from 'antlr4ts/tree/ParseTree';

/**
 * 调试策略配置接口
 */
export interface IDebugStrategyConfig {
    /** 是否启用详细日志 */
    enableVerboseLogging: boolean;
    /** 是否添加调试注释 */
    addDebugComments: boolean;
    /** 是否保留所有空白符 */
    preserveAllWhitespace: boolean;
    /** 是否显示节点类型信息 */
    showNodeTypes: boolean;
    /** 是否添加行号标记 */
    addLineNumbers: boolean;
    /** 是否启用性能分析 */
    enableProfiling: boolean;
    /** 日志级别 */
    logLevel: DebugLogLevel;
}

/**
 * 调试日志级别
 */
export enum DebugLogLevel {
    NONE = 0,
    ERROR = 1,
    WARN = 2,
    INFO = 3,
    DEBUG = 4,
    TRACE = 5
}

/**
 * 调试信息接口
 */
export interface IDebugInfo {
    /** 格式化步骤 */
    steps: DebugStep[];
    /** 性能统计 */
    performance: DebugPerformanceInfo;
    /** 节点信息 */
    nodeInfo: DebugNodeInfo[];
    /** 错误和警告 */
    issues: DebugIssue[];
}

/**
 * 调试步骤
 */
export interface DebugStep {
    /** 步骤名称 */
    name: string;
    /** 步骤描述 */
    description: string;
    /** 开始时间 */
    startTime: number;
    /** 结束时间 */
    endTime?: number;
    /** 步骤状态 */
    status: 'running' | 'completed' | 'failed';
    /** 处理的节点数量 */
    nodesProcessed?: number;
    /** 详细信息 */
    details?: Record<string, any>;
}

/**
 * 调试性能信息
 */
export interface DebugPerformanceInfo {
    /** 总耗时（毫秒） */
    totalDuration: number;
    /** 各阶段耗时 */
    phaseDurations: Record<string, number>;
    /** 内存使用峰值（如果可用） */
    peakMemoryUsage?: number;
    /** 处理的节点总数 */
    totalNodesProcessed: number;
    /** 平均每节点处理时间 */
    averageNodeProcessingTime: number;
}

/**
 * 调试节点信息
 */
export interface DebugNodeInfo {
    /** 节点类型 */
    nodeType: string;
    /** 节点位置 */
    position: {
        line: number;
        column: number;
        startOffset: number;
        endOffset: number;
    };
    /** 格式化前文本 */
    beforeText: string;
    /** 格式化后文本 */
    afterText: string;
    /** 应用的格式化规则 */
    rulesApplied: string[];
    /** 处理耗时 */
    processingTime: number;
}

/**
 * 调试问题
 */
export interface DebugIssue {
    /** 问题类型 */
    type: 'error' | 'warning' | 'info';
    /** 问题描述 */
    message: string;
    /** 问题位置 */
    location?: {
        line: number;
        column: number;
    };
    /** 相关节点类型 */
    nodeType?: string;
    /** 建议修复方案 */
    suggestedFix?: string;
}

/**
 * 调试策略实现
 */
export class DebugStrategy implements IFormattingStrategy {
    public readonly name = 'debug';
    public readonly type = FormattingStrategyType.DEBUG;
    public readonly description = 'Debug-friendly formatting with detailed logging and analysis';

    private readonly config: IDebugStrategyConfig;
    private readonly debugInfo: IDebugInfo;
    private readonly logger: DebugLogger;

    constructor(config?: Partial<IDebugStrategyConfig>) {
        this.config = {
            enableVerboseLogging: true,
            addDebugComments: true,
            preserveAllWhitespace: false,
            showNodeTypes: false,
            addLineNumbers: false,
            enableProfiling: true,
            logLevel: DebugLogLevel.DEBUG,
            ...config
        };

        this.debugInfo = {
            steps: [],
            performance: {
                totalDuration: 0,
                phaseDurations: {},
                totalNodesProcessed: 0,
                averageNodeProcessingTime: 0
            },
            nodeInfo: [],
            issues: []
        };

        this.logger = new DebugLogger(this.config.logLevel);
    }

    /**
     * 应用调试策略
     * @param context 格式化上下文
     * @param request 格式化请求
     */
    public apply(context: IExtendedFormattingContext, request: IFormattingRequest): void {
        const startTime = Date.now();
        this.logger.info('Applying debug strategy', { request: this.sanitizeRequest(request) });

        try {
            // 步骤1: 初始化调试环境
            this.initializeDebugEnvironment(context, request);

            // 步骤2: 配置调试友好的格式化选项
            this.configureDebugFormatting(context);

            // 步骤3: 添加调试监控
            this.setupDebugMonitoring(context);

            // 步骤4: 启用详细日志记录
            this.enableDetailedLogging(context);

            // 步骤5: 配置错误收集和报告
            this.configureErrorReporting(context);

            const duration = Date.now() - startTime;
            this.debugInfo.performance.totalDuration += duration;

            this.logger.info('Debug strategy applied successfully', {
                duration,
                config: this.config
            });

        } catch (error) {
            this.logger.error('Failed to apply debug strategy', { error });
            this.debugInfo.issues.push({
                type: 'error',
                message: `Debug strategy application failed: ${error}`,
                suggestedFix: 'Check debug strategy configuration'
            });
            throw error;
        }
    }

    /**
     * 检查策略是否适用
     * @param request 格式化请求
     * @returns 是否适用
     */
    public isApplicable(request: IFormattingRequest): boolean {
        // 调试策略总是适用，但通常优先级不高
        this.logger.debug('Checking debug strategy applicability', {
            textLength: request.text.length,
            hasParseTree: !!request.parseTree
        });

        return true;
    }

    /**
     * 获取策略优先级
     * @returns 优先级（调试策略通常优先级较低）
     */
    public getPriority(): number {
        return 30; // 较低优先级，除非明确指定
    }

    /**
     * 获取调试信息
     * @returns 调试信息
     */
    public getDebugInfo(): IDebugInfo {
        return { ...this.debugInfo };
    }

    /**
     * 初始化调试环境
     * @param context 格式化上下文
     * @param request 格式化请求
     */
    private initializeDebugEnvironment(
        context: IExtendedFormattingContext,
        request: IFormattingRequest
    ): void {
        const step = this.startStep('initialize-debug-environment', '初始化调试环境');

        try {
            // 设置调试标记
            context.debugMode = true;
            context.debugInfo = this.debugInfo;

            // 初始化调试计数器
            context.debugCounters = {
                nodesProcessed: 0,
                rulesApplied: 0,
                errorsFound: 0,
                warningsFound: 0
            };

            // 记录初始状态
            this.debugInfo.nodeInfo.push({
                nodeType: 'root',
                position: { line: 1, column: 1, startOffset: 0, endOffset: request.text.length },
                beforeText: request.text.substring(0, Math.min(100, request.text.length)),
                afterText: '', // 格式化后填充
                rulesApplied: ['debug-strategy'],
                processingTime: 0
            });

            this.completeStep(step);
            this.logger.debug('Debug environment initialized');
        } catch (error) {
            this.failStep(step, error);
            throw error;
        }
    }

    /**
     * 配置调试友好的格式化选项
     * @param context 格式化上下文
     */
    private configureDebugFormatting(context: IExtendedFormattingContext): void {
        const step = this.startStep('configure-debug-formatting', '配置调试格式化选项');

        try {
            const options = context.core.getOptions();

            // 调试模式下的格式化配置
            if (this.config.preserveAllWhitespace) {
                // Note: preserveWhitespace 不再是LPCFormattingOptions的一部分
                // 这里可以通过修改其他选项来实现类似效果
                options.trimTrailingWhitespace = false;
            }

            // 增加缩进以提高可读性
            if (options.indentSize < 4) {
                options.indentSize = 4;
                this.logger.info('Increased indent size for better debugging');
            }

            // 强制启用大括号换行
            options.bracesOnNewLine = true; // 大括号独占一行，便于调试

            // 操作符周围添加空格
            options.spaceAroundOperators = true;

            // 函数参数之间添加空格
            options.spaceAfterComma = true;

            // Note: preserveComments 不再是 LPCFormattingOptions 的一部分
            // 注释保留现在通过不修改 trimTrailingWhitespace 来实现
            // options.preserveComments = true;

            // 如果启用了调试注释
            if (this.config.addDebugComments) {
                context.addDebugComments = true;
            }

            // 如果启用了行号标记
            if (this.config.addLineNumbers) {
                context.addLineNumbers = true;
            }

            this.completeStep(step);
            this.logger.debug('Debug formatting configured', { options });
        } catch (error) {
            this.failStep(step, error);
            throw error;
        }
    }

    /**
     * 设置调试监控
     * @param context 格式化上下文
     */
    private setupDebugMonitoring(context: IExtendedFormattingContext): void {
        const step = this.startStep('setup-debug-monitoring', '设置调试监控');

        try {
            // 设置性能监控
            if (this.config.enableProfiling) {
                context.enableProfiling = true;
                context.profileCallback = (phase: string, duration: number) => {
                    this.debugInfo.performance.phaseDurations[phase] = duration;
                    this.logger.trace(`Phase ${phase} took ${duration}ms`);
                };
            }

            // 设置节点处理监控
            context.nodeProcessingCallback = (nodeType: string, beforeText: string, afterText: string, duration: number) => {
                this.debugInfo.nodeInfo.push({
                    nodeType,
                    position: { line: 0, column: 0, startOffset: 0, endOffset: 0 }, // 简化实现
                    beforeText: beforeText.substring(0, 50),
                    afterText: afterText.substring(0, 50),
                    rulesApplied: [], // 由具体格式化器填充
                    processingTime: duration
                });

                this.debugInfo.performance.totalNodesProcessed++;
            };

            // 设置错误监控
            context.errorCallback = (error: string, nodeType?: string) => {
                this.debugInfo.issues.push({
                    type: 'error',
                    message: error,
                    nodeType,
                    suggestedFix: '请检查语法'
                });
                this.logger.error('Formatting error detected', { error, nodeType });
            };

            // 设置警告监控
            context.warningCallback = (warning: string, nodeType?: string) => {
                this.debugInfo.issues.push({
                    type: 'warning',
                    message: warning,
                    nodeType,
                    suggestedFix: '建议修改以获得更好的格式化效果'
                });
                this.logger.warn('Formatting warning', { warning, nodeType });
            };

            this.completeStep(step);
            this.logger.debug('Debug monitoring configured');
        } catch (error) {
            this.failStep(step, error);
            throw error;
        }
    }

    /**
     * 启用详细日志记录
     * @param context 格式化上下文
     */
    private enableDetailedLogging(context: IExtendedFormattingContext): void {
        const step = this.startStep('enable-detailed-logging', '启用详细日志记录');

        try {
            if (this.config.enableVerboseLogging) {
                context.verboseLogging = true;
                context.logger = this.logger;

                this.logger.info('Detailed logging enabled for debug formatting');
            }

            this.completeStep(step);
        } catch (error) {
            this.failStep(step, error);
            throw error;
        }
    }

    /**
     * 配置错误收集和报告
     * @param context 格式化上下文
     */
    private configureErrorReporting(context: IExtendedFormattingContext): void {
        const step = this.startStep('configure-error-reporting', '配置错误收集和报告');

        try {
            // 增强错误收集器
            const originalAddError = context.errorCollector.addError;
            context.errorCollector.addError = (message: string, nodeContext?: string) => {
                // 调用原始方法
                originalAddError.call(context.errorCollector, message, nodeContext);

                // 添加到调试信息
                this.debugInfo.issues.push({
                    type: 'error',
                    message,
                    nodeType: nodeContext || 'Unknown',
                    location: { line: 0, column: 0 }, // 默认位置
                    suggestedFix: '请检查语法和格式化规则'
                });

                this.logger.error('Error collected', { message, nodeContext });
            };

            // 增强错误收集器的警告收集
            if ('addWarning' in context.errorCollector) {
                const originalAddWarning = (context.errorCollector as any).addWarning;
                (context.errorCollector as any).addWarning = (message: string, node?: ParseTree) => {
                    if (originalAddWarning) {
                        originalAddWarning.call(context.errorCollector, message, node);
                    }

                    // 添加到调试信息
                    this.debugInfo.issues.push({
                        type: 'warning',
                        message,
                        nodeType: node?.constructor.name,
                        location: this.extractNodeLocation(node),
                        suggestedFix: '建议检查代码风格'
                    });

                    this.logger.warn('Warning collected', { message, nodeType: node?.constructor.name });
                };
            }

            this.completeStep(step);
            this.logger.debug('Error reporting configured');
        } catch (error) {
            this.failStep(step, error);
            throw error;
        }
    }

    /**
     * 开始调试步骤
     * @param name 步骤名称
     * @param description 步骤描述
     * @returns 步骤对象
     */
    private startStep(name: string, description: string): DebugStep {
        const step: DebugStep = {
            name,
            description,
            startTime: Date.now(),
            status: 'running'
        };

        this.debugInfo.steps.push(step);
        this.logger.debug(`Starting step: ${name}`, { description });
        return step;
    }

    /**
     * 完成调试步骤
     * @param step 步骤对象
     */
    private completeStep(step: DebugStep): void {
        step.endTime = Date.now();
        step.status = 'completed';
        const duration = step.endTime - step.startTime;

        this.logger.debug(`Completed step: ${step.name}`, { duration });
    }

    /**
     * 标记步骤失败
     * @param step 步骤对象
     * @param error 错误信息
     */
    private failStep(step: DebugStep, error: unknown): void {
        step.endTime = Date.now();
        step.status = 'failed';
        step.details = { error: String(error) };

        this.logger.error(`Failed step: ${step.name}`, { error });
    }

    /**
     * 提取节点位置信息
     * @param node 语法树节点
     * @returns 位置信息
     */
    private extractNodeLocation(node?: ParseTree): { line: number; column: number } | undefined {
        if (!node) return undefined;

        // 简化实现，实际应该从ANTLR token中提取
        return {
            line: 1,
            column: 1
        };
    }

    /**
     * 清理请求对象以便日志记录
     * @param request 格式化请求
     * @returns 清理后的请求对象
     */
    private sanitizeRequest(request: IFormattingRequest): any {
        return {
            textLength: request.text.length,
            mode: request.mode,
            strategyType: request.strategyType,
            hasParseTree: !!request.parseTree,
            hasSelection: !!request.selection,
            options: request.options
        };
    }

    /**
     * 生成调试报告
     * @returns 调试报告
     */
    public generateDebugReport(): string {
        const report: string[] = [];

        report.push('=== LPC格式化调试报告 ===\n');

        // 性能统计
        report.push('性能统计:');
        report.push(`总耗时: ${this.debugInfo.performance.totalDuration}ms`);
        report.push(`处理节点数: ${this.debugInfo.performance.totalNodesProcessed}`);
        report.push(`平均节点处理时间: ${this.debugInfo.performance.averageNodeProcessingTime.toFixed(2)}ms`);

        // 阶段耗时
        if (Object.keys(this.debugInfo.performance.phaseDurations).length > 0) {
            report.push('\n阶段耗时:');
            for (const [phase, duration] of Object.entries(this.debugInfo.performance.phaseDurations)) {
                report.push(`  ${phase}: ${duration}ms`);
            }
        }

        // 处理步骤
        if (this.debugInfo.steps.length > 0) {
            report.push('\n处理步骤:');
            for (const step of this.debugInfo.steps) {
                const duration = step.endTime ? step.endTime - step.startTime : 0;
                const status = step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○';
                report.push(`  ${status} ${step.name} (${duration}ms)`);
            }
        }

        // 问题报告
        if (this.debugInfo.issues.length > 0) {
            report.push('\n发现的问题:');
            for (const issue of this.debugInfo.issues) {
                const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
                report.push(`  ${icon} ${issue.message}`);
                if (issue.suggestedFix) {
                    report.push(`     建议: ${issue.suggestedFix}`);
                }
            }
        }

        // 节点信息（前10个）
        if (this.debugInfo.nodeInfo.length > 0) {
            report.push('\n处理的节点 (前10个):');
            for (const nodeInfo of this.debugInfo.nodeInfo.slice(0, 10)) {
                report.push(`  ${nodeInfo.nodeType}: ${nodeInfo.processingTime}ms`);
            }
        }

        return report.join('\n');
    }

    /**
     * 重置调试信息
     */
    public reset(): void {
        this.debugInfo.steps.length = 0;
        this.debugInfo.nodeInfo.length = 0;
        this.debugInfo.issues.length = 0;
        this.debugInfo.performance = {
            totalDuration: 0,
            phaseDurations: {},
            totalNodesProcessed: 0,
            averageNodeProcessingTime: 0
        };
    }
}

/**
 * 调试日志记录器
 */
class DebugLogger {
    private readonly logLevel: DebugLogLevel;

    constructor(logLevel: DebugLogLevel) {
        this.logLevel = logLevel;
    }

    private shouldLog(level: DebugLogLevel): boolean {
        return level <= this.logLevel;
    }

    private formatMessage(level: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
        return `[${timestamp}] [DEBUG-${level}] ${message}${dataStr}`;
    }

    public error(message: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.ERROR)) {
            console.error(this.formatMessage('ERROR', message, data));
        }
    }

    public warn(message: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message, data));
        }
    }

    public info(message: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.INFO)) {
            console.info(this.formatMessage('INFO', message, data));
        }
    }

    public debug(message: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.DEBUG)) {
            console.debug(this.formatMessage('DEBUG', message, data));
        }
    }

    public trace(message: string, data?: any): void {
        if (this.shouldLog(DebugLogLevel.TRACE)) {
            console.debug(this.formatMessage('TRACE', message, data));
        }
    }
}

// 扩展格式化上下文接口以支持调试功能
declare module '../../types/interfaces' {
    interface IExtendedFormattingContext {
        /** 调试模式标记 */
        debugMode?: boolean;
        /** 调试信息 */
        debugInfo?: IDebugInfo;
        /** 调试计数器 */
        debugCounters?: {
            nodesProcessed: number;
            rulesApplied: number;
            errorsFound: number;
            warningsFound: number;
        };
        /** 启用性能分析 */
        enableProfiling?: boolean;
        /** 性能分析回调 */
        profileCallback?: (phase: string, duration: number) => void;
        /** 节点处理回调 */
        nodeProcessingCallback?: (nodeType: string, beforeText: string, afterText: string, duration: number) => void;
        /** 错误回调 */
        errorCallback?: (error: string, nodeType?: string) => void;
        /** 警告回调 */
        warningCallback?: (warning: string, nodeType?: string) => void;
        /** 详细日志记录 */
        verboseLogging?: boolean;
        /** 日志记录器 */
        logger?: DebugLogger;
        /** 添加调试注释 */
        addDebugComments?: boolean;
        /** 添加行号标记 */
        addLineNumbers?: boolean;
    }
}