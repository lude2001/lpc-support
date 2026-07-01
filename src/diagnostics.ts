/**
 * Diagnostics 唯一主入口
 * 对外统一暴露协调器、stack factory 和相关类型，避免生产装配绕开主出口各走一套。
 */

export { DiagnosticsOrchestrator } from './diagnostics/DiagnosticsOrchestrator';

// 导出 diagnostics stack factory
export { createDiagnosticsStack } from './diagnostics/createDiagnosticsStack';
export type { CreateDiagnosticsStackOptions, DiagnosticsStack } from './diagnostics/createDiagnosticsStack';
export { DefaultDiagnosticSymbolResolver } from './diagnostics/semantic/DiagnosticSymbolResolver';
export { TypeDiagnosticsCollector } from './diagnostics/collectors/TypeDiagnosticsCollector';
export type { TypeDiagnosticsCollectorOptions } from './diagnostics/collectors/TypeDiagnosticsCollector';
export type {
    DiagnosticCallableParameter,
    DiagnosticCallableSignature,
    DiagnosticSymbolResolver,
    VisibleDiagnosticSymbols
} from './diagnostics/semantic/DiagnosticSymbolResolver';
export {
    DefaultDiagnosticFactsProvider,
    createCurrentFileVisibleSymbols,
    hasUnexpandedFunctionLikeMacroReference
} from './diagnostics/semantic/DiagnosticTypeFacts';
export type {
    DiagnosticFactsProvider,
    DiagnosticMacroSuppressionFacts,
    DiagnosticTypeFacts,
    TypeCheckingOptions
} from './diagnostics/semantic/DiagnosticTypeFacts';
export {
    acceptsDiagnosticArgumentCount,
    getDirectDiagnosticCallSite
} from './diagnostics/semantic/DiagnosticSyntaxFacts';
export type { DirectDiagnosticCallSite } from './diagnostics/semantic/DiagnosticSyntaxFacts';

// 导出类型定义
export type {
    CollectorResult,
    DiagnosticCollectionOptions,
    DiagnosticContext,
    IDiagnosticCollector
} from './diagnostics/types';
