import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { Symbol } from '../ast/symbolTable';
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

        const declarator = this.findDeclarator(snapshot.syntax.nodes, symbol, identifierName);
        if (!declarator) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        const initializer = declarator.children[1];
        if (!initializer || !this.isSupportedGlobalInitializer(initializer)) {
            return {
                candidates: [],
                hasVisibleBinding: true
            };
        }

        const outcome = await this.returnObjectResolver.resolveExpressionOutcome(document, initializer);
        return {
            ...outcome,
            hasVisibleBinding: true
        };
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

    private isSupportedGlobalInitializer(node: SyntaxNode): boolean {
        if (node.kind === SyntaxKind.ParenthesizedExpression && node.children[0]) {
            return this.isSupportedGlobalInitializer(node.children[0]);
        }

        return node.kind === SyntaxKind.CallExpression
            && node.children[0]?.kind === SyntaxKind.Identifier
            && node.children[0].name === 'load_object';
    }

    private rangesEqual(left: vscode.Range, right: vscode.Range): boolean {
        return left.start.isEqual(right.start) && left.end.isEqual(right.end);
    }
}
