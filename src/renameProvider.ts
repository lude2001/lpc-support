import * as vscode from 'vscode';
import { resolveSymbolReferences } from './symbolReferenceResolver';

export class LPCRenameProvider implements vscode.RenameProvider {
    async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Range | undefined> {
        return resolveSymbolReferences(document, position)?.wordRange;
    }

    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
        _token: vscode.CancellationToken
    ): Promise<vscode.WorkspaceEdit> {
        const edit = new vscode.WorkspaceEdit();
        const references = resolveSymbolReferences(document, position);
        if (!references) return edit;

        for (const match of references.matches) {
            edit.replace(document.uri, match.range, newName);
        }
        return edit;
    }
} 
