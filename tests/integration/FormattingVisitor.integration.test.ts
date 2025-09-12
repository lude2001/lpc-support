/**
 * FormattingVisitor 集成测试
 * 测试重构后的FormattingVisitor与各模块的协作和整体功能
 */

import { FormattingVisitor } from '../../src/formatting/FormattingVisitor';
import { 
    MockTokenStream,
    LPCCodeSamples,
    FormattingOptionsBuilder,
    FormattingAssertions,
    PerformanceHelper
} from '../helpers/TestHelpers';

describe('FormattingVisitor Integration Tests', () => {
    let visitor: FormattingVisitor;
    let tokenStream: MockTokenStream;

    beforeEach(() => {
        tokenStream = new MockTokenStream();
        const options = new FormattingOptionsBuilder().build();
        visitor = new FormattingVisitor(tokenStream, options);
    });

    describe('完整格式化流程集成测试', () => {
        test('应该完整格式化简单函数', () => {
            const code = LPCCodeSamples.simpleFunction();
            
            // 这里需要实际的解析器集成，暂时使用模拟
            // 在实际测试中，需要使用ANTLR解析器生成真实的AST
            const mockContext = {
                statement: () => [
                    { accept: () => 'inherit OBJECT;\n' },
                    { accept: () => 'void create() {\n    set_name("test");\n}\n' }
                ]
            };

            const result = visitor.visitSourceFile(mockContext as any);
            
            FormattingAssertions.validateFormatting(result);
            expect(result).toContain('void create()');
            expect(result).toContain('set_name');
        });

        test('应该处理复杂函数的格式化', () => {
            const code = LPCCodeSamples.complexFunction();
            
            const mockContext = {
                statement: () => [
                    { accept: () => 'public static mixed query_property(string prop, mixed *args...) {\n' },
                    { accept: () => '    if (!prop || prop == "") return 0;\n' },
                    { accept: () => '    switch(prop) { case "name": return name; }\n' },
                    { accept: () => '}\n' }
                ]
            };

            const result = visitor.visitSourceFile(mockContext as any);
            
            FormattingAssertions.validateFormatting(result);
            expect(result).toContain('public static mixed');
            expect(result).toContain('switch');
            expect(result).toContain('case');
        });

        test('应该正确处理继承语句', () => {
            const code = LPCCodeSamples.withInheritance();
            
            const mockContext = {
                statement: () => [
                    { accept: () => 'inherit OBJECT;\n' },
                    { accept: () => 'inherit "/std/room";\n' },
                    { accept: () => 'void create() { ::create(); }\n' }
                ]
            };

            const result = visitor.visitSourceFile(mockContext as any);
            
            expect(result).toContain('inherit OBJECT');
            expect(result).toContain('inherit "/std/room"');
            expect(result).toContain('::create()');
        });
    });

    describe('模块协作测试', () => {
        test('错误收集器应该正确收集格式化错误', () => {
            // 创建一个会抛出异常的mock上下文
            const errorContext = {
                statement: () => [
                    { accept: () => { throw new Error('Mock formatting error'); } }
                ]
            };

            const result = visitor.visitSourceFile(errorContext as any);
            const errors = visitor.getErrors();
            
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('格式化语句');
        });

        test('缩进管理器应该与格式化器正确协作', () => {
            const options = new FormattingOptionsBuilder()
                .withIndentSize(2)
                .build();
            const visitor = new FormattingVisitor(tokenStream, options);

            const nestedContext = {
                statement: () => [
                    {
                        accept: () => {
                            // 模拟需要缩进的嵌套结构
                            return 'if (true) {\n  nested;\n}\n';
                        }
                    }
                ]
            };

            const result = visitor.visitSourceFile(nestedContext as any);
            FormattingAssertions.validateIndentation(result, 2);
        });

        test('操作符格式化应该遵循配置选项', () => {
            const spacesOptions = new FormattingOptionsBuilder()
                .withSpaceAroundOperators(true)
                .build();
            const spacesVisitor = new FormattingVisitor(tokenStream, spacesOptions);

            const noSpacesOptions = new FormattingOptionsBuilder()
                .withSpaceAroundOperators(false)
                .build();
            const noSpacesVisitor = new FormattingVisitor(tokenStream, noSpacesOptions);

            const expressionContext = {
                statement: () => [
                    { accept: () => 'int result = a + b * c;\n' }
                ]
            };

            const spacesResult = spacesVisitor.visitSourceFile(expressionContext as any);
            const noSpacesResult = noSpacesVisitor.visitSourceFile(expressionContext as any);

            FormattingAssertions.validateOperatorSpacing(spacesResult, true);
            FormattingAssertions.validateOperatorSpacing(noSpacesResult, false);
        });
    });

    describe('配置选项集成测试', () => {
        test('不同缩进大小应该产生不同结果', () => {
            const sizes = [2, 4, 8];
            const results: string[] = [];

            const mockContext = {
                statement: () => [
                    { accept: () => 'if (true) {\n    nested;\n}\n' }
                ]
            };

            sizes.forEach(size => {
                const options = new FormattingOptionsBuilder()
                    .withIndentSize(size)
                    .build();
                const visitor = new FormattingVisitor(tokenStream, options);
                
                const result = visitor.visitSourceFile(mockContext as any);
                results.push(result);
                
                FormattingAssertions.validateIndentation(result, size);
            });

            // 确保不同配置产生不同的结果
            expect(results[0]).not.toBe(results[1]);
            expect(results[1]).not.toBe(results[2]);
        });

        test('大括号样式配置应该正确应用', () => {
            const sameLine = new FormattingOptionsBuilder()
                .withBracesOnNewLine(false)
                .build();
            const newLine = new FormattingOptionsBuilder()
                .withBracesOnNewLine(true)
                .build();

            const mockContext = {
                statement: () => [
                    { accept: () => 'void func() {\n    statement;\n}\n' }
                ]
            };

            const sameLineResult = new FormattingVisitor(tokenStream, sameLine)
                .visitSourceFile(mockContext as any);
            const newLineResult = new FormattingVisitor(tokenStream, newLine)
                .visitSourceFile(mockContext as any);

            expect(sameLineResult).not.toBe(newLineResult);
            // 新行样式应该包含换行后的大括号
            expect(newLineResult).toContain('\n{');
        });

        test('最大行长度配置应该影响换行决策', () => {
            const shortLines = new FormattingOptionsBuilder()
                .withMaxLineLength(50)
                .build();
            const longLines = new FormattingOptionsBuilder()
                .withMaxLineLength(150)
                .build();

            const longExpressionContext = {
                statement: () => [
                    { 
                        accept: () => 'int very_long_variable_name = another_very_long_variable + yet_another_long_name * final_long_name;\n' 
                    }
                ]
            };

            const shortResult = new FormattingVisitor(tokenStream, shortLines)
                .visitSourceFile(longExpressionContext as any);
            const longResult = new FormattingVisitor(tokenStream, longLines)
                .visitSourceFile(longExpressionContext as any);

            // 短行限制可能会导致更多换行
            const shortLinesCount = shortResult.split('\n').length;
            const longLinesCount = longResult.split('\n').length;
            
            expect(shortLinesCount).toBeGreaterThanOrEqual(longLinesCount);
        });
    });

    describe('向后兼容性测试', () => {
        test('应该产生与重构前类似的格式化结果', () => {
            // 这个测试需要与重构前的基准进行比较
            // 目前先验证基本功能正确性
            const standardCode = LPCCodeSamples.simpleFunction();
            
            const mockContext = {
                statement: () => [
                    { accept: () => 'void create() {\n    set_name("test");\n}\n' }
                ]
            };

            const result = visitor.visitSourceFile(mockContext as any);
            
            FormattingAssertions.validateFormatting(result);
            
            // 验证关键结构都存在
            expect(result).toContain('void create()');
            expect(result).toContain('{');
            expect(result).toContain('}');
            expect(result).toContain(';');
        });

        test('所有原有的visitXXX方法应该仍然工作', () => {
            const methods = [
                'visitSourceFile',
                'visitFunctionDef', 
                'visitBlock',
                'visitIfStatement',
                'visitWhileStatement',
                'visitExpression',
                'visitMappingLiteral',
                'visitArrayLiteral'
            ];

            methods.forEach(methodName => {
                expect(visitor).toHaveProperty(methodName);
                expect(typeof (visitor as any)[methodName]).toBe('function');
            });
        });
    });

    describe('错误恢复和健壮性测试', () => {
        test('应该从格式化错误中恢复', () => {
            const mixedContext = {
                statement: () => [
                    { accept: () => 'good_statement;\n' },
                    { accept: () => { throw new Error('Formatting error'); } },
                    { accept: () => 'another_good_statement;\n' }
                ]
            };

            const result = visitor.visitSourceFile(mixedContext as any);
            
            // 应该包含正常格式化的语句
            expect(result).toContain('good_statement');
            expect(result).toContain('another_good_statement');
            
            // 应该记录错误
            expect(visitor.getErrors().length).toBeGreaterThan(0);
        });

        test('应该处理循环引用', () => {
            const circularContext: any = {
                statement: () => [circularContext]
            };
            
            // 不应该导致无限循环或栈溢出
            expect(() => {
                visitor.visitSourceFile(circularContext);
            }).not.toThrow();
        });

        test('应该处理深度嵌套而不栈溢出', () => {
            const deepCode = LPCCodeSamples.deeplyNested();
            
            // 创建深度嵌套的mock上下文
            let currentLevel = { accept: () => 'innermost;\n' };
            for (let i = 0; i < 100; i++) {
                const nextLevel = currentLevel;
                currentLevel = { accept: () => `level${i} {\n${nextLevel.accept()}\n}\n` };
            }

            const deepContext = {
                statement: () => [currentLevel]
            };

            expect(() => {
                const result = visitor.visitSourceFile(deepContext as any);
                expect(result).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('资源管理和清理测试', () => {
        test('访问器实例应该正确清理资源', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 创建多个访问器实例并进行格式化
            for (let i = 0; i < 100; i++) {
                const options = new FormattingOptionsBuilder().build();
                const tempVisitor = new FormattingVisitor(tokenStream, options);
                
                const mockContext = {
                    statement: () => [
                        { accept: () => `statement_${i};\n` }
                    ]
                };
                
                tempVisitor.visitSourceFile(mockContext as any);
            }

            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // 内存增长应该在合理范围内
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
        });
    });
});