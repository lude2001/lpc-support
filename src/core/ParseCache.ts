/**
 * AST解析结果缓存
 * 替换现有的parseCache实现，提供更强大的缓存能力
 *
 * 特性:
 * - 基于DocumentCache的版本感知缓存
 * - 自动解析和缓存管理
 * - 性能监控和统计
 * - 与现有getParsed接口兼容
 */

import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../antlr/LPCLexer';
import { LPCParser } from '../antlr/LPCParser';
import { CollectingErrorListener } from '../parser/CollectingErrorListener';
import { DocumentCache } from './DocumentCache';

/**
 * 解析结果接口 - 与旧版parseCache.ts保持一致
 */
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

/**
 * 解析缓存配置
 */
export interface ParseCacheConfig {
    /** 最大缓存文档数 */
    maxSize?: number;
    /** 最大内存使用（字节） */
    maxMemory?: number;
    /** 缓存生存时间（毫秒） */
    ttl?: number;
    /** 是否启用性能监控 */
    enableMonitoring?: boolean;
}

/**
 * AST解析缓存管理器
 */
export class ParseCache {
    private documentCache: DocumentCache<ParsedDoc>;
    private parseCount = 0;
    private totalParseTime = 0;

    constructor(config: ParseCacheConfig = {}) {
        // 从VS Code配置读取缓存设置
        const vscodeConfig = vscode.workspace.getConfiguration('lpc.performance');

        this.documentCache = new DocumentCache<ParsedDoc>({
            maxSize: config.maxSize ?? vscodeConfig.get<number>('maxCacheSize', 50),
            maxMemory: config.maxMemory ?? vscodeConfig.get<number>('maxCacheMemory', 10 * 1024 * 1024),
            ttl: config.ttl ?? 5 * 60 * 1000, // 5分钟
            cleanupInterval: 60 * 1000, // 1分钟
            enableMonitoring: config.enableMonitoring ?? true,
            enableVersionTracking: true,
            autoInvalidateOnChange: true
        });
    }

    /**
     * 获取解析结果（主要API）
     */
    getParsed(document: vscode.TextDocument): ParsedDoc {
        // 尝试从缓存获取
        const cached = this.documentCache.get(document);
        if (cached) {
            cached.lastAccessed = Date.now();
            return cached;
        }

        // 缓存未命中，执行解析
        return this.parse(document);
    }

    /**
     * 使指定文档的缓存失效
     */
    invalidate(uri: vscode.Uri): void {
        this.documentCache.invalidateDocument(uri);
    }

    /**
     * 使匹配模式的文档缓存失效
     * @param pattern URI模式，如 /\.h$/ 匹配所有头文件
     */
    invalidatePattern(pattern: RegExp): number {
        return this.documentCache.invalidatePattern(pattern);
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        this.documentCache.clear();
        this.parseCount = 0;
        this.totalParseTime = 0;
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        const cacheStats = this.documentCache.getStats();
        const avgParseTime = this.parseCount > 0 ? this.totalParseTime / this.parseCount : 0;

        return {
            ...cacheStats,
            parseCount: this.parseCount,
            avgParseTime,
            totalParseTime: this.totalParseTime
        };
    }

    /**
     * 手动触发缓存清理
     */
    cleanup(): void {
        this.documentCache.cleanup();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.documentCache.dispose();
    }

    // ========== 私有方法 ==========

    /**
     * 执行实际的解析操作
     */
    private parse(document: vscode.TextDocument): ParsedDoc {
        const startTime = performance.now();
        const text = document.getText();

        try {
            // 创建词法分析器
            const input = CharStreams.fromString(text);
            const lexer = new LPCLexer(input);
            const tokens = new CommonTokenStream(lexer);

            // 创建语法分析器
            const parser = new LPCParser(tokens);

            // 添加错误监听器
            const errorListener = new CollectingErrorListener(document);
            parser.removeErrorListeners();
            parser.addErrorListener(errorListener);

            // 解析源文件
            const tree = parser.sourceFile();

            // 计算解析时间
            const parseTime = performance.now() - startTime;
            this.parseCount++;
            this.totalParseTime += parseTime;

            // 构建解析结果
            const parsed: ParsedDoc = {
                version: document.version,
                tokens,
                tree,
                diagnostics: errorListener.diagnostics,
                lastAccessed: Date.now(),
                parseTime,
                size: text.length
            };

            // 缓存解析结果
            this.documentCache.set(document, parsed, text.length * 2);

            return parsed;
        } catch (error) {
            console.error('Failed to parse document:', error);

            // 返回空的解析结果
            const parseTime = performance.now() - startTime;
            this.parseCount++;
            this.totalParseTime += parseTime;

            const emptyParsed: ParsedDoc = {
                version: document.version,
                tokens: new CommonTokenStream(new LPCLexer(CharStreams.fromString(''))),
                tree: new LPCParser(new CommonTokenStream(new LPCLexer(CharStreams.fromString('')))).sourceFile(),
                diagnostics: [
                    new vscode.Diagnostic(
                        new vscode.Range(0, 0, 0, 1),
                        `Parse error: ${error}`,
                        vscode.DiagnosticSeverity.Error
                    )
                ],
                lastAccessed: Date.now(),
                parseTime,
                size: text.length
            };

            return emptyParsed;
        }
    }
}

// ========== 全局单例实例 ==========

let globalParseCache: ParseCache | null = null;

/**
 * 获取全局解析缓存实例
 */
export function getGlobalParseCache(): ParseCache {
    if (!globalParseCache) {
        globalParseCache = new ParseCache();
    }
    return globalParseCache;
}

/**
 * 兼容旧接口：获取解析结果
 */
export function getParsed(document: vscode.TextDocument): ParsedDoc {
    return getGlobalParseCache().getParsed(document);
}

/**
 * 兼容旧接口：清理解析缓存
 */
export function clearParseCache(): void {
    if (globalParseCache) {
        globalParseCache.clear();
    }
}

/**
 * 兼容旧接口：获取解析器缓存统计
 */
export function getParserCacheStats() {
    if (globalParseCache) {
        return globalParseCache.getStats();
    }
    return {
        size: 0,
        memory: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0,
        avgAccessTime: 0,
        parseCount: 0,
        avgParseTime: 0,
        totalParseTime: 0
    };
}

/**
 * 兼容旧接口：释放解析缓存
 */
export function disposeParseCache(): void {
    if (globalParseCache) {
        globalParseCache.dispose();
        globalParseCache = null;
    }
}
