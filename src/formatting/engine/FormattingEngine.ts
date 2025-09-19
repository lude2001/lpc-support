import { FormattingConfig, FormattingResult } from '../config/FormattingConfig';
import { RuleEngine } from './RuleEngine';
import { FormattingVisitor } from './FormattingVisitor';
import { ErrorRecovery } from './ErrorRecovery';
import { getParsed } from '../../parseCache';
import * as vscode from 'vscode';
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { LPCLexer } from '../../antlr/LPCLexer';
import { LPCParser, SourceFileContext } from '../../antlr/LPCParser';
import { CollectingErrorListener } from '../../parser/CollectingErrorListener';

/**
 * LPC 格式化引擎核心实现
 */
export class FormattingEngine {
    private ruleEngine: RuleEngine;
    private config: FormattingConfig;
    private performanceStats = {
        totalFormatTime: 0,
        formatCount: 0,
        cacheHits: 0,
        cacheMisses: 0
    };

    constructor(config: FormattingConfig, ruleEngine?: RuleEngine) {
        this.config = config;
        this.ruleEngine = ruleEngine || new RuleEngine();
    }

    /**
     * 格式化文档
     */
    async formatDocument(document: vscode.TextDocument): Promise<FormattingResult> {
        const startTime = Date.now();
        
        try {
            // 检查超时设置
            const timeoutPromise = new Promise<FormattingResult>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`格式化超时（${this.config.maxFormatTime}ms）`));
                }, this.config.maxFormatTime);
            });

            const formatPromise = this.doFormatDocument(document);
            
            const result = await Promise.race([formatPromise, timeoutPromise]);
            
            // 更新性能统计
            this.performanceStats.totalFormatTime += Date.now() - startTime;
            this.performanceStats.formatCount++;
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            // 使用错误恢复机制创建备用结果
            const fallbackResult = ErrorRecovery.createFallbackResult(
                document.getText(),
                error instanceof Error ? error : new Error(String(error))
            );

            return {
                ...fallbackResult,
                duration
            };
        }
    }

    /**
     * 格式化文档范围
     */
    async formatRange(
        document: vscode.TextDocument, 
        range: vscode.Range
    ): Promise<FormattingResult> {
        const startTime = Date.now();
        
        try {
            // 获取范围内的文本
            const rangeText = document.getText(range);
            
            // 尝试解析范围内的代码
            const result = await this.formatText(rangeText, document.uri.toString());
            
            return {
                ...result,
                duration: Date.now() - startTime
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            // 使用错误恢复机制创建备用结果
            const fallbackResult = ErrorRecovery.createFallbackResult(
                document.getText(range),
                error instanceof Error ? error : new Error(String(error))
            );

            return {
                ...fallbackResult,
                duration
            };
        }
    }

    /**
     * 格式化文本
     */
    async formatText(text: string, uri?: string): Promise<FormattingResult> {
        const startTime = Date.now();
        
        try {
            // 直接解析文本，不使用缓存
            const parseResult = this.parseText(text, uri);
            
            if (parseResult.errors && parseResult.errors.length > 0) {
                // 尝试错误恢复
                const recoveryResult = ErrorRecovery.smartErrorRecovery(
                    text,
                    parseResult.tree,
                    parseResult.errors,
                    this.config
                );

                if (recoveryResult.success) {
                    return {
                        ...recoveryResult,
                        duration: Date.now() - startTime
                    };
                } else {
                    return {
                        success: false,
                        errors: parseResult.errors.map(diag => diag.message),
                        warnings: ['存在语法错误，格式化可能不完整'],
                        duration: Date.now() - startTime
                    };
                }
            }
            
            // 创建格式化访问者
            const visitor = new FormattingVisitor(this.config, this.ruleEngine);

            // 执行格式化
            const formattedText = visitor.visitSourceFile(parseResult.tree);

            // 验证格式化结果
            const validation = ErrorRecovery.validateFormattedText(text, formattedText);

            const duration = Date.now() - startTime;

            return {
                success: validation.isValid,
                formattedText,
                warnings: validation.issues.length > 0 ? validation.issues : undefined,
                duration
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            // 使用错误恢复机制创建备用结果
            const fallbackResult = ErrorRecovery.createFallbackResult(
                text,
                error instanceof Error ? error : new Error(String(error))
            );

            return {
                ...fallbackResult,
                duration
            };
        }
    }

    /**
     * 执行文档格式化的内部实现
     */
    private async doFormatDocument(document: vscode.TextDocument): Promise<FormattingResult> {
        try {
            // 尝试使用缓存
            let parsed;
            try {
                parsed = getParsed(document);
                this.performanceStats.cacheHits++;
            } catch (error) {
                // 缓存失败，直接解析
                const text = document.getText();
                const parseResult = this.parseText(text, document.uri.toString());
                parsed = {
                    version: document.version,
                    tokens: parseResult.tokens,
                    tree: parseResult.tree,
                    diagnostics: parseResult.errors || [],
                    lastAccessed: Date.now(),
                    parseTime: 0,
                    size: text.length
                };
                this.performanceStats.cacheMisses++;
            }
            
            // 检查是否有严重的语法错误
            const criticalErrors = parsed.diagnostics.filter(
                diag => diag.severity === vscode.DiagnosticSeverity.Error
            );
            
            if (criticalErrors.length > 0) {
                return {
                    success: false,
                    errors: criticalErrors.map(diag => diag.message),
                    warnings: ['存在严重语法错误，跳过格式化'],
                    duration: 0
                };
            }
            
            // 创建格式化访问者
            const visitor = new FormattingVisitor(this.config, this.ruleEngine);

            // 执行格式化
            const formattedText = visitor.visitSourceFile(parsed.tree);

            // 关键安全检查：如果格式化结果为空或太短，返回原始文本
            const originalText = document.getText();
            if (!formattedText || formattedText.trim().length === 0 ||
                formattedText.length < originalText.length * 0.1) {
                console.warn('格式化结果可能有问题，返回原始文本');
                return {
                    success: false,
                    errors: ['格式化结果为空或过短，保持原始文本'],
                    duration: 0
                };
            }
            
            return {
                success: true,
                formattedText,
                warnings: parsed.diagnostics.length > 0 ? ['存在语法警告'] : undefined,
                duration: 0 // 将在上层计算
            };
            
        } catch (error) {
            throw new Error(`格式化失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 解析文本
     */
    private parseText(text: string, uri?: string): {
        tokens: CommonTokenStream;
        tree: SourceFileContext;
        errors?: vscode.Diagnostic[];
    } {
        const input = CharStreams.fromString(text);
        const lexer = new LPCLexer(input);
        const tokens = new CommonTokenStream(lexer);
        const parser = new LPCParser(tokens);

        // 关键：创建一个临时文档对象用于错误收集
        const tempDocument = {
            uri: { toString: () => uri || 'temp://formatting' },
            getText: () => text,
            version: 1,
            languageId: 'lpc'
        } as vscode.TextDocument;

        // 附加错误监听器收集语法错误
        const errorListener = new CollectingErrorListener(tempDocument);
        parser.removeErrorListeners();
        parser.addErrorListener(errorListener);

        const tree = parser.sourceFile();
        
        return {
            tokens,
            tree,
            errors: errorListener.diagnostics.length > 0 ? errorListener.diagnostics : undefined
        };
    }

    /**
     * 更新配置
     */
    updateConfig(config: FormattingConfig): void {
        this.config = config;
    }

    /**
     * 获取规则引擎
     */
    getRuleEngine(): RuleEngine {
        return this.ruleEngine;
    }

    /**
     * 获取当前配置
     */
    getConfig(): FormattingConfig {
        return { ...this.config };
    }

    /**
     * 获取性能统计
     */
    getPerformanceStats(): {
        totalFormatTime: number;
        formatCount: number;
        averageFormatTime: number;
        cacheHitRate: number;
    } {
        const averageFormatTime = this.performanceStats.formatCount > 0 
            ? this.performanceStats.totalFormatTime / this.performanceStats.formatCount 
            : 0;
            
        const totalCacheRequests = this.performanceStats.cacheHits + this.performanceStats.cacheMisses;
        const cacheHitRate = totalCacheRequests > 0 
            ? this.performanceStats.cacheHits / totalCacheRequests 
            : 0;

        return {
            totalFormatTime: this.performanceStats.totalFormatTime,
            formatCount: this.performanceStats.formatCount,
            averageFormatTime,
            cacheHitRate
        };
    }

    /**
     * 重置性能统计
     */
    resetPerformanceStats(): void {
        this.performanceStats = {
            totalFormatTime: 0,
            formatCount: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.ruleEngine.clearRules();
        this.resetPerformanceStats();
    }
}