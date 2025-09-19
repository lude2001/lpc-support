/**
 * LPC特有语法格式化测试
 * 测试所有LPC特殊语法的格式化功能
 */

import { FormattingEngine } from '../../../src/formatting/engine/FormattingEngine';
import { TestHelper } from '../../utils/TestHelper';
import { DEFAULT_FORMATTING_CONFIG } from '../../../src/formatting/config/DefaultConfig';

// VS Code API已在jest.setup.ts中进行mock

describe('LPC语法格式化测试', () => {
    let engine: FormattingEngine;
    let config: any;

    beforeEach(() => {
        config = TestHelper.createTestConfig();
        engine = new FormattingEngine(config);
    });

    afterEach(() => {
        engine.dispose();
    });

    describe('基本语法格式化', () => {
        test('应该格式化变量声明', async () => {
            const input = 'int x=5,y=10;';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/int\s+x\s*=\s*5\s*,\s*y\s*=\s*10\s*;/);
            }
        });

        test('应该格式化函数定义', async () => {
            const input = 'void test(int a,string b){return;}';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toContain('(int a, string b)');
                expect(result.formattedText).toMatch(/\{[\s\S]*return;[\s\S]*\}/);
            }
        });

        test('应该格式化控制结构', async () => {
            const input = 'if(x>0){write("positive");}else{write("negative");}';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/if\s*\(\s*x\s*>\s*0\s*\)/);
                expect(result.formattedText).toMatch(/else/);
            }
        });
    });

    describe('LPC特有语法格式化', () => {
        test('应该格式化inherit语句', async () => {
            const input = 'inherit"/std/object";';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/inherit\s+".*";/);
            }
        });

        test('应该格式化函数指针', async () => {
            const input = '(:function_name,arg1,arg2:)';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/\(\s*:\s*function_name\s*,\s*arg1\s*,\s*arg2\s*:\s*\)/);
            }
        });

        test('应该格式化表达式函数指针', async () => {
            const input = '(:$1+$2:)';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/\(\s*:\s*.*\$1.*\+.*\$2.*:\s*\)/);
            }
        });

        test('应该格式化数组字面量', async () => {
            const input = '({"item1","item2","item3"})';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/\{.*"item1".*,.*"item2".*,.*"item3".*\}/);
            }
        });

        test('应该格式化映射字面量', async () => {
            const input = '(["key1":"value1","key2":"value2"])';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/\[.*"key1".*:.*"value1".*,.*"key2".*:.*"value2".*\]/);
            }
        });
    });

    describe('高级LPC语法格式化', () => {
        test('应该格式化foreach循环', async () => {
            const input = 'foreach(mixed item in array){write(item);}';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/foreach\s*\(\s*mixed\s+item\s+in\s+array\s*\)/);
            }
        });

        test('应该格式化foreach ref语法', async () => {
            const input = 'foreach(ref string item in array){item+="_modified";}';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/foreach\s*\(\s*ref\s+string\s+item\s+in\s+array\s*\)/);
            }
        });

        test('应该格式化switch范围匹配', async () => {
            const input = `switch(x){case 1..5:write("small");break;case ..10:write("medium");break;case 15..:write("large");break;}`;
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/case\s+1\s*\.\.\s*5\s*:/);
                expect(result.formattedText).toMatch(/case\s*\.\.\s*10\s*:/);
                expect(result.formattedText).toMatch(/case\s+15\s*\.\.\s*:/);
            }
        });

        test('应该格式化匿名函数', async () => {
            const input = 'function f=function(int a,int b){return a+b;};';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/function\s+f\s*=\s*function\s*\(\s*int\s+a\s*,\s*int\s+b\s*\)/);
            }
        });

        test('应该格式化变长参数函数', async () => {
            const input = 'void test(mixed*x...){}';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/void\s+test\s*\(\s*mixed\s*\*\s*x\s*\.\.\.\s*\)/);
            }
        });

        test('应该格式化默认参数', async () => {
            const input = 'void test(int x:(: 10 :)){}';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/int\s+x\s*:\s*\(\s*:\s*10\s*:\s*\)/);
            }
        });

        test('应该格式化范围操作', async () => {
            const input = 'str[start..end]';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/str\s*\[\s*start\s*\.\.\s*end\s*\]/);
            }
        });

        test('应该格式化数组切片', async () => {
            const input = 'array[<n]';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/array\s*\[\s*<\s*n\s*\]/);
            }
        });

        test('应该格式化类作用域', async () => {
            const input = 'MyClass::static_method()';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/MyClass\s*::\s*static_method\s*\(\s*\)/);
            }
        });
    });

    describe('预处理指令格式化', () => {
        test('应该格式化#define指令', async () => {
            const input = '#define MACRO_NAME value';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/#define\s+MACRO_NAME\s+value/);
            }
        });

        test('应该格式化#include指令', async () => {
            const input = '#include"header.h"';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/#include\s+"header\.h"/);
            }
        });

        test('应该格式化条件编译指令', async () => {
            const input = '#ifdef DEBUG\nwrite("debug");\n#endif';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/#ifdef\s+DEBUG/);
                expect(result.formattedText).toMatch(/#endif/);
            }
        });
    });

    describe('定界符语法格式化', () => {
        test('应该格式化定界符语法', async () => {
            const input = '@DELIMITER\nstring content here\nDELIMITER;';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toMatch(/@DELIMITER/);
                expect(result.formattedText).toMatch(/DELIMITER;/);
            }
        });
    });

    describe('复杂语法组合测试', () => {
        test('应该格式化复杂的LPC代码', async () => {
            const input = TestHelper.createLPCTestCode({
                hasInherit: true,
                hasFunctions: true,
                hasArrays: true,
                hasMappings: true,
                hasFunctionPointers: true,
                hasForEach: true
            });
            
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                // 验证基本结构保持不变
                const validation = TestHelper.validateFormattedCode(input, result.formattedText);
                expect(validation.isValid).toBe(true);
                if (!validation.isValid) {
                    console.error('格式化验证失败:', validation.issues);
                }
            }
        });

        test('应该处理深度嵌套的结构', async () => {
            const input = `
void complex_function() {
    mapping data = ([
        "level1": ([
            "level2": ({ 
                (: function_name, ([ "key": "value" ]) :),
                function(int x) { return x * 2; }
            })
        ])
    ]);
    
    foreach (mixed key in keys(data)) {
        foreach (mixed item in data[key]["level2"]) {
            if (functionp(item)) {
                write(sprintf("Found function: %O", item));
            }
        }
    }
}`;
            
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                // 验证格式化结果的结构完整性
                const validation = TestHelper.validateFormattedCode(input, result.formattedText);
                expect(validation.isValid).toBe(true);
            }
        });
    });

    describe('边界情况测试', () => {
        test('应该处理空文件', async () => {
            const result = await engine.formatText('');
            
            expect(result.success).toBe(true);
            expect(result.formattedText).toBe('');
        });

        test('应该处理只有空白的文件', async () => {
            const input = '   \n\t  \n   ';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText.trim()).toBe('');
            }
        });

        test('应该处理只有注释的文件', async () => {
            const input = '// This is a comment\n/* Block comment */';
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toContain('//');
                expect(result.formattedText).toContain('/*');
            }
        });

        test('应该处理极长的代码行', async () => {
            const longString = '"' + 'a'.repeat(500) + '"';
            const input = `void test() { write(${longString}); }`;
            
            const result = await engine.formatText(input);
            
            expect(result.success).toBe(true);
            if (result.formattedText) {
                expect(result.formattedText).toContain(longString);
            }
        });
    });

    describe('性能测试', () => {
        test('小文件格式化性能', async () => {
            const testData = TestHelper.createPerformanceTestData();
            
            const startTime = Date.now();
            const result = await engine.formatText(testData.small);
            const duration = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(50); // 小于50ms
        });

        test('中等文件格式化性能', async () => {
            const testData = TestHelper.createPerformanceTestData();
            
            const startTime = Date.now();
            const result = await engine.formatText(testData.medium);
            const duration = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(200); // 小于200ms
        });

        test('大文件格式化性能', async () => {
            const testData = TestHelper.createPerformanceTestData();
            
            const startTime = Date.now();
            const result = await engine.formatText(testData.large);
            const duration = Date.now() - startTime;
            
            expect(result.success).toBe(true);
            expect(duration).toBeLessThan(1000); // 小于1秒
        });
    });
});
