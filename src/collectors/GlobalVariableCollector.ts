import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../diagnostics/types';
import { SymbolType } from '../ast/symbolTable';
import { ParsedDocument } from '../parser/types';
import { attachSymbolDiagnosticData, createOffsetData, createSymbolUsageIndex } from './symbolUsageSupport';

/**
 * 检测全局变量是否未使用。
 * 规则：语义摘要中的文件级变量若未在其他位置被引用，则给出提示。
 */
export class GlobalVariableCollector implements IDiagnosticCollector {
    public readonly name = 'GlobalVariableCollector';

    collect(document: vscode.TextDocument, _parsed: ParsedDocument, context?: DiagnosticContext): vscode.Diagnostic[] {
        const cfg = vscode.workspace.getConfiguration('lpc');
        if (cfg.get<boolean>('enableUnusedGlobalVarCheck') === false) {
            return [];
        }

        const syntax = context?.syntax;
        const semantic = context?.semantic;
        if (!syntax || !semantic) {
            return [];
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const globalScope = semantic.symbolTable.getGlobalScope();
        const usageIndex = createSymbolUsageIndex(syntax);

        for (const symbol of Array.from(globalScope.symbols.values())) {
            if (symbol.type !== SymbolType.VARIABLE) {
                continue;
            }

            const range = symbol.selectionRange ?? symbol.range;
            if (usageIndex.hasUse(symbol, globalScope.range)) {
                continue;
            }

            const diag = new vscode.Diagnostic(
                range,
                `全局变量 '${symbol.name}' 未被使用`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'unusedGlobalVar';
            attachSymbolDiagnosticData(diag, 'global', createOffsetData(document, range));
            diagnostics.push(diag);
        }

        return diagnostics;
    }
}
