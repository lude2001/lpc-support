/**
 * 格式化编排器 - 系统的指挥中心
 * 
 * 主要职责：
 * 1. 协调格式化策略的选择和应用
 * 2. 管理格式化器的路由和调度
 * 3. 控制缓存策略和性能优化
 * 4. 处理错误恢复和降级机制
 * 5. 提供格式化事件和监控机制
 */

import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { 
    IFormattingRequest,
    IFormattingResult, 
    IFormattingStrategy,
    FormattingStrategyType,
    FormattingMode,
    IOrchestratorConfig,
    IPerformanceMonitor,
    IFormattingCache,
    FormattingStats
} from './types';
import { IExtendedFormattingContext } from '../types/interfaces';
import { FormattingStrategyManager } from './FormattingStrategyManager';
import { FormattingRouter } from './FormattingRouter';
// import { FormattingValidator } from './FormattingValidator'; // TODO: 需要实现该模块
import { PerformanceMonitor } from './PerformanceMonitor';
import { FormattingCache } from './FormattingCache';
import { FormattingVisitor } from './FormattingVisitor';

export class FormattingOrchestrator {
    private readonly strategyManager: FormattingStrategyManager;
    private readonly router: FormattingRouter;
    // private readonly validator: FormattingValidator; // TODO: 需要实现该模块
    private readonly performanceMonitor: IPerformanceMonitor;
    private readonly cache: IFormattingCache;
    private readonly config: IOrchestratorConfig;

    constructor(config: IOrchestratorConfig) {
        this.config = config;
        this.strategyManager = new FormattingStrategyManager();
        this.router = new FormattingRouter();
        // this.validator = new FormattingValidator(); // TODO: 需要实现该模块
        
        // 根据配置决定是否启用性能监控和缓存
        this.performanceMonitor = config.enablePerformanceMonitoring 
            ? new PerformanceMonitor() 
            : new NoOpPerformanceMonitor();
            
        this.cache = config.enableCache 
            ? new FormattingCache(config.maxCacheSize, config.cacheTtl)
            : new NoOpCache();
    }

    /**
     * 执行格式化操作的主入口
     * @param request 格式化请求
     * @param context 格式化上下文
     * @returns 格式化结果
     */
    public async format(
        request: IFormattingRequest, 
        context: IExtendedFormattingContext
    ): Promise<IFormattingResult> {
        const timingId = this.performanceMonitor.startTiming('total-formatting');
        
        try {
            // 触发开始事件
            this.config.events?.onFormatStart?.(request);

            // 1. 验证请求
            await this.validateRequest(request);

            // 2. 检查缓存
            const cacheKey = this.generateCacheKey(request);
            const cachedResult = this.tryGetFromCache(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }

            // 3. 选择和应用格式化策略
            const strategy = await this.selectStrategy(request);
            strategy.apply(context, request);
            this.config.events?.onStrategyApplied?.(strategy);

            // 4. 执行格式化
            const result = await this.executeFormatting(request, context, strategy);

            // 5. 验证结果
            await this.validateResult(result);

            // 6. 缓存结果
            this.cacheResult(cacheKey, result);

            // 7. 触发结束事件
            this.config.events?.onFormatEnd?.(result);

            return result;

        } catch (error) {
            const errorResult = this.handleError(error, request, context);
            this.config.events?.onFormatError?.(error as Error, context);
            return errorResult;
        } finally {
            const duration = this.performanceMonitor.endTiming(timingId);
            // 可以在这里记录额外的性能指标
        }
    }

    /**
     * 验证格式化请求
     */
    private async validateRequest(request: IFormattingRequest): Promise<void> {
        if (!request.text || !request.parseTree) {
            throw new Error('Invalid formatting request: missing text or parseTree');
        }

        // TODO: 实现 FormattingValidator 后再启用
        // if (!this.validator.validateParseTree(request.parseTree)) {
        //     throw new Error('Invalid parse tree structure');
        // }

        if (request.text.length > this.config.maxNodeCount * 100) { // 粗略估算
            throw new Error('File too large for formatting');
        }
    }

    /**
     * 选择最适合的格式化策略
     */
    private async selectStrategy(request: IFormattingRequest): Promise<IFormattingStrategy> {
        // 如果请求指定了策略类型，优先使用
        if (request.strategyType) {
            return this.strategyManager.getStrategy(request.strategyType);
        }

        // 否则根据文件特征自动选择
        return this.strategyManager.selectBestStrategy(request);
    }

    /**
     * 执行实际的格式化操作
     */
    private async executeFormatting(
        request: IFormattingRequest,
        context: IExtendedFormattingContext,
        strategy: IFormattingStrategy
    ): Promise<IFormattingResult> {
        const formatTimingId = this.performanceMonitor.startTiming('core-formatting');

        try {
            // 根据格式化模式选择不同的执行路径
            let formattedText: string;

            switch (request.mode) {
                case FormattingMode.FULL:
                    formattedText = await this.executeFullFormatting(request, context);
                    break;
                case FormattingMode.INCREMENTAL:
                    formattedText = await this.executeIncrementalFormatting(request, context);
                    break;
                case FormattingMode.SELECTION:
                    formattedText = await this.executeSelectionFormatting(request, context);
                    break;
                case FormattingMode.QUICK:
                    formattedText = await this.executeQuickFormatting(request, context);
                    break;
                default:
                    formattedText = await this.executeFullFormatting(request, context);
            }

            const duration = this.performanceMonitor.endTiming(formatTimingId);
            const stats = this.performanceMonitor.getStats();

            return {
                formattedText,
                success: true,
                errors: context.errorCollector.getErrors(),
                stats,
                strategyApplied: strategy.name,
                duration
            };

        } catch (error) {
            throw new Error(`Formatting execution failed: ${error}`);
        }
    }

    /**
     * 完整格式化执行
     */
    private async executeFullFormatting(
        request: IFormattingRequest,
        context: IExtendedFormattingContext
    ): Promise<string> {
        const visitor = new FormattingVisitor(context, this.router);
        return visitor.visit(request.parseTree);
    }

    /**
     * 增量格式化执行
     */
    private async executeIncrementalFormatting(
        request: IFormattingRequest,
        context: IExtendedFormattingContext
    ): Promise<string> {
        // TODO: 实现增量格式化逻辑
        // 这里需要分析变更的节点，只格式化必要的部分
        return this.executeFullFormatting(request, context);
    }

    /**
     * 选区格式化执行
     */
    private async executeSelectionFormatting(
        request: IFormattingRequest,
        context: IExtendedFormattingContext
    ): Promise<string> {
        // TODO: 实现选区格式化逻辑
        if (!request.selection) {
            throw new Error('Selection formatting requires selection range');
        }
        
        // 这里需要根据选区范围提取相关节点进行格式化
        return this.executeFullFormatting(request, context);
    }

    /**
     * 快速格式化执行（跳过复杂分析）
     */
    private async executeQuickFormatting(
        request: IFormattingRequest,
        context: IExtendedFormattingContext
    ): Promise<string> {
        // TODO: 实现快速格式化逻辑
        // 只进行基础的缩进和空格调整，跳过复杂的语义分析
        return this.executeFullFormatting(request, context);
    }

    /**
     * 验证格式化结果
     */
    private async validateResult(result: IFormattingResult): Promise<void> {
        if (!result.success) {
            throw new Error('Formatting failed with errors: ' + result.errors.join(', '));
        }

        // TODO: 实现 FormattingValidator 后再启用
        // if (!this.validator.validateFormattedText(result.formattedText)) {
        //     throw new Error('Formatted text validation failed');
        // }
    }

    /**
     * 生成缓存键
     */
    private generateCacheKey(request: IFormattingRequest): string {
        const hash = this.simpleHash(request.text);
        const optionsHash = this.simpleHash(JSON.stringify(request.options));
        const modeHash = request.mode;
        const strategyHash = request.strategyType || 'auto';
        
        return `${hash}-${optionsHash}-${modeHash}-${strategyHash}`;
    }

    /**
     * 简单哈希函数
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转为32位整数
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 尝试从缓存获取结果
     */
    private tryGetFromCache(cacheKey: string): IFormattingResult | undefined {
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.performanceMonitor.recordCacheHit('formatting-result');
            this.config.events?.onCacheHit?.(cacheKey);
            try {
                return JSON.parse(cached) as IFormattingResult;
            } catch {
                // 缓存数据损坏，删除
                this.cache.delete(cacheKey);
            }
        }
        
        this.performanceMonitor.recordCacheMiss('formatting-result');
        this.config.events?.onCacheMiss?.(cacheKey);
        return undefined;
    }

    /**
     * 缓存格式化结果
     */
    private cacheResult(cacheKey: string, result: IFormattingResult): void {
        if (result.success && this.config.enableCache) {
            try {
                const serialized = JSON.stringify(result);
                this.cache.set(cacheKey, serialized);
            } catch (error) {
                // 序列化失败，不影响主流程
                console.warn('Failed to cache formatting result:', error);
            }
        }
    }

    /**
     * 错误处理和降级机制
     */
    private handleError(
        error: unknown, 
        request: IFormattingRequest,
        context: IExtendedFormattingContext
    ): IFormattingResult {
        console.error('Formatting error:', error);

        // 尝试降级处理：返回原始文本
        return {
            formattedText: request.text, // 返回未格式化的原始文本
            success: false,
            errors: [
                ...context.errorCollector.getErrors(),
                `Formatting failed: ${error instanceof Error ? error.message : String(error)}`
            ],
            stats: this.performanceMonitor.getStats(),
            strategyApplied: 'fallback',
            duration: 0
        };
    }

    /**
     * 获取性能统计信息
     */
    public getPerformanceStats(): FormattingStats {
        return this.performanceMonitor.getStats();
    }

    /**
     * 获取缓存统计信息
     */
    public getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * 清空缓存
     */
    public clearCache(): void {
        this.cache.clear();
    }

    /**
     * 注册自定义格式化策略
     */
    public registerStrategy(strategy: IFormattingStrategy): void {
        this.strategyManager.registerStrategy(strategy);
    }

    /**
     * 销毁编排器，释放资源
     */
    public dispose(): void {
        this.cache.clear();
        this.performanceMonitor.reset();
        // 其他清理工作
    }
}

/**
 * 空操作性能监控器（当禁用性能监控时使用）
 */
class NoOpPerformanceMonitor implements IPerformanceMonitor {
    startTiming(): string { return ''; }
    endTiming(): number { return 0; }
    recordCacheHit(): void {}
    recordCacheMiss(): void {}
    getStats(): FormattingStats {
        return {
            nodesProcessed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            formattersUsed: 0,
            errorsFixed: 0
        };
    }
    reset(): void {}
}

/**
 * 空操作缓存（当禁用缓存时使用）
 */
class NoOpCache implements IFormattingCache {
    get(): undefined { return undefined; }
    set(): void {}
    delete(): void {}
    clear(): void {}
    getStats() {
        return {
            size: 0,
            hitCount: 0,
            missCount: 0,
            hitRate: 0
        };
    }
}