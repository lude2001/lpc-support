import { Token, CommonTokenStream } from 'antlr4ts';
import { ITokenUtils } from '../types/interfaces';

/**
 * Token工具类实现
 * 提供Token流相关的操作和查询方法
 */
export class TokenUtils implements ITokenUtils {
    private tokenStream: CommonTokenStream;

    /**
     * 构造函数
     * @param tokenStream Token流
     */
    constructor(tokenStream: CommonTokenStream) {
        this.tokenStream = tokenStream;
    }

    /**
     * 获取两个上下文之间的Token
     * @param left 左侧上下文
     * @param right 右侧上下文
     * @returns Token或undefined
     */
    getTokenBetween(left: any, right: any): Token | undefined {
        if (!left || !right || !left.stop || !right.start) {
            return undefined;
        }

        const leftIndex = left.stop.tokenIndex;
        const rightIndex = right.start.tokenIndex;

        // 如果两个上下文之间有Token，返回第一个
        if (rightIndex > leftIndex + 1) {
            return this.tokenStream.get(leftIndex + 1);
        }

        return undefined;
    }

    /**
     * 检查Token是否为指定类型
     * @param token Token对象
     * @param type Token类型
     * @returns 是否匹配
     */
    isTokenType(token: Token | undefined, type: number): boolean {
        return token !== undefined && token.type === type;
    }

    /**
     * 获取Token的文本内容
     * @param token Token对象
     * @returns 文本内容或空字符串
     */
    getTokenText(token: Token | undefined): string {
        return token?.text || '';
    }

    /**
     * 获取指定范围内的所有Token
     * @param startIndex 起始Token索引
     * @param endIndex 结束Token索引
     * @returns Token数组
     */
    getTokensInRange(startIndex: number, endIndex: number): Token[] {
        const tokens: Token[] = [];
        const start = Math.max(0, startIndex);
        const end = Math.min(this.tokenStream.size - 1, endIndex);

        for (let i = start; i <= end; i++) {
            const token = this.tokenStream.get(i);
            if (token) {
                tokens.push(token);
            }
        }

        return tokens;
    }

    /**
     * 获取上下文对应的所有Token
     * @param context 语法树上下文
     * @returns Token数组
     */
    getTokensForContext(context: any): Token[] {
        if (!context || !context.start || !context.stop) {
            return [];
        }

        const startIndex = context.start.tokenIndex;
        const endIndex = context.stop.tokenIndex;
        return this.getTokensInRange(startIndex, endIndex);
    }

    /**
     * 查找指定类型的下一个Token
     * @param startIndex 起始搜索位置
     * @param tokenType Token类型
     * @param maxDistance 最大搜索距离，默认为10
     * @returns Token或undefined
     */
    findNextTokenOfType(startIndex: number, tokenType: number, maxDistance: number = 10): Token | undefined {
        const end = Math.min(this.tokenStream.size - 1, startIndex + maxDistance);

        for (let i = startIndex; i <= end; i++) {
            const token = this.tokenStream.get(i);
            if (this.isTokenType(token, tokenType)) {
                return token;
            }
        }

        return undefined;
    }

    /**
     * 查找指定类型的前一个Token
     * @param startIndex 起始搜索位置
     * @param tokenType Token类型
     * @param maxDistance 最大搜索距离，默认为10
     * @returns Token或undefined
     */
    findPreviousTokenOfType(startIndex: number, tokenType: number, maxDistance: number = 10): Token | undefined {
        const start = Math.max(0, startIndex - maxDistance);

        for (let i = startIndex; i >= start; i--) {
            const token = this.tokenStream.get(i);
            if (this.isTokenType(token, tokenType)) {
                return token;
            }
        }

        return undefined;
    }

    /**
     * 检查两个上下文之间是否存在指定Token
     * @param left 左侧上下文
     * @param right 右侧上下文
     * @param tokenType Token类型
     * @returns 是否存在
     */
    hasTokenBetween(left: any, right: any, tokenType: number): boolean {
        const token = this.getTokenBetween(left, right);
        return this.isTokenType(token, tokenType);
    }

    /**
     * 获取Token的行号
     * @param token Token对象
     * @returns 行号（从1开始）或-1
     */
    getTokenLine(token: Token | undefined): number {
        return token?.line || -1;
    }

    /**
     * 获取Token的列号
     * @param token Token对象
     * @returns 列号（从0开始）或-1
     */
    getTokenColumn(token: Token | undefined): number {
        return token?.charPositionInLine || -1;
    }

    /**
     * 检查Token是否为操作符
     * @param token Token对象
     * @returns 是否为操作符
     */
    isOperatorToken(token: Token | undefined): boolean {
        if (!token) return false;

        const operatorTexts = [
            '+', '-', '*', '/', '%',
            '=', '+=', '-=', '*=', '/=', '%=',
            '==', '!=', '<', '>', '<=', '>=',
            '&&', '||', '&', '|', '^',
            '<<', '>>', '++', '--',
            '?', ':', '!'
        ];

        return operatorTexts.includes(token.text || '');
    }

    /**
     * 检查Token是否为关键字
     * @param token Token对象
     * @returns 是否为关键字
     */
    isKeywordToken(token: Token | undefined): boolean {
        if (!token) return false;

        const keywords = [
            'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
            'break', 'continue', 'return', 'function', 'void', 'int', 'string',
            'mapping', 'mixed', 'object', 'inherit', 'include', 'struct', 'class',
            'public', 'private', 'protected', 'static', 'nomask', 'virtual'
        ];

        return keywords.includes((token.text || '').toLowerCase());
    }

    /**
     * 检查Token是否为标点符号
     * @param token Token对象
     * @returns 是否为标点符号
     */
    isPunctuationToken(token: Token | undefined): boolean {
        if (!token) return false;

        const punctuation = [
            '(', ')', '[', ']', '{', '}',
            ',', ';', '.', '::'
        ];

        return punctuation.includes(token.text || '');
    }

    /**
     * 获取Token周围的空白字符
     * @param token Token对象
     * @returns 包含前后空白的对象
     */
    getTokenWhitespace(token: Token | undefined): { before: string; after: string } {
        if (!token) {
            return { before: '', after: '' };
        }

        // 这里简化处理，实际实现可能需要更复杂的逻辑
        // 来正确获取Token前后的空白字符
        return {
            before: '',  // 需要根据实际Token流来计算
            after: ''    // 需要根据实际Token流来计算
        };
    }

    /**
     * 更新Token流
     * @param tokenStream 新的Token流
     */
    updateTokenStream(tokenStream: CommonTokenStream): void {
        this.tokenStream = tokenStream;
    }

    /**
     * 获取Token流的总大小
     * @returns Token总数
     */
    getTokenStreamSize(): number {
        return this.tokenStream.size;
    }

    /**
     * 获取Token流对象
     * @returns CommonTokenStream对象
     */
    getTokenStream(): CommonTokenStream {
        return this.tokenStream;
    }

    /**
     * 检查Token索引是否有效
     * @param index Token索引
     * @returns 是否有效
     */
    isValidTokenIndex(index: number): boolean {
        return index >= 0 && index < this.tokenStream.size;
    }

    /**
     * 安全获取Token
     * 检查索引有效性后再获取Token
     * @param index Token索引
     * @returns Token或undefined
     */
    safeGetToken(index: number): Token | undefined {
        if (!this.isValidTokenIndex(index)) {
            return undefined;
        }
        return this.tokenStream.get(index);
    }
}