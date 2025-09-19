import * as vscode from 'vscode';
import { FormattingConfig, FormattingResult } from '../config/FormattingConfig';
import { FormattingEngine } from './FormattingEngine';
import { IncrementalCache } from '../cache/IncrementalCache';

/**
 * 增量格式化器
 * 仅格式化变更的部分，提高大文件的格式化性能
 */
export class IncrementalFormatter {
    private static readonly MIN_INCREMENTAL_SIZE = 1000; // 最小启用增量格式化的文档大小
    private static readonly CONTEXT_LINES = 5; // 上下文行数

    /**
     * 判断是否应该使用增量格式化
     */
    static shouldUseIncremental(
        document: vscode.TextDocument,
        changes: readonly vscode.TextDocumentContentChangeEvent[]
    ): boolean {
        // 文档太小，不需要增量格式化
        if (document.getText().length < this.MIN_INCREMENTAL_SIZE) {
            return false;
        }

        // 变更太多，直接全量格式化更快
        if (changes.length > 10) {
            return false;
        }

        // 变更范围太大，全量格式化
        const totalChangedLines = changes.reduce((sum, change) => {
            if (change.range) {
                return sum + (change.range.end.line - change.range.start.line + 1);
            }
            return sum + change.text.split('\n').length;
        }, 0);

        if (totalChangedLines > document.lineCount * 0.3) {
            return false;
        }

        return true;
    }

    /**
     * 执行增量格式化
     */
    static async performIncremental(
        document: vscode.TextDocument,
        changes: readonly vscode.TextDocumentContentChangeEvent[],
        engine: FormattingEngine,
        config: FormattingConfig
    ): Promise<vscode.TextEdit[]> {
        const edits: vscode.TextEdit[] = [];

        try {
            for (const change of changes) {
                const incrementalEdits = await this.formatChangeRegion(
                    document,
                    change,
                    engine,
                    config
                );
                edits.push(...incrementalEdits);
            }

            return edits;

        } catch (error) {
            console.warn('增量格式化失败，回退到全量格式化:', error);
            // 回退到全量格式化
            return engine.formatDocument(document).then(result => {
                if (result.success && result.formattedText) {
                    const fullRange = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(document.getText().length)
                    );
                    return [vscode.TextEdit.replace(fullRange, result.formattedText)];
                }
                return [];
            });
        }
    }

    /**
     * 格式化变更区域
     */
    private static async formatChangeRegion(
        document: vscode.TextDocument,
        change: vscode.TextDocumentContentChangeEvent,
        engine: FormattingEngine,
        config: FormattingConfig
    ): Promise<vscode.TextEdit[]> {
        // 确定需要格式化的范围（包含上下文）
        const formatRange = this.calculateFormatRange(document, change);

        // 获取要格式化的文本
        const textToFormat = document.getText(formatRange);

        // 执行格式化
        const result = await engine.formatText(textToFormat);

        if (result.success && result.formattedText) {
            // 检查是否有实际变更
            if (result.formattedText !== textToFormat) {
                return [vscode.TextEdit.replace(formatRange, result.formattedText)];
            }
        }

        return [];
    }

    /**
     * 计算需要格式化的范围
     */
    private static calculateFormatRange(
        document: vscode.TextDocument,
        change: vscode.TextDocumentContentChangeEvent
    ): vscode.Range {
        let startLine: number;
        let endLine: number;

        if (change.range) {
            startLine = change.range.start.line;
            endLine = change.range.end.line;
        } else {
            // 全文档变更，使用全范围
            startLine = 0;
            endLine = document.lineCount - 1;
        }

        // 添加上下文行
        const contextStart = Math.max(0, startLine - this.CONTEXT_LINES);
        const contextEnd = Math.min(document.lineCount - 1, endLine + this.CONTEXT_LINES);

        // 扩展到完整的语句边界
        const adjustedRange = this.adjustToStatementBoundaries(
            document,
            new vscode.Range(contextStart, 0, contextEnd, document.lineAt(contextEnd).text.length)
        );

        return adjustedRange;
    }

    /**
     * 调整范围到语句边界
     */
    private static adjustToStatementBoundaries(
        document: vscode.TextDocument,
        range: vscode.Range
    ): vscode.Range {
        let startLine = range.start.line;
        let endLine = range.end.line;

        // 向上寻找语句开始
        while (startLine > 0) {
            const line = document.lineAt(startLine - 1).text.trim();
            if (this.isStatementBoundary(line)) {
                break;
            }
            startLine--;
        }

        // 向下寻找语句结束
        while (endLine < document.lineCount - 1) {
            const line = document.lineAt(endLine).text.trim();
            if (this.isStatementBoundary(line)) {
                break;
            }
            endLine++;
        }

        return new vscode.Range(
            startLine,
            0,
            endLine,
            document.lineAt(endLine).text.length
        );
    }

    /**
     * 判断是否是语句边界
     */
    private static isStatementBoundary(line: string): boolean {
        const trimmed = line.trim();

        // 空行
        if (trimmed.length === 0) {
            return true;
        }

        // 注释行
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            return true;
        }

        // 大括号
        if (trimmed === '{' || trimmed === '}') {
            return true;
        }

        // 分号结尾的语句
        if (trimmed.endsWith(';')) {
            return true;
        }

        // 函数定义
        if (/^\w+.*\{$/.test(trimmed)) {
            return true;
        }

        // 控制结构
        if (/^(if|else|while|for|foreach|switch|case|default)\b/.test(trimmed)) {
            return true;
        }

        return false;
    }

    /**
     * 全局增量缓存实例
     */
    private static incrementalCache = new IncrementalCache();

    /**
     * 获取增量缓存统计信息
     */
    static getCacheStats() {
        return this.incrementalCache.getStats();
    }

    /**
     * 清理增量缓存
     */
    static clearCache() {
        this.incrementalCache.clear();
    }
}