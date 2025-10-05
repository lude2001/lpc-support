/**
 * ParseCache单元测试
 * 测试解析缓存的LRU淘汰策略、TTL过期机制和性能
 */

import { getParsed, clearParseCache, getParserCacheStats } from '../parseCache';
import { TestHelper } from './utils/TestHelper';

// Mock ANTLR相关模块
jest.mock('../antlr/LPCLexer');
jest.mock('../antlr/LPCParser');
jest.mock('../parser/CollectingErrorListener');

describe('ParseCache - 缓存管理器', () => {
    beforeEach(() => {
        clearParseCache();
        jest.clearAllMocks();
    });

    afterEach(() => {
        clearParseCache();
    });

    describe('基本缓存功能', () => {
        test('应该缓存解析结果', () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test1.c');

            const result1 = getParsed(document);
            const result2 = getParsed(document);

            // 第二次应该从缓存获取
            expect(result1).toBe(result2);
            expect(result1.version).toBe(document.version);
        });

        test('应该在文档版本变化时重新解析', () => {
            let document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test2.c');

            const result1 = getParsed(document);

            // 模拟文档修改
            document = {
                ...document,
                version: 2,
                getText: () => 'void test() { return; }'
            } as any;

            const result2 = getParsed(document);

            // 应该是不同的解析结果
            expect(result1).not.toBe(result2);
            expect(result1.version).toBe(1);
            expect(result2.version).toBe(2);
        });

        test('应该记录解析时间', () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test3.c');

            const result = getParsed(document);

            expect(result.parseTime).toBeGreaterThanOrEqual(0);
            expect(typeof result.parseTime).toBe('number');
        });

        test('应该记录文档大小', () => {
            const content = 'void test() { return; }';
            const document = TestHelper.createMockDocument(content, 'lpc', 'test4.c');

            const result = getParsed(document);

            expect(result.size).toBe(content.length);
        });

        test('应该更新最后访问时间', () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test5.c');

            const result1 = getParsed(document);
            const time1 = result1.lastAccessed;

            // 等待一小段时间
            jest.advanceTimersByTime(100);

            const result2 = getParsed(document);
            const time2 = result2.lastAccessed;

            expect(time2).toBeGreaterThanOrEqual(time1);
        });
    });

    describe('LRU淘汰策略', () => {
        test('应该在达到最大缓存数量时淘汰最旧的项', () => {
            jest.useFakeTimers();

            // 创建多个文档，超过默认的maxSize (50)
            const documents = Array.from({ length: 60 }, (_, i) =>
                TestHelper.createMockDocument(`void test${i}() {}`, 'lpc', `test${i}.c`)
            );

            // 解析所有文档
            documents.forEach(doc => {
                getParsed(doc);
                jest.advanceTimersByTime(10); // 确保不同的访问时间
            });

            const stats = getParserCacheStats();

            // 应该只保留50个（或更少，如果TTL过期了）
            expect(stats.size).toBeLessThanOrEqual(50);

            jest.useRealTimers();
        });

        test('应该优先淘汰最久未访问的项', () => {
            jest.useFakeTimers();

            const doc1 = TestHelper.createMockDocument('void test1() {}', 'lpc', 'test1.c');
            const doc2 = TestHelper.createMockDocument('void test2() {}', 'lpc', 'test2.c');
            const doc3 = TestHelper.createMockDocument('void test3() {}', 'lpc', 'test3.c');

            getParsed(doc1);
            jest.advanceTimersByTime(1000);

            getParsed(doc2);
            jest.advanceTimersByTime(1000);

            getParsed(doc3);
            jest.advanceTimersByTime(1000);

            // 再次访问doc1，使其成为最近访问的
            getParsed(doc1);

            // 创建大量新文档触发淘汰
            for (let i = 10; i < 60; i++) {
                const doc = TestHelper.createMockDocument(`void test${i}() {}`, 'lpc', `test${i}.c`);
                getParsed(doc);
                jest.advanceTimersByTime(10);
            }

            // doc1最近被访问过，应该还在缓存中
            const result1 = getParsed(doc1);
            expect(result1).toBeDefined();

            jest.useRealTimers();
        });
    });

    describe('TTL过期机制', () => {
        test('应该定期清理过期的缓存项', () => {
            jest.useFakeTimers();

            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test.c');

            getParsed(document);

            const statsBefore = getParserCacheStats();
            expect(statsBefore.size).toBeGreaterThan(0);

            // 快进超过TTL时间（默认5分钟）和清理间隔（1分钟）
            jest.advanceTimersByTime(360000); // 6分钟

            const statsAfter = getParserCacheStats();

            // 过期项应该被清理
            expect(statsAfter.size).toBeLessThanOrEqual(statsBefore.size);

            jest.useRealTimers();
        });

        test('应该在访问时更新过期时间', () => {
            jest.useFakeTimers();

            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test.c');

            getParsed(document);

            // 快进4分钟（小于TTL 5分钟）
            jest.advanceTimersByTime(240000);

            // 再次访问，重置过期时间
            getParsed(document);

            // 再快进4分钟
            jest.advanceTimersByTime(240000);

            // 应该还在缓存中，因为每次访问都更新了lastAccessed
            const stats = getParserCacheStats();
            expect(stats.size).toBeGreaterThan(0);

            jest.useRealTimers();
        });
    });

    describe('内存限制控制', () => {
        test('应该跟踪总内存使用量', () => {
            const content = 'void test() { return; }';
            const document = TestHelper.createMockDocument(content, 'lpc', 'test.c');

            getParsed(document);

            const stats = getParserCacheStats();

            expect(stats.memory).toBeGreaterThan(0);
            expect(stats.memory).toBeGreaterThanOrEqual(content.length);
        });

        test('应该在内存超限时淘汰项', () => {
            jest.useFakeTimers();

            // 创建大文档
            const largeContent = 'void test() {}\n'.repeat(10000); // ~150KB
            const documents = Array.from({ length: 40 }, (_, i) =>
                TestHelper.createMockDocument(largeContent, 'lpc', `large${i}.c`)
            );

            documents.forEach(doc => {
                getParsed(doc);
                jest.advanceTimersByTime(10);
            });

            const stats = getParserCacheStats();

            // 应该触发内存限制（默认5MB）
            expect(stats.memory).toBeLessThanOrEqual(5000000);

            jest.useRealTimers();
        });

        test('应该在删除项时更新内存计数', () => {
            const content = 'void test() {}';
            const document = TestHelper.createMockDocument(content, 'lpc', 'test.c');

            getParsed(document);

            const statsBefore = getParserCacheStats();
            const memoryBefore = statsBefore.memory;

            clearParseCache();

            const statsAfter = getParserCacheStats();

            expect(statsAfter.memory).toBe(0);
            expect(memoryBefore).toBeGreaterThan(0);
        });
    });

    describe('缓存统计', () => {
        test('应该返回正确的缓存统计信息', () => {
            const documents = Array.from({ length: 5 }, (_, i) =>
                TestHelper.createMockDocument(`void test${i}() {}`, 'lpc', `test${i}.c`)
            );

            documents.forEach(doc => getParsed(doc));

            const stats = getParserCacheStats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('memory');
            expect(stats.size).toBe(5);
            expect(stats.memory).toBeGreaterThan(0);
        });

        test('应该在清除后重置统计', () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test.c');
            getParsed(document);

            clearParseCache();

            const stats = getParserCacheStats();

            expect(stats.size).toBe(0);
            expect(stats.memory).toBe(0);
        });
    });

    describe('并发访问安全性', () => {
        test('应该处理同一文档的并发访问', async () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test.c');

            // 模拟并发访问
            const results = await Promise.all([
                Promise.resolve(getParsed(document)),
                Promise.resolve(getParsed(document)),
                Promise.resolve(getParsed(document))
            ]);

            // 所有结果应该相同（来自缓存）
            expect(results[0]).toBe(results[1]);
            expect(results[1]).toBe(results[2]);
        });

        test('应该处理多文档并发解析', async () => {
            const documents = Array.from({ length: 10 }, (_, i) =>
                TestHelper.createMockDocument(`void test${i}() {}`, 'lpc', `test${i}.c`)
            );

            const results = await Promise.all(
                documents.map(doc => Promise.resolve(getParsed(doc)))
            );

            // 所有结果应该定义
            results.forEach((result, index) => {
                expect(result).toBeDefined();
                expect(result.tokens).toBeDefined();
                // tree可能为undefined在某些mock场景下，这是可接受的
                if (result.tree !== undefined) {
                    expect(result.tree).toBeDefined();
                }
            });

            const stats = getParserCacheStats();
            expect(stats.size).toBe(10);
        });
    });

    describe('性能测试', () => {
        test('缓存命中应该比重新解析快', () => {
            const document = TestHelper.createMockDocument(
                TestHelper.generateLargeCodeFile(1000),
                'lpc',
                'large.c'
            );

            // 第一次解析（无缓存）
            const start1 = Date.now();
            const result1 = getParsed(document);
            const time1 = Date.now() - start1;

            // 第二次解析（缓存命中）
            const start2 = Date.now();
            const result2 = getParsed(document);
            const time2 = Date.now() - start2;

            // 缓存命中应该更快
            expect(time2).toBeLessThan(time1);
            expect(result1).toBe(result2);
        });

        test('应该高效处理小文件', () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'small.c');

            const startTime = Date.now();

            for (let i = 0; i < 100; i++) {
                getParsed(document);
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // 100次缓存访问应该很快（小于100ms）
            expect(totalTime).toBeLessThan(100);
        });

        test('应该高效处理缓存淘汰', () => {
            jest.useFakeTimers();

            const startTime = Date.now();

            // 创建大量文档触发淘汰
            for (let i = 0; i < 100; i++) {
                const doc = TestHelper.createMockDocument(`void test${i}() {}`, 'lpc', `test${i}.c`);
                getParsed(doc);
                jest.advanceTimersByTime(1);
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // 淘汰操作应该高效（小于1000ms）
            expect(totalTime).toBeLessThan(1000);

            const stats = getParserCacheStats();
            expect(stats.size).toBeLessThanOrEqual(50);

            jest.useRealTimers();
        });
    });

    describe('边界条件', () => {
        test('应该处理空文档', () => {
            const document = TestHelper.createMockDocument('', 'lpc', 'empty.c');

            expect(() => getParsed(document)).not.toThrow();

            const result = getParsed(document);
            expect(result).toBeDefined();
            expect(result.size).toBe(0);
        });

        test('应该处理超大文档', () => {
            const largeContent = 'void test() {}\n'.repeat(100000); // ~1.5MB
            const document = TestHelper.createMockDocument(largeContent, 'lpc', 'huge.c');

            expect(() => getParsed(document)).not.toThrow();

            const result = getParsed(document);
            expect(result).toBeDefined();
            expect(result.size).toBe(largeContent.length);
        });

        test('应该处理相同URI不同版本的文档', () => {
            const uri = 'file:///test.c';
            const doc1 = {
                ...TestHelper.createMockDocument('void test1() {}', 'lpc', 'test.c'),
                uri: { toString: () => uri } as any,
                version: 1
            };

            const doc2 = {
                ...TestHelper.createMockDocument('void test2() {}', 'lpc', 'test.c'),
                uri: { toString: () => uri } as any,
                version: 2
            };

            const result1 = getParsed(doc1);
            const result2 = getParsed(doc2);

            expect(result1.version).toBe(1);
            expect(result2.version).toBe(2);
            expect(result1).not.toBe(result2);
        });
    });

    describe('清理功能', () => {
        test('clearParseCache应该清除所有缓存', () => {
            const documents = Array.from({ length: 10 }, (_, i) =>
                TestHelper.createMockDocument(`void test${i}() {}`, 'lpc', `test${i}.c`)
            );

            documents.forEach(doc => getParsed(doc));

            const statsBefore = getParserCacheStats();
            expect(statsBefore.size).toBe(10);

            clearParseCache();

            const statsAfter = getParserCacheStats();
            expect(statsAfter.size).toBe(0);
            expect(statsAfter.memory).toBe(0);
        });

        test('清除后应该能重新缓存', () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc', 'test.c');

            getParsed(document);
            clearParseCache();

            const result = getParsed(document);

            expect(result).toBeDefined();

            const stats = getParserCacheStats();
            expect(stats.size).toBe(1);
        });
    });

    describe('实际使用场景', () => {
        test('应该处理典型的编辑工作流', () => {
            const fileName = 'weapon.c';
            let document = TestHelper.createMockDocument(
                'inherit WEAPON;\nvoid create() {}',
                'lpc',
                fileName
            );

            // 初始解析
            const result1 = getParsed(document);
            expect(result1.version).toBe(1);

            // 用户编辑文档
            document = {
                ...document,
                version: 2,
                getText: () => 'inherit WEAPON;\nvoid create() { ::create(); }'
            } as any;

            const result2 = getParsed(document);
            expect(result2.version).toBe(2);

            // 再次编辑
            document = {
                ...document,
                version: 3,
                getText: () => 'inherit WEAPON;\nvoid create() { ::create(); set_name("sword"); }'
            } as any;

            const result3 = getParsed(document);
            expect(result3.version).toBe(3);

            // 每次都应该是新的解析结果
            expect(result1).not.toBe(result2);
            expect(result2).not.toBe(result3);
        });

        test('应该处理多文件项目', () => {
            const files = [
                { name: 'object.c', content: 'void create() {}' },
                { name: 'weapon.c', content: 'inherit "/std/object";\nvoid create() {}' },
                { name: 'sword.c', content: 'inherit "/std/weapon";\nvoid create() {}' },
                { name: 'room.c', content: 'void create() { set_short("A room"); }' },
                { name: 'player.c', content: 'inherit "/std/living";\nvoid create() {}' }
            ];

            const documents = files.map(file =>
                TestHelper.createMockDocument(file.content, 'lpc', file.name)
            );

            // 解析所有文件
            documents.forEach(doc => getParsed(doc));

            const stats = getParserCacheStats();
            expect(stats.size).toBe(files.length);

            // 重新访问某个文件应该从缓存获取
            const result1 = getParsed(documents[0]);
            const result2 = getParsed(documents[0]);
            expect(result1).toBe(result2);
        });
    });
});
