import type { LpcCompileLocalConfig, LpcCompileRemoteConfig } from '../projectConfig/LpcProjectConfig';

export type CompilationMode = 'local' | 'remote';
export type CompilationTargetKind = 'file' | 'directory';
export type LpccpCompileMode = 'reload-loaded' | 'compile-only' | 'fresh-required';
export type LpccpFailureReason =
    | 'syntax_error'
    | 'target_not_found'
    | 'unsupported_target_kind'
    | 'reload_loaded_object_failed'
    | 'runtime_error'
    | 'service_error'
    | 'compile_timeout'
    | 'service_busy'
    | 'pipe_connect_failed'
    | 'timeout'
    | 'test_missing'
    | string;

export interface CompilationDiagnostic {
    severity: string;
    file: string;
    line?: number;
    message: string;
}

export interface LpccpRuntimeError {
    object?: string;
    program?: string;
    line?: number;
    error_type?: string;
    message: string;
    trace?: unknown[];
}

export interface LpccpSummary {
    syntax_error_count?: number;
    reload_failed_count?: number;
    runtime_error_count?: number;
    unsupported_count?: number;
    service_error_count?: number;
}

export interface LpccpDirectoryFileResult {
    file: string;
    ok: boolean;
    phase?: string;
    reason?: LpccpFailureReason;
    message?: string;
    diagnostics?: CompilationDiagnostic[];
    runtime_errors?: LpccpRuntimeError[];
}

export interface LpccpFileResponse {
    version?: number;
    ok: boolean;
    kind: 'file';
    target: string;
    phase?: string;
    reason?: LpccpFailureReason;
    message?: string;
    compile_status?: string;
    test_status?: string;
    diagnostics?: CompilationDiagnostic[];
    runtime_errors?: LpccpRuntimeError[];
    files_total?: number;
    files_ok?: number;
    files_failed?: number;
    results?: LpccpDirectoryFileResult[];
    summary?: LpccpSummary;
}

export interface LpccpDirectoryResponse {
    version?: number;
    ok: boolean;
    kind: 'directory';
    target: string;
    phase?: string;
    reason?: LpccpFailureReason;
    message?: string;
    diagnostics?: CompilationDiagnostic[];
    runtime_errors?: LpccpRuntimeError[];
    files_total?: number;
    files_ok?: number;
    files_failed?: number;
    results: LpccpDirectoryFileResult[];
    summary?: LpccpSummary;
}

export interface LpccpHeaderResponse {
    version?: number;
    ok: false;
    kind: 'header';
    target?: string;
    phase: string;
    reason: LpccpFailureReason;
    message: string;
    diagnostics?: CompilationDiagnostic[];
    runtime_errors?: LpccpRuntimeError[];
}

export interface LpccpRequestFailureResponse {
    version?: number;
    ok: false;
    kind?: undefined;
    phase: string;
    reason: LpccpFailureReason;
    message: string;
    diagnostics?: CompilationDiagnostic[];
    runtime_errors?: LpccpRuntimeError[];
}

export type LpccpCompilationResponse =
    | LpccpFileResponse
    | LpccpDirectoryResponse
    | LpccpHeaderResponse
    | LpccpRequestFailureResponse;

export interface LocalCompilationRequest {
    workspaceRoot: string;
    targetFsPath?: string;
    targetKind: CompilationTargetKind;
    targetPath: string;
    localConfig: LpcCompileLocalConfig & {
        driverConfigPath: string;
    };
}

export interface RemoteCompilationRequest {
    workspaceRoot: string;
    targetFsPath?: string;
    targetKind: CompilationTargetKind;
    targetPath: string;
    remoteConfig: LpcCompileRemoteConfig;
}

export interface NormalizedCompilationResult {
    ok: boolean;
    diagnosticsByFile: Map<string, CompilationDiagnostic[]>;
    succeededFiles?: string[];
    summary?: string;
}
