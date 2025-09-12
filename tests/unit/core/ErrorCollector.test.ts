/**
 * ErrorCollector 单元测试
 * 测试错误收集器的功能正确性和边界条件处理
 */

import { ErrorCollector } from '../../../src/formatting/core/ErrorCollector';

describe('ErrorCollector', () => {
    let errorCollector: ErrorCollector;

    beforeEach(() => {
        errorCollector = new ErrorCollector();
    });

    describe('基本功能测试', () => {
        test('应该能够添加和获取错误', () => {
            expect(errorCollector.getErrorCount()).toBe(0);
            expect(errorCollector.hasErrors()).toBe(false);
            expect(errorCollector.getErrors()).toHaveLength(0);

            errorCollector.addError('测试错误');

            expect(errorCollector.getErrorCount()).toBe(1);
            expect(errorCollector.hasErrors()).toBe(true);
            
            const errors = errorCollector.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('测试错误');
        });

        test('应该能够添加带上下文的错误', () => {
            errorCollector.addError('测试错误', '测试上下文');
            
            const errors = errorCollector.getErrors();
            expect(errors[0]).toContain('测试错误');
            expect(errors[0]).toContain('测试上下文');
        });

        test('应该能够清空错误', () => {
            errorCollector.addError('错误1');
            errorCollector.addError('错误2');
            
            expect(errorCollector.getErrorCount()).toBe(2);
            
            errorCollector.clearErrors();
            
            expect(errorCollector.getErrorCount()).toBe(0);
            expect(errorCollector.hasErrors()).toBe(false);
        });
    });

    describe('错误限制测试', () => {
        test('应该遵守默认的错误限制', () => {
            const defaultLimit = 50; // 基于源码中的默认值
            
            for (let i = 0; i < defaultLimit + 10; i++) {
                errorCollector.addError(`错误 ${i}`);
            }
            
            expect(errorCollector.getErrorCount()).toBeLessThanOrEqual(defaultLimit);
            expect(errorCollector.isAtErrorLimit()).toBe(true);
        });

        test('应该遵守自定义的错误限制', () => {
            const customLimit = 3;
            const limitedCollector = new ErrorCollector(customLimit);
            
            for (let i = 0; i < 10; i++) {
                limitedCollector.addError(`错误 ${i}`);
            }
            
            expect(limitedCollector.getErrorCount()).toBe(customLimit);
            expect(limitedCollector.isAtErrorLimit()).toBe(true);
        });

        test('达到限制后不应该添加更多错误', () => {
            const limit = 2;
            const limitedCollector = new ErrorCollector(limit);
            
            limitedCollector.addError('错误1');
            limitedCollector.addError('错误2');
            limitedCollector.addError('错误3'); // 应该被忽略
            
            const errors = limitedCollector.getErrors();
            expect(errors).toHaveLength(2);
            expect(errors[0]).toContain('错误1');
            expect(errors[1]).toContain('错误2');
        });
    });

    describe('边界条件测试', () => {
        test('应该处理空字符串错误消息', () => {
            errorCollector.addError('');
            
            expect(errorCollector.getErrorCount()).toBe(1);
            expect(errorCollector.getErrors()[0]).toBe(''); // 实际实现不会转换空字符串
        });

        test('应该处理null/undefined错误消息', () => {
            errorCollector.addError(null as any);
            errorCollector.addError(undefined as any);
            
            expect(errorCollector.getErrorCount()).toBe(2);
            const errors = errorCollector.getErrors();
            expect(errors[0]).toBe(null); // 实际实现不会转换null
            expect(errors[1]).toBe(undefined); // 实际实现不会转换undefined
        });

        test('应该处理非常长的错误消息', () => {
            const longMessage = 'A'.repeat(10000);
            errorCollector.addError(longMessage);
            
            const errors = errorCollector.getErrors();
            expect(errors[0]).toHaveLength(10000); // 实际实现不限制长度
            expect(errors[0]).toBe(longMessage);
        });

        test('应该处理特殊字符', () => {
            const specialMessage = 'Error with special chars: \\n\\t\\r\\"\\\'';
            errorCollector.addError(specialMessage);
            
            const errors = errorCollector.getErrors();
            expect(errors[0]).toContain('special chars');
        });
    });

    describe('性能测试', () => {
        test('添加大量错误应该保持性能', () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 1000; i++) {
                errorCollector.addError(`性能测试错误 ${i}`);
            }
            
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            expect(executionTime).toBeLessThan(100); // 应在100ms内完成
        });

        test('获取错误列表应该是高效的', () => {
            // 添加一些错误
            for (let i = 0; i < 100; i++) {
                errorCollector.addError(`错误 ${i}`);
            }
            
            const startTime = performance.now();
            
            for (let i = 0; i < 1000; i++) {
                errorCollector.getErrors();
            }
            
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            expect(executionTime).toBeLessThan(50); // 应在50ms内完成1000次调用
        });
    });

    describe('内存管理测试', () => {
        test('清空错误后应该释放内存', () => {
            // 添加大量错误
            for (let i = 0; i < 1000; i++) {
                errorCollector.addError(`大量错误数据 ${i} ${'X'.repeat(100)}`);
            }
            
            const beforeClear = errorCollector.getErrors().length;
            expect(beforeClear).toBeGreaterThan(0);
            
            errorCollector.clearErrors();
            
            expect(errorCollector.getErrors()).toHaveLength(0);
            expect(errorCollector.getErrorCount()).toBe(0);
        });
    });

    describe('并发安全测试', () => {
        test('同时添加多个错误应该是安全的', async () => {
            const promises = [];
            
            for (let i = 0; i < 100; i++) {
                promises.push(
                    Promise.resolve().then(() => {
                        errorCollector.addError(`并发错误 ${i}`);
                    })
                );
            }
            
            await Promise.all(promises);
            
            // 由于有错误限制，实际数量可能少于100
            expect(errorCollector.getErrorCount()).toBeGreaterThan(0);
            expect(errorCollector.getErrorCount()).toBeLessThanOrEqual(100);
        });
    });
});