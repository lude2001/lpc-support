export interface WorkspaceFileState {
    readonly uri: string;
    readonly openVersion?: number;
    readonly workspaceConfigGeneration: number;
    readonly dirty: boolean;
    readonly deleted: boolean;
    readonly lastChangedAt: number;
}

export type WorkspaceDiskChangeType = 'created' | 'changed' | 'deleted';

export class WorkspaceChangeIndex {
    private readonly states = new Map<string, WorkspaceFileState>();
    private workspaceConfigGeneration = 0;

    public markOpened(uri: string, version: number): WorkspaceFileState {
        return this.update(uri, {
            openVersion: version,
            dirty: true,
            deleted: false
        });
    }

    public markChanged(uri: string, version: number): WorkspaceFileState {
        return this.update(uri, {
            openVersion: version,
            dirty: true,
            deleted: false
        });
    }

    public markClosed(uri: string): WorkspaceFileState {
        return this.update(uri, {
            openVersion: undefined,
            dirty: true,
            deleted: false
        });
    }

    public markDiskChanged(uri: string, changeType: WorkspaceDiskChangeType): WorkspaceFileState {
        const existing = this.states.get(uri);
        return this.update(uri, {
            openVersion: existing?.openVersion,
            dirty: true,
            deleted: changeType === 'deleted'
        });
    }

    public markDeleted(uri: string): WorkspaceFileState {
        return this.update(uri, {
            openVersion: undefined,
            dirty: true,
            deleted: true
        });
    }

    public markClean(uri: string): WorkspaceFileState | undefined {
        const existing = this.states.get(uri);
        if (!existing) {
            return undefined;
        }

        const next = {
            ...existing,
            dirty: false
        };
        this.states.set(uri, next);
        return next;
    }

    public get(uri: string): WorkspaceFileState | undefined {
        const state = this.states.get(uri);
        return state ? { ...state } : undefined;
    }

    public nextWorkspaceConfigGeneration(): number {
        this.workspaceConfigGeneration += 1;
        return this.workspaceConfigGeneration;
    }

    public getWorkspaceConfigGeneration(): number {
        return this.workspaceConfigGeneration;
    }

    public clear(): void {
        this.states.clear();
        this.workspaceConfigGeneration = 0;
    }

    private update(
        uri: string,
        patch: {
            openVersion?: number;
            dirty: boolean;
            deleted: boolean;
        }
    ): WorkspaceFileState {
        const next: WorkspaceFileState = {
            uri,
            openVersion: patch.openVersion,
            workspaceConfigGeneration: this.workspaceConfigGeneration,
            dirty: patch.dirty,
            deleted: patch.deleted,
            lastChangedAt: Date.now()
        };
        this.states.set(uri, next);
        return next;
    }
}
