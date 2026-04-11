import type {
    Connection,
    DocumentFormattingParams,
    DocumentRangeFormattingParams,
    TextEdit
} from 'vscode-languageserver/node';
import type { LanguageFormattingService } from '../../../../language/services/formatting/LanguageFormattingService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';

type FormattingConnection = Pick<Connection, 'onDocumentFormatting' | 'onDocumentRangeFormatting'>;

export interface FormattingRegistrationContext {
    connection: FormattingConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    formattingService: LanguageFormattingService;
}

export function registerFormattingHandlers(context: FormattingRegistrationContext): void {
    const { connection, documentStore, formattingService } = context;

    connection.onDocumentFormatting(async (params: DocumentFormattingParams): Promise<TextEdit[] | undefined> => {
        const document = documentStore.get(params.textDocument.uri);
        if (!document) {
            return undefined;
        }

        const edits = await formattingService.formatDocument({
            document: {
                uri: document.uri,
                version: document.version,
                getText: () => document.text
            }
        });

        return toLspTextEdits(edits);
    });

    connection.onDocumentRangeFormatting(async (params: DocumentRangeFormattingParams): Promise<TextEdit[] | undefined> => {
        const document = documentStore.get(params.textDocument.uri);
        if (!document) {
            return undefined;
        }

        const edits = await formattingService.formatRange({
            document: {
                uri: document.uri,
                version: document.version,
                getText: () => document.text
            },
            range: {
                start: {
                    line: params.range.start.line,
                    character: params.range.start.character
                },
                end: {
                    line: params.range.end.line,
                    character: params.range.end.character
                }
            }
        });

        return toLspTextEdits(edits);
    });
}

function toLspTextEdits(
    edits: readonly {
        range: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
        newText: string;
    }[]
): TextEdit[] {
    return edits.map((edit) => ({
        range: {
            start: {
                line: edit.range.start.line,
                character: edit.range.start.character
            },
            end: {
                line: edit.range.end.line,
                character: edit.range.end.character
            }
        },
        newText: edit.newText
    }));
}
