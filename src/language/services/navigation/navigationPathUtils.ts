import * as vscode from 'vscode';

export function normalizeWorkspaceUri(target: vscode.Uri | string): string {
    const rawUri = typeof target === 'string' ? target : target.toString();
    return rawUri.replace(/^file:\/{4,}(?=[A-Za-z]:)/, 'file:///');
}

export function normalizeNavigationFsPath(filePath: string): string {
    const normalizedPath = filePath
        .replace(/^[/\\]+(?=[A-Za-z]:[\\/])/, '')
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');

    return /^[A-Za-z]:\//.test(normalizedPath)
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}
