import axios from 'axios';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    CompilationDiagnostic,
    NormalizedCompilationResult,
    RemoteCompilationRequest
} from './types';

export class RemoteCompilationBackend {
    public async compile(request: RemoteCompilationRequest): Promise<NormalizedCompilationResult> {
        const server = this.resolveServer(request);
        if (!server) {
            throw new Error('未配置远程编译服务器');
        }

        if (request.targetKind === 'directory') {
            return this.compileDirectory(server.url, request);
        }

        const fileResult = await this.compileSingleFile(server.url, request.targetPath);
        return this.normalizeFileResult(request.targetPath, fileResult.message, fileResult.ok);
    }

    private async compileDirectory(
        serverUrl: string,
        request: RemoteCompilationRequest
    ): Promise<NormalizedCompilationResult> {
        if (!request.targetFsPath) {
            throw new Error('远程目录编译缺少目标路径');
        }

        const pattern = new vscode.RelativePattern(request.targetFsPath, '**/*.c');
        const files = await vscode.workspace.findFiles(pattern);
        const diagnosticsByFile = new Map<string, CompilationDiagnostic[]>();
        const succeededFiles: string[] = [];

        for (const file of files) {
            const mudPath = this.toMudPath(request.workspaceRoot, file.fsPath);
            const result = await this.compileSingleFile(serverUrl, mudPath);
            const normalized = this.normalizeDiagnostics(mudPath, result.message);

            if (normalized.length > 0) {
                diagnosticsByFile.set(mudPath, normalized);
            } else if (result.ok) {
                succeededFiles.push(mudPath);
            }
        }

        return {
            ok: diagnosticsByFile.size === 0,
            diagnosticsByFile,
            succeededFiles,
            summary: `批量编译完成。成功: ${succeededFiles.length}, 失败: ${diagnosticsByFile.size}, 总计: ${files.length}`
        };
    }

    private async compileSingleFile(serverUrl: string, mudPath: string): Promise<{ ok: boolean; message: string }> {
        const response = await axios.post(
            `${serverUrl}/update_code/update_file`,
            { file_name: mudPath },
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        if (response.status !== 200) {
            return {
                ok: false,
                message: response.statusText
            };
        }

        const message = response.data?.msg ?? '';
        return {
            ok: message.includes('成功'),
            message
        };
    }

    private normalizeFileResult(
        mudPath: string,
        message: string,
        ok: boolean
    ): NormalizedCompilationResult {
        const diagnostics = this.normalizeDiagnostics(mudPath, message);
        const diagnosticsByFile = new Map<string, CompilationDiagnostic[]>();

        if (diagnostics.length > 0) {
            diagnosticsByFile.set(mudPath, diagnostics);
        }

        return {
            ok: ok && diagnostics.length === 0,
            diagnosticsByFile,
            succeededFiles: ok && diagnostics.length === 0 ? [mudPath] : [],
            summary: message
        };
    }

    private normalizeDiagnostics(mudPath: string, message: string): CompilationDiagnostic[] {
        const diagnostics: CompilationDiagnostic[] = [];
        const lines = message.split('\n');

        for (const line of lines) {
            const lineMatch = line.match(/line (\d+):/);
            if (!lineMatch) {
                continue;
            }

            diagnostics.push({
                severity: line.includes('Warning') ? 'warning' : 'error',
                file: mudPath,
                line: parseInt(lineMatch[1], 10),
                message: line.replace(/.*line \d+:\s*/, '')
            });
        }

        if (diagnostics.length === 0 && message && !message.includes('成功')) {
            diagnostics.push({
                severity: 'error',
                file: mudPath,
                line: 1,
                message
            });
        }

        return diagnostics;
    }

    private resolveServer(request: RemoteCompilationRequest) {
        const servers = request.remoteConfig.servers ?? [];
        if (servers.length === 0) {
            return undefined;
        }

        return servers.find((entry) => entry.name === request.remoteConfig.activeServer) ?? servers[0];
    }

    private toMudPath(workspaceRoot: string, filePath: string): string {
        const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
        return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    }
}
