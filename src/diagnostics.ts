/**
 * Diagnostics 唯一主入口
 * 对外统一暴露协调器、stack factory 和相关类型，避免生产装配绕开主出口各走一套。
 */

// 导出协调器与兼容别名
export { DiagnosticsOrchestrator } from './diagnostics/DiagnosticsOrchestrator';
export { DiagnosticsOrchestrator as LPCDiagnostics } from './diagnostics/DiagnosticsOrchestrator';

// 导出 diagnostics stack factory
export { createDiagnosticsStack } from './diagnostics/createDiagnosticsStack';
export type { DiagnosticsStack } from './diagnostics/createDiagnosticsStack';

// 导出类型定义
export type { IDiagnosticCollector, DiagnosticCollectionOptions, CollectorResult } from './diagnostics/types';
