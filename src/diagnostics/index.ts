/**
 * 诊断模块导出
 * 提供统一的入口点
 */

// 主协调器
export { DiagnosticsOrchestrator } from './DiagnosticsOrchestrator';

// 类型定义
export type { IDiagnosticCollector, DiagnosticCollectionOptions, CollectorResult } from './types';

// 收集器
export { ObjectAccessCollector } from './collectors/ObjectAccessCollector';
export { MacroUsageCollector } from './collectors/MacroUsageCollector';
export { FunctionCallCollector } from './collectors/FunctionCallCollector';

// 分析器
export type { VariableInfo } from './analyzers/VariableAnalyzer';
export { VariableAnalyzer } from './analyzers/VariableAnalyzer';
