import { FormattingConfig, FormattingResult } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import * as vscode from 'vscode';

/**
 * 格式化错误恢复机制
 * 当遇到语法错误或格式化失败时，尝试部分格式化
 */
export class ErrorRecovery {
    /**
     * 尝试部分格式化，即使存在语法错误
     */
    static attemptPartialFormatting(
        originalText: string,
        errors: vscode.Diagnostic[],
        config: FormattingConfig
    ): FormattingResult {
        try {
            // 按行分析文本，尝试格式化没有语法错误的行
            const lines = originalText.split('\n');
            const errorLines = new Set(errors.map(err => err.range.start.line));

            let formattedLines: string[] = [];
            let hasChanges = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (errorLines.has(i)) {
                    // 跳过有语法错误的行
                    formattedLines.push(line);
                } else {
                    // 尝试格式化正常的行
                    const formattedLine = this.formatSingleLine(line, config, i);
                    formattedLines.push(formattedLine);

                    if (formattedLine !== line) {
                        hasChanges = true;
                    }
                }
            }

            const formattedText = formattedLines.join('\n');

            return {
                success: true,
                formattedText,
                warnings: [
                    `检测到 ${errors.length} 个语法错误，已跳过相关行的格式化`,
                    hasChanges ? '部分代码已格式化' : '未发现需要格式化的内容'
                ],
                duration: 0
            };

        } catch (error) {
            return {
                success: false,
                errors: [`部分格式化失败: ${error instanceof Error ? error.message : String(error)}`],
                duration: 0
            };
        }
    }

    /**
     * 格式化单行代码
     */
    private static formatSingleLine(line: string, config: FormattingConfig, lineNumber: number): string {
        let formatted = line;

        try {
            // 基础的行级别格式化
            formatted = this.formatBasicSyntax(formatted, config);
            formatted = this.formatSpacing(formatted, config);
            formatted = this.formatIndentation(formatted, config, lineNumber);

        } catch (error) {
            // 如果单行格式化失败，返回原始行
            console.warn(`行 ${lineNumber + 1} 格式化失败:`, error);
            return line;
        }

        return formatted;
    }

    /**
     * 格式化基础语法
     */
    private static formatBasicSyntax(line: string, config: FormattingConfig): string {
        let formatted = line;

        // 格式化操作符周围的空格
        if (config.spaceAroundOperators) {
            // 处理赋值操作符
            formatted = formatted.replace(/\s*([=!<>]=?|[+\-*/%]=?)\s*/g, ' $1 ');

            // 处理逻辑操作符
            formatted = formatted.replace(/\s*(&&|\|\|)\s*/g, ' $1 ');

            // 处理位操作符
            formatted = formatted.replace(/\s*([&|^])\s*/g, ' $1 ');
        }

        // 格式化逗号后的空格
        if (config.spaceAfterComma) {
            formatted = formatted.replace(/,\s*/g, ', ');
        }

        // 格式化分号后的空格
        if (config.spaceAfterSemicolon) {
            formatted = formatted.replace(/;\s*(?=\S)/g, '; ');
        }

        return formatted;
    }

    /**
     * 格式化空格
     */
    private static formatSpacing(line: string, config: FormattingConfig): string {
        let formatted = line;

        // 格式化函数调用的括号
        if (config.spaceBeforeOpenParen) {
            formatted = formatted.replace(/(\w+)\s*\(/g, '$1 (');
        } else {
            formatted = formatted.replace(/(\w+)\s+\(/g, '$1(');
        }

        // 格式化括号内的空格
        if (config.spaceInsideParentheses) {
            formatted = formatted.replace(/\(\s*/g, '( ');
            formatted = formatted.replace(/\s*\)/g, ' )');
        } else {
            formatted = formatted.replace(/\(\s+/g, '(');
            formatted = formatted.replace(/\s+\)/g, ')');
        }

        // 格式化大括号内的空格
        if (config.spaceInsideBraces) {
            formatted = formatted.replace(/\{\s*/g, '{ ');
            formatted = formatted.replace(/\s*\}/g, ' }');
        } else {
            formatted = formatted.replace(/\{\s+/g, '{');
            formatted = formatted.replace(/\s+\}/g, '}');
        }

        // 格式化方括号内的空格
        if (config.spaceInsideBrackets) {
            formatted = formatted.replace(/\[\s*/g, '[ ');
            formatted = formatted.replace(/\s*\]/g, ' ]');
        } else {
            formatted = formatted.replace(/\[\s+/g, '[');
            formatted = formatted.replace(/\s+\]/g, ']');
        }

        return formatted;
    }

    /**
     * 格式化缩进
     */
    private static formatIndentation(line: string, config: FormattingConfig, lineNumber: number): string {
        const trimmed = line.trim();

        if (trimmed.length === 0) {
            return ''; // 空行
        }

        // 简单的缩进逻辑（实际情况会更复杂）
        let indentLevel = 0;

        // 估算缩进级别（基于大括号）
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;

        if (closeBraces > 0) {
            indentLevel = Math.max(0, indentLevel - closeBraces);
        }

        const indent = this.getIndentString(indentLevel, config);
        return indent + trimmed;
    }

    /**
     * 获取缩进字符串
     */
    private static getIndentString(level: number, config: FormattingConfig): string {
        const unit = config.useSpaces ? ' '.repeat(config.indentSize) : '\t';
        return unit.repeat(level);
    }

    /**
     * 尝试智能错误恢复
     */
    static smartErrorRecovery(
        originalText: string,
        parseTree: ParseTree | null,
        errors: vscode.Diagnostic[],
        config: FormattingConfig
    ): FormattingResult {
        // 如果有语法树，尝试基于语法树的部分格式化
        if (parseTree) {
            return this.attemptTreeBasedRecovery(originalText, parseTree, errors, config);
        }

        // 否则回退到基于行的格式化
        return this.attemptPartialFormatting(originalText, errors, config);
    }

    /**
     * 基于语法树的错误恢复
     */
    private static attemptTreeBasedRecovery(
        originalText: string,
        parseTree: ParseTree,
        errors: vscode.Diagnostic[],
        config: FormattingConfig
    ): FormattingResult {
        try {
            // 遍历语法树，找到没有错误的节点进行格式化
            const validNodes = this.findValidNodes(parseTree, errors);

            let formattedText = originalText;
            let hasChanges = false;

            for (const node of validNodes) {
                try {
                    const formatted = this.formatNode(node, config);
                    if (formatted !== node.text) {
                        formattedText = formattedText.replace(node.text, formatted);
                        hasChanges = true;
                    }
                } catch (nodeError) {
                    // 跳过无法格式化的节点
                    continue;
                }
            }

            return {
                success: true,
                formattedText,
                warnings: [
                    `基于语法树的部分格式化完成`,
                    `跳过了 ${errors.length} 个错误区域`,
                    hasChanges ? '部分节点已格式化' : '未发现需要格式化的内容'
                ],
                duration: 0
            };

        } catch (error) {
            // 如果基于树的恢复失败，回退到基于行的恢复
            return this.attemptPartialFormatting(originalText, errors, config);
        }
    }

    /**
     * 找到没有语法错误的有效节点
     */
    private static findValidNodes(parseTree: ParseTree, errors: vscode.Diagnostic[]): ParseTree[] {
        const validNodes: ParseTree[] = [];
        const errorRanges = errors.map(err => err.range);

        const traverse = (node: ParseTree) => {
            // 检查当前节点是否与错误范围重叠
            const nodeRange = this.getNodeRange(node);
            const hasError = errorRanges.some(errorRange =>
                this.rangesOverlap(nodeRange, errorRange)
            );

            if (!hasError) {
                validNodes.push(node);
            } else {
                // 如果当前节点有错误，检查其子节点
                for (let i = 0; i < node.childCount; i++) {
                    const child = node.getChild(i);
                    traverse(child);
                }
            }
        };

        traverse(parseTree);
        return validNodes;
    }

    /**
     * 获取节点在文档中的范围
     */
    private static getNodeRange(node: ParseTree): vscode.Range {
        // 这是一个简化的实现，实际情况需要根据ANTLR的位置信息
        // 在真实实现中，需要使用Token的位置信息
        return new vscode.Range(0, 0, 0, node.text.length);
    }

    /**
     * 检查两个范围是否重叠
     */
    private static rangesOverlap(range1: vscode.Range, range2: vscode.Range): boolean {
        return !(range1.end.isBefore(range2.start) || range2.end.isBefore(range1.start));
    }

    /**
     * 格式化单个节点
     */
    private static formatNode(node: ParseTree, config: FormattingConfig): string {
        // 这里可以应用特定的节点格式化逻辑
        // 简化实现，返回基本格式化的文本
        return this.formatBasicSyntax(node.text, config);
    }

    /**
     * 创建备份恢复结果
     */
    static createFallbackResult(originalText: string, error: Error): FormattingResult {
        return {
            success: false,
            errors: [`格式化完全失败: ${error.message}`],
            warnings: ['已保持原始代码不变'],
            formattedText: originalText, // 返回原始文本作为后备
            duration: 0
        };
    }

    /**
     * 验证格式化结果的基本正确性
     */
    static validateFormattedText(originalText: string, formattedText: string): {
        isValid: boolean;
        issues: string[];
    } {
        const issues: string[] = [];

        // 检查基本结构是否保持
        const originalBraces = (originalText.match(/[{}]/g) || []).length;
        const formattedBraces = (formattedText.match(/[{}]/g) || []).length;

        if (originalBraces !== formattedBraces) {
            issues.push('大括号数量不匹配');
        }

        const originalParens = (originalText.match(/[()]/g) || []).length;
        const formattedParens = (formattedText.match(/[()]/g) || []).length;

        if (originalParens !== formattedParens) {
            issues.push('圆括号数量不匹配');
        }

        const originalBrackets = (originalText.match(/[\[\]]/g) || []).length;
        const formattedBrackets = (formattedText.match(/[\[\]]/g) || []).length;

        if (originalBrackets !== formattedBrackets) {
            issues.push('方括号数量不匹配');
        }

        // 检查关键字是否保持
        const keywordPattern = /\b(if|else|while|for|foreach|switch|case|default|break|continue|return|inherit|include|function|void|int|string|object|mixed|mapping|class|struct)\b/g;
        const originalKeywords = (originalText.match(keywordPattern) || []).length;
        const formattedKeywords = (formattedText.match(keywordPattern) || []).length;

        if (originalKeywords !== formattedKeywords) {
            issues.push('关键字数量不匹配');
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }
}