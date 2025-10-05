import * as vscode from 'vscode';
import { ParsedDoc } from '../parseCache';
import { IDiagnosticCollector } from '../diagnostics/types';

/**
 * 检查 LPC 多行字符串语法问题
 */
export class StringLiteralCollector implements IDiagnosticCollector {
    public readonly name = 'StringLiteralCollector';

    collect(document: vscode.TextDocument, _parsed: ParsedDoc): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const multilineStringRegex = /@text\s*(.*?)\s*text@/gs;
        let match: RegExpExecArray | null;
        while ((match = multilineStringRegex.exec(text)) !== null) {
            const content = match[1];
            if (!content.trim()) {
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(
                        document.positionAt(match.index),
                        document.positionAt(match.index + match[0].length)
                    ),
                    '空的多行字符串',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
        return diagnostics;
    }
}
