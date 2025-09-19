/**
 * 基本测试文件
 * 验证测试框架是否正常工作
 */

import { TestHelper } from '../../utils/TestHelper';
import { DEFAULT_FORMATTING_CONFIG } from '../../../src/formatting/config/DefaultConfig';

// VS Code API已在jest.setup.ts中进行mock

describe('基本测试框架验证', () => {
    describe('测试环境设置', () => {
        test('应该能够运行基本测试', () => {
            expect(true).toBe(true);
        });

        test('应该能够访问VS Code mock', () => {
            const vscode = require('vscode');
            expect(vscode).toBeDefined();
            expect(vscode.window).toBeDefined();
            expect(vscode.workspace).toBeDefined();
        });

        test('应该能够使用TestHelper', () => {
            const document = TestHelper.createMockDocument('test code', 'lpc');
            expect(document).toBeDefined();
            expect(document.languageId).toBe('lpc');
            expect(document.getText()).toBe('test code');
        });

        test('应该能够加载默认配置', () => {
            expect(DEFAULT_FORMATTING_CONFIG).toBeDefined();
            expect(DEFAULT_FORMATTING_CONFIG.indentSize).toBe(4);
            expect(DEFAULT_FORMATTING_CONFIG.useSpaces).toBe(true);
        });
    });

    describe('测试工具类验证', () => {
        test('应该能够创建Mock文档', () => {
            const code = 'void test() { return; }';
            const document = TestHelper.createMockDocument(code, 'lpc');
            
            expect(document.fileName).toBe('test.c');
            expect(document.languageId).toBe('lpc');
            expect(document.getText()).toBe(code);
            expect(document.lineCount).toBe(1);
        });

        test('应该能够创建Mock位置', () => {
            const position = TestHelper.createMockPosition(5, 10);
            
            expect(position.line).toBe(5);
            expect(position.character).toBe(10);
        });

        test('应该能够创建Mock范围', () => {
            const range = TestHelper.createMockRange(1, 0, 3, 5);
            
            expect(range.start.line).toBe(1);
            expect(range.start.character).toBe(0);
            expect(range.end.line).toBe(3);
            expect(range.end.character).toBe(5);
        });

        test('应该能够创建测试配置', () => {
            const config = TestHelper.createTestConfig({
                indentSize: 2,
                useSpaces: false
            });
            
            expect(config.indentSize).toBe(2);
            expect(config.useSpaces).toBe(false);
            expect(config.spaceAroundOperators).toBe(true); // 应该使用默认值
        });

        test('应该能够生成测试数据', () => {
            const perfData = TestHelper.createPerformanceTestData();
            
            expect(perfData.small).toBeDefined();
            expect(perfData.medium).toBeDefined();
            expect(perfData.large).toBeDefined();
            expect(perfData.xlarge).toBeDefined();
            
            expect(perfData.small.length).toBeLessThan(perfData.medium.length);
            expect(perfData.medium.length).toBeLessThan(perfData.large.length);
            expect(perfData.large.length).toBeLessThan(perfData.xlarge.length);
        });

        test('应该能够生成LPC测试代码', () => {
            const code = TestHelper.createLPCTestCode({
                hasInherit: true,
                hasFunctions: true,
                hasArrays: true
            });
            
            expect(code).toContain('inherit');
            expect(code).toContain('void');
            expect(code).toContain('({');
        });

        test('应该能够验证格式化结果', () => {
            const original = 'void test(){return;}';
            const formatted = 'void test() {\n    return;\n}';
            
            const validation = TestHelper.validateFormattedCode(original, formatted);
            expect(validation.isValid).toBe(true);
            expect(validation.issues.length).toBe(0);
        });
    });

    describe('性能测试工具', () => {
        test('应该能够测量执行时间', async () => {
            const startTime = Date.now();
            
            // 模拟一个异步操作
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThanOrEqual(10);
        });

        test('应该能够等待条件', async () => {
            let condition = false;
            
            // 在100ms后设置条件为true
            setTimeout(() => {
                condition = true;
            }, 100);
            
            await TestHelper.waitForCondition(() => condition, 200, 50);
            expect(condition).toBe(true);
        });

        test('应该在超时时抛出错误', async () => {
            await expect(
                TestHelper.waitForCondition(() => false, 100, 50)
            ).rejects.toThrow('Condition not met within 100ms');
        });
    });

    describe('扩展期望函数测试', () => {
        test('应该支持toBeWithinRange匹配器', () => {
            // @ts-ignore - 使用扩展的匹配器
            expect(5).toBeWithinRange(1, 10);
            // @ts-ignore
            expect(0).not.toBeWithinRange(1, 10);
            // @ts-ignore
            expect(15).not.toBeWithinRange(1, 10);
        });
    });

    describe('环境变量测试', () => {
        test('应该设置正确的环境变量', () => {
            expect(process.env.NODE_ENV).toBe('test');
            expect(process.env.VSCODE_TEST_DATA_PATH).toBe('./test-data');
        });
    });
});
