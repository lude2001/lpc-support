import * as vscode from 'vscode';
import type { LanguageDiagnostic } from '../../services/diagnostics/LanguageDiagnosticsService';

export function toVsCodeDiagnostics(diagnostics: LanguageDiagnostic[]): vscode.Diagnostic[] {
    return diagnostics.map((diagnostic) => {
        const range = new vscode.Range(
            diagnostic.range.start.line,
            diagnostic.range.start.character,
            diagnostic.range.end.line,
            diagnostic.range.end.character
        );
        const vscodeDiagnostic = new vscode.Diagnostic(
            range,
            diagnostic.message,
            diagnostic.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : diagnostic.severity === 'warning'
                    ? vscode.DiagnosticSeverity.Warning
                    : diagnostic.severity === 'information'
                        ? vscode.DiagnosticSeverity.Information
                        : vscode.DiagnosticSeverity.Hint
        );

        if (diagnostic.code) {
            vscodeDiagnostic.code = diagnostic.code;
        }

        if (diagnostic.source) {
            vscodeDiagnostic.source = diagnostic.source;
        }

        if (typeof diagnostic.data !== 'undefined') {
            (vscodeDiagnostic as vscode.Diagnostic & { data?: unknown }).data = diagnostic.data;
        }

        return vscodeDiagnostic;
    });
}
