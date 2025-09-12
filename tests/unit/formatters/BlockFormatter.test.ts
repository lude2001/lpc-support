/**
 * BlockFormatter 单元测试
 * 测试代码块格式化器的功能正确性和各种配置选项
 */

import { BlockFormatter } from '../../../src/formatting/formatters/BlockFormatter';
import { 
    MockTokenStream, 
    MockParseTree, 
    FormattingOptionsBuilder,
    LPCCodeSamples 
} from '../../helpers/TestHelpers';
import { createExtendedFormattingContext } from '../../../src/formatting/core';
import { INodeVisitor } from '../../../src/formatting/types/interfaces';

describe('BlockFormatter', () => {
    let blockFormatter: BlockFormatter;
    let mockTokenStream: MockTokenStream;
    let context: any;
    let mockVisitor: INodeVisitor;

    beforeEach(() => {
        mockTokenStream = new MockTokenStream();
        const options = new FormattingOptionsBuilder().build();
        context = createExtendedFormattingContext(mockTokenStream, options);
        
        // 重置节点计数器
        context.core.resetNodeCount();
        
        // 创建mock visitor
        mockVisitor = {
            visit: jest.fn((node) => {
                if (!node || !node.text) return '';
                // 对于语句节点，返回处理过的内容
                if (node.text && !node.text.match(/^[{}]$/)) {
                    return node.text.trim();
                }
                return node.text;
            })
        } as any;
        
        // 设置visitor到context
        context.setNodeVisitor(mockVisitor);
        
        // 使用context的blockFormatter
        blockFormatter = context.blockFormatter;
    });

    describe('基本代码块格式化', () => {
        test('应该格式化简单的代码块', () => {
            const mockBlock = new MockParseTree('{statement1;statement2;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('statement1;'),
                new MockParseTree('statement2;'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            expect(result).toBeDefined();
            expect(result).toContain('{');
            expect(result).toContain('}');
        });

        test('应该处理空代码块', () => {
            const mockBlock = new MockParseTree('{}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            expect(result).toBeDefined();
            expect(result.trim()).toBe('{}');
        });

        test('应该处理单语句代码块', () => {
            const mockBlock = new MockParseTree('{return 42;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('return 42;'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            expect(result).toContain('return 42;');
            expect(result).toMatch(/\{\s*return 42;\s*\}/);
        });
    });

    describe('缩进处理', () => {
        test('应该正确缩进嵌套代码块', () => {
            const options = new FormattingOptionsBuilder()
                .withIndentSize(4)
                .build();
            const context = createExtendedFormattingContext(mockTokenStream, options);
            const formatter = new BlockFormatter(context);

            // 模拟嵌套结构
            context.indentManager.setIndentLevel(1);

            const mockBlock = new MockParseTree('{if(true){nested;}}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('if(true)'),
                new MockParseTree('{'),
                new MockParseTree('nested;'),
                new MockParseTree('}'),
                new MockParseTree('}')
            ];

            const result = formatter.formatBlock(mockBlock as any);
            
            expect(result).toContain('    '); // 应包含缩进
        });

        test('应该根据配置使用不同的缩进大小', () => {
            const sizes = [2, 4, 6, 8];
            
            sizes.forEach(size => {
                const options = new FormattingOptionsBuilder()
                    .withIndentSize(size)
                    .build();
                const context = createExtendedFormattingContext(mockTokenStream, options);
                const formatter = new BlockFormatter(context);
                
                context.indentManager.increaseIndent();
                
                const mockBlock = new MockParseTree('{statement;}');
                mockBlock.children = [
                    new MockParseTree('{'),
                    new MockParseTree('statement;'),
                    new MockParseTree('}')
                ];

                const result = formatter.formatBlock(mockBlock as any);
                expect(result).toContain(' '.repeat(size));
            });
        });
    });

    describe('大括号样式配置', () => {
        test('应该支持同行大括号样式（默认）', () => {
            const options = new FormattingOptionsBuilder()
                .withBracesOnNewLine(false)
                .build();
            const context = createExtendedFormattingContext(mockTokenStream, options);
            context.core.resetNodeCount(); // 重置节点计数器
            context.setNodeVisitor(mockVisitor);
            const formatter = context.blockFormatter;

            const mockBlock = new MockParseTree('{statement;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('statement;'),
                new MockParseTree('}')
            ];

            const result = formatter.formatBlock(mockBlock as any);
            
            // 默认模式：开括号在同一行，但我们的实现是总是在开括号后换行
            expect(result).toMatch(/^\{\n/); // 开括号后面立即换行
            expect(result).not.toMatch(/^\n\{/); // 不是在新行开始
        });

        test('应该支持新行大括号样式（Allman风格）', () => {
            const options = new FormattingOptionsBuilder()
                .withBracesOnNewLine(true)
                .build();
            const context = createExtendedFormattingContext(mockTokenStream, options);
            context.core.resetNodeCount(); // 重置节点计数器
            context.setNodeVisitor(mockVisitor);
            const formatter = context.blockFormatter;

            const mockBlock = new MockParseTree('{statement;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('statement;'),
                new MockParseTree('}')
            ];

            const result = formatter.formatBlock(mockBlock as any);
            
            // Allman风格：开括号在新行
            expect(result).toMatch(/^\n\{\n/); // 以换行开括号开始
        });
    });

    describe('语句分隔和空行处理', () => {
        test('应该在语句之间添加适当的分隔', () => {
            const mockBlock = new MockParseTree('{stmt1;stmt2;stmt3;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('stmt1;'),
                new MockParseTree('stmt2;'),
                new MockParseTree('stmt3;'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            // 每个语句应该在单独的行上
            const lines = result.split('\n').filter(line => line.trim());
            expect(lines.length).toBeGreaterThanOrEqual(3); // 至少包含三个语句行
        });

        test('应该限制连续空行数量', () => {
            const options = new FormattingOptionsBuilder().build();
            options.maxEmptyLines = 2;
            const context = createExtendedFormattingContext(mockTokenStream, options);
            const formatter = new BlockFormatter(context);

            // 创建包含多个空行的模拟块
            const mockBlock = new MockParseTree('{stmt1;\n\n\n\n\nstmt2;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('stmt1;'),
                new MockParseTree('\n\n\n\n\n'),
                new MockParseTree('stmt2;'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            // 不应该有超过maxEmptyLines指定数量的连续空行
            expect(result).not.toMatch(/\n\s*\n\s*\n\s*\n/); // 不超过3个连续换行
        });
    });

    describe('复杂嵌套结构', () => {
        test('应该正确处理深度嵌套的代码块', () => {
            const mockBlock = new MockParseTree('{{{{stmt;}}}}');
            // 模拟4层嵌套结构
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('{'),
                new MockParseTree('{'),
                new MockParseTree('{'),
                new MockParseTree('stmt;'),
                new MockParseTree('}'),
                new MockParseTree('}'),
                new MockParseTree('}'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            expect(result).toBeDefined();
            expect(result).toContain('stmt;');
            
            // 验证括号匹配
            const openBraces = (result.match(/\{/g) || []).length;
            const closeBraces = (result.match(/\}/g) || []).length;
            expect(openBraces).toBe(closeBraces);
        });

        test('应该处理混合语句类型的代码块', () => {
            const mockBlock = new MockParseTree('{if(){} while(){} return;}');
            mockBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('if(){}'),
                new MockParseTree('while(){}'),
                new MockParseTree('return;'),
                new MockParseTree('}')
            ];

            const result = blockFormatter.formatBlock(mockBlock as any);

            expect(result).toContain('if');
            expect(result).toContain('while');
            expect(result).toContain('return');
        });
    });

    describe('错误处理', () => {
        test('应该处理null上下文', () => {
            expect(() => {
                blockFormatter.formatBlock(null as any);
            }).not.toThrow();
        });

        test('应该处理undefined上下文', () => {
            expect(() => {
                blockFormatter.formatBlock(undefined as any);
            }).not.toThrow();
        });

        test('应该处理没有children的上下文', () => {
            const mockBlock = new MockParseTree('{}');
            mockBlock.children = [];

            const result = blockFormatter.formatBlock(mockBlock as any);
            expect(result).toBeDefined();
        });

        test('应该处理格式化过程中的异常', () => {
            // 创建一个会在visitor.visit时抛出异常的测试对象
            const errorVisitor = {
                visit: jest.fn((node) => {
                    if (node.text === 'statement;') {
                        throw new Error('Test error in visitor');
                    }
                    return node.text || '';
                })
            } as any;
            
            // 创建独立的context和formatter
            const testTokenStream = new MockTokenStream();
            const testOptions = new FormattingOptionsBuilder().build();
            const testContext = createExtendedFormattingContext(testTokenStream, testOptions);
            testContext.core.resetNodeCount();
            testContext.setNodeVisitor(errorVisitor);
            const testFormatter = testContext.blockFormatter;

            const malformedBlock = new MockParseTree('{statement;}');
            malformedBlock.children = [
                new MockParseTree('{'),
                new MockParseTree('statement;'),
                new MockParseTree('}')
            ];

            expect(() => {
                testFormatter.formatBlock(malformedBlock as any);
            }).not.toThrow();
            
            // 应该记录错误到上下文
            expect(testContext.errorCollector.hasErrors()).toBe(true);
        });
    });

    describe('性能测试', () => {
        test('应该高效处理大型代码块', () => {
            const statements: MockParseTree[] = [];
            for (let i = 0; i < 1000; i++) {
                statements.push(new MockParseTree(`statement_${i};`));
            }

            const largeBlock = new MockParseTree('{...many statements...}');
            largeBlock.children = [
                new MockParseTree('{'),
                ...statements,
                new MockParseTree('}')
            ];

            const startTime = performance.now();
            const result = blockFormatter.formatBlock(largeBlock as any);
            const endTime = performance.now();

            expect(result).toBeDefined();
            expect(endTime - startTime).toBeLessThan(1000); // 应在1秒内完成
        });

        test('应该高效处理深度嵌套', () => {
            let currentBlock = new MockParseTree('innermost;');
            
            // 创建100层嵌套
            for (let i = 0; i < 100; i++) {
                const wrapper = new MockParseTree(`{level_${i}}`);
                wrapper.children = [
                    new MockParseTree('{'),
                    currentBlock,
                    new MockParseTree('}')
                ];
                currentBlock = wrapper;
            }

            const startTime = performance.now();
            const result = blockFormatter.formatBlock(currentBlock as any);
            const endTime = performance.now();

            expect(result).toBeDefined();
            expect(endTime - startTime).toBeLessThan(500); // 应在500ms内完成
        });
    });

    describe('内存管理', () => {
        test('处理大型代码块后应该释放内存', () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // 处理多个大型代码块
            for (let round = 0; round < 10; round++) {
                const statements: MockParseTree[] = [];
                for (let i = 0; i < 500; i++) {
                    statements.push(new MockParseTree(`statement_${round}_${i};`));
                }

                const largeBlock = new MockParseTree('{...}');
                largeBlock.children = [
                    new MockParseTree('{'),
                    ...statements,
                    new MockParseTree('}')
                ];

                blockFormatter.formatBlock(largeBlock as any);
            }

            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // 内存增长应该在合理范围内（小于10MB）
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
    });
});