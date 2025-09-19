/**
 * FormattingController 单元测试
 * 测试格式化控制器的核心功能
 */

import { FormattingController } from '../../../src/formatting/controller/FormattingController';
import { FormattingConfig } from '../../../src/formatting/config/FormattingConfig';
import { TestHelper } from '../../utils/TestHelper';

// VS Code API已在jest.setup.ts中进行mock

describe('FormattingController', () => {
    let controller: FormattingController;
    let mockDocument: any;

    beforeEach(() => {
        controller = new FormattingController();
        mockDocument = TestHelper.createMockDocument(
            'void test() { write("hello"); }',
            'lpc'
        );
    });

    afterEach(() => {
        controller.dispose();
    });

    describe('初始化测试', () => {
        test('应该正确初始化控制器', () => {
            expect(controller).toBeDefined();
            expect(controller.getConfiguration()).toBeDefined();
            expect(controller.getRuleEngine()).toBeDefined();
        });

        test('应该支持LPC文档', () => {
            expect(controller.supportsDocument(mockDocument)).toBe(true);
        });

        test('不应该支持非LPC文档', () => {
            const nonLpcDoc = TestHelper.createMockDocument('console.log("test");', 'javascript');
            expect(controller.supportsDocument(nonLpcDoc)).toBe(false);
        });
    });

    describe('配置管理测试', () => {
        test('应该返回默认配置', () => {
            const config = controller.getConfiguration();
            expect(config.indentSize).toBe(4);
            expect(config.useSpaces).toBe(true);
            expect(config.spaceAroundOperators).toBe(true);
        });

        test('应该能够更新配置', async () => {
            const newConfig: Partial<FormattingConfig> = {
                indentSize: 2,
                useSpaces: false
            };

            await controller.updateConfiguration(newConfig);
            const updatedConfig = controller.getConfiguration();

            expect(updatedConfig.indentSize).toBe(2);
            expect(updatedConfig.useSpaces).toBe(false);
        });
    });

    describe('格式化功能测试', () => {
        test('应该格式化简单LPC代码', async () => {
            const testCode = 'void test(){write("hello");}';
            const document = TestHelper.createMockDocument(testCode, 'lpc');

            const edits = await controller.formatDocument(document);
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该格式化代码范围', async () => {
            const testCode = 'void test()\n{\nwrite("hello");\n}';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            const range = TestHelper.createMockRange(1, 0, 2, 16);

            const edits = await controller.formatRange(document, range);
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该处理空文档', async () => {
            const emptyDocument = TestHelper.createMockDocument('', 'lpc');
            const edits = await controller.formatDocument(emptyDocument);
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该处理语法错误的代码', async () => {
            const invalidCode = 'void test( { invalid syntax }';
            const document = TestHelper.createMockDocument(invalidCode, 'lpc');

            const edits = await controller.formatDocument(document);
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });
    });

    describe('性能统计测试', () => {
        test('应该提供性能统计信息', () => {
            const stats = controller.getPerformanceStats();
            expect(stats).toBeDefined();
            expect(typeof stats.totalOperations).toBe('number');
            expect(typeof stats.averageFormatTime).toBe('number');
        });

        test('应该提供缓存统计信息', () => {
            const cacheStats = controller.getCacheStats();
            expect(cacheStats).toBeDefined();
            expect(cacheStats.main).toBeDefined();
            expect(cacheStats.incremental).toBeDefined();
        });

        test('应该能够清空缓存', () => {
            controller.clearCache();
            const cacheStats = controller.getCacheStats();
            expect(cacheStats.main.size).toBe(0);
        });

        test('应该能够重置性能统计', () => {
            controller.resetPerformanceStats();
            const stats = controller.getPerformanceStats();
            expect(stats.totalOperations).toBe(0);
        });
    });

    describe('诊断信息测试', () => {
        test('应该提供诊断信息', () => {
            const diagnostics = controller.getDiagnostics();
            expect(diagnostics).toBeDefined();
            expect(diagnostics.controller).toBeDefined();
            expect(diagnostics.engine).toBeDefined();
            expect(diagnostics.rules).toBeDefined();
            expect(diagnostics.cache).toBeDefined();
            expect(diagnostics.performance).toBeDefined();
        });
    });

    describe('错误处理测试', () => {
        test('应该优雅处理格式化异常', async () => {
            // 创建一个会导致异常的mock文档
            const problematicDocument = {
                ...mockDocument,
                getText: () => { throw new Error('Mock error'); }
            };

            const edits = await controller.formatDocument(problematicDocument);
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
            expect(edits.length).toBe(0); // 错误时应返回空数组
        });
    });

    describe('资源清理测试', () => {
        test('应该正确清理资源', () => {
            const testController = new FormattingController();
            expect(() => testController.dispose()).not.toThrow();
        });
    });
});
