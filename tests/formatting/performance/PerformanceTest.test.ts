/**
 * 性能测试套件
 * 测试LPC格式化器在各种负载条件下的性能表现
 */

import { FormattingEngine } from '../../../src/formatting/engine/FormattingEngine';
import { FormattingController } from '../../../src/formatting/controller/FormattingController';
import { TestHelper } from '../../utils/TestHelper';
import { MockVSCode } from '../../mocks/MockVSCode';

// Mock VS Code API
jest.mock('vscode', () => MockVSCode);

// 扩展性能测试的超时时间
jest.setTimeout(30000);

describe('LPC格式化器性能测试', () => {
    let engine: FormattingEngine;
    let controller: FormattingController;
    let performanceData: any;

    beforeAll(() => {
        performanceData = TestHelper.createPerformanceTestData();
    });

    beforeEach(() => {
        const config = TestHelper.createTestConfig();
        engine = new FormattingEngine(config);
        controller = new FormattingController();
    });

    afterEach(() => {
        engine.dispose();
        controller.dispose();
    });

    describe('响应时间测试', () => {
        test('小文件格式化应在50ms内完成', async () => {
            const startTime = performance.now();
            const result = await engine.formatText(performanceData.small);
            const duration = performance.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(50);
            
            console.log(`小文件格式化时间: ${duration.toFixed(2)}ms`);
        });

        test('中等文件格式化应在200ms内完成', async () => {
            const startTime = performance.now();
            const result = await engine.formatText(performanceData.medium);
            const duration = performance.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(200);
            
            console.log(`中等文件格式化时间: ${duration.toFixed(2)}ms`);
        });

        test('大文件格式化应在1秒内完成', async () => {
            const startTime = performance.now();
            const result = await engine.formatText(performanceData.large);
            const duration = performance.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(1000);
            
            console.log(`大文件格式化时间: ${duration.toFixed(2)}ms`);
        });

        test('超大文件格式化应在5秒内完成', async () => {
            const startTime = performance.now();
            const result = await engine.formatText(performanceData.xlarge);
            const duration = performance.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(5000);
            
            console.log(`超大文件格式化时间: ${duration.toFixed(2)}ms`);
        });
    });

    describe('内存使用测试', () => {
        test('格式化过程中内存使用应保持在合理范围', async () => {
            const initialMemory = process.memoryUsage();
            
            // 执行多次格式化操作
            for (let i = 0; i < 10; i++) {
                await engine.formatText(performanceData.medium);
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // 内存增长不应该超过50MB
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
            
            console.log(`内存增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });

        test('应该没有内存泄漏', async () => {
            const initialMemory = process.memoryUsage();
            
            // 创建多个引擎实例并销毁
            for (let i = 0; i < 20; i++) {
                const testEngine = new FormattingEngine(TestHelper.createTestConfig());
                await testEngine.formatText(performanceData.small);
                testEngine.dispose();
            }
            
            // 强制垃圾回收
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // 内存增长应该很小（小于10MB）
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
            
            console.log(`多实例测试内存增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });
    });

    describe('缓存效果测试', () => {
        test('缓存命中应该显著提升性能', async () => {
            const document = TestHelper.createMockDocument(performanceData.medium, 'lpc');
            
            // 首次格式化（缓存未命中）
            const startTime1 = performance.now();
            await controller.formatDocument(document);
            const duration1 = performance.now() - startTime1;
            
            // 第二次格式化（应该命中缓存）
            const startTime2 = performance.now();
            await controller.formatDocument(document);
            const duration2 = performance.now() - startTime2;
            
            // 缓存命中后应该快至少一个数量级
            expect(duration2).toBeLessThan(duration1 * 0.1);
            
            console.log(`首次格式化: ${duration1.toFixed(2)}ms, 缓存命中: ${duration2.toFixed(2)}ms`);
            console.log(`性能提升: ${(duration1 / duration2).toFixed(1)}x`);
        });

        test('缓存统计应该正确记录', async () => {
            const document = TestHelper.createMockDocument(performanceData.small, 'lpc');
            
            // 清空缓存
            controller.clearCache();
            
            // 执行多次格式化
            await controller.formatDocument(document);
            await controller.formatDocument(document);
            await controller.formatDocument(document);
            
            const cacheStats = controller.getCacheStats();
            
            expect(cacheStats.main.size).toBeGreaterThan(0);
            expect(cacheStats.main.hitRate).toBeGreaterThan(0.5); // 命中率应该超过50%
            
            console.log(`缓存大小: ${cacheStats.main.size}, 命中率: ${(cacheStats.main.hitRate * 100).toFixed(1)}%`);
        });
    });

    describe('并发性能测试', () => {
        test('并发格式化请求应该能够正确处理', async () => {
            const inputs = Array(10).fill(performanceData.small);
            
            const startTime = performance.now();
            const promises = inputs.map((input, index) => 
                engine.formatText(input + `\n// Request ${index}`)
            );
            const results = await Promise.all(promises);
            const duration = performance.now() - startTime;
            
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
            
            // 并发处理应该比串行处理快
            console.log(`并发格式化时间: ${duration.toFixed(2)}ms`);
        });

        test('高并发情况下的稳定性', async () => {
            const concurrentRequests = 50;
            const inputs = Array(concurrentRequests).fill(performanceData.medium);
            
            const startTime = performance.now();
            const promises = inputs.map((input, index) => 
                engine.formatText(`${input}\n// Concurrent request ${index}`)
            );
            
            const results = await Promise.all(promises);
            const duration = performance.now() - startTime;
            
            expect(results).toHaveLength(concurrentRequests);
            
            // 所有请求都应该成功
            const successCount = results.filter(r => r.success).length;
            expect(successCount).toBe(concurrentRequests);
            
            console.log(`${concurrentRequests}个并发请求完成时间: ${duration.toFixed(2)}ms`);
            console.log(`平均每个请求: ${(duration / concurrentRequests).toFixed(2)}ms`);
        });
    });

    describe('延迟和吞吐量测试', () => {
        test('应该测试各种大小文件的延迟', async () => {
            const testCases = [
                { name: '小文件', data: performanceData.small, maxDelay: 50 },
                { name: '中等文件', data: performanceData.medium, maxDelay: 200 },
                { name: '大文件', data: performanceData.large, maxDelay: 1000 },
                { name: '超大文件', data: performanceData.xlarge, maxDelay: 5000 }
            ];
            
            for (const testCase of testCases) {
                const delays: number[] = [];
                
                // 执行5次测试获取平均延迟
                for (let i = 0; i < 5; i++) {
                    const startTime = performance.now();
                    const result = await engine.formatText(testCase.data);
                    const delay = performance.now() - startTime;
                    
                    expect(result.success).toBe(true);
                    delays.push(delay);
                }
                
                const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
                const maxDelay = Math.max(...delays);
                const minDelay = Math.min(...delays);
                
                expect(avgDelay).toBeLessThan(testCase.maxDelay);
                
                console.log(`${testCase.name} - 平均延迟: ${avgDelay.toFixed(2)}ms, 最大: ${maxDelay.toFixed(2)}ms, 最小: ${minDelay.toFixed(2)}ms`);
            }
        });

        test('应该测试系统吞吐量', async () => {
            const duration = 2000; // 2秒测试
            const startTime = performance.now();
            let requestCount = 0;
            let successCount = 0;
            
            while (performance.now() - startTime < duration) {
                const result = await engine.formatText(performanceData.small);
                requestCount++;
                if (result.success) {
                    successCount++;
                }
            }
            
            const actualDuration = performance.now() - startTime;
            const throughput = requestCount / (actualDuration / 1000); // 每秒请求数
            const successRate = successCount / requestCount;
            
            expect(successRate).toBeGreaterThan(0.95); // 95%成功率
            expect(throughput).toBeGreaterThan(10); // 每秒至少10个请求
            
            console.log(`吞吐量: ${throughput.toFixed(1)}请求/秒, 成功率: ${(successRate * 100).toFixed(1)}%`);
        });
    });

    describe('内存占用分析', () => {
        test('应该分析不同文件大小的内存占用', async () => {
            const testCases = [
                { name: '小文件', data: performanceData.small },
                { name: '中等文件', data: performanceData.medium },
                { name: '大文件', data: performanceData.large }
            ];
            
            for (const testCase of testCases) {
                const initialMemory = process.memoryUsage();
                
                await engine.formatText(testCase.data);
                
                const finalMemory = process.memoryUsage();
                const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
                
                console.log(`${testCase.name} - 内存增长: ${Math.round(memoryIncrease / 1024)}KB`);
                console.log(`${testCase.name} - 文件大小: ${Math.round(testCase.data.length / 1024)}KB`);
                
                // 内存增长不应该超过文件大小的10倍
                expect(memoryIncrease).toBeLessThan(testCase.data.length * 10);
            }
        });
    });

    describe('性能基准测试', () => {
        test('应该建立性能基准', async () => {
            const benchmarkData = {
                small: { size: '< 1KB', target: 50 },
                medium: { size: '1-10KB', target: 200 },
                large: { size: '10-100KB', target: 1000 },
                xlarge: { size: '> 100KB', target: 5000 }
            };
            
            console.log('\n=== LPC格式化器性能基准 ===');
            
            for (const [key, info] of Object.entries(benchmarkData)) {
                const testData = (performanceData as any)[key];
                const iterations = key === 'xlarge' ? 1 : 5;
                const durations: number[] = [];
                
                for (let i = 0; i < iterations; i++) {
                    const startTime = performance.now();
                    const result = await engine.formatText(testData);
                    const duration = performance.now() - startTime;
                    
                    expect(result.success).toBe(true);
                    durations.push(duration);
                }
                
                const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
                const passed = avgDuration < info.target;
                
                console.log(`${info.size}: ${avgDuration.toFixed(2)}ms (目标: ${info.target}ms) ${passed ? '✓' : '✗'}`);
                
                expect(avgDuration).toBeLessThan(info.target);
            }
        });
    });

    describe('长期运行稳定性测试', () => {
        test('应该在长时间运行后保持性能稳定', async () => {
            const iterations = 100;
            const durations: number[] = [];
            
            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                const result = await engine.formatText(performanceData.small);
                const duration = performance.now() - startTime;
                
                expect(result.success).toBe(true);
                durations.push(duration);
                
                // 每10次记录一次进度
                if (i % 10 === 9) {
                    const avgSoFar = durations.slice(-10).reduce((a, b) => a + b, 0) / 10;
                    console.log(`第${i + 1}次迭代，近10次平均时间: ${avgSoFar.toFixed(2)}ms`);
                }
            }
            
            // 分析性能趋势
            const firstHalf = durations.slice(0, 50);
            const secondHalf = durations.slice(50);
            
            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            
            console.log(`前半部平均: ${firstAvg.toFixed(2)}ms, 后半部平均: ${secondAvg.toFixed(2)}ms`);
            
            // 性能不应该显著下降（允许不超过20%的变化）
            expect(secondAvg).toBeLessThan(firstAvg * 1.2);
        });
    });
});
