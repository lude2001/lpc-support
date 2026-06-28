import * as path from 'path';
import * as vscode from 'vscode';
import type { LanguageWorkspaceProjectConfig } from '../language/contracts/LanguageWorkspaceContext';
import type { LpcProjectConfigService } from './LpcProjectConfigService';

export class LpcProjectConfigSnapshotService implements vscode.Disposable {
    private readonly snapshots = new Map<string, LanguageWorkspaceProjectConfig>();
    private readonly disposables: vscode.Disposable[] = [];
    private readonly watcherDisposables = new Map<string, vscode.Disposable[]>();

    constructor(
        private readonly projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'loadForWorkspace'>
    ) {}

    public async start(): Promise<void> {
        await this.refreshAllWorkspaceSnapshots();

        if (typeof vscode.workspace.onDidChangeWorkspaceFolders === 'function') {
            this.disposables.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
                void this.refreshAllWorkspaceSnapshots();
            }));
        }
    }

    public getWorkspaceProjectConfig(workspaceRoot: string): LanguageWorkspaceProjectConfig | undefined {
        const snapshot = this.snapshots.get(normalizeWorkspacePath(workspaceRoot));
        return snapshot ? cloneProjectConfig(snapshot) : undefined;
    }

    public async refreshAllWorkspaceSnapshots(): Promise<void> {
        const workspaceRoots = getWorkspaceRoots();
        const nextRoots = new Set(workspaceRoots);

        for (const workspaceRoot of this.snapshots.keys()) {
            if (!nextRoots.has(workspaceRoot)) {
                this.snapshots.delete(workspaceRoot);
            }
        }

        await Promise.all(workspaceRoots.map((workspaceRoot) => this.refreshWorkspaceSnapshot(workspaceRoot)));
        this.refreshWatchers(workspaceRoots);
    }

    public async refreshWorkspaceSnapshot(workspaceRoot: string): Promise<void> {
        const normalizedWorkspaceRoot = normalizeWorkspacePath(workspaceRoot);
        const projectConfigPath = normalizeWorkspacePath(
            this.projectConfigService.getProjectConfigPath(normalizedWorkspaceRoot)
        );

        try {
            const projectConfig = await this.projectConfigService.loadForWorkspace(normalizedWorkspaceRoot);
            this.snapshots.set(normalizedWorkspaceRoot, {
                projectConfigPath,
                configHellPath: projectConfig?.configHellPath,
                instanceResolutionFunctions: cloneInstanceResolutionFunctions(projectConfig?.instanceResolutionFunctions),
                resolvedConfig: projectConfig?.resolved,
                lastSyncedAt: projectConfig?.lastSyncedAt
            });
        } catch {
            this.snapshots.set(normalizedWorkspaceRoot, {
                projectConfigPath
            });
        }
    }

    public dispose(): void {
        for (const disposable of this.disposables.splice(0).reverse()) {
            disposable.dispose();
        }

        for (const disposableList of this.watcherDisposables.values()) {
            disposeAll(disposableList);
        }
        this.watcherDisposables.clear();
        this.snapshots.clear();
    }

    private refreshWatchers(workspaceRoots: string[]): void {
        if (typeof vscode.workspace.createFileSystemWatcher !== 'function') {
            return;
        }

        const nextRoots = new Set(workspaceRoots);
        for (const [workspaceRoot, disposableList] of this.watcherDisposables.entries()) {
            if (!nextRoots.has(workspaceRoot)) {
                disposeAll(disposableList);
                this.watcherDisposables.delete(workspaceRoot);
            }
        }

        for (const workspaceRoot of workspaceRoots) {
            const watchedPaths = this.getWatchedPaths(workspaceRoot);
            const existing = this.watcherDisposables.get(workspaceRoot);
            const existingPaths = new Set(
                (existing ?? [])
                    .map((entry) => (entry as vscode.Disposable & { __watchedPath?: string }).__watchedPath)
                    .filter((entry): entry is string => Boolean(entry))
            );

            if (setsEqual(existingPaths, watchedPaths)) {
                continue;
            }

            if (existing) {
                disposeAll(existing);
            }

            this.watcherDisposables.set(
                workspaceRoot,
                [...watchedPaths].map((watchedPath) => this.createWatchedFileDisposable(workspaceRoot, watchedPath))
            );
        }
    }

    private getWatchedPaths(workspaceRoot: string): Set<string> {
        const snapshot = this.snapshots.get(workspaceRoot);
        const paths = new Set<string>([
            normalizeWorkspacePath(this.projectConfigService.getProjectConfigPath(workspaceRoot))
        ]);

        if (snapshot?.configHellPath) {
            paths.add(normalizeWorkspacePath(path.resolve(workspaceRoot, snapshot.configHellPath)));
        }

        return paths;
    }

    private createWatchedFileDisposable(workspaceRoot: string, watchedPath: string): vscode.Disposable {
        const watcher = vscode.workspace.createFileSystemWatcher(watchedPath);
        const refresh = (): void => {
            void this.refreshWorkspaceSnapshot(workspaceRoot).then(() => {
                this.refreshWatchers(getWorkspaceRoots());
            });
        };

        watcher.onDidChange(refresh);
        watcher.onDidCreate(refresh);
        watcher.onDidDelete(refresh);

        return Object.assign(watcher, { __watchedPath: watchedPath });
    }
}

function getWorkspaceRoots(): string[] {
    const roots = (vscode.workspace.workspaceFolders ?? [])
        .map((folder) => normalizeWorkspacePath(folder.uri.fsPath));
    return [...new Set(roots)];
}

function cloneProjectConfig(config: LanguageWorkspaceProjectConfig): LanguageWorkspaceProjectConfig {
    return {
        ...config,
        instanceResolutionFunctions: cloneInstanceResolutionFunctions(config.instanceResolutionFunctions),
        resolvedConfig: config.resolvedConfig
            ? {
                ...config.resolvedConfig,
                includeDirectories: config.resolvedConfig.includeDirectories
                    ? [...config.resolvedConfig.includeDirectories]
                    : undefined
            }
            : undefined
    };
}

function cloneInstanceResolutionFunctions(
    functions: LanguageWorkspaceProjectConfig['instanceResolutionFunctions']
): LanguageWorkspaceProjectConfig['instanceResolutionFunctions'] {
    if (!functions) {
        return undefined;
    }

    return Object.fromEntries(
        Object.entries(functions)
            .filter(([, objectPaths]) => Array.isArray(objectPaths))
            .map(([functionName, objectPaths]) => [functionName, [...objectPaths]])
    );
}

function disposeAll(disposables: vscode.Disposable[]): void {
    for (const disposable of disposables.splice(0).reverse()) {
        disposable.dispose();
    }
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
