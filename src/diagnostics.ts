/**
 * Diagnostics 唯一主入口
 * 对外统一暴露协调器、stack factory 和相关类型，避免生产装配绕开主出口各走一套。
 */

export { DiagnosticsOrchestrator } from './diagnostics/DiagnosticsOrchestrator';

// 导出 diagnostics stack factory
export { createDiagnosticsStack } from './diagnostics/createDiagnosticsStack';
export type { CreateDiagnosticsStackOptions, DiagnosticsStack } from './diagnostics/createDiagnosticsStack';
export { DefaultDiagnosticSymbolResolver } from './diagnostics/semantic/DiagnosticSymbolResolver';
export type {
    DiagnosticCallableSignature,
    DiagnosticSymbolResolver,
    VisibleDiagnosticSymbols
} from './diagnostics/semantic/DiagnosticSymbolResolver';

// 导出类型定义
export type { IDiagnosticCollector, DiagnosticCollectionOptions, CollectorResult } from './diagnostics/types';
