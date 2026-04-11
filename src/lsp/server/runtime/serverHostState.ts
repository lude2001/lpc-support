let workspaceRoots: string[] = [];

export function getServerWorkspaceRoots(): string[] {
    return [...workspaceRoots];
}

export function setServerWorkspaceRoots(nextRoots: readonly string[]): void {
    workspaceRoots = normalizeServerWorkspaceRoots(nextRoots);
}

export function normalizeServerWorkspaceRoots(nextRoots: readonly string[]): string[] {
    const normalizedRoots: string[] = [];
    const seenRoots = new Set<string>();

    for (const workspaceRoot of nextRoots) {
        const normalizedRoot = normalizeServerWorkspaceRoot(workspaceRoot);
        if (!normalizedRoot || seenRoots.has(normalizedRoot)) {
            continue;
        }

        seenRoots.add(normalizedRoot);
        normalizedRoots.push(normalizedRoot);
    }

    return normalizedRoots;
}

export function normalizeServerWorkspaceRoot(workspaceRoot: string): string {
    const normalizedRoot = workspaceRoot.replace(/\\/g, '/');

    if (normalizedRoot === '/') {
        return normalizedRoot;
    }

    if (/^[A-Za-z]:\/?$/.test(normalizedRoot)) {
        return `${normalizedRoot[0]}:/`;
    }

    return normalizedRoot.replace(/\/+$/, '');
}
