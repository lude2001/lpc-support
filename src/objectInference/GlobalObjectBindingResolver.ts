import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { Symbol, SymbolTable } from '../ast/symbolTable';
import { resolveVisibleSymbol } from '../symbolReferenceResolver';
import { SyntaxKind, SyntaxNode } from '../syntax/types';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';

interface GlobalBindingResolution extends ObjectResolutionOutcome {
    hasVisibleBinding: boolean;
}

export class GlobalObjectBindingResolver {
    private readonly astManager = ASTManager.getInstance();

    constructor(private readonly returnObjectResolver: ReturnObjectResolver) {}

    public async resolveVisibleBinding(
        document: vscode.TextDocument,
        identifierName: string,
        position: vscode.Position
    ): Promise<GlobalBindingResolution | undefined> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const symbol = resolveVisibleSymbol(snapshot.symbolTable, identifierName, position);
        if (!symbol || !this.isVisibleGlobalObjectSymbol(snapshot.symbolTable.getGlobalScope(), symbol)) {
            return undefined;
        }

        return this.resolveGlobalBindingFromSymbol(
            document,
            snapshot.symbolTable,
            snapshot.syntax.nodes,
            symbol,
            identifierName,
            new Set()
        );
    }

    private isVisibleGlobalObjectSymbol(globalScope: Symbol['scope'], symbol: Symbol): boolean {
        return symbol.type === 'variable'
            && symbol.scope === globalScope
            && symbol.dataType === 'object';
    }

    private findDeclarator(
        nodes: readonly SyntaxNode[],
        symbol: Symbol,
        identifierName: string
    ): SyntaxNode | undefined {
        return nodes.find((node) =>
            node.kind === SyntaxKind.VariableDeclarator
            && node.name === identifierName
            && this.rangesEqual(node.range, symbol.range)
        );
    }

    private async resolveGlobalBindingFromSymbol(
        document: vscode.TextDocument,
        symbolTable: SymbolTable,
        nodes: readonly SyntaxNode[],
        symbol: Symbol,
        identifierName: string,
        visited: Set<string>
    ): Promise<GlobalBindingResolution> {
        const visitKey = this.getVisitKey(symbol, identifierName);
        if (visited.has(visitKey)) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        visited.add(visitKey);

        const declarator = this.findDeclarator(nodes, symbol, identifierName);
        if (!declarator) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        const initializer = declarator.children[1];
        if (!initializer) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        const unwrappedInitializer = this.unwrapParenthesizedExpression(initializer);
        if (unwrappedInitializer.kind === SyntaxKind.Identifier && unwrappedInitializer.name) {
            const aliasSymbol = this.findVisibleGlobalObjectSymbolByName(
                symbolTable,
                symbol.scope,
                unwrappedInitializer.name
            );
            if (!aliasSymbol) {
                return {
                    candidates: [],
                    hasVisibleBinding: true
                };
            }

            return this.resolveGlobalBindingFromSymbol(
                document,
                symbolTable,
                nodes,
                aliasSymbol,
                unwrappedInitializer.name,
                visited
            );
        }

        const outcome = await this.returnObjectResolver.resolveExpressionOutcome(document, unwrappedInitializer);
        return {
            ...outcome,
            hasVisibleBinding: true
        };
    }

    private findVisibleGlobalObjectSymbolByName(
        symbolTable: SymbolTable,
        globalScope: Symbol['scope'],
        identifierName: string
    ): Symbol | undefined {
        const symbol = symbolTable.getGlobalScope().symbols.get(identifierName);
        if (!symbol || !this.isVisibleGlobalObjectSymbol(globalScope, symbol)) {
            return undefined;
        }

        return symbol;
    }

    private unwrapParenthesizedExpression(node: SyntaxNode): SyntaxNode {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.unwrapParenthesizedExpression(node.children[0]);
        }

        return node;
    }

    private getVisitKey(symbol: Symbol, identifierName: string): string {
        return `${identifierName}:${symbol.range.start.line}:${symbol.range.start.character}:${symbol.range.end.line}:${symbol.range.end.character}`;
    }

    private rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
        return left.start.isEqual(right.start) && left.end.isEqual(right.end);
    }
}
