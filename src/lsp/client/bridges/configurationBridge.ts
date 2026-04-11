import * as vscode from 'vscode';
import * as path from 'path';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';
import {
    WORKSPACE_CONFIG_SYNC_NOTIFICATION,
    type WorkspaceConfigSyncPayload
} from '../../shared/protocol/workspaceConfigSync';

export { WORKSPACE_CONFIG_SYNC_NOTIFICATION };
export type { WorkspaceConfigSyncPayload } from '../../shared/protocol/workspaceConfigSync';

export interface ConfigurationBridgeClient {
    sendNotification(method: string, payload: WorkspaceConfigSyncPayload): void | Promise<void>;
}

export interface ConfigurationBridgeOptions {
    client: ConfigurationBridgeClient;
    projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'loadForWorkspace'>;
    onError?: (error: Error) => void;
}

export async function initializeConfigurationBridge(
    options: ConfigurationBridgeOptions
): Promise<vscode.Disposable> {
    const { client, projectConfigService } = options;

    const watcherDisposables = new Map<string, vscode.Disposable[]>();
    const disposables: vscode.Disposable[] = [];
    const reportError = createErrorReporter(options.onError);

    const resync = async (): Promise<void> => {
        const payload = await syncWorkspaceConfiguration(client, projectConfigService);
        refreshFileWatchers(payload, watcherDisposables, () => attemptResync(resync, reportError));
    };

    await resync();

    disposables.push(vscode.workspace.onDidChangeConfiguration(() => attemptResync(resync, reportError)));
    disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => attemptResync(resync, reportError)));

    return {
        dispose(): void {
            disposeWatchers(watcherDisposables);
            for (const disposable of disposables.splice(0).reverse()) {
                disposable.dispose();
            }
        }
    };
}

async function syncWorkspaceConfiguration(
    client: ConfigurationBridgeClient,
    projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'loadForWorkspace'>
) : Promise<WorkspaceConfigSyncPayload> {
    const payload = await createWorkspaceConfigSyncPayload(projectConfigService);
    await client.sendNotification(WORKSPACE_CONFIG_SYNC_NOTIFICATION, payload);
    return payload;
}

async function createWorkspaceConfigSyncPayload(
    projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'loadForWorkspace'>
): Promise<WorkspaceConfigSyncPayload> {
    const workspaceRoots = normalizeWorkspaceRoots(
        (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.fsPath)
    );
    const workspaces = await Promise.all(workspaceRoots.map(async workspaceRoot => {
        const projectConfig = await projectConfigService.loadForWorkspace(workspaceRoot);

        return {
            workspaceRoot,
            projectConfigPath: normalizeWorkspacePath(projectConfigService.getProjectConfigPath(workspaceRoot)),
            configHellPath: projectConfig?.configHellPath,
            resolvedConfig: projectConfig?.resolved,
            lastSyncedAt: projectConfig?.lastSyncedAt
        };
    }));

    return {
        workspaceRoots,
        workspaces
    };
}

async function attemptResync(
    resync: () => Promise<void>,
    reportError: (error: Error) => void
): Promise<void> {
    try {
        await resync();
    } catch (error) {
        reportError(asError(error));
    }
}

function createErrorReporter(onError?: (error: Error) => void): (error: Error) => void {
    if (onError) {
        return onError;
    }

    return (error: Error) => {
        console.error('[lsp] Failed to synchronize workspace configuration', error);
    };
}

function refreshFileWatchers(
    payload: WorkspaceConfigSyncPayload,
    watcherDisposables: Map<string, vscode.Disposable[]>,
    onRelevantFileChanged: () => Promise<void>
): void {
    const nextWorkspaceRoots = new Set(payload.workspaceRoots);

    for (const [workspaceRoot, existingDisposables] of watcherDisposables.entries()) {
        if (nextWorkspaceRoots.has(workspaceRoot)) {
            continue;
        }

        disposeDisposableList(existingDisposables);
        watcherDisposables.delete(workspaceRoot);
    }

    for (const workspace of payload.workspaces) {
        const watchedPaths = new Set<string>([normalizeWorkspacePath(workspace.projectConfigPath)]);
        if (workspace.configHellPath) {
            watchedPaths.add(normalizeWorkspacePath(path.resolve(workspace.workspaceRoot, workspace.configHellPath)));
        }

        const existing = watcherDisposables.get(workspace.workspaceRoot);
        const existingPaths = new Set(
            (existing ?? [])
                .map(disposable => (disposable as vscode.Disposable & { __watchedPath?: string }).__watchedPath)
                .filter((entry): entry is string => Boolean(entry))
        );

        if (setsEqual(existingPaths, watchedPaths)) {
            continue;
        }

        if (existing) {
            disposeDisposableList(existing);
        }

        const nextDisposables = [...watchedPaths].map(watchedPath =>
            createWatchedFileDisposable(watchedPath, onRelevantFileChanged)
        );

        watcherDisposables.set(workspace.workspaceRoot, nextDisposables);
    }
}

function createWatchedFileDisposable(
    watchedPath: string,
    onRelevantFileChanged: () => Promise<void>
): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(normalizeGlobPath(watchedPath));
    watcher.onDidChange(onRelevantFileChanged);
    watcher.onDidCreate(onRelevantFileChanged);
    watcher.onDidDelete(onRelevantFileChanged);
    return Object.assign(watcher, { __watchedPath: watchedPath });
}

function disposeWatchers(watcherDisposables: Map<string, vscode.Disposable[]>): void {
    for (const disposableList of watcherDisposables.values()) {
        disposeDisposableList(disposableList);
    }

    watcherDisposables.clear();
}

function disposeDisposableList(disposables: vscode.Disposable[]): void {
    for (const disposable of disposables) {
        disposable.dispose();
    }
}

function normalizeGlobPath(targetPath: string): string {
    return normalizeWorkspacePath(targetPath);
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
    if (left.size !== right.size) {
        return false;
    }

    for (const entry of left) {
        if (!right.has(entry)) {
            return false;
        }
    }

    return true;
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

function normalizeWorkspaceRoots(workspaceRoots: readonly string[]): string[] {
    const normalizedRoots: string[] = [];
    const seenRoots = new Set<string>();

    for (const workspaceRoot of workspaceRoots) {
        const normalizedRoot = normalizeWorkspacePath(workspaceRoot);
        if (!normalizedRoot || seenRoots.has(normalizedRoot)) {
            continue;
        }

        seenRoots.add(normalizedRoot);
        normalizedRoots.push(normalizedRoot);
    }

    return normalizedRoots;
}

function normalizeWorkspacePath(targetPath: string): string {
    const normalizedPath = targetPath.replace(/\\/g, '/');

    if (normalizedPath === '/') {
        return normalizedPath;
    }

    if (/^[A-Za-z]:\/?$/.test(normalizedPath)) {
        return `${normalizedPath[0]}:/`;
    }

    return normalizedPath.replace(/\/+$/, '');
}
