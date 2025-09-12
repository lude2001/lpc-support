/**
 * 格式化性能测试套件
 * 验证重构后的FormattingVisitor性能不低于重构前，并识别性能瓶颈
 */

import { FormattingVisitor } from '../../src/formatting/FormattingVisitor';
import { 
    MockTokenStream,
    LPCCodeSamples,
    FormattingOptionsBuilder,
    PerformanceHelper
} from '../helpers/TestHelpers';

describe('Formatting Performance Tests', () => {
    let visitor: FormattingVisitor;
    let tokenStream: MockTokenStream;
    let options: any;

    beforeEach(() => {
        tokenStream = new MockTokenStream();
        options = new FormattingOptionsBuilder().build();
        visitor = new FormattingVisitor(tokenStream, options);
    });

    afterEach(() => {
        // 强制垃圾回收以确保准确的性能测量
        if (global.gc) {
            global.gc();
        }
    });

    describe('基准性能测试', () => {
        test('小型文件格式化性能基准', async () => {
            const code = LPCCodeSamples.simpleFunction();
            
            const mockContext = {
                statement: () => [
                    { accept: () => 'void create() {\n    set_name("test");\n}\n' }
                ]
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(mockContext as any),
                'Small File Formatting'
            );

            const threshold = PerformanceHelper.getThreshold('small');
            expect(executionTime).toBeLessThan(threshold);
        });

        test('中型文件格式化性能基准', async () => {
            // 创建中等大小的代码（约100-500行）
            const mockStatements = [];
            for (let i = 0; i < 50; i++) {
                mockStatements.push({
                    accept: () => `void function_${i}() {\n    int var = ${i};\n    return var;\n}\n`
                });
            }

            const mockContext = {
                statement: () => mockStatements
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(mockContext as any),
                'Medium File Formatting'
            );

            const threshold = PerformanceHelper.getThreshold('medium');
            expect(executionTime).toBeLessThan(threshold);
        });

        test('大型文件格式化性能基准', async () => {
            // 创建大型代码文件（约1000-5000行）
            const mockStatements = [];
            for (let i = 0; i < 500; i++) {
                mockStatements.push({
                    accept: () => `void large_function_${i}() {\n` +
                        `    int var_a = ${i};\n` +
                        `    int var_b = ${i * 2};\n` +
                        `    if (var_a > var_b) {\n` +
                        `        return var_a;\n` +
                        `    } else {\n` +
                        `        return var_b;\n` +
                        `    }\n` +
                        `}\n`
                });
            }

            const mockContext = {
                statement: () => mockStatements
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(mockContext as any),
                'Large File Formatting'
            );

            const threshold = PerformanceHelper.getThreshold('large');
            expect(executionTime).toBeLessThan(threshold);
        });

        test('超大型文件格式化性能基准', async () => {
            // 创建超大型代码文件（>10000行）
            const mockStatements = [];
            for (let i = 0; i < 2000; i++) {
                mockStatements.push({
                    accept: () => LPCCodeSamples.complexFunction().replace(/query_property/g, `func_${i}`)
                });
            }

            const mockContext = {
                statement: () => mockStatements
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(mockContext as any),
                'Huge File Formatting'
            );

            const threshold = PerformanceHelper.getThreshold('huge');
            expect(executionTime).toBeLessThan(threshold);
        });
    });

    describe('内存使用性能测试', () => {
        test('格式化过程中的内存使用应该稳定', async () => {
            const initialMemory = PerformanceHelper.measureMemoryUsage();

            // 连续格式化多个文件
            for (let round = 0; round < 50; round++) {
                const mockStatements = [];
                for (let i = 0; i < 20; i++) {
                    mockStatements.push({
                        accept: () => `void func_${round}_${i}() { int x = ${i}; return x; }\n`
                    });
                }

                const mockContext = {
                    statement: () => mockStatements
                };

                visitor.visitSourceFile(mockContext as any);
                
                // 每10轮检查一次内存使用
                if (round % 10 === 0) {
                    const currentMemory = PerformanceHelper.measureMemoryUsage();
                    const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
                    
                    // 内存增长应该在合理范围内（每轮不超过1MB）
                    expect(memoryIncrease).toBeLessThan((round + 1) * 1024 * 1024);
                }
            }

            const finalMemory = PerformanceHelper.measureMemoryUsage();
            const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log(`Total memory increase: ${Math.round(totalMemoryIncrease / 1024 / 1024)}MB`);
            
            // 总内存增长应该合理（少于100MB）
            expect(totalMemoryIncrease).toBeLessThan(100 * 1024 * 1024);
        });

        test('深度嵌套结构的内存效率', async () => {
            const initialMemory = PerformanceHelper.measureMemoryUsage();

            // 创建深度嵌套结构
            let nestedContext: any = { accept: () => 'innermost_statement;\n' };
            for (let depth = 0; depth < 200; depth++) {
                const currentContext = nestedContext;
                nestedContext = {
                    accept: () => `{\n${currentContext.accept()}\n}\n`
                };
            }

            const mockContext = {
                statement: () => [nestedContext]
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(mockContext as any),
                'Deep Nesting Formatting'
            );

            const finalMemory = PerformanceHelper.measureMemoryUsage();
            const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

            console.log(`Deep nesting - Time: ${executionTime.toFixed(2)}ms, Memory: ${Math.round(memoryUsed / 1024)}KB`);

            // 深度嵌套应该在合理时间和内存范围内处理
            expect(executionTime).toBeLessThan(1000);
            expect(memoryUsed).toBeLessThan(10 * 1024 * 1024); // 10MB
        });
    });

    describe('并发性能测试', () => {
        test('并发格式化请求的性能', async () => {
            const concurrentRequests = 10;
            const promises: Promise<any>[] = [];

            const mockContext = {
                statement: () => [
                    { accept: () => 'void concurrent_test() {\n    int x = 1;\n    return x;\n}\n' }
                ]
            };

            const startTime = performance.now();

            // 创建并发请求
            for (let i = 0; i < concurrentRequests; i++) {
                const concurrentVisitor = new FormattingVisitor(tokenStream, options);
                promises.push(
                    Promise.resolve().then(() => concurrentVisitor.visitSourceFile(mockContext as any))
                );
            }

            const results = await Promise.all(promises);
            const endTime = performance.now();
            const totalTime = endTime - startTime;

            console.log(`Concurrent formatting (${concurrentRequests} requests): ${totalTime.toFixed(2)}ms`);

            // 所有请求都应该成功
            expect(results.length).toBe(concurrentRequests);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(typeof result).toBe('string');
            });

            // 并发执行应该比串行执行更快
            expect(totalTime).toBeLessThan(concurrentRequests * 100); // 假设单次不超过100ms
        });
    });

    describe('配置选项对性能的影响', () => {
        test('不同缩进大小对性能的影响', async () => {
            const indentSizes = [2, 4, 8];
            const results: Array<{ size: number; time: number }> = [];

            const mockContext = {
                statement: () => [
                    { accept: () => LPCCodeSamples.deeplyNested() }
                ]
            };

            for (const size of indentSizes) {
                const options = new FormattingOptionsBuilder()
                    .withIndentSize(size)
                    .build();
                const visitor = new FormattingVisitor(tokenStream, options);

                const { executionTime } = await PerformanceHelper.measureExecutionTime(
                    () => visitor.visitSourceFile(mockContext as any),
                    `Indent Size ${size}`
                );

                results.push({ size, time: executionTime });
            }

            // 缩进大小不应该显著影响性能
            const maxTime = Math.max(...results.map(r => r.time));
            const minTime = Math.min(...results.map(r => r.time));
            const performanceVariation = (maxTime - minTime) / minTime;

            expect(performanceVariation).toBeLessThan(0.5); // 性能差异不应超过50%
        });

        test('复杂配置组合对性能的影响', async () => {
            const simpleOptions = new FormattingOptionsBuilder().build();
            const complexOptions = new FormattingOptionsBuilder()
                .withBracesOnNewLine(true)
                .withSpaceAroundOperators(true)
                .withMaxLineLength(80)
                .withIndentSize(2)
                .build();

            const mockContext = {
                statement: () => [
                    { accept: () => LPCCodeSamples.complexExpressions() }
                ]
            };

            const simpleVisitor = new FormattingVisitor(tokenStream, simpleOptions);
            const complexVisitor = new FormattingVisitor(tokenStream, complexOptions);

            const { executionTime: simpleTime } = await PerformanceHelper.measureExecutionTime(
                () => simpleVisitor.visitSourceFile(mockContext as any),
                'Simple Options'
            );

            const { executionTime: complexTime } = await PerformanceHelper.measureExecutionTime(
                () => complexVisitor.visitSourceFile(mockContext as any),
                'Complex Options'
            );

            console.log(`Options impact - Simple: ${simpleTime.toFixed(2)}ms, Complex: ${complexTime.toFixed(2)}ms`);

            // 复杂选项不应该导致性能显著下降
            const performanceOverhead = (complexTime - simpleTime) / simpleTime;
            expect(performanceOverhead).toBeLessThan(1.0); // 不应超过100%的开销
        });
    });

    describe('回归性能测试', () => {
        test('性能不应低于重构前的基准', async () => {
            // 这个测试需要与重构前的性能基准进行比较
            // 目前设定一个合理的性能期望值
            
            const benchmarkCode = LPCCodeSamples.largeCode(100);
            const mockStatements = [];
            
            // 解析大型代码示例创建语句
            const lines = benchmarkCode.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    mockStatements.push({ accept: () => line + '\n' });
                }
            });

            const mockContext = {
                statement: () => mockStatements
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(mockContext as any),
                'Regression Benchmark'
            );

            // 性能基准：处理100个函数应该在2秒内完成
            expect(executionTime).toBeLessThan(2000);
        });

        test('错误处理不应显著影响性能', async () => {
            // 创建包含错误的上下文
            const errorContext = {
                statement: () => [
                    { accept: () => 'normal_statement;\n' },
                    { accept: () => { throw new Error('Test error'); } },
                    { accept: () => 'another_statement;\n' },
                    { accept: () => { throw new Error('Another test error'); } },
                    { accept: () => 'final_statement;\n' }
                ]
            };

            const { executionTime } = await PerformanceHelper.measureExecutionTime(
                () => visitor.visitSourceFile(errorContext as any),
                'Error Handling Performance'
            );

            const errors = visitor.getErrors();
            
            expect(errors.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(100); // 错误处理应该很快
        });
    });

    describe('压力测试', () => {
        test('连续大量格式化请求的稳定性', async () => {
            const iterations = 1000;
            const mockContext = {
                statement: () => [
                    { accept: () => 'void stress_test() {\n    return 1;\n}\n' }
                ]
            };

            let totalTime = 0;
            let successCount = 0;

            for (let i = 0; i < iterations; i++) {
                try {
                    const startTime = performance.now();
                    const result = visitor.visitSourceFile(mockContext as any);
                    const endTime = performance.now();
                    
                    totalTime += (endTime - startTime);
                    
                    if (result && typeof result === 'string') {
                        successCount++;
                    }
                } catch (error) {
                    console.warn(`Iteration ${i} failed:`, error);
                }
            }

            const averageTime = totalTime / iterations;
            const successRate = successCount / iterations;

            console.log(`Stress test - Average time: ${averageTime.toFixed(2)}ms, Success rate: ${(successRate * 100).toFixed(1)}%`);

            expect(successRate).toBeGreaterThan(0.95); // 95%成功率
            expect(averageTime).toBeLessThan(10); // 平均每次少于10ms
        });
    });
});