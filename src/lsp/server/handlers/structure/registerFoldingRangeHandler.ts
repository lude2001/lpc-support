import type { FoldingRange, FoldingRangeParams } from 'vscode-languageserver/node';
import type { LanguageStructureService } from '../../../../language/services/structure/LanguageFoldingService';
import type { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type FoldingRangeConnection = {
    onFoldingRanges(handler: (params: FoldingRangeParams) => Promise<FoldingRange[] | undefined | null>): unknown;
};

export interface FoldingRangeRegistrationContext {
    connection: FoldingRangeConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    structureService: LanguageStructureService;
}

export function registerFoldingRangeHandler(context: FoldingRangeRegistrationContext): void {
    const { connection, contextFactory, structureService } = context;

    connection.onFoldingRanges(async (params: FoldingRangeParams): Promise<FoldingRange[] | undefined> => {
        return structureService.provideFoldingRanges({
            context: contextFactory.createCapabilityContext(params.textDocument.uri)
        });
    });
}
