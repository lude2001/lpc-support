/**
 * 格式化验证器
 *
 * 负责验证格式化过程的正确性和质量：
 * 1. 语法正确性验证 - 确保格式化不会破坏语法结构
 * 2. 格式化质量检查 - 检查格式化结果的质量指标
 * 3. 安全性检查 - 确保格式化过程不会引入安全问题
 * 4. 规则引擎 - 基于可配置规则进行验证
 */

import { ParseTree } from 'antlr4ts/tree/ParseTree';
import { IFormattingResult, IFormattingRequest } from '../orchestration/types';
import { IFormattingContext, IExtendedFormattingContext } from '../types/interfaces';
import { ErrorCollector } from '../core/ErrorCollector';

/**
 * 验证规则接口
 */
export interface IValidationRule {
    /** 规则名称 */
    readonly name: string;
    /** 规则描述 */
    readonly description: string;
    /** 规则优先级（越高越重要） */
    readonly priority: number;
    /** 是否启用 */
    enabled: boolean;

    /**
     * 执行验证
     * @param original 原始代码
     * @param formatted 格式化后的代码
     * @param parseTree 语法树
     * @param context 格式化上下文
     * @returns 验证结果
     */
    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult;
}

/**
 * 验证结果接口
 */
export interface IValidationResult {
    /** 验证是否通过 */
    readonly passed: boolean;
    /** 严重程度 */
    readonly severity: ValidationSeverity;
    /** 错误或警告消息 */
    readonly messages: string[];
    /** 质量评分（0-100） */
    readonly qualityScore: number;
    /** 验证统计信息 */
    readonly stats: ValidationStats;
}

/**
 * 验证严重程度枚举
 */
export enum ValidationSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

/**
 * 验证统计信息
 */
export interface ValidationStats {
    /** 检查的规则数量 */
    rulesChecked: number;
    /** 通过的规则数量 */
    rulesPassed: number;
    /** 发现的问题数量 */
    issuesFound: number;
    /** 验证耗时（毫秒） */
    duration: number;
}

/**
 * 格式化验证器配置
 */
export interface IFormattingValidatorConfig {
    /** 是否启用严格模式 */
    strictMode: boolean;
    /** 最大允许的错误数量 */
    maxErrors: number;
    /** 最小质量评分要求 */
    minQualityScore: number;
    /** 验证超时时间（毫秒） */
    timeout: number;
    /** 启用的规则列表 */
    enabledRules: string[];
    /** 禁用的规则列表 */
    disabledRules: string[];
}

/**
 * 格式化验证器主类
 */
export class FormattingValidator {
    private readonly rules = new Map<string, IValidationRule>();
    private readonly config: IFormattingValidatorConfig;
    private readonly errorCollector = new ErrorCollector();

    constructor(config?: Partial<IFormattingValidatorConfig>) {
        this.config = {
            strictMode: false,
            maxErrors: 10,
            minQualityScore: 70,
            timeout: 5000,
            enabledRules: [],
            disabledRules: [],
            ...config
        };

        this.initializeBuiltInRules();
    }

    /**
     * 初始化内置验证规则
     */
    private initializeBuiltInRules(): void {
        // 语法正确性规则
        this.registerRule(new SyntaxValidityRule());
        this.registerRule(new ParseTreeIntegrityRule());

        // 格式化质量规则
        this.registerRule(new IndentationConsistencyRule());
        this.registerRule(new WhitespaceNormalizationRule());
        this.registerRule(new LineBreakConsistencyRule());

        // 安全性规则
        this.registerRule(new CodeInjectionPreventionRule());
        this.registerRule(new CommentPreservationRule());

        // 代码风格规则
        this.registerRule(new BracePositionConsistencyRule());
        this.registerRule(new OperatorSpacingRule());
    }

    /**
     * 验证语法树结构
     * @param parseTree 语法树
     * @returns 验证结果
     */
    public validateParseTree(parseTree: ParseTree): boolean {
        try {
            // 基础结构检查
            if (!parseTree) {
                return false;
            }

            // 检查树的完整性
            return this.checkTreeIntegrity(parseTree);
        } catch (error) {
            this.errorCollector.addError(`Parse tree validation failed: ${error}`, 'parseTree');
            return false;
        }
    }

    /**
     * 验证格式化后的文本
     * @param formattedText 格式化后的文本
     * @param original 原始文本
     * @param parseTree 原始语法树
     * @param context 格式化上下文
     * @returns 验证结果
     */
    public validateFormattedText(
        formattedText: string,
        original: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const startTime = Date.now();
        const messages: string[] = [];
        let totalScore = 0;
        let rulesChecked = 0;
        let rulesPassed = 0;
        let issuesFound = 0;
        let maxSeverity = ValidationSeverity.INFO;

        try {
            // 执行所有启用的验证规则
            const enabledRules = this.getEnabledRules();

            for (const rule of enabledRules) {
                try {
                    const result = rule.validate(original, formattedText, parseTree, context);
                    rulesChecked++;

                    if (result.passed) {
                        rulesPassed++;
                    } else {
                        issuesFound += result.messages.length;
                        messages.push(...result.messages.map(msg => `[${rule.name}] ${msg}`));

                        // 更新最高严重程度
                        if (this.compareSeverity(result.severity, maxSeverity) > 0) {
                            maxSeverity = result.severity;
                        }
                    }

                    totalScore += result.qualityScore;
                } catch (error) {
                    messages.push(`Rule ${rule.name} failed: ${error}`);
                    issuesFound++;
                    maxSeverity = ValidationSeverity.ERROR;
                }
            }

            // 计算平均质量评分
            const averageScore = rulesChecked > 0 ? totalScore / rulesChecked : 0;

            // 判断整体验证结果
            const passed = this.determineValidationResult(
                maxSeverity,
                averageScore,
                issuesFound
            );

            const duration = Date.now() - startTime;

            return {
                passed,
                severity: maxSeverity,
                messages,
                qualityScore: Math.round(averageScore),
                stats: {
                    rulesChecked,
                    rulesPassed,
                    issuesFound,
                    duration
                }
            };
        } catch (error) {
            return {
                passed: false,
                severity: ValidationSeverity.CRITICAL,
                messages: [`Critical validation error: ${error}`],
                qualityScore: 0,
                stats: {
                    rulesChecked: 0,
                    rulesPassed: 0,
                    issuesFound: 1,
                    duration: Date.now() - startTime
                }
            };
        }
    }

    /**
     * 注册验证规则
     * @param rule 验证规则
     */
    public registerRule(rule: IValidationRule): void {
        this.rules.set(rule.name, rule);
    }

    /**
     * 移除验证规则
     * @param ruleName 规则名称
     * @returns 是否成功移除
     */
    public unregisterRule(ruleName: string): boolean {
        return this.rules.delete(ruleName);
    }

    /**
     * 获取所有可用规则
     * @returns 规则列表
     */
    public getAvailableRules(): IValidationRule[] {
        return Array.from(this.rules.values());
    }

    /**
     * 获取启用的规则
     * @returns 启用的规则列表
     */
    private getEnabledRules(): IValidationRule[] {
        return Array.from(this.rules.values())
            .filter(rule => this.isRuleEnabled(rule))
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * 检查规则是否启用
     * @param rule 验证规则
     * @returns 是否启用
     */
    private isRuleEnabled(rule: IValidationRule): boolean {
        if (!rule.enabled) {
            return false;
        }

        // 检查禁用列表
        if (this.config.disabledRules.includes(rule.name)) {
            return false;
        }

        // 检查启用列表（如果配置了）
        if (this.config.enabledRules.length > 0) {
            return this.config.enabledRules.includes(rule.name);
        }

        return true;
    }

    /**
     * 检查语法树完整性
     * @param parseTree 语法树
     * @returns 是否完整
     */
    private checkTreeIntegrity(parseTree: ParseTree): boolean {
        try {
            // 递归检查所有子节点
            const childCount = parseTree.childCount;
            for (let i = 0; i < childCount; i++) {
                const child = parseTree.getChild(i);
                if (!child || !this.checkTreeIntegrity(child)) {
                    return false;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 比较验证严重程度
     * @param severity1 严重程度1
     * @param severity2 严重程度2
     * @returns 比较结果
     */
    private compareSeverity(severity1: ValidationSeverity, severity2: ValidationSeverity): number {
        const severityOrder = [
            ValidationSeverity.INFO,
            ValidationSeverity.WARNING,
            ValidationSeverity.ERROR,
            ValidationSeverity.CRITICAL
        ];

        const index1 = severityOrder.indexOf(severity1);
        const index2 = severityOrder.indexOf(severity2);

        return index1 - index2;
    }

    /**
     * 判断验证结果
     * @param maxSeverity 最高严重程度
     * @param qualityScore 质量评分
     * @param issuesFound 发现的问题数量
     * @returns 是否通过验证
     */
    private determineValidationResult(
        maxSeverity: ValidationSeverity,
        qualityScore: number,
        issuesFound: number
    ): boolean {
        // 严格模式下，任何错误都不能通过
        if (this.config.strictMode && maxSeverity !== ValidationSeverity.INFO) {
            return false;
        }

        // 检查严重错误
        if (maxSeverity === ValidationSeverity.CRITICAL) {
            return false;
        }

        // 检查错误数量限制
        if (issuesFound > this.config.maxErrors) {
            return false;
        }

        // 检查质量评分要求
        if (qualityScore < this.config.minQualityScore) {
            return false;
        }

        return true;
    }

    /**
     * 更新配置
     * @param config 新配置
     */
    public updateConfig(config: Partial<IFormattingValidatorConfig>): void {
        Object.assign(this.config, config);
    }

    /**
     * 获取当前配置
     * @returns 当前配置
     */
    public getConfig(): IFormattingValidatorConfig {
        return { ...this.config };
    }

    /**
     * 重置验证器状态
     */
    public reset(): void {
        this.errorCollector.clearErrors();
    }
}

// 内置验证规则实现

/**
 * 语法正确性规则
 */
class SyntaxValidityRule implements IValidationRule {
    readonly name = 'syntax-validity';
    readonly description = '检查格式化后代码的语法正确性';
    readonly priority = 100;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        // 这里应该重新解析格式化后的代码来验证语法
        // 由于需要ANTLR解析器，这里先做简化实现
        const basicSyntaxCheck = this.performBasicSyntaxCheck(formatted);

        return {
            passed: basicSyntaxCheck.valid,
            severity: basicSyntaxCheck.valid ? ValidationSeverity.INFO : ValidationSeverity.CRITICAL,
            messages: basicSyntaxCheck.errors,
            qualityScore: basicSyntaxCheck.valid ? 100 : 0,
            stats: {
                rulesChecked: 1,
                rulesPassed: basicSyntaxCheck.valid ? 1 : 0,
                issuesFound: basicSyntaxCheck.errors.length,
                duration: 0
            }
        };
    }

    private performBasicSyntaxCheck(code: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 基础语法检查
        const braceCount = this.countBraces(code);
        if (braceCount.open !== braceCount.close) {
            errors.push(`Unmatched braces: ${braceCount.open} open, ${braceCount.close} close`);
        }

        const parenCount = this.countParentheses(code);
        if (parenCount.open !== parenCount.close) {
            errors.push(`Unmatched parentheses: ${parenCount.open} open, ${parenCount.close} close`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    private countBraces(code: string): { open: number; close: number } {
        let open = 0, close = 0;
        let inString = false, inComment = false;

        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            const nextChar = code[i + 1];

            // 处理字符串
            if (char === '"' && !inComment) {
                inString = !inString;
                continue;
            }

            // 处理注释
            if (!inString) {
                if (char === '/' && nextChar === '/') {
                    inComment = true;
                    i++; // 跳过下一个字符
                    continue;
                }
                if (char === '\n' && inComment) {
                    inComment = false;
                    continue;
                }
            }

            // 计算大括号
            if (!inString && !inComment) {
                if (char === '{') open++;
                if (char === '}') close++;
            }
        }

        return { open, close };
    }

    private countParentheses(code: string): { open: number; close: number } {
        let open = 0, close = 0;
        let inString = false, inComment = false;

        for (let i = 0; i < code.length; i++) {
            const char = code[i];
            const nextChar = code[i + 1];

            // 处理字符串
            if (char === '"' && !inComment) {
                inString = !inString;
                continue;
            }

            // 处理注释
            if (!inString) {
                if (char === '/' && nextChar === '/') {
                    inComment = true;
                    i++; // 跳过下一个字符
                    continue;
                }
                if (char === '\n' && inComment) {
                    inComment = false;
                    continue;
                }
            }

            // 计算圆括号
            if (!inString && !inComment) {
                if (char === '(') open++;
                if (char === ')') close++;
            }
        }

        return { open, close };
    }
}

/**
 * 语法树完整性规则
 */
class ParseTreeIntegrityRule implements IValidationRule {
    readonly name = 'parse-tree-integrity';
    readonly description = '检查语法树结构完整性';
    readonly priority = 95;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        try {
            // 检查语法树基本结构
            if (!parseTree) {
                issues.push('Parse tree is null or undefined');
                qualityScore = 0;
            } else {
                // 检查节点完整性
                const nodeCount = this.countNodes(parseTree);
                if (nodeCount === 0) {
                    issues.push('Parse tree contains no nodes');
                    qualityScore = 0;
                }

                // 检查是否有未处理的错误节点
                const errorNodes = this.findErrorNodes(parseTree);
                if (errorNodes.length > 0) {
                    issues.push(`Found ${errorNodes.length} error nodes in parse tree`);
                    qualityScore = Math.max(0, qualityScore - errorNodes.length * 10);
                }
            }
        } catch (error) {
            issues.push(`Parse tree integrity check failed: ${error}`);
            qualityScore = 0;
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.ERROR,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private countNodes(node: ParseTree): number {
        let count = 1;
        const childCount = node.childCount;
        for (let i = 0; i < childCount; i++) {
            count += this.countNodes(node.getChild(i));
        }
        return count;
    }

    private findErrorNodes(node: ParseTree): ParseTree[] {
        const errorNodes: ParseTree[] = [];

        // 检查当前节点是否为错误节点
        if (node.constructor.name.includes('Error')) {
            errorNodes.push(node);
        }

        // 递归检查子节点
        const childCount = node.childCount;
        for (let i = 0; i < childCount; i++) {
            errorNodes.push(...this.findErrorNodes(node.getChild(i)));
        }

        return errorNodes;
    }
}

/**
 * 缩进一致性规则
 */
class IndentationConsistencyRule implements IValidationRule {
    readonly name = 'indentation-consistency';
    readonly description = '检查缩进一致性';
    readonly priority = 80;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        const lines = formatted.split('\n');
        const indentPattern = this.detectIndentPattern(lines);

        if (!indentPattern.consistent) {
            issues.push(`Inconsistent indentation detected: ${indentPattern.issues.join(', ')}`);
            qualityScore = Math.max(0, 100 - indentPattern.issues.length * 15);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.WARNING,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private detectIndentPattern(lines: string[]): { consistent: boolean; issues: string[] } {
        const issues: string[] = [];
        let expectedIndentSize = -1;
        let usesSpaces = false;
        let usesTabs = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim().length === 0) continue;

            const leadingWhitespace = line.match(/^[\s]*/)?.[0] || '';
            if (leadingWhitespace.length === 0) continue;

            // 检查是否混用空格和制表符
            if (leadingWhitespace.includes(' ')) usesSpaces = true;
            if (leadingWhitespace.includes('\t')) usesTabs = true;

            if (usesSpaces && usesTabs) {
                issues.push(`Line ${i + 1}: Mixed spaces and tabs`);
                continue;
            }

            // 检查缩进大小一致性
            if (expectedIndentSize === -1) {
                // 第一个有缩进的行，确定基准
                const indentSize = usesSpaces
                    ? leadingWhitespace.length
                    : leadingWhitespace.length; // 制表符也按长度计算
                if (indentSize > 0) {
                    expectedIndentSize = indentSize;
                }
            } else {
                const currentIndentSize = leadingWhitespace.length;
                if (currentIndentSize > 0 && currentIndentSize % expectedIndentSize !== 0) {
                    issues.push(`Line ${i + 1}: Inconsistent indent size`);
                }
            }
        }

        return {
            consistent: issues.length === 0,
            issues
        };
    }
}

/**
 * 空白符规范化规则
 */
class WhitespaceNormalizationRule implements IValidationRule {
    readonly name = 'whitespace-normalization';
    readonly description = '检查空白符规范化';
    readonly priority = 70;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        // 检查行尾空格
        const trailingSpaces = this.checkTrailingSpaces(formatted);
        if (trailingSpaces.length > 0) {
            issues.push(`Found trailing spaces on ${trailingSpaces.length} lines`);
            qualityScore = Math.max(0, qualityScore - trailingSpaces.length * 2);
        }

        // 检查多余的空行
        const excessiveBlankLines = this.checkExcessiveBlankLines(formatted);
        if (excessiveBlankLines > 0) {
            issues.push(`Found ${excessiveBlankLines} excessive blank lines`);
            qualityScore = Math.max(0, qualityScore - excessiveBlankLines * 5);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.WARNING,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private checkTrailingSpaces(code: string): number[] {
        const lines = code.split('\n');
        const linesWithTrailingSpaces: number[] = [];

        lines.forEach((line, index) => {
            if (line.length > 0 && line !== line.trimEnd()) {
                linesWithTrailingSpaces.push(index + 1);
            }
        });

        return linesWithTrailingSpaces;
    }

    private checkExcessiveBlankLines(code: string): number {
        const lines = code.split('\n');
        let consecutiveBlankLines = 0;
        let excessiveCount = 0;

        for (const line of lines) {
            if (line.trim().length === 0) {
                consecutiveBlankLines++;
            } else {
                if (consecutiveBlankLines > 2) {
                    excessiveCount += consecutiveBlankLines - 2;
                }
                consecutiveBlankLines = 0;
            }
        }

        return excessiveCount;
    }
}

/**
 * 换行一致性规则
 */
class LineBreakConsistencyRule implements IValidationRule {
    readonly name = 'line-break-consistency';
    readonly description = '检查换行一致性';
    readonly priority = 65;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        // 检查换行符一致性
        const lineEndingCheck = this.checkLineEndings(formatted);
        if (!lineEndingCheck.consistent) {
            issues.push(`Inconsistent line endings: ${lineEndingCheck.message}`);
            qualityScore = Math.max(0, qualityScore - 20);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.WARNING,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private checkLineEndings(code: string): { consistent: boolean; message: string } {
        const crlfCount = (code.match(/\r\n/g) || []).length;
        const lfCount = (code.match(/(?<!\r)\n/g) || []).length;
        const crCount = (code.match(/\r(?!\n)/g) || []).length;

        const total = crlfCount + lfCount + crCount;
        if (total === 0) return { consistent: true, message: '' };

        if (crlfCount === total) return { consistent: true, message: 'CRLF' };
        if (lfCount === total) return { consistent: true, message: 'LF' };
        if (crCount === total) return { consistent: true, message: 'CR' };

        return {
            consistent: false,
            message: `Mixed line endings: ${crlfCount} CRLF, ${lfCount} LF, ${crCount} CR`
        };
    }
}

/**
 * 代码注入防护规则
 */
class CodeInjectionPreventionRule implements IValidationRule {
    readonly name = 'code-injection-prevention';
    readonly description = '防止代码注入攻击';
    readonly priority = 90;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        // 检查是否有恶意代码注入
        const suspiciousPatterns = this.detectSuspiciousPatterns(formatted);
        if (suspiciousPatterns.length > 0) {
            issues.push(...suspiciousPatterns.map(pattern => `Suspicious pattern detected: ${pattern}`));
            qualityScore = 0; // 安全问题严重性很高
        }

        // 检查格式化前后的代码长度变化
        const sizeDifference = Math.abs(formatted.length - original.length);
        const sizeChangePercentage = (sizeDifference / original.length) * 100;

        if (sizeChangePercentage > 50) {
            issues.push(`Significant size change detected: ${sizeChangePercentage.toFixed(1)}%`);
            qualityScore = Math.max(0, qualityScore - 30);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.ERROR,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private detectSuspiciousPatterns(code: string): string[] {
        const suspiciousPatterns = [
            /eval\s*\(/,
            /exec\s*\(/,
            /system\s*\(/,
            /\$\{[^}]*\}/,  // 模板字符串注入
            /<script[^>]*>/i,
            /javascript\s*:/i
        ];

        const detected: string[] = [];

        suspiciousPatterns.forEach((pattern, index) => {
            if (pattern.test(code)) {
                detected.push(`Pattern ${index + 1}`);
            }
        });

        return detected;
    }
}

/**
 * 注释保留规则
 */
class CommentPreservationRule implements IValidationRule {
    readonly name = 'comment-preservation';
    readonly description = '确保注释被正确保留';
    readonly priority = 75;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        const originalComments = this.extractComments(original);
        const formattedComments = this.extractComments(formatted);

        // 检查注释数量是否一致
        if (originalComments.length !== formattedComments.length) {
            issues.push(`Comment count mismatch: original ${originalComments.length}, formatted ${formattedComments.length}`);
            qualityScore = Math.max(0, qualityScore - 30);
        }

        // 检查注释内容是否保留
        const missingComments = this.findMissingComments(originalComments, formattedComments);
        if (missingComments.length > 0) {
            issues.push(`Missing comments: ${missingComments.length} comments lost`);
            qualityScore = Math.max(0, qualityScore - missingComments.length * 10);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.WARNING,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private extractComments(code: string): string[] {
        const comments: string[] = [];
        const singleLineComments = code.match(/\/\/.*$/gm) || [];
        const multiLineComments = code.match(/\/\*[\s\S]*?\*\//g) || [];

        return [...singleLineComments, ...multiLineComments];
    }

    private findMissingComments(original: string[], formatted: string[]): string[] {
        const formattedSet = new Set(formatted.map(comment => comment.trim()));
        return original.filter(comment => !formattedSet.has(comment.trim()));
    }
}

/**
 * 大括号位置一致性规则
 */
class BracePositionConsistencyRule implements IValidationRule {
    readonly name = 'brace-position-consistency';
    readonly description = '检查大括号位置一致性';
    readonly priority = 60;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        const braceStyle = this.analyzeBraceStyle(formatted);
        if (!braceStyle.consistent) {
            issues.push(`Inconsistent brace style: ${braceStyle.message}`);
            qualityScore = Math.max(0, qualityScore - 15);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.WARNING,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private analyzeBraceStyle(code: string): { consistent: boolean; message: string } {
        const lines = code.split('\n');
        let sameLine = 0;
        let newLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 检查开大括号的位置
            if (line.includes('{')) {
                const beforeBrace = line.substring(0, line.indexOf('{')).trim();
                if (beforeBrace.length > 0) {
                    sameLine++;
                } else if (i > 0 && lines[i - 1].trim().length > 0) {
                    newLine++;
                }
            }
        }

        const total = sameLine + newLine;
        if (total === 0) return { consistent: true, message: '' };

        const consistency = Math.max(sameLine, newLine) / total;
        if (consistency < 0.8) {
            return {
                consistent: false,
                message: `Mixed brace styles: ${sameLine} same-line, ${newLine} new-line`
            };
        }

        return { consistent: true, message: '' };
    }
}

/**
 * 操作符间距规则
 */
class OperatorSpacingRule implements IValidationRule {
    readonly name = 'operator-spacing';
    readonly description = '检查操作符周围的空格';
    readonly priority = 55;
    enabled = true;

    validate(
        original: string,
        formatted: string,
        parseTree: ParseTree,
        context: IExtendedFormattingContext
    ): IValidationResult {
        const issues: string[] = [];
        let qualityScore = 100;

        const spacingIssues = this.checkOperatorSpacing(formatted);
        if (spacingIssues.length > 0) {
            issues.push(...spacingIssues);
            qualityScore = Math.max(0, qualityScore - spacingIssues.length * 5);
        }

        return {
            passed: issues.length === 0,
            severity: issues.length === 0 ? ValidationSeverity.INFO : ValidationSeverity.WARNING,
            messages: issues,
            qualityScore,
            stats: {
                rulesChecked: 1,
                rulesPassed: issues.length === 0 ? 1 : 0,
                issuesFound: issues.length,
                duration: 0
            }
        };
    }

    private checkOperatorSpacing(code: string): string[] {
        const issues: string[] = [];
        const operators = ['+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>='];
        const lines = code.split('\n');

        lines.forEach((line, lineIndex) => {
            operators.forEach(operator => {
                const regex = new RegExp(`\\S${operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\S`, 'g');
                if (regex.test(line)) {
                    issues.push(`Line ${lineIndex + 1}: Missing spaces around '${operator}' operator`);
                }
            });
        });

        return issues;
    }
}