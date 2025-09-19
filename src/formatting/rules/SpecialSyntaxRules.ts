import { BaseFormattingRule } from './RuleTypes';
import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';

/**
 * 定界符语法格式化规则
 * 处理 @DELIMITER...DELIMITER; 和 @@DELIMITER...DELIMITER; 语法
 */
export class DelimiterSyntaxRule extends BaseFormattingRule {
    constructor() {
        super('DelimiterSyntaxRule', 85);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.isDelimiterSyntax(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.isDelimiterSyntax(node.text)) {
            return node.text;
        }

        return this.formatDelimiterSyntax(node.text, config, context);
    }

    private isDelimiterSyntax(text: string): boolean {
        return /^@@?\w+/.test(text.trim()) && text.includes(';');
    }

    private formatDelimiterSyntax(text: string, config: FormattingConfig, context: FormattingContext): string {
        const lines = text.split('\n');
        const indent = this.getIndentString(context.indentLevel, config);

        let result = '';
        let inDelimiterBlock = false;
        let delimiter = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('@') && !inDelimiterBlock) {
                // 开始定界符块
                inDelimiterBlock = true;
                delimiter = this.extractDelimiterName(line);
                result += indent + line + '\n';
            } else if (line === delimiter && inDelimiterBlock) {
                // 结束定界符块
                inDelimiterBlock = false;
                result += indent + line;
                if (i < lines.length - 1 || !line.endsWith(';')) {
                    result += ';';
                }
                result += '\n';
            } else if (inDelimiterBlock) {
                // 定界符块内的内容保持原样
                result += line + '\n';
            } else {
                // 普通行
                result += indent + line + '\n';
            }
        }

        return result.trim();
    }

    private extractDelimiterName(line: string): string {
        const match = line.match(/^@@?(\w+)/);
        return match ? match[1] : '';
    }

    private getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }
}

/**
 * 数组延展语法格式化规则
 * 处理 ...array 语法（参数解包）
 */
export class ArraySpreadRule extends BaseFormattingRule {
    constructor() {
        super('ArraySpreadRule', 55);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.hasSpreadSyntax(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.hasSpreadSyntax(node.text)) {
            return node.text;
        }

        return this.formatSpreadSyntax(node.text, config, context);
    }

    private hasSpreadSyntax(text: string): boolean {
        return /\.\.\./.test(text);
    }

    private formatSpreadSyntax(text: string, config: FormattingConfig, context: FormattingContext): string {
        // 格式化数组延展语法
        const formatted = text.replace(/\.\.\.\s*([a-zA-Z_]\w*)/, '...$1');

        if (config.spaceAroundOperators && context.inFunction) {
            // 在函数参数中，延展操作符前可能需要空格
            return formatted.replace(/,\.\.\./g, ', ...');
        }

        return formatted;
    }
}

/**
 * 类作用域语法格式化规则
 * 处理 class::member 语法
 */
export class ClassScopeRule extends BaseFormattingRule {
    constructor() {
        super('ClassScopeRule', 50);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.hasClassScope(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.hasClassScope(node.text)) {
            return node.text;
        }

        return this.formatClassScope(node.text, config);
    }

    private hasClassScope(text: string): boolean {
        return /\w+::\w+/.test(text);
    }

    private formatClassScope(text: string, config: FormattingConfig): string {
        // 格式化类作用域操作符
        if (config.spaceAroundOperators) {
            return text.replace(/(\w+)\s*::\s*(\w+)/, '$1 :: $2');
        } else {
            return text.replace(/(\w+)\s*::\s*(\w+)/, '$1::$2');
        }
    }
}

/**
 * 预处理指令格式化规则
 * 处理 #define, #include, #if/#ifdef/#ifndef 等指令
 */
export class PreprocessorRule extends BaseFormattingRule {
    constructor() {
        super('PreprocessorRule', 95); // 高优先级，因为预处理指令有特殊的格式要求
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.isPreprocessorDirective(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.isPreprocessorDirective(node.text)) {
            return node.text;
        }

        return this.formatPreprocessorDirective(node.text, config, context);
    }

    private isPreprocessorDirective(text: string): boolean {
        return /^\s*#\s*(define|include|if|ifdef|ifndef|else|elif|endif|undef|pragma)/.test(text);
    }

    private formatPreprocessorDirective(text: string, config: FormattingConfig, context: FormattingContext): string {
        const lines = text.split('\n');
        let result = '';

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('#')) {
                result += this.formatSingleDirective(trimmed, config) + '\n';
            } else if (trimmed.length > 0) {
                // 续行或其他内容
                result += line + '\n';
            } else {
                result += '\n';
            }
        }

        return result.trim();
    }

    private formatSingleDirective(line: string, config: FormattingConfig): string {
        // 匹配不同类型的预处理指令
        const defineMatch = line.match(/^#\s*define\s+(\w+)(?:\s*\(\s*([^)]*)\s*\))?\s*(.*)?$/);
        if (defineMatch) {
            return this.formatDefine(defineMatch, config);
        }

        const includeMatch = line.match(/^#\s*include\s+(.+)$/);
        if (includeMatch) {
            return this.formatInclude(includeMatch, config);
        }

        const conditionalMatch = line.match(/^#\s*(if|ifdef|ifndef|elif)\s+(.+)$/);
        if (conditionalMatch) {
            return this.formatConditional(conditionalMatch, config);
        }

        const simpleMatch = line.match(/^#\s*(else|endif|undef)\s*(.*)$/);
        if (simpleMatch) {
            return this.formatSimple(simpleMatch, config);
        }

        return line;
    }

    private formatDefine(match: RegExpMatchArray, config: FormattingConfig): string {
        const [, name, params, body] = match;

        let result = '#define ' + name;

        if (params !== undefined) {
            result += '(';
            if (params.trim()) {
                const paramList = params.split(',').map(p => p.trim());
                result += paramList.join(', ');
            }
            result += ')';
        }

        if (body && body.trim()) {
            result += ' ' + body.trim();
        }

        return result;
    }

    private formatInclude(match: RegExpMatchArray, config: FormattingConfig): string {
        const [, path] = match;
        const trimmedPath = path.trim();

        // 确保路径有适当的引号
        if (!trimmedPath.startsWith('"') && !trimmedPath.startsWith('<')) {
            return '#include "' + trimmedPath + '"';
        }

        return '#include ' + trimmedPath;
    }

    private formatConditional(match: RegExpMatchArray, config: FormattingConfig): string {
        const [, directive, condition] = match;
        return '#' + directive + ' ' + condition.trim();
    }

    private formatSimple(match: RegExpMatchArray, config: FormattingConfig): string {
        const [, directive, rest] = match;

        if (rest && rest.trim()) {
            return '#' + directive + ' ' + rest.trim();
        }

        return '#' + directive;
    }
}

/**
 * 复杂嵌套结构格式化规则
 * 处理深层嵌套的控制流和数据结构
 */
export class NestedStructureRule extends BaseFormattingRule {
    constructor() {
        super('NestedStructureRule', 25);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        // 当缩进层级较深时应用此规则
        return context.indentLevel > 2;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (context.indentLevel <= 2) {
            return node.text;
        }

        return this.formatDeepNesting(node.text, config, context);
    }

    private formatDeepNesting(text: string, config: FormattingConfig, context: FormattingContext): string {
        // 对于深度嵌套的结构，可能需要特殊的格式化处理
        const lines = text.split('\n');
        const indent = this.getIndentString(context.indentLevel, config);

        let result = '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
                // 检查是否需要额外的换行以提高可读性
                if (context.lineLength + trimmed.length > config.maxLineLength * 0.8) {
                    result += '\n' + indent + trimmed;
                } else {
                    result += indent + trimmed;
                }

                if (!trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}')) {
                    result += '\n';
                }
            } else {
                result += '\n';
            }
        }

        return result.trim();
    }

    private getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }
}

/**
 * 引用传递格式化规则
 * 处理 void func(type ref param) 语法
 */
export class ReferenceParameterRule extends BaseFormattingRule {
    constructor() {
        super('ReferenceParameterRule', 45);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode &&
               context.inFunction &&
               this.hasReferenceParameter(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !this.hasReferenceParameter(node.text)) {
            return node.text;
        }

        return this.formatReferenceParameter(node.text, config);
    }

    private hasReferenceParameter(text: string): boolean {
        return /\bref\s+\w+/.test(text);
    }

    private formatReferenceParameter(text: string, config: FormattingConfig): string {
        // 格式化引用参数
        return text.replace(/\b(ref)\s+(\w+)/g, (match, ref, param) => {
            if (config.spaceAfterKeywords) {
                return `${ref} ${param}`;
            } else {
                return `${ref} ${param}`;
            }
        });
    }
}