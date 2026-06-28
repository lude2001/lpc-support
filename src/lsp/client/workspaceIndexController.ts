import * as vscode from 'vscode';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import { createWorkspaceConfigSyncPayload } from './bridges/configurationBridge';
import { LspClientManager } from './LspClientManager';
import {
    WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
    type WorkspaceIndexProgressPayload,
    WORKSPACE_INDEX_REBUILD_REQUEST,
    type WorkspaceIndexRebuildResult
} from '../shared/protocol/workspaceIndex';
import type { WorkspaceConfigSyncPayload } from '../shared/protocol/workspaceConfigSync';

const REBUILD_COMMAND = 'lpc.rebuildWorkspaceIndex';
const PROMPT_CHOICE_BUILD = '构建索引';
const PROMPT_CHOICE_LATER = '稍后';

export interface WorkspaceIndexControllerOptions {
    readonly context: vscode.ExtensionContext;
    readonly manager: LspClientManager;
    readonly projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'loadForWorkspace'>;
}

export function registerWorkspaceIndexController(options: WorkspaceIndexControllerOptions): vscode.Disposable {
    const controller = new WorkspaceIndexController(options);
    options.context.subscriptions.push(controller);
    return controller;
}

class WorkspaceIndexController implements vscode.Disposable {
    private readonly statusBarItem: vscode.StatusBarItem;
    private readonly disposables: vscode.Disposable[] = [];
    private running = false;

    public constructor(private readonly options: WorkspaceIndexControllerOptions) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
        this.statusBarItem.command = REBUILD_COMMAND;
        this.setIdleStatus();
        this.statusBarItem.show();

        this.disposables.push(this.statusBarItem);
        this.disposables.push(vscode.commands.registerCommand(REBUILD_COMMAND, () => this.rebuild()));
        this.disposables.push(this.options.manager.onNotification(
            WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
            (payload) => this.updateProgressStatus(payload)
        ));
        void this.promptForInitialBuild();
    }

    public dispose(): void {
        for (const disposable of this.disposables.splice(0).reverse()) {
            disposable.dispose();
        }
    }

    private async promptForInitialBuild(): Promise<void> {
        const configuredWorkspaceRoots = await this.getConfiguredWorkspaceRoots();
        if (configuredWorkspaceRoots.length === 0) {
            return;
        }

        const unpromptedRoots = configuredWorkspaceRoots
            .filter(root => !this.options.context.workspaceState.get<boolean>(promptKey(root)));
        if (unpromptedRoots.length === 0) {
            return;
        }

        for (const root of unpromptedRoots) {
            await this.options.context.workspaceState.update(promptKey(root), true);
        }

        const choice = await vscode.window.showInformationMessage(
            '是否预热 LPC 工作区索引，以提升首次跳转、header owner 识别和诊断刷新体验？',
            PROMPT_CHOICE_BUILD,
            PROMPT_CHOICE_LATER
        );
        if (choice === PROMPT_CHOICE_BUILD) {
            await this.rebuild();
        }
    }

    private async rebuild(): Promise<void> {
        if (this.running) {
            vscode.window.showInformationMessage('LPC 工作区索引正在构建中。');
            return;
        }

        const payload = await this.createWorkspaceIndexPayload();
        if (payload.workspaceRoots.length === 0) {
            vscode.window.showWarningMessage('没有可索引的 LPC 工作区。');
            return;
        }

        this.running = true;
        this.setBuildingStatus();
        try {
            const result = await this.options.manager.sendRequest<WorkspaceIndexRebuildResult>(
                WORKSPACE_INDEX_REBUILD_REQUEST,
                payload
            );
            if (!result) {
                throw new Error('LSP server did not return a workspace index result.');
            }

            this.setReadyStatus(result);
            vscode.window.showInformationMessage(
                `LPC 工作区索引已构建：${result.indexedFiles}/${result.totalFiles} 个文件，跳过 ${result.skippedFiles} 个，失败 ${result.failedFiles} 个。`
            );
        } catch (error) {
            this.setErrorStatus(error);
            vscode.window.showErrorMessage(`LPC 工作区索引构建失败：${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.running = false;
        }
    }

    private setIdleStatus(): void {
        this.statusBarItem.text = '$(database) LPC Index';
        this.statusBarItem.tooltip = '点击重建 LPC 工作区预热索引';
    }

    private setBuildingStatus(): void {
        this.statusBarItem.text = '$(sync~spin) LPC Index';
        this.statusBarItem.tooltip = '正在构建 LPC 工作区预热索引';
    }

    private updateProgressStatus(payload: unknown): void {
        if (!this.running || !isWorkspaceIndexProgressPayload(payload)) {
            return;
        }

        this.statusBarItem.text = `$(sync~spin) LPC Index: ${payload.processedFiles}/${payload.totalFiles}`;
        this.statusBarItem.tooltip = [
            `正在构建 LPC 工作区预热索引：${payload.processedFiles}/${payload.totalFiles} 个文件。`,
            `已索引 ${payload.indexedFiles} 个，跳过 ${payload.skippedFiles} 个，失败 ${payload.failedFiles} 个。`
        ].join('\n');
    }

    private setReadyStatus(result: WorkspaceIndexRebuildResult): void {
        this.statusBarItem.text = '$(database) LPC Index: Ready';
        this.statusBarItem.tooltip = `LPC 工作区预热索引已就绪：${result.indexedFiles}/${result.totalFiles} 个文件，耗时 ${result.durationMs}ms。点击可重建。`;
    }

    private setErrorStatus(error: unknown): void {
        this.statusBarItem.text = '$(warning) LPC Index: Error';
        this.statusBarItem.tooltip = `LPC 工作区预热索引构建失败：${error instanceof Error ? error.message : String(error)}。点击可重试。`;
    }

    private async createWorkspaceIndexPayload(): Promise<WorkspaceConfigSyncPayload> {
        const configuredRoots = await this.getConfiguredWorkspaceRoots();
        const configuredRootSet = new Set(configuredRoots.map(normalizeWorkspaceRoot));
        const payload = await createWorkspaceConfigSyncPayload(this.options.projectConfigService);

        return {
            workspaceRoots: payload.workspaceRoots.filter(root => configuredRootSet.has(normalizeWorkspaceRoot(root))),
            workspaces: payload.workspaces.filter(workspace =>
                configuredRootSet.has(normalizeWorkspaceRoot(workspace.workspaceRoot))
            )
        };
    }

    private async getConfiguredWorkspaceRoots(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
        const roots: string[] = [];

        for (const folder of workspaceFolders) {
            try {
                const config = await this.options.projectConfigService.loadForWorkspace(folder.uri.fsPath);
                if (config) {
                    roots.push(folder.uri.fsPath);
                }
            } catch {
                // A workspace that cannot load lpc-support.json should not trigger LPC indexing UX.
            }
        }

        return roots;
    }
}

function promptKey(workspaceRoot: string): string {
    return `lpc.workspaceIndex.prompted.${normalizeWorkspaceRoot(workspaceRoot)}`;
}

function normalizeWorkspaceRoot(workspaceRoot: string): string {
    return workspaceRoot.replace(/\\/g, '/').toLowerCase();
}

function isWorkspaceIndexProgressPayload(payload: unknown): payload is WorkspaceIndexProgressPayload {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const progress = payload as Partial<WorkspaceIndexProgressPayload>;
    return progress.status === 'building'
        && typeof progress.totalFiles === 'number'
        && typeof progress.processedFiles === 'number'
        && typeof progress.indexedFiles === 'number'
        && typeof progress.skippedFiles === 'number'
        && typeof progress.failedFiles === 'number';
}
