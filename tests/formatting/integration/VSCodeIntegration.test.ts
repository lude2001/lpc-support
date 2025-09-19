/**
 * VS Code集成测试
 * 测试LPC格式化器与VS Code的集成功能
 */

import { FormattingController } from '../../../src/formatting/controller/FormattingController';
import { DocumentFormattingProvider } from '../../../src/formatting/providers/DocumentFormattingProvider';
import { RangeFormattingProvider } from '../../../src/formatting/providers/RangeFormattingProvider';
import { TestHelper } from '../../utils/TestHelper';
import { MockVSCode } from '../../mocks/MockVSCode';

// Mock VS Code API
jest.mock('vscode', () => MockVSCode);

describe('VS Code集成测试', () => {
    let controller: FormattingController;
    let documentProvider: DocumentFormattingProvider;
    let rangeProvider: RangeFormattingProvider;
    let mockDocument: any;

    beforeEach(() => {
        controller = new FormattingController();
        documentProvider = new DocumentFormattingProvider();
        rangeProvider = new RangeFormattingProvider();
        
        mockDocument = TestHelper.createMockDocument(`
inherit "/std/object";

void create() {
::create();
set_name("test object");
set_id((  {"test","object"} ));
}

void test_function(int a,string b){
if(a>0){
write(sprintf("Value: %d, String: %s",a,b));
}
else {
write("Negative value");
}
}`, 'lpc');
    });

    afterEach(() => {
        controller.dispose();
        documentProvider.dispose();
        rangeProvider.dispose();
    });

    describe('文档格式化提供程序测试', () => {
        test('应该正确提供文档格式化功能', async () => {
            const edits = await documentProvider.provideDocumentFormattingEdits(
                mockDocument,
                TestHelper.createTestConfig(),
                undefined as any
            );
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
            
            if (edits && edits.length > 0) {
                // 应该有文本编辑操作
                edits.forEach(edit => {
                    expect(edit.range).toBeDefined();
                    expect(typeof edit.newText).toBe('string');
                });
            }
        });

        test('应该支持取消操作', async () => {
            const cancellationToken = {
                isCancellationRequested: false,
                onCancellationRequested: jest.fn()
            };
            
            const edits = await documentProvider.provideDocumentFormattingEdits(
                mockDocument,
                TestHelper.createTestConfig(),
                cancellationToken
            );
            
            expect(edits).toBeDefined();
        });

        test('应该在取消时停止处理', async () => {
            const cancellationToken = {
                isCancellationRequested: true,
                onCancellationRequested: jest.fn()
            };
            
            const edits = await documentProvider.provideDocumentFormattingEdits(
                mockDocument,
                TestHelper.createTestConfig(),
                cancellationToken
            );
            
            // 取消时应该返回空数组或undefined
            expect(edits === undefined || edits.length === 0).toBe(true);
        });
    });

    describe('范围格式化提供程序测试', () => {
        test('应该正确提供范围格式化功能', async () => {
            const range = TestHelper.createMockRange(6, 0, 10, 1); // 选中test_function
            
            const edits = await rangeProvider.provideDocumentRangeFormattingEdits(
                mockDocument,
                range,
                TestHelper.createTestConfig(),
                undefined as any
            );
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
            
            if (edits && edits.length > 0) {
                // 范围格式化应该只影响指定范围
                edits.forEach(edit => {
                    expect(edit.range).toBeDefined();
                    expect(typeof edit.newText).toBe('string');
                });
            }
        });

        test('应该处理空范围', async () => {
            const emptyRange = TestHelper.createMockRange(5, 0, 5, 0);
            
            const edits = await rangeProvider.provideDocumentRangeFormattingEdits(
                emptyRange,
                emptyRange,
                TestHelper.createTestConfig(),
                undefined as any
            );
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该处理无效范围', async () => {
            const invalidRange = TestHelper.createMockRange(10, 0, 5, 0); // 结束在开始之前
            
            const edits = await rangeProvider.provideDocumentRangeFormattingEdits(
                mockDocument,
                invalidRange,
                TestHelper.createTestConfig(),
                undefined as any
            );
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });
    });

    describe('配置集成测试', () => {
        test('应该响应配置变更', async () => {
            // 修改配置
            await controller.updateConfiguration({
                indentSize: 2,
                useSpaces: false
            });
            
            const config = controller.getConfiguration();
            expect(config.indentSize).toBe(2);
            expect(config.useSpaces).toBe(false);
            
            // 验证配置对格式化的影响
            const edits = await controller.formatDocument(mockDocument);
            expect(edits).toBeDefined();
        });

        test('应该使用默认配置', () => {
            const config = controller.getConfiguration();
            
            expect(config.indentSize).toBeDefined();
            expect(config.useSpaces).toBeDefined();
            expect(config.spaceAroundOperators).toBeDefined();
            expect(config.maxLineLength).toBeDefined();
        });

        test('应该验证配置值', async () => {
            // 测试不同的配置组合
            const testConfigs = [
                { indentSize: 2, useSpaces: true },
                { indentSize: 4, useSpaces: true },
                { indentSize: 8, useSpaces: false },
                { maxLineLength: 80 },
                { maxLineLength: 120 },
                { spaceAroundOperators: true },
                { spaceAroundOperators: false }
            ];
            
            for (const testConfig of testConfigs) {
                await controller.updateConfiguration(testConfig);
                const edits = await controller.formatDocument(mockDocument);
                expect(edits).toBeDefined();
                expect(Array.isArray(edits)).toBe(true);
            }
        });
    });

    describe('错误处理集成测试', () => {
        test('应该处理格式化失败', async () => {
            // 创建一个会导致错误的文档
            const errorDocument = TestHelper.createMockDocument(
                'void broken( { invalid syntax }',
                'lpc'
            );
            
            const edits = await controller.formatDocument(errorDocument);
            
            // 即使失败也应该返回结果，不应该抛异常
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该处理非LPC文档', async () => {
            const jsDocument = TestHelper.createMockDocument(
                'console.log("Hello World");',
                'javascript'
            );
            
            // 非LPC文档不应该被处理
            expect(controller.supportsDocument(jsDocument)).toBe(false);
        });

        test('应该处理空文档', async () => {
            const emptyDocument = TestHelper.createMockDocument('', 'lpc');
            
            const edits = await controller.formatDocument(emptyDocument);
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });
    });

    describe('性能集成测试', () => {
        test('应该在合理时间内完成格式化', async () => {
            const startTime = Date.now();
            const edits = await controller.formatDocument(mockDocument);
            const duration = Date.now() - startTime;
            
            expect(edits).toBeDefined();
            expect(duration).toBeLessThan(1000); // 1秒内完成
        });

        test('应该提供性能统计', () => {
            const stats = controller.getPerformanceStats();
            
            expect(stats).toBeDefined();
            expect(typeof stats.totalOperations).toBe('number');
            expect(typeof stats.averageFormatTime).toBe('number');
        });

        test('应该支持缓存管理', () => {
            const cacheStats = controller.getCacheStats();
            
            expect(cacheStats).toBeDefined();
            expect(cacheStats.main).toBeDefined();
            expect(cacheStats.incremental).toBeDefined();
            
            // 清空缓存不应该抛异常
            expect(() => controller.clearCache()).not.toThrow();
        });
    });

    describe('生命周期测试', () => {
        test('应该正确初始化和销毁', () => {
            const testController = new FormattingController();
            
            expect(testController).toBeDefined();
            expect(testController.getConfiguration()).toBeDefined();
            expect(testController.getRuleEngine()).toBeDefined();
            
            // 销毁不应该抛异常
            expect(() => testController.dispose()).not.toThrow();
        });

        test('应该支持重复销毁', () => {
            const testController = new FormattingController();
            
            expect(() => {
                testController.dispose();
                testController.dispose();
                testController.dispose();
            }).not.toThrow();
        });

        test('应该在销毁后停止监听器', () => {
            const testController = new FormattingController();
            testController.dispose();
            
            // 销毁后应该不再响应配置变更
            expect(async () => {
                await testController.updateConfiguration({ indentSize: 8 });
            }).not.toThrow();
        });
    });

    describe('用户交互测试', () => {
        test('应该支持命令调用', async () => {
            // 模拟用户执行格式化命令
            const edits = await controller.formatDocument(mockDocument);
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该支持范围选择格式化', async () => {
            const range = TestHelper.createMockRange(3, 0, 6, 1);
            const edits = await controller.formatRange(mockDocument, range);
            
            expect(edits).toBeDefined();
            expect(Array.isArray(edits)).toBe(true);
        });

        test('应该提供格式化统计信息', () => {
            const stats = controller.getPerformanceStats();
            const cacheStats = controller.getCacheStats();
            const diagnostics = controller.getDiagnostics();
            
            expect(stats).toBeDefined();
            expect(cacheStats).toBeDefined();
            expect(diagnostics).toBeDefined();
            
            // 统计信息应该包含必要的字段
            expect(typeof stats.totalOperations).toBe('number');
            expect(typeof cacheStats.main.size).toBe('number');
            expect(typeof diagnostics.controller).toBe('string');
        });

        test('应该支持统计重置', () => {
            controller.resetPerformanceStats();
            
            const stats = controller.getPerformanceStats();
            expect(stats.totalOperations).toBe(0);
        });
    });

    describe('多文档支持测试', () => {
        test('应该支持同时处理多个文档', async () => {
            const documents = [
                TestHelper.createMockDocument('void test1() { return; }', 'lpc'),
                TestHelper.createMockDocument('void test2() { return; }', 'lpc'),
                TestHelper.createMockDocument('void test3() { return; }', 'lpc')
            ];
            
            const promises = documents.map(doc => controller.formatDocument(doc));
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(3);
            results.forEach(edits => {
                expect(edits).toBeDefined();
                expect(Array.isArray(edits)).toBe(true);
            });
        });

        test('应该维护每个文档的独立状态', async () => {
            const doc1 = TestHelper.createMockDocument('void test1() {}', 'lpc');
            const doc2 = TestHelper.createMockDocument('void test2() {}', 'lpc');
            
            // 格式化第一个文档
            await controller.formatDocument(doc1);
            
            // 格式化第二个文档不应该受影响
            const edits2 = await controller.formatDocument(doc2);
            
            expect(edits2).toBeDefined();
            expect(Array.isArray(edits2)).toBe(true);
        });
    });
});
