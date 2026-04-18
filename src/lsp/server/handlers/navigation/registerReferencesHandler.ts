import type { Location, ReferenceParams } from 'vscode-languageserver/node';
import { toLspLocation } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type ReferencesConnection = {
    onReferences(handler: (params: ReferenceParams) => Promise<Location[]>): unknown;
};

export interface ReferencesRegistrationContext {
    connection: ReferencesConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    navigationService: LanguageNavigationService;
}

export function registerReferencesHandler(context: ReferencesRegistrationContext): void {
    const { connection, contextFactory, navigationService } = context;

    connection.onReferences(async (params: ReferenceParams): Promise<Location[]> => {
        const references = await navigationService.provideReferences({
            context: contextFactory.createCapabilityContext(params.textDocument.uri),
            position: {
                line: params.position.line,
                character: params.position.character
            },
            includeDeclaration: params.context.includeDeclaration
        });

        return references.map(reference => toLspLocation(reference));
    });
}
