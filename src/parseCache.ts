import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from './antlr/LPCLexer';
import { LPCParser } from './antlr/LPCParser';
import * as vscode from 'vscode';
import { CollectingErrorListener } from './parser/CollectingErrorListener';

export interface ParsedDoc {
    version: number;
    tokens: CommonTokenStream;
    tree: ReturnType<LPCParser['sourceFile']>;
    diagnostics: vscode.Diagnostic[];
    // 性能优化相关字段
    lastAccessed: number;
    parseTime: number;
    size: number; // 文档大小（字符数）
}

interface CacheConfig {
    maxSize: number;       // 最大缓存条目数
    maxMemory: number;     // 最大内存使用（字符数）
    ttl: number;          // 生存时间（毫秒）
    cleanupInterval: number; // 清理间隔（毫秒）
}

class EnhancedParseCache {
    private cache = new Map<string, ParsedDoc>();
    private config: CacheConfig = {
        maxSize: 50,           // 最多缓存50个文档
        maxMemory: 5000000,    // 最多5MB字符
        ttl: 300000,          // 5分钟TTL
        cleanupInterval: 60000 // 1分钟清理一次
    };
    private totalMemory = 0;
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.startCleanupTimer();
    }

    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    private cleanup(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];
        
        // 移除过期的缓存项
        for (const [key, parsed] of this.cache.entries()) {
            if (now - parsed.lastAccessed > this.config.ttl) {
                keysToDelete.push(key);
            }
        }
        
        // 删除过期项
        for (const key of keysToDelete) {
            this.delete(key);
        }
        
        // 如果缓存仍然过大，删除最旧的项
        while (this.cache.size > this.config.maxSize || this.totalMemory > this.config.maxMemory) {
            const oldestKey = this.findOldestKey();
            if (oldestKey) {
                this.delete(oldestKey);
            } else {
                break;
            }
        }
    }

    private findOldestKey(): string | null {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();
        
        for (const [key, parsed] of this.cache.entries()) {
            if (parsed.lastAccessed < oldestTime) {
                oldestTime = parsed.lastAccessed;
                oldestKey = key;
            }
        }
        
        return oldestKey;
    }

    private delete(key: string): void {
        const parsed = this.cache.get(key);
        if (parsed) {
            this.totalMemory -= parsed.size;
            this.cache.delete(key);
        }
    }

    get(document: vscode.TextDocument): ParsedDoc | undefined {
        const key = document.uri.toString();
        const existing = this.cache.get(key);
        
        if (existing && existing.version === document.version) {
            // 更新访问时间
            existing.lastAccessed = Date.now();
            return existing;
        }
        
        return undefined;
    }

    set(document: vscode.TextDocument, parsed: ParsedDoc): void {
        const key = document.uri.toString();
        
        // 如果已存在，先删除旧的
        if (this.cache.has(key)) {
            this.delete(key);
        }
        
        // 添加新的缓存项
        this.cache.set(key, parsed);
        this.totalMemory += parsed.size;
        
        // 立即检查是否需要清理
        if (this.cache.size > this.config.maxSize || this.totalMemory > this.config.maxMemory) {
            this.cleanup();
        }
    }

    clear(): void {
        this.cache.clear();
        this.totalMemory = 0;
    }

    dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.clear();
    }

    // 获取缓存统计信息
    getStats(): { size: number; memory: number; hitRate?: number } {
        return {
            size: this.cache.size,
            memory: this.totalMemory
        };
    }
}

const enhancedCache = new EnhancedParseCache();

export function getParsed(document: vscode.TextDocument): ParsedDoc {
    // 尝试从增强缓存获取
    const cached = enhancedCache.get(document);
    if (cached) {
        return cached;
    }

    const startTime = Date.now();
    const text = document.getText();
    
    const input = CharStreams.fromString(text);
    const lexer = new LPCLexer(input);
    const tokens = new CommonTokenStream(lexer);
    const parser = new LPCParser(tokens);

    // Attach error listener to collect syntax errors
    const errorListener = new CollectingErrorListener(document);
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    const tree = parser.sourceFile();
    const parseTime = Date.now() - startTime;
    
    const parsed: ParsedDoc = { 
        version: document.version, 
        tokens, 
        tree, 
        diagnostics: errorListener.diagnostics,
        lastAccessed: Date.now(),
        parseTime,
        size: text.length
    };
    
    enhancedCache.set(document, parsed);
    return parsed;
}

// 导出缓存实例用于清理
export function clearParseCache(): void {
    enhancedCache.clear();
}

export function getParserCacheStats(): { size: number; memory: number } {
    return enhancedCache.getStats();
}

// 在插件停用时清理缓存
export function disposeParseCache(): void {
    enhancedCache.dispose();
} 