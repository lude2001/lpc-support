/**
 * FunctionUtils单元测试
 * 测试函数工具类的各种功能
 */

import { FunctionUtils } from '../functionUtils';

// Mock document对象用于测试
const mockDocument = {
    createElement: jest.fn(() => {
        const element: any = {
            _textContent: '',
            innerHTML: ''
        };

        // 使用 Object.defineProperty 定义 getter 和 setter
        Object.defineProperty(element, 'textContent', {
            get() {
                return this._textContent;
            },
            set(value: string) {
                this._textContent = value;
                // 模拟浏览器的textContent设置行为
                this.innerHTML = value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            },
            enumerable: true,
            configurable: true
        });

        return element;
    })
};

// 在测试中设置global.document
(global as any).document = mockDocument;

describe('FunctionUtils', () => {
    describe('getReturnType', () => {
        test('应该正确提取简单类型', () => {
            expect(FunctionUtils.getReturnType('void test()')).toBe('void');
            expect(FunctionUtils.getReturnType('int calculate()')).toBe('int');
            expect(FunctionUtils.getReturnType('string getName()')).toBe('string');
            expect(FunctionUtils.getReturnType('mixed getData()')).toBe('mixed');
        });

        test('应该正确提取指针类型', () => {
            expect(FunctionUtils.getReturnType('int *getArray()')).toBe('int *');
            expect(FunctionUtils.getReturnType('string *getStrings()')).toBe('string *');
            expect(FunctionUtils.getReturnType('object *getObjects()')).toBe('object *');
        });

        test('应该处理带有前导空格的定义', () => {
            expect(FunctionUtils.getReturnType('  void test()')).toBe('void');
            expect(FunctionUtils.getReturnType('\t\tint calculate()')).toBe('int');
            expect(FunctionUtils.getReturnType('   string * getArray()')).toBe('string *');
        });

        test('应该处理复杂函数签名', () => {
            expect(FunctionUtils.getReturnType('mapping getData(int x, string y)')).toBe('mapping');
            expect(FunctionUtils.getReturnType('mixed *getItems(void)')).toBe('mixed *');
        });

        test('应该处理空字符串', () => {
            expect(FunctionUtils.getReturnType('')).toBe('');
        });

        test('应该处理只有类型的字符串', () => {
            expect(FunctionUtils.getReturnType('void')).toBe('void');
            expect(FunctionUtils.getReturnType('int *')).toBe('int *');
        });

        test('应该处理格式不正确的定义', () => {
            expect(FunctionUtils.getReturnType('()')).toBe('');
            expect(FunctionUtils.getReturnType('test()')).toBe('test');
        });
    });

    describe('getGroupType', () => {
        test('应该识别包含文件', () => {
            expect(FunctionUtils.getGroupType('包含文件: /std/object.h')).toBe('included');
            expect(FunctionUtils.getGroupType('来自包含文件')).toBe('included');
            expect(FunctionUtils.getGroupType('包含文件中的函数')).toBe('included');
        });

        test('应该识别继承文件', () => {
            expect(FunctionUtils.getGroupType('继承自: /std/object.c')).toBe('inherited');
            expect(FunctionUtils.getGroupType('来自继承')).toBe('inherited');
            expect(FunctionUtils.getGroupType('父类')).toBe('inherited');
        });

        test('应该处理空字符串', () => {
            expect(FunctionUtils.getGroupType('')).toBe('inherited');
        });

        test('应该默认返回继承类型', () => {
            expect(FunctionUtils.getGroupType('其他类型')).toBe('inherited');
            expect(FunctionUtils.getGroupType('unknown')).toBe('inherited');
        });
    });

    describe('sanitizeId', () => {
        test('应该移除非法字符', () => {
            expect(FunctionUtils.sanitizeId('test@file#123')).toBe('test-file-123');
            expect(FunctionUtils.sanitizeId('my.function.name')).toBe('my-function-name');
            expect(FunctionUtils.sanitizeId('test/path/to/file')).toBe('test-path-to-file');
        });

        test('应该保留合法字符', () => {
            expect(FunctionUtils.sanitizeId('test_function_123')).toBe('test_function_123');
            expect(FunctionUtils.sanitizeId('my-element-id')).toBe('my-element-id');
            expect(FunctionUtils.sanitizeId('ABC123xyz')).toBe('ABC123xyz');
        });

        test('应该合并多个连续的连字符', () => {
            expect(FunctionUtils.sanitizeId('test---multiple---dashes')).toBe('test-multiple-dashes');
            expect(FunctionUtils.sanitizeId('a..b..c')).toBe('a-b-c');
            expect(FunctionUtils.sanitizeId('test///path')).toBe('test-path');
        });

        test('应该处理特殊字符组合', () => {
            expect(FunctionUtils.sanitizeId('test@#$%file')).toBe('test-file');
            expect(FunctionUtils.sanitizeId('(test)')).toBe('-test-');
            expect(FunctionUtils.sanitizeId('[array]')).toBe('-array-');
        });

        test('应该处理空字符串', () => {
            expect(FunctionUtils.sanitizeId('')).toBe('');
        });

        test('应该处理只包含非法字符的字符串', () => {
            expect(FunctionUtils.sanitizeId('###')).toBe('-');
            expect(FunctionUtils.sanitizeId('...')).toBe('-');
        });

        test('应该处理Unicode字符', () => {
            expect(FunctionUtils.sanitizeId('测试函数')).toBe('-');
            expect(FunctionUtils.sanitizeId('test函数123')).toBe('test-123');
        });

        test('应该生成有效的HTML ID', () => {
            const testCases = [
                '/std/object.c::create',
                'test_function(int x, string y)',
                'my.namespace.function',
                'array[0]->value'
            ];

            testCases.forEach(testCase => {
                const result = FunctionUtils.sanitizeId(testCase);
                // 验证结果只包含字母、数字、连字符和下划线
                expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
            });
        });
    });

    describe('escapeHtml', () => {
        test('应该转义基本HTML字符', () => {
            expect(FunctionUtils.escapeHtml('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
            expect(FunctionUtils.escapeHtml('a & b')).toBe('a &amp; b');
            expect(FunctionUtils.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(FunctionUtils.escapeHtml("'single'")).toBe('&#39;single&#39;');
        });

        test('应该转义所有特殊字符', () => {
            expect(FunctionUtils.escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
        });

        test('应该处理混合内容', () => {
            const input = '<script>alert("XSS & injection")</script>';
            const expected = '&lt;script&gt;alert(&quot;XSS &amp; injection&quot;)&lt;/script&gt;';
            expect(FunctionUtils.escapeHtml(input)).toBe(expected);
        });

        test('应该保留普通文本', () => {
            expect(FunctionUtils.escapeHtml('Hello World')).toBe('Hello World');
            expect(FunctionUtils.escapeHtml('123 456 789')).toBe('123 456 789');
            expect(FunctionUtils.escapeHtml('test_function')).toBe('test_function');
        });

        test('应该处理空字符串', () => {
            expect(FunctionUtils.escapeHtml('')).toBe('');
        });

        test('应该处理多次转义的情况', () => {
            const text = '&amp;';
            const escaped1 = FunctionUtils.escapeHtml(text);
            expect(escaped1).toBe('&amp;amp;');

            const escaped2 = FunctionUtils.escapeHtml(escaped1);
            expect(escaped2).toBe('&amp;amp;amp;');
        });

        test('应该处理长文本', () => {
            const longText = '<div>' + 'a'.repeat(1000) + '&</div>';
            const escaped = FunctionUtils.escapeHtml(longText);
            expect(escaped).toContain('&lt;div&gt;');
            expect(escaped).toContain('&amp;');
            expect(escaped).toContain('&lt;/div&gt;');
        });

        test('应该防止XSS攻击', () => {
            // 测试各种XSS攻击向量
            const imgXss = '<img src=x onerror=alert(1)>';
            const escapedImg = FunctionUtils.escapeHtml(imgXss);
            expect(escapedImg).not.toContain('<img');
            expect(escapedImg).toContain('&lt;img');
            expect(escapedImg).toContain('&gt;');

            const scriptXss = '<script>alert(document.cookie)</script>';
            const escapedScript = FunctionUtils.escapeHtml(scriptXss);
            expect(escapedScript).not.toContain('<script');
            expect(escapedScript).toContain('&lt;script&gt;');

            const iframeXss = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
            const escapedIframe = FunctionUtils.escapeHtml(iframeXss);
            expect(escapedIframe).not.toContain('<iframe');
            expect(escapedIframe).toContain('&lt;iframe');

            // 测试纯文本XSS(无HTML标签)
            const jsXss = "javascript:alert('XSS')";
            const escapedJs = FunctionUtils.escapeHtml(jsXss);
            expect(escapedJs).toContain('&#39;'); // 单引号应被转义
        });

        test('应该处理换行符和制表符', () => {
            const text = 'line1\nline2\tindented';
            const escaped = FunctionUtils.escapeHtml(text);
            // 换行符和制表符应该被保留
            expect(escaped).toContain('\n');
            expect(escaped).toContain('\t');
        });
    });

    describe('边界条件和错误处理', () => {
        test('getReturnType应该处理null和undefined', () => {
            expect(FunctionUtils.getReturnType(null as any)).toBe('');
            expect(FunctionUtils.getReturnType(undefined as any)).toBe('');
        });

        test('所有方法应该处理极端情况', () => {
            const extremeCases = [
                '',
                ' ',
                '\n',
                '\t',
                '\r\n'
            ];

            extremeCases.forEach(testCase => {
                expect(() => FunctionUtils.getReturnType(testCase)).not.toThrow();
                expect(() => FunctionUtils.getGroupType(testCase)).not.toThrow();
                expect(() => FunctionUtils.sanitizeId(testCase)).not.toThrow();
                expect(() => FunctionUtils.escapeHtml(testCase)).not.toThrow();
            });
        });
    });

    describe('性能测试', () => {
        test('sanitizeId应该高效处理大量字符串', () => {
            const longString = 'a'.repeat(10000) + '@#$%^&*()' + 'b'.repeat(10000);
            const startTime = Date.now();

            const result = FunctionUtils.sanitizeId(longString);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // 应该在合理时间内完成（小于100ms）
            expect(executionTime).toBeLessThan(100);
            expect(result).toMatch(/^[a-zA-Z0-9_-]+$/);
        });

        test('escapeHtml应该高效处理大量HTML', () => {
            const htmlString = '<div>' + '&<>"\''.repeat(1000) + '</div>';
            const startTime = Date.now();

            const result = FunctionUtils.escapeHtml(htmlString);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // 应该在合理时间内完成（小于100ms）
            expect(executionTime).toBeLessThan(100);
            expect(result).toContain('&amp;');
            expect(result).toContain('&lt;');
        });
    });

    describe('集成场景', () => {
        test('应该处理完整的函数文档生成流程', () => {
            const definition = 'string *query_items()';
            const source = '包含文件: /std/object.h';
            const description = '<script>Function description with "quotes" & special chars</script>';

            const returnType = FunctionUtils.getReturnType(definition);
            const groupType = FunctionUtils.getGroupType(source);
            const elementId = FunctionUtils.sanitizeId(definition);
            const safeDescription = FunctionUtils.escapeHtml(description);

            expect(returnType).toBe('string *');
            expect(groupType).toBe('included');
            expect(elementId).toMatch(/^[a-zA-Z0-9_-]+$/);
            expect(safeDescription).not.toContain('<script>');
            expect(safeDescription).toContain('&lt;script&gt;');
        });
    });
});
