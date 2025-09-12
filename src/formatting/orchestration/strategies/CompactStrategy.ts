/**
 * 紧凑格式化策略
 * 
 * 提供紧凑的代码格式化：
 * - 最小化空行和空格
 * - 优先单行显示
 * - 适合代码审查和传输
 */

import { 
    IFormattingStrategy, 
    FormattingStrategyType, 
    IFormattingRequest 
} from '../types';
import { IExtendedFormattingContext } from '../../types/interfaces';

export class CompactStrategy implements IFormattingStrategy {
    public readonly name = 'Compact';
    public readonly type = FormattingStrategyType.COMPACT;
    public readonly description = 'Compact formatting with minimal whitespace and single-line preference';

    /**
     * 应用紧凑格式化策略
     */
    public apply(context: IExtendedFormattingContext, request: IFormattingRequest): void {
        const options = request.options;

        // 设置紧凑缩进配置
        this.configureIndentation(context, options);
        
        // 设置紧凑空格配置
        this.configureSpacing(context, options);
        
        // 设置紧凑换行配置
        this.configureLineBreaks(context, options);
        
        // 设置紧凑运算符格式化
        this.configureOperators(context, options);
        
        // 设置紧凑括号配置
        this.configureBraces(context, options);
    }

    /**
     * 配置紧凑缩进规则
     */
    private configureIndentation(context: IExtendedFormattingContext, options: any): void {
        const indentManager = context.indentManager;
        
        if ('configureStrategy' in indentManager) {
            (indentManager as any).configureStrategy({
                // 使用较小的缩进
                indentSize: Math.min(options.indentSize || 4, 2),
                useTabsForIndentation: options.insertSpaces === false,
                
                // 紧凑策略特定配置
                continuationIndentSize: 2,   // 续行使用更小缩进
                switchCaseIndent: false,     // case 不额外缩进
                parameterIndent: false,      // 参数列表不额外缩进
                expressionIndent: false,     // 表达式换行不额外缩进
                minimizeIndentation: true    // 尽可能减少缩进层级
            });
        }
    }

    /**
     * 配置紧凑空格规则
     */
    private configureSpacing(context: IExtendedFormattingContext, options: any): void {
        const core = context.core;
        
        if ('configureSpacing' in core) {
            (core as any).configureSpacing({
                // 运算符周围最小空格
                spaceAroundOperators: true,
                spaceAroundAssignmentOperators: true,
                spaceAroundLogicalOperators: true,
                spaceAroundComparisonOperators: true,
                
                // 标点符号紧凑处理
                spaceAfterComma: true,
                spaceAfterSemicolon: false,  // 分号后不加空格（如果可能）
                spaceBeforeComma: false,
                
                // 括号内无空格
                spaceInsideParentheses: false,
                spaceInsideBrackets: false,
                spaceInsideBraces: false,
                
                // 控制流关键字最小空格
                spaceAfterControlFlowKeywords: true,
                spaceBeforeFunctionCallParentheses: false,
                spaceBeforeFunctionDeclarationParentheses: false,
                
                // 空结构无空格
                spaceInEmptyParentheses: false,
                spaceInEmptyBraces: false,
                
                // 紧凑特殊配置
                minimizeWhitespace: true,
                compactMultipleSpaces: true  // 将多个空格压缩为单个
            });
        }
    }

    /**
     * 配置紧凑换行规则
     */
    private configureLineBreaks(context: IExtendedFormattingContext, options: any): void {
        const lineBreakManager = context.lineBreakManager;
        
        if ('configureStrategy' in lineBreakManager) {
            (lineBreakManager as any).configureStrategy({
                // 更长的行长度限制，优先单行
                maxLineLength: Math.max(options.printWidth || 120, 140),
                
                // 函数和控制流紧凑化
                newLineAfterFunctionDeclaration: false,
                newLineBeforeElse: false,
                newLineBeforeCatch: false,
                
                // 代码块紧凑化
                braceOnNewLine: false,
                
                // 数组和映射高阈值
                arrayWrapThreshold: 8,       // 更多元素才换行
                mappingWrapThreshold: 5,     // 更多键值对才换行
                parameterWrapThreshold: 6,   // 更多参数才换行
                
                // 表达式尽可能单行
                wrapLongExpressions: false,
                wrapChainedCalls: false,
                
                // 注释处理
                preserveExistingLineBreaks: false,  // 不保留现有换行
                respectLineBreaksAroundComments: false,
                
                // 紧凑特殊配置
                preferSingleLine: true,
                minimizeEmptyLines: true,
                compactBlocks: true,
                inlineShortBlocks: true     // 短代码块内联
            });
        }
    }

    /**
     * 配置紧凑运算符格式化
     */
    private configureOperators(context: IExtendedFormattingContext, options: any): void {
        const core = context.core;
        
        if ('configureOperators' in core) {
            (core as any).configureOperators({
                // 保持基本的运算符空格，但更紧凑
                assignmentOperators: {
                    '=': '=',      // 可选：移除赋值运算符空格
                    '+=': '+=',
                    '-=': '-=',
                    '*=': '*=',
                    '/=': '/=',
                    '%=': '%=',
                    '&=': '&=',
                    '|=': '|=',
                    '^=': '^=',
                    '<<=': '<<=',
                    '>>=': '>>='
                },
                
                // 比较运算符保持空格（可读性）
                comparisonOperators: {
                    '==': '==',
                    '!=': '!=',
                    '<': '<',
                    '>': '>',
                    '<=': '<=',
                    '>=': '>='
                },
                
                // 逻辑运算符
                logicalOperators: {
                    '&&': '&&',
                    '||': '||',
                    '!': '!'
                },
                
                // 算术运算符
                arithmeticOperators: {
                    '+': '+',
                    '-': '-',
                    '*': '*',
                    '/': '/',
                    '%': '%'
                },
                
                // 位运算符
                bitwiseOperators: {
                    '&': '&',
                    '|': '|',
                    '^': '^',
                    '<<': '<<',
                    '>>': '>>',
                    '~': '~'
                },
                
                // 紧凑特殊配置
                compactMode: true,
                preserveReadabilityForComplexExpressions: true
            });
        }
    }

    /**
     * 配置紧凑括号和分隔符
     */
    private configureBraces(context: IExtendedFormattingContext, options: any): void {
        if ('configureBraces' in context.core) {
            (context.core as any).configureBraces({
                // 紧凑的大括号样式
                braceStyle: 'end-of-line',
                
                // 小括号无内部空格
                parentheses: {
                    spaceInside: false,
                    spaceAfterKeyword: false,    // if(condition) - 紧凑模式
                    spaceBeforeFunctionCall: false
                },
                
                // 方括号紧凑
                brackets: {
                    spaceInside: false,
                    spaceAroundIndex: false
                },
                
                // 大括号紧凑
                braces: {
                    spaceInside: false,
                    spaceBeforeOpening: false,   // function(){
                    newLineAfterOpening: false,  // {statements;}
                    newLineBeforeClosing: false,
                    inlineShortBlocks: true
                },
                
                // 分隔符紧凑
                separators: {
                    comma: ',',     // 无空格的逗号
                    semicolon: ';',
                    colon: ':'      // 紧凑的冒号
                },
                
                // 紧凑特殊配置
                compactMode: true,
                inlineThreshold: 80  // 短于80字符的代码块内联
            });
        }
    }

    /**
     * 检查策略是否适用
     */
    public isApplicable(request: IFormattingRequest): boolean {
        // 检查是否适合紧凑模式的场景
        const text = request.text;
        
        // 小文件更适合紧凑模式
        if (text.length < 5000) {
            return true;
        }
        
        // 检查是否包含大量简短语句
        const lines = text.split('\n');
        const shortLines = lines.filter(line => line.trim().length < 50).length;
        const shortLineRatio = shortLines / lines.length;
        
        // 如果大部分是短行，适合紧凑模式
        return shortLineRatio > 0.6;
    }

    /**
     * 获取策略优先级
     */
    public getPriority(): number {
        return 30; // 较低优先级，需要特定场景
    }

    /**
     * 获取紧凑模式配置说明
     */
    public getConfigDescription(): string {
        return `
Compact formatting strategy configuration:
- Indentation: Minimal indentation (2 spaces max)
- Spacing: Minimal whitespace, no spaces around operators where possible
- Line breaks: Longer line limits, prefer single-line statements
- Braces: Inline short blocks, compact brace placement
- Operators: Compact operator formatting while preserving readability
- Best for: Small files, code reviews, network transmission
        `.trim();
    }

    /**
     * 获取紧凑模式适用建议
     */
    public getUsageRecommendations(): string[] {
        return [
            'Use for small utility files and scripts',
            'Ideal for code snippets and examples',
            'Good for reducing file size in constrained environments',
            'Suitable for generated code that humans rarely read',
            'Consider readability impact for team development',
            'May not be suitable for complex business logic'
        ];
    }

    /**
     * 验证紧凑模式配置
     */
    public validateConfig(options: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        // 验证最小缩进
        if (options.indentSize && options.indentSize < 1) {
            errors.push('Compact mode requires at least 1 space indentation');
        }
        
        // 验证行长度不能太小
        if (options.printWidth && options.printWidth < 80) {
            errors.push('Compact mode works best with line width >= 80');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 计算紧凑度评分
     */
    public calculateCompactnessScore(text: string): number {
        const lines = text.split('\n');
        const totalChars = text.length;
        const totalLines = lines.length;
        const avgLineLength = totalChars / totalLines;
        
        // 基于行长度和密度计算紧凑度
        const densityScore = Math.min(avgLineLength / 50, 1); // 标准化到0-1
        const emptyLineRatio = lines.filter(line => line.trim() === '').length / totalLines;
        const compactnessScore = densityScore * (1 - emptyLineRatio);
        
        return Math.round(compactnessScore * 100);
    }
}