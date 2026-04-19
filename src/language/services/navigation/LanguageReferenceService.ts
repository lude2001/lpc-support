import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageLocation } from '../../contracts/LanguagePosition';
import type { LanguagePosition } from '../../contracts/LanguagePosition';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import {
    createVsCodeSymbolReferenceAdapter,
    getLanguageDocumentUri,
    LanguageSymbolReferenceAdapter
} from './LanguageSymbolReferenceAdapter';
import type { InheritedSymbolRelationService } from './InheritedSymbolRelationService';

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
            analysisService?: Pick<DocumentAnalysisService, 'parseDocument'>;
            inheritedRelationService?: Pick<InheritedSymbolRelationService, 'collectInheritedReferences'>;
        } = {}
    ) {}

    public async provideReferences(request: LanguageReferenceRequest): Promise<LanguageLocation[]> {
        const currentFileReferences = this.provideCurrentFileReferences(request);
        const inheritedRelationService = this.dependencies.inheritedRelationService;
        if (!inheritedRelationService) {
            return currentFileReferences;
        }

        const inheritedReferences = await inheritedRelationService.collectInheritedReferences(
            request.context.document as any,
            request.position as any,
            { includeDeclaration: request.includeDeclaration }
        );

        return dedupeLocations([
            ...currentFileReferences,
            ...inheritedReferences.map((match) => ({
                uri: match.uri,
                range: match.range
            }))
        ]);
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
        return this.dependencies.referenceResolver
            ?? createVsCodeSymbolReferenceAdapter(this.dependencies.analysisService);
    }
}

function dedupeLocations(locations: LanguageLocation[]): LanguageLocation[] {
    const seen = new Set<string>();
    const unique: LanguageLocation[] = [];

    for (const location of locations) {
        const key = `${location.uri}#${location.range.start.line}:${location.range.start.character}-${location.range.end.line}:${location.range.end.character}`;
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        unique.push(location);
    }

    return unique;
}
