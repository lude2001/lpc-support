import * as path from 'path';
import * as vscode from 'vscode';
import { parseFunctionDocs } from './docParser';
import type { EfunDoc } from './types';

export class SimulatedEfunScanner {
    private static readonly SIMULATED_EFUNS_PATH_CONFIG = 'lpc.simulatedEfunsPath';
    private docs: Map<string, EfunDoc> = new Map();

    public get(name: string): EfunDoc | undefined {
        return this.docs.get(name);
    }

    public getAllNames(): string[] {
        return Array.from(this.docs.keys());
    }

    public async configure(): Promise<void> {
        return this.configureSimulatedEfuns();
    }

    public async load(): Promise<void> {
        return this.loadSimulatedEfuns();
    }

    public async configureSimulatedEfuns(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择模拟函数库目录'
        };

        const folders = await vscode.window.showOpenDialog(options);
        if (!folders || !folders[0]) {
            return;
        }

        await vscode.workspace.getConfiguration().update(
            SimulatedEfunScanner.SIMULATED_EFUNS_PATH_CONFIG,
            folders[0].fsPath,
            vscode.ConfigurationTarget.Global
        );

        await this.loadSimulatedEfuns();
        vscode.window.showInformationMessage('模拟函数库目录已更新');
    }

    public async loadSimulatedEfuns(): Promise<void> {
        this.docs.clear();

        const config = vscode.workspace.getConfiguration();
        const configPath = config.get<string>(SimulatedEfunScanner.SIMULATED_EFUNS_PATH_CONFIG);

        if (!configPath) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const simulatedEfunsPath = this.resolveProjectPath(workspaceFolder.uri.fsPath, configPath);

        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}')
            );

            this.docs.clear();

            for (const file of files) {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const functionDocs = parseFunctionDocs(text, '模拟函数库', { isSimulated: true });

                for (const [funcName, doc] of functionDocs) {
                    this.docs.set(funcName, doc);
                }
            }
        } catch (error) {
            console.error('加载模拟函数库文档失败:', error);
        }
    }

    public resolveProjectPath(workspaceRoot: string, configPath: string): string {
        if (path.isAbsolute(configPath)) {
            return configPath;
        }

        return path.join(workspaceRoot, configPath);
    }
}
