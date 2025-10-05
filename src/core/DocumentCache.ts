/**
 * 文档特定缓存管理器
 * 集成VS Code文档版本追踪和自动失效机制
 *
 * 特性:
 * - 文档版本感知
 * - 自动失效过期版本
 * - 监听文档变化事件
 * - 支持URI模式匹配失效
 */

import * as vscode from 'vscode';
import { CacheManager, CacheConfig } from './CacheManager';

/**
 * 文档版本追踪器
 */
export class VersionTracker {
    private versions = new Map<string, number>();
    private disposables: vscode.Disposable[] = [];

    constructor() {
        // 监听文档变化事件
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.track(event.document);
            })
        );

        // 监听文档关闭事件，清理版本信息
        this.disposables.push(
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.versions.delete(document.uri.toString());
            })
        );
    }

    /**
     * 追踪文档版本
     */
    track(document: vscode.TextDocument): void {
        const key = document.uri.toString();
        this.versions.set(key, document.version);
    }

    /**
     * 检查文档是否过期
     */
    isStale(document: vscode.TextDocument): boolean {
        const key = document.uri.toString();
        const cachedVersion = this.versions.get(key);

        // 如果没有缓存版本信息，认为是新文档，不过期
        if (cachedVersion === undefined) {
            return false;
        }

        // 版本号不匹配，说明文档已更新
        return cachedVersion !== document.version;
    }

    /**
     * 获取文档的缓存键
     */
    getKey(document: vscode.TextDocument): string {
        return `${document.uri.toString()}_v${document.version}`;
    }

    /**
     * 清理指定URI的版本信息
     */
    clearVersion(uri: vscode.Uri): void {
        this.versions.delete(uri.toString());
    }

    /**
     * 清理所有版本信息
     */
    clearAll(): void {
        this.versions.clear();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.versions.clear();
    }
}

/**
 * 文档缓存配置
 */
export interface DocumentCacheConfig extends Partial<CacheConfig> {
    /** 是否启用版本追踪 */
    enableVersionTracking?: boolean;
    /** 是否在文档变化时自动失效 */
    autoInvalidateOnChange?: boolean;
}

/**
 * 文档缓存管理器
 */
export class DocumentCache<T> {
    private cacheManager: CacheManager<T>;
    private versionTracker: VersionTracker;
    private config: Required<DocumentCacheConfig>;
    private disposables: vscode.Disposable[] = [];

    constructor(config: DocumentCacheConfig = {}) {
        this.config = {
            maxSize: config.maxSize ?? 50,
            maxMemory: config.maxMemory ?? 10 * 1024 * 1024, // 10MB
            ttl: config.ttl ?? 5 * 60 * 1000, // 5分钟
            cleanupInterval: config.cleanupInterval ?? 60 * 1000, // 1分钟
            enableMonitoring: config.enableMonitoring ?? true,
            enableVersionTracking: config.enableVersionTracking ?? true,
            autoInvalidateOnChange: config.autoInvalidateOnChange ?? true
        };

        this.cacheManager = new CacheManager<T>({
            maxSize: this.config.maxSize,
            maxMemory: this.config.maxMemory,
            ttl: this.config.ttl,
            cleanupInterval: this.config.cleanupInterval,
            enableMonitoring: this.config.enableMonitoring
        });

        this.versionTracker = new VersionTracker();

        if (this.config.autoInvalidateOnChange) {
            this.setupAutoInvalidation();
        }
    }

    /**
     * 获取文档的缓存值
     */
    get(document: vscode.TextDocument): T | undefined {
        if (this.config.enableVersionTracking) {
            // 检查版本是否过期
            if (this.versionTracker.isStale(document)) {
                this.invalidateDocument(document.uri);
                return undefined;
            }

            const key = this.versionTracker.getKey(document);
            return this.cacheManager.get(key);
        } else {
            const key = document.uri.toString();
            return this.cacheManager.get(key);
        }
    }

    /**
     * 设置文档的缓存值
     */
    set(document: vscode.TextDocument, value: T, size?: number): void {
        if (this.config.enableVersionTracking) {
            this.versionTracker.track(document);
            const key = this.versionTracker.getKey(document);
            this.cacheManager.set(key, value, size);
        } else {
            const key = document.uri.toString();
            this.cacheManager.set(key, value, size);
        }
    }

    /**
     * 删除文档的缓存
     */
    delete(document: vscode.TextDocument): boolean {
        const key = this.config.enableVersionTracking
            ? this.versionTracker.getKey(document)
            : document.uri.toString();

        return this.cacheManager.delete(key);
    }

    /**
     * 使指定文档的缓存失效
     */
    invalidateDocument(uri: vscode.Uri): void {
        // 删除所有与该URI相关的缓存条目
        const pattern = new RegExp(`^${this.escapeRegExp(uri.toString())}`);
        this.cacheManager.invalidate(pattern);

        // 清理版本追踪信息
        if (this.config.enableVersionTracking) {
            this.versionTracker.clearVersion(uri);
        }
    }

    /**
     * 使匹配模式的所有文档缓存失效
     */
    invalidatePattern(uriPattern: RegExp): number {
        return this.cacheManager.invalidate(uriPattern);
    }

    /**
     * 清空所有缓存
     */
    clear(): void {
        this.cacheManager.clear();
        if (this.config.enableVersionTracking) {
            this.versionTracker.clearAll();
        }
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        return this.cacheManager.getStats();
    }

    /**
     * 手动触发清理
     */
    cleanup(): void {
        this.cacheManager.cleanup();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.cacheManager.dispose();
        this.versionTracker.dispose();
    }

    // ========== 私有方法 ==========

    /**
     * 设置自动失效机制
     */
    private setupAutoInvalidation(): void {
        // 监听文档变化
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.invalidateDocument(event.document.uri);
            })
        );

        // 监听文档保存（某些场景需要在保存时重新解析）
        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                this.invalidateDocument(document.uri);
            })
        );

        // 监听文档删除
        this.disposables.push(
            vscode.workspace.onDidDeleteFiles((event) => {
                event.files.forEach(uri => {
                    this.invalidateDocument(uri);
                });
            })
        );
    }

    /**
     * 转义正则表达式特殊字符
     */
    private escapeRegExp(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
