/**
 * 全局测试设置
 * 为所有测试提供通用的Mock和配置
 */

import { jest } from '@jest/globals';

// 全局 Mock 配置
(global as any).console = {
    ...console,
    // 在测试期间抑制不必要的日志
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // 保留 error 和 log 用于调试
    error: console.error,
    log: console.log
};

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.VSCODE_TEST_DATA_PATH = './test-data';

// 全局测试超时警告
const originalTimeout = setTimeout;
(global as any).setTimeout = (callback: Function, delay?: number) => {
    if (delay && delay > 5000) {
        console.warn(`长超时检测: ${delay}ms - 考虑优化测试性能`);
    }
    return originalTimeout(callback as any, delay);
};

// 内存使用监控
const memoryThreshold = 100 * 1024 * 1024; // 100MB
afterEach(() => {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > memoryThreshold) {
        console.warn(`内存使用过高: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    }
});

// 清理函数
afterAll(() => {
    // 清理测试数据
    jest.clearAllMocks();
    jest.restoreAllMocks();
});