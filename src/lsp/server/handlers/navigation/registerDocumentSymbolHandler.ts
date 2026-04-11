import { SymbolKind, type DocumentSymbol, type DocumentSymbolParams } from 'vscode-languageserver/node';
import { toLspRange } from '../../../../language/adapters/lsp/conversions';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from './navigationHandlerContext';

type DocumentSymbolConnection = {
    onDocumentSymbol(handler: (params: DocumentSymbolParams) => Promise<DocumentSymbol[]>): unknown;
};

export interface DocumentSymbolRegistrationContext {
    connection: DocumentSymbolConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    navigationService: LanguageNavigationService;
}

export function registerDocumentSymbolHandler(context: DocumentSymbolRegistrationContext): void {
    const { connection, documentStore, workspaceSession, navigationService } = context;

    connection.onDocumentSymbol(async (params: DocumentSymbolParams): Promise<DocumentSymbol[]> => {
        const symbols = await navigationService.provideDocumentSymbols({
            context: createNavigationCapabilityContext(
                params.textDocument.uri,
                documentStore,
                workspaceSession
            )
        });

        return symbols.map(symbol => toLspDocumentSymbol(symbol));
    });
}

function toLspDocumentSymbol(symbol: Awaited<ReturnType<LanguageNavigationService['provideDocumentSymbols']>>[number]): DocumentSymbol {
    return {
        name: symbol.name,
        detail: symbol.detail,
        kind: toLspDocumentSymbolKind(symbol.kind),
        range: toLspRange(symbol.range),
        selectionRange: toLspRange(symbol.selectionRange),
        children: symbol.children?.map(child => toLspDocumentSymbol(child))
    };
}

function toLspDocumentSymbolKind(kind: string): SymbolKind {
    switch (kind) {
        case 'class':
            return SymbolKind.Class;
        case 'struct':
            return SymbolKind.Struct;
        case 'method':
            return SymbolKind.Method;
        case 'field':
            return SymbolKind.Field;
        case 'function':
        default:
            return SymbolKind.Function;
    }
}
