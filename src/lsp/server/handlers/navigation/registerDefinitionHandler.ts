import type { Definition, DefinitionParams } from 'vscode-languageserver/node';
import { toLspLocation } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from './navigationHandlerContext';

type DefinitionConnection = {
    onDefinition(handler: (params: DefinitionParams) => Promise<Definition>): unknown;
};

export interface DefinitionRegistrationContext {
    connection: DefinitionConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    navigationService: LanguageNavigationService;
}

export function registerDefinitionHandler(context: DefinitionRegistrationContext): void {
    const { connection, documentStore, workspaceSession, navigationService } = context;

    connection.onDefinition(async (params: DefinitionParams): Promise<Definition> => {
        const locations = await navigationService.provideDefinition({
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

        if (locations.length === 0) {
            return [];
        }

        const converted = locations.map(location => toLspLocation(location));
        return converted.length === 1 ? converted[0] : converted;
    });
}
