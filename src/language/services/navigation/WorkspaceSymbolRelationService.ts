import * as path from 'path';
import * as vscode from 'vscode';
import { WorkspaceSemanticIndexService } from './WorkspaceSemanticIndexService';
import {
    WorkspaceSymbolOwner,
    WorkspaceSymbolOwnerResolver
} from './WorkspaceSymbolOwnerResolver';
import { WorkspaceReferenceCollector } from './WorkspaceReferenceCollector';

export const CURRENT_FILE_FALLBACK = Symbol('CURRENT_FILE_FALLBACK');

export interface WorkspacePrepareRenameResult {
    range: vscode.Range;
    placeholder?: string;
}

export interface WorkspaceRenameEdit {
    changes: Record<string, Array<{ range: vscode.Range; newText: string }>>;
}

export interface WorkspaceSymbolRelationServiceOptions {
    ownerResolver: Pick<WorkspaceSymbolOwnerResolver, 'resolveOwner'>;
    workspaceSemanticIndexService: Pick<WorkspaceSemanticIndexService, 'getIndexView'>;
    referenceCollector: Pick<WorkspaceReferenceCollector, 'collect'>;
}

export class WorkspaceSymbolRelationService {
    private readonly ownerResolver: Pick<WorkspaceSymbolOwnerResolver, 'resolveOwner'>;
    private readonly workspaceSemanticIndexService: Pick<WorkspaceSemanticIndexService, 'getIndexView'>;
    private readonly referenceCollector: Pick<WorkspaceReferenceCollector, 'collect'>;

    public constructor(options: WorkspaceSymbolRelationServiceOptions) {
        this.ownerResolver = options.ownerResolver;
        this.workspaceSemanticIndexService = options.workspaceSemanticIndexService;
        this.referenceCollector = options.referenceCollector;
    }

    public async collectReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: vscode.Range }> | typeof CURRENT_FILE_FALLBACK> {
        const resolution = await this.ownerResolver.resolveOwner(document, position);
        if (resolution.kind === 'current-file-only') {
            return CURRENT_FILE_FALLBACK;
        }

        if (resolution.kind !== 'workspace-visible') {
            return [];
        }

        return this.collectWorkspaceMatches(document, resolution.owner, options);
    }

    public async prepareRename(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<WorkspacePrepareRenameResult | typeof CURRENT_FILE_FALLBACK | undefined> {
        const resolution = await this.ownerResolver.resolveOwner(document, position);
        if (resolution.kind === 'current-file-only') {
            return CURRENT_FILE_FALLBACK;
        }

        if (resolution.kind !== 'workspace-visible') {
            return undefined;
        }

        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        return {
            range: wordRange,
            placeholder: document.getText(wordRange)
        };
    }

    public async buildRenameEdit(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string
    ): Promise<WorkspaceRenameEdit | typeof CURRENT_FILE_FALLBACK> {
        const resolution = await this.ownerResolver.resolveOwner(document, position);
        if (resolution.kind === 'current-file-only') {
            return CURRENT_FILE_FALLBACK;
        }

        if (resolution.kind !== 'workspace-visible') {
            return { changes: {} };
        }

        const matches = await this.collectWorkspaceMatches(document, resolution.owner, { includeDeclaration: true });
        if (matches.length === 0) {
            return { changes: {} };
        }

        const changes: WorkspaceRenameEdit['changes'] = {};
        for (const match of matches) {
            const edits = changes[match.uri] ?? [];
            edits.push({
                range: match.range,
                newText: newName
            });
            changes[match.uri] = edits;
        }

        return { changes };
    }

    private async collectWorkspaceMatches(
        document: vscode.TextDocument,
        owner: WorkspaceSymbolOwner,
        options: { includeDeclaration: boolean }
    ): Promise<Array<{ uri: string; range: vscode.Range }>> {
        const workspaceRoot = vscode.workspace.getWorkspaceFolder?.(document.uri)?.uri.fsPath ?? path.dirname(document.uri.fsPath);
        const indexView = await this.workspaceSemanticIndexService.getIndexView(workspaceRoot);
        const candidateFiles = selectCandidateFiles(indexView, owner);
        return this.referenceCollector.collect(owner, candidateFiles, options);
    }
}

function selectCandidateFiles(
    indexView: {
        getFunctionCandidateFiles(name: string): string[];
        getFileGlobalCandidateFiles(name: string): string[];
        getTypeCandidateFiles(name: string): string[];
    },
    owner: WorkspaceSymbolOwner
): string[] {
    switch (owner.kind) {
        case 'function':
            return indexView.getFunctionCandidateFiles(owner.name);
        case 'global':
            return indexView.getFileGlobalCandidateFiles(owner.name);
        case 'type':
            return indexView.getTypeCandidateFiles(owner.name);
        default:
            return [];
    }
}
