/**
 * 格式化路由器
 * 
 * 负责高效路由访问者到对应的格式化器：
 * - 基于节点类型的快速路由（O(1)时间复杂度）
 * - 支持条件路由和策略选择
 * - 缓存感知路由优化
 * - 依赖关系管理
 */

import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { IFormattingRoute, IRouteTarget } from './types';
import { IFormattingContext, IExtendedFormattingContext } from '../types/interfaces';

export class FormattingRouter {
    private readonly routeMap = new Map<string, IFormattingRoute>();
    private readonly routeCache = new Map<string, string>(); // 路由结果缓存
    private readonly dependencyGraph = new Map<string, string[]>(); // 依赖关系图

    constructor() {
        this.initializeRoutes();
    }

    /**
     * 初始化路由表
     */
    private initializeRoutes(): void {
        // 表达式路由
        this.registerRoute({
            nodeType: 'AssignmentExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatAssignmentExpression',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'AdditiveExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatAdditiveExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'MultiplicativeExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatMultiplicativeExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'EqualityExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatEqualityExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'RelationalExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatRelationalExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'LogicalAndExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatLogicalAndExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'LogicalOrExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatLogicalOrExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'BitwiseAndExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatBitwiseAndExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'BitwiseOrExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatBitwiseOrExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'BitwiseXorExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatBitwiseXorExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'ShiftExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatShiftExpression',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'ExpressionContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatExpression',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'ExpressionListContext',
            target: {
                formatterType: 'ExpressionFormatter',
                methodName: 'formatExpressionList',
                cacheable: true,
                estimatedCost: 3
            }
        });

        // 语句路由
        this.registerRoute({
            nodeType: 'IfStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatIfStatement',
                cacheable: true,
                estimatedCost: 3
            }
        });

        this.registerRoute({
            nodeType: 'WhileStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatWhileStatement',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'ForStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatForStatement',
                cacheable: true,
                estimatedCost: 3
            }
        });

        this.registerRoute({
            nodeType: 'DoWhileStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatDoWhileStatement',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'ForeachStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatForeachStatement',
                cacheable: true,
                estimatedCost: 3
            }
        });

        this.registerRoute({
            nodeType: 'SwitchStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatSwitchStatement',
                cacheable: true,
                estimatedCost: 4
            }
        });

        this.registerRoute({
            nodeType: 'SwitchSectionContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatSwitchSection',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'BreakStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatBreakStatement',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'ContinueStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatContinueStatement',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'ReturnStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatReturnStatement',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'ExprStatementContext',
            target: {
                formatterType: 'StatementFormatter',
                methodName: 'formatExprStatement',
                cacheable: true,
                estimatedCost: 2
            }
        });

        // 字面量路由
        this.registerRoute({
            nodeType: 'MappingLiteralContext',
            target: {
                formatterType: 'LiteralFormatter',
                methodName: 'formatMappingLiteral',
                cacheable: true,
                estimatedCost: 3
            }
        });

        this.registerRoute({
            nodeType: 'ArrayLiteralContext',
            target: {
                formatterType: 'LiteralFormatter',
                methodName: 'formatArrayLiteral',
                cacheable: true,
                estimatedCost: 2
            }
        });

        // 声明路由
        this.registerRoute({
            nodeType: 'FunctionDefContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatFunctionDef',
                cacheable: true,
                estimatedCost: 5
            }
        });

        this.registerRoute({
            nodeType: 'VariableDeclContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatVariableDecl',
                cacheable: true,
                estimatedCost: 2
            }
        });

        this.registerRoute({
            nodeType: 'ParameterContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatParameter',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'ParameterListContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatParameterList',
                cacheable: true,
                estimatedCost: 3
            }
        });

        this.registerRoute({
            nodeType: 'TypeSpecContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatTypeSpec',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'StructDefContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatStructDef',
                cacheable: true,
                estimatedCost: 4
            }
        });

        this.registerRoute({
            nodeType: 'ClassDefContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatClassDef',
                cacheable: true,
                estimatedCost: 4
            }
        });

        this.registerRoute({
            nodeType: 'StructMemberContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatStructMember',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'StructMemberListContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatStructMemberList',
                cacheable: true,
                estimatedCost: 3
            }
        });

        this.registerRoute({
            nodeType: 'IncludeStatementContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatIncludeStatement',
                cacheable: true,
                estimatedCost: 1
            }
        });

        this.registerRoute({
            nodeType: 'InheritStatementContext',
            target: {
                formatterType: 'DeclarationFormatter',
                methodName: 'formatInheritStatement',
                cacheable: true,
                estimatedCost: 1
            }
        });

        // 代码块路由
        this.registerRoute({
            nodeType: 'BlockContext',
            target: {
                formatterType: 'BlockFormatter',
                methodName: 'formatBlock',
                cacheable: true,
                estimatedCost: 3
            }
        });

        // 设置依赖关系
        this.setupDependencies();
    }

    /**
     * 设置格式化器之间的依赖关系
     */
    private setupDependencies(): void {
        // 语句可能依赖表达式
        this.addDependency('StatementFormatter', 'ExpressionFormatter');
        
        // 声明可能依赖类型规范和表达式
        this.addDependency('DeclarationFormatter', 'ExpressionFormatter');
        
        // 代码块可能依赖所有其他格式化器
        this.addDependency('BlockFormatter', 'StatementFormatter');
        this.addDependency('BlockFormatter', 'DeclarationFormatter');
        this.addDependency('BlockFormatter', 'ExpressionFormatter');
        this.addDependency('BlockFormatter', 'LiteralFormatter');
    }

    /**
     * 注册路由规则
     * @param route 路由配置
     */
    public registerRoute(route: IFormattingRoute): void {
        this.routeMap.set(route.nodeType, route);
        // 清除相关缓存
        this.clearRouteCache(route.nodeType);
    }

    /**
     * 路由节点到对应的格式化器和方法
     * @param node 待格式化的节点
     * @param context 格式化上下文
     * @returns 路由结果或null
     */
    public route(
        node: ParseTree, 
        context: IExtendedFormattingContext
    ): { formatterType: string; methodName: string } | null {
        const nodeType = this.getNodeType(node);
        
        // 检查缓存
        const cacheKey = this.generateRouteCacheKey(nodeType, context);
        const cached = this.routeCache.get(cacheKey);
        if (cached) {
            const [formatterType, methodName] = cached.split('.');
            return { formatterType, methodName };
        }

        // 查找路由
        const route = this.routeMap.get(nodeType);
        if (!route) {
            return null;
        }

        // 检查条件（如果有）
        if (route.condition && !route.condition(node, context)) {
            return null;
        }

        const result = {
            formatterType: route.target.formatterType,
            methodName: route.target.methodName
        };

        // 缓存结果
        this.routeCache.set(cacheKey, `${result.formatterType}.${result.methodName}`);

        return result;
    }

    /**
     * 获取节点类型名称
     */
    private getNodeType(node: ParseTree): string {
        return node.constructor.name;
    }

    /**
     * 生成路由缓存键
     */
    private generateRouteCacheKey(nodeType: string, context: IFormattingContext): string {
        // 简化的缓存键生成，可以根据需要扩展
        const strategyId = this.getContextStrategyId(context);
        return `${nodeType}-${strategyId}`;
    }

    /**
     * 获取上下文的策略标识
     */
    private getContextStrategyId(context: IFormattingContext): string {
        // 这里可以基于上下文的各种配置生成一个标识
        // 用于区分不同策略下的路由结果
        return 'default'; // 简化实现
    }

    /**
     * 清除路由缓存
     */
    private clearRouteCache(nodeType?: string): void {
        if (nodeType) {
            // 清除特定节点类型的缓存
            const keysToDelete: string[] = [];
            this.routeCache.forEach((_, key) => {
                if (key.startsWith(nodeType + '-')) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.routeCache.delete(key));
        } else {
            // 清除所有缓存
            this.routeCache.clear();
        }
    }

    /**
     * 添加依赖关系
     */
    private addDependency(dependent: string, dependency: string): void {
        if (!this.dependencyGraph.has(dependent)) {
            this.dependencyGraph.set(dependent, []);
        }
        this.dependencyGraph.get(dependent)!.push(dependency);
    }

    /**
     * 获取格式化器的依赖列表
     * @param formatterType 格式化器类型
     * @returns 依赖的格式化器列表
     */
    public getDependencies(formatterType: string): string[] {
        return this.dependencyGraph.get(formatterType) || [];
    }

    /**
     * 检查是否存在循环依赖
     * @returns 如果存在循环依赖则返回true
     */
    public hasCyclicDependencies(): boolean {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (node: string): boolean => {
            if (recursionStack.has(node)) {
                return true; // 发现环
            }
            if (visited.has(node)) {
                return false; // 已经访问过，且不在递归栈中
            }

            visited.add(node);
            recursionStack.add(node);

            const dependencies = this.getDependencies(node);
            for (const dep of dependencies) {
                if (hasCycle(dep)) {
                    return true;
                }
            }

            recursionStack.delete(node);
            return false;
        };

        // 检查所有格式化器
        for (const formatterType of this.dependencyGraph.keys()) {
            if (hasCycle(formatterType)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 获取路由统计信息
     */
    public getRouteStats(): {
        totalRoutes: number;
        cacheSize: number;
        cacheHitRate: number;
        avgEstimatedCost: number;
    } {
        const totalRoutes = this.routeMap.size;
        const cacheSize = this.routeCache.size;
        
        // 计算平均估算成本
        let totalCost = 0;
        this.routeMap.forEach(route => {
            totalCost += route.target.estimatedCost;
        });
        const avgEstimatedCost = totalRoutes > 0 ? totalCost / totalRoutes : 0;

        return {
            totalRoutes,
            cacheSize,
            cacheHitRate: 0, // TODO: 实现实际的命中率统计
            avgEstimatedCost
        };
    }

    /**
     * 优化路由表
     * 根据使用频率和成本重新排序路由
     */
    public optimizeRoutes(): void {
        // TODO: 实现路由优化逻辑
        // 可以基于使用频率、成本估算等因素重新组织路由表
        console.log('Route optimization not implemented yet');
    }

    /**
     * 获取所有可用路由
     */
    public getAllRoutes(): IFormattingRoute[] {
        return Array.from(this.routeMap.values());
    }

    /**
     * 移除路由
     * @param nodeType 节点类型
     * @returns 是否成功移除
     */
    public removeRoute(nodeType: string): boolean {
        const removed = this.routeMap.delete(nodeType);
        if (removed) {
            this.clearRouteCache(nodeType);
        }
        return removed;
    }
}