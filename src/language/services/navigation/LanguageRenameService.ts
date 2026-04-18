import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import {
    createVsCodeSymbolReferenceAdapter,
    getLanguageDocumentUri,
    LanguageRangeReadableDocument,
    LanguageSymbolReferenceAdapter
} from './LanguageSymbolReferenceAdapter';
import {
    CURRENT_FILE_FALLBACK,
    type WorkspaceSymbolRelationService
} from './WorkspaceSymbolRelationService';

// Supporting request/result types for the grouped navigation service seam.
export interface LanguageRenameRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
    newName: string;
}

export interface LanguagePrepareRenameRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
}

export interface LanguageTextEdit {
    range: LanguageRange;
    newText: string;
}

export interface LanguageWorkspaceEdit {
    changes: Record<string, LanguageTextEdit[]>;
}

export interface LanguagePrepareRenameResult {
    range: LanguageRange;
    placeholder?: string;
}

export interface LanguageRenameService {
    prepareRename(request: LanguagePrepareRenameRequest): Promise<LanguagePrepareRenameResult | undefined>;
    provideRenameEdits(request: LanguageRenameRequest): Promise<LanguageWorkspaceEdit>;
}

// Rename remains intentionally current-file only by routing through resolveSymbolReferences.
export class AstBackedLanguageRenameService implements LanguageRenameService {
    public constructor(
        private readonly dependencies: {
            referenceResolver?: LanguageSymbolReferenceAdapter;
            workspaceRelationService?: Pick<WorkspaceSymbolRelationService, 'prepareRename' | 'buildRenameEdit'>;
        } = {}
    ) {}

    public async prepareRename(
        request: LanguagePrepareRenameRequest
    ): Promise<LanguagePrepareRenameResult | undefined> {
        const workspaceRelationService = this.dependencies.workspaceRelationService;
        if (workspaceRelationService) {
            const workspaceResult = await workspaceRelationService.prepareRename(
                request.context.document as any,
                request.position as any
            );
            if (workspaceResult !== CURRENT_FILE_FALLBACK) {
                return workspaceResult
                    ? {
                        range: workspaceResult.range,
                        placeholder: workspaceResult.placeholder
                    }
                    : undefined;
            }
        }

        return this.prepareCurrentFileRename(request);
    }

    public async provideRenameEdits(request: LanguageRenameRequest): Promise<LanguageWorkspaceEdit> {
        const workspaceRelationService = this.dependencies.workspaceRelationService;
        if (workspaceRelationService) {
            const workspaceEdit = await workspaceRelationService.buildRenameEdit(
                request.context.document as any,
                request.position as any,
                request.newName
            );
            if (workspaceEdit !== CURRENT_FILE_FALLBACK) {
                return {
                    changes: workspaceEdit.changes
                };
            }
        }

        return this.provideCurrentFileRenameEdits(request);
    }

    private prepareCurrentFileRename(
        request: LanguagePrepareRenameRequest
    ): LanguagePrepareRenameResult | undefined {
        const references = this.getReferenceResolver().resolveReferences(request.context.document, request.position);
        if (!references) {
            return undefined;
        }

        return {
            range: references.wordRange,
            placeholder: (request.context.document as LanguageRangeReadableDocument).getText(references.wordRange)
        };
    }

    private provideCurrentFileRenameEdits(request: LanguageRenameRequest): LanguageWorkspaceEdit {
        const references = this.getReferenceResolver().resolveReferences(request.context.document, request.position);
        if (!references) {
            return { changes: {} };
        }

        return {
            changes: {
                [getLanguageDocumentUri(request.context.document)]: references.matches.map((match) => ({
                    range: match.range,
                    newText: request.newName
                }))
            }
        };
    }

    private getReferenceResolver(): LanguageSymbolReferenceAdapter {
        return this.dependencies.referenceResolver ?? createVsCodeSymbolReferenceAdapter();
    }
}
