import { BaseFormattingRule, IndentationType, SpaceType, NewlineType } from './RuleTypes';
import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    BlockContext,
    FunctionDefContext,
    IfStatementContext,
    WhileStatementContext,
    ForStatementContext,
    ExpressionContext,
    VariableDeclContext
} from '../../antlr/LPCParser';

/**
 * 缩进规则
 */
export class IndentationRule extends BaseFormattingRule {
    constructor() {
        super('IndentationRule', 100);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof BlockContext ||
               node instanceof FunctionDefContext ||
               node instanceof IfStatementContext ||
               node instanceof WhileStatementContext ||
               node instanceof ForStatementContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        const indent = this.getIndentString(context.indentLevel, config);
        
        if (node instanceof BlockContext) {
            return this.formatBlock(node, config, context, indent);
        } else if (node instanceof FunctionDefContext) {
            return this.formatFunction(node, config, context, indent);
        } else if (node instanceof IfStatementContext) {
            return this.formatIfStatement(node, config, context, indent);
        } else if (node instanceof WhileStatementContext) {
            return this.formatWhileStatement(node, config, context, indent);
        } else if (node instanceof ForStatementContext) {
            return this.formatForStatement(node, config, context, indent);
        }
        
        return node.text;
    }

    private getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }

    private formatBlock(node: BlockContext, config: FormattingConfig, context: FormattingContext, indent: string): string {
        let result = '';
        
        if (config.newlineBeforeOpenBrace && !context.inFunction) {
            result += '\n' + indent;
        }
        
        result += '{';
        
        if (config.newlineAfterOpenBrace) {
            result += '\n';
        }
        
        // 处理块内容
        const childContext = { ...context, indentLevel: context.indentLevel + 1 };
        const childIndent = this.getIndentString(childContext.indentLevel, config);
        
        for (let i = 0; i < node.childCount; i++) {
            const child = node.getChild(i);
            if (child instanceof TerminalNode) {
                const text = child.text.trim();
                if (text === '{' || text === '}') continue;
                
                result += childIndent + text;
                if (text.endsWith(';')) {
                    result += '\n';
                }
            } else {
                // 递归处理子节点
                result += childIndent + this.apply(child, config, childContext) + '\n';
            }
        }
        
        if (config.newlineBeforeCloseBrace) {
            result += indent;
        }
        
        result += '}';
        
        return result;
    }

    private formatFunction(node: FunctionDefContext, config: FormattingConfig, context: FormattingContext, indent: string): string {
        let result = indent;
        
        // 处理函数声明
        const funcContext = { ...context, inFunction: true };
        
        // 这里需要根据实际的ANTLR语法规则来处理
        // 这是一个简化的处理
        result += node.text;
        
        return result;
    }

    private formatIfStatement(node: IfStatementContext, config: FormattingConfig, context: FormattingContext, indent: string): string {
        let result = indent + 'if';
        
        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }
        
        result += '(';
        
        // 处理条件表达式
        // 这里需要根据实际的ANTLR语法规则来处理
        
        result += ')';
        
        return result;
    }

    private formatWhileStatement(node: WhileStatementContext, config: FormattingConfig, context: FormattingContext, indent: string): string {
        let result = indent + 'while';
        
        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }
        
        result += '(';
        
        // 处理条件表达式
        // 这里需要根据实际的ANTLR语法规则来处理
        
        result += ')';
        
        return result;
    }

    private formatForStatement(node: ForStatementContext, config: FormattingConfig, context: FormattingContext, indent: string): string {
        let result = indent + 'for';
        
        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }
        
        result += '(';
        
        // 处理for循环的三个部分
        // 这里需要根据实际的ANTLR语法规则来处理
        
        result += ')';
        
        return result;
    }
}

/**
 * 空格规则
 */
export class SpacingRule extends BaseFormattingRule {
    constructor() {
        super('SpacingRule', 90);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode)) {
            return node.text;
        }

        const text = node.text;
        
        // 处理操作符周围的空格
        if (this.isOperator(text) && config.spaceAroundOperators) {
            return ` ${text} `;
        }
        
        // 处理逗号后的空格
        if (text === ',' && config.spaceAfterComma) {
            return ', ';
        }
        
        // 处理分号后的空格
        if (text === ';' && config.spaceAfterSemicolon) {
            return '; ';
        }
        
        return text;
    }

    private isOperator(text: string): boolean {
        const operators = [
            '+', '-', '*', '/', '%',
            '==', '!=', '<', '>', '<=', '>=',
            '&&', '||', '!',
            '&', '|', '^', '~',
            '<<', '>>', 
            '=', '+=', '-=', '*=', '/='
        ];
        
        return operators.includes(text);
    }
}

/**
 * 换行规则
 */
export class NewlineRule extends BaseFormattingRule {
    constructor() {
        super('NewlineRule', 80);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return true; // 所有节点都可能需要换行处理
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        let result = node.text;
        
        // 检查行长度，必要时换行
        if (context.lineLength > config.maxLineLength) {
            // 在适当位置换行
            result = this.wrapLine(result, config, context);
        }
        
        return result;
    }

    private wrapLine(text: string, config: FormattingConfig, context: FormattingContext): string {
        // 这里需要实现智能换行逻辑
        // 在逗号、操作符等位置换行
        return text; // 简化处理
    }
}

/**
 * 大括号规则
 */
export class BraceRule extends BaseFormattingRule {
    constructor() {
        super('BraceRule', 75);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && (node.text === '{' || node.text === '}');
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode)) {
            return node.text;
        }

        const text = node.text;

        if (text === '{') {
            let result = '';
            if (config.spaceBeforeOpenBrace) {
                result += ' ';
            }
            result += '{';
            if (config.newlineAfterOpenBrace) {
                result += '\n';
            }
            return result;
        }

        if (text === '}') {
            let result = '';
            if (config.newlineBeforeCloseBrace) {
                result += '\n';
            }
            result += '}';
            return result;
        }

        return text;
    }
}

/**
 * 注释规则
 */
export class CommentRule extends BaseFormattingRule {
    constructor() {
        super('CommentRule', 60);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof TerminalNode && this.isComment(node.text);
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof TerminalNode) || !config.preserveComments) {
            return node.text;
        }

        const text = node.text;

        if (this.isLineComment(text)) {
            return this.formatLineComment(text, config, context);
        }

        if (this.isBlockComment(text)) {
            return this.formatBlockComment(text, config, context);
        }

        return text;
    }

    private isComment(text: string): boolean {
        return this.isLineComment(text) || this.isBlockComment(text);
    }

    private isLineComment(text: string): boolean {
        return text.startsWith('//');
    }

    private isBlockComment(text: string): boolean {
        return text.startsWith('/*') && text.endsWith('*/');
    }

    private formatLineComment(text: string, config: FormattingConfig, context: FormattingContext): string {
        const content = text.substring(2).trim();
        if (content.length === 0) {
            return '//';
        }
        return '// ' + content;
    }

    private formatBlockComment(text: string, config: FormattingConfig, context: FormattingContext): string {
        if (text.includes('\n')) {
            // 多行注释
            return this.formatMultilineComment(text, config, context);
        } else {
            // 单行注释
            const content = text.substring(2, text.length - 2).trim();
            if (content.length === 0) {
                return '/**/';
            }
            return '/* ' + content + ' */';
        }
    }

    private formatMultilineComment(text: string, config: FormattingConfig, context: FormattingContext): string {
        const lines = text.split('\n');
        const indent = this.getIndentString(context.indentLevel, config);

        let result = '/*\n';

        for (let i = 1; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            if (line.startsWith('*')) {
                result += indent + ' ' + line + '\n';
            } else {
                result += indent + ' * ' + line + '\n';
            }
        }

        result += indent + ' */';

        return result;
    }

    private getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }
}

/**
 * 变量声明规则
 */
export class VariableDeclarationRule extends BaseFormattingRule {
    constructor() {
        super('VariableDeclarationRule', 70);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof VariableDeclContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof VariableDeclContext)) {
            return node.text;
        }

        // 格式化变量声明
        let result = '';

        // 这里需要根据实际的ANTLR语法规则来处理
        // 例如：int x = 5;

        return node.text; // 简化处理
    }
}