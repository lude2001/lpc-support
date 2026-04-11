import type { Hover, HoverParams } from 'vscode-languageserver/node';
import { toLspMarkupContent, toLspRange } from '../../../../language/adapters/lsp/conversions';
import type { LanguageMarkupContent } from '../../../../language/contracts/LanguageMarkup';
import type { LanguageNavigationService } from '../../../../language/services/navigation/LanguageHoverService';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';
import { createNavigationCapabilityContext } from './navigationHandlerContext';

type HoverConnection = {
    onHover(handler: (params: HoverParams) => Promise<Hover | undefined>): unknown;
};

export interface HoverRegistrationContext {
    connection: HoverConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    navigationService: LanguageNavigationService;
}

export function registerHoverHandler(context: HoverRegistrationContext): void {
    const { connection, documentStore, workspaceSession, navigationService } = context;

    connection.onHover(async (params: HoverParams): Promise<Hover | undefined> => {
        const result = await navigationService.provideHover({
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

        if (!result || result.contents.length === 0) {
            return undefined;
        }

        return {
            contents: toLspHoverContents(result.contents),
            range: result.range ? toLspRange(result.range) : undefined
        };
    });
}

function toLspHoverContents(contents: LanguageMarkupContent[]): Hover['contents'] {
    if (contents.length === 1) {
        return toLspMarkupContent(contents[0]);
    }

    return toLspMarkupContent({
        kind: contents.some(content => content.kind === 'markdown') ? 'markdown' : 'plaintext',
        value: contents.map(content => content.value).join('\n\n')
    });
}
