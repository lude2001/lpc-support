export interface WorkspaceFileState {
    readonly uri: string;
    readonly openVersion?: number;
    readonly workspaceConfigGeneration: number;
    readonly dirty: boolean;
    readonly maybeStale: boolean;
    readonly deleted: boolean;
    readonly lastChangedAt: number;
    readonly lastDiagnosticDependencyFootprint: readonly string[];
    readonly lastDependencyFootprint: readonly string[];
    readonly lastTargetDependencyFootprint: readonly string[];
}

export type WorkspaceDiskChangeType = 'created' | 'changed' | 'deleted';

export class WorkspaceChangeIndex {
    private readonly states = new Map<string, WorkspaceFileState>();
    private lastChangeTimestamp = 0;
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
        const state = this.update(uri, {
            openVersion: existing?.openVersion,
            dirty: true,
            deleted: changeType === 'deleted'
        });
        this.markAffectedOpenDocumentsMaybeStale(uri);
        return state;
    }

    public markDeleted(uri: string): WorkspaceFileState {
        return this.update(uri, {
            openVersion: undefined,
            dirty: true,
            deleted: true
        });
    }

    public markClean(uri: string, expectedLastChangedAt?: number): WorkspaceFileState | undefined {
        const existing = this.states.get(uri);
        if (!existing) {
            return undefined;
        }
        if (expectedLastChangedAt !== undefined && existing.lastChangedAt !== expectedLastChangedAt) {
            return existing;
        }

        const next = {
            ...existing,
            workspaceConfigGeneration: this.workspaceConfigGeneration,
            dirty: false,
            maybeStale: false
        };
        this.states.set(uri, next);
        return next;
    }

    public recordDependencyFootprint(ownerUri: string, dependencies: readonly string[]): WorkspaceFileState {
        const existing = this.states.get(ownerUri);
        const next: WorkspaceFileState = {
            uri: ownerUri,
            openVersion: existing?.openVersion,
            workspaceConfigGeneration: this.workspaceConfigGeneration,
            dirty: existing?.dirty ?? false,
            maybeStale: false,
            deleted: existing?.deleted ?? false,
            lastChangedAt: existing?.lastChangedAt ?? this.nextLastChangedAt(),
            lastDiagnosticDependencyFootprint: normalizeUniqueUris(dependencies),
            lastDependencyFootprint: normalizeUniqueUris([
                ...dependencies,
                ...(existing?.lastTargetDependencyFootprint ?? [])
            ]),
            lastTargetDependencyFootprint: existing?.lastTargetDependencyFootprint ?? []
        };
        this.states.set(ownerUri, next);
        return next;
    }

    public addDependencyFootprint(ownerUri: string, dependencies: readonly string[]): WorkspaceFileState {
        const existing = this.states.get(ownerUri);
        const targetDependencies = normalizeUniqueUris([
            ...(existing?.lastTargetDependencyFootprint ?? []),
            ...dependencies
        ]);
        const next: WorkspaceFileState = {
            uri: ownerUri,
            openVersion: existing?.openVersion,
            workspaceConfigGeneration: this.workspaceConfigGeneration,
            dirty: existing?.dirty ?? false,
            maybeStale: existing?.maybeStale ?? false,
            deleted: existing?.deleted ?? false,
            lastChangedAt: existing?.lastChangedAt ?? this.nextLastChangedAt(),
            lastDiagnosticDependencyFootprint: existing?.lastDiagnosticDependencyFootprint ?? [],
            lastDependencyFootprint: normalizeUniqueUris([
                ...(existing?.lastDiagnosticDependencyFootprint ?? []),
                ...targetDependencies
            ]),
            lastTargetDependencyFootprint: targetDependencies
        };
        this.states.set(ownerUri, next);
        return next;
    }

    public getMaybeStaleOpenUris(): string[] {
        return Array.from(this.states.values())
            .filter(state => state.openVersion !== undefined && state.maybeStale)
            .map(state => state.uri);
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
        this.lastChangeTimestamp = 0;
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
        const existing = this.states.get(uri);
        const next: WorkspaceFileState = {
            uri,
            openVersion: patch.openVersion,
            workspaceConfigGeneration: this.workspaceConfigGeneration,
            dirty: patch.dirty,
            maybeStale: existing?.maybeStale ?? false,
            deleted: patch.deleted,
            lastChangedAt: this.nextLastChangedAt(),
            lastDiagnosticDependencyFootprint: existing?.lastDiagnosticDependencyFootprint ?? [],
            lastDependencyFootprint: existing?.lastDependencyFootprint ?? [],
            lastTargetDependencyFootprint: existing?.lastTargetDependencyFootprint ?? []
        };
        this.states.set(uri, next);
        return next;
    }

    private markAffectedOpenDocumentsMaybeStale(changedUri: string): void {
        const normalizedChangedUri = normalizeUri(changedUri);
        for (const state of this.states.values()) {
            if (
                state.openVersion === undefined
                || normalizeUri(state.uri) === normalizedChangedUri
                || !state.lastDependencyFootprint.some(dependencyUri => normalizeUri(dependencyUri) === normalizedChangedUri)
            ) {
                continue;
            }

            this.states.set(state.uri, {
                ...state,
                maybeStale: true,
                lastChangedAt: this.nextLastChangedAt()
            });
        }
    }

    private nextLastChangedAt(): number {
        this.lastChangeTimestamp = Math.max(Date.now(), this.lastChangeTimestamp + 1);
        return this.lastChangeTimestamp;
    }
}

function normalizeUniqueUris(uris: readonly string[]): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const uri of uris) {
        const normalized = normalizeUri(uri);
        if (seen.has(normalized)) {
            continue;
        }

        seen.add(normalized);
        result.push(uri);
    }

    return result;
}

function normalizeUri(uri: string): string {
    return uri.replace(/\\/g, '/').toLowerCase();
}
