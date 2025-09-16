/**
 * 测试辅助工具类 - 简化版本
 * 提供格式化测试所需的基本Mock对象
 */

import { CommonTokenStream, Token, TokenSource } from 'antlr4ts';
import { CharStream } from 'antlr4ts';
import { LPCFormattingOptions, DEFAULT_FORMATTING_OPTIONS } from '../formatting/types';

/**
 * 简化的Mock Token实现
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
 * 简化的Mock TokenSource实现
 */
class MockTokenSource implements TokenSource {
    public sourceName: string = 'MockTokenSource';
    public line: number = 1;
    public charPositionInLine: number = 0;
    public inputStream: CharStream | undefined = undefined;
    public tokenFactory: any = null;

    private tokens: Token[];
    private index: number = 0;

    constructor(tokens: Token[] = []) {
        this.tokens = [...tokens];
    }

    nextToken(): Token {
        if (this.index < this.tokens.length) {
            return this.tokens[this.index++];
        }
        return new MockToken(-1, '<EOF>', 0, 0);
    }
}

/**
 * Mock TokenStream实现（继承CommonTokenStream）
 */
export class MockTokenStream extends CommonTokenStream {
    private _tokens: Token[];

    constructor(tokens: Token[] = []) {
        const tokenSource = new MockTokenSource([...tokens, new MockToken(-1, '<EOF>', 0, 0)]);
        super(tokenSource);
        this._tokens = [...tokens, new MockToken(-1, '<EOF>', 0, 0)];
        // 初始化token流
        this.fill();
    }

    get size(): number {
        return this._tokens.length;
    }

    get(index: number): Token {
        if (index >= 0 && index < this._tokens.length) {
            return this._tokens[index];
        }
        return this._tokens[this._tokens.length - 1]; // EOF token
    }
}

/**
 * 创建测试用的TokenStream
 */
export function createTestTokenStream(tokens: Token[] = []): any {
    return new MockTokenStream(tokens);
}

/**
 * 获取默认的格式化选项（用于测试）
 */
export function getTestFormattingOptions(): LPCFormattingOptions {
    return { ...DEFAULT_FORMATTING_OPTIONS };
}

/**
 * 创建简单的测试Token
 */
export function createTestToken(type: number, text: string): MockToken {
    return new MockToken(type, text);
}