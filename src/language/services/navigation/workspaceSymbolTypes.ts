import * as path from 'path';
import * as vscode from 'vscode';

export interface WorkspaceSemanticIndexHost {
    findFiles(pattern: vscode.RelativePattern): Promise<readonly vscode.Uri[]>;
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
}

export interface WorkspaceRootHost {
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
}

export interface WorkspaceSymbolIndexView {
    getFunctionCandidateFiles(name: string): string[];
    getFileGlobalCandidateFiles(name: string): string[];
    getTypeCandidateFiles(name: string): string[];
    getFunctionDeclarationFiles?(name: string): string[];
    getFileGlobalDeclarationFiles?(name: string): string[];
    getTypeDeclarationFiles?(name: string): string[];
}

export interface WorkspaceSemanticIndexEntry {
    uri: string;
    version: number;
    functionNames: string[];
    fileGlobalNames: string[];
    typeNames: string[];
    identifierNames: string[];
}

export function resolveWorkspaceRootForDocument(
    document: Pick<vscode.TextDocument, 'uri'>,
    host: WorkspaceRootHost
): string {
    const workspaceFolders = host.getWorkspaceFolders() ?? [];
    if (workspaceFolders.length === 0) {
        return path.dirname(document.uri.fsPath);
    }

    const normalizedDocumentPath = normalizeComparablePath(document.uri.fsPath);
    const matchedWorkspaceRoot = workspaceFolders.reduce<string | undefined>((bestMatch, folder) => {
        const rootPath = folder.uri.fsPath;
        const normalizedRootPath = normalizeComparablePath(rootPath);
        if (!isPathPrefix(normalizedRootPath, normalizedDocumentPath)) {
            return bestMatch;
        }

        if (!bestMatch) {
            return rootPath;
        }

        return normalizedRootPath.length > normalizeComparablePath(bestMatch)
            .length
            ? rootPath
            : bestMatch;
    }, undefined);

    return matchedWorkspaceRoot ?? path.dirname(document.uri.fsPath);
}

function normalizeComparablePath(targetPath: string): string {
    const normalizedPath = path
        .normalize(targetPath)
        .replace(/^[\\/]+(?=[A-Za-z]:)/, '')
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');
    return process.platform === 'win32'
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}

function isPathPrefix(rootPath: string, candidatePath: string): boolean {
    return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);
}
