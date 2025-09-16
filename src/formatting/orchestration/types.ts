/**
 * 格式化编排系统的类型定义
 */

import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { IFormattingContext, IExtendedFormattingContext } from '../types/interfaces';
import { LPCFormattingOptions } from '../types';

/**
 * 格式化策略枚举
 */
export enum FormattingStrategyType {
    COMPACT = 'compact',
    STANDARD = 'standard',
    DEBUG = 'debug',
    CUSTOM = 'custom'
}

/**
 * 格式化模式枚举
 */
export enum FormattingMode {
    FULL = 'full',           // 完整格式化
    INCREMENTAL = 'incremental', // 增量格式化
    SELECTION = 'selection',  // 选区格式化
    QUICK = 'quick'          // 快速格式化（跳过复杂分析）
}

/**
 * 格式化结果接口
 */
export interface IFormattingResult {
    /** 格式化后的代码 */
    readonly formattedText: string;
    /** 是否成功 */
    readonly success: boolean;
    /** 错误信息列表 */
    readonly errors: string[];
    /** 格式化统计信息 */
    readonly stats: FormattingStats;
    /** 应用的策略名称 */
    readonly strategyApplied: string;
    /** 格式化耗时（毫秒） */
    readonly duration: number;
}

/**
 * 格式化统计信息
 */
export interface FormattingStats {
    /** 处理的节点总数 */
    nodesProcessed: number;
    /** 缓存命中次数 */
    cacheHits: number;
    /** 缓存未命中次数 */
    cacheMisses: number;
    /** 应用的格式化器数量 */
    formattersUsed: number;
    /** 修复的错误数量 */
    errorsFixed: number;
    /** 验证质量评分 */
    validationScore?: number;
    /** 验证错误数量 */
    validationErrors?: number;
}

/**
 * 格式化请求接口
 */
export interface IFormattingRequest {
    /** 待格式化的代码 */
    readonly text: string;
    /** 语法树根节点 */
    readonly parseTree: ParseTree;
    /** 格式化选项 */
    readonly options: LPCFormattingOptions;
    /** 格式化模式 */
    readonly mode: FormattingMode;
    /** 目标策略类型 */
    readonly strategyType?: FormattingStrategyType;
    /** 选区信息（选区格式化时使用） */
    readonly selection?: {
        start: number;
        end: number;
    };
}

/**
 * 格式化策略接口
 */
export interface IFormattingStrategy {
    /** 策略名称 */
    readonly name: string;
    /** 策略类型 */
    readonly type: FormattingStrategyType;
    /** 策略描述 */
    readonly description: string;
    
    /**
     * 应用策略到格式化上下文
     * @param context 格式化上下文
     * @param request 格式化请求
     */
    apply(context: IExtendedFormattingContext, request: IFormattingRequest): void;
    
    /**
     * 检查策略是否适用于当前请求
     * @param request 格式化请求
     */
    isApplicable(request: IFormattingRequest): boolean;
    
    /**
     * 获取策略优先级（数字越大优先级越高）
     */
    getPriority(): number;
}

/**
 * 路由目标接口
 */
export interface IRouteTarget {
    /** 格式化器类型 */
    readonly formatterType: string;
    /** 处理方法名称 */
    readonly methodName: string;
    /** 是否需要缓存结果 */
    readonly cacheable: boolean;
    /** 预估处理成本（用于性能优化） */
    readonly estimatedCost: number;
}

/**
 * 格式化路由接口
 */
export interface IFormattingRoute {
    /** 节点类型名称 */
    readonly nodeType: string;
    /** 路由目标 */
    readonly target: IRouteTarget;
    /** 路由条件（可选） */
    readonly condition?: (node: ParseTree, context: IFormattingContext) => boolean;
}

/**
 * 性能监控接口
 */
export interface IPerformanceMonitor {
    /**
     * 开始性能监控
     * @param operation 操作名称
     */
    startTiming(operation: string): string;
    
    /**
     * 结束性能监控
     * @param timingId 计时ID
     */
    endTiming(timingId: string): number;
    
    /**
     * 记录缓存命中
     * @param cacheType 缓存类型
     */
    recordCacheHit(cacheType: string): void;
    
    /**
     * 记录缓存未命中
     * @param cacheType 缓存类型
     */
    recordCacheMiss(cacheType: string): void;
    
    /**
     * 获取性能统计
     */
    getStats(): FormattingStats;
    
    /**
     * 重置统计信息
     */
    reset(): void;
}

/**
 * 格式化缓存接口
 */
export interface IFormattingCache {
    /**
     * 获取缓存的格式化结果
     * @param key 缓存键
     */
    get(key: string): string | undefined;
    
    /**
     * 设置缓存
     * @param key 缓存键
     * @param value 格式化结果
     * @param ttl 生存时间（毫秒）
     */
    set(key: string, value: string, ttl?: number): void;
    
    /**
     * 删除缓存项
     * @param key 缓存键
     */
    delete(key: string): void;
    
    /**
     * 清空所有缓存
     */
    clear(): void;
    
    /**
     * 获取缓存统计信息
     */
    getStats(): {
        size: number;
        hitCount: number;
        missCount: number;
        hitRate: number;
    };
}

/**
 * 格式化事件接口
 */
export interface IFormattingEvents {
    /** 格式化开始事件 */
    onFormatStart?: (request: IFormattingRequest) => void;
    /** 格式化结束事件 */
    onFormatEnd?: (result: IFormattingResult) => void;
    /** 格式化错误事件 */
    onFormatError?: (error: Error, context: IFormattingContext) => void;
    /** 策略应用事件 */
    onStrategyApplied?: (strategy: IFormattingStrategy) => void;
    /** 缓存命中事件 */
    onCacheHit?: (key: string) => void;
    /** 缓存未命中事件 */
    onCacheMiss?: (key: string) => void;
}

/**
 * 编排器配置接口
 */
export interface IOrchestratorConfig {
    /** 默认格式化策略 */
    defaultStrategy: FormattingStrategyType;
    /** 是否启用缓存 */
    enableCache: boolean;
    /** 缓存TTL（毫秒） */
    cacheTtl: number;
    /** 最大缓存大小 */
    maxCacheSize: number;
    /** 是否启用性能监控 */
    enablePerformanceMonitoring: boolean;
    /** 最大节点处理数量（防止内存溢出） */
    maxNodeCount: number;
    /** 超时时间（毫秒） */
    timeout: number;
    /** 事件处理器 */
    events?: IFormattingEvents;
    /** 是否启用严格验证 */
    strictValidation?: boolean;
    /** 最大验证错误数量 */
    maxValidationErrors?: number;
    /** 最小质量评分要求 */
    minQualityScore?: number;
}