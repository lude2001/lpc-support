import * as vscode from 'vscode';
import { LPCLexer } from './antlr/LPCLexer';
import { ASTManager } from './ast/astManager';
import { Scope, Symbol as LPCSymbol, SymbolTable, SymbolType } from './ast/symbolTable';
import { getParsed } from './parseCache';

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

export function resolveSymbolReferences(
    document: vscode.TextDocument,
    position: vscode.Position
): ResolvedSymbolReferences | undefined {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) {
        return undefined;
    }

    const symbolName = document.getText(wordRange);
    if (!symbolName) {
        return undefined;
    }

    const symbolTable = ASTManager.getInstance().parseDocument(document).symbolTable;
    const targetSymbol = resolveVisibleSymbol(symbolTable, symbolName, position);
    if (!targetSymbol) {
        return undefined;
    }

    const declarationRange = getDeclarationRange(targetSymbol);
    const { tokens: tokenStream } = getParsed(document);
    const matches: SymbolReferenceMatch[] = [];

    for (const token of tokenStream.getTokens()) {
        if (token.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) {
            continue;
        }

        if (token.type !== LPCLexer.Identifier || token.text !== symbolName) {
            continue;
        }

        const range = new vscode.Range(
            document.positionAt(token.startIndex),
            document.positionAt(token.stopIndex + 1)
        );
        const resolvedSymbol = resolveVisibleSymbol(symbolTable, symbolName, range.start);
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
        wordRange,
        matches
    };
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
