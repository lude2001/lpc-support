import * as vscode from 'vscode';
import { SymbolType, type Symbol } from '../../ast/symbolTable';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';

export type CallableNameShadowAnalysisService = Pick<DocumentAnalysisService, 'getBestAvailableSnapshot'>;

export function isCallableNameShadowedByNonCallableSymbol(
    analysisService: Partial<CallableNameShadowAnalysisService> | undefined,
    document: vscode.TextDocument,
    name: string,
    position: vscode.Position
): boolean {
    if (!analysisService?.getBestAvailableSnapshot) {
        return false;
    }

    try {
        const snapshot = analysisService.getBestAvailableSnapshot(document);
        const symbol = snapshot.symbolTable.findSymbol(name, position);
        return Boolean(symbol && isNonCallableSymbol(symbol) && isDeclaredAtOrBefore(symbol, position));
    } catch {
        return false;
    }
}

function isNonCallableSymbol(symbol: Symbol): boolean {
    return symbol.type === SymbolType.VARIABLE || symbol.type === SymbolType.PARAMETER;
}

function isDeclaredAtOrBefore(symbol: Symbol, position: vscode.Position): boolean {
    const declarationStart = symbol.selectionRange?.start ?? symbol.range.start;
    return comparePositions(declarationStart, position) <= 0;
}

function comparePositions(left: vscode.Position, right: vscode.Position): number {
    if (left.line !== right.line) {
        return left.line - right.line;
    }

    return left.character - right.character;
}
