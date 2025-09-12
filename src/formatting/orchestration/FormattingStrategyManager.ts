/**
 * 格式化策略管理器
 * 
 * 负责管理和协调不同的格式化策略：
 * - CompactStrategy: 紧凑模式格式化
 * - StandardStrategy: 标准模式格式化
 * - DebugStrategy: 调试模式格式化（详细格式化）
 * - CustomStrategy: 用户自定义策略
 */

import { 
    IFormattingStrategy, 
    FormattingStrategyType, 
    IFormattingRequest 
} from './types';
import { CompactStrategy } from './strategies/CompactStrategy';
import { StandardStrategy } from './strategies/StandardStrategy';
// import { DebugStrategy } from './strategies/DebugStrategy'; // TODO: 需要实现该模块

export class FormattingStrategyManager {
    private readonly strategies = new Map<FormattingStrategyType, IFormattingStrategy>();
    private readonly customStrategies = new Map<string, IFormattingStrategy>();

    constructor() {
        this.initializeBuiltInStrategies();
    }

    /**
     * 初始化内置策略
     */
    private initializeBuiltInStrategies(): void {
        // 注册内置策略
        this.strategies.set(FormattingStrategyType.COMPACT, new CompactStrategy());
        this.strategies.set(FormattingStrategyType.STANDARD, new StandardStrategy());
        // this.strategies.set(FormattingStrategyType.DEBUG, new DebugStrategy()); // TODO: 实现 DebugStrategy 后再启用
    }

    /**
     * 获取指定类型的策略
     * @param type 策略类型
     * @returns 格式化策略
     */
    public getStrategy(type: FormattingStrategyType): IFormattingStrategy {
        const strategy = this.strategies.get(type);
        if (!strategy) {
            throw new Error(`Unknown formatting strategy: ${type}`);
        }
        return strategy;
    }

    /**
     * 注册自定义策略
     * @param strategy 自定义策略实现
     */
    public registerStrategy(strategy: IFormattingStrategy): void {
        if (strategy.type === FormattingStrategyType.CUSTOM) {
            this.customStrategies.set(strategy.name, strategy);
        } else {
            this.strategies.set(strategy.type, strategy);
        }
    }

    /**
     * 获取自定义策略
     * @param name 策略名称
     * @returns 自定义策略或undefined
     */
    public getCustomStrategy(name: string): IFormattingStrategy | undefined {
        return this.customStrategies.get(name);
    }

    /**
     * 根据请求特征自动选择最佳策略
     * @param request 格式化请求
     * @returns 最适合的格式化策略
     */
    public selectBestStrategy(request: IFormattingRequest): IFormattingStrategy {
        // 策略选择算法
        const strategies = Array.from(this.strategies.values())
            .concat(Array.from(this.customStrategies.values()))
            .filter(strategy => strategy.isApplicable(request))
            .sort((a, b) => b.getPriority() - a.getPriority());

        if (strategies.length === 0) {
            // 如果没有合适的策略，使用标准策略作为默认值
            return this.getStrategy(FormattingStrategyType.STANDARD);
        }

        return strategies[0];
    }

    /**
     * 获取所有可用策略的信息
     */
    public getAvailableStrategies(): Array<{
        name: string;
        type: FormattingStrategyType;
        description: string;
    }> {
        const result: Array<{
            name: string;
            type: FormattingStrategyType;
            description: string;
        }> = [];

        // 内置策略
        this.strategies.forEach(strategy => {
            result.push({
                name: strategy.name,
                type: strategy.type,
                description: strategy.description
            });
        });

        // 自定义策略
        this.customStrategies.forEach(strategy => {
            result.push({
                name: strategy.name,
                type: strategy.type,
                description: strategy.description
            });
        });

        return result;
    }

    /**
     * 移除自定义策略
     * @param name 策略名称
     * @returns 是否成功移除
     */
    public removeCustomStrategy(name: string): boolean {
        return this.customStrategies.delete(name);
    }

    /**
     * 验证策略实现
     * @param strategy 待验证的策略
     * @returns 验证结果
     */
    public validateStrategy(strategy: IFormattingStrategy): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // 检查必需属性
        if (!strategy.name || typeof strategy.name !== 'string') {
            errors.push('Strategy must have a valid name');
        }

        if (!strategy.type || !Object.values(FormattingStrategyType).includes(strategy.type)) {
            errors.push('Strategy must have a valid type');
        }

        if (!strategy.description || typeof strategy.description !== 'string') {
            errors.push('Strategy must have a description');
        }

        // 检查必需方法
        if (typeof strategy.apply !== 'function') {
            errors.push('Strategy must implement apply method');
        }

        if (typeof strategy.isApplicable !== 'function') {
            errors.push('Strategy must implement isApplicable method');
        }

        if (typeof strategy.getPriority !== 'function') {
            errors.push('Strategy must implement getPriority method');
        }

        // 检查优先级值
        try {
            const priority = strategy.getPriority();
            if (typeof priority !== 'number' || priority < 0 || priority > 100) {
                errors.push('Strategy priority must be a number between 0 and 100');
            }
        } catch (error) {
            errors.push('Strategy getPriority method throws error: ' + error);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 创建策略组合
     * 允许将多个策略组合使用，按优先级顺序应用
     * @param strategies 要组合的策略列表
     * @param name 组合策略的名称
     * @returns 组合后的策略
     */
    public createCompositeStrategy(
        strategies: IFormattingStrategy[], 
        name: string
    ): IFormattingStrategy {
        return new CompositeStrategy(strategies, name);
    }
}

/**
 * 组合策略实现
 * 将多个策略按优先级顺序组合
 */
class CompositeStrategy implements IFormattingStrategy {
    public readonly name: string;
    public readonly type = FormattingStrategyType.CUSTOM;
    public readonly description: string;
    
    private readonly strategies: IFormattingStrategy[];

    constructor(strategies: IFormattingStrategy[], name: string) {
        this.strategies = strategies.sort((a, b) => b.getPriority() - a.getPriority());
        this.name = name;
        this.description = `Composite strategy: ${strategies.map(s => s.name).join(' + ')}`;
    }

    apply(context: any, request: IFormattingRequest): void {
        // 按优先级顺序应用所有策略
        for (const strategy of this.strategies) {
            if (strategy.isApplicable(request)) {
                strategy.apply(context, request);
            }
        }
    }

    isApplicable(request: IFormattingRequest): boolean {
        // 只要有一个子策略适用，组合策略就适用
        return this.strategies.some(strategy => strategy.isApplicable(request));
    }

    getPriority(): number {
        // 使用所有子策略的平均优先级
        const priorities = this.strategies.map(s => s.getPriority());
        return priorities.reduce((sum, p) => sum + p, 0) / priorities.length;
    }
}