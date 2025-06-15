import * as vscode from 'vscode';
import { ParsedDoc } from '../parseCache';
import { FunctionDefContext, ParameterContext } from '../antlr/LPCParser';
import { LPCLexer } from '../antlr/LPCLexer';

/**
 * 检测函数参数未使用 (基于 ANTLR 语法树)
 */
export class UnusedParameterCollector {
    collect(document: vscode.TextDocument, parsed: ParsedDoc): vscode.Diagnostic[] {
        const cfg = vscode.workspace.getConfiguration('lpc');
        if (cfg.get<boolean>('enableUnusedParameterCheck') === false) {
            return [];
        }
        const diagnostics: vscode.Diagnostic[] = [];
        const { tree, tokens } = parsed;

        const visit = (ctx: any) => {
            if (ctx instanceof FunctionDefContext) {
                this.collectInFunction(ctx, tokens, document, diagnostics);
            }
            for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                const child = ctx.getChild(i);
                if (child && typeof child === 'object' && child.symbol === undefined) {
                    visit(child);
                }
            }
        };
        visit(tree);
        return diagnostics;
    }

    private collectInFunction(
        funcCtx: FunctionDefContext,
        tokenStream: import('antlr4ts').CommonTokenStream,
        document: vscode.TextDocument,
        diagnostics: vscode.Diagnostic[]
    ) {
        const params: Map<string, import('antlr4ts').Token> = new Map();
        const paramListCtx = funcCtx.parameterList();
        if (paramListCtx) {
            for (const param of paramListCtx.parameter()) {
                const idToken = param.Identifier()?.symbol;
                if (idToken) {
                    params.set(idToken.text ?? '', idToken);
                }
            }
        }
        if (params.size === 0) return;

        const funcEnd = funcCtx.stop ? funcCtx.stop.stopIndex : undefined;
        const used = new Set<string>();

        for (const tok of tokenStream.getTokens()) {
            if (tok.channel !== LPCLexer.DEFAULT_TOKEN_CHANNEL) continue;
            if (tok.type !== LPCLexer.Identifier) continue;
            if (!funcEnd || tok.startIndex > funcEnd) continue;
            const word = tok.text ?? '';
            if (params.has(word)) {
                const declTok = params.get(word)!;
                if (tok.startIndex === declTok.startIndex) continue;
                used.add(word);
            }
        }

        for (const [name, tok] of params) {
            if (used.has(name)) continue;
            const range = new vscode.Range(
                document.positionAt(tok.startIndex),
                document.positionAt(tok.stopIndex + 1)
            );
            const diag = new vscode.Diagnostic(
                range,
                `参数 '${name}' 未被使用`,
                vscode.DiagnosticSeverity.Information
            );
            diag.code = 'unusedParam';
            (diag as any).data = {
                kind: 'param',
                start: tok.startIndex,
                end: tok.stopIndex + 1
            };
            diagnostics.push(diag);
        }
    }
} 