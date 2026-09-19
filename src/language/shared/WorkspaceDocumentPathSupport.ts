import * as fs from 'fs';
import * as vscode from 'vscode';

export interface TextDocumentHost {
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    fileExists(filePath: string): boolean;
    getWorkspaceFolder(uri: vscode.Uri): { uri: { fsPath: string } } | undefined;
}

export type OpenTextDocumentHost = Pick<TextDocumentHost, 'openTextDocument'>;

export interface WorkspaceDocumentHost extends TextDocumentHost {
    findFiles(pattern: vscode.GlobPattern, exclude?: vscode.GlobPattern): Promise<readonly vscode.Uri[]>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
    onDidChangeTextDocument(
        listener: (event: vscode.TextDocumentChangeEvent) => unknown
    ): vscode.Disposable;
}

export function createVsCodeTextDocumentHost(): TextDocumentHost {
    return {
        openTextDocument: async (target) => typeof target === 'string'
            ? vscode.workspace.openTextDocument(target)
            : vscode.workspace.openTextDocument(target),
        fileExists: (filePath) => fs.existsSync(filePath),
        getWorkspaceFolder: (uri) => vscode.workspace.getWorkspaceFolder(uri)
    };
}

export function createVsCodeWorkspaceDocumentHost(): WorkspaceDocumentHost {
    const textDocumentHost = createVsCodeTextDocumentHost();
    return {
        ...textDocumentHost,
        findFiles: async (pattern, exclude) => vscode.workspace.findFiles(pattern, exclude),
        getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
        onDidChangeTextDocument: (listener) => vscode.workspace.onDidChangeTextDocument(listener)
    };
}
