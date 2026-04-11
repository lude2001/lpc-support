import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import {
    createVsCodeSymbolReferenceAdapter,
    getLanguageDocumentUri,
    LanguageRangeReadableDocument,
    LanguageSymbolReferenceAdapter
} from './LanguageSymbolReferenceAdapter';

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
        } = {}
    ) {}

    public async prepareRename(
        request: LanguagePrepareRenameRequest
    ): Promise<LanguagePrepareRenameResult | undefined> {
        const references = this.getReferenceResolver().resolveReferences(request.context.document, request.position);
        if (!references) {
            return undefined;
        }

        return {
            range: references.wordRange,
            placeholder: (request.context.document as LanguageRangeReadableDocument).getText(references.wordRange)
        };
    }

    public async provideRenameEdits(request: LanguageRenameRequest): Promise<LanguageWorkspaceEdit> {
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
