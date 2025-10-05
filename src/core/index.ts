/**
 * 核心模块导出
 * 统一导出缓存管理相关的类和接口
 */

// 通用缓存管理器
export type {
    CacheConfig,
    CacheEntry,
    CacheStats,
    EvictionStrategy
} from './CacheManager';

export {
    LRUEvictionStrategy,
    TTLEvictionStrategy,
    MemoryEvictionStrategy,
    CompositeEvictionStrategy,
    CacheManager
} from './CacheManager';

// 文档缓存管理器
export type {
    DocumentCacheConfig
} from './DocumentCache';

export {
    VersionTracker,
    DocumentCache
} from './DocumentCache';

// AST解析缓存
export type {
    ParsedDoc,
    ParseCacheConfig
} from './ParseCache';

export {
    ParseCache,
    getGlobalParseCache,
    getParsed,
    clearParseCache,
    getParserCacheStats,
    disposeParseCache
} from './ParseCache';
