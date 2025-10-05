/**
 * 诊断模块入口
 * 导出DiagnosticsOrchestrator作为主类，保持向后兼容
 */

// 导出新的协调器
export { DiagnosticsOrchestrator } from './diagnostics/DiagnosticsOrchestrator';

// 导出类型定义
export type { IDiagnosticCollector, DiagnosticCollectionOptions, CollectorResult } from './diagnostics/types';

// 为了向后兼容，也导出为LPCDiagnostics别名
export { DiagnosticsOrchestrator as LPCDiagnostics } from './diagnostics/DiagnosticsOrchestrator';
