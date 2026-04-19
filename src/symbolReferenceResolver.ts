import * as vscode from 'vscode';
import { LPCLexer } from './antlr/LPCLexer';
import { Scope, Symbol as LPCSymbol, SymbolTable, SymbolType } from './ast/symbolTable';
import type { DocumentAnalysisService } from './semantic/documentAnalysisService';

export interface SymbolReferenceMatch {
    symbol: LPCSymbol;
    range: vscode.Range;
    isDeclaration: boolean;
}

export interface ResolvedSymbolReferences {
    symbol: LPCSymbol;
    wordRange: vscode.Range;
    matches: SymbolReferenceMatch[];
}

type SymbolReferenceAnalysisService = Pick<DocumentAnalysisService, 'parseDocument'>;

export function resolveSymbolReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    analysisService: SymbolReferenceAnalysisService
): ResolvedSymbolReferences | undefined {
    const resolvedWord = resolveWordAtPosition(document, position);
    if (!resolvedWord) {
        return undefined;
    }

    const analysis = analysisService.parseDocument(document);
    const symbolTable = analysis.symbolTable;
    const targetSymbol = resolveVisibleSymbol(symbolTable, resolvedWord.symbolName, position);
    if (!targetSymbol) {
        return undefined;
    }

    const declarationRange = getDeclarationRange(targetSymbol);
    const tokenStream = analysis.parsed?.tokens;
    if (!tokenStream) {
        return undefined;
    }

    const matches: SymbolReferenceMatch[] = [];

    for (const token of tokenStream.getTokens()) {
        if (!isMatchingIdentifierToken(token, resolvedWord.symbolName)) {
            continue;
        }

        const range = createCompatibleRange(
            document.positionAt(token.startIndex),
            document.positionAt(token.stopIndex + 1)
        );
        const resolvedSymbol = resolveVisibleSymbol(symbolTable, resolvedWord.symbolName, range.start);
        const isDeclaration = rangesEqual(range, declarationRange);

        if (resolvedSymbol === targetSymbol || isDeclaration) {
            matches.push({
                symbol: targetSymbol,
                range,
                isDeclaration
            });
        }
    }

    return {
        symbol: targetSymbol,
        wordRange: resolvedWord.wordRange,
        matches
    };
}

function resolveWordAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): { wordRange: vscode.Range; symbolName: string } | undefined {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }

    const symbolName = document.getText(wordRange);
    if (!symbolName) {
        return undefined;
    }

    return {
        wordRange,
        symbolName
    };
}

function createCompatibleRange(
    start: vscode.Position | { line: number; character: number },
    end: vscode.Position | { line: number; character: number }
): vscode.Range {
    return new vscode.Range(
        toVsCodePosition(start),
        toVsCodePosition(end)
    );
}

function toVsCodePosition(position: vscode.Position | { line: number; character: number }): vscode.Position {
    return position instanceof vscode.Position
        ? position
        : new vscode.Position(position.line, position.character);
}

function isMatchingIdentifierToken(
    token: { channel: number; type: number; text?: string | null },
    symbolName: string
): boolean {
    return token.channel === LPCLexer.DEFAULT_TOKEN_CHANNEL
        && token.type === LPCLexer.Identifier
        && token.text === symbolName;
}

export function resolveVisibleSymbol(
    symbolTable: SymbolTable,
    symbolName: string,
    position: vscode.Position
): LPCSymbol | undefined {
    let scope: Scope | undefined = symbolTable.findScopeAt(position);

    while (scope) {
        const candidate = scope.symbols.get(symbolName);
        if (candidate && isSymbolVisibleAtPosition(candidate, position)) {
            return candidate;
        }

        scope = scope.parent;
    }

    return undefined;
}

function isSymbolVisibleAtPosition(symbol: LPCSymbol, position: vscode.Position): boolean {
    const declarationRange = getDeclarationRange(symbol);
    if (declarationRange.contains(position)) {
        return true;
    }

    if (symbol.type === SymbolType.FUNCTION || symbol.type === SymbolType.STRUCT || symbol.type === SymbolType.CLASS) {
        return true;
    }

    if (symbol.type === SymbolType.PARAMETER) {
        return true;
    }

    return declarationRange.start.isBeforeOrEqual(position);
}

function getDeclarationRange(symbol: LPCSymbol): vscode.Range {
    return symbol.selectionRange ?? symbol.range;
}

function rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
    return left.start.isEqual(right.start) && left.end.isEqual(right.end);
}
