/**
 * 性能测试设置文件
 * 为性能测试提供专门的环境配置和监控
 */

import { jest } from '@jest/globals';

// 性能测试专用配置
beforeAll(() => {
    // 启用详细的性能监控
    if (typeof performance === 'undefined') {
        (global as any).performance = {
            now: () => Date.now(),
            mark: jest.fn(),
            measure: jest.fn(),
            getEntriesByType: jest.fn(() => []),
            getEntriesByName: jest.fn(() => []),
            clearMarks: jest.fn(),
            clearMeasures: jest.fn()
        };
    }

    // 为性能测试配置更长的超时
    jest.setTimeout(30000);

    // 启用垃圾回收（如果可用）
    if ((global as any).gc) {
        (global as any).gc();
    }

    console.log('Performance testing environment initialized');
});

beforeEach(() => {
    // 每个性能测试前清理内存
    if ((global as any).gc) {
        (global as any).gc();
    }

    // 记录测试开始的内存使用
    const memUsage = process.memoryUsage();
    console.log(`Test start memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
});

afterEach(() => {
    // 性能测试后记录内存使用
    const memUsage = process.memoryUsage();
    console.log(`Test end memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    // 强制垃圾回收
    if ((global as any).gc) {
        (global as any).gc();
    }
});

afterAll(() => {
    console.log('Performance testing completed');
});