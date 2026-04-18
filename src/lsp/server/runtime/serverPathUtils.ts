export function fromFileUri(uri: string): string {
    if (!uri.startsWith('file://')) {
        return uri;
    }

    const decoded = decodeURIComponent(uri.replace(/^file:\/\/+/, '/'));
    return decoded.replace(/^\/([A-Za-z]:\/)/, '$1');
}

export function normalizeComparablePath(path: string): string {
    const normalizedPath = path
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');

    return isWindowsDrivePath(normalizedPath)
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}

export function isPathPrefix(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(`${root}/`);
}

export function resolveWorkspaceRootFromRoots(documentUri: string | undefined, roots: string[]): string {
    if (roots.length === 0) {
        return '';
    }

    if (!documentUri) {
        return roots[0];
    }

    const normalizedDocumentPath = normalizeComparablePath(fromFileUri(documentUri));
    const matchedWorkspaceRoot = roots.reduce<string | undefined>((bestMatch, root) => {
        const normalizedRoot = normalizeComparablePath(root);
        if (!isPathPrefix(normalizedRoot, normalizedDocumentPath)) {
            return bestMatch;
        }

        if (!bestMatch) {
            return root;
        }

        return normalizedRoot.length > normalizeComparablePath(bestMatch).length ? root : bestMatch;
    }, undefined);

    return matchedWorkspaceRoot ?? roots[0];
}

function isWindowsDrivePath(path: string): boolean {
    return /^[A-Za-z]:\//.test(path);
}
