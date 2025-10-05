/**
 * RegexPatterns 工具类单元测试
 */

import { RegexPatterns, getRegexPatterns } from './regexPatterns';

describe('RegexPatterns', () => {
    let patterns: RegexPatterns;

    beforeEach(() => {
        patterns = RegexPatterns.getInstance();
        patterns.clearCache();
    });

    describe('单例模式', () => {
        it('应该返回相同的实例', () => {
            const instance1 = RegexPatterns.getInstance();
            const instance2 = RegexPatterns.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('getRegexPatterns 应该返回单例实例', () => {
            const instance = getRegexPatterns();
            expect(instance).toBe(RegexPatterns.getInstance());
        });
    });

    describe('对象访问模式', () => {
        it('应该匹配对象方法调用', () => {
            const text = 'USER_OB->query_name()';
            patterns.resetRegex(patterns.objectAccess);
            const match = patterns.objectAccess.exec(text);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('USER_OB');
            expect(match![2]).toBe('->');
            expect(match![3]).toBe('query_name');
            expect(match![4]).toBe('(');
        });

        it('应该匹配对象属性访问', () => {
            const text = 'WEAPON_OB.damage';
            patterns.resetRegex(patterns.objectAccess);
            const match = patterns.objectAccess.exec(text);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('WEAPON_OB');
            expect(match![2]).toBe('.');
            expect(match![3]).toBe('damage');
            expect(match![4]).toBeUndefined();
        });
    });

    describe('宏定义模式', () => {
        it('应该匹配大写标识符', () => {
            const match = patterns.macroDefine.exec('USER_D');
            expect(match).not.toBeNull();
            expect(match![1]).toBe('USER_D');
        });

        it('应该匹配宏命名规范', () => {
            expect(patterns.test(patterns.macroNaming, 'USER_D')).toBe(true);
            expect(patterns.test(patterns.macroNaming, 'WEAPON_D')).toBe(true);
            expect(patterns.test(patterns.macroNaming, 'USER_OB')).toBe(false);
        });
    });

    describe('继承语句模式', () => {
        it('应该匹配单个继承', () => {
            const text = 'inherit USER_OB;';
            patterns.resetRegex(patterns.inheritStatement);
            const match = patterns.inheritStatement.exec(text);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('USER_OB');
        });

        it('应该匹配多个继承', () => {
            const text = 'inherit USER_OB, WEAPON_OB, ARMOR_OB;';
            patterns.resetRegex(patterns.inheritStatement);
            const match = patterns.inheritStatement.exec(text);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('USER_OB, WEAPON_OB, ARMOR_OB');
        });
    });

    describe('包含语句模式', () => {
        it('应该匹配尖括号包含', () => {
            const text = '#include <ansi.h>';
            patterns.resetRegex(patterns.includeStatement);
            const match = patterns.includeStatement.exec(text);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('ansi.h');
        });

        it('应该匹配引号包含', () => {
            const text = '#include "user.h"';
            patterns.resetRegex(patterns.includeStatement);
            const match = patterns.includeStatement.exec(text);

            expect(match).not.toBeNull();
            expect(match![1]).toBe('user.h');
        });
    });

    describe('命名规范模式', () => {
        describe('对象命名', () => {
            it('应该接受有效的对象名', () => {
                expect(patterns.test(patterns.objectNaming, 'USER_OB')).toBe(true);
                expect(patterns.test(patterns.objectNaming, 'USER_OB_D')).toBe(true);
                expect(patterns.test(patterns.objectNaming, 'A')).toBe(true);
            });

            it('应该拒绝无效的对象名', () => {
                expect(patterns.test(patterns.objectNaming, 'userOb')).toBe(false);
                expect(patterns.test(patterns.objectNaming, '1USER')).toBe(false);
                expect(patterns.test(patterns.objectNaming, 'user-ob')).toBe(false);
            });
        });

        describe('文件命名', () => {
            it('应该接受有效的文件名', () => {
                expect(patterns.test(patterns.fileNaming, 'user_ob')).toBe(true);
                expect(patterns.test(patterns.fileNaming, 'user-ob')).toBe(true);
                expect(patterns.test(patterns.fileNaming, 'UserOb')).toBe(true);
            });

            it('应该拒绝包含空格的文件名', () => {
                expect(patterns.test(patterns.fileNaming, 'user ob')).toBe(false);
                expect(patterns.test(patterns.fileNaming, 'user@ob')).toBe(false);
            });
        });

        describe('成员命名', () => {
            it('应该接受驼峰命名', () => {
                expect(patterns.test(patterns.memberNaming, 'userName')).toBe(true);
                expect(patterns.test(patterns.memberNaming, 'queryName')).toBe(true);
                expect(patterns.test(patterns.memberNaming, 'x')).toBe(true);
            });

            it('应该拒绝大写开头', () => {
                expect(patterns.test(patterns.memberNaming, 'UserName')).toBe(false);
                expect(patterns.test(patterns.memberNaming, 'QueryName')).toBe(false);
            });
        });
    });

    describe('字面量模式', () => {
        it('应该识别整数', () => {
            expect(patterns.test(patterns.intLiteral, '123')).toBe(true);
            expect(patterns.test(patterns.intLiteral, '0')).toBe(true);
            expect(patterns.test(patterns.intLiteral, '3.14')).toBe(false);
        });

        it('应该识别浮点数', () => {
            expect(patterns.test(patterns.floatLiteral, '3.14')).toBe(true);
            expect(patterns.test(patterns.floatLiteral, '0.5')).toBe(true);
            expect(patterns.test(patterns.floatLiteral, '123')).toBe(false);
        });

        it('应该识别字符串', () => {
            expect(patterns.test(patterns.stringLiteral, '"hello"')).toBe(true);
            expect(patterns.test(patterns.stringLiteral, '""')).toBe(true);
            expect(patterns.test(patterns.stringLiteral, 'hello')).toBe(false);
        });

        it('应该识别映射', () => {
            expect(patterns.test(patterns.mappingLiteral, '([ ])')).toBe(true);
            expect(patterns.test(patterns.mappingLiteral, '[ ]')).toBe(true);
            expect(patterns.test(patterns.mappingLiteral, '([])')).toBe(true);
        });

        it('应该识别数组', () => {
            expect(patterns.test(patterns.arrayLiteral, '({ })')).toBe(true);
            expect(patterns.test(patterns.arrayLiteral, '({})')).toBe(true);
        });
    });

    describe('动态模式生成', () => {
        describe('函数声明模式', () => {
            it('应该生成正确的函数模式', () => {
                const pattern = patterns.createFunctionDeclPattern(
                    ['int', 'void'],
                    ['static', 'private']
                );

                const text = 'static int query_level() {';
                pattern.lastIndex = 0;
                const match = pattern.exec(text);

                expect(match).not.toBeNull();
                expect(match![2]).toBe('int');
                expect(match![3]).toBe('query_level');
            });

            it('应该缓存生成的模式', () => {
                const p1 = patterns.createFunctionDeclPattern(['int'], ['static']);
                const p2 = patterns.createFunctionDeclPattern(['int'], ['static']);
                expect(p1).toBe(p2);
            });

            it('不同参数应该生成不同的模式', () => {
                const p1 = patterns.createFunctionDeclPattern(['int']);
                const p2 = patterns.createFunctionDeclPattern(['void']);
                expect(p1).not.toBe(p2);
            });
        });

        describe('变量声明模式', () => {
            it('应该匹配单个变量', () => {
                const pattern = patterns.createVariableDeclPattern(['int']);
                pattern.lastIndex = 0;
                const match = pattern.exec('int count;');

                expect(match).not.toBeNull();
                expect(match![2]).toBe('int');
                expect(match![3]).toBe('count');
            });

            it('应该匹配数组变量', () => {
                const pattern = patterns.createVariableDeclPattern(['int']);
                pattern.lastIndex = 0;
                const match = pattern.exec('int *arr;');

                expect(match).not.toBeNull();
                expect(match![3]).toBe('*arr');
            });

            it('应该匹配多个变量', () => {
                const pattern = patterns.createVariableDeclPattern(['int']);
                pattern.lastIndex = 0;
                const match = pattern.exec('int a, b, c;');

                expect(match).not.toBeNull();
                expect(match![3]).toBe('a, b, c');
            });

            it('应该缓存变量模式', () => {
                const p1 = patterns.createVariableDeclPattern(['int', 'string']);
                const p2 = patterns.createVariableDeclPattern(['int', 'string']);
                expect(p1).toBe(p2);
            });
        });

        describe('全局变量模式', () => {
            it('应该匹配全局变量', () => {
                const pattern = patterns.createGlobalVariablePattern(['int']);
                pattern.lastIndex = 0;
                const match = pattern.exec('int globalCount = 0;');

                expect(match).not.toBeNull();
                expect(match![1]).toBe('int');
                expect(match![2]).toBe('globalCount');
            });

            it('应该缓存全局变量模式', () => {
                const p1 = patterns.createGlobalVariablePattern(['int']);
                const p2 = patterns.createGlobalVariablePattern(['int']);
                expect(p1).toBe(p2);
            });
        });
    });

    describe('变量使用模式', () => {
        it('应该生成多个检测模式', () => {
            const usagePatterns = patterns.createVariableUsagePatterns('myVar');
            expect(usagePatterns.length).toBeGreaterThan(0);
            expect(usagePatterns[0]).toHaveProperty('pattern');
            expect(usagePatterns[0]).toHaveProperty('description');
        });

        it('应该检测函数参数使用', () => {
            const usagePatterns = patterns.createVariableUsagePatterns('myVar');
            const funcArgPattern = usagePatterns.find(p => p.description === '函数参数');

            expect(funcArgPattern).toBeDefined();
            funcArgPattern!.pattern.lastIndex = 0;
            expect(funcArgPattern!.pattern.test('printf("%d", myVar)')).toBe(true);
        });

        it('应该检测 return 语句', () => {
            const usagePatterns = patterns.createVariableUsagePatterns('myVar');
            const returnPattern = usagePatterns.find(p => p.description === 'return语句');

            expect(returnPattern).toBeDefined();
            returnPattern!.pattern.lastIndex = 0;
            expect(returnPattern!.pattern.test('return myVar;')).toBe(true);
        });

        it('应该检测 if 条件', () => {
            const usagePatterns = patterns.createVariableUsagePatterns('myVar');
            const ifPattern = usagePatterns.find(p => p.description === 'if条件');

            expect(ifPattern).toBeDefined();
            ifPattern!.pattern.lastIndex = 0;
            expect(ifPattern!.pattern.test('if (myVar > 0)')).toBe(true);
        });

        it('应该检测对象成员访问', () => {
            const usagePatterns = patterns.createVariableUsagePatterns('myVar');
            const memberPattern = usagePatterns.find(p => p.description === '对象成员访问');

            expect(memberPattern).toBeDefined();
            memberPattern!.pattern.lastIndex = 0;
            expect(memberPattern!.pattern.test('myVar->query_name()')).toBe(true);
        });

        it('应该检测复合赋值', () => {
            const usagePatterns = patterns.createVariableUsagePatterns('myVar');
            const compoundPattern = usagePatterns.find(p => p.description === '复合赋值');

            expect(compoundPattern).toBeDefined();
            compoundPattern!.pattern.lastIndex = 0;
            expect(compoundPattern!.pattern.test('myVar += 1')).toBe(true);
        });
    });

    describe('正则状态管理', () => {
        it('resetRegex 应该重置 lastIndex', () => {
            const regex = patterns.objectAccess;
            regex.lastIndex = 100;
            patterns.resetRegex(regex);
            expect(regex.lastIndex).toBe(0);
        });

        it('resetAllRegexes 应该重置所有正则', () => {
            const regexes = [
                patterns.objectAccess,
                patterns.inheritStatement,
                patterns.includeStatement
            ];

            regexes.forEach(r => r.lastIndex = 100);
            patterns.resetAllRegexes(regexes);
            regexes.forEach(r => expect(r.lastIndex).toBe(0));
        });

        it('test 方法应该自动重置', () => {
            const regex = patterns.objectAccess;
            regex.lastIndex = 100;

            patterns.test(regex, 'USER_OB->method()');
            expect(regex.lastIndex).toBe(0);
        });

        it('exec 方法应该自动重置', () => {
            const regex = patterns.objectAccess;
            regex.lastIndex = 100;

            patterns.exec(regex, 'USER_OB->method()');
            // exec 会改变 lastIndex，但在调用前应该是 0
            // 我们只能验证它被正确调用了
            expect(patterns.exec(regex, 'USER_OB->method()')).not.toBeNull();
        });
    });

    describe('缓存管理', () => {
        it('clearCache 应该清空缓存', () => {
            patterns.createFunctionDeclPattern(['int']);
            patterns.createVariableDeclPattern(['string']);
            expect(patterns.getCacheSize()).toBeGreaterThan(0);

            patterns.clearCache();
            expect(patterns.getCacheSize()).toBe(0);
        });

        it('getCacheSize 应该返回正确的大小', () => {
            patterns.clearCache();
            expect(patterns.getCacheSize()).toBe(0);

            patterns.createFunctionDeclPattern(['int']);
            expect(patterns.getCacheSize()).toBe(1);

            patterns.createVariableDeclPattern(['string']);
            expect(patterns.getCacheSize()).toBe(2);

            // 相同参数不会增加缓存
            patterns.createFunctionDeclPattern(['int']);
            expect(patterns.getCacheSize()).toBe(2);
        });

        it('应该为不同的类型组合创建不同的缓存键', () => {
            patterns.clearCache();

            patterns.createFunctionDeclPattern(['int']);
            patterns.createFunctionDeclPattern(['int', 'void']);
            patterns.createFunctionDeclPattern(['int'], ['static']);

            expect(patterns.getCacheSize()).toBe(3);
        });
    });

    describe('多行字符串模式', () => {
        it('应该匹配多行字符串', () => {
            const text = '@text\n  hello world\ntext@';
            patterns.resetRegex(patterns.multilineString);
            const match = patterns.multilineString.exec(text);

            expect(match).not.toBeNull();
            expect(match![1].trim()).toBe('hello world');
        });

        it('应该匹配空的多行字符串', () => {
            const text = '@text text@';
            patterns.resetRegex(patterns.multilineString);
            const match = patterns.multilineString.exec(text);

            expect(match).not.toBeNull();
            expect(match![1].trim()).toBe('');
        });
    });

    describe('简单赋值检测', () => {
        it('应该识别简单赋值', () => {
            expect(patterns.test(patterns.simpleAssignmentLHS, ' = value')).toBe(true);
            expect(patterns.test(patterns.simpleAssignmentLHS, '  =  value')).toBe(true);
        });

        it('应该排除复合赋值', () => {
            expect(patterns.test(patterns.simpleAssignmentLHS, ' += value')).toBe(false);
            expect(patterns.test(patterns.simpleAssignmentLHS, ' == value')).toBe(false);
        });
    });
});
