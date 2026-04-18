import * as vscode from 'vscode';

export interface WorkspaceSemanticIndexHost {
    findFiles(pattern: vscode.RelativePattern): Promise<readonly vscode.Uri[]>;
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
}

export interface WorkspaceSymbolIndexView {
    getFunctionCandidateFiles(name: string): string[];
    getFileGlobalCandidateFiles(name: string): string[];
    getTypeCandidateFiles(name: string): string[];
}

export interface WorkspaceSemanticIndexEntry {
    uri: string;
    version: number;
    functionNames: string[];
    fileGlobalNames: string[];
    typeNames: string[];
}
