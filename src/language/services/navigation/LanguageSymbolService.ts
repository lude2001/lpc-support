import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageRange } from '../../contracts/LanguagePosition';
import * as vscode from 'vscode';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { FunctionSummary, TypeDefinitionSummary, MemberSummary } from '../../../semantic/documentSemanticTypes';

// Supporting request/result types for the grouped navigation service seam.
export interface LanguageDocumentSymbol {
    name: string;
    kind: string;
    range: LanguageRange;
    selectionRange: LanguageRange;
    detail?: string;
    children?: LanguageDocumentSymbol[];
}

export interface LanguageSymbolRequest {
    context: LanguageCapabilityContext;
}

export interface LanguageSymbolService {
    provideDocumentSymbols(request: LanguageSymbolRequest): Promise<LanguageDocumentSymbol[]>;
}

interface LanguageDocumentSymbolMemberSummary {
    name: string;
    dataType: string;
    range: LanguageRange;
    parameters?: unknown[];
}

interface LanguageDocumentSymbolTypeSummary {
    name: string;
    kind: 'class' | 'struct';
    range: LanguageRange;
    members: LanguageDocumentSymbolMemberSummary[];
}

interface LanguageDocumentSymbolFunctionSummary {
    name: string;
    returnType: string;
    range: LanguageRange;
}

interface LanguageDocumentSymbolsSnapshot {
    typeDefinitions: LanguageDocumentSymbolTypeSummary[];
    exportedFunctions: LanguageDocumentSymbolFunctionSummary[];
}

interface LanguageDocumentSymbolsSnapshotAdapter {
    getDocumentSymbolsSnapshot(document: LanguageCapabilityContext['document']): LanguageDocumentSymbolsSnapshot;
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

function toDocumentSymbolMemberSummary(member: MemberSummary): LanguageDocumentSymbolMemberSummary {
    return {
        name: member.name,
        dataType: member.dataType,
        range: toLanguageRange(member.range),
        parameters: member.parameters
    };
}

function toDocumentSymbolTypeSummary(typeDefinition: TypeDefinitionSummary): LanguageDocumentSymbolTypeSummary {
    return {
        name: typeDefinition.name,
        kind: typeDefinition.kind,
        range: toLanguageRange(typeDefinition.range),
        members: typeDefinition.members.map((member) => toDocumentSymbolMemberSummary(member))
    };
}

function toDocumentSymbolFunctionSummary(func: FunctionSummary): LanguageDocumentSymbolFunctionSummary {
    return {
        name: func.name,
        returnType: func.returnType,
        range: toLanguageRange(func.range)
    };
}

class VsCodeDocumentSymbolsSnapshotAdapter implements LanguageDocumentSymbolsSnapshotAdapter {
    public constructor(
        private readonly analysisService: Pick<DocumentAnalysisService, 'getBestAvailableSnapshot'>
    ) {}

    public getDocumentSymbolsSnapshot(document: LanguageCapabilityContext['document']): LanguageDocumentSymbolsSnapshot {
        const snapshot = this.analysisService.getBestAvailableSnapshot(document as unknown as vscode.TextDocument);
        return {
            typeDefinitions: snapshot.typeDefinitions.map((typeDefinition) => toDocumentSymbolTypeSummary(typeDefinition)),
            exportedFunctions: snapshot.exportedFunctions.map((func) => toDocumentSymbolFunctionSummary(func))
        };
    }
}

function createMemberSymbol(member: LanguageDocumentSymbolMemberSummary): LanguageDocumentSymbol {
    return {
        name: member.name,
        detail: member.dataType,
        kind: member.parameters !== undefined ? 'method' : 'field',
        range: member.range,
        selectionRange: member.range
    };
}

function createTypeSymbol(typeDefinition: LanguageDocumentSymbolTypeSummary): LanguageDocumentSymbol {
    return {
        name: typeDefinition.name,
        detail: typeDefinition.kind,
        kind: typeDefinition.kind,
        range: typeDefinition.range,
        selectionRange: typeDefinition.range,
        children: typeDefinition.members.map(createMemberSymbol)
    };
}

// Uses semantic/type summaries as the document symbol source of truth.
export class AstBackedLanguageSymbolService implements LanguageSymbolService {
    public constructor(
        private readonly dependencies: {
            snapshotAdapter?: LanguageDocumentSymbolsSnapshotAdapter;
            analysisService?: Pick<DocumentAnalysisService, 'getBestAvailableSnapshot'>;
        } = {}
    ) {}

    public async provideDocumentSymbols(request: LanguageSymbolRequest): Promise<LanguageDocumentSymbol[]> {
        const snapshot = this.getSnapshotAdapter().getDocumentSymbolsSnapshot(request.context.document);
        const symbols = snapshot.typeDefinitions.map(createTypeSymbol);

        for (const func of snapshot.exportedFunctions) {
            symbols.push({
                name: func.name,
                detail: func.returnType,
                kind: 'function',
                range: func.range,
                selectionRange: func.range
            });
        }

        return symbols;
    }

    private getSnapshotAdapter(): LanguageDocumentSymbolsSnapshotAdapter {
        return this.dependencies.snapshotAdapter
            ?? new VsCodeDocumentSymbolsSnapshotAdapter(
                assertAnalysisService('AstBackedLanguageSymbolService', this.dependencies.analysisService)
            );
    }
}
