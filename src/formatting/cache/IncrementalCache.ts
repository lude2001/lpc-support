import * as vscode from 'vscode';

/**
 * 智能缓存增量格式化结果
 */
export class IncrementalCache {
    private cache = new Map<string, {
        version: number;
        ranges: Map<string, { formatted: string; timestamp: number }>;
    }>();

    private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

    /**
     * 获取缓存的格式化结果
     */
    get(document: vscode.TextDocument, range: vscode.Range): string | null {
        const docKey = document.uri.toString();
        const docCache = this.cache.get(docKey);

        if (!docCache || docCache.version !== document.version) {
            return null;
        }

        const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
        const rangeCache = docCache.ranges.get(rangeKey);

        if (!rangeCache) {
            return null;
        }

        // 检查缓存是否过期
        if (Date.now() - rangeCache.timestamp > IncrementalCache.CACHE_TTL) {
            docCache.ranges.delete(rangeKey);
            return null;
        }

        return rangeCache.formatted;
    }

    /**
     * 缓存格式化结果
     */
    set(document: vscode.TextDocument, range: vscode.Range, formatted: string): void {
        const docKey = document.uri.toString();
        let docCache = this.cache.get(docKey);

        if (!docCache || docCache.version !== document.version) {
            docCache = {
                version: document.version,
                ranges: new Map()
            };
            this.cache.set(docKey, docCache);
        }

        const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
        docCache.ranges.set(rangeKey, {
            formatted,
            timestamp: Date.now()
        });

        // 限制缓存大小
        if (docCache.ranges.size > 100) {
            this.cleanupCache(docCache.ranges);
        }
    }

    /**
     * 清理过期缓存
     */
    private cleanupCache(ranges: Map<string, { formatted: string; timestamp: number }>): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (const [key, value] of ranges) {
            if (now - value.timestamp > IncrementalCache.CACHE_TTL) {
                toDelete.push(key);
            }
        }

        toDelete.forEach(key => ranges.delete(key));

        // 如果仍然太大，删除最旧的条目
        if (ranges.size > 50) {
            const entries = Array.from(ranges.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, ranges.size - 50);

            entries.forEach(([key]) => ranges.delete(key));
        }
    }

    /**
     * 清理文档缓存
     */
    clearDocument(document: vscode.TextDocument): void {
        this.cache.delete(document.uri.toString());
    }

    /**
     * 清理所有缓存
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * 获取缓存统计信息
     */
    getStats(): {
        documentsCount: number;
        totalRanges: number;
        memoryUsage: number;
    } {
        let totalRanges = 0;
        let memoryUsage = 0;

        for (const docCache of this.cache.values()) {
            totalRanges += docCache.ranges.size;
            for (const rangeCache of docCache.ranges.values()) {
                memoryUsage += rangeCache.formatted.length * 2; // 估算字符串内存使用
            }
        }

        return {
            documentsCount: this.cache.size,
            totalRanges,
            memoryUsage
        };
    }
}