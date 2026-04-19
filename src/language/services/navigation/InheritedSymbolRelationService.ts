import * as vscode from 'vscode';
import { SymbolType } from '../../../ast/symbolTable';
import type { ScopedMethodResolver } from '../../../objectInference/ScopedMethodResolver';
import { assertAnalysisService } from '../../../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import { resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import {
    InheritedFileGlobalRelationService
} from './InheritedFileGlobalRelationService';
import { InheritedFunctionRelationService } from './InheritedFunctionRelationService';

export interface InheritedReferenceMatch {
    uri: string;
    range: vscode.Range;
}

export type RenameTargetClassification =
    | { kind: 'current-file-only' }
    | { kind: 'file-global' }
    | { kind: 'unsupported' };

export interface InheritedSymbolRelationServiceOptions {
    analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    functionRelationService: Pick<InheritedFunctionRelationService, 'collectFunctionReferences'>;
    fileGlobalRelationService: Pick<InheritedFileGlobalRelationService, 'resolveVisibleBinding' | 'collectReferences'>;
}

export class InheritedSymbolRelationService {
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    private readonly functionRelationService: Pick<InheritedFunctionRelationService, 'collectFunctionReferences'>;
    private readonly fileGlobalRelationService: Pick<InheritedFileGlobalRelationService, 'resolveVisibleBinding' | 'collectReferences'>;

    public constructor(options: InheritedSymbolRelationServiceOptions) {
        const analysisService = assertAnalysisService('InheritedSymbolRelationService', options.analysisService);
        this.analysisService = analysisService;
        this.functionRelationService = options.functionRelationService;
        this.fileGlobalRelationService = options.fileGlobalRelationService;
    }

    public async collectInheritedReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        options: { includeDeclaration: boolean }
    ): Promise<InheritedReferenceMatch[]> {
        const targetPosition = toVsCodePosition(position);
        const symbolName = getWordAtPosition(document, targetPosition);
        if (!symbolName) {
            return [];
        }

        const functionMatches = await this.functionRelationService.collectFunctionReferences(document, targetPosition, options);
        if (functionMatches.length > 0) {
            return functionMatches;
        }

        const globalBinding = await this.fileGlobalRelationService.resolveVisibleBinding(document, symbolName, targetPosition);
        if (globalBinding.status !== 'resolved') {
            return [];
        }

        return this.fileGlobalRelationService.collectReferences(globalBinding.binding, options);
    }

    public async classifyRenameTarget(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<RenameTargetClassification> {
        const targetPosition = toVsCodePosition(position);
        const symbolName = getWordAtPosition(document, targetPosition);
        if (!symbolName) {
            return { kind: 'unsupported' };
        }

        const snapshot = this.analysisService.getSemanticSnapshot(document, false);
        const resolvedSymbol = resolveVisibleSymbol(snapshot.symbolTable, symbolName, targetPosition);
        if (resolvedSymbol?.type === SymbolType.PARAMETER) {
            return { kind: 'current-file-only' };
        }

        if (resolvedSymbol?.type === SymbolType.VARIABLE && resolvedSymbol.scope !== snapshot.symbolTable.getGlobalScope()) {
            return { kind: 'current-file-only' };
        }

        if (resolvedSymbol?.type === SymbolType.FUNCTION || resolvedSymbol?.type === SymbolType.STRUCT || resolvedSymbol?.type === SymbolType.CLASS) {
            return { kind: 'unsupported' };
        }

        if (resolvedSymbol?.type === SymbolType.VARIABLE) {
            return { kind: 'file-global' };
        }

        const inheritedBinding = await this.fileGlobalRelationService.resolveVisibleBinding(document, symbolName, targetPosition);
        return inheritedBinding.status === 'resolved'
            ? { kind: 'file-global' }
            : { kind: 'unsupported' };
    }

    public async buildInheritedRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string
    ): Promise<Record<string, Array<{ range: vscode.Range; newText: string }>>> {
        const targetPosition = toVsCodePosition(position);
        const symbolName = getWordAtPosition(document, targetPosition);
        if (!symbolName) {
            return {};
        }

        const binding = await this.fileGlobalRelationService.resolveVisibleBinding(document, symbolName, targetPosition);
        if (binding.status !== 'resolved') {
            return {};
        }

        const matches = await this.fileGlobalRelationService.collectReferences(binding.binding, { includeDeclaration: true });
        const changes: Record<string, Array<{ range: vscode.Range; newText: string }>> = {};

        for (const match of matches) {
            const edits = changes[match.uri] ?? [];
            edits.push({
                range: match.range,
                newText: newName
            });
            changes[match.uri] = edits;
        }

        return changes;
    }
}

function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }

    const word = document.getText(wordRange);
    return word || undefined;
}

function toVsCodePosition(position: vscode.Position | { line: number; character: number }): vscode.Position {
    return position instanceof vscode.Position
        ? position
        : new vscode.Position(position.line, position.character);
}
