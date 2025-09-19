import { RuleEngine } from '../engine/RuleEngine';
import { BaseFormattingRule } from './RuleTypes';

// 导入基础规则
import {
    IndentationRule,
    SpacingRule,
    NewlineRule,
    BraceRule,
    CommentRule
} from './BaseFormattingRules';

// 导入LPC特定规则
import {
    FunctionPointerRule,
    ArrayFormattingRule,
    MappingFormattingRule,
    InheritStatementRule,
    FunctionCallRule
} from './LPCSpecificRules';

// 导入高级LPC规则
import {
    SwitchRangeRule,
    ForeachRefRule,
    AnonymousFunctionRule,
    ExpressionFunctionPointerRule,
    VarargsRule,
    RangeOperationRule,
    DefaultParameterRule,
    NewExpressionRule,
    CastExpressionRule
} from './AdvancedLPCRules';

// 导入特殊语法规则
import {
    DelimiterSyntaxRule,
    ArraySpreadRule,
    ClassScopeRule,
    PreprocessorRule,
    NestedStructureRule,
    ReferenceParameterRule
} from './SpecialSyntaxRules';

/**
 * 格式化规则管理器
 * 负责初始化和管理所有格式化规则
 */
export class RuleManager {
    private static instance: RuleManager;
    private ruleEngine: RuleEngine;
    private allRules: BaseFormattingRule[] = [];

    private constructor() {
        this.ruleEngine = new RuleEngine();
        this.initializeRules();
    }

    /**
     * 获取单例实例
     */
    static getInstance(): RuleManager {
        if (!RuleManager.instance) {
            RuleManager.instance = new RuleManager();
        }
        return RuleManager.instance;
    }

    /**
     * 获取规则引擎
     */
    getRuleEngine(): RuleEngine {
        return this.ruleEngine;
    }

    /**
     * 获取所有规则
     */
    getAllRules(): BaseFormattingRule[] {
        return [...this.allRules];
    }

    /**
     * 根据分类获取规则
     */
    getRulesByCategory(category: RuleCategory): BaseFormattingRule[] {
        return this.allRules.filter(rule => this.getRuleCategory(rule) === category);
    }

    /**
     * 启用或禁用规则分类
     */
    setCategoryEnabled(category: RuleCategory, enabled: boolean): void {
        const rules = this.getRulesByCategory(category);
        for (const rule of rules) {
            this.ruleEngine.setRuleEnabled(rule.name, enabled);
        }
    }

    /**
     * 重置所有规则为默认状态
     */
    resetToDefaults(): void {
        for (const rule of this.allRules) {
            rule.setEnabled(true);
            this.ruleEngine.setRuleEnabled(rule.name, true);
        }
    }

    /**
     * 根据配置启用/禁用规则
     */
    configureRules(config: any): void {
        // 基础格式化规则总是启用
        this.setCategoryEnabled('basic', true);

        // LPC特定规则根据配置启用
        this.ruleEngine.setRuleEnabled('FunctionPointerRule', config.formatFunctionPointers);
        this.ruleEngine.setRuleEnabled('ArrayFormattingRule', config.formatArrays);
        this.ruleEngine.setRuleEnabled('MappingFormattingRule', config.formatMappings);

        // 高级LPC规则根据配置启用
        this.ruleEngine.setRuleEnabled('SwitchRangeRule', config.formatSwitchRanges);
        this.ruleEngine.setRuleEnabled('ForeachRefRule', config.formatForeachRef);
        this.ruleEngine.setRuleEnabled('AnonymousFunctionRule', config.formatAnonymousFunctions);
        this.ruleEngine.setRuleEnabled('ExpressionFunctionPointerRule', config.formatExpressionPointers);
        this.ruleEngine.setRuleEnabled('VarargsRule', config.formatVarargs);
        this.ruleEngine.setRuleEnabled('DefaultParameterRule', config.formatDefaultParameters);
        this.ruleEngine.setRuleEnabled('RangeOperationRule', config.formatRangeOperations);
        this.ruleEngine.setRuleEnabled('NewExpressionRule', config.formatNewExpressions);
        this.ruleEngine.setRuleEnabled('CastExpressionRule', config.formatCastExpressions);
    }

    /**
     * 获取规则统计信息
     */
    getStatistics(): RuleStatistics {
        const stats = this.ruleEngine.getStats();
        const categories = {
            basic: this.getRulesByCategory('basic').length,
            lpc: this.getRulesByCategory('lpc').length,
            advanced: this.getRulesByCategory('advanced').length,
            special: this.getRulesByCategory('special').length
        };

        return {
            ...stats,
            categories
        };
    }

    /**
     * 初始化所有规则
     */
    private initializeRules(): void {
        // 基础格式化规则
        const basicRules: BaseFormattingRule[] = [
            new IndentationRule(),
            new SpacingRule(),
            new NewlineRule(),
            new BraceRule(),
            new CommentRule()
        ];

        // LPC特定规则
        const lpcRules: BaseFormattingRule[] = [
            new FunctionPointerRule(),
            new ArrayFormattingRule(),
            new MappingFormattingRule(),
            new InheritStatementRule(),
            new FunctionCallRule()
        ];

        // 高级LPC规则
        const advancedRules: BaseFormattingRule[] = [
            new SwitchRangeRule(),
            new ForeachRefRule(),
            new AnonymousFunctionRule(),
            new ExpressionFunctionPointerRule(),
            new VarargsRule(),
            new RangeOperationRule(),
            new DefaultParameterRule(),
            new NewExpressionRule(),
            new CastExpressionRule()
        ];

        // 特殊语法规则
        const specialRules: BaseFormattingRule[] = [
            new DelimiterSyntaxRule(),
            new ArraySpreadRule(),
            new ClassScopeRule(),
            new PreprocessorRule(),
            new NestedStructureRule(),
            new ReferenceParameterRule()
        ];

        // 将所有规则添加到引擎
        this.allRules = [...basicRules, ...lpcRules, ...advancedRules, ...specialRules];
        this.ruleEngine.addRules(this.allRules);
    }

    /**
     * 获取规则的分类
     */
    private getRuleCategory(rule: BaseFormattingRule): RuleCategory {
        if (['IndentationRule', 'SpacingRule', 'NewlineRule', 'BraceRule', 'CommentRule'].includes(rule.name)) {
            return 'basic';
        }

        if (['FunctionPointerRule', 'ArrayFormattingRule', 'MappingFormattingRule', 'InheritStatementRule', 'FunctionCallRule'].includes(rule.name)) {
            return 'lpc';
        }

        if (['DelimiterSyntaxRule', 'ArraySpreadRule', 'ClassScopeRule', 'PreprocessorRule', 'NestedStructureRule', 'ReferenceParameterRule'].includes(rule.name)) {
            return 'special';
        }

        return 'advanced';
    }
}

/**
 * 规则分类
 */
export type RuleCategory = 'basic' | 'lpc' | 'advanced' | 'special';

/**
 * 规则统计信息
 */
export interface RuleStatistics {
    total: number;
    enabled: number;
    disabled: number;
    categories: {
        basic: number;
        lpc: number;
        advanced: number;
        special: number;
    };
}

/**
 * 创建预配置的规则引擎
 */
export function createConfiguredRuleEngine(config: any): RuleEngine {
    const manager = RuleManager.getInstance();
    manager.configureRules(config);
    return manager.getRuleEngine();
}

/**
 * 获取所有可用的规则名称和描述
 */
export function getAvailableRules(): Array<{
    name: string;
    description: string;
    category: RuleCategory;
    priority: number;
}> {
    const manager = RuleManager.getInstance();
    const rules = manager.getAllRules();

    return rules.map(rule => ({
        name: rule.name,
        description: getRuleDescription(rule.name),
        category: manager['getRuleCategory'](rule) as RuleCategory,
        priority: rule.getPriority()
    }));
}

/**
 * 获取规则的描述信息
 */
function getRuleDescription(ruleName: string): string {
    const descriptions: { [key: string]: string } = {
        'IndentationRule': '处理代码缩进',
        'SpacingRule': '处理空格间距',
        'NewlineRule': '处理换行',
        'BraceRule': '处理大括号格式化',
        'CommentRule': '处理注释格式化',
        'FunctionPointerRule': '格式化LPC函数指针语法',
        'ArrayFormattingRule': '格式化LPC数组字面量',
        'MappingFormattingRule': '格式化LPC映射字面量',
        'InheritStatementRule': '格式化inherit语句',
        'FunctionCallRule': '格式化函数调用',
        'SwitchRangeRule': '格式化switch范围匹配语法',
        'ForeachRefRule': '格式化foreach ref语法',
        'AnonymousFunctionRule': '格式化匿名函数',
        'ExpressionFunctionPointerRule': '格式化表达式函数指针',
        'VarargsRule': '格式化变长参数函数',
        'RangeOperationRule': '格式化范围操作语法',
        'DefaultParameterRule': '格式化默认参数',
        'NewExpressionRule': '格式化new表达式',
        'CastExpressionRule': '格式化类型转换表达式'
    };

    return descriptions[ruleName] || '未知规则';
}