import {
    MappingLiteralContext,
    ArrayLiteralContext
} from '../../antlr/LPCParser';

import { ILiteralFormatter, IFormattingContext, INodeVisitor } from '../types/interfaces';

/**
 * 字面量格式化器
 * 专门处理各种字面量的格式化逻辑
 * 
 * 包含以下字面量类型：
 * - 映射字面量 ([ key : value, ... ])
 * - 数组字面量 ({ element1, element2, ... })
 * 
 * 支持多种格式化策略：
 * - 紧凑格式：单行显示
 * - 展开格式：多行显示，带缩进
 * - 自动格式：根据元素数量和长度自动选择
 */
export class LiteralFormatter implements ILiteralFormatter {
    readonly context: IFormattingContext;
    readonly visitor: INodeVisitor;

    constructor(context: IFormattingContext, visitor: INodeVisitor) {
        this.context = context;
        this.visitor = visitor;
    }

    /**
     * 安全执行格式化操作
     */
    safeExecute<T>(operation: () => T, errorMessage: string, fallback?: T): T | undefined {
        try {
            if (!this.context.core.checkNodeLimit()) {
                return fallback;
            }
            return operation();
        } catch (error) {
            this.context.errorCollector.addError(
                `${errorMessage}: ${error instanceof Error ? error.message : '未知错误'}`
            );
            return fallback;
        }
    }

    /**
     * 格式化映射字面量（mapping literal）
     * LPC 映射格式为: ([ key1 : value1, key2 : value2, ... ])
     * 
     * 格式化策略：
     * 1. 根据配置选项决定使用紧凑格式还是展开格式
     * 2. 紧凑格式：所有键值对在一行，如 ([ key1 : value1, key2 : value2 ])
     * 3. 展开格式：每个键值对独占一行，带有适当的缩进：
     *    ([
     *        key1 : value1,
     *        key2 : value2
     *    ])
     * 4. auto模式：当键值对数量超过3个时自动切换到展开格式
     * 5. 空格控制：根据 spaceAroundOperators 设置冒号前后的空格
     * 6. 逗号控制：根据 spaceAfterComma 设置逗号后的空格
     */
    formatMappingLiteral(ctx: MappingLiteralContext): string {
        return this.safeExecute(
            () => {
                let result = '([';
                const options = this.context.core.getOptions();
                
                const pairList = ctx.mappingPairList();
                if (pairList) {
                    const pairs = pairList.mappingPair();
                    
                    // 根据配置决定是否展开映射
                    // expanded: 强制展开格式
                    // compact: 强制紧凑格式  
                    // auto: 根据键值对数量自动决定（超过3个展开）
                    const shouldExpand = (options as any).mappingLiteralFormat === 'expanded' ||
                        ((options as any).mappingLiteralFormat === 'auto' && pairs.length > 3);
                    
                    if (shouldExpand && pairs.length > 0) {
                        // 展开格式：每个键值对一行，带缩进
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        
                        for (let i = 0; i < pairs.length; i++) {
                            const pair = pairs[i];
                            result += this.getIndent(); // 添加当前缩进级别的空格/制表符
                            
                            // 处理键值对：提取 key 和 value 表达式
                            if (pair.expression && pair.expression().length >= 2) {
                                const keyExpr = this.visitNode(pair.expression(0));   // 键表达式
                                const valueExpr = this.visitNode(pair.expression(1)); // 值表达式
                                
                                // 组装键值对，冒号前后的空格根据配置决定
                                result += keyExpr;
                                result += (options as any).spaceAroundOperators ? ' : ' : ':';
                                
                                // 特别处理值表达式：如果值是复杂表达式（如数组、映射），适当处理格式
                                if (valueExpr.includes('\n')) {
                                    // 对于多行值表达式，将其后续行进行适当缩进
                                    const valueLines = valueExpr.split('\n');
                                    result += valueLines[0]; // 第一行跟在冒号后
                                    for (let j = 1; j < valueLines.length; j++) {
                                        if (valueLines[j].trim() !== '') {
                                            // 使用配置的嵌套结构缩进量
                                            const extraIndent = ' '.repeat((options as any).nestedStructureIndent);
                                            result += '\n' + this.getIndent() + extraIndent + valueLines[j].trimStart();
                                        } else {
                                            result += '\n' + valueLines[j];
                                        }
                                    }
                                } else {
                                    result += valueExpr;
                                }
                            }
                            
                            // 为非最后一个键值对添加逗号
                            if (i < pairs.length - 1) {
                                result += ',';
                            }
                            result += '\n';
                        }
                        
                        this.context.indentManager.decreaseIndent(); // 恢复缩进级别
                        result += this.getIndent(); // 为右括号添加缩进
                    } else if (pairs.length > 0) {
                        // 紧凑格式：所有键值对在一行
                        for (let i = 0; i < pairs.length; i++) {
                            const pair = pairs[i];
                            
                            if (pair.expression && pair.expression().length >= 2) {
                                const keyExpr = this.visitNode(pair.expression(0));
                                const valueExpr = this.visitNode(pair.expression(1));
                                
                                result += keyExpr;
                                result += (options as any).spaceAroundOperators ? ' : ' : ':';
                                result += valueExpr;
                            }
                            
                            // 为非最后一个键值对添加逗号，根据配置决定是否添加空格
                            if (i < pairs.length - 1) {
                                result += options.spaceAfterComma ? ', ' : ',';
                            }
                        }
                    }
                }
                
                result += '])';
                return result;
            },
            '格式化映射字面量',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 格式化数组字面量（array literal）
     * LPC 数组格式为: ({ element1, element2, element3, ... })
     * 
     * 格式化策略：
     * 1. 使用与映射字面量相同的格式化配置 (mappingLiteralFormat)
     * 2. 紧凑格式：所有元素在一行，如 ({ 1, 2, 3 })
     * 3. 展开格式：每个元素独占一行，带有适当的缩进：
     *    ({
     *        element1,
     *        element2,
     *        element3
     *    })
     * 4. 根据 arrayLiteralWrapThreshold 配置项决定自动换行的阈值
     * 5. auto模式：当元素数量超过阈值时自动切换到展开格式
     * 6. 逗号控制：根据 spaceAfterComma 设置逗号后的空格
     */
    formatArrayLiteral(ctx: ArrayLiteralContext): string {
        return this.safeExecute(
            () => {
                let result = '({';
                const options = this.context.core.getOptions();
                
                const expressionList = ctx.expressionList();
                if (expressionList) {
                    const expressions = expressionList.expression();
                    
                    // 根据配置决定是否展开数组
                    // 首先检查是否包含映射元素，如果是则使用 arrayOfMappingFormat 配置
                    const hasMappingElements = expressions.some(expr => {
                        const exprText = this.visitNode(expr);
                        return exprText.includes('([') && exprText.includes('])');
                    });
                    
                    let shouldExpand: boolean;
                    if (hasMappingElements) {
                        // 映射数组使用专门的配置
                        shouldExpand = (options as any).arrayOfMappingFormat === 'expanded' ||
                            ((options as any).arrayOfMappingFormat === 'auto' && expressions.length > 2);
                    } else {
                        // 普通数组使用原有逻辑
                        shouldExpand = (options as any).mappingLiteralFormat === 'expanded' ||
                            ((options as any).mappingLiteralFormat === 'auto' && expressions.length > (options as any).arrayLiteralWrapThreshold);
                    }
                    
                    if (shouldExpand && expressions.length > 0) {
                        // 展开格式：每个元素一行，带缩进
                        result += '\n';
                        this.context.indentManager.increaseIndent();
                        
                        for (let i = 0; i < expressions.length; i++) {
                            const expr = expressions[i];
                            result += this.getIndent(); // 添加当前缩进级别的空格/制表符
                            
                            // 访问表达式并获取格式化结果
                            // 特别处理映射字面量：如果数组元素是映射，保持其格式
                            const exprResult = this.visitNode(expr);
                            
                            // 检查是否是多行表达式（如映射字面量展开）
                            if (exprResult.includes('\n')) {
                                // 对于多行表达式，需要调整内部缩进
                                const lines = exprResult.split('\n');
                                result += lines[0]; // 第一行不需要额外缩进
                                for (let j = 1; j < lines.length; j++) {
                                    if (lines[j].trim() !== '') {
                                        // 使用配置的嵌套结构缩进量
                                        const extraIndent = ' '.repeat((options as any).nestedStructureIndent);
                                        result += '\n' + this.getIndent() + extraIndent + lines[j].trimStart();
                                    } else {
                                        result += '\n' + lines[j];
                                    }
                                }
                            } else {
                                result += exprResult;
                            }
                            
                            // 只在非最后一个元素后添加逗号
                            if (i < expressions.length - 1) {
                                result += ',';
                            }
                            result += '\n';
                        }
                        
                        this.context.indentManager.decreaseIndent(); // 恢复缩进级别
                        result += this.getIndent(); // 为右括号添加缩进
                    } else if (expressions.length > 0) {
                        // 紧凑格式：所有元素在一行
                        for (let i = 0; i < expressions.length; i++) {
                            const expr = expressions[i];
                            const exprResult = this.visitNode(expr);
                            result += exprResult;
                            
                            // 只在非最后一个元素后添加逗号，根据配置决定是否添加空格
                            if (i < expressions.length - 1) {
                                result += options.spaceAfterComma ? ', ' : ',';
                            }
                        }
                    }
                }
                
                result += '})';
                return result;
            },
            '格式化数组字面量',
            ctx.text
        ) || ctx.text || '';
    }

    /**
     * 辅助方法：获取当前缩进
     */
    private getIndent(): string {
        return this.context.indentManager.getIndent();
    }

    /**
     * 辅助方法：访问节点
     */
    private visitNode(node: any): string {
        if (!node) return '';
        return this.visitor.visit(node);
    }
}