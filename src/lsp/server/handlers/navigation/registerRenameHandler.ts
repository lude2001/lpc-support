import type { PrepareRenameResult, PrepareRenameParams, RenameParams, WorkspaceEdit } from 'vscode-languageserver/node';
import { toLspRange } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type RenameConnection = {
    onPrepareRename(handler: (params: PrepareRenameParams) => Promise<PrepareRenameResult | undefined>): unknown;
    onRenameRequest(handler: (params: RenameParams) => Promise<WorkspaceEdit>): unknown;
};

export interface RenameRegistrationContext {
    connection: RenameConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    navigationService: LanguageNavigationService;
}

export function registerRenameHandler(context: RenameRegistrationContext): void {
    const { connection, contextFactory, navigationService } = context;

    connection.onPrepareRename(async (params: PrepareRenameParams): Promise<PrepareRenameResult | undefined> => {
        const result = await navigationService.prepareRename({
            context: contextFactory.createCapabilityContext(params.textDocument.uri),
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
            context: contextFactory.createCapabilityContext(params.textDocument.uri),
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
