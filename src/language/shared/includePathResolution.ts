import * as path from 'path';

export interface IncludePathResolutionOptions {
    documentPath: string;
    includePath: string;
    isSystemInclude: boolean;
    workspaceRoot?: string;
    includeDirectories?: readonly string[];
    allowAncestorFallback?: boolean;
}

export function resolveIncludePathCandidates(options: IncludePathResolutionOptions): string[] {
    const normalizedPath = ensureHeaderOrSourceExtension(options.includePath);
    const includeDirectories = options.includeDirectories ?? [];

    if (options.isSystemInclude) {
        const directories = includeDirectories.length > 0
            ? includeDirectories
            : options.workspaceRoot
                ? [path.join(options.workspaceRoot, 'include')]
                : options.allowAncestorFallback
                    ? createAncestorIncludeDirectoryCandidates(options.documentPath)
                    : [];
        return directories.map((includeDirectory) => path.join(includeDirectory, normalizedPath));
    }

    if (isLpcAbsolutePath(normalizedPath)) {
        if (options.workspaceRoot) {
            return [path.join(options.workspaceRoot, normalizedPath.substring(1))];
        }

        return options.allowAncestorFallback
            ? createAncestorMudlibAbsoluteCandidates(normalizedPath, options.documentPath)
            : [];
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

function createAncestorIncludeDirectoryCandidates(documentPath: string): string[] {
    const candidates: string[] = [];
    let currentDirectory = path.dirname(normalizeFsPath(documentPath));

    while (true) {
        candidates.push(path.join(currentDirectory, 'include'));
        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            break;
        }

        currentDirectory = parentDirectory;
    }

    return candidates;
}

function createAncestorMudlibAbsoluteCandidates(includePath: string, documentPath: string): string[] {
    const relativeIncludePath = includePath.substring(1);
    const candidates: string[] = [];
    let currentDirectory = path.dirname(normalizeFsPath(documentPath));

    while (true) {
        candidates.push(path.join(currentDirectory, relativeIncludePath));
        const parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory) {
            break;
        }

        currentDirectory = parentDirectory;
    }

    return candidates;
}
