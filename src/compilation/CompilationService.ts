import * as path from 'path';
import * as vscode from 'vscode';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import {
    CompilationDiagnostic,
    CompilationTargetKind,
    LocalCompilationRequest,
    LpccpCompilationResponse,
    NormalizedCompilationResult,
    RemoteCompilationRequest
} from './types';

type LocalBackend = {
    compile(request: LocalCompilationRequest): Promise<LpccpCompilationResponse>;
};

type RemoteBackend = {
    compile(request: RemoteCompilationRequest): Promise<NormalizedCompilationResult>;
};

export class CompilationService {
    private readonly diagnosticCollection: vscode.DiagnosticCollection;
    private readonly outputChannel: vscode.OutputChannel;

    constructor(
        private readonly projectConfigService: LpcProjectConfigService,
        private readonly localBackend: LocalBackend,
        private readonly remoteBackend: RemoteBackend
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc');
        this.outputChannel = vscode.window.createOutputChannel('LPC Compiler');
    }

    public async compileFile(filePath: string): Promise<void> {
        if (filePath.endsWith('.h')) {
            vscode.window.showWarningMessage('头文件 (.h) 不需要单独编译。');
            return;
        }

        const request = await this.createRequest(filePath, 'file');
        if (!request) {
            return;
        }

        if (request.mode === 'local') {
            const result = await this.localBackend.compile(request.localRequest);
            this.applyLocalResult(request.workspaceRoot, result);
            return;
        }

        const result = await this.remoteBackend.compile(request.remoteRequest);
        this.applyNormalizedResult(request.workspaceRoot, result);
    }

    public async compileFolder(folderPath: string): Promise<void> {
        const request = await this.createRequest(folderPath, 'directory');
        if (!request) {
            return;
        }

        if (request.mode === 'local') {
            const result = await this.localBackend.compile(request.localRequest);
            this.applyLocalResult(request.workspaceRoot, result);
            return;
        }

        const result = await this.remoteBackend.compile(request.remoteRequest);
        this.applyNormalizedResult(request.workspaceRoot, result);
    }

    private async createRequest(targetFsPath: string, targetKind: CompilationTargetKind) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(targetFsPath));
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return undefined;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const projectConfig = await this.projectConfigService.loadForWorkspace(workspaceRoot);
        if (!projectConfig?.compile?.mode) {
            vscode.window.showErrorMessage('当前项目尚未配置编译管理');
            return undefined;
        }

        const targetPath = this.toMudPath(workspaceRoot, targetFsPath, targetKind);

        if (projectConfig.compile.mode === 'local') {
            if (!projectConfig.configHellPath) {
                vscode.window.showErrorMessage('当前项目缺少 configHellPath，无法执行本地编译');
                return undefined;
            }

            return {
                mode: 'local' as const,
                workspaceRoot,
                localRequest: {
                    workspaceRoot,
                    targetFsPath,
                    targetKind,
                    targetPath,
                    localConfig: {
                        ...projectConfig.compile.local,
                        lpccpPath: projectConfig.compile.local?.lpccpPath
                            ? this.projectConfigService.resolveWorkspacePath(
                                workspaceRoot,
                                projectConfig.compile.local.lpccpPath
                            )
                            : projectConfig.compile.local?.lpccpPath,
                        driverConfigPath: this.projectConfigService.resolveWorkspacePath(
                            workspaceRoot,
                            projectConfig.configHellPath
                        )
                    }
                }
            };
        }

        return {
            mode: 'remote' as const,
            workspaceRoot,
            remoteRequest: {
                workspaceRoot,
                targetFsPath,
                targetKind,
                targetPath,
                remoteConfig: projectConfig.compile.remote ?? { servers: [] }
            }
        };
    }

    private applyLocalResult(workspaceRoot: string, result: LpccpCompilationResponse): void {
        if (result.kind === 'file') {
            const filePath = this.fromMudPath(workspaceRoot, result.target);
            this.setDiagnosticsForFile(filePath, result.diagnostics);
            return;
        }

        for (const entry of result.results) {
            const filePath = this.fromMudPath(workspaceRoot, entry.file);
            this.setDiagnosticsForFile(filePath, entry.diagnostics);
        }
    }

    private applyNormalizedResult(workspaceRoot: string, result: NormalizedCompilationResult): void {
        for (const [mudPath, diagnostics] of result.diagnosticsByFile.entries()) {
            const filePath = this.fromMudPath(workspaceRoot, mudPath);
            this.setDiagnosticsForFile(filePath, diagnostics);
        }
    }

    private setDiagnosticsForFile(filePath: string, diagnostics: CompilationDiagnostic[]): void {
        const uri = vscode.Uri.file(filePath);
        const mapped = diagnostics.map((diagnostic) => {
            const line = Math.max((diagnostic.line ?? 1) - 1, 0);
            return new vscode.Diagnostic(
                new vscode.Range(line, 0, line, Number.MAX_VALUE),
                diagnostic.message,
                diagnostic.severity === 'warning'
                    ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Error
            );
        });

        this.diagnosticCollection.set(uri, mapped);
        this.outputChannel.appendLine(`${filePath}: ${mapped.length} diagnostics`);
    }

    private toMudPath(workspaceRoot: string, targetFsPath: string, targetKind: CompilationTargetKind): string {
        const relativePath = path.relative(workspaceRoot, targetFsPath).replace(/\\/g, '/');
        const prefixed = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

        if (targetKind === 'directory' && !prefixed.endsWith('/')) {
            return `${prefixed}/`;
        }

        return prefixed;
    }

    private fromMudPath(workspaceRoot: string, mudPath: string): string {
        return path.join(workspaceRoot, mudPath.replace(/^\/+/, '').replace(/\//g, path.sep));
    }
}
