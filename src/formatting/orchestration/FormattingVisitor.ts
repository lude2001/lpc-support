/**
 * 简化的格式化访问者
 * 
 * 重构后的FormattingVisitor专注于纯访问者模式实现：
 * - 节点访问分派
 * - 上下文传递
 * - 基础错误处理
 * - 不包含具体的格式化业务逻辑
 */

import { AbstractParseTreeVisitor } from 'antlr4ts/tree/AbstractParseTreeVisitor';
import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { TerminalNode } from 'antlr4ts/tree/TerminalNode';
import { IExtendedFormattingContext, INodeVisitor } from '../types/interfaces';
import { FormattingRouter } from './FormattingRouter';

export class FormattingVisitor extends AbstractParseTreeVisitor<string> implements INodeVisitor {
    private readonly context: IExtendedFormattingContext;
    private readonly router: FormattingRouter;
    private nodeCount = 0;

    // 路由统计
    private routingStats = {
        totalRoutingAttempts: 0,
        successfulRoutings: 0,
        failedRoutings: 0
    };

    constructor(context: IExtendedFormattingContext, router: FormattingRouter) {
        super();
        this.context = context;
        this.router = router;
    }

    /**
     * 访问任意节点的通用方法
     * @param node 要访问的节点
     * @returns 格式化结果
     */
    public visit(node: ParseTree): string {
        if (!node) {
            return '';
        }

        // 检查节点访问限制
        if (!this.checkNodeLimit()) {
            this.context.errorCollector.addError(
                'Node limit exceeded, stopping formatting to prevent infinite recursion'
            );
            return '';
        }

        try {
            this.nodeCount++;
            return this.routeAndFormat(node);
        } catch (error) {
            return this.handleVisitError(error, node);
        }
    }

    /**
     * 路由并格式化节点
     */
    private routeAndFormat(node: ParseTree): string {
        // 检查是否是终端节点
        if (node instanceof TerminalNode) {
            return this.visitTerminal(node);
        }

        // 更新路由统计
        this.routingStats.totalRoutingAttempts++;

        // 使用路由器查找对应的格式化器和方法
        const routeResult = this.router.route(node, this.context);

        if (routeResult) {
            this.routingStats.successfulRoutings++;
            return this.invokeFormatter(node, routeResult.formatterType, routeResult.methodName);
        }

        // 如果没有找到对应的路由，使用默认处理
        this.routingStats.failedRoutings++;
        return this.visitDefault(node);
    }

    /**
     * 调用指定的格式化器方法
     */
    private invokeFormatter(
        node: ParseTree, 
        formatterType: string, 
        methodName: string
    ): string {
        try {
            const formatter = this.getFormatter(formatterType);
            if (!formatter) {
                this.context.errorCollector.addError(
                    `Formatter not found: ${formatterType}`
                );
                return this.visitDefault(node);
            }

            const method = (formatter as any)[methodName];
            if (typeof method !== 'function') {
                this.context.errorCollector.addError(
                    `Method not found: ${formatterType}.${methodName}`
                );
                return this.visitDefault(node);
            }

            // 调用格式化器方法
            return method.call(formatter, node);

        } catch (error) {
            this.context.errorCollector.addError(
                `Error in ${formatterType}.${methodName}: ${error}`
            );
            return this.visitDefault(node);
        }
    }

    /**
     * 获取指定类型的格式化器
     */
    private getFormatter(formatterType: string): any {
        switch (formatterType) {
            case 'ExpressionFormatter':
                return this.context.expressionFormatter;
            case 'StatementFormatter':
                return this.context.statementFormatter;
            case 'LiteralFormatter':
                return this.context.literalFormatter;
            case 'DeclarationFormatter':
                return this.context.declarationFormatter;
            case 'BlockFormatter':
                return this.context.blockFormatter;
            default:
                return null;
        }
    }

    /**
     * 访问终端节点（修复：改为 public 以匹配基类）
     */
    public visitTerminal(node: TerminalNode): string {
        if (node.symbol) {
            return node.symbol.text || '';
        }
        return '';
    }

    /**
     * 默认结果（实现抽象基类的要求）
     */
    protected defaultResult(): string {
        return '';
    }

    /**
     * 默认访问方法 - 当没有特定路由时使用
     */
    private visitDefault(node: ParseTree): string {
        try {
            // 简单地拼接所有子节点
            const results: string[] = [];
            
            for (let i = 0; i < node.childCount; i++) {
                const child = node.getChild(i);
                if (child) {
                    const result = this.visit(child);
                    if (result) {
                        results.push(result);
                    }
                }
            }

            return results.join('');

        } catch (error) {
            return this.handleVisitError(error, node);
        }
    }

    /**
     * 检查节点访问限制
     */
    private checkNodeLimit(): boolean {
        const maxNodes = this.context.core.getOptions().maxNodeCount || 10000;
        return this.nodeCount < maxNodes;
    }

    /**
     * 处理访问错误
     */
    private handleVisitError(error: unknown, node: ParseTree): string {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const nodeType = node.constructor.name;
        
        this.context.errorCollector.addError(
            `Error visiting ${nodeType}: ${errorMessage}`
        );

        // 尝试基础的错误恢复
        try {
            return this.basicErrorRecovery(node);
        } catch (recoveryError) {
            this.context.errorCollector.addError(
                `Error recovery failed: ${recoveryError}`
            );
            return '';
        }
    }

    /**
     * 基础的错误恢复机制
     */
    private basicErrorRecovery(node: ParseTree): string {
        // 简单的错误恢复：尝试提取所有文本内容
        if (node instanceof TerminalNode) {
            return node.text || '';
        }

        const texts: string[] = [];
        this.extractAllText(node, texts);
        return texts.join(' ');
    }

    /**
     * 提取节点中的所有文本内容（用于错误恢复）
     */
    private extractAllText(node: ParseTree, texts: string[]): void {
        if (node instanceof TerminalNode) {
            const text = node.text?.trim();
            if (text) {
                texts.push(text);
            }
        } else {
            for (let i = 0; i < node.childCount; i++) {
                const child = node.getChild(i);
                if (child) {
                    this.extractAllText(child, texts);
                }
            }
        }
    }

    /**
     * 获取当前节点访问计数
     */
    public getNodeCount(): number {
        return this.nodeCount;
    }

    /**
     * 重置节点计数器
     */
    public resetNodeCount(): void {
        this.nodeCount = 0;
    }

    /**
     * 获取访问统计信息
     */
    public getVisitStats(): {
        nodesVisited: number;
        errorsEncountered: number;
        routingSuccessRate: number;
    } {
        return {
            nodesVisited: this.nodeCount,
            errorsEncountered: this.context.errorCollector.getErrorCount(),
            routingSuccessRate: this.calculateRoutingSuccessRate()
        };
    }

    /**
     * 设置访问模式（用于不同的格式化策略）
     */
    public setVisitMode(mode: 'full' | 'quick' | 'selective'): void {
        // TODO: 实现不同的访问模式
        // full: 完整访问所有节点
        // quick: 跳过某些复杂节点的详细格式化
        // selective: 只访问特定类型的节点
    }

    /**
     * 检查是否应该跳过节点（用于优化）
     */
    private shouldSkipNode(node: ParseTree): boolean {
        // TODO: 实现节点跳过逻辑
        // 可以基于节点类型、大小、复杂度等决定是否跳过
        return false;
    }

    /**
     * 预处理节点（访问前的准备工作）
     */
    private preprocessNode(node: ParseTree): void {
        // TODO: 实现节点预处理逻辑
        // 如：更新上下文、准备缓存、收集统计信息等
    }

    /**
     * 后处理节点（访问后的清理工作）
     */
    private postprocessNode(node: ParseTree, result: string): string {
        // TODO: 实现节点后处理逻辑
        // 如：缓存结果、更新统计、验证输出等
        return result;
    }

    /**
     * 计算路由成功率
     * @returns 路由成功率（0-1）
     */
    private calculateRoutingSuccessRate(): number {
        if (this.routingStats.totalRoutingAttempts === 0) {
            return 0;
        }
        return this.routingStats.successfulRoutings / this.routingStats.totalRoutingAttempts;
    }

    /**
     * 获取详细路由统计
     * @returns 详细路由统计信息
     */
    public getDetailedRoutingStats(): {
        totalAttempts: number;
        successful: number;
        failed: number;
        successRate: number;
        failureRate: number;
    } {
        const successRate = this.calculateRoutingSuccessRate();
        return {
            totalAttempts: this.routingStats.totalRoutingAttempts,
            successful: this.routingStats.successfulRoutings,
            failed: this.routingStats.failedRoutings,
            successRate,
            failureRate: 1 - successRate
        };
    }

    /**
     * 重置访问统计
     */
    public resetStats(): void {
        this.nodeCount = 0;
        this.routingStats = {
            totalRoutingAttempts: 0,
            successfulRoutings: 0,
            failedRoutings: 0
        };
    }
}