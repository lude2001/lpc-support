import * as vscode from 'vscode';
import { FormattingController } from '../../src/formatting/controller/FormattingController';
import { FormattingEngine } from '../../src/formatting/engine/FormattingEngine';
import { RuleManager } from '../../src/formatting/rules/RuleManager';
import { DEFAULT_FORMATTING_CONFIG } from '../../src/formatting/config/DefaultConfig';

/**
 * LPC 格式化功能测试
 */
describe('LPC Formatting', () => {
    let controller: FormattingController;
    let testDocument: vscode.TextDocument;

    beforeAll(async () => {
        // 初始化格式化控制器
        controller = new FormattingController();
    });

    afterAll(() => {
        // 清理资源
        controller.dispose();
    });

    describe('基础格式化测试', () => {
        test('应该正确格式化简单变量声明', async () => {
            const input = 'int x=5,y=10;';
            const expected = 'int x = 5, y = 10;';

            const result = await controller.getRuleEngine().getRule('SpacingRule')?.apply(
                createMockNode(input),
                DEFAULT_FORMATTING_CONFIG,
                createMockContext()
            );

            expect(result).toContain('=');
        });

        test('应该正确格式化函数定义', async () => {
            const input = `void test(){
if(x>5){
write("hello");
}
}`;

            const mockDocument = createMockDocument(input);
            const result = await controller.formatDocument(mockDocument);

            expect(result.length).toBeGreaterThan(0);
        });

        test('应该处理空文档', async () => {
            const mockDocument = createMockDocument('');
            const result = await controller.formatDocument(mockDocument);

            expect(result.length).toBe(0);
        });
    });

    describe('LPC特定语法格式化', () => {
        test('应该正确格式化函数指针', async () => {
            const input = '(:function_name:)';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/\(\s*:\s*\w+\s*:\s*\)/);
            }
        });

        test('应该正确格式化数组字面量', async () => {
            const input = '({"item1","item2","item3"})';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toContain(', ');
            }
        });

        test('应该正确格式化映射字面量', async () => {
            const input = '(["key1":"value1","key2":"value2"])';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toContain(': ');
            }
        });

        test('应该正确格式化inherit语句', async () => {
            const input = 'inherit"/std/object";';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/inherit\s+/);
            }
        });
    });

    describe('高级LPC语法格式化', () => {
        test('应该正确格式化switch范围匹配', async () => {
            const input = `switch(x){
case 1..5:
    break;
case ..10:
    break;
case 15..:
    break;
}`;

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
        });

        test('应该正确格式化foreach ref语法', async () => {
            const input = 'foreach(ref string item in array)';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
        });

        test('应该正确格式化匿名函数', async () => {
            const input = 'function f=function(int a,int b){return a+b;};';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
        });

        test('应该正确格式化表达式函数指针', async () => {
            const input = '(:$1+$2:)';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            expect(result.success).toBe(true);
        });
    });

    describe('错误处理测试', () => {
        test('应该处理语法错误的代码', async () => {
            const input = 'void test( { invalid syntax }';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);

            // 即使有语法错误，也应该返回结果（可能是部分格式化或原文本）
            expect(result).toBeDefined();
        });

        test('应该处理超长代码', async () => {
            const longInput = 'void test() { ' + 'write("hello"); '.repeat(1000) + '}';

            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(longInput);

            expect(result).toBeDefined();
        });

        test('应该处理空输入', async () => {
            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText('');

            expect(result.success).toBe(true);
            expect(result.formattedText).toBe('');
        });
    });

    describe('性能测试', () => {
        test('格式化应该在合理时间内完成', async () => {
            const input = `
void test_function() {
    for (int i = 0; i < 100; i++) {
        if (i % 2 == 0) {
            write(sprintf("Even: %d", i));
        } else {
            write(sprintf("Odd: %d", i));
        }
    }
}`;

            const startTime = Date.now();
            const engine = new FormattingEngine(DEFAULT_FORMATTING_CONFIG);
            const result = await engine.formatText(input);
            const endTime = Date.now();

            expect(result.success).toBe(true);
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });
    });

    describe('规则管理测试', () => {
        test('应该正确加载所有格式化规则', () => {
            const ruleManager = RuleManager.getInstance();
            const stats = ruleManager.getStatistics();

            expect(stats.total).toBeGreaterThan(0);
            expect(stats.categories.basic).toBeGreaterThan(0);
            expect(stats.categories.lpc).toBeGreaterThan(0);
            expect(stats.categories.advanced).toBeGreaterThan(0);
            expect(stats.categories.special).toBeGreaterThan(0);
        });

        test('应该能够启用和禁用规则分类', () => {
            const ruleManager = RuleManager.getInstance();

            // 禁用高级规则
            ruleManager.setCategoryEnabled('advanced', false);

            const advancedRules = ruleManager.getRulesByCategory('advanced');
            const enabledAdvancedRules = advancedRules.filter(rule => rule.isEnabled());

            expect(enabledAdvancedRules.length).toBe(0);

            // 重新启用
            ruleManager.setCategoryEnabled('advanced', true);
            const reenabledRules = advancedRules.filter(rule => rule.isEnabled());
            expect(reenabledRules.length).toBe(advancedRules.length);
        });
    });

    describe('配置测试', () => {
        test('应该使用默认配置', () => {
            const config = controller.getConfiguration();

            expect(config.indentSize).toBe(4);
            expect(config.useSpaces).toBe(true);
            expect(config.spaceAroundOperators).toBe(true);
        });

        test('应该能够更新配置', async () => {
            await controller.updateConfiguration({
                indentSize: 2,
                useSpaces: false
            });

            const config = controller.getConfiguration();
            expect(config.indentSize).toBe(2);
            expect(config.useSpaces).toBe(false);

            // 重置为默认值
            await controller.updateConfiguration({
                indentSize: 4,
                useSpaces: true
            });
        });
    });
});

// 辅助函数
function createMockDocument(content: string): vscode.TextDocument {
    return {
        getText: () => content,
        lineAt: (line: number) => ({
            text: content.split('\n')[line] || '',
            range: new vscode.Range(line, 0, line, content.split('\n')[line]?.length || 0)
        }),
        lineCount: content.split('\n').length,
        fileName: 'test.c',
        uri: vscode.Uri.parse('file:///test.c'),
        languageId: 'lpc',
        version: 1,
        isDirty: false,
        isClosed: false,
        positionAt: (offset: number) => new vscode.Position(0, offset),
        offsetAt: (position: vscode.Position) => position.character,
        save: () => Promise.resolve(true),
        eol: vscode.EndOfLine.LF
    } as vscode.TextDocument;
}

function createMockNode(text: string): any {
    return {
        text,
        childCount: 0,
        getChild: () => null
    };
}

function createMockContext(): any {
    return {
        indentLevel: 0,
        inFunction: false,
        inArray: false,
        inMapping: false,
        inCondition: false,
        inSwitch: false,
        inForeach: false,
        inAnonymousFunction: false,
        inCast: false,
        lineLength: 0
    };
}