/**
 * LPC 语言正则表达式模式管理工具类
 *
 * 该类提供预编译的正则表达式模式，避免在代码中重复创建正则对象，显著提升性能。
 * 使用单例模式确保全局只有一个实例，所有正则表达式都经过优化和缓存。
 *
 * @example
 * ```typescript
 * // 获取实例
 * const patterns = RegexPatterns.getInstance();
 *
 * // 使用对象访问模式
 * const match = patterns.objectAccess.exec(text);
 *
 * // 使用动态生成的函数声明模式
 * const funcPattern = patterns.createFunctionDeclPattern(['int', 'void', 'string']);
 * const funcMatch = funcPattern.exec(code);
 *
 * // 安全地重置正则状态
 * patterns.resetRegex(patterns.objectAccess);
 * ```
 */
export class RegexPatterns {
    private static instance: RegexPatterns;

    /**
     * 预编译的正则表达式模式缓存
     * 这些正则表达式在类初始化时创建，整个应用生命周期内复用
     */

    /**
     * 对象访问模式：匹配 OBJ->method() 或 OBJ.property 格式
     *
     * 匹配组：
     * - [1]: 对象名 (大写字母开头)
     * - [2]: 访问符 (-> 或 .)
     * - [3]: 成员名 (方法或属性)
     * - [4]: 是否是函数调用 (可选的左括号)
     *
     * @example "USER_OB->query_name()" => ["USER_OB->query_name(", "USER_OB", "->", "query_name", "("]
     */
    public readonly objectAccess = /\b([A-Z_][A-Z0-9_]*)\s*(->|\.)\s*([a-zA-Z_][a-zA-Z0-9_]*)(\()?/g;

    /**
     * 宏定义标识符模式：匹配大写字母和下划线组成的标识符
     *
     * 匹配组：
     * - [1]: 完整的宏名称
     *
     * @example "USER_D" => ["USER_D", "USER_D"]
     */
    public readonly macroDefine = /\b([A-Z_][A-Z0-9_]*)\b/;

    /**
     * 继承语句模式：匹配 inherit PARENT; 或 inherit A, B, C;
     *
     * 匹配组：
     * - [1]: 父类名称列表 (逗号分隔)
     *
     * @example "inherit USER_OB, WEAPON_OB;" => ["inherit USER_OB, WEAPON_OB;", "USER_OB, WEAPON_OB"]
     */
    public readonly inheritStatement = /^\s*inherit\s+([A-Z_][A-Z0-9_]*(?:\s*,\s*[A-Z_][A-Z0-9_]*)*);/gm;

    /**
     * 包含语句模式：匹配 #include <file.h> 或 #include "file.h"
     *
     * 匹配组：
     * - [1]: 包含的文件路径
     *
     * @example '#include <ansi.h>' => ['#include <ansi.h>', 'ansi.h']
     */
    public readonly includeStatement = /^\s*#include\s+[<"]([^>"]+)[>"]/gm;

    /**
     * 多行字符串模式：匹配 @text...text@ 格式
     *
     * 匹配组：
     * - [1]: 字符串内容
     *
     * @example '@text Hello World text@' => ['@text Hello World text@', ' Hello World ']
     */
    public readonly multilineString = new RegExp("@text\s*(.*?)\s*text@", "gs");

    /**
     * 对象命名规范模式：验证对象名是否符合 LPC 规范
     * 必须是大写字母开头，可以包含下划线和数字，可选的 _D 后缀
     *
     * @example "USER_OB" => true, "USER_OB_D" => true, "userOb" => false
     */
    public readonly objectNaming = /^[A-Z][A-Z0-9_]*(?:_D)?$/;

    /**
     * 文件命名规范模式：验证文件名是否符合 LPC 规范
     * 只能包含字母、数字、下划线和连字符
     *
     * @example "user_ob.c" => true, "user-ob.h" => true, "user ob.c" => false
     */
    public readonly fileNaming = /^[a-zA-Z0-9_-]+$/i;

    /**
     * 成员命名规范模式：验证成员名是否使用小写字母开头的驼峰命名
     *
     * @example "userName" => true, "UserName" => false
     */
    public readonly memberNaming = /^[a-z][a-zA-Z0-9_]*$/;

    /**
     * 简单赋值语句模式（左值检测）：检测变量是否在简单赋值的左侧
     * 用于判断变量是否只是被赋值而没有被使用
     *
     * @example "varName = value" => true, "varName += value" => false
     */
    public readonly simpleAssignmentLHS = /^\s*=\s*([^=]|$)/;

    /**
     * 整数字面量模式
     */
    public readonly intLiteral = /^\d+$/;

    /**
     * 浮点数字面量模式
     */
    public readonly floatLiteral = /^\d+\.\d+$/;

    /**
     * 字符串字面量模式
     */
    public readonly stringLiteral = /^".*"$/;

    /**
     * 映射字面量模式
     */
    public readonly mappingLiteral = /^\(\[.*\]\)$|^\[.*\]$/;

    /**
     * 数组字面量模式
     */
    public readonly arrayLiteral = /^\({.*}\)$/;

    /**
     * 宏定义命名模式：以 _D 结尾的大写标识符
     *
     * @example "USER_D" => true, "WEAPON_D" => true, "USER_OB" => false
     */
    public readonly macroNaming = /^[A-Z][A-Z0-9_]*_D$/;

    /**
     * 动态正则模式缓存
     * 用于存储根据配置动态生成的正则表达式，避免重复创建
     */
    private patternCache = new Map<string, RegExp>();

    /**
     * 私有构造函数，防止直接实例化
     */
    private constructor() {}

    /**
     * 获取单例实例
     *
     * @returns RegexPatterns 实例
     */
    public static getInstance(): RegexPatterns {
        if (!RegexPatterns.instance) {
            RegexPatterns.instance = new RegexPatterns();
        }
        return RegexPatterns.instance;
    }

    /**
     * 创建函数声明模式
     *
     * 根据提供的类型和修饰符列表，生成匹配函数声明的正则表达式
     * 该方法会缓存生成的正则表达式，避免重复创建
     *
     * @param types - LPC 类型列表，如 ['int', 'void', 'string', 'object', 'mapping']
     * @param modifiers - 修饰符列表，如 ['static', 'private', 'public', 'protected', 'nomask', 'varargs']
     * @returns 匹配函数声明的正则表达式
     *
     * @example
     * ```typescript
     * const pattern = RegexPatterns.getInstance().createFunctionDeclPattern(
     *     ['int', 'void', 'string'],
     *     ['static', 'private', 'public']
     * );
     * const match = pattern.exec('static int query_name(string name) {');
     * // match: ['static int query_name(string name) {', 'static ', 'int', 'query_name']
     * ```
     *
     * 匹配组：
     * - [1]: 修饰符部分 (可选)
     * - [2]: 返回类型
     * - [3]: 函数名
     */
    public createFunctionDeclPattern(types: string[], modifiers?: string[]): RegExp {
        const cacheKey = `func:${types.join(',')}:${modifiers?.join(',') || ''}`;

        if (this.patternCache.has(cacheKey)) {
            return this.patternCache.get(cacheKey)!;
        }

        const typesPattern = types.join('|');
        // 修复：修饰符模式应该是 (?:modifier1|modifier2)\s+，整体重复0次或多次
        // 而不是 modifier1|modifier2\s+，这样会导致 \s+ 只应用于最后一个修饰符
        const modifiersPattern = modifiers && modifiers.length > 0
            ? `(?:(?:${modifiers.join('|')})\\s+)*`
            : '';

        // 匹配函数声明：[modifiers] type functionName(params) {
        const pattern = new RegExp(
            `^\\s*(${modifiersPattern})(${typesPattern})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\([^)]*\\)\\s*{',
            'gm'
        );

        this.patternCache.set(cacheKey, pattern);
        return pattern;
    }

    /**
     * 创建变量声明模式
     *
     * 根据提供的类型和修饰符列表，生成匹配变量声明的正则表达式
     * 支持数组声明（星号）和多变量声明（逗号分隔）
     *
     * @param types - LPC 类型列表
     * @param modifiers - 修饰符列表（可选）
     * @returns 匹配变量声明的正则表达式
     *
     * @example
     * ```typescript
     * const pattern = RegexPatterns.getInstance().createVariableDeclPattern(
     *     ['int', 'string', 'object']
     * );
     * const match = pattern.exec('int *arr, count;');
     * // match: ['int *arr, count;', '', 'int', '*arr, count']
     * ```
     *
     * 匹配组：
     * - [1]: 修饰符部分
     * - [2]: 变量类型
     * - [3]: 变量声明列表（可能包含星号和逗号）
     */
    public createVariableDeclPattern(types: string[], modifiers?: string[]): RegExp {
        const cacheKey = `var:${types.join(',')}:${modifiers?.join(',') || ''}`;

        if (this.patternCache.has(cacheKey)) {
            return this.patternCache.get(cacheKey)!;
        }

        const typesPattern = types.join('|');
        const modifiersPattern = modifiers && modifiers.length > 0
            ? `(?:${modifiers.join('|')}\\s+)*`
            : '';

        // 匹配变量声明：[modifiers] type *var1, var2, var3;
        const pattern = new RegExp(
            `^\\s*(${modifiersPattern})(${typesPattern})\\s+` +
            '(\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\\s*,\\s*\\*?\\s*[a-zA-Z_][a-zA-Z0-9_]*)*);',
            'gm'
        );

        this.patternCache.set(cacheKey, pattern);
        return pattern;
    }

    /**
     * 创建全局变量声明模式
     *
     * 与普通变量声明类似，但用于识别全局作用域的变量
     *
     * @param types - LPC 类型列表
     * @param modifiers - 修饰符列表（可选）
     * @returns 匹配全局变量声明的正则表达式
     *
     * @example
     * ```typescript
     * const pattern = RegexPatterns.getInstance().createGlobalVariablePattern(['int', 'string']);
     * const match = pattern.exec('int globalCounter = 0;');
     * ```
     *
     * 匹配组：
     * - [1]: 变量类型
     * - [2]: 变量名
     */
    public createGlobalVariablePattern(types: string[], modifiers?: string[]): RegExp {
        const cacheKey = `global:${types.join(',')}:${modifiers?.join(',') || ''}`;

        if (this.patternCache.has(cacheKey)) {
            return this.patternCache.get(cacheKey)!;
        }

        const typesPattern = types.join('|');
        const modifiersPattern = modifiers && modifiers.length > 0
            ? `${modifiers.join('|')}?\\s*`
            : '';

        // 匹配全局变量：[modifier] type varName [= value];
        const pattern = new RegExp(
            `^\\s*(?:${modifiersPattern})(${typesPattern})\\s+` +
            '([a-zA-Z_][a-zA-Z0-9_]*)\\s*(?:=\\s*[^;]+)?;',
            'gm'
        );

        this.patternCache.set(cacheKey, pattern);
        return pattern;
    }

    /**
     * 创建变量使用检测模式集合
     *
     * 生成一组用于检测变量是否被使用的正则表达式模式
     * 这些模式覆盖了 LPC 中变量可能被读取的所有场景
     *
     * @param varName - 要检测的变量名
     * @returns 包含多个检测模式的数组，每个模式包含正则和描述
     *
     * @example
     * ```typescript
     * const patterns = RegexPatterns.getInstance().createVariableUsagePatterns('myVar');
     * for (const {pattern, description} of patterns) {
     *     if (pattern.test(code)) {
     *         console.log(`变量被使用在: ${description}`);
     *     }
     * }
     * ```
     */
    public createVariableUsagePatterns(varName: string): Array<{ pattern: RegExp; description: string }> {
        return [
            {
                // 函数参数：foo(varName), foo(x, varName, y)
                pattern: new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: '函数参数'
            },
            {
                // 赋值右值：x = varName; y = z + varName;
                // 排除简单赋值的左值：varName = value
                pattern: new RegExp(`\\b(?!${varName}\\s*=[^=])[a-zA-Z_][a-zA-Z0-9_]*\\s*[+\\-*\\/%]?=\\s*.*\\b${varName}\\b.*?;`, 'g'),
                description: '赋值右值'
            },
            {
                // return 语句：return varName; return obj->method(varName);
                pattern: new RegExp(`\\breturn\\s+.*\\b${varName}\\b`, 'g'),
                description: 'return语句'
            },
            {
                // if 条件：if (varName), if (varName > 0)
                pattern: new RegExp(`\\bif\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'if条件'
            },
            {
                // while 循环：while (varName), while (varName--)
                pattern: new RegExp(`\\bwhile\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'while循环'
            },
            {
                // for 循环：for (...; varName; ...), for (...; ; varName++)
                pattern: new RegExp(`\\bfor\\s*\\([^;]*;[^;]*\\b${varName}\\b[^;]*;[^)]*\\)`, 'g'),
                description: 'for循环'
            },
            {
                // switch 语句：switch (varName)
                pattern: new RegExp(`\\bswitch\\s*\\([^)]*\\b${varName}\\b[^)]*\\)`, 'g'),
                description: 'switch语句'
            },
            {
                // case 语句：case varName:
                pattern: new RegExp(`\\bcase\\s+\\b${varName}\\b`, 'g'),
                description: 'case语句'
            },
            {
                // foreach 集合：foreach (x in varName)
                pattern: new RegExp(`\\bforeach\\s*\\([^)]+in\\s+\\b${varName}\\b`, 'g'),
                description: 'foreach集合'
            },
            {
                // 特殊函数调用：sscanf, input_to, call_other
                // 这些函数可能会读取或修改变量
                pattern: new RegExp(`\\b(?:sscanf|input_to|call_other)\\s*\\((?:[^(),]*\\(\\s*[^()]*\\s*\\)[^(),]*|[^(),])*\\b${varName}\\b`, 'g'),
                description: '特殊函数调用'
            },
            {
                // 对象成员访问：varName->prop, varName->method()
                pattern: new RegExp(`\\b${varName}\\s*->`, 'g'),
                description: '对象成员访问'
            },
            {
                // 复合赋值：varName += value; varName -= value;
                pattern: new RegExp(`\\b${varName}\\s*(?:\\+=|-=|\\*=|\\/=|%=)\\s*[^;]+`, 'g'),
                description: '复合赋值'
            }
        ];
    }

    /**
     * 重置全局正则表达式的 lastIndex
     *
     * 当使用全局标志 (g) 的正则表达式时，lastIndex 会保持状态
     * 这个方法可以安全地重置正则表达式的状态，避免错误的匹配结果
     *
     * @param regex - 要重置的正则表达式
     * @returns 重置后的正则表达式（同一个对象）
     *
     * @example
     * ```typescript
     * const patterns = RegexPatterns.getInstance();
     * const regex = patterns.objectAccess;
     * regex.exec(text); // 第一次执行
     * patterns.resetRegex(regex); // 重置状态
     * regex.exec(text); // 从头开始匹配
     * ```
     */
    public resetRegex(regex: RegExp): RegExp {
        regex.lastIndex = 0;
        return regex;
    }

    /**
     * 批量重置多个正则表达式的 lastIndex
     *
     * @param regexes - 要重置的正则表达式数组
     * @returns 重置后的正则表达式数组
     *
     * @example
     * ```typescript
     * const patterns = RegexPatterns.getInstance();
     * patterns.resetAllRegexes([
     *     patterns.objectAccess,
     *     patterns.inheritStatement,
     *     patterns.includeStatement
     * ]);
     * ```
     */
    public resetAllRegexes(regexes: RegExp[]): RegExp[] {
        regexes.forEach(regex => regex.lastIndex = 0);
        return regexes;
    }

    /**
     * 清除动态模式缓存
     *
     * 当配置更改（如类型或修饰符列表变化）时，应该清除缓存
     * 以确保使用新的配置重新生成正则表达式
     *
     * @example
     * ```typescript
     * const patterns = RegexPatterns.getInstance();
     * // 配置更改后
     * patterns.clearCache();
     * ```
     */
    public clearCache(): void {
        this.patternCache.clear();
    }

    /**
     * 获取缓存的模式数量
     *
     * 用于监控和调试，了解当前缓存了多少动态生成的正则表达式
     *
     * @returns 缓存中的模式数量
     */
    public getCacheSize(): number {
        return this.patternCache.size;
    }

    /**
     * 测试字符串是否匹配指定模式
     *
     * 这是一个便捷方法，自动处理正则表达式的重置
     * 修复：确保在test调用后也重置lastIndex，避免全局正则状态污染
     *
     * @param pattern - 正则表达式
     * @param text - 要测试的文本
     * @returns 是否匹配
     *
     * @example
     * ```typescript
     * const patterns = RegexPatterns.getInstance();
     * if (patterns.test(patterns.objectNaming, 'USER_OB')) {
     *     console.log('对象名符合规范');
     * }
     * ```
     */
    public test(pattern: RegExp, text: string): boolean {
        // 在调用前重置
        this.resetRegex(pattern);
        const result = pattern.test(text);
        // 修复：在调用后也重置，确保全局正则的lastIndex不会被改变
        // 这对于全局正则表达式(g标志)尤其重要
        this.resetRegex(pattern);
        return result;
    }

    /**
     * 执行正则匹配
     *
     * 这是一个便捷方法，自动处理正则表达式的重置
     *
     * @param pattern - 正则表达式
     * @param text - 要匹配的文本
     * @returns 匹配结果或 null
     *
     * @example
     * ```typescript
     * const patterns = RegexPatterns.getInstance();
     * const match = patterns.exec(patterns.macroDefine, 'USER_D');
     * if (match) {
     *     console.log(`匹配到宏: ${match[1]}`);
     * }
     * ```
     */
    public exec(pattern: RegExp, text: string): RegExpExecArray | null {
        this.resetRegex(pattern);
        return pattern.exec(text);
    }
}

/**
 * 导出类型定义，方便 TypeScript 使用
 */
export type VariableUsagePattern = {
    pattern: RegExp;
    description: string;
};

/**
 * 便捷函数：获取正则模式管理器实例
 *
 * @returns RegexPatterns 单例实例
 *
 * @example
 * ```typescript
 * import { getRegexPatterns } from './utils/regexPatterns';
 *
 * const patterns = getRegexPatterns();
 * const match = patterns.objectAccess.exec(text);
 * ```
 */
export function getRegexPatterns(): RegexPatterns {
    return RegexPatterns.getInstance();
}
