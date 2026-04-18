import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageLocation } from '../../contracts/LanguagePosition';
import type { LanguagePosition } from '../../contracts/LanguagePosition';
import {
    createVsCodeSymbolReferenceAdapter,
    getLanguageDocumentUri,
    LanguageSymbolReferenceAdapter
} from './LanguageSymbolReferenceAdapter';
import {
    CURRENT_FILE_FALLBACK,
    type WorkspaceSymbolRelationService
} from './WorkspaceSymbolRelationService';

// Supporting request types for the grouped navigation service seam.
export interface LanguageReferenceRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
    includeDeclaration: boolean;
}

export interface LanguageReferenceService {
    provideReferences(request: LanguageReferenceRequest): Promise<LanguageLocation[]>;
}

// Reuses the existing current-file resolver so host integrations share the same contract.
export class AstBackedLanguageReferenceService implements LanguageReferenceService {
    public constructor(
        private readonly dependencies: {
            referenceResolver?: LanguageSymbolReferenceAdapter;
            workspaceRelationService?: Pick<WorkspaceSymbolRelationService, 'collectReferences'>;
        } = {}
    ) {}

    public async provideReferences(request: LanguageReferenceRequest): Promise<LanguageLocation[]> {
        const workspaceRelationService = this.dependencies.workspaceRelationService;
        if (workspaceRelationService) {
            const workspaceReferences = await workspaceRelationService.collectReferences(
                request.context.document as any,
                request.position as any,
                { includeDeclaration: request.includeDeclaration }
            );
            if (workspaceReferences !== CURRENT_FILE_FALLBACK) {
                return workspaceReferences.map((match) => ({
                    uri: match.uri,
                    range: match.range
                }));
            }
        }

        return this.provideCurrentFileReferences(request);
    }

    private provideCurrentFileReferences(request: LanguageReferenceRequest): LanguageLocation[] {
        const references = this.getReferenceResolver().resolveReferences(request.context.document, request.position);
        if (!references) {
            return [];
        }

        return references.matches
            .filter((match) => request.includeDeclaration || !match.isDeclaration)
            .map((match) => ({
                uri: getLanguageDocumentUri(request.context.document),
                range: match.range
            }));
    }

    private getReferenceResolver(): LanguageSymbolReferenceAdapter {
        return this.dependencies.referenceResolver ?? createVsCodeSymbolReferenceAdapter();
    }
}
