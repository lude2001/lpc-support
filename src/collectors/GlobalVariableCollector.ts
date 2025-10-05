import * as vscode from 'vscode';
import { ParsedDoc } from '../parseCache';
import { IDiagnosticCollector } from '../diagnostics/types';
import { FunctionDefContext, VariableDeclContext, SourceFileContext, VariableDeclaratorContext } from '../antlr/LPCParser';
import { LPCLexer } from '../antlr/LPCLexer';

/**
 * 检测全局变量是否未使用。
 * 规则：源文件顶层 (非函数内部) 的 variableDecl 声明的变量若未在其他位置被引用，则给出提示。
 */
export class GlobalVariableCollector implements IDiagnosticCollector {
    public readonly name = 'GlobalVariableCollector';

    collect(document: vscode.TextDocument, parsed: ParsedDoc): vscode.Diagnostic[] {
        const cfg = vscode.workspace.getConfiguration('lpc');
        if (cfg.get<boolean>('enableUnusedGlobalVarCheck') === false) {
            return [];
        }
        const diagnostics: vscode.Diagnostic[] = [];
        const { tree, tokens } = parsed;

        if (!(tree instanceof SourceFileContext)) {
            return diagnostics;
        }

        // 收集顶层 VariableDeclContext
        const declared: Map<string, import('antlr4ts').Token> = new Map();

        for (const stmt of tree.statement()) {
            const vd = stmt.variableDecl();
            if (!vd) continue; // 不是变量声明

            // 确认该声明不在函数体内 (顶层 statement 已确保)
            this.collectFromVariableDecl(vd, declared);
        }

        if (declared.size === 0) return diagnostics;

        // 遍历 token 流，寻找使用
        const used = new Set<string>();
        for (const tok of tokens.getTokens()) {
            if (tok.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) continue;
            if (tok.type !== LPCLexer.Identifier) continue;
            const word = tok.text ?? '';
            if (declared.has(word)) {
                // 跳过声明本身
                const declTok = declared.get(word)!;
                if (tok.startIndex === declTok.startIndex) continue;
                used.add(word);
            }
        }

        // 报告未使用
        for (const [name, tok] of declared) {
            if (used.has(name)) continue;
            const range = new vscode.Range(
                document.positionAt(tok.startIndex),
                document.positionAt(tok.stopIndex + 1)
            );
            const diag = new vscode.Diagnostic(
                range,
                `全局变量 '${name}' 未被使用`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.code = 'unusedGlobalVar';
            (diag as any).data = {
                kind: 'global',
                start: tok.startIndex,
                end: tok.stopIndex + 1
            };
            diagnostics.push(diag);
        }
        return diagnostics;
    }

    private collectFromVariableDecl(
        vd: VariableDeclContext,
        map: Map<string, import('antlr4ts').Token>
    ) {
        for (const declarator of vd.variableDeclarator()) {
            const id = declarator.Identifier();
            if (id) {
                map.set(id.text ?? '', id.symbol);
            }
        }
    }
}
