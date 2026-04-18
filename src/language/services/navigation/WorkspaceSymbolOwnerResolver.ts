import * as path from 'path';
import * as vscode from 'vscode';
import { Symbol, SymbolType } from '../../../ast/symbolTable';
import { DocumentSemanticSnapshotService } from '../../../completion/documentSemanticSnapshotService';
import { resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { WorkspaceSemanticIndexService } from './WorkspaceSemanticIndexService';

export type WorkspaceSymbolOwnerKind = 'function' | 'global' | 'type';

export interface WorkspaceSymbolOwner {
    kind: WorkspaceSymbolOwnerKind;
    key: string;
    name: string;
    sourceUri: string;
    canonicalRange: vscode.Range;
}

export type WorkspaceOwnerResolution =
    | { kind: 'workspace-visible'; owner: WorkspaceSymbolOwner }
    | { kind: 'current-file-only'; reason?: string }
    | { kind: 'ambiguous'; reason?: string }
    | { kind: 'unsupported'; reason?: string };

export interface WorkspaceSymbolOwnerResolverOptions {
    workspaceSemanticIndexService: Pick<WorkspaceSemanticIndexService, 'getIndexView'>;
    snapshotService?: DocumentSemanticSnapshotService;
}

export class WorkspaceSymbolOwnerResolver {
    private readonly workspaceSemanticIndexService: Pick<WorkspaceSemanticIndexService, 'getIndexView'>;
    private readonly snapshotService: DocumentSemanticSnapshotService;

    public constructor(options: WorkspaceSymbolOwnerResolverOptions) {
        this.workspaceSemanticIndexService = options.workspaceSemanticIndexService;
        this.snapshotService = options.snapshotService ?? DocumentSemanticSnapshotService.getInstance();
    }

    public async resolveOwner(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<WorkspaceOwnerResolution> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return { kind: 'unsupported', reason: 'No symbol at position' };
        }

        const symbolName = document.getText(wordRange);
        if (!symbolName) {
            return { kind: 'unsupported', reason: 'No symbol at position' };
        }

        const semanticSnapshot = this.snapshotService.getSemanticSnapshot(document, true);
        const resolvedSymbol = resolveVisibleSymbol(semanticSnapshot.symbolTable, symbolName, wordRange.start);
        if (!resolvedSymbol) {
            return { kind: 'unsupported', reason: 'No visible symbol for token' };
        }

        if (resolvedSymbol.type === SymbolType.PARAMETER) {
            return { kind: 'current-file-only', reason: 'Parameters stay current-file only' };
        }

        if (resolvedSymbol.type === SymbolType.VARIABLE && resolvedSymbol.scope !== semanticSnapshot.symbolTable.getGlobalScope()) {
            return { kind: 'current-file-only', reason: 'Local variables stay current-file only' };
        }

        const ownerKind = toWorkspaceOwnerKind(resolvedSymbol);
        if (!ownerKind) {
            return { kind: 'unsupported', reason: `Unsupported symbol type: ${resolvedSymbol.type}` };
        }

        const candidateFiles = await this.getCandidateFiles(document, ownerKind, symbolName);
        if (ownerKind === 'function' && candidateFiles.length > 1) {
            return { kind: 'ambiguous', reason: 'Function owner is not unique across candidate files' };
        }

        if ((ownerKind === 'global' || ownerKind === 'type') && candidateFiles.length > 1) {
            return { kind: 'ambiguous', reason: 'Declaration owner is not unique across candidate files' };
        }

        const sourceUri = normalizeWorkspaceUri(document.uri);
        const canonicalRange = resolvedSymbol.selectionRange ?? resolvedSymbol.range;

        return {
            kind: 'workspace-visible',
            owner: {
                kind: ownerKind,
                key: `${ownerKind}:${sourceUri}:${resolvedSymbol.name}`,
                name: resolvedSymbol.name,
                sourceUri,
                canonicalRange
            }
        };
    }

    private async getCandidateFiles(
        document: vscode.TextDocument,
        ownerKind: WorkspaceSymbolOwnerKind,
        symbolName: string
    ): Promise<string[]> {
        const workspaceRoot = vscode.workspace.getWorkspaceFolder?.(document.uri)?.uri.fsPath ?? path.dirname(document.uri.fsPath);
        const indexView = await this.workspaceSemanticIndexService.getIndexView(workspaceRoot);
        switch (ownerKind) {
            case 'function':
                return uniqueStrings(indexView.getFunctionCandidateFiles(symbolName));
            case 'global':
                return uniqueStrings(indexView.getFileGlobalCandidateFiles(symbolName));
            case 'type':
                return uniqueStrings(indexView.getTypeCandidateFiles(symbolName));
            default:
                return [];
        }
    }
}

export function sameWorkspaceSymbolOwner(
    left: WorkspaceSymbolOwner | undefined,
    right: WorkspaceSymbolOwner | undefined
): boolean {
    return Boolean(left && right)
        && left!.kind === right!.kind
        && left!.key === right!.key
        && left!.name === right!.name;
}

function toWorkspaceOwnerKind(symbol: Symbol): WorkspaceSymbolOwnerKind | undefined {
    switch (symbol.type) {
        case SymbolType.FUNCTION:
            return 'function';
        case SymbolType.VARIABLE:
            return symbol.scope.parent ? undefined : 'global';
        case SymbolType.STRUCT:
        case SymbolType.CLASS:
            return 'type';
        default:
            return undefined;
    }
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values));
}

export function normalizeWorkspaceUri(target: vscode.Uri | string): string {
    const rawUri = typeof target === 'string' ? target : target.toString();
    return rawUri.replace(/^file:\/{4}(?=[A-Za-z]:)/, 'file:///');
}
