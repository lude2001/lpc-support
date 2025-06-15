import * as vscode from 'vscode';
import { getParsed } from './parseCache';
import { FunctionDefContext } from './antlr/LPCParser';

export class LPCSymbolProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const { tree } = getParsed(document);

        const symbols: vscode.DocumentSymbol[] = [];

        for (const stmt of tree.statement()) {
            const funcCtx: FunctionDefContext | undefined = stmt.functionDef();
            if (!funcCtx) continue;

            const idToken = funcCtx.Identifier().symbol;
            const funcName = idToken.text || 'function';
            const returnType = funcCtx.typeSpec()?.text || '';

            const start = document.positionAt(funcCtx.start.startIndex);
            const end = document.positionAt(funcCtx.stop!.stopIndex + 1);
            const nameStart = document.positionAt(idToken.startIndex);
            const nameEnd = document.positionAt(idToken.stopIndex + 1);

            const fullRange = new vscode.Range(start, end);
            const nameRange = new vscode.Range(nameStart, nameEnd);

            symbols.push(
                new vscode.DocumentSymbol(
                    funcName,
                    returnType,
                    vscode.SymbolKind.Function,
                    fullRange,
                    nameRange
                )
            );
        }

        return symbols;
    }
} 