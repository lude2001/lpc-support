import type { PrepareRenameResult, PrepareRenameParams, RenameParams, WorkspaceEdit } from 'vscode-languageserver/node';
import { toLspRange } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from './navigationHandlerContext';

type RenameConnection = {
    onPrepareRename(handler: (params: PrepareRenameParams) => Promise<PrepareRenameResult | undefined>): unknown;
    onRenameRequest(handler: (params: RenameParams) => Promise<WorkspaceEdit>): unknown;
};

export interface RenameRegistrationContext {
    connection: RenameConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    navigationService: LanguageNavigationService;
}

export function registerRenameHandler(context: RenameRegistrationContext): void {
    const { connection, documentStore, workspaceSession, navigationService } = context;

    connection.onPrepareRename(async (params: PrepareRenameParams): Promise<PrepareRenameResult | undefined> => {
        const result = await navigationService.prepareRename({
            context: createNavigationCapabilityContext(
                params.textDocument.uri,
                documentStore,
                workspaceSession
            ),
            position: {
                line: params.position.line,
                character: params.position.character
            }
        });

        if (!result) {
            return undefined;
        }

        return result.placeholder
            ? {
                range: toLspRange(result.range),
                placeholder: result.placeholder
            }
            : toLspRange(result.range);
    });

    connection.onRenameRequest(async (params: RenameParams): Promise<WorkspaceEdit> => {
        const result = await navigationService.provideRenameEdits({
            context: createNavigationCapabilityContext(
                params.textDocument.uri,
                documentStore,
                workspaceSession
            ),
            position: {
                line: params.position.line,
                character: params.position.character
            },
            newName: params.newName
        });

        return {
            changes: Object.fromEntries(
                Object.entries(result.changes).map(([uri, edits]) => ([
                    uri,
                    edits.map(edit => ({
                        range: toLspRange(edit.range),
                        newText: edit.newText
                    }))
                ]))
            )
        };
    });
}
