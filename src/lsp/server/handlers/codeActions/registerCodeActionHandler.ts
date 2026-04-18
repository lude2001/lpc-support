import {
    CodeActionKind,
    DiagnosticSeverity,
    type CodeAction,
    type CodeActionParams,
    type Connection
} from 'vscode-languageserver/node';
import type { LanguageCodeActionService } from '../../../../language/services/codeActions/LanguageCodeActionService';
import type { LanguageDiagnostic } from '../../../../language/services/diagnostics/LanguageDiagnosticsService';
import { DocumentStore } from '../../runtime/DocumentStore';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type CodeActionConnection = Pick<Connection, 'onCodeAction'>;

export interface CodeActionRegistrationContext {
    connection: CodeActionConnection;
    documentStore: DocumentStore;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    codeActionsService: LanguageCodeActionService;
}

export function registerCodeActionHandler(context: CodeActionRegistrationContext): void {
    const { connection, documentStore, contextFactory, codeActionsService } = context;

    connection.onCodeAction(async (params: CodeActionParams): Promise<CodeAction[]> => {
        if (!documentStore.get(params.textDocument.uri)) {
            return [];
        }

        const actions = await codeActionsService.provideCodeActions({
            context: contextFactory.createCapabilityContext(params.textDocument.uri),
            range: {
                start: {
                    line: params.range.start.line,
                    character: params.range.start.character
                },
                end: {
                    line: params.range.end.line,
                    character: params.range.end.character
                }
            },
            diagnostics: params.context.diagnostics.map(toLanguageDiagnostic),
            only: params.context.only
        });

        return actions.map((action) => ({
            title: action.title,
            kind: action.kind === 'quickfix' ? CodeActionKind.QuickFix : action.kind,
            diagnostics: action.diagnostics?.map(toLspDiagnostic),
            edit: action.edit,
            command: action.command,
            isPreferred: action.isPreferred
        }));
    });
}

function toLanguageDiagnostic(diagnostic: CodeActionParams['context']['diagnostics'][number]): LanguageDiagnostic {
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
        severity: diagnostic.severity === DiagnosticSeverity.Error
            ? 'error'
            : diagnostic.severity === DiagnosticSeverity.Warning
                ? 'warning'
                : diagnostic.severity === DiagnosticSeverity.Information
                    ? 'information'
                    : 'hint',
        message: diagnostic.message,
        code: typeof diagnostic.code === 'string'
            ? diagnostic.code
            : typeof diagnostic.code === 'number'
                ? String(diagnostic.code)
                : undefined,
        source: diagnostic.source,
        data: diagnostic.data
    };
}

function toLspDiagnostic(diagnostic: LanguageDiagnostic): CodeActionParams['context']['diagnostics'][number] {
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
        severity: diagnostic.severity === 'error'
            ? DiagnosticSeverity.Error
            : diagnostic.severity === 'warning'
                ? DiagnosticSeverity.Warning
                : diagnostic.severity === 'information'
                    ? DiagnosticSeverity.Information
                    : DiagnosticSeverity.Hint,
        message: diagnostic.message,
        code: diagnostic.code,
        source: diagnostic.source,
        data: diagnostic.data
    };
}
