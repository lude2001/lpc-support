import type { LpcCompileLocalConfig, LpcCompileRemoteConfig } from '../projectConfig/LpcProjectConfig';

export type CompilationMode = 'local' | 'remote';
export type CompilationTargetKind = 'file' | 'directory';

export interface CompilationDiagnostic {
    severity: string;
    file: string;
    line?: number;
    message: string;
}

export interface LpccpDirectoryFileResult {
    file: string;
    ok: boolean;
    diagnostics: CompilationDiagnostic[];
}

export interface LpccpFileResponse {
    version: number;
    ok: boolean;
    kind: 'file';
    target: string;
    diagnostics: CompilationDiagnostic[];
    files_total: number;
    files_ok: number;
    files_failed: number;
    results: LpccpDirectoryFileResult[];
}

export interface LpccpDirectoryResponse {
    version: number;
    ok: boolean;
    kind: 'directory';
    target: string;
    diagnostics: CompilationDiagnostic[];
    files_total: number;
    files_ok: number;
    files_failed: number;
    results: LpccpDirectoryFileResult[];
}

export type LpccpCompilationResponse = LpccpFileResponse | LpccpDirectoryResponse;

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
