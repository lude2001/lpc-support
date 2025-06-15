import * as vscode from 'vscode';
import { ParsedDoc } from '../parseCache';
import { FunctionDefContext } from '../antlr/LPCParser';

/**
 * 检查 apply 函数的返回类型是否符合 LPC 规范
 */
export class ApplyFunctionReturnCollector {
    private expectedReturnMap: Record<string, string> = {
        create: 'void',
        setup: 'void',
        init: 'void',
        clean_up: 'void',
        reset: 'void',
        receive_object: 'void',
        move_object: 'void',
        can_move: 'int',
        valid_move: 'int',
        query_heart_beat: 'int',
        set_heart_beat: 'void',
        catch_tell: 'void',
        receive_message: 'void',
        write_prompt: 'void',
        process_input: 'void',
        do_command: 'int',
        logon: 'void',
        connect: 'void',
        disconnect: 'void',
        net_dead: 'void',
        terminal_type: 'void',
        window_size: 'void',
        receive_snoop: 'void',
        valid_override: 'int',
        valid_seteuid: 'int',
        valid_shadow: 'int',
        query_prevent_shadow: 'int',
        valid_bind: 'int',
        virtual_start: 'void',
        epilog: 'void',
        preload: 'string',
        valid_read: 'int',
        valid_write: 'int'
    };

    collect(document: vscode.TextDocument, parsed: ParsedDoc): vscode.Diagnostic[] {
        // 用户设置：lpc.enableApplyReturnCheck （默认启用）
        const cfg = vscode.workspace.getConfiguration('lpc');
        if (cfg.get<boolean>('enableApplyReturnCheck') === false) {
            return [];
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const { tree } = parsed;

        const visit = (ctx: any) => {
            if (ctx instanceof FunctionDefContext) {
                const nameToken = ctx.Identifier().symbol;
                const funcName = nameToken.text;
                if (funcName && this.expectedReturnMap[funcName]) {
                    const expected = this.expectedReturnMap[funcName];
                    const typeCtx = ctx.typeSpec();
                    const actual = typeCtx ? document.getText(new vscode.Range(
                        document.positionAt(typeCtx.start.startIndex),
                        document.positionAt((typeCtx.stop?.stopIndex ?? typeCtx.start.stopIndex) + 1)
                    )) : 'void'; // 默认为 void

                    if (actual !== expected) {
                        const range = new vscode.Range(
                            document.positionAt(nameToken.startIndex),
                            document.positionAt(nameToken.stopIndex + 1)
                        );
                        diagnostics.push(new vscode.Diagnostic(
                            range,
                            `apply 函数 '${funcName}' 返回类型应为 '${expected}'，当前为 '${actual}'`,
                            vscode.DiagnosticSeverity.Warning
                        ));
                    }
                }
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
} 