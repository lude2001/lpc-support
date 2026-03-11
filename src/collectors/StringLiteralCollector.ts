import * as vscode from 'vscode';
import { DiagnosticContext, IDiagnosticCollector } from '../diagnostics/types';
import { ParsedDocument } from '../parser/types';
import { SyntaxKind } from '../syntax/types';

const MULTILINE_STRING_PREFIX = '@text';
const MULTILINE_STRING_SUFFIX = 'text@';

/**
 * 检查 LPC 多行字符串语法问题
 */
export class StringLiteralCollector implements IDiagnosticCollector {
    public readonly name = 'StringLiteralCollector';

    collect(
        _document: vscode.TextDocument,
        _parsed: ParsedDocument,
        context?: DiagnosticContext
    ): vscode.Diagnostic[] {
        const syntax = context?.syntax;
        if (!syntax) {
            return [];
        }

        const diagnostics: vscode.Diagnostic[] = [];
        for (const node of syntax.nodes) {
            if (node.kind !== SyntaxKind.Literal) {
                continue;
            }

            const literalText = typeof node.metadata?.text === 'string'
                ? node.metadata.text.trim()
                : '';
            if (!this.isMultilineStringLiteral(literalText)) {
                continue;
            }

            if (!this.extractMultilineStringContent(literalText).trim()) {
                diagnostics.push(new vscode.Diagnostic(
                    node.range,
                    '空的多行字符串',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }

        return diagnostics;
    }

    private isMultilineStringLiteral(text: string): boolean {
        return text.startsWith(MULTILINE_STRING_PREFIX) && text.endsWith(MULTILINE_STRING_SUFFIX);
    }

    private extractMultilineStringContent(text: string): string {
        return text.slice(MULTILINE_STRING_PREFIX.length, text.length - MULTILINE_STRING_SUFFIX.length);
    }
}
