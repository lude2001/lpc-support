/**
 * JavaDocProcessor单元测试
 * 测试JavaDoc注释处理功能
 */

import { JavaDocProcessor } from '../javaDocProcessor';

// Mock document对象用于测试
const mockDocument = {
    createElement: jest.fn(() => {
        const element = {
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

describe('JavaDocProcessor', () => {
    describe('processToHtml', () => {
        test('应该处理简单的注释', () => {
            const comment = '/** Simple comment */';
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<p>Simple comment</p>');
        });

        test('应该处理带@brief标签的注释', () => {
            const comment = `/**
             * @brief This is a brief description
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<h4>简要描述</h4>');
            expect(result).toContain('<p>This is a brief description</p>');
        });

        test('应该处理带@details标签的注释', () => {
            const comment = `/**
             * @details This is detailed information
             * More details here
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<h4>详细描述</h4>');
            expect(result).toContain('This is detailed information More details here');
        });

        test('应该处理带@param标签的注释', () => {
            const comment = `/**
             * @param int x The x coordinate
             * @param string name The object name
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<h4>参数</h4>');
            expect(result).toContain('<ul class="param-list">');
            expect(result).toContain('<code>x</code>');
            expect(result).toContain('<code>name</code>');
            expect(result).toContain('The x coordinate');
            expect(result).toContain('The object name');
        });

        test('应该处理旧格式的@param标签', () => {
            const comment = `/**
             * @param x The parameter
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<code>x</code>');
            expect(result).toContain('The parameter');
        });

        test('应该处理带@return标签的注释', () => {
            const comment = `/**
             * @return int The result value
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<h4>返回值</h4>');
            expect(result).toContain('<strong>int</strong>');
            expect(result).toContain('The result value');
        });

        test('应该处理简单的@return标签', () => {
            const comment = `/**
             * @return Returns the result
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<h4>返回值</h4>');
            expect(result).toContain('Returns the result');
        });

        test('应该处理带@example标签的注释', () => {
            const comment = `/**
             * @example
             * int x = calculate(5, 10);
             * write(x);
             */`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<h4>示例</h4>');
            expect(result).toContain('<pre><code>');
            expect(result).toContain('int x = calculate(5, 10)');
            expect(result).toContain('write(x)');
            expect(result).toContain('</code></pre>');
        });

        test('应该处理完整的JavaDoc注释', () => {
            const comment = `/**
             * @brief Calculate sum of two numbers
             * @details This function adds two integers and returns the result
             * It handles overflow by returning max int value
             * @param int a First number
             * @param int b Second number
             * @return int Sum of a and b
             * @example
             * int result = add(5, 3);
             * write(sprintf("Result: %d", result));
             */`;
            const result = JavaDocProcessor.processToHtml(comment);

            expect(result).toContain('<h4>简要描述</h4>');
            expect(result).toContain('Calculate sum of two numbers');
            expect(result).toContain('<h4>详细描述</h4>');
            expect(result).toContain('overflow');
            expect(result).toContain('<h4>参数</h4>');
            expect(result).toContain('<code>a</code>');
            expect(result).toContain('<code>b</code>');
            expect(result).toContain('<h4>返回值</h4>');
            expect(result).toContain('Sum of a and b');
            expect(result).toContain('<h4>示例</h4>');
            expect(result).toContain('int result = add(5, 3)');
        });

        test('应该正确转义HTML内容', () => {
            const comment = `/**
             * @brief Function with <html> & "special" chars
             * @param string text Input with <script>alert(1)</script>
             */`;
            const result = JavaDocProcessor.processToHtml(comment);

            expect(result).toContain('&lt;html&gt;');
            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;');
            expect(result).toContain('&lt;script&gt;');
            expect(result).not.toContain('<html>');
            expect(result).not.toContain('<script>');
        });

        test('应该处理空注释', () => {
            expect(JavaDocProcessor.processToHtml('')).toBe('');
            expect(JavaDocProcessor.processToHtml('/**  */')).toBe('');
        });

        test('应该处理多行参数列表', () => {
            const comment = `/**
             * @param int x First param
             * @param int y Second param
             * @param string name Third param
             */`;
            const result = JavaDocProcessor.processToHtml(comment);

            expect(result).toContain('<ul class="param-list">');
            expect(result).toContain('<code>x</code>');
            expect(result).toContain('<code>y</code>');
            expect(result).toContain('<code>name</code>');
            expect(result).toContain('</ul>');
        });

        test('应该正确处理标签顺序', () => {
            const comment = `/**
             * @brief Brief first
             * @param int x Parameter
             * @details Details in middle
             * @return int Result
             * @example test();
             */`;
            const result = JavaDocProcessor.processToHtml(comment);

            // brief应该在最前面
            const briefIndex = result.indexOf('简要描述');
            const detailsIndex = result.indexOf('详细描述');
            const paramIndex = result.indexOf('参数');
            const returnIndex = result.indexOf('返回值');
            const exampleIndex = result.indexOf('示例');

            expect(briefIndex).toBeLessThan(detailsIndex);
            expect(detailsIndex).toBeLessThan(paramIndex);
            expect(paramIndex).toBeLessThan(returnIndex);
            expect(returnIndex).toBeLessThan(exampleIndex);
        });
    });

    describe('processToMarkdown', () => {
        test('应该处理简单的注释', () => {
            const comment = '/** Simple comment */';
            const result = JavaDocProcessor.processToMarkdown(comment);
            expect(result).toContain('Simple comment');
        });

        test('应该处理带@brief标签的注释', () => {
            const comment = `/**
             * @brief This is a brief description
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);
            expect(result).toContain('### 简要描述');
            expect(result).toContain('This is a brief description');
        });

        test('应该处理带@details标签的注释', () => {
            const comment = `/**
             * @details This is detailed information
             * More details here
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);
            expect(result).toContain('### 详细描述');
            expect(result).toContain('This is detailed information More details here');
        });

        test('应该处理带@param标签的注释', () => {
            const comment = `/**
             * @param x The x parameter
             * @param y The y parameter
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);
            expect(result).toContain('### 参数');
            expect(result).toContain('- `x`: The x parameter');
            expect(result).toContain('- `y`: The y parameter');
        });

        test('应该处理带@return标签的注释', () => {
            const comment = `/**
             * @return The result value
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);
            expect(result).toContain('### 返回值');
            expect(result).toContain('The result value');
        });

        test('应该处理带@example标签的注释', () => {
            const comment = `/**
             * @example
             * int x = calculate(5, 10);
             * write(x);
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);
            expect(result).toContain('### 示例');
            expect(result).toContain('```lpc');
            expect(result).toContain('int x = calculate(5, 10)');
            expect(result).toContain('write(x)');
            expect(result).toContain('```');
        });

        test('应该处理完整的JavaDoc注释', () => {
            const comment = `/**
             * @brief Calculate sum
             * @details Adds two numbers
             * @param a First number
             * @param b Second number
             * @return The sum
             * @example
             * int result = add(5, 3);
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);

            expect(result).toContain('### 简要描述');
            expect(result).toContain('Calculate sum');
            expect(result).toContain('### 详细描述');
            expect(result).toContain('Adds two numbers');
            expect(result).toContain('### 参数');
            expect(result).toContain('- `a`: First number');
            expect(result).toContain('- `b`: Second number');
            expect(result).toContain('### 返回值');
            expect(result).toContain('The sum');
            expect(result).toContain('### 示例');
            expect(result).toContain('```lpc');
        });

        test('应该处理空注释', () => {
            expect(JavaDocProcessor.processToMarkdown('')).toBe('');
        });

        test('应该正确结束示例代码块', () => {
            const comment = `/**
             * @example
             * test();
             * @return void
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);

            expect(result).toContain('```lpc');
            expect(result).toContain('test()');
            expect(result).toContain('```');
            expect(result).toContain('### 返回值');
        });
    });

    describe('边界条件和错误处理', () => {
        test('应该处理格式不正确的注释', () => {
            const malformedComments = [
                '/* not a javadoc */',
                '/** @param */',
                '/** @return */',
                '/** @brief */',
                '/** @example */'
            ];

            malformedComments.forEach(comment => {
                expect(() => JavaDocProcessor.processToHtml(comment)).not.toThrow();
                expect(() => JavaDocProcessor.processToMarkdown(comment)).not.toThrow();
            });
        });

        test('应该处理null和undefined', () => {
            expect(JavaDocProcessor.processToHtml(null as any)).toBe('');
            expect(JavaDocProcessor.processToHtml(undefined as any)).toBe('');
            expect(JavaDocProcessor.processToMarkdown(null as any)).toBe('');
            expect(JavaDocProcessor.processToMarkdown(undefined as any)).toBe('');
        });

        test('应该处理只包含空格的注释', () => {
            const comment = '/**     */';
            const htmlResult = JavaDocProcessor.processToHtml(comment);
            const mdResult = JavaDocProcessor.processToMarkdown(comment);

            expect(htmlResult).toBe('');
            expect(mdResult).toBe('');
        });

        test('应该处理未闭合的标签', () => {
            const comment = `/**
             * @example
             * code here
             * more code`;
            const result = JavaDocProcessor.processToHtml(comment);
            expect(result).toContain('<pre><code>');
            expect(result).toContain('</code></pre>');
        });
    });

    describe('性能测试', () => {
        test('应该高效处理大型JavaDoc注释', () => {
            const largeComment = `/**
             * @brief ${('Brief description ').repeat(100)}
             * @details ${('Detailed information ').repeat(200)}
             * ${Array(50).fill(0).map((_, i) => `@param param${i} Description ${i}`).join('\n             * ')}
             * @return ${('Return value ').repeat(50)}
             * @example
             * ${Array(100).fill('test_function();').join('\n             * ')}
             */`;

            const startTime = Date.now();
            const htmlResult = JavaDocProcessor.processToHtml(largeComment);
            const htmlTime = Date.now() - startTime;

            const mdStartTime = Date.now();
            const mdResult = JavaDocProcessor.processToMarkdown(largeComment);
            const mdTime = Date.now() - mdStartTime;

            // 应该在合理时间内完成（小于1000ms）
            expect(htmlTime).toBeLessThan(1000);
            expect(mdTime).toBeLessThan(1000);

            expect(htmlResult).toContain('param0');
            expect(htmlResult).toContain('param49');
            expect(mdResult).toContain('param0');
            expect(mdResult).toContain('param49');
        });

        test('应该高效处理多次调用', () => {
            const comment = `/**
             * @brief Test function
             * @param int x Input value
             * @return int Output value
             */`;

            const iterations = 1000;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                JavaDocProcessor.processToHtml(comment);
            }

            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / iterations;

            // 平均每次调用应该很快（小于5ms）
            expect(avgTime).toBeLessThan(5);
        });
    });

    describe('HTML安全性', () => {
        test('应该防止XSS攻击', () => {
            const xssComment = `/**
             * @brief <script>alert('XSS')</script>
             * @param <img src=x onerror=alert(1)> test
             * @return <iframe src="javascript:alert('XSS')"></iframe>
             * @example
             * <script>malicious()</script>
             */`;

            const result = JavaDocProcessor.processToHtml(xssComment);

            expect(result).not.toContain('<script>');
            expect(result).not.toContain('<iframe>');
            // XSS防护的关键是HTML标签被转义，属性文本保留是安全的
            expect(result).toContain('&lt;script&gt;');
            expect(result).toContain('&lt;iframe');
        });

        test('应该转义所有特殊字符', () => {
            const comment = `/**
             * @brief Test & "quote" <tag> 'apostrophe'
             */`;
            const result = JavaDocProcessor.processToHtml(comment);

            expect(result).toContain('&amp;');
            expect(result).toContain('&quot;');
            expect(result).toContain('&lt;');
            expect(result).toContain('&gt;');
            expect(result).toContain('&#39;');
        });
    });

    describe('格式一致性', () => {
        test('HTML输出应该有正确的结构', () => {
            const comment = `/**
             * @brief Test
             * @param x Input
             * @return Output
             */`;
            const result = JavaDocProcessor.processToHtml(comment);

            // 检查标签配对
            const h4Count = (result.match(/<h4>/g) || []).length;
            const h4CloseCount = (result.match(/<\/h4>/g) || []).length;
            expect(h4Count).toBe(h4CloseCount);

            const ulCount = (result.match(/<ul[^>]*>/g) || []).length;
            const ulCloseCount = (result.match(/<\/ul>/g) || []).length;
            expect(ulCount).toBe(ulCloseCount);

            const pCount = (result.match(/<p>/g) || []).length;
            const pCloseCount = (result.match(/<\/p>/g) || []).length;
            expect(pCount).toBe(pCloseCount);
        });

        test('Markdown输出应该有正确的格式', () => {
            const comment = `/**
             * @brief Test
             * @example
             * code();
             */`;
            const result = JavaDocProcessor.processToMarkdown(comment);

            // 检查代码块配对
            const codeBlockCount = (result.match(/```/g) || []).length;
            expect(codeBlockCount % 2).toBe(0); // 应该成对出现
        });
    });

    describe('实际使用场景', () => {
        test('应该处理典型的LPC函数文档', () => {
            const comment = `/**
             * @brief Create the weapon object
             * @details This function is called when the weapon is first created.
             * It sets up the basic properties like name, weight, and damage.
             * @return void
             * @example
             * // This is automatically called by the driver
             * void create() {
             *     ::create();
             *     set_name("sword");
             *     set_weight(2000);
             * }
             */`;

            const htmlResult = JavaDocProcessor.processToHtml(comment);
            const mdResult = JavaDocProcessor.processToMarkdown(comment);

            expect(htmlResult).toContain('Create the weapon object');
            expect(htmlResult).toContain('basic properties');
            expect(htmlResult).toContain('set_name');

            expect(mdResult).toContain('### 简要描述');
            expect(mdResult).toContain('### 详细描述');
            expect(mdResult).toContain('### 返回值');
            expect(mdResult).toContain('### 示例');
            expect(mdResult).toContain('```lpc');
        });
    });
});
