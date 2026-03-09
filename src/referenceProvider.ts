import * as vscode from 'vscode';
import { resolveSymbolReferences } from './symbolReferenceResolver';

export class LPCReferenceProvider implements vscode.ReferenceProvider {
    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location[]> {
        const references = resolveSymbolReferences(document, position);
        if (!references) {
            return [];
        }

        return references.matches
            .filter(match => context.includeDeclaration || !match.isDeclaration)
            .map(match => new vscode.Location(document.uri, match.range));
    }
} 
