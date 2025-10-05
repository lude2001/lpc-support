import * as vscode from 'vscode';
import { ParsedDoc } from '../parseCache';

/**
 * 诊断收集器接口
 * 所有诊断收集器必须实现此接口
 */
export interface IDiagnosticCollector {
    /**
     * 收集器名称，用于日志和调试
     */
    readonly name: string;

    /**
     * 收集诊断信息
     * @param document 文档对象
     * @param parsed 解析后的文档结构
     * @returns 诊断信息数组
     */
    collect(document: vscode.TextDocument, parsed: ParsedDoc): vscode.Diagnostic[] | Promise<vscode.Diagnostic[]>;
}

/**
 * 诊断收集选项
 */
export interface DiagnosticCollectionOptions {
    /**
     * 是否启用异步收集
     */
    enableAsync?: boolean;

    /**
     * 批处理大小
     */
    batchSize?: number;

    /**
     * 是否显示完成消息
     */
    showMessage?: boolean;

    /**
     * 是否跳过缓存检查
     */
    skipCache?: boolean;
}

/**
 * 诊断收集器执行结果
 */
export interface CollectorResult {
    /**
     * 收集器名称
     */
    collectorName: string;

    /**
     * 收集到的诊断信息
     */
    diagnostics: vscode.Diagnostic[];

    /**
     * 执行时间（毫秒）
     */
    duration?: number;

    /**
     * 错误信息（如果有）
     */
    error?: Error;
}
