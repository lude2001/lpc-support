import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageLocation } from '../../contracts/LanguagePosition';
import type { LanguagePosition } from '../../contracts/LanguagePosition';
import {
    createVsCodeSymbolReferenceAdapter,
    getLanguageDocumentUri,
    LanguageSymbolReferenceAdapter
} from './LanguageSymbolReferenceAdapter';

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
        } = {}
    ) {}

    public async provideReferences(request: LanguageReferenceRequest): Promise<LanguageLocation[]> {
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
