import { FormattingResult } from '../config/FormattingConfig';
import * as vscode from 'vscode';

/**
 * 格式化缓存项
 */
interface FormattingCacheEntry {
    documentVersion: number;
    contentHash: string;
    result: FormattingResult;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
}

/**
 * 格式化缓存配置
 */
interface FormattingCacheConfig {
    maxSize: number;           // 最大缓存条目数
    maxAge: number;           // 最大存在时间（毫秒）
    maxMemoryUsage: number;   // 最大内存使用（字节）
    cleanupInterval: number;  // 清理间隔（毫秒）
}

/**
 * LPC 格式化缓存管理器
 */
export class FormattingCache {
    private cache = new Map<string, FormattingCacheEntry>();
    private config: FormattingCacheConfig;
    private currentMemoryUsage = 0;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        cleanups: 0
    };

    constructor(config?: Partial<FormattingCacheConfig>) {
        this.config = {
            maxSize: 100,
            maxAge: 10 * 60 * 1000, // 10分钟
            maxMemoryUsage: 10 * 1024 * 1024, // 10MB
            cleanupInterval: 2 * 60 * 1000, // 2分钟
            ...config
        };
        
        this.startCleanupTimer();
    }

    /**
     * 获取缓存的格式化结果
     */
    get(document: vscode.TextDocument): FormattingResult | undefined {
        const key = this.generateKey(document);
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        
        // 检查版本是否匹配
        if (entry.documentVersion !== document.version) {
            this.cache.delete(key);
            this.updateMemoryUsage(entry, false);
            this.stats.misses++;
            return undefined;
        }
        
        // 检查是否过期
        const now = Date.now();
        if (now - entry.timestamp > this.config.maxAge) {
            this.cache.delete(key);
            this.updateMemoryUsage(entry, false);
            this.stats.misses++;
            return undefined;
        }
        
        // 更新访问统计
        entry.accessCount++;
        entry.lastAccessed = now;
        this.stats.hits++;
        
        return entry.result;
    }

    /**
     * 存储格式化结果到缓存
     */
    set(document: vscode.TextDocument, result: FormattingResult): void {
        const key = this.generateKey(document);
        const now = Date.now();
        
        const entry: FormattingCacheEntry = {
            documentVersion: document.version,
            contentHash: this.generateContentHash(document.getText()),
            result,
            timestamp: now,
            accessCount: 1,
            lastAccessed: now
        };
        
        // 检查是否已存在
        const existingEntry = this.cache.get(key);
        if (existingEntry) {
            this.updateMemoryUsage(existingEntry, false);
        }
        
        // 检查缓存大小限制
        if (this.cache.size >= this.config.maxSize) {
            this.evictLeastRecentlyUsed();
        }
        
        // 检查内存使用限制
        const entrySize = this.estimateEntrySize(entry);
        if (this.currentMemoryUsage + entrySize > this.config.maxMemoryUsage) {
            this.evictByMemoryPressure(entrySize);
        }
        
        this.cache.set(key, entry);
        this.updateMemoryUsage(entry, true);
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
        this.currentMemoryUsage = 0;
        this.resetStats();
    }

    /**
     * 删除特定文档的缓存
     */
    delete(document: vscode.TextDocument): boolean {
        const key = this.generateKey(document);
        const entry = this.cache.get(key);
        
        if (entry) {
            this.cache.delete(key);
            this.updateMemoryUsage(entry, false);
            return true;
        }
        
        return false;
    }

    /**
     * 检查缓存是否包含指定文档
     */
    has(document: vscode.TextDocument): boolean {
        const key = this.generateKey(document);
        const entry = this.cache.get(key);
        
        if (!entry) {
            return false;
        }
        
        // 检查版本和过期时间
        const now = Date.now();
        return entry.documentVersion === document.version && 
               (now - entry.timestamp) <= this.config.maxAge;
    }

    /**
     * 获取缓存统计信息
     */
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        hitRate: number;
        evictions: number;
        cleanups: number;
        memoryUsage: number;
        maxMemoryUsage: number;
    } {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
        
        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate,
            evictions: this.stats.evictions,
            cleanups: this.stats.cleanups,
            memoryUsage: this.currentMemoryUsage,
            maxMemoryUsage: this.config.maxMemoryUsage
        };
    }

    /**
     * 更新缓存配置
     */
    updateConfig(config: Partial<FormattingCacheConfig>): void {
        this.config = { ...this.config, ...config };
        
        // 如果清理间隔发生变化，重启定时器
        if (config.cleanupInterval !== undefined) {
            this.stopCleanupTimer();
            this.startCleanupTimer();
        }
        
        // 如果限制变小，立即清理
        if (config.maxSize !== undefined && this.cache.size > config.maxSize) {
            this.cleanup();
        }
        
        if (config.maxMemoryUsage !== undefined && this.currentMemoryUsage > config.maxMemoryUsage) {
            this.evictByMemoryPressure(0);
        }
    }

    /**
     * 销毁缓存
     */
    dispose(): void {
        this.stopCleanupTimer();
        this.clear();
    }

    /**
     * 生成缓存键
     */
    private generateKey(document: vscode.TextDocument): string {
        return document.uri.toString();
    }

    /**
     * 生成内容哈希
     */
    private generateContentHash(content: string): string {
        // 简单的哈希函数，实际项目中可能需要更复杂的实现
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    /**
     * 估算缓存项的内存使用量
     */
    private estimateEntrySize(entry: FormattingCacheEntry): number {
        // 粗略估算内存使用量
        const resultSize = entry.result.formattedText ? entry.result.formattedText.length * 2 : 0; // UTF-16
        const errorsSize = entry.result.errors ? entry.result.errors.join('').length * 2 : 0;
        const warningsSize = entry.result.warnings ? entry.result.warnings.join('').length * 2 : 0;
        const hashSize = entry.contentHash.length * 2;
        const metadataSize = 64; // 固定开销
        
        return resultSize + errorsSize + warningsSize + hashSize + metadataSize;
    }

    /**
     * 更新内存使用统计
     */
    private updateMemoryUsage(entry: FormattingCacheEntry, isAdding: boolean): void {
        const size = this.estimateEntrySize(entry);
        if (isAdding) {
            this.currentMemoryUsage += size;
        } else {
            this.currentMemoryUsage -= size;
            this.currentMemoryUsage = Math.max(0, this.currentMemoryUsage);
        }
    }

    /**
     * 逐出最近最少使用的项
     */
    private evictLeastRecentlyUsed(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            const entry = this.cache.get(oldestKey);
            if (entry) {
                this.cache.delete(oldestKey);
                this.updateMemoryUsage(entry, false);
                this.stats.evictions++;
            }
        }
    }

    /**
     * 按内存压力逐出项
     */
    private evictByMemoryPressure(requiredSpace: number): void {
        const targetUsage = this.config.maxMemoryUsage - requiredSpace;
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        for (const [key, entry] of entries) {
            if (this.currentMemoryUsage <= targetUsage) {
                break;
            }
            
            this.cache.delete(key);
            this.updateMemoryUsage(entry, false);
            this.stats.evictions++;
        }
    }

    /**
     * 启动定时清理
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * 停止定时清理
     */
    private stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * 清理过期和无效的缓存项
     */
    private cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.maxAge) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            const entry = this.cache.get(key);
            if (entry) {
                this.cache.delete(key);
                this.updateMemoryUsage(entry, false);
            }
        }
        
        this.stats.cleanups++;
    }

    /**
     * 重置统计信息
     */
    private resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            cleanups: 0
        };
    }
}