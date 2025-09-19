import { BaseFormattingRule, IRuleEngine, RuleExecutionResult, FormattingAction } from '../rules/RuleTypes';
import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';

/**
 * 格式化规则引擎实现
 */
export class RuleEngine implements IRuleEngine {
    private rules: Map<string, BaseFormattingRule> = new Map();
    private enabledRules: BaseFormattingRule[] = [];
    private rulesSorted: boolean = false;

    /**
     * 添加格式化规则
     */
    addRule(rule: BaseFormattingRule): void {
        this.rules.set(rule.name, rule);
        this.rulesSorted = false;
        this.updateEnabledRules();
    }

    /**
     * 移除格式化规则
     */
    removeRule(ruleName: string): boolean {
        const removed = this.rules.delete(ruleName);
        if (removed) {
            this.rulesSorted = false;
            this.updateEnabledRules();
        }
        return removed;
    }

    /**
     * 获取所有规则
     */
    getRules(): BaseFormattingRule[] {
        return Array.from(this.rules.values());
    }

    /**
     * 获取适用的规则
     */
    getApplicableRules(node: ParseTree, context: FormattingContext): BaseFormattingRule[] {
        this.ensureRulesSorted();
        
        return this.enabledRules.filter(rule => rule.canApply(node, context));
    }

    /**
     * 执行格式化规则
     */
    executeRules(node: ParseTree, config: FormattingConfig, context: FormattingContext): RuleExecutionResult {
        const applicableRules = this.getApplicableRules(node, context);
        const actions: FormattingAction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        let applied = false;

        for (const rule of applicableRules) {
            try {
                const result = rule.apply(node, config, context);
                
                if (result !== node.text) {
                    // 规则已应用，创建格式化操作
                    actions.push({
                        type: 'preserve',
                        value: result,
                        position: 0 // 这里需要根据实际情况计算位置
                    });
                    applied = true;
                }
            } catch (error) {
                errors.push(`规则 ${rule.name} 执行失败: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return {
            applied,
            actions,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }

    /**
     * 启用或禁用规则
     */
    setRuleEnabled(ruleName: string, enabled: boolean): boolean {
        const rule = this.rules.get(ruleName);
        if (!rule) {
            return false;
        }

        rule.setEnabled(enabled);
        this.updateEnabledRules();
        return true;
    }

    /**
     * 获取规则状态
     */
    getRuleStatus(ruleName: string): boolean | undefined {
        const rule = this.rules.get(ruleName);
        return rule?.isEnabled();
    }

    /**
     * 清空所有规则
     */
    clearRules(): void {
        this.rules.clear();
        this.enabledRules = [];
        this.rulesSorted = false;
    }

    /**
     * 获取规则统计信息
     */
    getStats(): { total: number; enabled: number; disabled: number } {
        const total = this.rules.size;
        const enabled = this.enabledRules.length;
        const disabled = total - enabled;

        return { total, enabled, disabled };
    }

    /**
     * 更新启用的规则列表
     */
    private updateEnabledRules(): void {
        this.enabledRules = Array.from(this.rules.values()).filter(rule => rule.isEnabled());
        this.rulesSorted = false;
    }

    /**
     * 确保规则按优先级排序
     */
    private ensureRulesSorted(): void {
        if (!this.rulesSorted) {
            this.enabledRules.sort((a, b) => b.getPriority() - a.getPriority());
            this.rulesSorted = true;
        }
    }

    /**
     * 批量添加规则
     */
    addRules(rules: BaseFormattingRule[]): void {
        for (const rule of rules) {
            this.rules.set(rule.name, rule);
        }
        this.rulesSorted = false;
        this.updateEnabledRules();
    }

    /**
     * 按名称获取规则
     */
    getRule(name: string): BaseFormattingRule | undefined {
        return this.rules.get(name);
    }

    /**
     * 检查规则是否存在
     */
    hasRule(name: string): boolean {
        return this.rules.has(name);
    }

    /**
     * 获取启用的规则名称列表
     */
    getEnabledRuleNames(): string[] {
        return this.enabledRules.map(rule => rule.name);
    }

    /**
     * 获取禁用的规则名称列表
     */
    getDisabledRuleNames(): string[] {
        const enabledNames = new Set(this.getEnabledRuleNames());
        return Array.from(this.rules.keys()).filter(name => !enabledNames.has(name));
    }
}