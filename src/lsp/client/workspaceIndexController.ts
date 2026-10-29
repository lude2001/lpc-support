import * as vscode from 'vscode';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import { createWorkspaceConfigSyncPayload } from './bridges/configurationBridge';
import { LspClientManager } from './LspClientManager';
import {
    WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
    WORKSPACE_INDEX_READY_NOTIFICATION,
    type WorkspaceIndexProgressPayload,
    WORKSPACE_INDEX_REBUILD_REQUEST,
    type WorkspaceIndexRebuildResult
} from '../shared/protocol/workspaceIndex';
import type { WorkspaceConfigSyncPayload } from '../shared/protocol/workspaceConfigSync';

const REBUILD_COMMAND = 'lpc.rebuildWorkspaceIndex';
const PROMPT_CHOICE_BUILD = 'build';
const PROMPT_CHOICE_LATER = 'later';

export interface WorkspaceIndexControllerOptions {
    readonly context: vscode.ExtensionContext;
    readonly manager: LspClientManager;
    readonly projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'loadForWorkspace'>;
    readonly registerRebuildCommand: (handler: () => Promise<void>) => vscode.Disposable;
    readonly onIndexReady?: (result: WorkspaceIndexRebuildResult) => void;
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
        this.disposables.push(this.options.registerRebuildCommand(() => this.rebuild()));
        this.disposables.push(this.options.manager.onNotification(
            WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
            (payload) => this.updateProgressStatus(payload)
        ));
        this.disposables.push(this.options.manager.onNotification(
            WORKSPACE_INDEX_READY_NOTIFICATION,
            (payload) => this.handleIndexReady(payload)
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
            vscode.l10n.t('Build the LPC workspace index to improve initial navigation, header owner resolution, and diagnostic refresh?'),
            { title: vscode.l10n.t('Build index'), action: PROMPT_CHOICE_BUILD },
            { title: vscode.l10n.t('Later'), action: PROMPT_CHOICE_LATER }
        );
        if (choice?.action === PROMPT_CHOICE_BUILD) {
            await this.rebuild();
        }
    }

    private async rebuild(): Promise<void> {
        if (this.running) {
            vscode.window.showInformationMessage(vscode.l10n.t('The LPC workspace index is already being built.'));
            return;
        }

        const payload = await this.createWorkspaceIndexPayload();
        if (payload.workspaceRoots.length === 0) {
            vscode.window.showWarningMessage(vscode.l10n.t('No LPC workspace is available to index.'));
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
                throw new Error(vscode.l10n.t('LSP server did not return a workspace index result.'));
            }

            this.setReadyStatus(result);
            vscode.window.showInformationMessage(
                vscode.l10n.t('LPC workspace index built: {0}/{1} files, {2} skipped, {3} failed.', result.indexedFiles, result.totalFiles, result.skippedFiles, result.failedFiles)
            );
        } catch (error) {
            this.setErrorStatus(error);
            vscode.window.showErrorMessage(vscode.l10n.t('LPC workspace index build failed: {0}', error instanceof Error ? error.message : String(error)));
        } finally {
            this.running = false;
        }
    }

    private setIdleStatus(): void {
        this.statusBarItem.text = vscode.l10n.t('$(database) LPC Index');
        this.statusBarItem.tooltip = vscode.l10n.t('Click to rebuild the LPC workspace index');
    }

    private setBuildingStatus(): void {
        this.statusBarItem.text = vscode.l10n.t('$(sync~spin) LPC Index');
        this.statusBarItem.tooltip = vscode.l10n.t('Building the LPC workspace index');
    }

    private updateProgressStatus(payload: unknown): void {
        if (!this.running || !isWorkspaceIndexProgressPayload(payload)) {
            return;
        }

        this.statusBarItem.text = vscode.l10n.t('$(sync~spin) LPC Index: {0}/{1}', payload.processedFiles, payload.totalFiles);
        this.statusBarItem.tooltip = [
            vscode.l10n.t('Building the LPC workspace index: {0}/{1} files.', payload.processedFiles, payload.totalFiles),
            vscode.l10n.t('{0} indexed, {1} skipped, {2} failed.', payload.indexedFiles, payload.skippedFiles, payload.failedFiles)
        ].join('\n');
    }

    private setReadyStatus(result: WorkspaceIndexRebuildResult): void {
        this.statusBarItem.text = vscode.l10n.t('$(database) LPC Index: Ready');
        this.statusBarItem.tooltip = result.cachedFiles
            ? vscode.l10n.t('LPC workspace index ready: {0}/{1} files, {2} restored from cache, {3}ms. Click to rebuild.', result.indexedFiles, result.totalFiles, result.cachedFiles, result.durationMs)
            : vscode.l10n.t('LPC workspace index ready: {0}/{1} files, {2}ms. Click to rebuild.', result.indexedFiles, result.totalFiles, result.durationMs);
    }

    private handleIndexReady(payload: unknown): void {
        if (!isWorkspaceIndexReadyPayload(payload)) {
            return;
        }

        this.setReadyStatus(payload);
        this.options.onIndexReady?.(payload);
    }

    private setErrorStatus(error: unknown): void {
        this.statusBarItem.text = vscode.l10n.t('$(warning) LPC Index: Error');
        this.statusBarItem.tooltip = vscode.l10n.t('LPC workspace index build failed: {0}. Click to retry.', error instanceof Error ? error.message : String(error));
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

function isWorkspaceIndexReadyPayload(payload: unknown): payload is WorkspaceIndexRebuildResult {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const result = payload as Partial<WorkspaceIndexRebuildResult>;
    return result.status === 'ready'
        && typeof result.totalFiles === 'number'
        && typeof result.indexedFiles === 'number'
        && typeof result.skippedFiles === 'number'
        && typeof result.failedFiles === 'number'
        && typeof result.durationMs === 'number';
}
