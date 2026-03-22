import { spawn } from 'child_process';
import { LocalCompilationRequest, LpccpCompilationResponse } from './types';

export class LocalLpccpCompilationBackend {
    public async compile(request: LocalCompilationRequest): Promise<LpccpCompilationResponse> {
        const command = this.resolveCommand(request);

        return new Promise<LpccpCompilationResponse>((resolve, reject) => {
            const child = spawn(
                command,
                [request.localConfig.driverConfigPath!, request.targetPath],
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
                if (code === 2) {
                    reject(new Error(stderr.trim() || 'lpccp request failed'));
                    return;
                }

                try {
                    const parsed = JSON.parse(stdout) as LpccpCompilationResponse;
                    resolve(parsed);
                } catch {
                    reject(new Error('lpccp returned invalid JSON'));
                }
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
}
