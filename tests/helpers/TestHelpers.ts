/**
 * 测试辅助工具类
 * 提供格式化测试所需的各种工具函数和Mock对象
 */

import { CommonTokenStream, Token, TokenSource } from 'antlr4ts';
import { CharStream } from 'antlr4ts';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { LPCFormattingOptions, DEFAULT_FORMATTING_OPTIONS } from '../../src/formatting/types';

/**
 * 测试用的Token Mock
 */
export class MockToken implements Token {
    public tokenIndex = 0;
    public line = 1;
    public charPositionInLine = 0;
    public channel = 0;
    public tokenSource: any = null;
    public inputStream: any = null;

    constructor(
        public type: number,
        public text: string,
        public startIndex: number = 0,
        public stopIndex: number = 0
    ) {
        this.stopIndex = startIndex + text.length - 1;
    }

    toString(): string {
        return this.text;
    }
}

/**
 * 测试用的TokenSource Mock
 */
export class MockTokenSource implements TokenSource {
    public sourceName: string = 'MockTokenSource';
    private tokens: Token[];
    private index: number = 0;

    constructor(tokens: Token[] = []) {
        this.tokens = [...tokens];
        // 添加EOF token
        this.tokens.push(new MockToken(-1, '<EOF>', 0, 0));
    }

    nextToken(): Token {
        if (this.index < this.tokens.length) {
            return this.tokens[this.index++];
        }
        return this.tokens[this.tokens.length - 1]; // EOF
    }
}

/**
 * 测试用的TokenStream Mock - 兼容CommonTokenStream
 */
export class MockTokenStream extends CommonTokenStream {
    private mockTokens: Token[];

    constructor(tokens: Token[] = []) {
        const tokenSource = new MockTokenSource(tokens);
        super(tokenSource);
        this.mockTokens = tokens;
        // 预先填充tokens
        this.fill();
    }

    addToken(token: Token): void {
        this.mockTokens.push(token);
        // 重新创建tokenSource并填充
        const tokenSource = new MockTokenSource(this.mockTokens);
        (this as any).tokenSource = tokenSource;
        this.reset();
        this.fill();
    }

    addTokens(tokens: Token[]): void {
        this.mockTokens.push(...tokens);
        // 重新创建tokenSource并填充
        const tokenSource = new MockTokenSource(this.mockTokens);
        (this as any).tokenSource = tokenSource;
        this.reset();
        this.fill();
    }
}

/**
 * 测试用的ParseTree Mock
 */
export class MockParseTree implements ParseTree {
    public parent: ParseTree | undefined;
    public payload: any;

    constructor(
        public text: string,
        public children: ParseTree[] = []
    ) {}

    getChild(index: number): ParseTree {
        return this.children[index];
    }

    get childCount(): number {
        return this.children.length;
    }

    accept<T>(visitor: any): T {
        return visitor.visitChildren(this);
    }

    toStringTree(): string {
        return this.text;
    }
}

/**
 * 测试用的TerminalNode Mock
 */
export class MockTerminalNode extends MockParseTree implements TerminalNode {
    constructor(public symbol: Token) {
        super(symbol.text);
    }

    get text(): string {
        return this.symbol.text;
    }
}

/**
 * LPC代码示例生成器
 */
export class LPCCodeSamples {
    /**
     * 生成简单的函数定义
     */
    static simpleFunction(): string {
        return `void create() {
    set_name("test");
    set_id(({"object", "test"}));
}`;
    }

    /**
     * 生成复杂的函数定义
     */
    static complexFunction(): string {
        return `public static mixed query_property(string prop, mixed *args...) {
    if (!prop || prop == "") {
        return 0;
    }
    
    switch(prop) {
        case "name":
            return name;
        case "short":
            return short_description;
        default:
            return inherited::query_property(prop, args...);
    }
}`;
    }

    /**
     * 生成包含继承的代码
     */
    static withInheritance(): string {
        return `inherit OBJECT;
inherit "/std/room";

void create() {
    ::create();
    set_short("测试房间");
}`;
    }

    /**
     * 生成包含复杂表达式的代码
     */
    static complexExpressions(): string {
        return `void test_expressions() {
    int result = (a + b) * (c - d) / (e % f);
    mapping data = ([ "key1": value1, "key2": ({ 1, 2, 3 }) ]);
    string *names = ({ "name1", "name2", "name3" });
    
    if (result > 0 && data["key1"] || sizeof(names)) {
        return result;
    }
}`;
    }

    /**
     * 生成格式化测试用的错误代码
     */
    static malformedCode(): string {
        return `void create(){
int x=1+2;
if(x>0)return x;
mapping m=(["a":1,"b":2]);
}`;
    }

    /**
     * 生成大型代码示例（性能测试用）
     */
    static largeCode(size: number = 1000): string {
        let code = 'inherit OBJECT;\n\n';
        
        for (let i = 0; i < size; i++) {
            code += `void function_${i}() {\n`;
            code += `    int var_${i} = ${i};\n`;
            code += `    if (var_${i} > 0) {\n`;
            code += `        return var_${i} * 2;\n`;
            code += `    }\n`;
            code += `}\n\n`;
        }
        
        return code;
    }

    /**
     * 生成嵌套结构代码
     */
    static deeplyNested(): string {
        return `void deep_nesting() {
    if (condition1) {
        if (condition2) {
            if (condition3) {
                switch (value) {
                    case 1:
                        if (nested_condition) {
                            for (int i = 0; i < 10; i++) {
                                if (i % 2) {
                                    continue;
                                }
                                process_item(i);
                            }
                        }
                        break;
                    case 2:
                        while (loop_condition) {
                            do_something();
                        }
                        break;
                }
            }
        }
    }
}`;
    }
}

/**
 * 格式化选项构建器
 */
export class FormattingOptionsBuilder {
    private options: LPCFormattingOptions;

    constructor() {
        this.options = { ...DEFAULT_FORMATTING_OPTIONS };
    }

    withIndentSize(size: number): this {
        this.options.indentSize = size;
        return this;
    }

    withBracesOnNewLine(value: boolean): this {
        this.options.bracesOnNewLine = value;
        return this;
    }

    withSpaceAroundOperators(value: boolean): this {
        this.options.spaceAroundBinaryOperators = value;
        return this;
    }

    withMaxLineLength(length: number): this {
        this.options.maxLineLength = length;
        return this;
    }

    withCompactArrays(value: boolean): this {
        this.options.arrayLiteralWrapThreshold = value ? 10 : 2;
        return this;
    }

    build(): LPCFormattingOptions {
        return { ...this.options };
    }
}

/**
 * 性能测试辅助工具
 */
export class PerformanceHelper {
    private static readonly PERFORMANCE_THRESHOLDS = {
        SMALL_FILE: 100,      // < 100ms for small files
        MEDIUM_FILE: 500,     // < 500ms for medium files  
        LARGE_FILE: 2000,     // < 2s for large files
        HUGE_FILE: 10000      // < 10s for huge files
    };

    /**
     * 测量函数执行时间
     */
    static async measureExecutionTime<T>(
        operation: () => Promise<T> | T,
        label?: string
    ): Promise<{ result: T; executionTime: number }> {
        const startTime = performance.now();
        const result = await operation();
        const executionTime = performance.now() - startTime;
        
        if (label) {
            console.log(`${label}: ${executionTime.toFixed(2)}ms`);
        }
        
        return { result, executionTime };
    }

    /**
     * 测量内存使用量
     */
    static measureMemoryUsage(): NodeJS.MemoryUsage {
        if (global.gc) {
            global.gc();
        }
        return process.memoryUsage();
    }

    /**
     * 获取性能阈值
     */
    static getThreshold(fileSize: 'small' | 'medium' | 'large' | 'huge'): number {
        switch (fileSize) {
            case 'small':
                return this.PERFORMANCE_THRESHOLDS.SMALL_FILE;
            case 'medium':
                return this.PERFORMANCE_THRESHOLDS.MEDIUM_FILE;
            case 'large':
                return this.PERFORMANCE_THRESHOLDS.LARGE_FILE;
            case 'huge':
                return this.PERFORMANCE_THRESHOLDS.HUGE_FILE;
            default:
                return this.PERFORMANCE_THRESHOLDS.MEDIUM_FILE;
        }
    }
}

/**
 * 断言辅助工具
 */
export class FormattingAssertions {
    /**
     * 验证格式化结果的基本结构
     */
    static validateFormatting(formatted: string): void {
        expect(formatted).toBeDefined();
        expect(typeof formatted).toBe('string');
        
        // 验证基本的格式化规则
        expect(formatted).not.toMatch(/\t/); // 不应包含制表符
        expect(formatted).not.toMatch(/[ \t]+$/m); // 行尾不应有空白
        expect(formatted).not.toMatch(/\n{4,}/); // 不应有过多连续空行
    }

    /**
     * 验证缩进一致性
     */
    static validateIndentation(formatted: string, expectedIndentSize: number): void {
        const lines = formatted.split('\n');
        const indentPattern = new RegExp(`^( {${expectedIndentSize}})*[^ ]`);
        
        lines.forEach((line, index) => {
            if (line.trim()) {
                expect(line).toMatch(indentPattern, 
                    `Line ${index + 1} has inconsistent indentation: "${line}"`);
            }
        });
    }

    /**
     * 验证操作符周围的空格
     */
    static validateOperatorSpacing(formatted: string, expectSpaces: boolean): void {
        const binaryOps = ['+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||'];
        
        binaryOps.forEach(op => {
            const escapedOp = op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (expectSpaces) {
                expect(formatted).not.toMatch(new RegExp(`\\w${escapedOp}\\w`));
            } else {
                // 在不期望空格的情况下，至少验证不会有多余空格
                expect(formatted).not.toMatch(new RegExp(`\\s{2,}${escapedOp}\\s{2,}`));
            }
        });
    }
}

/**
 * 错误模拟辅助工具
 */
export class ErrorSimulator {
    /**
     * 创建会抛出异常的Mock函数
     */
    static createThrowingMock(errorMessage: string): jest.Mock {
        return jest.fn(() => {
            throw new Error(errorMessage);
        });
    }

    /**
     * 创建会返回无效数据的Mock函数
     */
    static createInvalidDataMock(): jest.Mock {
        return jest.fn(() => null);
    }

    /**
     * 模拟内存不足的情况
     */
    static simulateOutOfMemory(): Error {
        return new Error('JavaScript heap out of memory');
    }
}