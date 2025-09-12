interface FormattingCacheEntry {
    text: string;
    options: string; // 序列化后的配置选项
    result: string;
    timestamp: number;
    size: number;
}

export class FormattingCache {
    private cache = new Map<string, FormattingCacheEntry>();
    private maxCacheSize: number = 50;
    private maxCacheMemory: number = 5 * 1024 * 1024; // 5MB
    private currentMemoryUsage: number = 0;
    private maxAge: number = 5 * 60 * 1000; // 5分钟

    // 性能统计
    private stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        evictions: 0,
        memoryEvictions: 0,
        ageEvictions: 0,
        totalSizeAdded: 0,
        totalSizeEvicted: 0,
        averageEntrySize: 0,
        peakMemoryUsage: 0,
        lastCleanupTime: Date.now(),
        cleanupCount: 0
    };

    constructor(maxSize?: number, maxMemory?: number) {
        if (maxSize) this.maxCacheSize = maxSize;
        if (maxMemory) this.maxCacheMemory = maxMemory;
        
        // 定期清理过期条目
        setInterval(() => this.cleanupExpiredEntries(), 60000); // 每分钟清理一次
    }

    private generateKey(text: string): string {
        // 简单的哈希函数，用于生成缓存键
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    }

    private serializeOptions(options: any): string {
        // 序列化配置选项，只包含影响格式化结果的关键字段
        const keyFields = {
            indentSize: options.indentSize,
            insertSpaces: options.insertSpaces,
            bracesOnNewLine: options.bracesOnNewLine,
            spaceBeforeOpenParen: options.spaceBeforeOpenParen,
            spaceAroundOperators: options.spaceAroundOperators,
            maxLineLength: options.maxLineLength
        };
        return JSON.stringify(keyFields);
    }

    get(text: string, options: any): string | null {
        this.stats.totalRequests++;
        const key = this.generateKey(text);
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.cacheMisses++;
            return null;
        }

        // 检查选项是否匹配
        const currentOptionsHash = this.serializeOptions(options);
        if (entry.options !== currentOptionsHash) {
            this.cache.delete(key);
            this.currentMemoryUsage -= entry.size;
            this.stats.cacheMisses++;
            this.stats.evictions++;
            return null;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            this.currentMemoryUsage -= entry.size;
            this.stats.totalSizeEvicted += entry.size;
            this.stats.cacheMisses++;
            this.stats.evictions++;
            this.stats.ageEvictions++;
            return null;
        }

        // 缓存命中，更新访问时间和统计
        entry.timestamp = Date.now();
        this.stats.cacheHits++;
        return entry.result;
    }

    set(text: string, options: any, result: string): void {
        const key = this.generateKey(text);
        const size = text.length + result.length;
        const optionsHash = this.serializeOptions(options);

        // 检查是否超过内存限制
        if (size > this.maxCacheMemory / 4) {
            // 单个条目太大，不缓存
            return;
        }

        // 如果缓存中已存在，先删除旧条目
        const existingEntry = this.cache.get(key);
        if (existingEntry) {
            this.currentMemoryUsage -= existingEntry.size;
            this.stats.totalSizeEvicted += existingEntry.size;
        }

        // 清理空间
        this.evictIfNeeded(size);

        // 添加新条目
        const entry: FormattingCacheEntry = {
            text,
            options: optionsHash,
            result,
            timestamp: Date.now(),
            size
        };

        this.cache.set(key, entry);
        this.currentMemoryUsage += size;
        
        // 更新统计
        this.stats.totalSizeAdded += size;
        if (this.currentMemoryUsage > this.stats.peakMemoryUsage) {
            this.stats.peakMemoryUsage = this.currentMemoryUsage;
        }
        this.updateAverageEntrySize();
    }

    private evictIfNeeded(newEntrySize: number): void {
        // 按访问时间排序，删除最旧的条目
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.timestamp - b.timestamp);

        let evicted = 0;

        // 检查缓存数量限制
        while (this.cache.size >= this.maxCacheSize) {
            const [key, entry] = entries.shift()!;
            this.cache.delete(key);
            this.currentMemoryUsage -= entry.size;
            this.stats.totalSizeEvicted += entry.size;
            evicted++;
        }

        // 检查内存限制
        while (this.currentMemoryUsage + newEntrySize > this.maxCacheMemory && entries.length > 0) {
            const [key, entry] = entries.shift()!;
            this.cache.delete(key);
            this.currentMemoryUsage -= entry.size;
            this.stats.totalSizeEvicted += entry.size;
            this.stats.memoryEvictions++;
            evicted++;
        }

        this.stats.evictions += evicted;
    }

    clear(): void {
        this.stats.totalSizeEvicted += this.currentMemoryUsage;
        this.stats.evictions += this.cache.size;
        this.cache.clear();
        this.currentMemoryUsage = 0;
    }

    /**
     * 清理过期条目
     */
    private cleanupExpiredEntries(): void {
        const now = Date.now();
        let evicted = 0;
        let evictedSize = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                this.cache.delete(key);
                this.currentMemoryUsage -= entry.size;
                evictedSize += entry.size;
                evicted++;
            }
        }

        if (evicted > 0) {
            this.stats.evictions += evicted;
            this.stats.ageEvictions += evicted;
            this.stats.totalSizeEvicted += evictedSize;
            this.stats.cleanupCount++;
            this.stats.lastCleanupTime = now;
        }
    }

    /**
     * 更新平均条目大小
     */
    private updateAverageEntrySize(): void {
        if (this.cache.size > 0) {
            this.stats.averageEntrySize = this.currentMemoryUsage / this.cache.size;
        }
    }

    /**
     * 获取详细的缓存统计信息
     */
    getStats() {
        const hitRate = this.stats.totalRequests > 0 ? 
            (this.stats.cacheHits / this.stats.totalRequests * 100) : 0;

        const missRate = this.stats.totalRequests > 0 ?
            (this.stats.cacheMisses / this.stats.totalRequests * 100) : 0;

        const evictionRate = this.stats.totalRequests > 0 ?
            (this.stats.evictions / this.stats.totalRequests * 100) : 0;

        return {
            // 基本缓存信息
            size: this.cache.size,
            memoryUsage: this.currentMemoryUsage,
            maxCacheSize: this.maxCacheSize,
            maxCacheMemory: this.maxCacheMemory,
            memoryUsagePercentage: (this.currentMemoryUsage / this.maxCacheMemory * 100).toFixed(2) + '%',
            
            // 性能指标
            totalRequests: this.stats.totalRequests,
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses,
            hitRate: hitRate.toFixed(2) + '%',
            missRate: missRate.toFixed(2) + '%',
            
            // 驱逐统计
            evictions: this.stats.evictions,
            memoryEvictions: this.stats.memoryEvictions,
            ageEvictions: this.stats.ageEvictions,
            evictionRate: evictionRate.toFixed(2) + '%',
            
            // 大小统计
            totalSizeAdded: this.formatBytes(this.stats.totalSizeAdded),
            totalSizeEvicted: this.formatBytes(this.stats.totalSizeEvicted),
            averageEntrySize: this.formatBytes(this.stats.averageEntrySize),
            peakMemoryUsage: this.formatBytes(this.stats.peakMemoryUsage),
            currentMemoryUsageFormatted: this.formatBytes(this.currentMemoryUsage),
            
            // 维护统计
            cleanupCount: this.stats.cleanupCount,
            lastCleanupTime: new Date(this.stats.lastCleanupTime).toISOString(),
            
            // 效率指标
            efficiency: this.calculateEfficiency(),
            recommendations: this.getOptimizationRecommendations()
        };
    }

    /**
     * 计算缓存效率
     */
    private calculateEfficiency(): {
        score: number;
        level: 'excellent' | 'good' | 'fair' | 'poor';
        description: string;
    } {
        if (this.stats.totalRequests === 0) {
            return {
                score: 0,
                level: 'poor',
                description: '无缓存活动'
            };
        }

        const hitRate = this.stats.cacheHits / this.stats.totalRequests;
        const score = Math.round(hitRate * 100);

        if (score >= 80) {
            return { score, level: 'excellent', description: '缓存效率优秀' };
        } else if (score >= 60) {
            return { score, level: 'good', description: '缓存效率良好' };
        } else if (score >= 40) {
            return { score, level: 'fair', description: '缓存效率一般' };
        } else {
            return { score, level: 'poor', description: '缓存效率较低' };
        }
    }

    /**
     * 获取优化建议
     */
    private getOptimizationRecommendations(): string[] {
        const recommendations: string[] = [];
        
        const hitRate = this.stats.totalRequests > 0 ? 
            this.stats.cacheHits / this.stats.totalRequests : 0;
        
        if (hitRate < 0.5) {
            recommendations.push('缓存命中率较低，考虑增加缓存大小或调整缓存策略');
        }
        
        if (this.stats.memoryEvictions > this.stats.totalRequests * 0.1) {
            recommendations.push('内存驱逐较频繁，考虑增加最大内存限制');
        }
        
        if (this.stats.ageEvictions > this.stats.totalRequests * 0.2) {
            recommendations.push('过期驱逐较频繁，考虑增加缓存存活时间');
        }
        
        if (this.currentMemoryUsage > this.maxCacheMemory * 0.9) {
            recommendations.push('缓存内存使用接近上限，建议增加内存限制');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('缓存运行良好，无需调整');
        }
        
        return recommendations;
    }

    /**
     * 格式化字节数显示
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
        this.stats = {
            totalRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            evictions: 0,
            memoryEvictions: 0,
            ageEvictions: 0,
            totalSizeAdded: 0,
            totalSizeEvicted: 0,
            averageEntrySize: 0,
            peakMemoryUsage: this.currentMemoryUsage,
            lastCleanupTime: Date.now(),
            cleanupCount: 0
        };
    }
}