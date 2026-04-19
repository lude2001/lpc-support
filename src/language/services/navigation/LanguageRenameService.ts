import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import {
    createVsCodeSymbolReferenceAdapter,
    getLanguageDocumentUri,
    LanguageRangeReadableDocument,
    LanguageSymbolReferenceAdapter
} from './LanguageSymbolReferenceAdapter';
import type { InheritedSymbolRelationService } from './InheritedSymbolRelationService';

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

export interface DefaultLanguageRenameServiceDependencies {
    analysisService?: Pick<DocumentAnalysisService, 'parseDocument'>;
    inheritedRelationService?: Pick<InheritedSymbolRelationService, 'classifyRenameTarget' | 'buildInheritedRenameEdits'>;
}

// Rename keeps the single-file adapter as a fallback when workspace relations are unavailable.
export class AstBackedLanguageRenameService implements LanguageRenameService {
    public constructor(
        private readonly dependencies: {
            referenceResolver: LanguageSymbolReferenceAdapter;
            inheritedRelationService?: Pick<InheritedSymbolRelationService, 'classifyRenameTarget' | 'buildInheritedRenameEdits'>;
        }
    ) {}

    public async prepareRename(
        request: LanguagePrepareRenameRequest
    ): Promise<LanguagePrepareRenameResult | undefined> {
        const inheritedRelationService = this.dependencies.inheritedRelationService;
        if (!inheritedRelationService) {
            return this.prepareCurrentFileRename(request);
        }

        const renameTarget = await inheritedRelationService.classifyRenameTarget(
            request.context.document as any,
            request.position as any
        );
        if (renameTarget.kind === 'unsupported') {
            return undefined;
        }

        const currentFileRename = this.prepareCurrentFileRename(request);
        if (currentFileRename) {
            return currentFileRename;
        }

        if (renameTarget.kind !== 'file-global') {
            return undefined;
        }

        const wordRange = (request.context.document as LanguageRangeReadableDocument & {
            getWordRangeAtPosition(position: LanguagePosition): LanguageRange | undefined;
        }).getWordRangeAtPosition(request.position);
        if (!wordRange) {
            return undefined;
        }

        return {
            range: wordRange,
            placeholder: (request.context.document as LanguageRangeReadableDocument).getText(wordRange)
        };
    }

    public async provideRenameEdits(request: LanguageRenameRequest): Promise<LanguageWorkspaceEdit> {
        const inheritedRelationService = this.dependencies.inheritedRelationService;
        if (!inheritedRelationService) {
            return this.provideCurrentFileRenameEdits(request);
        }

        const renameTarget = await inheritedRelationService.classifyRenameTarget(
            request.context.document as any,
            request.position as any
        );
        if (renameTarget.kind === 'unsupported') {
            return { changes: {} };
        }

        const currentFileEdit = this.provideCurrentFileRenameEdits(request);
        if (renameTarget.kind !== 'file-global') {
            return currentFileEdit;
        }

        const inheritedChanges = await inheritedRelationService.buildInheritedRenameEdits(
            request.context.document as any,
            request.position as any,
            request.newName
        );

        return {
            changes: mergeWorkspaceEdits(currentFileEdit.changes, inheritedChanges)
        };
    }

    private prepareCurrentFileRename(
        request: LanguagePrepareRenameRequest
    ): LanguagePrepareRenameResult | undefined {
        const references = this.dependencies.referenceResolver.resolveReferences(request.context.document, request.position);
        if (!references) {
            return undefined;
        }

        return {
            range: references.wordRange,
            placeholder: (request.context.document as LanguageRangeReadableDocument).getText(references.wordRange)
        };
    }

    private provideCurrentFileRenameEdits(request: LanguageRenameRequest): LanguageWorkspaceEdit {
        const references = this.dependencies.referenceResolver.resolveReferences(request.context.document, request.position);
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
}

export function createDefaultAstBackedLanguageRenameService(
    dependencies: DefaultLanguageRenameServiceDependencies = {}
): AstBackedLanguageRenameService {
    return new AstBackedLanguageRenameService({
        referenceResolver: createVsCodeSymbolReferenceAdapter(dependencies.analysisService),
        inheritedRelationService: dependencies.inheritedRelationService
    });
}

function mergeWorkspaceEdits(
    currentFileChanges: Record<string, LanguageTextEdit[]>,
    inheritedChanges: Record<string, Array<{ range: LanguageRange; newText: string }>>
): Record<string, LanguageTextEdit[]> {
    const merged: Record<string, LanguageTextEdit[]> = {};
    const seen = new Set<string>();

    const append = (uri: string, edit: LanguageTextEdit): void => {
        const key = `${uri}#${edit.range.start.line}:${edit.range.start.character}-${edit.range.end.line}:${edit.range.end.character}`;
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        const edits = merged[uri] ?? [];
        edits.push(edit);
        merged[uri] = edits;
    };

    for (const [uri, edits] of Object.entries(currentFileChanges)) {
        for (const edit of edits) {
            append(uri, edit);
        }
    }

    for (const [uri, edits] of Object.entries(inheritedChanges)) {
        for (const edit of edits) {
            append(uri, edit);
        }
    }

    return merged;
}
