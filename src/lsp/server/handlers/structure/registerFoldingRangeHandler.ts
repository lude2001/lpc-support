import type { FoldingRange, FoldingRangeParams } from 'vscode-languageserver/node';
import type { LanguageStructureService } from '../../../../language/services/structure/LanguageFoldingService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from '../navigation/navigationHandlerContext';

type FoldingRangeConnection = {
    onFoldingRanges(handler: (params: FoldingRangeParams) => Promise<FoldingRange[] | undefined | null>): unknown;
};

export interface FoldingRangeRegistrationContext {
    connection: FoldingRangeConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    structureService: LanguageStructureService;
}

export function registerFoldingRangeHandler(context: FoldingRangeRegistrationContext): void {
    const { connection, documentStore, workspaceSession, structureService } = context;

    connection.onFoldingRanges(async (params: FoldingRangeParams): Promise<FoldingRange[] | undefined> => {
        return structureService.provideFoldingRanges({
            context: createNavigationCapabilityContext(
                params.textDocument.uri,
                documentStore,
                workspaceSession
            )
        });
    });
}
