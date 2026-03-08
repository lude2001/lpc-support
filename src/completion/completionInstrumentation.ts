import * as vscode from 'vscode';
import {
    CompletionContextKind,
    CompletionMetrics,
    CompletionStage,
    CompletionStageMetric
} from './types';

export interface CompletionRequestStart {
    documentUri: string;
    documentVersion: number;
    triggerKind?: vscode.CompletionTriggerKind;
    triggerCharacter?: string;
}

export interface CompletionStageDetails {
    cacheHit?: boolean;
    candidateCount?: number;
}

export class CompletionRequestTrace {
    private readonly startedAt: number;
    private readonly stages = new Map<CompletionStage, CompletionStageMetric>();

    constructor(
        private readonly instrumentation: CompletionInstrumentation,
        private readonly start: CompletionRequestStart,
        private readonly enabled: boolean
    ) {
        this.startedAt = CompletionInstrumentation.now();
    }

    public measure<T>(stage: CompletionStage, fn: () => T, details?: CompletionStageDetails): T {
        if (!this.enabled) {
            return fn();
        }

        const stageStartedAt = CompletionInstrumentation.now();
        const result = fn();
        this.recordStage(stage, CompletionInstrumentation.now() - stageStartedAt, details);
        return result;
    }

    public async measureAsync<T>(stage: CompletionStage, fn: () => Promise<T>, details?: CompletionStageDetails): Promise<T> {
        if (!this.enabled) {
            return fn();
        }

        const stageStartedAt = CompletionInstrumentation.now();
        const result = await fn();
        this.recordStage(stage, CompletionInstrumentation.now() - stageStartedAt, details);
        return result;
    }

    public recordStage(stage: CompletionStage, durationMs: number, details?: CompletionStageDetails): void {
        if (!this.enabled) {
            return;
        }

        const existing = this.stages.get(stage);
        const metric: CompletionStageMetric = {
            stage,
            durationMs: Number(((existing?.durationMs || 0) + durationMs).toFixed(3)),
            cacheHit: details?.cacheHit ?? existing?.cacheHit,
            candidateCount: details?.candidateCount ?? existing?.candidateCount
        };

        this.stages.set(stage, metric);
    }

    public complete(contextKind: CompletionContextKind, totalCandidates: number): CompletionMetrics {
        const totalDurationMs = Number((CompletionInstrumentation.now() - this.startedAt).toFixed(3));
        this.recordStage('request-total', totalDurationMs, { candidateCount: totalCandidates });

        const metrics: CompletionMetrics = {
            documentUri: this.start.documentUri,
            documentVersion: this.start.documentVersion,
            triggerKind: this.start.triggerKind,
            triggerCharacter: this.start.triggerCharacter,
            contextKind,
            totalDurationMs,
            totalCandidates,
            stages: Array.from(this.stages.values()),
            createdAt: Date.now()
        };

        this.instrumentation.recordRequest(metrics);
        return metrics;
    }
}

export class CompletionInstrumentation implements vscode.Disposable {
    private readonly outputChannel = vscode.window.createOutputChannel('LPC Completion Performance');
    private readonly recentMetrics: CompletionMetrics[] = [];
    private readonly enabled: boolean;
    private readonly historyLimit: number;

    constructor() {
        const config = vscode.workspace.getConfiguration('lpc.performance');
        this.enabled = config.get<boolean>('enableMonitoring', true);
        this.historyLimit = Math.max(1, config.get<number>('completionMetricHistorySize', 30));
    }

    public startRequest(start: CompletionRequestStart): CompletionRequestTrace {
        return new CompletionRequestTrace(this, start, this.enabled);
    }

    public recordRequest(metrics: CompletionMetrics): void {
        if (!this.enabled) {
            return;
        }

        this.recentMetrics.unshift(this.cloneMetrics(metrics));
        if (this.recentMetrics.length > this.historyLimit) {
            this.recentMetrics.length = this.historyLimit;
        }
    }

    public getRecentMetrics(): CompletionMetrics[] {
        return this.recentMetrics.map(metrics => this.cloneMetrics(metrics));
    }

    public clear(): void {
        this.recentMetrics.length = 0;
    }

    public formatSummary(parseCacheStats: { size: number; memory: number }): string {
        const memoryMB = (parseCacheStats.memory / 1024 / 1024).toFixed(2);
        const metrics = this.recentMetrics;

        if (metrics.length === 0) {
            return `LPC 性能统计: 解析缓存 ${parseCacheStats.size} 项，内存 ${memoryMB} MB；暂无补全样本`;
        }

        const averageDuration = metrics.reduce((sum, metric) => sum + metric.totalDurationMs, 0) / metrics.length;
        const averageCandidates = metrics.reduce((sum, metric) => sum + metric.totalCandidates, 0) / metrics.length;
        const latest = metrics[0];

        return `LPC 性能统计: 解析缓存 ${parseCacheStats.size} 项，内存 ${memoryMB} MB；最近 ${metrics.length} 次补全平均 ${averageDuration.toFixed(1)}ms / ${averageCandidates.toFixed(1)} 候选，最近一次 ${latest.contextKind} ${latest.totalDurationMs.toFixed(1)}ms`;
    }

    public showReport(parseCacheStats: { size: number; memory: number }): void {
        this.outputChannel.clear();

        for (const line of this.buildReport(parseCacheStats)) {
            this.outputChannel.appendLine(line);
        }

        this.outputChannel.show(true);
    }

    public dispose(): void {
        this.outputChannel.dispose();
        this.clear();
    }

    public static now(): number {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }

        return Date.now();
    }

    private buildReport(parseCacheStats: { size: number; memory: number }): string[] {
        const lines = [this.formatSummary(parseCacheStats), ''];
        const metrics = this.recentMetrics;

        if (metrics.length === 0) {
            lines.push('最近暂无补全性能记录。');
            return lines;
        }

        lines.push('最近补全请求:');
        for (const metric of metrics.slice(0, 10)) {
            const stageSummary = metric.stages
                .map(stage => {
                    const extras = [
                        typeof stage.cacheHit === 'boolean' ? `cache=${stage.cacheHit ? 'hit' : 'miss'}` : undefined,
                        typeof stage.candidateCount === 'number' ? `candidates=${stage.candidateCount}` : undefined
                    ].filter(Boolean).join(', ');

                    return extras
                        ? `${stage.stage}=${stage.durationMs.toFixed(1)}ms (${extras})`
                        : `${stage.stage}=${stage.durationMs.toFixed(1)}ms`;
                })
                .join(' | ');

            lines.push(
                `- ${new Date(metric.createdAt).toLocaleTimeString()} ${metric.contextKind} total=${metric.totalDurationMs.toFixed(1)}ms candidates=${metric.totalCandidates} :: ${stageSummary}`
            );
        }

        return lines;
    }

    private cloneMetrics(metrics: CompletionMetrics): CompletionMetrics {
        return {
            ...metrics,
            stages: metrics.stages.map(stage => ({ ...stage }))
        };
    }
}
