/**
 * 错误处理和边界情况测试
 * 测试格式化器在各种异常情况下的表现
 */

import { FormattingEngine } from '../../../src/formatting/engine/FormattingEngine';
import { TestHelper } from '../../utils/TestHelper';

// VS Code API已在jest.setup.ts中进行mock

describe('错误处理和边界情况测试', () => {
    let engine: FormattingEngine;
    let config: any;

    beforeEach(() => {
        config = TestHelper.createTestConfig({
            maxFormatTime: 2000 // 2秒超时
        });
        engine = new FormattingEngine(config);
    });

    afterEach(() => {
        engine.dispose();
    });

    describe('语法错误处理', () => {
        test('应该处理缺失分号的错误', async () => {
            const input = `
void test() {
    int x = 5
    return;
}`;
            
            const result = await engine.formatText(input);
            
            // 应该返回结果，但可能有错误或警告
            expect(result).toBeDefined();
            expect(typeof result.success).toBe('boolean');
        });

        test('应该处理不匹配的括号', async () => {
            const input = `
void test() {
    if (x > 0 {
        write("hello");
    }
}`;
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            // 语法错误时可能返回失败，但不应该崩溃
            if (!result.success) {
                expect(result.errors).toBeDefined();
                expect(Array.isArray(result.errors)).toBe(true);
            }
        });

        test('应该处理不完整的函数定义', async () => {
            const input = 'void incomplete_function(';
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            // 不完整的代码应该能够被检测到
        });

        test('应该处理未知的关键字', async () => {
            const input = 'unknown_keyword test() { return; }';
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
        });

        test('应该处理嵌套太深的结构', async () => {
            // 创建100层嵌套的结构
            let input = 'void test() {';
            for (let i = 0; i < 100; i++) {
                input += ' if (true) {';
            }
            input += ' write("deep");';
            for (let i = 0; i < 100; i++) {
                input += ' }';
            }
            input += ' }';
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            // 深度嵌套不应该导致崩溃
        });
    });

    describe('边界情况测试', () => {
        test('应该处理空输入', async () => {
            const result = await engine.formatText('');
            
            expect(result.success).toBe(true);
            expect(result.formattedText).toBe('');
        });

        test('应该处理null输入', async () => {
            // @ts-ignore - 故意传入null测试健壮性
            const result = await engine.formatText(null);
            
            expect(result).toBeDefined();
            expect(typeof result.success).toBe('boolean');
        });

        test('应该处理undefined输入', async () => {
            // @ts-ignore - 故意传入undefined测试健壮性
            const result = await engine.formatText(undefined);
            
            expect(result).toBeDefined();
            expect(typeof result.success).toBe('boolean');
        });

        test('应该处理只有空白字符的输入', async () => {
            const input = '   \n\t  \r\n   \t\t  ';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText.trim()).toBe('');
            }
        });

        test('应该处理极长的单行代码', async () => {
            const longLine = 'write("' + 'a'.repeat(10000) + '");';
            const input = `void test() { ${longLine} }`;
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            // 长行不应该导致崩溃
        });

        test('应该处理大量空行的代码', async () => {
            const input = 'void test() {\n' + '\n'.repeat(1000) + 'return;\n}';
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            if (result.success && result.formattedText) {
                // 格式化后应该清理多余空行
                const lines = result.formattedText.split('\n');
                const emptyLines = lines.filter(line => line.trim() === '');
                expect(emptyLines.length).toBeLessThan(500); // 应该减少空行
            }
        });

        test('应该处理包含特殊字符的代码', async () => {
            const input = `void test() {
    write("中文字符\u0000\uffff");
    write("😀😁😂"); // emoji
}`;
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            if (result.success && result.formattedText) {
                expect(result.formattedText).toContain('中文字符');
                expect(result.formattedText).toContain('😀');
            }
        });
    });

    describe('内存和性能压力测试', () => {
        test('应该处理大文件格式化', async () => {
            const largeInput = TestHelper.generateLargeCodeFile(5000); // 5000行代码
            
            const startTime = Date.now();
            const result = await engine.formatText(largeInput);
            const duration = Date.now() - startTime;
            
            expect(result).toBeDefined();
            expect(duration).toBeLessThan(10000); // 10秒内完成
            
            if (result.success) {
                expect(result.formattedText).toBeDefined();
                expect(result.formattedText!.length).toBeGreaterThan(0);
            }
        });

        test('应该处理超时情况', async () => {
            // 设置很短的超时时间
            const shortTimeoutEngine = new FormattingEngine(
                TestHelper.createTestConfig({ maxFormatTime: 1 }) // 1ms超时
            );
            
            const largeInput = TestHelper.generateLargeCodeFile(1000);
            
            const result = await shortTimeoutEngine.formatText(largeInput);
            
            expect(result).toBeDefined();
            // 超时时应该优雅地处理
            if (!result.success) {
                expect(result.errors).toBeDefined();
                expect(result.errors!.some(err => err.includes('超时'))).toBe(true);
            }
            
            shortTimeoutEngine.dispose();
        });

        test('应该处理并发格式化请求', async () => {
            const inputs = [
                'void test1() { return; }',
                'void test2() { return; }',
                'void test3() { return; }',
                'void test4() { return; }',
                'void test5() { return; }'
            ];
            
            // 并发执行多个格式化任务
            const promises = inputs.map(input => engine.formatText(input));
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(typeof result.success).toBe('boolean');
            });
        });
    });

    describe('资源清理测试', () => {
        test('应该正确清理资源', () => {
            const testEngine = new FormattingEngine(config);
            
            // 执行一些操作
            testEngine.formatText('void test() {}');
            
            // 清理资源不应该抛异常
            expect(() => testEngine.dispose()).not.toThrow();
        });

        test('应该处理重复清理', () => {
            const testEngine = new FormattingEngine(config);
            
            // 多次清理不应该引起问题
            expect(() => {
                testEngine.dispose();
                testEngine.dispose();
                testEngine.dispose();
            }).not.toThrow();
        });
    });

    describe('配置错误处理', () => {
        test('应该处理无效的配置值', () => {
            const invalidConfig = TestHelper.createTestConfig({
                indentSize: -1, // 无效值
                maxLineLength: 0, // 无效值
                // @ts-ignore - 故意传入错误类型
                spaceAroundOperators: 'invalid'
            });
            
            expect(() => {
                const testEngine = new FormattingEngine(invalidConfig);
                testEngine.dispose();
            }).not.toThrow();
        });

        test('应该处理缺失的配置属性', () => {
            // @ts-ignore - 故意创建不完整的配置
            const incompleteConfig = {
                indentSize: 4
                // 缺少其他属性
            };
            
            expect(() => {
                const testEngine = new FormattingEngine(incompleteConfig);
                testEngine.dispose();
            }).not.toThrow();
        });
    });

    describe('编码和字符集测试', () => {
        test('应该处理UTF-8编码的代码', async () => {
            const input = `
void test_utf8() {
    string 中文变量 = "中文字符串";
    write(中文变量);
}`;
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            if (result.success && result.formattedText) {
                expect(result.formattedText).toContain('中文变量');
                expect(result.formattedText).toContain('中文字符串');
            }
        });

        test('应该处理包含转义字符的代码', async () => {
            const input = `
void test_escape() {
    write("Line 1\\nLine 2\\tTabbed\\\"Quoted\\"");
    write('Single\\0Null\\xFF');
}`;
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            if (result.success && result.formattedText) {
                expect(result.formattedText).toContain('\\n');
                expect(result.formattedText).toContain('\\t');
                expect(result.formattedText).toContain('\\"');
            }
        });
    });

    describe('二进制数据处理', () => {
        test('应该处理包含二进制数据的字符串', async () => {
            const input = `void test() { write("\\x00\\x01\\xFF"); }`;
            
            const result = await engine.formatText(input);
            
            expect(result).toBeDefined();
            if (result.success && result.formattedText) {
                expect(result.formattedText).toContain('\\x00');
            }
        });
    });
});
