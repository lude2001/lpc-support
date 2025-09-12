/**
 * 性能监控器实现
 * 
 * 提供格式化过程的性能监控和统计：
 * - 操作计时
 * - 缓存统计
 * - 资源使用监控
 * - 性能分析和报告
 */

import { IPerformanceMonitor, FormattingStats } from './types';

interface TimingEntry {
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    hitsByType: Map<string, number>;
    missesByType: Map<string, number>;
}

interface OperationStats {
    count: number;
    totalDuration: number;
    minDuration: number;
    maxDuration: number;
    avgDuration: number;
}

export class PerformanceMonitor implements IPerformanceMonitor {
    private timings = new Map<string, TimingEntry>();
    private completedTimings: TimingEntry[] = [];
    private operationStats = new Map<string, OperationStats>();
    private cacheStats: CacheStats = {
        hits: 0,
        misses: 0,
        hitsByType: new Map(),
        missesByType: new Map()
    };
    private startTime = Date.now();
    private memoryBaseline = 0;

    constructor() {
        this.memoryBaseline = this.getCurrentMemoryUsage();
    }

    /**
     * 开始性能监控
     */
    public startTiming(operation: string): string {
        const timingId = this.generateTimingId(operation);
        const timing: TimingEntry = {
            operation,
            startTime: Date.now()
        };
        
        this.timings.set(timingId, timing);
        return timingId;
    }

    /**
     * 结束性能监控
     */
    public endTiming(timingId: string): number {
        const timing = this.timings.get(timingId);
        if (!timing) {
            console.warn(`Timing not found: ${timingId}`);
            return 0;
        }

        timing.endTime = Date.now();
        timing.duration = timing.endTime - timing.startTime;

        // 移动到已完成列表
        this.timings.delete(timingId);
        this.completedTimings.push(timing);

        // 更新操作统计
        this.updateOperationStats(timing);

        return timing.duration;
    }

    /**
     * 记录缓存命中
     */
    public recordCacheHit(cacheType: string): void {
        this.cacheStats.hits++;
        const typeHits = this.cacheStats.hitsByType.get(cacheType) || 0;
        this.cacheStats.hitsByType.set(cacheType, typeHits + 1);
    }

    /**
     * 记录缓存未命中
     */
    public recordCacheMiss(cacheType: string): void {
        this.cacheStats.misses++;
        const typeMisses = this.cacheStats.missesByType.get(cacheType) || 0;
        this.cacheStats.missesByType.set(cacheType, typeMisses + 1);
    }

    /**
     * 获取性能统计
     */
    public getStats(): FormattingStats {
        const totalOperations = this.completedTimings.length;
        const formattersUsed = new Set(this.completedTimings.map(t => t.operation)).size;
        
        return {
            nodesProcessed: this.getNodesProcessedCount(),
            cacheHits: this.cacheStats.hits,
            cacheMisses: this.cacheStats.misses,
            formattersUsed,
            errorsFixed: 0 // 这个需要从错误收集器获取
        };
    }

    /**
     * 重置统计信息
     */
    public reset(): void {
        this.timings.clear();
        this.completedTimings = [];
        this.operationStats.clear();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            hitsByType: new Map(),
            missesByType: new Map()
        };
        this.startTime = Date.now();
        this.memoryBaseline = this.getCurrentMemoryUsage();
    }

    /**
     * 生成计时ID
     */
    private generateTimingId(operation: string): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${operation}-${timestamp}-${random}`;
    }

    /**
     * 更新操作统计
     */
    private updateOperationStats(timing: TimingEntry): void {
        const operation = timing.operation;
        const duration = timing.duration || 0;
        
        let stats = this.operationStats.get(operation);
        if (!stats) {
            stats = {
                count: 0,
                totalDuration: 0,
                minDuration: duration,
                maxDuration: duration,
                avgDuration: duration
            };
            this.operationStats.set(operation, stats);
        }

        stats.count++;
        stats.totalDuration += duration;
        stats.minDuration = Math.min(stats.minDuration, duration);
        stats.maxDuration = Math.max(stats.maxDuration, duration);
        stats.avgDuration = stats.totalDuration / stats.count;
    }

    /**
     * 估算处理的节点数量
     */
    private getNodesProcessedCount(): number {
        // 基于操作次数估算节点数量
        const visitOperations = this.completedTimings.filter(t => 
            t.operation.includes('visit') || 
            t.operation.includes('format')
        );
        return visitOperations.length;
    }

    /**
     * 获取当前内存使用量（如果可用）
     */
    private getCurrentMemoryUsage(): number {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            return process.memoryUsage().heapUsed;
        }
        return 0;
    }

    /**
     * 获取详细的性能报告
     */
    public getDetailedReport(): {
        summary: FormattingStats;
        operationBreakdown: Array<{
            operation: string;
            count: number;
            totalDuration: number;
            avgDuration: number;
            minDuration: number;
            maxDuration: number;
        }>;
        cacheAnalysis: {
            totalHits: number;
            totalMisses: number;
            hitRate: number;
            hitsByType: Array<{ type: string; hits: number }>;
            missesByType: Array<{ type: string; misses: number }>;
        };
        timingDetails: {
            totalDuration: number;
            slowestOperations: Array<{
                operation: string;
                duration: number;
                timestamp: number;
            }>;
        };
        memoryUsage?: {
            baseline: number;
            current: number;
            delta: number;
        };
    } {
        const summary = this.getStats();
        
        // 操作分析
        const operationBreakdown = Array.from(this.operationStats.entries())
            .map(([operation, stats]) => ({
                operation,
                count: stats.count,
                totalDuration: stats.totalDuration,
                avgDuration: Math.round(stats.avgDuration * 100) / 100,
                minDuration: stats.minDuration,
                maxDuration: stats.maxDuration
            }))
            .sort((a, b) => b.totalDuration - a.totalDuration);

        // 缓存分析
        const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
        const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) * 100 : 0;
        
        const hitsByType = Array.from(this.cacheStats.hitsByType.entries())
            .map(([type, hits]) => ({ type, hits }))
            .sort((a, b) => b.hits - a.hits);
            
        const missesByType = Array.from(this.cacheStats.missesByType.entries())
            .map(([type, misses]) => ({ type, misses }))
            .sort((a, b) => b.misses - a.misses);

        // 计时详情
        const totalDuration = this.completedTimings.reduce((sum, timing) => sum + (timing.duration || 0), 0);
        const slowestOperations = this.completedTimings
            .filter(timing => timing.duration !== undefined)
            .sort((a, b) => (b.duration || 0) - (a.duration || 0))
            .slice(0, 10)
            .map(timing => ({
                operation: timing.operation,
                duration: timing.duration || 0,
                timestamp: timing.startTime
            }));

        // 内存使用
        const currentMemory = this.getCurrentMemoryUsage();
        const memoryUsage = currentMemory > 0 ? {
            baseline: this.memoryBaseline,
            current: currentMemory,
            delta: currentMemory - this.memoryBaseline
        } : undefined;

        return {
            summary,
            operationBreakdown,
            cacheAnalysis: {
                totalHits: this.cacheStats.hits,
                totalMisses: this.cacheStats.misses,
                hitRate: Math.round(hitRate * 100) / 100,
                hitsByType,
                missesByType
            },
            timingDetails: {
                totalDuration,
                slowestOperations
            },
            memoryUsage
        };
    }

    /**
     * 获取性能建议
     */
    public getPerformanceRecommendations(): string[] {
        const recommendations: string[] = [];
        const report = this.getDetailedReport();
        
        // 缓存命中率分析
        if (report.cacheAnalysis.hitRate < 50) {
            recommendations.push('Consider increasing cache size or adjusting cache strategy - low hit rate detected');
        }
        
        // 慢操作分析
        const slowOperations = report.operationBreakdown.filter(op => op.avgDuration > 100);
        if (slowOperations.length > 0) {
            recommendations.push(`Optimize slow operations: ${slowOperations.map(op => op.operation).join(', ')}`);
        }
        
        // 内存使用分析
        if (report.memoryUsage && report.memoryUsage.delta > 50 * 1024 * 1024) { // 50MB
            recommendations.push('High memory usage detected - consider implementing memory cleanup');
        }
        
        // 频繁操作分析
        const frequentOperations = report.operationBreakdown.filter(op => op.count > 1000);
        if (frequentOperations.length > 0) {
            recommendations.push('Consider caching results for frequently called operations');
        }
        
        return recommendations;
    }

    /**
     * 导出性能数据
     */
    public exportData(): string {
        const report = this.getDetailedReport();
        return JSON.stringify(report, null, 2);
    }

    /**
     * 获取实时统计信息
     */
    public getLiveStats(): {
        activeTimings: number;
        totalOperations: number;
        uptime: number;
        cacheHitRate: number;
        avgOperationTime: number;
    } {
        const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
        const cacheHitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) * 100 : 0;
        
        const totalDuration = this.completedTimings.reduce((sum, timing) => sum + (timing.duration || 0), 0);
        const avgOperationTime = this.completedTimings.length > 0 ? totalDuration / this.completedTimings.length : 0;
        
        return {
            activeTimings: this.timings.size,
            totalOperations: this.completedTimings.length,
            uptime: Date.now() - this.startTime,
            cacheHitRate: Math.round(cacheHitRate * 100) / 100,
            avgOperationTime: Math.round(avgOperationTime * 100) / 100
        };
    }
}