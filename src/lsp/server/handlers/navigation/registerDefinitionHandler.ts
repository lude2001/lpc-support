import type { Definition, DefinitionParams } from 'vscode-languageserver/node';
import { toLspLocation } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type DefinitionConnection = {
    onDefinition(handler: (params: DefinitionParams) => Promise<Definition>): unknown;
};

export interface DefinitionRegistrationContext {
    connection: DefinitionConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    navigationService: LanguageNavigationService;
}

export function registerDefinitionHandler(context: DefinitionRegistrationContext): void {
    const { connection, contextFactory, navigationService } = context;

    connection.onDefinition(async (params: DefinitionParams): Promise<Definition> => {
        const locations = await navigationService.provideDefinition({
            context: contextFactory.createCapabilityContext(params.textDocument.uri),
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
