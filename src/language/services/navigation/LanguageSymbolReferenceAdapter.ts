import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguagePosition, LanguageRange } from '../../contracts/LanguagePosition';
import { resolveSymbolReferences } from '../../../symbolReferenceResolver';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';

export type LanguageRangeReadableDocument = LanguageCapabilityContext['document'] & {
    getText(range?: LanguageRange): string;
};

export interface LanguageResolvedReferenceMatch {
    range: LanguageRange;
    isDeclaration: boolean;
}

export interface LanguageResolvedSymbolReferences {
    wordRange: LanguageRange;
    matches: LanguageResolvedReferenceMatch[];
}

export interface LanguageSymbolReferenceAdapter {
    resolveReferences(
        document: LanguageCapabilityContext['document'],
        position: LanguagePosition
    ): LanguageResolvedSymbolReferences | undefined;
}

export function getLanguageDocumentUri(document: LanguageCapabilityContext['document']): string {
    const uri = (document as { uri: string | { toString(): string } }).uri;
    return typeof uri === 'string' ? uri : uri.toString();
}

function toLanguageRange(range: vscode.Range): LanguageRange {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

class VsCodeSymbolReferenceAdapter implements LanguageSymbolReferenceAdapter {
    public constructor(
        private readonly analysisService: Pick<DocumentAnalysisService, 'parseDocument'>
    ) {}

    public resolveReferences(
        document: LanguageCapabilityContext['document'],
        position: LanguagePosition
    ): LanguageResolvedSymbolReferences | undefined {
        const resolvedReferences = resolveSymbolReferences(
            document as unknown as vscode.TextDocument,
            new vscode.Position(position.line, position.character),
            this.analysisService
        );
        if (!resolvedReferences) {
            return undefined;
        }

        return {
            wordRange: toLanguageRange(resolvedReferences.wordRange),
            matches: resolvedReferences.matches.map((match) => ({
                range: toLanguageRange(match.range),
                isDeclaration: match.isDeclaration
            }))
        };
    }
}

export function createVsCodeSymbolReferenceAdapter(
    analysisService?: Pick<DocumentAnalysisService, 'parseDocument'>
): LanguageSymbolReferenceAdapter {
    return new VsCodeSymbolReferenceAdapter(
        assertAnalysisService('createVsCodeSymbolReferenceAdapter', analysisService)
    );
}
