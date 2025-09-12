/**
 * 格式化缓存实现
 * 
 * 提供高效的格式化结果缓存：
 * - LRU缓存策略
 * - TTL过期控制
 * - 内存使用管理
 * - 缓存统计和监控
 */

import { IFormattingCache } from './types';

interface CacheEntry {
    value: string;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    size: number; // 估算的内存占用
    ttl?: number; // 生存时间（毫秒）
}

interface CacheStats {
    size: number;
    hitCount: number;
    missCount: number;
    evictionCount: number;
    memoryUsage: number;
}

export class FormattingCache implements IFormattingCache {
    private cache = new Map<string, CacheEntry>();
    private readonly maxSize: number;
    private readonly defaultTtl: number;
    private stats: CacheStats = {
        size: 0,
        hitCount: 0,
        missCount: 0,
        evictionCount: 0,
        memoryUsage: 0
    };
    
    private cleanupTimer?: NodeJS.Timeout;
    private readonly cleanupInterval = 60000; // 1分钟清理一次

    constructor(maxSize: number = 1000, defaultTtl: number = 300000) { // 默认5分钟TTL
        this.maxSize = maxSize;
        this.defaultTtl = defaultTtl;
        this.startCleanupTimer();
    }

    /**
     * 获取缓存值
     */
    public get(key: string): string | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.missCount++;
            return undefined;
        }

        // 检查TTL过期
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.updateMemoryUsage(-entry.size);
            this.stats.missCount++;
            return undefined;
        }

        // 更新访问信息
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        this.stats.hitCount++;

        return entry.value;
    }

    /**
     * 设置缓存值
     */
    public set(key: string, value: string, ttl?: number): void {
        const now = Date.now();
        const size = this.estimateSize(key, value);
        
        // 检查是否已存在
        const existingEntry = this.cache.get(key);
        if (existingEntry) {
            // 更新现有条目
            this.updateMemoryUsage(-existingEntry.size + size);
            existingEntry.value = value;
            existingEntry.timestamp = now;
            existingEntry.lastAccessed = now;
            existingEntry.size = size;
            existingEntry.ttl = ttl;
        } else {
            // 检查缓存大小限制
            if (this.cache.size >= this.maxSize) {
                this.evictLeastRecentlyUsed();
            }

            // 创建新条目
            const entry: CacheEntry = {
                value,
                timestamp: now,
                accessCount: 0,
                lastAccessed: now,
                size,
                ttl
            };

            this.cache.set(key, entry);
            this.updateMemoryUsage(size);
        }
    }

    /**
     * 删除缓存项
     */
    public delete(key: string): void {
        const entry = this.cache.get(key);
        if (entry) {
            this.cache.delete(key);
            this.updateMemoryUsage(-entry.size);
        }
    }

    /**
     * 清空所有缓存
     */
    public clear(): void {
        this.cache.clear();
        this.stats.size = 0;
        this.stats.memoryUsage = 0;
    }

    /**
     * 获取缓存统计信息
     */
    public getStats(): {
        size: number;
        hitCount: number;
        missCount: number;
        hitRate: number;
    } {
        const total = this.stats.hitCount + this.stats.missCount;
        const hitRate = total > 0 ? (this.stats.hitCount / total) * 100 : 0;

        return {
            size: this.cache.size,
            hitCount: this.stats.hitCount,
            missCount: this.stats.missCount,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }

    /**
     * 获取详细统计信息
     */
    public getDetailedStats(): CacheStats & {
        hitRate: number;
        avgEntrySize: number;
        oldestEntry: number;
        newestEntry: number;
    } {
        const total = this.stats.hitCount + this.stats.missCount;
        const hitRate = total > 0 ? (this.stats.hitCount / total) * 100 : 0;
        const avgEntrySize = this.cache.size > 0 ? this.stats.memoryUsage / this.cache.size : 0;

        let oldestEntry = Date.now();
        let newestEntry = 0;

        this.cache.forEach(entry => {
            oldestEntry = Math.min(oldestEntry, entry.timestamp);
            newestEntry = Math.max(newestEntry, entry.timestamp);
        });

        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: Math.round(hitRate * 100) / 100,
            avgEntrySize: Math.round(avgEntrySize),
            oldestEntry,
            newestEntry
        };
    }

    /**
     * 检查条目是否过期
     */
    private isExpired(entry: CacheEntry): boolean {
        const ttl = entry.ttl || this.defaultTtl;
        return Date.now() - entry.timestamp > ttl;
    }

    /**
     * 估算缓存条目大小
     */
    private estimateSize(key: string, value: string): number {
        // 简单估算：键长度 + 值长度 + 对象开销
        return (key.length + value.length) * 2 + 100; // 假设Unicode字符占2字节，加100字节对象开销
    }

    /**
     * 更新内存使用统计
     */
    private updateMemoryUsage(delta: number): void {
        this.stats.memoryUsage += delta;
        this.stats.size = this.cache.size;
    }

    /**
     * 驱逐最近最少使用的条目
     */
    private evictLeastRecentlyUsed(): void {
        let lruKey: string | null = null;
        let lruTime = Date.now();

        // 找到最近最少使用的条目
        this.cache.forEach((entry, key) => {
            if (entry.lastAccessed < lruTime) {
                lruTime = entry.lastAccessed;
                lruKey = key;
            }
        });

        if (lruKey) {
            const entry = this.cache.get(lruKey)!;
            this.cache.delete(lruKey);
            this.updateMemoryUsage(-entry.size);
            this.stats.evictionCount++;
        }
    }

    /**
     * 清理过期条目
     */
    private cleanupExpired(): void {
        const keysToDelete: string[] = [];
        const now = Date.now();

        this.cache.forEach((entry, key) => {
            if (this.isExpired(entry)) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => {
            const entry = this.cache.get(key)!;
            this.cache.delete(key);
            this.updateMemoryUsage(-entry.size);
        });

        if (keysToDelete.length > 0) {
            console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
        }
    }

    /**
     * 启动清理定时器
     */
    private startCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanupExpired();
        }, this.cleanupInterval);
    }

    /**
     * 停止清理定时器
     */
    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.clear();
    }

    /**
     * 获取热点数据（访问频率最高的条目）
     */
    public getHotEntries(limit: number = 10): Array<{
        key: string;
        accessCount: number;
        lastAccessed: number;
        size: number;
    }> {
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                accessCount: entry.accessCount,
                lastAccessed: entry.lastAccessed,
                size: entry.size
            }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);

        return entries;
    }

    /**
     * 预热缓存（批量设置常用数据）
     */
    public warm(entries: Array<{ key: string; value: string; ttl?: number }>): void {
        entries.forEach(({ key, value, ttl }) => {
            this.set(key, value, ttl);
        });
    }

    /**
     * 压缩缓存（移除不常用的条目）
     */
    public compact(targetSize?: number): void {
        const target = targetSize || Math.floor(this.maxSize * 0.8); // 默认压缩到80%
        
        if (this.cache.size <= target) {
            return;
        }

        // 获取所有条目并按访问频率排序
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                entry,
                score: this.calculateCacheScore(entry)
            }))
            .sort((a, b) => a.score - b.score); // 分数低的优先移除

        // 移除分数最低的条目
        const toRemove = this.cache.size - target;
        for (let i = 0; i < toRemove && i < entries.length; i++) {
            const { key, entry } = entries[i];
            this.cache.delete(key);
            this.updateMemoryUsage(-entry.size);
            this.stats.evictionCount++;
        }
    }

    /**
     * 计算缓存条目的重要性分数
     */
    private calculateCacheScore(entry: CacheEntry): number {
        const now = Date.now();
        const age = now - entry.timestamp;
        const timeSinceLastAccess = now - entry.lastAccessed;
        
        // 分数越高越重要
        // 考虑因素：访问次数、最近访问时间、条目年龄
        const accessWeight = entry.accessCount * 10;
        const recencyWeight = Math.max(0, 100 - timeSinceLastAccess / 1000); // 秒为单位
        const ageWeight = Math.max(0, 50 - age / (60 * 1000)); // 分钟为单位
        
        return accessWeight + recencyWeight + ageWeight;
    }

    /**
     * 导出缓存数据
     */
    public export(): string {
        const data = {
            entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                value: entry.value,
                timestamp: entry.timestamp,
                accessCount: entry.accessCount,
                lastAccessed: entry.lastAccessed,
                ttl: entry.ttl
            })),
            stats: this.getDetailedStats()
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * 导入缓存数据
     */
    public import(data: string): void {
        try {
            const parsed = JSON.parse(data);
            this.clear();

            parsed.entries.forEach((item: any) => {
                const entry: CacheEntry = {
                    value: item.value,
                    timestamp: item.timestamp,
                    accessCount: item.accessCount,
                    lastAccessed: item.lastAccessed,
                    size: this.estimateSize(item.key, item.value),
                    ttl: item.ttl
                };

                this.cache.set(item.key, entry);
                this.updateMemoryUsage(entry.size);
            });

        } catch (error) {
            console.error('Failed to import cache data:', error);
        }
    }
}