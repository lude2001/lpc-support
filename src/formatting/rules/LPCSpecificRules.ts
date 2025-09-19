import { BaseFormattingRule } from './RuleTypes';
import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import {
    PostfixExpressionContext,
    ArrayLiteralContext,
    MappingLiteralExprContext,
    InheritStatementContext,
    ClosurePrimaryContext
} from '../../antlr/LPCParser';

/**
 * LPC 函数指针格式化规则
 * 处理 (: function_name :) 语法
 */
export class FunctionPointerRule extends BaseFormattingRule {
    constructor() {
        super('FunctionPointerRule', 60);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof ClosurePrimaryContext ||
               (node instanceof TerminalNode && this.isFunctionPointer(node.text));
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!config.formatFunctionPointers) {
            return node.text;
        }

        if (node instanceof ClosurePrimaryContext) {
            return this.formatClosure(node, config, context);
        }

        if (node instanceof TerminalNode && this.isFunctionPointer(node.text)) {
            return this.formatFunctionPointerText(node.text, config);
        }

        return node.text;
    }

    private isFunctionPointer(text: string): boolean {
        return /^\(\s*:\s*\w+\s*:\s*\)$/.test(text.trim());
    }

    private formatClosure(node: ClosurePrimaryContext, config: FormattingConfig, context: FormattingContext): string {
        // 处理闭包函数指针
        let result = '(:';
        
        if (config.spaceInsideParentheses) {
            result += ' ';
        }

        // 获取函数名
        const functionName = this.extractFunctionName(node);
        result += functionName;

        if (config.spaceInsideParentheses) {
            result += ' ';
        }
        
        result += ':)';
        
        return result;
    }

    private formatFunctionPointerText(text: string, config: FormattingConfig): string {
        // 使用正则表达式提取函数名
        const match = text.match(/\(\s*:\s*(\w+)\s*:\s*\)/);
        if (!match) {
            return text;
        }

        const functionName = match[1];
        
        let result = '(:';
        if (config.spaceInsideParentheses) {
            result += ' ';
        }
        
        result += functionName;
        
        if (config.spaceInsideParentheses) {
            result += ' ';
        }
        
        result += ':)';
        
        return result;
    }

    private extractFunctionName(node: ClosurePrimaryContext): string {
        // 这里需要根据实际的ANTLR语法规则来提取函数名
        // 简化处理，返回整个节点的文本
        return node.text.replace(/[(:) ]/g, '');
    }
}

/**
 * LPC 数组格式化规则
 * 处理 ({ element1, element2 }) 和 type *array 语法
 */
export class ArrayFormattingRule extends BaseFormattingRule {
    constructor() {
        super('ArrayFormattingRule', 50);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof ArrayLiteralContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof ArrayLiteralContext) || !config.formatArrays) {
            return node.text;
        }

        return this.formatArrayLiteral(node, config, context);
    }

    private formatArrayLiteral(node: ArrayLiteralContext, config: FormattingConfig, context: FormattingContext): string {
        let result = '({ ';
        
        const arrayContext = { ...context, inArray: true };
        
        // 处理数组元素
        const elements = this.extractArrayElements(node);
        
        for (let i = 0; i < elements.length; i++) {
            result += elements[i];
            
            if (i < elements.length - 1) {
                result += ',';
                if (config.spaceAfterComma) {
                    result += ' ';
                }
            }
        }
        
        result += ' })';
        
        return result;
    }

    private extractArrayElements(node: ArrayLiteralContext): string[] {
        // 简化处理：从节点文本中提取元素
        const text = node.text.trim();
        if (text.startsWith('({') && text.endsWith('})')) {
            const content = text.substring(2, text.length - 2).trim();
            if (content.length === 0) {
                return [];
            }
            return content.split(',').map(item => item.trim());
        }
        return [];
    }
}

/**
 * LPC 映射格式化规则
 * 处理 ([key: value, key2: value2]) 语法
 */
export class MappingFormattingRule extends BaseFormattingRule {
    constructor() {
        super('MappingFormattingRule', 40);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof MappingLiteralExprContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof MappingLiteralExprContext) || !config.formatMappings) {
            return node.text;
        }

        return this.formatMapping(node, config, context);
    }

    private formatMapping(node: MappingLiteralExprContext, config: FormattingConfig, context: FormattingContext): string {
        let result = '([ ';
        
        const mappingContext = { ...context, inMapping: true };
        
        // 处理映射键值对
        const pairs = this.extractMappingPairs(node);
        
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            result += pair.key + ':';
            
            if (config.spaceAroundOperators) {
                result += ' ';
            }
            
            result += pair.value;
            
            if (i < pairs.length - 1) {
                result += ',';
                if (config.spaceAfterComma) {
                    result += ' ';
                }
            }
        }
        
        result += ' ])';
        
        return result;
    }

    private extractMappingPairs(node: MappingLiteralExprContext): Array<{key: string, value: string}> {
        // 简化处理：从节点文本中提取键值对
        const text = node.text.trim();
        if (text.startsWith('([') && text.endsWith('])')) {
            const content = text.substring(2, text.length - 2).trim();
            if (content.length === 0) {
                return [];
            }
            return content.split(',').map(pair => {
                const [key, value] = pair.split(':').map(item => item.trim());
                return { key: key || '', value: value || '' };
            });
        }
        return [];
    }
}

/**
 * LPC 继承语句格式化规则
 * 处理 inherit "filepath" 语法
 */
export class InheritStatementRule extends BaseFormattingRule {
    constructor() {
        super('InheritStatementRule', 30);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof InheritStatementContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof InheritStatementContext)) {
            return node.text;
        }

        return this.formatInheritStatement(node, config, context);
    }

    private formatInheritStatement(node: InheritStatementContext, config: FormattingConfig, context: FormattingContext): string {
        let result = 'inherit';
        
        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }
        
        // 获取继承的文件路径
        const filePath = this.extractInheritPath(node);
        result += filePath;
        
        result += ';';
        
        return result;
    }

    private extractInheritPath(node: InheritStatementContext): string {
        // 简化处理：从节点文本中提取继承路径
        const text = node.text.replace(/^inherit\s*/, '').replace(/;\s*$/, '').trim();
        return text.startsWith('"') && text.endsWith('"') ? text : `"${text}"`;
    }
}

/**
 * LPC 函数调用格式化规则
 * 处理函数调用的参数对齐
 */
export class FunctionCallRule extends BaseFormattingRule {
    constructor() {
        super('FunctionCallRule', 20);
    }

    canApply(node: ParseTree, context: FormattingContext): boolean {
        return node instanceof PostfixExpressionContext;
    }

    apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string {
        if (!(node instanceof PostfixExpressionContext)) {
            return node.text;
        }

        return this.formatFunctionCall(node, config, context);
    }

    private formatFunctionCall(node: PostfixExpressionContext, config: FormattingConfig, context: FormattingContext): string {
        // 获取函数名
        const functionName = this.extractFunctionName(node);
        let result = functionName;
        
        if (config.spaceBeforeOpenParen) {
            result += ' ';
        }
        
        result += '(';
        
        // 处理参数列表
        const parameters = this.extractParameters(node);
        
        if (config.functionCallStyle === 'expanded' && parameters.length > 3) {
            // 展开式格式
            result += this.formatExpandedParameters(parameters, config, context);
        } else {
            // 紧凑式格式
            result += this.formatCompactParameters(parameters, config, context);
        }
        
        result += ')';
        
        return result;
    }

    private extractFunctionName(node: PostfixExpressionContext): string {
        // 简化处理：从节点文本中提取函数名
        const text = node.text.trim();
        const match = text.match(/^(\w+)\s*\(/);
        return match ? match[1] : 'function';
    }

    private extractParameters(node: PostfixExpressionContext): string[] {
        // 简化处理：从节点文本中提取参数
        const text = node.text.trim();
        const match = text.match(/\(([^)]*)\)/);
        if (match && match[1].trim()) {
            return match[1].split(',').map(param => param.trim());
        }
        return [];
    }

    private formatCompactParameters(parameters: string[], config: FormattingConfig, context: FormattingContext): string {
        let result = '';
        
        for (let i = 0; i < parameters.length; i++) {
            result += parameters[i];
            
            if (i < parameters.length - 1) {
                result += ',';
                if (config.spaceAfterComma) {
                    result += ' ';
                }
            }
        }
        
        return result;
    }

    private formatExpandedParameters(parameters: string[], config: FormattingConfig, context: FormattingContext): string {
        let result = '\n';
        const indent = this.getIndentString(context.indentLevel + 1, config);
        
        for (let i = 0; i < parameters.length; i++) {
            result += indent + parameters[i];
            
            if (i < parameters.length - 1) {
                result += ',';
            }
            
            result += '\n';
        }
        
        result += this.getIndentString(context.indentLevel, config);
        
        return result;
    }

    private getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }
}