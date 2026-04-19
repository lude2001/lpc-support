import type { LpcResolvedConfig } from '../../../projectConfig/LpcProjectConfig';
import type {
    LanguageWorkspaceContext,
    LanguageWorkspaceProjectConfig
} from '../../../language/contracts/LanguageWorkspaceContext';
import type { WorkspaceConfigSyncPayload } from '../../shared/protocol/workspaceConfigSync';
import {
    normalizeServerWorkspaceRoot,
    normalizeServerWorkspaceRoots,
    setServerWorkspaceRoots
} from './serverHostState';

export interface WorkspaceConfigSnapshot {
    projectConfigPath: string;
    configHellPath?: string;
    resolvedConfig?: LpcResolvedConfig;
    lastSyncedAt?: string;
}

export interface WorkspaceSessionOptions {
    workspaceRoots?: string[];
    runtimeReferences?: Record<string, unknown>;
}

export class WorkspaceSession {
    private workspaceRoots: string[];
    private readonly workspaceConfigs = new Map<string, WorkspaceConfigSnapshot>();
    private readonly runtimeReferences: Record<string, unknown>;

    public constructor(options: WorkspaceSessionOptions = {}) {
        this.workspaceRoots = normalizeServerWorkspaceRoots(options.workspaceRoots ?? []);
        this.runtimeReferences = { ...(options.runtimeReferences ?? {}) };
        setServerWorkspaceRoots(this.workspaceRoots);
    }

    public getWorkspaceRoots(): string[] {
        return [...this.workspaceRoots];
    }

    public setWorkspaceRoots(workspaceRoots: string[]): void {
        this.workspaceRoots = normalizeServerWorkspaceRoots(workspaceRoots);
        setServerWorkspaceRoots(this.workspaceRoots);
    }

    public updateWorkspaceConfig(workspaceRoot: string, snapshot: WorkspaceConfigSnapshot): void {
        this.workspaceConfigs.set(
            normalizeServerWorkspaceRoot(workspaceRoot),
            cloneWorkspaceConfigSnapshot(snapshot)
        );
    }

    public applyWorkspaceConfigSync(payload: WorkspaceConfigSyncPayload): void {
        this.workspaceRoots = normalizeServerWorkspaceRoots(payload.workspaceRoots);
        setServerWorkspaceRoots(this.workspaceRoots);

        const nextRoots = new Set(this.workspaceRoots);
        for (const workspaceRoot of this.workspaceConfigs.keys()) {
            if (!nextRoots.has(workspaceRoot)) {
                this.workspaceConfigs.delete(workspaceRoot);
            }
        }

        for (const workspace of payload.workspaces) {
            this.updateWorkspaceConfig(workspace.workspaceRoot, {
                projectConfigPath: workspace.projectConfigPath,
                configHellPath: workspace.configHellPath,
                resolvedConfig: workspace.resolvedConfig,
                lastSyncedAt: workspace.lastSyncedAt
            });
        }
    }

    public getWorkspaceConfig(workspaceRoot: string): WorkspaceConfigSnapshot | undefined {
        const snapshot = this.workspaceConfigs.get(normalizeServerWorkspaceRoot(workspaceRoot));
        return snapshot ? cloneWorkspaceConfigSnapshot(snapshot) : undefined;
    }

    public getRuntimeReference<T>(key: string): T | undefined {
        return this.runtimeReferences[key] as T | undefined;
    }

    public toLanguageWorkspaceContext(workspaceRoot: string): LanguageWorkspaceContext {
        const normalizedWorkspaceRoot = normalizeServerWorkspaceRoot(workspaceRoot);
        return {
            workspaceRoot: normalizedWorkspaceRoot,
            projectConfig: toLanguageWorkspaceProjectConfig(this.workspaceConfigs.get(normalizedWorkspaceRoot))
        };
    }
}

function cloneWorkspaceConfigSnapshot(snapshot: WorkspaceConfigSnapshot): WorkspaceConfigSnapshot {
    return {
        ...snapshot,
        projectConfigPath: normalizeServerWorkspaceRoot(snapshot.projectConfigPath),
        resolvedConfig: cloneResolvedConfig(snapshot.resolvedConfig)
    };
}

function cloneResolvedConfig(resolvedConfig: LpcResolvedConfig | undefined): LpcResolvedConfig | undefined {
    if (!resolvedConfig) {
        return undefined;
    }

    return {
        ...resolvedConfig,
        includeDirectories: resolvedConfig.includeDirectories
            ? [...resolvedConfig.includeDirectories]
            : undefined
    };
}

function toLanguageWorkspaceProjectConfig(
    snapshot: WorkspaceConfigSnapshot | undefined
): LanguageWorkspaceProjectConfig | undefined {
    return snapshot ? cloneWorkspaceConfigSnapshot(snapshot) : undefined;
}
