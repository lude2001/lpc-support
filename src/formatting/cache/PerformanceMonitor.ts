import { performance } from 'perf_hooks';

/**
 * 性能监控数据
 */
export interface PerformanceMetrics {
    formatTime: number;        // 格式化耗时
    parseTime: number;         // 解析耗时
    documentSize: number;      // 文档大小
    ruleCount: number;         // 应用的规则数量
    timestamp: number;         // 时间戳
    success: boolean;          // 是否成功
    errorCount: number;        // 错误数量
    warningCount: number;      // 警告数量
}

/**
 * 性能统计信息
 */
export interface PerformanceStats {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalFormatTime: number;
    totalParseTime: number;
    averageFormatTime: number;
    averageParseTime: number;
    minFormatTime: number;
    maxFormatTime: number;
    totalDocumentSize: number;
    averageDocumentSize: number;
    recentMetrics: PerformanceMetrics[];
}

/**
 * LPC 格式化性能监控器
 */
export class PerformanceMonitor {
    private metrics: PerformanceMetrics[] = [];
    private maxMetricsCount: number;
    private startTime: number = 0;
    private parseStartTime: number = 0;

    constructor(maxMetricsCount: number = 1000) {
        this.maxMetricsCount = maxMetricsCount;
    }

    /**
     * 开始计时
     */
    startTiming(): void {
        this.startTime = performance.now();
    }

    /**
     * 开始解析计时
     */
    startParseTiming(): void {
        this.parseStartTime = performance.now();
    }

    /**
     * 结束解析计时
     */
    endParseTiming(): number {
        return performance.now() - this.parseStartTime;
    }

    /**
     * 记录性能数据
     */
    recordMetrics(data: {
        documentSize: number;
        ruleCount: number;
        success: boolean;
        errorCount?: number;
        warningCount?: number;
        parseTime?: number;
    }): void {
        const formatTime = performance.now() - this.startTime;
        
        const metrics: PerformanceMetrics = {
            formatTime,
            parseTime: data.parseTime || 0,
            documentSize: data.documentSize,
            ruleCount: data.ruleCount,
            timestamp: Date.now(),
            success: data.success,
            errorCount: data.errorCount || 0,
            warningCount: data.warningCount || 0
        };
        
        this.metrics.push(metrics);
        
        // 保持指定数量的最近记录
        if (this.metrics.length > this.maxMetricsCount) {
            this.metrics.shift();
        }
    }

    /**
     * 获取性能统计
     */
    getStats(): PerformanceStats {
        if (this.metrics.length === 0) {
            return {
                totalOperations: 0,
                successfulOperations: 0,
                failedOperations: 0,
                totalFormatTime: 0,
                totalParseTime: 0,
                averageFormatTime: 0,
                averageParseTime: 0,
                minFormatTime: 0,
                maxFormatTime: 0,
                totalDocumentSize: 0,
                averageDocumentSize: 0,
                recentMetrics: []
            };
        }
        
        const totalOperations = this.metrics.length;
        const successfulOperations = this.metrics.filter(m => m.success).length;
        const failedOperations = totalOperations - successfulOperations;
        
        const totalFormatTime = this.metrics.reduce((sum, m) => sum + m.formatTime, 0);
        const totalParseTime = this.metrics.reduce((sum, m) => sum + m.parseTime, 0);
        const totalDocumentSize = this.metrics.reduce((sum, m) => sum + m.documentSize, 0);
        
        const formatTimes = this.metrics.map(m => m.formatTime);
        const minFormatTime = Math.min(...formatTimes);
        const maxFormatTime = Math.max(...formatTimes);
        
        return {
            totalOperations,
            successfulOperations,
            failedOperations,
            totalFormatTime,
            totalParseTime,
            averageFormatTime: totalFormatTime / totalOperations,
            averageParseTime: totalParseTime / totalOperations,
            minFormatTime,
            maxFormatTime,
            totalDocumentSize,
            averageDocumentSize: totalDocumentSize / totalOperations,
            recentMetrics: this.metrics.slice(-10) // 最近10次操作
        };
    }

    /**
     * 获取最近的性能数据
     */
    getRecentMetrics(count: number = 10): PerformanceMetrics[] {
        return this.metrics.slice(-count);
    }

    /**
     * 检查是否存在性能问题
     */
    checkPerformanceIssues(): {
        slowOperations: PerformanceMetrics[];
        frequentErrors: boolean;
        averageSlowdown: number;
    } {
        const stats = this.getStats();
        const threshold = stats.averageFormatTime * 2; // 超过平均时间2倍为慢
        
        const slowOperations = this.metrics.filter(m => m.formatTime > threshold);
        const errorRate = stats.failedOperations / stats.totalOperations;
        const frequentErrors = errorRate > 0.1; // 错误率超过10%
        
        const recentAverage = this.getRecentMetrics(50)
            .reduce((sum, m) => sum + m.formatTime, 0) / Math.min(50, this.metrics.length);
        const overallAverage = stats.averageFormatTime;
        const averageSlowdown = recentAverage / overallAverage;
        
        return {
            slowOperations,
            frequentErrors,
            averageSlowdown
        };
    }

    /**
     * 获取性能趋势
     */
    getPerformanceTrend(windowSize: number = 100): {
        trend: 'improving' | 'stable' | 'degrading';
        confidence: number;
        recentAverage: number;
        previousAverage: number;
    } {
        if (this.metrics.length < windowSize * 2) {
            return {
                trend: 'stable',
                confidence: 0,
                recentAverage: 0,
                previousAverage: 0
            };
        }
        
        const recentMetrics = this.metrics.slice(-windowSize);
        const previousMetrics = this.metrics.slice(-windowSize * 2, -windowSize);
        
        const recentAverage = recentMetrics.reduce((sum, m) => sum + m.formatTime, 0) / windowSize;
        const previousAverage = previousMetrics.reduce((sum, m) => sum + m.formatTime, 0) / windowSize;
        
        const change = (recentAverage - previousAverage) / previousAverage;
        const confidence = Math.min(1, this.metrics.length / (windowSize * 2));
        
        let trend: 'improving' | 'stable' | 'degrading';
        if (Math.abs(change) < 0.05) { // 变化小于5%认为稳定
            trend = 'stable';
        } else if (change < 0) {
            trend = 'improving'; // 时间减少是改进
        } else {
            trend = 'degrading'; // 时间增加是退化
        }
        
        return {
            trend,
            confidence,
            recentAverage,
            previousAverage
        };
    }

    /**
     * 生成性能报告
     */
    generateReport(): string {
        const stats = this.getStats();
        const issues = this.checkPerformanceIssues();
        const trend = this.getPerformanceTrend();
        
        const report = [
            'LPC 格式化性能报告',
            '========================',
            '',
            '基本统计:',
            `  总操作数: ${stats.totalOperations}`,
            `  成功率: ${(stats.successfulOperations / stats.totalOperations * 100).toFixed(1)}%`,
            `  平均格式化时间: ${stats.averageFormatTime.toFixed(2)}ms`,
            `  平均解析时间: ${stats.averageParseTime.toFixed(2)}ms`,
            `  最小/最大时间: ${stats.minFormatTime.toFixed(2)}ms / ${stats.maxFormatTime.toFixed(2)}ms`,
            `  平均文档大小: ${(stats.averageDocumentSize / 1024).toFixed(1)}KB`,
            '',
            '性能问题:',
            `  慢操作数量: ${issues.slowOperations.length}`,
            `  频繁错误: ${issues.frequentErrors ? '是' : '否'}`,
            `  近期性能变化: ${(issues.averageSlowdown * 100).toFixed(1)}%`,
            '',
            '性能趋势:',
            `  趋势: ${trend.trend === 'improving' ? '改进' : trend.trend === 'stable' ? '稳定' : '退化'}`,
            `  置信度: ${(trend.confidence * 100).toFixed(1)}%`,
            `  近期平均: ${trend.recentAverage.toFixed(2)}ms`,
            `  之前平均: ${trend.previousAverage.toFixed(2)}ms`,
            ''
        ];
        
        return report.join('\n');
    }

    /**
     * 清空所有指标
     */
    clear(): void {
        this.metrics = [];
    }

    /**
     * 设置最大指标数量
     */
    setMaxMetricsCount(count: number): void {
        this.maxMetricsCount = count;
        
        // 如果当前数量超过新限制，删除旧记录
        if (this.metrics.length > count) {
            this.metrics = this.metrics.slice(-count);
        }
    }

    /**
     * 导出指标数据
     */
    exportMetrics(): PerformanceMetrics[] {
        return [...this.metrics];
    }

    /**
     * 导入指标数据
     */
    importMetrics(metrics: PerformanceMetrics[]): void {
        this.metrics = [...metrics];
        
        // 保持数量限制
        if (this.metrics.length > this.maxMetricsCount) {
            this.metrics = this.metrics.slice(-this.maxMetricsCount);
        }
    }
}