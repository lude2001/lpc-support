/**
 * 通用缓存管理器
 * 提供类型安全、高性能的缓存解决方案
 *
 * 特性:
 * - LRU缓存策略
 * - TTL过期机制
 * - 内存限制
 * - 性能监控
 * - 模式匹配失效
 */

export interface CacheConfig {
    /** 最大缓存条目数 */
    maxSize: number;
    /** 最大内存使用（字节数），-1表示无限制 */
    maxMemory: number;
    /** 生存时间（毫秒），-1表示永不过期 */
    ttl: number;
    /** 自动清理间隔（毫秒），0表示禁用自动清理 */
    cleanupInterval: number;
    /** 是否启用性能监控 */
    enableMonitoring: boolean;
}

export interface CacheEntry<T> {
    key: string;
    value: T;
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
    size: number; // 估算的内存大小
}

export interface CacheStats {
    /** 缓存条目数 */
    size: number;
    /** 总内存使用（字节） */
    memory: number;
    /** 缓存命中次数 */
    hits: number;
    /** 缓存未命中次数 */
    misses: number;
    /** 缓存命中率 */
    hitRate: number;
    /** 驱逐次数 */
    evictions: number;
    /** 平均访问时间（毫秒） */
    avgAccessTime: number;
}

/**
 * 驱逐策略接口
 */
export interface EvictionStrategy<T> {
    /**
     * 判断条目是否应该被驱逐
     */
    shouldEvict(entry: CacheEntry<T>, totalSize: number, totalMemory: number): boolean;

    /**
     * 从候选条目中选择要驱逐的条目
     */
    selectVictim(entries: CacheEntry<T>[]): CacheEntry<T> | undefined;
}

/**
 * LRU驱逐策略
 */
export class LRUEvictionStrategy<T> implements EvictionStrategy<T> {
    constructor(private maxSize: number) {}

    shouldEvict(entry: CacheEntry<T>, totalSize: number, totalMemory: number): boolean {
        return totalSize > this.maxSize;
    }

    selectVictim(entries: CacheEntry<T>[]): CacheEntry<T> | undefined {
        if (entries.length === 0) return undefined;

        // 选择最久未访问的条目
        return entries.reduce((oldest, current) =>
            current.lastAccessed < oldest.lastAccessed ? current : oldest
        );
    }
}

/**
 * TTL驱逐策略
 */
export class TTLEvictionStrategy<T> implements EvictionStrategy<T> {
    constructor(private ttl: number) {}

    shouldEvict(entry: CacheEntry<T>, totalSize: number, totalMemory: number): boolean {
        if (this.ttl <= 0) return false;
        const now = Date.now();
        return (now - entry.lastAccessed) > this.ttl;
    }

    selectVictim(entries: CacheEntry<T>[]): CacheEntry<T> | undefined {
        const now = Date.now();
        // 选择最早过期的条目
        return entries
            .filter(e => (now - e.lastAccessed) > this.ttl)
            .reduce((oldest, current) =>
                current.createdAt < oldest.createdAt ? current : oldest
            , entries[0]);
    }
}

/**
 * 内存驱逐策略
 */
export class MemoryEvictionStrategy<T> implements EvictionStrategy<T> {
    constructor(private maxMemory: number) {}

    shouldEvict(entry: CacheEntry<T>, totalSize: number, totalMemory: number): boolean {
        return this.maxMemory > 0 && totalMemory > this.maxMemory;
    }

    selectVictim(entries: CacheEntry<T>[]): CacheEntry<T> | undefined {
        if (entries.length === 0) return undefined;

        // 选择最大且最久未访问的条目
        return entries.reduce((largest, current) => {
            if (current.size > largest.size) return current;
            if (current.size === largest.size && current.lastAccessed < largest.lastAccessed) {
                return current;
            }
            return largest;
        });
    }
}

/**
 * 组合驱逐策略
 */
export class CompositeEvictionStrategy<T> implements EvictionStrategy<T> {
    private strategies: EvictionStrategy<T>[] = [];

    addStrategy(strategy: EvictionStrategy<T>): this {
        this.strategies.push(strategy);
        return this;
    }

    shouldEvict(entry: CacheEntry<T>, totalSize: number, totalMemory: number): boolean {
        // 任一策略认为应该驱逐，则驱逐
        return this.strategies.some(s => s.shouldEvict(entry, totalSize, totalMemory));
    }

    selectVictim(entries: CacheEntry<T>[]): CacheEntry<T> | undefined {
        // 按优先级依次尝试各策略
        for (const strategy of this.strategies) {
            const victim = strategy.selectVictim(entries);
            if (victim) return victim;
        }
        return undefined;
    }
}

/**
 * 通用缓存管理器
 */
export class CacheManager<T> {
    private cache = new Map<string, CacheEntry<T>>();
    private strategy: EvictionStrategy<T>;
    private config: CacheConfig;
    private stats: CacheStats = {
        size: 0,
        memory: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
        avgAccessTime: 0
    };
    private cleanupTimer: NodeJS.Timeout | null = null;
    private totalMemory = 0;
    private accessTimes: number[] = [];

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            maxSize: config.maxSize ?? 100,
            maxMemory: config.maxMemory ?? -1,
            ttl: config.ttl ?? -1,
            cleanupInterval: config.cleanupInterval ?? 60000,
            enableMonitoring: config.enableMonitoring ?? true
        };

        // 构建组合驱逐策略
        const composite = new CompositeEvictionStrategy<T>();

        // 优先级1: TTL过期检查
        if (this.config.ttl > 0) {
            composite.addStrategy(new TTLEvictionStrategy<T>(this.config.ttl));
        }

        // 优先级2: 内存限制检查
        if (this.config.maxMemory > 0) {
            composite.addStrategy(new MemoryEvictionStrategy<T>(this.config.maxMemory));
        }

        // 优先级3: LRU检查
        composite.addStrategy(new LRUEvictionStrategy<T>(this.config.maxSize));

        this.strategy = composite;

        // 启动定期清理
        if (this.config.cleanupInterval > 0) {
            this.startCleanupTimer();
        }
    }

    /**
     * 获取缓存值
     */
    get(key: string): T | undefined {
        const startTime = this.config.enableMonitoring ? performance.now() : 0;

        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            this.updateStats();
            return undefined;
        }

        // 检查是否应该驱逐
        if (this.strategy.shouldEvict(entry, this.cache.size, this.totalMemory)) {
            this.delete(key);
            this.stats.misses++;
            this.updateStats();
            return undefined;
        }

        // 更新访问信息
        entry.lastAccessed = Date.now();
        entry.accessCount++;

        this.stats.hits++;
        this.updateStats();

        if (this.config.enableMonitoring) {
            const accessTime = performance.now() - startTime;
            this.recordAccessTime(accessTime);
        }

        return entry.value;
    }

    /**
     * 设置缓存值
     */
    set(key: string, value: T, size?: number): void {
        const estimatedSize = size ?? this.estimateSize(value);
        const now = Date.now();

        // 如果键已存在，先删除旧值
        if (this.cache.has(key)) {
            this.delete(key);
        }

        const entry: CacheEntry<T> = {
            key,
            value,
            createdAt: now,
            lastAccessed: now,
            accessCount: 0,
            size: estimatedSize
        };

        // 检查是否需要驱逐
        while (this.strategy.shouldEvict(entry, this.cache.size + 1, this.totalMemory + estimatedSize)) {
            const victim = this.strategy.selectVictim(Array.from(this.cache.values()));
            if (!victim) break;

            this.delete(victim.key);
            this.stats.evictions++;
        }

        // 添加新条目
        this.cache.set(key, entry);
        this.totalMemory += estimatedSize;
        this.updateStats();
    }

    /**
     * 删除缓存条目
     */
    delete(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        this.cache.delete(key);
        this.totalMemory -= entry.size;
        this.updateStats();

        return true;
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
        this.totalMemory = 0;
        this.updateStats();
    }

    /**
     * 模式匹配失效
     * @param pattern 正则表达式，匹配的键将被删除
     */
    invalidate(pattern: RegExp): number {
        let count = 0;
        const keysToDelete: string[] = [];

        // 转换为数组进行迭代
        const keys = Array.from(this.cache.keys());
        for (const key of keys) {
            if (pattern.test(key)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            if (this.delete(key)) {
                count++;
            }
        }

        return count;
    }

    /**
     * 检查键是否存在
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * 获取所有键
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * 获取缓存统计信息
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.stats = {
            size: this.cache.size,
            memory: this.totalMemory,
            hits: 0,
            misses: 0,
            hitRate: 0,
            evictions: 0,
            avgAccessTime: 0
        };
        this.accessTimes = [];
    }

    /**
     * 手动触发清理
     */
    cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        // 转换为数组进行迭代
        const entries = Array.from(this.cache.entries());
        for (const [key, entry] of entries) {
            if (this.strategy.shouldEvict(entry, this.cache.size, this.totalMemory)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.delete(key);
            this.stats.evictions++;
        }
    }

    /**
     * 释放资源
     */
    dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }

    // ========== 私有方法 ==========

    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    private updateStats(): void {
        this.stats.size = this.cache.size;
        this.stats.memory = this.totalMemory;

        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;

        if (this.accessTimes.length > 0) {
            const sum = this.accessTimes.reduce((a, b) => a + b, 0);
            this.stats.avgAccessTime = sum / this.accessTimes.length;
        }
    }

    private recordAccessTime(time: number): void {
        this.accessTimes.push(time);

        // 只保留最近1000次访问的时间
        if (this.accessTimes.length > 1000) {
            this.accessTimes.shift();
        }
    }

    /**
     * 估算对象大小（字节）
     * 这是一个简化的实现，实际大小可能有差异
     */
    private estimateSize(value: T): number {
        try {
            const json = JSON.stringify(value);
            // UTF-16编码，每个字符2字节
            return json.length * 2;
        } catch {
            // 无法序列化的对象，使用固定大小
            return 1024;
        }
    }
}
