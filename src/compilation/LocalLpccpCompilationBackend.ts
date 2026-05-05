import { spawn } from 'child_process';
import { LocalCompilationRequest, LpccpCompilationResponse, LpccpCompileMode } from './types';

export class LocalLpccpCompilationBackend {
    public async compile(request: LocalCompilationRequest): Promise<LpccpCompilationResponse> {
        const command = this.resolveCommand(request);
        const args = this.createArgs(request);

        return new Promise<LpccpCompilationResponse>((resolve, reject) => {
            const child = spawn(
                command,
                args,
                { cwd: request.workspaceRoot }
            );

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (chunk) => {
                stdout += chunk.toString();
            });

            child.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });

            child.on('error', (error) => {
                reject(error);
            });

            child.on('close', (code) => {
                if (stdout.trim()) {
                    try {
                        const parsed = JSON.parse(stdout) as LpccpCompilationResponse;
                        resolve(parsed);
                        return;
                    } catch {
                        reject(new Error('lpccp returned invalid JSON'));
                        return;
                    }
                }

                if (code === 2) {
                    reject(new Error(stderr.trim() || 'lpccp request failed'));
                    return;
                }

                reject(new Error('lpccp returned invalid JSON'));
            });
        });
    }

    private resolveCommand(request: LocalCompilationRequest): string {
        if (request.localConfig.useSystemCommand) {
            return 'lpccp';
        }

        if (request.localConfig.lpccpPath) {
            return request.localConfig.lpccpPath;
        }

        throw new Error('lpccp executable path is required');
    }

    private createArgs(request: LocalCompilationRequest): string[] {
        const mode = request.localConfig.compileMode;
        const args: string[] = [];

        if (mode) {
            args.push(this.toModeFlag(mode));
        }

        args.push(request.localConfig.driverConfigPath!, request.targetPath);
        return args;
    }

    private toModeFlag(mode: LpccpCompileMode): string {
        return `--${mode}`;
    }
}
