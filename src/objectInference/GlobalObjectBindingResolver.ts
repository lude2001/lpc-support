import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { Symbol, SymbolType } from '../ast/symbolTable';
import { resolveVisibleSymbol } from '../symbolReferenceResolver';
import { SyntaxKind } from '../syntax/types';
import { ObjectMethodReturnResolver } from './ObjectMethodReturnResolver';
import { ObjectResolutionOutcome, ReturnObjectResolver } from './ReturnObjectResolver';

interface GlobalBindingResolution {
    hasVisibleBinding: boolean;
    outcome: ObjectResolutionOutcome;
}

export class GlobalObjectBindingResolver {
    private readonly astManager = ASTManager.getInstance();

    constructor(
        private readonly returnObjectResolver: ReturnObjectResolver,
        private readonly objectMethodReturnResolver: ObjectMethodReturnResolver
    ) {}

    public async resolveIdentifierOutcome(
        document: vscode.TextDocument,
        identifierName: string,
        position: vscode.Position
    ): Promise<GlobalBindingResolution> {
        return this.resolveIdentifierOutcomeInternal(
            document,
            identifierName,
            position,
            new Set<string>()
        );
    }

    private async resolveIdentifierOutcomeInternal(
        document: vscode.TextDocument,
        identifierName: string,
        position: vscode.Position,
        visited: Set<string>
    ): Promise<GlobalBindingResolution> {
        const snapshot = this.astManager.getSemanticSnapshot(document, false);
        const visibleSymbol = resolveVisibleSymbol(snapshot.symbolTable, identifierName, position);
        if (!visibleSymbol || visibleSymbol.type !== SymbolType.VARIABLE || visibleSymbol.scope.name !== 'global') {
            return { hasVisibleBinding: false, outcome: { candidates: [] } };
        }

        if (!this.isObjectTypedSymbol(visibleSymbol)) {
            return { hasVisibleBinding: false, outcome: { candidates: [] } };
        }

        const declarator = [...snapshot.syntax.nodes]
            .filter((node) => node.kind === SyntaxKind.VariableDeclarator && node.name === identifierName)
            .find((node) =>
                node.range.contains(visibleSymbol.selectionRange?.start ?? visibleSymbol.range.start)
                || (visibleSymbol.selectionRange !== undefined && Boolean(node.range.intersection(visibleSymbol.selectionRange)))
            );

        if (!declarator) {
            return {
                hasVisibleBinding: true,
                outcome: { candidates: [] }
            };
        }

        return {
            hasVisibleBinding: true,
            outcome: { candidates: [] }
        };
    }

    private isObjectTypedSymbol(symbol: Symbol): boolean {
        if (symbol.type !== SymbolType.VARIABLE) {
            return false;
        }

        const dataType = symbol.dataType.trim().toLowerCase();
        return dataType === 'object';
    }
}
