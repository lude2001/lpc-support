import * as vscode from 'vscode';

export function normalizeWorkspaceUri(target: vscode.Uri | string): string {
    const rawUri = typeof target === 'string' ? target : target.toString();
    return rawUri.replace(/^file:\/{4,}(?=[A-Za-z]:)/, 'file:///');
}
