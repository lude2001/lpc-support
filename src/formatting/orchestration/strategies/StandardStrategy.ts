/**
 * 标准格式化策略
 * 
 * 提供标准的LPC代码格式化规则：
 * - 标准缩进和空格规则
 * - 合理的换行控制
 * - 平衡的可读性和紧凑性
 */

import { 
    IFormattingStrategy, 
    FormattingStrategyType, 
    IFormattingRequest 
} from '../types';
import { IExtendedFormattingContext } from '../../types/interfaces';

export class StandardStrategy implements IFormattingStrategy {
    public readonly name = 'Standard';
    public readonly type = FormattingStrategyType.STANDARD;
    public readonly description = 'Standard formatting with balanced readability and compactness';

    /**
     * 应用标准格式化策略
     */
    public apply(context: IExtendedFormattingContext, request: IFormattingRequest): void {
        const options = request.options;

        // 设置标准缩进配置
        this.configureIndentation(context, options);
        
        // 设置标准空格配置
        this.configureSpacing(context, options);
        
        // 设置标准换行配置
        this.configureLineBreaks(context, options);
        
        // 设置标准运算符格式化
        this.configureOperators(context, options);
        
        // 设置标准括号和分隔符配置
        this.configureBraces(context, options);
    }

    /**
     * 配置缩进规则
     */
    private configureIndentation(context: IExtendedFormattingContext, options: any): void {
        const indentManager = context.indentManager;
        
        // 使用配置的缩进大小，默认为4个空格
        const indentSize = options.indentSize || 4;
        const useTabsForIndentation = options.insertSpaces === false;
        
        // 可以通过扩展接口设置缩进配置
        // 这里需要扩展IIndentManager接口以支持策略配置
        if ('configureStrategy' in indentManager) {
            (indentManager as any).configureStrategy({
                indentSize,
                useTabsForIndentation,
                // 标准策略的特定配置
                continuationIndentSize: indentSize, // 续行缩进
                switchCaseIndent: true,             // switch case 缩进
                parameterIndent: true,              // 参数列表缩进
                expressionIndent: true              // 表达式换行缩进
            });
        }
    }

    /**
     * 配置空格规则
     */
    private configureSpacing(context: IExtendedFormattingContext, options: any): void {
        const core = context.core;
        
        // 可以通过扩展接口设置空格配置
        if ('configureSpacing' in core) {
            (core as any).configureSpacing({
                // 运算符周围的空格
                spaceAroundOperators: true,
                spaceAroundAssignmentOperators: true,
                spaceAroundLogicalOperators: true,
                spaceAroundComparisonOperators: true,
                
                // 逗号和分号
                spaceAfterComma: true,
                spaceAfterSemicolon: true,
                spaceBeforeComma: false,
                
                // 括号内的空格
                spaceInsideParentheses: false,
                spaceInsideBrackets: false,
                spaceInsideBraces: options.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces || false,
                
                // 控制流关键字
                spaceAfterControlFlowKeywords: true, // if, while, for, etc.
                spaceBeforeFunctionCallParentheses: false,
                spaceBeforeFunctionDeclarationParentheses: false,
                
                // 特殊情况
                spaceInEmptyParentheses: false,
                spaceInEmptyBraces: false
            });
        }
    }

    /**
     * 配置换行规则
     */
    private configureLineBreaks(context: IExtendedFormattingContext, options: any): void {
        const lineBreakManager = context.lineBreakManager;
        
        if ('configureStrategy' in lineBreakManager) {
            (lineBreakManager as any).configureStrategy({
                // 行长度限制
                maxLineLength: options.printWidth || 120,
                
                // 函数和控制流
                newLineAfterFunctionDeclaration: true,
                newLineBeforeElse: false,
                newLineBeforeCatch: false,
                
                // 代码块
                braceOnNewLine: options.insertSpaceBeforeAndAfterBinaryOperators || false,
                
                // 数组和映射
                arrayWrapThreshold: 3,      // 超过3个元素换行
                mappingWrapThreshold: 2,    // 超过2个键值对换行
                parameterWrapThreshold: 4,  // 超过4个参数换行
                
                // 表达式换行
                wrapLongExpressions: true,
                wrapChainedCalls: true,
                
                // 注释
                preserveExistingLineBreaks: true,
                respectLineBreaksAroundComments: true
            });
        }
    }

    /**
     * 配置运算符格式化
     */
    private configureOperators(context: IExtendedFormattingContext, options: any): void {
        const core = context.core;
        
        if ('configureOperators' in core) {
            (core as any).configureOperators({
                // 赋值运算符
                assignmentOperators: {
                    '=': ' = ',
                    '+=': ' += ',
                    '-=': ' -= ',
                    '*=': ' *= ',
                    '/=': ' /= ',
                    '%=': ' %= ',
                    '&=': ' &= ',
                    '|=': ' |= ',
                    '^=': ' ^= ',
                    '<<=': ' <<= ',
                    '>>=': ' >>= '
                },
                
                // 比较运算符
                comparisonOperators: {
                    '==': ' == ',
                    '!=': ' != ',
                    '<': ' < ',
                    '>': ' > ',
                    '<=': ' <= ',
                    '>=': ' >= '
                },
                
                // 逻辑运算符
                logicalOperators: {
                    '&&': ' && ',
                    '||': ' || ',
                    '!': '!'  // 一元运算符不加空格
                },
                
                // 算术运算符
                arithmeticOperators: {
                    '+': ' + ',
                    '-': ' - ',
                    '*': ' * ',
                    '/': ' / ',
                    '%': ' % '
                },
                
                // 位运算符
                bitwiseOperators: {
                    '&': ' & ',
                    '|': ' | ',
                    '^': ' ^ ',
                    '<<': ' << ',
                    '>>': ' >> ',
                    '~': '~'  // 一元运算符不加空格
                }
            });
        }
    }

    /**
     * 配置括号和分隔符
     */
    private configureBraces(context: IExtendedFormattingContext, options: any): void {
        if ('configureBraces' in context.core) {
            (context.core as any).configureBraces({
                // 大括号样式
                braceStyle: 'end-of-line', // 'end-of-line' | 'next-line' | 'next-line-shifted'
                
                // 小括号
                parentheses: {
                    spaceInside: false,
                    spaceAfterKeyword: true, // if (condition)
                    spaceBeforeFunctionCall: false // func()
                },
                
                // 方括号
                brackets: {
                    spaceInside: false,
                    spaceAroundIndex: false // array[index]
                },
                
                // 大括号
                braces: {
                    spaceInside: options.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces || false,
                    spaceBeforeOpening: true, // function() {
                    newLineAfterOpening: true,
                    newLineBeforeClosing: true
                },
                
                // 分隔符
                separators: {
                    comma: ', ',
                    semicolon: ';',
                    colon: ': ' // for mapping literals
                }
            });
        }
    }

    /**
     * 检查策略是否适用
     */
    public isApplicable(request: IFormattingRequest): boolean {
        // 标准策略适用于所有情况（作为默认策略）
        return true;
    }

    /**
     * 获取策略优先级
     */
    public getPriority(): number {
        return 50; // 中等优先级，作为默认策略
    }

    /**
     * 获取策略配置说明
     */
    public getConfigDescription(): string {
        return `
Standard formatting strategy configuration:
- Indentation: 4 spaces by default, respects user settings
- Spacing: Spaces around operators, after commas and keywords
- Line breaks: 120 character line limit, reasonable wrapping
- Braces: End-of-line style with proper spacing
- Operators: Consistent spacing around all operator types
        `.trim();
    }

    /**
     * 验证策略配置
     */
    public validateConfig(options: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // 验证缩进大小
        if (options.indentSize && (typeof options.indentSize !== 'number' || options.indentSize < 1)) {
            errors.push('indentSize must be a positive number');
        }
        
        // 验证行长度
        if (options.printWidth && (typeof options.printWidth !== 'number' || options.printWidth < 20)) {
            errors.push('printWidth must be a number greater than 20');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}