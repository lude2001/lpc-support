import * as path from 'path';

export interface IncludePathResolutionOptions {
    documentPath: string;
    includePath: string;
    isSystemInclude: boolean;
    workspaceRoot?: string;
    includeDirectories?: readonly string[];
}

export function resolveIncludePathCandidates(options: IncludePathResolutionOptions): string[] {
    const normalizedPath = ensureHeaderOrSourceExtension(options.includePath);
    const includeDirectories = options.includeDirectories ?? [];

    if (options.isSystemInclude) {
        const directories = includeDirectories.length > 0
            ? includeDirectories
            : options.workspaceRoot
                ? [path.join(options.workspaceRoot, 'include')]
                : [];
        return directories.map((includeDirectory) => path.join(includeDirectory, normalizedPath));
    }

    if (isLpcAbsolutePath(normalizedPath)) {
        if (!options.workspaceRoot) {
            return [];
        }

        return [path.join(options.workspaceRoot, normalizedPath.substring(1))];
    }

    if (path.isAbsolute(normalizedPath)) {
        return [normalizedPath];
    }

    return [path.resolve(path.dirname(normalizeFsPath(options.documentPath)), normalizedPath)];
}

export function ensureHeaderOrSourceExtension(filePath: string): string {
    if (filePath.endsWith('.h') || filePath.endsWith('.c')) {
        return filePath;
    }

    return `${filePath}.h`;
}

function isLpcAbsolutePath(filePath: string): boolean {
    return filePath.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(filePath.slice(1));
}

function normalizeFsPath(fsPath: string): string {
    return fsPath.replace(/^\/+([A-Za-z]:[\\/])/, '$1');
}
