import type { Location, ReferenceParams } from 'vscode-languageserver/node';
import { toLspLocation } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from './navigationHandlerContext';

type ReferencesConnection = {
    onReferences(handler: (params: ReferenceParams) => Promise<Location[]>): unknown;
};

export interface ReferencesRegistrationContext {
    connection: ReferencesConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    navigationService: LanguageNavigationService;
}

export function registerReferencesHandler(context: ReferencesRegistrationContext): void {
    const { connection, documentStore, workspaceSession, navigationService } = context;

    connection.onReferences(async (params: ReferenceParams): Promise<Location[]> => {
        const references = await navigationService.provideReferences({
            context: createNavigationCapabilityContext(
                params.textDocument.uri,
                documentStore,
                workspaceSession
            ),
            position: {
                line: params.position.line,
                character: params.position.character
            },
            includeDeclaration: params.context.includeDeclaration
        });

        return references.map(reference => toLspLocation(reference));
    });
}
