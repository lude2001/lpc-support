import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../diagnostics/types';
import { ParsedDocument } from '../parser/types';
import { Symbol, SymbolType } from '../ast/symbolTable';
import { attachSymbolDiagnosticData, createOffsetData, createSymbolUsageIndex } from './symbolUsageSupport';

/**
 * 使用统一 syntax / semantic 前端检测局部未使用变量。
 */
export class UnusedVariableCollector implements IDiagnosticCollector {
    public readonly name = 'UnusedVariableCollector';

    collect(document: vscode.TextDocument, _parsed: ParsedDocument, context?: DiagnosticContext): vscode.Diagnostic[] {
        const syntax = context?.syntax;
        const semantic = context?.semantic;
        if (!syntax || !semantic) {
            return [];
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const usageIndex = createSymbolUsageIndex(syntax);

        for (const symbol of semantic.symbolTable.getAllSymbols()) {
            if (!this.isLocalVariable(symbol, semantic.symbolTable.getGlobalScope())) {
                continue;
            }

            const range = symbol.selectionRange ?? symbol.range;
            if (usageIndex.hasUse(symbol, symbol.scope.range)) {
                continue;
            }

            const diagnostic = new vscode.Diagnostic(
                range,
                `局部变量 '${symbol.name}' 未被使用`,
                vscode.DiagnosticSeverity.Information
            );
            diagnostic.code = 'unusedVar';
            attachSymbolDiagnosticData(diagnostic, 'var', createOffsetData(document, range));
            diagnostics.push(diagnostic);
        }

        return diagnostics;
    }

    private isLocalVariable(symbol: Symbol, globalScope: Symbol['scope']): boolean {
        return symbol.type === SymbolType.VARIABLE
            && symbol.scope !== globalScope
            && symbol.documentation !== 'foreach 迭代变量';
    }
}
