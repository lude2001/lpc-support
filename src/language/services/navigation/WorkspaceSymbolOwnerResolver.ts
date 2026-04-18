import * as vscode from 'vscode';
import { Symbol, SymbolType } from '../../../ast/symbolTable';
import { DocumentSemanticSnapshotService } from '../../../completion/documentSemanticSnapshotService';
import { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { WorkspaceSemanticIndexService } from './WorkspaceSemanticIndexService';
import {
    resolveWorkspaceRootForDocument,
    type WorkspaceRootHost
} from './workspaceSymbolTypes';
import { SyntaxKind, SyntaxNode } from '../../../syntax/types';

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
    host?: WorkspaceRootHost;
}

const defaultWorkspaceRootHost: WorkspaceRootHost = {
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders
};

export class WorkspaceSymbolOwnerResolver {
    private readonly workspaceSemanticIndexService: Pick<WorkspaceSemanticIndexService, 'getIndexView'>;
    private readonly snapshotService: DocumentSemanticSnapshotService;
    private readonly host: WorkspaceRootHost;

    public constructor(options: WorkspaceSymbolOwnerResolverOptions) {
        this.workspaceSemanticIndexService = options.workspaceSemanticIndexService;
        this.snapshotService = options.snapshotService ?? DocumentSemanticSnapshotService.getInstance();
        this.host = options.host ?? defaultWorkspaceRootHost;
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
            return this.resolveExternalOwner(document, symbolName, wordRange);
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

        if (
            ownerKind === 'function'
            && await this.isCrossFilePrototypeFamilyAmbiguous(document, semanticSnapshot, symbolName)
        ) {
            return { kind: 'ambiguous', reason: 'Function prototype cannot be proven equivalent across files' };
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

    private async getIndexView(workspaceRoot: string): Promise<{
        getFunctionCandidateFiles(name: string): string[];
        getFileGlobalCandidateFiles(name: string): string[];
        getTypeCandidateFiles(name: string): string[];
        getFunctionDeclarationFiles?(name: string): string[];
        getFileGlobalDeclarationFiles?(name: string): string[];
        getTypeDeclarationFiles?(name: string): string[];
    }> {
        return this.workspaceSemanticIndexService.getIndexView(workspaceRoot);
    }

    private async getDeclarationFiles(
        document: vscode.TextDocument,
        ownerKind: WorkspaceSymbolOwnerKind,
        symbolName: string
    ): Promise<string[]> {
        const workspaceRoot = resolveWorkspaceRootForDocument(document, this.host);
        const indexView = await this.getIndexView(workspaceRoot);
        const declarationFiles = this.getDeclarationFilesFromView(indexView, ownerKind, symbolName);
        if (declarationFiles.length > 0) {
            return declarationFiles;
        }

        return [];
    }

    private getDeclarationFilesFromView(
        indexView: {
            getFunctionCandidateFiles(name: string): string[];
            getFileGlobalCandidateFiles(name: string): string[];
            getTypeCandidateFiles(name: string): string[];
            getFunctionDeclarationFiles?(name: string): string[];
            getFileGlobalDeclarationFiles?(name: string): string[];
            getTypeDeclarationFiles?(name: string): string[];
        },
        ownerKind: WorkspaceSymbolOwnerKind,
        symbolName: string
    ): string[] {
        switch (ownerKind) {
            case 'function':
                return uniqueStrings(
                    (indexView.getFunctionDeclarationFiles?.(symbolName) ?? indexView.getFunctionCandidateFiles(symbolName))
                        .map((uri) => normalizeWorkspaceUri(uri))
                );
            case 'global':
                return uniqueStrings(
                    (indexView.getFileGlobalDeclarationFiles?.(symbolName) ?? indexView.getFileGlobalCandidateFiles(symbolName))
                        .map((uri) => normalizeWorkspaceUri(uri))
                );
            case 'type':
                return uniqueStrings(
                    (indexView.getTypeDeclarationFiles?.(symbolName) ?? indexView.getTypeCandidateFiles(symbolName))
                        .map((uri) => normalizeWorkspaceUri(uri))
                );
            default:
                return [];
        }
    }

    private resolveExternalOwner(
        document: vscode.TextDocument,
        symbolName: string,
        wordRange: vscode.Range
    ): Promise<WorkspaceOwnerResolution> {
        return this.resolveExternalOwnerAsync(document, symbolName, wordRange);
    }

    private async resolveExternalOwnerAsync(
        document: vscode.TextDocument,
        symbolName: string,
        wordRange: vscode.Range
    ): Promise<WorkspaceOwnerResolution> {
        return { kind: 'unsupported', reason: 'No proven external owner for token' };
    }

    private async isCrossFilePrototypeFamilyAmbiguous(
        document: vscode.TextDocument,
        semanticSnapshot: SemanticSnapshot,
        symbolName: string
    ): Promise<boolean> {
        if (hasLocalFunctionImplementation(semanticSnapshot.syntax.nodes, symbolName)) {
            return false;
        }

        const declarationFiles = await this.getDeclarationFiles(document, 'function', symbolName);
        return declarationFiles.length > 1;
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

function hasLocalFunctionImplementation(nodes: readonly SyntaxNode[], symbolName: string): boolean {
    return nodes.some((node) =>
        node.kind === SyntaxKind.FunctionDeclaration
        && node.name === symbolName
        && node.children.some((child) => child.kind === SyntaxKind.Block)
    );
}

export function normalizeWorkspaceUri(target: vscode.Uri | string): string {
    const rawUri = typeof target === 'string' ? target : target.toString();
    return rawUri.replace(/^file:\/{4}(?=[A-Za-z]:)/, 'file:///');
}
