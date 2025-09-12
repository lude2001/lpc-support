import {
    BlockContext
} from '../../antlr/LPCParser';

import { IBlockFormatter, IFormattingContext, INodeVisitor } from '../types/interfaces';

/**
 * 代码块格式化器
 * 专门处理代码块的格式化逻辑
 * 
 * 负责：
 * - 代码块的括号格式化
 * - 语句的缩进处理
 * - 空行的管理
 * - 分号位置的正确处理
 */
export class BlockFormatter implements IBlockFormatter {
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
     * 格式化代码块
     * 
     * 修复说明：
     * 1. 移除对语句的.trim()调用，避免分号被移到下一行
     * 2. 改为检查语句内容是否为空或仅包含空白字符
     * 3. 保持语句内部的格式完整性，确保分号在正确位置
     * 4. 正确处理多行语句的缩进
     * 5. 增强健壮性，支持多种类型的上下文节点
     * 
     * 格式化策略：
     * - 开括号后立即换行
     * - 所有语句统一缩进
     * - 保持语句内部格式，只调整外部缩进
     * - 闭括号与开括号对齐
     */
    formatBlock(ctx: any): string {
        return this.safeExecute(
            () => {
                // 健壮性检查
                if (!ctx) {
                    return '{}';
                }

                // 兼容不同类型的上下文节点
                let statements: any[] = [];
                
                // 处理LPC解析器的BlockContext
                if (ctx.statement && typeof ctx.statement === 'function') {
                    statements = ctx.statement();
                }
                // 处理Mock节点的children
                else if (ctx.children && Array.isArray(ctx.children)) {
                    // 过滤掉大括号，只保留语句
                    statements = ctx.children.filter((child: any) => 
                        child && child.text && !child.text.match(/^[{}]$/)
                    );
                }
                // 处理单个语句的情况
                else if (ctx.text && ctx.text.trim() && !ctx.text.match(/^[{}]*$/)) {
                    statements = [ctx];
                }

                // 如果没有语句，返回空代码块
                if (statements.length === 0) {
                    return '{}';
                }

                // 根据配置决定大括号样式
                const options = this.context.core.getOptions();
                const bracesOnNewLine = options.bracesOnNewLine || false;
                let result = bracesOnNewLine ? '\n{\n' : '{\n';
                
                this.context.indentManager.increaseIndent();

                for (const stmt of statements) {
                    const formattedStmt = this.visitNode(stmt);
                    
                    // 检查语句是否有实际内容（不仅仅是空白）
                    if (formattedStmt && formattedStmt.trim() !== '') {
                        // 为语句添加适当的缩进，但不修改语句本身的格式
                        const lines = formattedStmt.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            if (line.trim() !== '') {
                                // 对于有内容的行，添加缩进
                                result += this.getIndent() + line.trimStart() + '\n';
                            } else if (i < lines.length - 1) {
                                // 保留空行（除了最后一个空行）
                                result += '\n';
                            }
                        }
                    }
                }

                this.context.indentManager.decreaseIndent();
                result += this.getIndent() + '}';
                
                return result;
            },
            '格式化代码块',
            (ctx && ctx.text) ? ctx.text : '{}'
        ) || (ctx && ctx.text) || '{}';
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
        
        if (this.visitor && this.visitor.visit) {
            return this.visitor.visit(node);
        }
        // 回退：直接返回节点的文本内容
        return (node.text || node.toString() || '').trim();
    }
}