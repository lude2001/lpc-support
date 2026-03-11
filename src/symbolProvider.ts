import * as vscode from 'vscode';
import { ASTManager } from './ast/astManager';
import { TypeDefinitionSummary } from './completion/types';

export class LPCSymbolProvider implements vscode.DocumentSymbolProvider {
    private readonly astManager = ASTManager.getInstance();

    public provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        const snapshot = this.astManager.getBestAvailableSnapshot(document);

        for (const typeDefinition of snapshot.typeDefinitions) {
            symbols.push(this.createTypeSymbol(typeDefinition));
        }

        for (const func of snapshot.exportedFunctions) {
            symbols.push(
                new vscode.DocumentSymbol(
                    func.name,
                    func.returnType,
                    vscode.SymbolKind.Function,
                    func.range,
                    func.range
                )
            );
        }

        return symbols;
    }

    private createTypeSymbol(typeDefinition: TypeDefinitionSummary): vscode.DocumentSymbol {
        const kind = typeDefinition.kind === 'class'
            ? vscode.SymbolKind.Class
            : vscode.SymbolKind.Struct;
        const symbol = new vscode.DocumentSymbol(
            typeDefinition.name,
            typeDefinition.kind,
            kind,
            typeDefinition.range,
            typeDefinition.range
        );

        symbol.children = typeDefinition.members.map((member) => new vscode.DocumentSymbol(
            member.name,
            member.dataType,
            member.parameters && member.parameters.length > 0
                ? vscode.SymbolKind.Method
                : vscode.SymbolKind.Field,
            member.range,
            member.range
        ));

        return symbol;
    }
}
