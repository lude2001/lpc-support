/**
 * 配置系统测试
 * 测试LPC格式化器的配置管理功能
 */

import { FormattingController } from '../../../src/formatting/controller/FormattingController';
import { TestHelper } from '../../utils/TestHelper';
import { FormattingConfig } from '../../../src/formatting/config/FormattingConfig';

// VS Code API已在jest.setup.ts中进行mock

describe('配置系统测试', () => {
    let controller: FormattingController;
    let testDocument: any;

    beforeEach(() => {
        controller = new FormattingController();
        testDocument = TestHelper.createMockDocument(
            'void test(){if(x>0){write("hello");}else{write("world");}}',
            'lpc'
        );
    });

    afterEach(() => {
        controller.dispose();
    });

    describe('基本配置测试', () => {
        test('应该返回默认配置', () => {
            const config = controller.getConfiguration();
            
            expect(config).toBeDefined();
            expect(typeof config.indentSize).toBe('number');
            expect(typeof config.useSpaces).toBe('boolean');
            expect(typeof config.spaceAroundOperators).toBe('boolean');
            expect(typeof config.maxLineLength).toBe('number');
        });

        test('应该能够更新配置', async () => {
            const newConfig: Partial<FormattingConfig> = {
                indentSize: 8,
                useSpaces: false,
                spaceAroundOperators: false
            };
            
            await controller.updateConfiguration(newConfig);
            
            const updatedConfig = controller.getConfiguration();
            expect(updatedConfig.indentSize).toBe(8);
            expect(updatedConfig.useSpaces).toBe(false);
            expect(updatedConfig.spaceAroundOperators).toBe(false);
        });

        test('应该验证配置值的合法性', async () => {
            const validConfigs = [
                { indentSize: 1 },
                { indentSize: 2 },
                { indentSize: 4 },
                { indentSize: 8 },
                { maxLineLength: 40 },
                { maxLineLength: 120 },
                { maxLineLength: 300 }
            ];
            
            for (const config of validConfigs) {
                await expect(controller.updateConfiguration(config)).resolves.not.toThrow();
            }
        });
    });

    describe('缩进配置测试', () => {
        test('应该支持不同的缩进大小', async () => {
            const indentSizes = [2, 4, 6, 8];
            
            for (const size of indentSizes) {
                await controller.updateConfiguration({ indentSize: size });
                
                const edits = await controller.formatDocument(testDocument);
                expect(edits).toBeDefined();
                expect(edits.length).toBeGreaterThan(0);
                
                if (edits.length > 0) {
                    const formattedCode = edits[0].newText;
                    expect(formattedCode).toBeDefined();
                    
                    // 验证缩进大小是否正确应用
                    const lines = formattedCode.split('\n');
                    const indentedLines = lines.filter(line => line.match(/^\s+\w/));
                    
                    if (indentedLines.length > 0) {
                        const firstIndent = indentedLines[0].match(/^\s*/)![0];
                        if (controller.getConfiguration().useSpaces) {
                            expect(firstIndent.length % size).toBe(0);
                        }
                    }
                }
            }
        });

        test('应该支持空格和制表符切换', async () => {
            // 测试空格缩进
            await controller.updateConfiguration({ useSpaces: true, indentSize: 4 });
            const spaceEdits = await controller.formatDocument(testDocument);
            
            // 测试制表符缩进
            await controller.updateConfiguration({ useSpaces: false, indentSize: 1 });
            const tabEdits = await controller.formatDocument(testDocument);
            
            expect(spaceEdits).toBeDefined();
            expect(tabEdits).toBeDefined();
            
            if (spaceEdits.length > 0 && tabEdits.length > 0) {
                const spaceCode = spaceEdits[0].newText;
                const tabCode = tabEdits[0].newText;
                
                // 空格和制表符版本应该不同
                expect(spaceCode).not.toBe(tabCode);
            }
        });
    });

    describe('间距配置测试', () => {
        test('应该支持操作符间距配置', async () => {
            const testCode = 'int x=5+10*2;';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            // 测试开启操作符间距
            await controller.updateConfiguration({ spaceAroundOperators: true });
            const withSpaces = await controller.formatDocument(document);
            
            // 测试关闭操作符间距
            await controller.updateConfiguration({ spaceAroundOperators: false });
            const withoutSpaces = await controller.formatDocument(document);
            
            expect(withSpaces).toBeDefined();
            expect(withoutSpaces).toBeDefined();
            
            if (withSpaces.length > 0 && withoutSpaces.length > 0) {
                const spacedCode = withSpaces[0].newText;
                const compactCode = withoutSpaces[0].newText;
                
                expect(spacedCode).toMatch(/\s[+\-*\/]\s/);
                expect(compactCode).toMatch(/[^\s][+\-*\/][^\s]/);
            }
        });

        test('应该支持逗号后间距配置', async () => {
            const testCode = 'test_function(a,b,c);';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            // 测试开启逗号后间距
            await controller.updateConfiguration({ spaceAfterComma: true });
            const withSpaces = await controller.formatDocument(document);
            
            // 测试关闭逗号后间距
            await controller.updateConfiguration({ spaceAfterComma: false });
            const withoutSpaces = await controller.formatDocument(document);
            
            expect(withSpaces).toBeDefined();
            expect(withoutSpaces).toBeDefined();
            
            if (withSpaces.length > 0 && withoutSpaces.length > 0) {
                const spacedCode = withSpaces[0].newText;
                const compactCode = withoutSpaces[0].newText;
                
                expect(spacedCode).toMatch(/,\s/);
                expect(compactCode).toMatch(/,[^\s]/);
            }
        });

        test('应该支持括号间距配置', async () => {
            const testCode = 'if(condition){action();}';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            // 测试括号内间距
            await controller.updateConfiguration({ spaceInsideParentheses: true });
            const withSpaces = await controller.formatDocument(document);
            
            await controller.updateConfiguration({ spaceInsideParentheses: false });
            const withoutSpaces = await controller.formatDocument(document);
            
            expect(withSpaces).toBeDefined();
            expect(withoutSpaces).toBeDefined();
        });
    });

    describe('换行配置测试', () => {
        test('应该支持大括号换行配置', async () => {
            const testCode = 'void test(){return;}';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            // 测试大括号前换行
            await controller.updateConfiguration({ newlineBeforeOpenBrace: true });
            const withNewline = await controller.formatDocument(document);
            
            await controller.updateConfiguration({ newlineBeforeOpenBrace: false });
            const withoutNewline = await controller.formatDocument(document);
            
            expect(withNewline).toBeDefined();
            expect(withoutNewline).toBeDefined();
            
            if (withNewline.length > 0 && withoutNewline.length > 0) {
                const newlineCode = withNewline[0].newText;
                const inlineCode = withoutNewline[0].newText;
                
                expect(newlineCode.split('\n').length).toBeGreaterThan(inlineCode.split('\n').length);
            }
        });

        test('应该支持最大行长度配置', async () => {
            const longCode = 'write("This is a very long string that should be broken into multiple lines based on the max line length configuration setting");';
            const document = TestHelper.createMockDocument(longCode, 'lpc');
            
            // 测试短行长度
            await controller.updateConfiguration({ maxLineLength: 40 });
            const shortLines = await controller.formatDocument(document);
            
            // 测试长行长度
            await controller.updateConfiguration({ maxLineLength: 200 });
            const longLines = await controller.formatDocument(document);
            
            expect(shortLines).toBeDefined();
            expect(longLines).toBeDefined();
            
            if (shortLines.length > 0 && longLines.length > 0) {
                const shortCode = shortLines[0].newText;
                const longCode = longLines[0].newText;
                
                expect(shortCode.split('\n').length).toBeGreaterThanOrEqual(longCode.split('\n').length);
            }
        });
    });

    describe('LPC特有配置测试', () => {
        test('应该支持函数指针格式化配置', async () => {
            const testCode = '(:function_name,arg1,arg2:)';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            // 测试开启函数指针格式化
            await controller.updateConfiguration({ formatFunctionPointers: true });
            const formatted = await controller.formatDocument(document);
            
            // 测试关闭函数指针格式化
            await controller.updateConfiguration({ formatFunctionPointers: false });
            const unformatted = await controller.formatDocument(document);
            
            expect(formatted).toBeDefined();
            expect(unformatted).toBeDefined();
        });

        test('应该支持数组格式化配置', async () => {
            const testCode = '({"item1","item2","item3"})';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            await controller.updateConfiguration({ formatArrays: true });
            const formatted = await controller.formatDocument(document);
            
            await controller.updateConfiguration({ formatArrays: false });
            const unformatted = await controller.formatDocument(document);
            
            expect(formatted).toBeDefined();
            expect(unformatted).toBeDefined();
        });

        test('应该支持映射格式化配置', async () => {
            const testCode = '(["key1":"value1","key2":"value2"])';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            await controller.updateConfiguration({ formatMappings: true });
            const formatted = await controller.formatDocument(document);
            
            await controller.updateConfiguration({ formatMappings: false });
            const unformatted = await controller.formatDocument(document);
            
            expect(formatted).toBeDefined();
            expect(unformatted).toBeDefined();
        });

        test('应该支持foreach格式化配置', async () => {
            const testCode = 'foreach(ref mixed item in array){modify(item);}';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            await controller.updateConfiguration({ formatForeachRef: true });
            const formatted = await controller.formatDocument(document);
            
            await controller.updateConfiguration({ formatForeachRef: false });
            const unformatted = await controller.formatDocument(document);
            
            expect(formatted).toBeDefined();
            expect(unformatted).toBeDefined();
        });
    });

    describe('性能配置测试', () => {
        test('应该支持最大格式化时间配置', async () => {
            const largeCode = TestHelper.generateLargeCodeFile(1000);
            const document = TestHelper.createMockDocument(largeCode, 'lpc');
            
            // 设置很短的超时时间
            await controller.updateConfiguration({ maxFormatTime: 100 });
            
            const startTime = Date.now();
            const edits = await controller.formatDocument(document);
            const duration = Date.now() - startTime;
            
            expect(edits).toBeDefined();
            // 超时保护应该生效
            expect(duration).toBeLessThan(1000); // 应该在超时或很快完成
        });

        test('应该支持增量格式化配置', async () => {
            await controller.updateConfiguration({ enableIncrementalFormatting: true });
            let config = controller.getConfiguration();
            expect(config.enableIncrementalFormatting).toBe(true);
            
            await controller.updateConfiguration({ enableIncrementalFormatting: false });
            config = controller.getConfiguration();
            expect(config.enableIncrementalFormatting).toBe(false);
        });

        test('应该支持并行处理配置', async () => {
            await controller.updateConfiguration({ enableParallelProcessing: true });
            let config = controller.getConfiguration();
            expect(config.enableParallelProcessing).toBe(true);
            
            await controller.updateConfiguration({ enableParallelProcessing: false });
            config = controller.getConfiguration();
            expect(config.enableParallelProcessing).toBe(false);
        });
    });

    describe('配置持久化测试', () => {
        test('应该保持配置在重启后生效', () => {
            const originalConfig = controller.getConfiguration();
            
            // 创建新的控制器实例
            const newController = new FormattingController();
            const newConfig = newController.getConfiguration();
            
            // 基本配置应该一致
            expect(newConfig.indentSize).toBe(originalConfig.indentSize);
            expect(newConfig.useSpaces).toBe(originalConfig.useSpaces);
            
            newController.dispose();
        });

        test('应该支持配置继承和覆盖', async () => {
            // 设置部分配置
            await controller.updateConfiguration({
                indentSize: 6
            });
            
            const config = controller.getConfiguration();
            expect(config.indentSize).toBe(6);
            // 其他配置应该保持默认值
            expect(config.useSpaces).toBeDefined();
            expect(config.spaceAroundOperators).toBeDefined();
        });
    });

    describe('配置验证测试', () => {
        test('应该验证无效的缩进大小', async () => {
            const invalidSizes = [-1, 0, 100];
            
            for (const size of invalidSizes) {
                await controller.updateConfiguration({ indentSize: size });
                const config = controller.getConfiguration();
                
                // 应该使用合理的默认值或者限制在合理范围内
                expect(config.indentSize).toBeGreaterThan(0);
                expect(config.indentSize).toBeLessThanOrEqual(16);
            }
        });

        test('应该验证无效的行长度', async () => {
            const invalidLengths = [-1, 0, 500];
            
            for (const length of invalidLengths) {
                await controller.updateConfiguration({ maxLineLength: length });
                const config = controller.getConfiguration();
                
                // 应该在合理范围内
                expect(config.maxLineLength).toBeGreaterThanOrEqual(40);
                expect(config.maxLineLength).toBeLessThanOrEqual(300);
            }
        });

        test('应该处理类型错误的配置值', async () => {
            // @ts-ignore - 故意传入错误类型
            await controller.updateConfiguration({
                indentSize: 'invalid',
                useSpaces: 'true',
                spaceAroundOperators: 1
            });
            
            const config = controller.getConfiguration();
            
            // 应该使用默认值或者转换为正确类型
            expect(typeof config.indentSize).toBe('number');
            expect(typeof config.useSpaces).toBe('boolean');
            expect(typeof config.spaceAroundOperators).toBe('boolean');
        });
    });

    describe('配置预设测试', () => {
        test('应该支持K&R风格预设', async () => {
            const krStyle = {
                indentSize: 4,
                useSpaces: true,
                newlineBeforeOpenBrace: false,
                spaceBeforeOpenBrace: true,
                functionDefStyle: 'compact' as const
            };
            
            await controller.updateConfiguration(krStyle);
            const config = controller.getConfiguration();
            
            expect(config.indentSize).toBe(4);
            expect(config.useSpaces).toBe(true);
            expect(config.newlineBeforeOpenBrace).toBe(false);
            expect(config.spaceBeforeOpenBrace).toBe(true);
        });

        test('应该支持Allman风格预设', async () => {
            const allmanStyle = {
                indentSize: 4,
                useSpaces: true,
                newlineBeforeOpenBrace: true,
                spaceBeforeOpenBrace: false,
                functionDefStyle: 'expanded' as const
            };
            
            await controller.updateConfiguration(allmanStyle);
            const config = controller.getConfiguration();
            
            expect(config.indentSize).toBe(4);
            expect(config.useSpaces).toBe(true);
            expect(config.newlineBeforeOpenBrace).toBe(true);
            expect(config.spaceBeforeOpenBrace).toBe(false);
        });

        test('应该支持紧凑风格预设', async () => {
            const compactStyle = {
                indentSize: 2,
                useSpaces: true,
                spaceAroundOperators: false,
                spaceAfterComma: false,
                spaceInsideParentheses: false,
                functionCallStyle: 'compact' as const
            };
            
            await controller.updateConfiguration(compactStyle);
            const config = controller.getConfiguration();
            
            expect(config.indentSize).toBe(2);
            expect(config.spaceAroundOperators).toBe(false);
            expect(config.spaceAfterComma).toBe(false);
        });
    });

    describe('动态配置更新测试', () => {
        test('应该在配置变更时立即生效', async () => {
            const testCode = 'if(x){action();}';
            const document = TestHelper.createMockDocument(testCode, 'lpc');
            
            // 初始配置
            await controller.updateConfiguration({ spaceBeforeOpenBrace: false });
            const result1 = await controller.formatDocument(document);
            
            // 更改配置
            await controller.updateConfiguration({ spaceBeforeOpenBrace: true });
            const result2 = await controller.formatDocument(document);
            
            expect(result1).toBeDefined();
            expect(result2).toBeDefined();
            
            if (result1.length > 0 && result2.length > 0) {
                const code1 = result1[0].newText;
                const code2 = result2[0].newText;
                
                // 配置变更应该影响格式化结果
                expect(code1).not.toBe(code2);
            }
        });

        test('应该在配置变更时清空缓存', async () => {
            const document = TestHelper.createMockDocument('void test() {}', 'lpc');
            
            // 第一次格式化（建立缓存）
            await controller.formatDocument(document);
            
            const cacheStatsAfterFirst = controller.getCacheStats();
            expect(cacheStatsAfterFirst.main.size).toBeGreaterThan(0);
            
            // 更改配置
            await controller.updateConfiguration({ indentSize: 8 });
            
            const cacheStatsAfterUpdate = controller.getCacheStats();
            expect(cacheStatsAfterUpdate.main.size).toBe(0); // 缓存应该被清空
        });
    });
});
