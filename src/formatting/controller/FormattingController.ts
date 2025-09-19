import * as vscode from 'vscode';
import { FormattingEngine } from '../engine/FormattingEngine';
import { RuleEngine } from '../engine/RuleEngine';
import { IncrementalFormatter } from '../engine/IncrementalFormatter';
import { ConfigurationManager } from './ConfigurationManager';
import { FormattingCache } from '../cache/FormattingCache';
import { PerformanceMonitor } from '../cache/PerformanceMonitor';
import { FormattingConfig, FormattingResult } from '../config/FormattingConfig';
import { RuleManager, createConfiguredRuleEngine } from '../rules/RuleManager';

/**
 * LPC 格式化控制器，协调整个格式化流程
 */
export class FormattingController {
    private engine: FormattingEngine;
    private ruleEngine: RuleEngine;
    private configManager: ConfigurationManager;
    private cache: FormattingCache;
    private performanceMonitor: PerformanceMonitor;
    private disposables: vscode.Disposable[] = [];
    private isInitialized = false;

    constructor() {
        this.configManager = ConfigurationManager.getInstance();

        const config = this.configManager.getConfiguration();
        this.ruleEngine = createConfiguredRuleEngine(config);

        this.cache = new FormattingCache();
        this.performanceMonitor = new PerformanceMonitor();

        this.engine = new FormattingEngine(config, this.ruleEngine);

        this.initialize();
    }

    /**
     * 初始化控制器
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }
        
        // 初始化规则引擎
        this.initializeRules();
        
        // 设置配置变更监听
        this.setupConfigurationListener();
        
        // 设置文档变更监听（用于失效缓存）
        this.setupDocumentListener();
        
        this.isInitialized = true;
    }

    /**
     * 格式化整个文档
     */
    async formatDocument(
        document: vscode.TextDocument,
        changes?: readonly vscode.TextDocumentContentChangeEvent[]
    ): Promise<vscode.TextEdit[]> {
        try {
            this.performanceMonitor.startTiming();

            // 尝试使用增量格式化
            const config = this.configManager.getConfiguration();
            if (changes && config.enableIncrementalFormatting &&
                IncrementalFormatter.shouldUseIncremental(document, changes)) {

                const incrementalEdits = await IncrementalFormatter.performIncremental(
                    document,
                    changes,
                    this.engine,
                    config
                );

                if (incrementalEdits.length > 0) {
                    this.recordIncrementalMetrics(document, incrementalEdits);
                    return incrementalEdits;
                }
            }

            // 检查缓存
            const cachedResult = this.cache.get(document);
            if (cachedResult && cachedResult.success) {
                this.recordPerformanceMetrics(document, cachedResult, true);
                return this.createTextEdits(document, cachedResult.formattedText!);
            }
            
            // 执行格式化
            const result = await this.engine.formatDocument(document);
            this.recordPerformanceMetrics(document, result, false);
            
            // 缓存结果
            if (result.success) {
                this.cache.set(document, result);
                return this.createTextEdits(document, result.formattedText!);
            } else {
                this.handleFormattingError(result);
                return [];
            }
            
        } catch (error) {
            console.error('LPC 格式化错误:', error);
            vscode.window.showErrorMessage(
                `LPC 格式化失败: ${error instanceof Error ? error.message : String(error)}`
            );
            return [];
        }
    }

    /**
     * 格式化文档范围
     */
    async formatRange(
        document: vscode.TextDocument, 
        range: vscode.Range
    ): Promise<vscode.TextEdit[]> {
        try {
            this.performanceMonitor.startTiming();
            
            const result = await this.engine.formatRange(document, range);
            this.recordPerformanceMetrics(document, result, false);
            
            if (result.success) {
                return [vscode.TextEdit.replace(range, result.formattedText!)];
            } else {
                this.handleFormattingError(result);
                return [];
            }
            
        } catch (error) {
            console.error('LPC 范围格式化错误:', error);
            vscode.window.showErrorMessage(
                `LPC 范围格式化失败: ${error instanceof Error ? error.message : String(error)}`
            );
            return [];
        }
    }

    /**
     * 获取当前配置
     */
    getConfiguration(): FormattingConfig {
        return this.configManager.getConfiguration();
    }

    /**
     * 更新配置
     */
    async updateConfiguration(config: Partial<FormattingConfig>): Promise<void> {
        await this.configManager.updateConfiguration(config);
    }

    /**
     * 获取规则引擎
     */
    getRuleEngine(): RuleEngine {
        return this.ruleEngine;
    }

    /**
     * 获取缓存统计
     */
    getCacheStats(): {
        main: ReturnType<FormattingCache['getStats']>;
        incremental: ReturnType<typeof IncrementalFormatter.getCacheStats>;
    } {
        return {
            main: this.cache.getStats(),
            incremental: IncrementalFormatter.getCacheStats()
        };
    }

    /**
     * 获取性能统计
     */
    getPerformanceStats(): ReturnType<PerformanceMonitor['getStats']> {
        return this.performanceMonitor.getStats();
    }

    /**
     * 清空缓存
     */
    clearCache(): void {
        this.cache.clear();
        IncrementalFormatter.clearCache();
    }

    /**
     * 重置性能统计
     */
    resetPerformanceStats(): void {
        this.performanceMonitor.clear();
    }

    /**
     * 生成性能报告
     */
    generatePerformanceReport(): string {
        return this.performanceMonitor.generateReport();
    }

    /**
     * 检查是否支持指定文档
     */
    supportsDocument(document: vscode.TextDocument): boolean {
        return document.languageId === 'lpc';
    }

    /**
     * 销毁控制器
     */
    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        
        this.engine.dispose();
        this.cache.dispose();
        this.configManager.dispose();
        
        this.isInitialized = false;
    }

    /**
     * 初始化格式化规则
     */
    private initializeRules(): void {
        // 使用RuleManager管理规则，不需要手动添加规则
        // 规则已经在构造函数中通过createConfiguredRuleEngine初始化
        const ruleManager = RuleManager.getInstance();
        ruleManager.configureRules(this.configManager.getConfiguration());
    }

    /**
     * 设置配置变更监听
     */
    private setupConfigurationListener(): void {
        const disposable = this.configManager.onConfigurationChanged(config => {
            // 更新格式化引擎配置
            this.engine.updateConfig(config);

            // 更新规则配置
            const ruleManager = RuleManager.getInstance();
            ruleManager.configureRules(config);

            // 清空缓存（因为配置变化可能影响格式化结果）
            this.cache.clear();
        });

        this.disposables.push(disposable);
    }

    /**
     * 设置文档变更监听
     */
    private setupDocumentListener(): void {
        const disposable = vscode.workspace.onDidChangeTextDocument(event => {
            if (this.supportsDocument(event.document)) {
                // 文档变更时删除对应的缓存
                this.cache.delete(event.document);
            }
        });
        
        this.disposables.push(disposable);
    }

    /**
     * 创建文本编辑操作
     */
    private createTextEdits(document: vscode.TextDocument, formattedText: string): vscode.TextEdit[] {
        // 安全检查：确保格式化文本不为空且合理
        const originalText = document.getText();

        if (!formattedText || formattedText.trim().length === 0) {
            console.warn('格式化文本为空，跳过格式化');
            return [];
        }

        // 如果格式化文本与原始文本相同，不需要编辑
        if (formattedText === originalText) {
            return [];
        }

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalText.length)
        );

        return [vscode.TextEdit.replace(fullRange, formattedText)];
    }

    /**
     * 处理格式化错误
     */
    private handleFormattingError(result: FormattingResult): void {
        if (result.errors && result.errors.length > 0) {
            const errorMessage = result.errors.join('; ');
            console.error('LPC 格式化错误:', errorMessage);
            
            // 不显示这些错误给用户，因为它们可能是语法错误而非格式化器错误
        }
        
        if (result.warnings && result.warnings.length > 0) {
            const warningMessage = result.warnings.join('; ');
            console.warn('LPC 格式化警告:', warningMessage);
        }
    }

    /**
     * 记录性能指标
     */
    private recordPerformanceMetrics(
        document: vscode.TextDocument,
        result: FormattingResult,
        fromCache: boolean
    ): void {
        if (!fromCache) {
            this.performanceMonitor.recordMetrics({
                documentSize: document.getText().length,
                ruleCount: this.ruleEngine.getEnabledRuleNames().length,
                success: result.success,
                errorCount: result.errors?.length || 0,
                warningCount: result.warnings?.length || 0
            });
        }
    }

    /**
     * 记录增量格式化指标
     */
    private recordIncrementalMetrics(
        document: vscode.TextDocument,
        edits: vscode.TextEdit[]
    ): void {
        this.performanceMonitor.recordMetrics({
            documentSize: document.getText().length,
            ruleCount: this.ruleEngine.getEnabledRuleNames().length,
            success: true,
            errorCount: 0,
            warningCount: 0
        });
    }

    /**
     * 获取诊断信息
     */
    getDiagnostics(): {
        controller: string;
        engine: string;
        rules: string;
        cache: string;
        performance: string;
    } {
        const cacheStats = this.getCacheStats();
        const perfStats = this.getPerformanceStats();
        const ruleStats = this.ruleEngine.getStats();
        
        return {
            controller: `初始化: ${this.isInitialized ? '是' : '否'}`,
            engine: `配置加载: 正常`,
            rules: `总规则: ${ruleStats.total}, 启用: ${ruleStats.enabled}, 禁用: ${ruleStats.disabled}`,
            cache: `主缓存: ${cacheStats.main.size}, 命中率: ${(cacheStats.main.hitRate * 100).toFixed(1)}%, 增量缓存: ${cacheStats.incremental.totalRanges} 范围`,
            performance: `总操作: ${perfStats.totalOperations}, 平均时间: ${perfStats.averageFormatTime.toFixed(2)}ms`
        };
    }
}