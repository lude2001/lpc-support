import { BaseFormattingRule, FormattingAction, RuleExecutionResult } from './RuleTypes';
import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { RuleContext } from 'antlr4ts';
import {
    SwitchStatementContext,
    SwitchLabelContext,
    ForeachStatementContext,
    ForeachVarContext,
    SliceExprContext,
    AnonFunctionContext,
    NewExpressionContext,
    CastExpressionContext,
    FunctionDefContext
} from '../../antlr/LPCParser';

/**
 * Switch语句范围匹配格式化规则
 * 处理 case x..y:, case ..x:, case x..: 语法
 */
export class SwitchRangeRule extends BaseFormattingRule {
    constructor() {
        super('SwitchRangeRule', 70);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof SwitchStatementContext ||
               (node instanceof SwitchLabelContext && this.hasRangeOperator(node));
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!this.canApply(node, context)) {
            return node.text;
        }

        if (node instanceof SwitchStatementContext) {
            return this.formatSwitchStatement(node, config, context);
        }

        if (node instanceof SwitchLabelContext) {
            return this.formatSwitchLabel(node, config, context);
        }

        return node.text;
    }

    private hasRangeOperator(node: SwitchLabelContext): boolean {
        return node.text.includes('..');
    }

    private formatSwitchStatement(node: SwitchStatementContext, config: FormattingConfig, context: FormattingContext): string {
        let result = 'switch';

        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }

        result += '(';

        // 格式化switch条件表达式
        const condition = this.extractSwitchCondition(node);
        if (config.spaceInsideParentheses) {
            result += ' ' + condition + ' ';
        } else {
            result += condition;
        }

        result += ')';

        if (config.spaceBeforeOpenBrace) {
            result += ' ';
        }

        result += '{\n';

        // 格式化case语句
        const cases = this.extractSwitchCases(node);
        const indent = this.getIndentString(context.indentLevel + 1, config);

        for (const caseItem of cases) {
            result += indent + caseItem + '\n';
        }

        result += this.getIndentString(context.indentLevel, config) + '}';

        return result;
    }

    private formatSwitchLabel(node: SwitchLabelContext, config: FormattingConfig, context: FormattingContext): string {
        const text = node.text.trim();

        if (text.startsWith('case')) {
            return this.formatCaseLabel(text, config);
        }

        if (text.startsWith('default')) {
            return 'default:';
        }

        return text;
    }

    private formatCaseLabel(text: string, config: FormattingConfig): string {
        // 匹配各种范围语法
        const rangePatterns = [
            /case\s+(\w+)\s*\.\.\s*(\w+)\s*:/,  // case x..y:
            /case\s*\.\.\s*(\w+)\s*:/,           // case ..x:
            /case\s+(\w+)\s*\.\.\s*:/            // case x..:
        ];

        for (const pattern of rangePatterns) {
            const match = text.match(pattern);
            if (match) {
                return this.formatRangeCase(match, config);
            }
        }

        // 普通case
        const normalMatch = text.match(/case\s+([^:]+):/);
        if (normalMatch) {
            return `case ${normalMatch[1].trim()}:`;
        }

        return text;
    }

    private formatRangeCase(match: RegExpMatchArray, config: FormattingConfig): string {
        const fullMatch = match[0];

        if (fullMatch.includes('..')) {
            const parts = fullMatch.replace(/case\s*/, '').replace(/:/, '').split('..');
            const start = parts[0].trim();
            const end = parts[1] ? parts[1].trim() : '';

            if (config.spaceAroundOperators) {
                if (start && end) {
                    return `case ${start} .. ${end}:`;
                } else if (start) {
                    return `case ${start} .. :`;
                } else if (end) {
                    return `case .. ${end}:`;
                }
            } else {
                if (start && end) {
                    return `case ${start}..${end}:`;
                } else if (start) {
                    return `case ${start}..:`;
                } else if (end) {
                    return `case ..${end}:`;
                }
            }
        }

        return fullMatch;
    }

    private extractSwitchCondition(node: SwitchStatementContext): string {
        // 简化实现，实际需要根据AST结构提取
        const text = node.text;
        const match = text.match(/switch\s*\(\s*([^)]+)\s*\)/);
        return match ? match[1].trim() : '';
    }

    private extractSwitchCases(node: SwitchStatementContext): string[] {
        // 简化实现，实际需要根据AST结构提取
        return [];
    }

    private getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }
}

/**
 * Foreach循环ref语法格式化规则
 * 处理 foreach (ref var in array) 语法
 */
export class ForeachRefRule extends BaseFormattingRule {
    constructor() {
        super('ForeachRefRule', 65);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof ForeachStatementContext ||
               (node instanceof ForeachVarContext && this.hasRefKeyword(node));
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!this.canApply(node, context)) {
            return node.text;
        }

        if (node instanceof ForeachStatementContext) {
            return this.formatForeachStatement(node, config, context);
        }

        if (node instanceof ForeachVarContext) {
            return this.formatForeachVar(node, config, context);
        }

        return node.text;
    }

    private hasRefKeyword(node: ForeachVarContext): boolean {
        return node.text.includes('ref');
    }

    private formatForeachStatement(node: ForeachStatementContext, config: FormattingConfig, context: FormattingContext): string {
        let result = 'foreach';

        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }

        result += '(';

        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        // 格式化foreach变量声明
        const vars = this.extractForeachVars(node);
        result += vars.join(', ');

        result += ' in ';

        // 格式化迭代表达式
        const iterExpr = this.extractIterationExpression(node);
        result += iterExpr;

        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        result += ')';

        if (config.spaceBeforeOpenBrace) {
            result += ' ';
        }

        // 格式化循环体
        const body = this.extractForeachBody(node);
        result += body;

        return result;
    }

    private formatForeachVar(node: ForeachVarContext, config: FormattingConfig, context: FormattingContext): string {
        const text = node.text.trim();

        // 匹配ref变量声明
        const refMatch = text.match(/(.*?)(\bref\b)\s*(\**)(\w+)/);
        if (refMatch) {
            const [, typeSpec, refKeyword, stars, varName] = refMatch;

            let result = '';
            if (typeSpec.trim()) {
                result += typeSpec.trim() + ' ';
            }
            result += refKeyword;
            if (config.spaceAfterKeywords) {
                result += ' ';
            }
            result += stars + varName;

            return result;
        }

        return text;
    }

    private extractForeachVars(node: ForeachStatementContext): string[] {
        // 简化实现，实际需要根据AST结构提取
        return [];
    }

    private extractIterationExpression(node: ForeachStatementContext): string {
        // 简化实现，实际需要根据AST结构提取
        return 'array';
    }

    private extractForeachBody(node: ForeachStatementContext): string {
        // 简化实现，实际需要根据AST结构提取
        return '{}';
    }
}

/**
 * 匿名函数格式化规则
 * 处理 function f = function(params) { body }; 语法
 */
export class AnonymousFunctionRule extends BaseFormattingRule {
    constructor() {
        super('AnonymousFunctionRule', 60);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof AnonFunctionContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof AnonFunctionContext)) {
            return node.text;
        }

        return this.formatAnonymousFunction(node, config, context);
    }

    private formatAnonymousFunction(node: AnonFunctionContext, config: FormattingConfig, context: FormattingContext): string {
        let result = 'function';

        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }

        result += '(';

        // 格式化参数列表
        const params = this.extractParameters(node);
        if (config.spaceInsideParentheses && params.length > 0) {
            result += ' ' + params.join(', ') + ' ';
        } else {
            result += params.join(', ');
        }

        result += ')';

        if (config.spaceBeforeOpenBrace) {
            result += ' ';
        }

        // 格式化函数体
        const body = this.extractFunctionBody(node);
        result += body;

        return result;
    }

    private extractParameters(node: AnonFunctionContext): string[] {
        // 简化实现，实际需要根据AST结构提取
        return [];
    }

    private extractFunctionBody(node: AnonFunctionContext): string {
        // 简化实现，实际需要根据AST结构提取
        return '{}';
    }
}

/**
 * 表达式函数指针格式化规则
 * 处理 (: $1 + $2 :), (: $(local_var) :) 语法
 */
export class ExpressionFunctionPointerRule extends BaseFormattingRule {
    constructor() {
        super('ExpressionFunctionPointerRule', 55);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.isExpressionFunctionPointer(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.isExpressionFunctionPointer(node.text)) {
            return node.text;
        }

        return this.formatExpressionFunctionPointer(node.text, config);
    }

    private isExpressionFunctionPointer(text: string): boolean {
        return /^\(\s*:\s*.*\s*:\s*\)$/.test(text.trim());
    }

    private formatExpressionFunctionPointer(text: string, config: FormattingConfig): string {
        const match = text.match(/\(\s*:\s*(.*)\s*:\s*\)/);
        if (!match) {
            return text;
        }

        const expression = match[1].trim();

        let result = '(:';
        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        result += expression;

        if (config.spaceInsideParentheses) {
            result += ' ';
        }
        result += ':)';

        return result;
    }
}

/**
 * Varargs函数格式化规则
 * 处理 void test(mixed *x...) 语法
 */
export class VarargsRule extends BaseFormattingRule {
    constructor() {
        super('VarargsRule', 50);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof FunctionDefContext && this.hasVarargs(node);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof FunctionDefContext) || !this.hasVarargs(node)) {
            return node.text;
        }

        return this.formatVarargsFunction(node, config, context);
    }

    private hasVarargs(node: FunctionDefContext): boolean {
        return node.text.includes('...');
    }

    private formatVarargsFunction(node: FunctionDefContext, config: FormattingConfig, context: FormattingContext): string {
        // 获取函数签名的各个部分
        const parts = this.extractFunctionParts(node);

        let result = '';

        // 修饰符
        if (parts.modifiers.length > 0) {
            result += parts.modifiers.join(' ') + ' ';
        }

        // 返回类型
        if (parts.returnType) {
            result += parts.returnType + ' ';
        }

        // 函数名
        result += parts.name;

        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }

        result += '(';

        // 格式化参数列表，特别处理varargs
        const formattedParams = this.formatParameters(parts.parameters, config);
        if (config.spaceInsideParentheses && formattedParams.length > 0) {
            result += ' ' + formattedParams + ' ';
        } else {
            result += formattedParams;
        }

        result += ')';

        if (config.spaceBeforeOpenBrace) {
            result += ' ';
        }

        // 函数体
        result += parts.body;

        return result;
    }

    private formatParameters(parameters: string[], config: FormattingConfig): string {
        return parameters.map(param => {
            if (param.includes('...')) {
                // 格式化varargs参数
                return this.formatVarargsParameter(param, config);
            }
            return param;
        }).join(', ');
    }

    private formatVarargsParameter(param: string, config: FormattingConfig): string {
        // 匹配 type *name... 或 type name... 模式
        const match = param.match(/^(.*?)(\**)(\w+)(\.\.\.)/);
        if (match) {
            const [, type, stars, name, ellipsis] = match;
            return `${type.trim()} ${stars}${name}${ellipsis}`;
        }
        return param;
    }

    private extractFunctionParts(node: FunctionDefContext): {
        modifiers: string[];
        returnType: string;
        name: string;
        parameters: string[];
        body: string;
    } {
        // 简化实现，实际需要根据AST结构提取
        return {
            modifiers: [],
            returnType: 'void',
            name: 'function',
            parameters: [],
            body: '{}'
        };
    }
}

/**
 * 字符串和数组范围操作格式化规则
 * 处理 str[start..end], str[<n], str[n..], array1 + array2 等语法
 */
export class RangeOperationRule extends BaseFormattingRule {
    constructor() {
        super('RangeOperationRule', 45);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof SliceExprContext ||
               (node instanceof TerminalNode && this.hasRangeOperation(node.text));
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!this.canApply(node, context)) {
            return node.text;
        }

        if (node instanceof SliceExprContext) {
            return this.formatSliceExpression(node, config, context);
        }

        if (node instanceof TerminalNode) {
            return this.formatRangeOperation(node.text, config);
        }

        return node.text;
    }

    private hasRangeOperation(text: string): boolean {
        return /\[.*\.\.|<\d+|\d+\.\.]/.test(text);
    }

    private formatSliceExpression(node: SliceExprContext, config: FormattingConfig, context: FormattingContext): string {
        const text = node.text.trim();

        // 处理各种切片语法
        if (text.includes('..')) {
            return this.formatRangeSlice(text, config);
        }

        if (text.startsWith('<')) {
            return this.formatTailSlice(text, config);
        }

        return text;
    }

    private formatRangeSlice(text: string, config: FormattingConfig): string {
        const match = text.match(/\[\s*([^.]*)\.\.\s*([^]]*)\s*\]/);
        if (match) {
            const [, start, end] = match;

            if (config.spaceAroundOperators) {
                return `[${start.trim()} .. ${end.trim()}]`;
            } else {
                return `[${start.trim()}..${end.trim()}]`;
            }
        }

        return text;
    }

    private formatTailSlice(text: string, config: FormattingConfig): string {
        const match = text.match(/\[\s*<\s*(\d+)\s*\]/);
        if (match) {
            const [, num] = match;
            return `[<${num}]`;
        }

        return text;
    }

    private formatRangeOperation(text: string, config: FormattingConfig): string {
        // 处理数组操作
        if (text.includes('+') || text.includes('-') || text.includes('&')) {
            return this.formatArrayOperation(text, config);
        }

        return text;
    }

    private formatArrayOperation(text: string, config: FormattingConfig): string {
        const operators = ['+', '-', '&'];

        for (const op of operators) {
            if (text.includes(op)) {
                const parts = text.split(op);
                if (parts.length === 2) {
                    if (config.spaceAroundOperators) {
                        return `${parts[0].trim()} ${op} ${parts[1].trim()}`;
                    } else {
                        return `${parts[0].trim()}${op}${parts[1].trim()}`;
                    }
                }
            }
        }

        return text;
    }
}

/**
 * 默认参数格式化规则
 * 处理 void func(type param : (: default_value :)) 语法
 */
export class DefaultParameterRule extends BaseFormattingRule {
    constructor() {
        super('DefaultParameterRule', 40);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.hasDefaultParameter(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.hasDefaultParameter(node.text)) {
            return node.text;
        }

        return this.formatDefaultParameter(node.text, config);
    }

    private hasDefaultParameter(text: string): boolean {
        return /:\s*\(\s*:.*:\s*\)/.test(text);
    }

    private formatDefaultParameter(text: string, config: FormattingConfig): string {
        const match = text.match(/^(.*):\s*\(\s*:\s*(.*)\s*:\s*\)(.*)$/);
        if (match) {
            const [, before, defaultValue, after] = match;

            let result = before.trim();

            if (config.spaceAroundOperators) {
                result += ' : ';
            } else {
                result += ':';
            }

            result += '(:';
            if (config.spaceInsideParentheses) {
                result += ' ';
            }
            result += defaultValue.trim();
            if (config.spaceInsideParentheses) {
                result += ' ';
            }
            result += ':)';

            result += after;

            return result;
        }

        return text;
    }
}

/**
 * New表达式格式化规则
 * 处理 new(type, member: value) 语法
 */
export class NewExpressionRule extends BaseFormattingRule {
    constructor() {
        super('NewExpressionRule', 35);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof NewExpressionContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof NewExpressionContext)) {
            return node.text;
        }

        return this.formatNewExpression(node, config, context);
    }

    private formatNewExpression(node: NewExpressionContext, config: FormattingConfig, context: FormattingContext): string {
        let result = 'new';

        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }

        result += '(';

        // 格式化类型和初始化器
        const parts = this.extractNewExpressionParts(node);

        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        result += parts.type;

        if (parts.initializers.length > 0) {
            result += ', ';
            result += parts.initializers.join(', ');
        }

        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        result += ')';

        return result;
    }

    private extractNewExpressionParts(node: NewExpressionContext): {
        type: string;
        initializers: string[];
    } {
        // 简化实现，实际需要根据AST结构提取
        return {
            type: 'object',
            initializers: []
        };
    }
}

/**
 * 类型转换格式化规则
 * 处理 (type)expression 语法
 */
export class CastExpressionRule extends BaseFormattingRule {
    constructor() {
        super('CastExpressionRule', 30);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof CastExpressionContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof CastExpressionContext)) {
            return node.text;
        }

        return this.formatCastExpression(node, config, context);
    }

    private formatCastExpression(node: CastExpressionContext, config: FormattingConfig, context: FormattingContext): string {
        const parts = this.extractCastParts(node);

        let result = '(';

        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        result += parts.type;

        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        result += ')';

        if (config.spaceAfterCast) {
            result += ' ';
        }

        result += parts.expression;

        return result;
    }

    private extractCastParts(node: CastExpressionContext): {
        type: string;
        expression: string;
    } {
        // 简化实现，实际需要根据AST结构提取
        return {
            type: 'int',
            expression: 'value'
        };
    }
}