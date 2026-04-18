import {
    SemanticTokensBuilder,
    type SemanticTokens,
    type SemanticTokensParams
} from 'vscode-languageserver/node';
import type { LanguageStructureService } from '../../../../language/services/structure/LanguageFoldingService';
import type { LanguageSemanticTokensResult } from '../../../../language/services/structure/LanguageSemanticTokensService';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type SemanticTokensConnection = {
    languages: {
        semanticTokens: {
            on(handler: (params: SemanticTokensParams) => Promise<SemanticTokens>): unknown;
        };
    };
};

export interface SemanticTokensRegistrationContext {
    connection: SemanticTokensConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    structureService: LanguageStructureService;
}

export function registerSemanticTokensHandler(context: SemanticTokensRegistrationContext): void {
    const { connection, contextFactory, structureService } = context;

    connection.languages.semanticTokens.on(async (params: SemanticTokensParams): Promise<SemanticTokens> => {
        const result = await structureService.provideSemanticTokens({
            context: contextFactory.createCapabilityContext(params.textDocument.uri)
        });

        return toLspSemanticTokens(result);
    });
}

function toLspSemanticTokens(result: LanguageSemanticTokensResult): SemanticTokens {
    const builder = new SemanticTokensBuilder();
    const tokenTypeIndex = new Map<string, number>();
    const tokenModifierIndex = new Map<string, number>();

    result.legend.tokenTypes.forEach((tokenType, index) => tokenTypeIndex.set(tokenType, index));
    result.legend.tokenModifiers.forEach((tokenModifier, index) => {
        tokenModifierIndex.set(tokenModifier, index);
    });

    for (const token of result.tokens) {
        const typeIndex = tokenTypeIndex.get(token.tokenType);
        if (typeIndex === undefined) {
            continue;
        }

        const modifierMask = (token.tokenModifiers ?? []).reduce((mask, modifier) => {
            const modifierIndex = tokenModifierIndex.get(modifier);
            return modifierIndex === undefined ? mask : mask | (1 << modifierIndex);
        }, 0);

        builder.push(token.line, token.startCharacter, token.length, typeIndex, modifierMask);
    }

    return builder.build();
}
