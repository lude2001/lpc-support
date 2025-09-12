/**
 * IndentManager 单元测试
 * 测试缩进管理器的功能正确性和配置选项处理
 */

import { IndentManager } from '../../../src/formatting/core/IndentManager';
import { FormattingOptionsBuilder } from '../../helpers/TestHelpers';

describe('IndentManager', () => {
    let indentManager: IndentManager;
    let options: any;

    beforeEach(() => {
        options = new FormattingOptionsBuilder().build();
        indentManager = new IndentManager(options);
    });

    describe('基本缩进功能', () => {
        test('应该从零级缩进开始', () => {
            expect(indentManager.getIndentLevel()).toBe(0);
            expect(indentManager.getIndent()).toBe('');
        });

        test('应该能够增加缩进级别', () => {
            indentManager.increaseIndent();
            
            expect(indentManager.getIndentLevel()).toBe(1);
            expect(indentManager.getIndent()).toBe('    '); // 默认4个空格
        });

        test('应该能够减少缩进级别', () => {
            indentManager.increaseIndent(3);
            expect(indentManager.getIndentLevel()).toBe(3);
            
            indentManager.decreaseIndent();
            expect(indentManager.getIndentLevel()).toBe(2);
            
            indentManager.decreaseIndent(2);
            expect(indentManager.getIndentLevel()).toBe(0);
        });

        test('不应该允许负数缩进级别', () => {
            indentManager.decreaseIndent();
            expect(indentManager.getIndentLevel()).toBe(0);
            
            indentManager.decreaseIndent(5);
            expect(indentManager.getIndentLevel()).toBe(0);
        });

        test('应该能够直接设置缩进级别', () => {
            indentManager.setIndentLevel(5);
            expect(indentManager.getIndentLevel()).toBe(5);
            expect(indentManager.getIndent()).toBe('    '.repeat(5));
        });
    });

    describe('缩进大小配置', () => {
        test('应该遵循配置的缩进大小', () => {
            const customOptions = new FormattingOptionsBuilder()
                .withIndentSize(2)
                .build();
            const customIndentManager = new IndentManager(customOptions);
            
            customIndentManager.increaseIndent();
            expect(customIndentManager.getIndent()).toBe('  '); // 2个空格
        });

        test('应该处理不同的缩进大小', () => {
            const sizes = [1, 2, 3, 4, 6, 8];
            
            sizes.forEach(size => {
                const options = new FormattingOptionsBuilder()
                    .withIndentSize(size)
                    .build();
                const manager = new IndentManager(options);
                
                manager.increaseIndent();
                expect(manager.getIndent()).toBe(' '.repeat(size));
            });
        });
    });

    describe('上下文相关缩进', () => {
        test('应该计算普通上下文的缩进级别', () => {
            indentManager.setIndentLevel(2);
            
            expect(indentManager.calculateIndentLevel('normal')).toBe(2);
            expect(indentManager.calculateIndentLevel()).toBe(2);
        });

        test('应该为case语句计算正确的缩进级别', () => {
            const options = new FormattingOptionsBuilder().build();
            options.switchCaseAlignment = 'indent';
            const manager = new IndentManager(options);
            
            manager.setIndentLevel(1);
            expect(manager.calculateIndentLevel('case')).toBe(2); // case相对于switch缩进
        });

        test('应该为switch对齐的case计算正确的缩进级别', () => {
            const options = new FormattingOptionsBuilder().build();
            options.switchCaseAlignment = 'switch';
            const manager = new IndentManager(options);
            
            manager.setIndentLevel(1);
            expect(manager.calculateIndentLevel('case')).toBe(1); // case与switch对齐
        });
    });

    describe('withIndent操作', () => {
        test('应该在回调中临时改变缩进级别', () => {
            expect(indentManager.getIndentLevel()).toBe(0);
            
            const result = indentManager.withIndent(3, () => {
                expect(indentManager.getIndentLevel()).toBe(3);
                return 'test result';
            });
            
            expect(result).toBe('test result');
            expect(indentManager.getIndentLevel()).toBe(0); // 应该恢复原始级别
        });

        test('应该处理嵌套的withIndent操作', () => {
            const result = indentManager.withIndent(1, () => {
                expect(indentManager.getIndentLevel()).toBe(1);
                
                return indentManager.withIndent(2, () => {
                    expect(indentManager.getIndentLevel()).toBe(3); // 1 + 2
                    return 'nested result';
                });
            });
            
            expect(result).toBe('nested result');
            expect(indentManager.getIndentLevel()).toBe(0);
        });

        test('即使回调抛出异常，也应该恢复缩进级别', () => {
            expect(() => {
                indentManager.withIndent(2, () => {
                    expect(indentManager.getIndentLevel()).toBe(2);
                    throw new Error('test error');
                });
            }).toThrow('test error');
            
            expect(indentManager.getIndentLevel()).toBe(0); // 应该恢复
        });
    });

    describe('边界条件测试', () => {
        test('应该处理零缩进大小', () => {
            const options = new FormattingOptionsBuilder()
                .withIndentSize(0)
                .build();
            const manager = new IndentManager(options);
            
            manager.increaseIndent();
            expect(manager.getIndent()).toBe('');
        });

        test('应该处理负数缩进大小', () => {
            const options = new FormattingOptionsBuilder()
                .withIndentSize(-1)
                .build();
            const manager = new IndentManager(options);
            
            manager.increaseIndent();
            expect(manager.getIndent()).toBe(''); // 应该默认为空
        });

        test('应该处理非常大的缩进级别', () => {
            indentManager.setIndentLevel(100);
            expect(indentManager.getIndentLevel()).toBe(100);
            
            const indent = indentManager.getIndent();
            expect(indent).toBe('    '.repeat(100));
        });

        test('应该处理非法的上下文类型', () => {
            indentManager.setIndentLevel(2);
            
            expect(indentManager.calculateIndentLevel('invalid-context' as any)).toBe(2);
        });
    });

    describe('性能测试', () => {
        test('获取缩进字符串应该是高效的', () => {
            indentManager.setIndentLevel(10);
            
            const startTime = performance.now();
            
            for (let i = 0; i < 10000; i++) {
                indentManager.getIndent();
            }
            
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            expect(executionTime).toBeLessThan(100); // 应在100ms内完成
        });

        test('缩进级别操作应该是高效的', () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 10000; i++) {
                indentManager.increaseIndent();
                indentManager.decreaseIndent();
            }
            
            const endTime = performance.now();
            const executionTime = endTime - startTime;
            
            expect(executionTime).toBeLessThan(100); // 应在100ms内完成
            expect(indentManager.getIndentLevel()).toBe(0);
        });
    });

    describe('内存管理测试', () => {
        test('深度缩进不应该造成内存泄漏', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 创建深度缩进
            for (let i = 0; i < 1000; i++) {
                indentManager.increaseIndent();
            }
            
            // 获取缩进字符串
            for (let i = 0; i < 100; i++) {
                indentManager.getIndent();
            }
            
            // 清理
            indentManager.setIndentLevel(0);
            
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // 内存增长应该在合理范围内（小于1MB）
            expect(memoryIncrease).toBeLessThan(1024 * 1024);
        });
    });

    describe('并发安全测试', () => {
        test('并发访问应该是安全的', async () => {
            const promises = [];
            
            for (let i = 0; i < 100; i++) {
                promises.push(
                    Promise.resolve().then(() => {
                        indentManager.increaseIndent();
                        const level = indentManager.getIndentLevel();
                        const indent = indentManager.getIndent();
                        indentManager.decreaseIndent();
                        
                        expect(typeof level).toBe('number');
                        expect(typeof indent).toBe('string');
                    })
                );
            }
            
            await Promise.all(promises);
            expect(indentManager.getIndentLevel()).toBe(0);
        });
    });
});