import * as vscode from 'vscode';
import { ASTManager } from '../../../ast/astManager';
import type { DiagnosticContext, IDiagnosticCollector } from '../../../diagnostics/types';
import type { ParsedDocument } from '../../../parser/types';
import type {
    LanguageDiagnostic,
    LanguageDiagnosticsAnalysis,
    LanguageDiagnosticsCollector,
    LanguageDiagnosticsService
} from './LanguageDiagnosticsService';
import { createLanguageDiagnosticsService } from './LanguageDiagnosticsService';

function toLanguageDiagnostic(diagnostic: vscode.Diagnostic): LanguageDiagnostic {
    return {
        range: {
            start: {
                line: diagnostic.range.start.line,
                character: diagnostic.range.start.character
            },
            end: {
                line: diagnostic.range.end.line,
                character: diagnostic.range.end.character
            }
        },
        severity: diagnostic.severity === vscode.DiagnosticSeverity.Error
            ? 'error'
            : diagnostic.severity === vscode.DiagnosticSeverity.Warning
                ? 'warning'
                : diagnostic.severity === vscode.DiagnosticSeverity.Information
                    ? 'information'
                    : 'hint',
        message: diagnostic.message,
        code: typeof diagnostic.code === 'string'
            ? diagnostic.code
            : typeof diagnostic.code === 'number'
                ? String(diagnostic.code)
                : undefined,
        source: diagnostic.source,
        data: (diagnostic as vscode.Diagnostic & { data?: unknown }).data
    };
}

function toLanguageDiagnosticArray(diagnostics: readonly vscode.Diagnostic[]): LanguageDiagnostic[] {
    return diagnostics.map(toLanguageDiagnostic);
}

function toHostDocument(document: { uri: string; version: number; getText(): string }): vscode.TextDocument {
    const text = document.getText();
    const lines = text.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? text.length;
        return Math.min(lineStart + position.character, text.length);
    };

    return {
        uri: vscode.Uri.parse(document.uri),
        fileName: vscode.Uri.parse(document.uri).fsPath || document.uri,
        languageId: 'lpc',
        version: document.version,
        lineCount: lines.length,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return text;
            }

            return text.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        },
        positionAt: (offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        },
        offsetAt: (position: vscode.Position) => offsetAt(position),
        getWordRangeAtPosition: (position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        }
    } as vscode.TextDocument;
}

function toDiagnosticContext(
    parsed: ParsedDocument,
    analysis: { syntax?: unknown; semantic?: unknown }
): DiagnosticContext {
    return {
        parsed,
        syntax: analysis.syntax as DiagnosticContext['syntax'],
        semantic: analysis.semantic as DiagnosticContext['semantic']
    };
}

function toLanguageDiagnosticsAnalysis(
    astManager: ASTManager,
    document: { uri: string; version: number; getText(): string }
): LanguageDiagnosticsAnalysis & { parsed?: ParsedDocument } {
    const hostDocument = toHostDocument(document);
    const analysis = astManager.parseDocument(hostDocument);

    return {
        syntax: analysis.syntax as unknown as LanguageDiagnosticsAnalysis['syntax'],
        semantic: analysis.semantic as unknown as LanguageDiagnosticsAnalysis['semantic'],
        parseDiagnostics: toLanguageDiagnosticArray(analysis.snapshot.parseDiagnostics),
        ...(analysis.parsed ? { parsed: analysis.parsed } : {})
    };
}

function toLanguageDiagnosticsCollector(collector: IDiagnosticCollector): LanguageDiagnosticsCollector {
    return {
        async collect(document, analysis, context) {
            const parsed = (analysis as LanguageDiagnosticsAnalysis & { parsed?: ParsedDocument }).parsed;
            if (!parsed) {
                return [];
            }

            const hostDocument = toHostDocument(document);
            const diagnosticContext = toDiagnosticContext(parsed, {
                syntax: analysis.syntax,
                semantic: analysis.semantic
            });
            const result = await collector.collect(hostDocument, parsed, diagnosticContext);
            return toLanguageDiagnosticArray(result);
        }
    };
}

export function createSharedDiagnosticsService(
    astManager: ASTManager,
    collectors: IDiagnosticCollector[]
): LanguageDiagnosticsService {
    return createLanguageDiagnosticsService({
        analyzeDocument: {
            analyze: (document) => toLanguageDiagnosticsAnalysis(astManager, document)
        },
        collectors: collectors.map((collector) => toLanguageDiagnosticsCollector(collector))
    });
}
