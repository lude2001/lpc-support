import { FormattingConfig, FormattingContext } from '../config/FormattingConfig';
import { ParseTree } from 'antlr4ts/tree/ParseTree';

/**
 * 格式化规则的基础接口
 */
export abstract class BaseFormattingRule {
    public readonly name: string;
    public readonly priority: number;
    public enabled: boolean = true;

    constructor(name: string, priority: number = 0) {
        this.name = name;
        this.priority = priority;
    }

    /**
     * 判断是否适用于此节点
     */
    abstract canApply(node: ParseTree, context: FormattingContext): boolean;

    /**
     * 应用格式化规则
     */
    abstract apply(node: ParseTree, config: FormattingConfig, context: FormattingContext): string;

    /**
     * 获取规则的优先级（用于排序）
     */
    getPriority(): number {
        return this.priority;
    }

    /**
     * 启用或禁用规则
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * 检查规则是否启用
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}

/**
 * 缩进规则类型
 */
export enum IndentationType {
    BLOCK,      // 块级缩进
    CONTINUATION, // 继续行缩进
    PARAMETER,   // 参数对齐
    ARRAY,       // 数组元素对齐
    MAPPING      // 映射对齐
}

/**
 * 空格规则类型
 */
export enum SpaceType {
    NONE,        // 无空格
    SINGLE,      // 单个空格
    MULTIPLE,    // 多个空格（用于对齐）
    PRESERVE     // 保持原有空格
}

/**
 * 换行规则类型
 */
export enum NewlineType {
    NONE,        // 不换行
    REQUIRED,    // 必须换行
    OPTIONAL,    // 可选换行
    CONDITIONAL  // 条件换行（根据行长度）
}

/**
 * 格式化操作类型
 */
export interface FormattingAction {
    type: 'indent' | 'space' | 'newline' | 'preserve' | 'remove';
    value?: string | number;
    position: number; // 在文本中的位置
}

/**
 * 规则执行结果
 */
export interface RuleExecutionResult {
    applied: boolean;
    actions: FormattingAction[];
    errors?: string[];
    warnings?: string[];
}

/**
 * 规则引擎接口
 */
export interface IRuleEngine {
    /**
     * 添加格式化规则
     */
    addRule(rule: BaseFormattingRule): void;

    /**
     * 移除格式化规则
     */
    removeRule(ruleName: string): boolean;

    /**
     * 获取所有规则
     */
    getRules(): BaseFormattingRule[];

    /**
     * 获取适用的规则
     */
    getApplicableRules(node: ParseTree, context: FormattingContext): BaseFormattingRule[];

    /**
     * 执行格式化规则
     */
    executeRules(node: ParseTree, config: FormattingConfig, context: FormattingContext): RuleExecutionResult;
}