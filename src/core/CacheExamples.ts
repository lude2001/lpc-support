/**
 * 缓存系统使用示例
 * 展示如何在实际场景中使用统一缓存管理器
 */

import * as vscode from 'vscode';
import { CacheManager } from './CacheManager';
import { DocumentCache } from './DocumentCache';
import { ParseCache, getParsed } from './ParseCache';

// ============================================================
// 示例1: 基础缓存使用 - Include文件列表缓存
// ============================================================

export class IncludeFileManager {
    // 使用通用缓存管理器
    private includeCache = new CacheManager<string[]>({
        maxSize: 100,
        ttl: 5 * 60 * 1000, // 5分钟
        enableMonitoring: true
    });

    /**
     * 获取文件的include列表（带缓存）
     */
    async getIncludeFiles(filePath: string): Promise<string[]> {
        // 检查缓存
        const cached = this.includeCache.get(filePath);
        if (cached) {
            return cached;
        }

        // 缓存未命中，解析文件
        const includes = await this.parseIncludeFiles(filePath);

        // 存入缓存
        this.includeCache.set(filePath, includes);

        return includes;
    }

    /**
     * 文件变化时失效缓存
     */
    invalidateFile(filePath: string): void {
        this.includeCache.delete(filePath);
    }

    /**
     * 失效所有头文件缓存
     */
    invalidateAllHeaders(): void {
        const count = this.includeCache.invalidate(/\.h$/);
        console.log(`Invalidated ${count} header file caches`);
    }

    private async parseIncludeFiles(filePath: string): Promise<string[]> {
        // 实际��解析逻辑
        return [];
    }
}

// ============================================================
// 示例2: 文档缓存使用 - 符号表缓存
// ============================================================

export interface SymbolTable {
    symbols: Map<string, Symbol>;
    version: number;
}

export class SymbolTableManager {
    // 使用文档缓存（自动处理版本追踪）
    private symbolCache = new DocumentCache<SymbolTable>({
        maxSize: 50,
        ttl: 10 * 60 * 1000, // 10分钟
        enableVersionTracking: true,
        autoInvalidateOnChange: true
    });

    /**
     * 获取文档的符号表（自动缓存和版本管理）
     */
    getSymbolTable(document: vscode.TextDocument): SymbolTable {
        // 检查缓存（自动检查版本）
        const cached = this.symbolCache.get(document);
        if (cached) {
            return cached;
        }

        // 缓存未命中，构建符号表
        const symbolTable = this.buildSymbolTable(document);

        // 存入缓存（自动关联版本号）
        this.symbolCache.set(document, symbolTable);

        return symbolTable;
    }

    /**
     * 手动失效指定文档缓存
     */
    invalidateDocument(uri: vscode.Uri): void {
        this.symbolCache.invalidateDocument(uri);
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        return this.symbolCache.getStats();
    }

    private buildSymbolTable(document: vscode.TextDocument): SymbolTable {
        // 实际的符号表构建逻辑
        return {
            symbols: new Map(),
            version: document.version
        };
    }

    dispose(): void {
        this.symbolCache.dispose();
    }
}

// ============================================================
// 示例3: 解析缓存使用 - AST Manager
// ============================================================

export class ASTManager {
    private parseCache: ParseCache;

    constructor() {
        this.parseCache = new ParseCache({
            maxSize: 50,
            maxMemory: 10 * 1024 * 1024,
            enableMonitoring: true
        });
    }

    /**
     * 获取文档的AST（自动缓存）
     */
    getAST(document: vscode.TextDocument) {
        const { tree, diagnostics } = this.parseCache.getParsed(document);
        return { tree, diagnostics };
    }

    /**
     * 使用全局解析缓存（更简单）
     */
    getASTSimple(document: vscode.TextDocument) {
        return getParsed(document);
    }

    /**
     * 失效指定文件的AST缓存
     */
    invalidateAST(uri: vscode.Uri): void {
        this.parseCache.invalidate(uri);
    }

    /**
     * 失效所有头文件的AST缓存
     */
    invalidateAllHeaders(): void {
        const count = this.parseCache.invalidatePattern(/\.h$/);
        console.log(`Invalidated ${count} header AST caches`);
    }

    /**
     * 获取解析统计
     */
    getParseStats() {
        return this.parseCache.getStats();
    }

    dispose(): void {
        this.parseCache.dispose();
    }
}

// ============================================================
// 示例4: 多层缓存架构 - 定义跳转Provider
// ============================================================

export class DefinitionProviderWithCache implements vscode.DefinitionProvider {
    // 第一层：函数定义位置缓存
    private functionDefCache = new CacheManager<vscode.Location>({
        maxSize: 200,
        ttl: 10 * 60 * 1000
    });

    // 第二层：头文件函数索引缓存
    private headerIndexCache = new CacheManager<Map<string, vscode.Location>>({
        maxSize: 50,
        ttl: 15 * 60 * 1000
    });

    // 第三层：Include文件列表缓存
    private includeListCache = new CacheManager<string[]>({
        maxSize: 100,
        ttl: 5 * 60 * 1000
    });

    constructor() {
        // 监听文件变化，自动失效相关缓存
        vscode.workspace.onDidChangeTextDocument(event => {
            this.handleDocumentChange(event);
        });
    }

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location | undefined> {
        const word = document.getText(document.getWordRangeAtPosition(position));
        const cacheKey = `${document.uri.toString()}::${word}`;

        // 第一层缓存：检查函数定义缓存
        const cached = this.functionDefCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 查找定义
        const location = await this.findDefinition(document, word);

        // 存入缓存
        if (location) {
            this.functionDefCache.set(cacheKey, location);
        }

        return location;
    }

    private async findDefinition(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<vscode.Location | undefined> {
        // 获取include文件列表（使用第三层缓存）
        const includes = await this.getIncludeFiles(document);

        // 在include文件中查找（使用第二层缓存）
        for (const includeFile of includes) {
            const headerIndex = await this.getHeaderIndex(includeFile);
            const location = headerIndex.get(functionName);
            if (location) {
                return location;
            }
        }

        return undefined;
    }

    private async getIncludeFiles(document: vscode.TextDocument): Promise<string[]> {
        const cacheKey = document.uri.toString();

        // 检查缓存
        const cached = this.includeListCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 解析include文件
        const includes: string[] = []; // 实际解析逻辑
        this.includeListCache.set(cacheKey, includes);

        return includes;
    }

    private async getHeaderIndex(filePath: string): Promise<Map<string, vscode.Location>> {
        // 检查缓存
        const cached = this.headerIndexCache.get(filePath);
        if (cached) {
            return cached;
        }

        // 构建索引
        const index = new Map<string, vscode.Location>(); // 实际索引逻辑
        this.headerIndexCache.set(filePath, index);

        return index;
    }

    private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        const filePath = event.document.uri.fsPath;

        if (filePath.endsWith('.h')) {
            // 头文件变化：失效头文件索引
            this.headerIndexCache.delete(filePath);

            // 失效所有依赖此头文件的include列表缓存
            this.includeListCache.invalidate(new RegExp(filePath));
        } else {
            // 源文件变化：失效该文件的缓存
            this.functionDefCache.invalidate(
                new RegExp(`^${event.document.uri.toString()}::`)
            );
            this.includeListCache.delete(event.document.uri.toString());
        }
    }
}

// ============================================================
// 示例5: 性能监控和优化
// ============================================================

export class CacheMonitor {
    private caches: Map<string, CacheManager<any>> = new Map();

    registerCache(name: string, cache: CacheManager<any>): void {
        this.caches.set(name, cache);
    }

    /**
     * 显示所有缓存的统计信息
     */
    showStats(): void {
        const output = vscode.window.createOutputChannel('LPC Cache Stats');
        output.clear();
        output.show();

        output.appendLine('=== LPC Cache Statistics ===\n');

        for (const [name, cache] of Array.from(this.caches.entries())) {
            const stats = cache.getStats();

            output.appendLine(`${name}:`);
            output.appendLine(`  Size: ${stats.size}`);
            output.appendLine(`  Memory: ${(stats.memory / 1024).toFixed(2)} KB`);
            output.appendLine(`  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
            output.appendLine(`  Hits: ${stats.hits}`);
            output.appendLine(`  Misses: ${stats.misses}`);
            output.appendLine(`  Evictions: ${stats.evictions}`);
            output.appendLine(`  Avg Access Time: ${stats.avgAccessTime.toFixed(3)} ms`);
            output.appendLine('');
        }
    }

    /**
     * 检查缓存健康状况
     */
    checkHealth(): void {
        for (const [name, cache] of Array.from(this.caches.entries())) {
            const stats = cache.getStats();

            // 命中率过低警告
            if (stats.hitRate < 0.7) {
                vscode.window.showWarningMessage(
                    `Cache "${name}" has low hit rate: ${(stats.hitRate * 100).toFixed(2)}%`
                );
            }

            // 驱逐频繁警告
            if (stats.evictions > stats.hits * 0.5) {
                vscode.window.showWarningMessage(
                    `Cache "${name}" has high eviction rate. Consider increasing cache size.`
                );
            }
        }
    }

    /**
     * 清理所有缓存
     */
    clearAll(): void {
        for (const cache of Array.from(this.caches.values())) {
            cache.clear();
        }
        vscode.window.showInformationMessage('All caches cleared');
    }
}

// ============================================================
// 示例6: VS Code命令集成
// ============================================================

export function registerCacheCommands(context: vscode.ExtensionContext, monitor: CacheMonitor): void {
    // 显示缓存统计
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.showCacheStats', () => {
            monitor.showStats();
        })
    );

    // 检查缓存健康
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.checkCacheHealth', () => {
            monitor.checkHealth();
        })
    );

    // 清理所有缓存
    context.subscriptions.push(
        vscode.commands.registerCommand('lpc.clearAllCaches', () => {
            monitor.clearAll();
        })
    );
}

// ============================================================
// 示例7: 完整集成示例
// ============================================================

export class LPCExtension {
    private astManager: ASTManager;
    private symbolTableManager: SymbolTableManager;
    private includeFileManager: IncludeFileManager;
    private cacheMonitor: CacheMonitor;

    constructor(context: vscode.ExtensionContext) {
        // 初始化各个管理器
        this.astManager = new ASTManager();
        this.symbolTableManager = new SymbolTableManager();
        this.includeFileManager = new IncludeFileManager();
        this.cacheMonitor = new CacheMonitor();

        // 注册缓存到监控器
        // this.cacheMonitor.registerCache('AST', this.astManager['parseCache']);
        // this.cacheMonitor.registerCache('Symbols', this.symbolTableManager['symbolCache']);
        // this.cacheMonitor.registerCache('Includes', this.includeFileManager['includeCache']);

        // 注册命令
        registerCacheCommands(context, this.cacheMonitor);

        // 定期健康检查
        setInterval(() => {
            this.cacheMonitor.checkHealth();
        }, 5 * 60 * 1000); // 每5分钟检查一次
    }

    dispose(): void {
        this.astManager.dispose();
        this.symbolTableManager.dispose();
        this.cacheMonitor.clearAll();
    }
}
