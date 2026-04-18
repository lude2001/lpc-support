import {
    CompletionItemKind,
    type CompletionList,
    InsertTextFormat,
    type CompletionItem,
    type CompletionParams,
    type Connection
} from 'vscode-languageserver/node';
import type {
    LanguageCompletionItem,
    LanguageCompletionItemData,
    LanguageCompletionService
} from '../../../../language/services/completion/LanguageCompletionService';
import { toLspMarkupContent } from '../../../../language/adapters/lsp/conversions';
import { ServerLanguageContextFactory } from '../../runtime/ServerLanguageContextFactory';

type CompletionConnection = Pick<Connection, 'onCompletion' | 'onCompletionResolve'>;

export interface CompletionRegistrationContext {
    connection: CompletionConnection;
    contextFactory: Pick<ServerLanguageContextFactory, 'createCapabilityContext'>;
    completionService: LanguageCompletionService;
}

export function registerCompletionHandler(context: CompletionRegistrationContext): void {
    const { connection, contextFactory, completionService } = context;

    connection.onCompletion(async (params: CompletionParams): Promise<CompletionList> => {
        const requestContext = contextFactory.createCapabilityContext(params.textDocument.uri);
        const result = await completionService.provideCompletion({
            context: requestContext,
            position: {
                line: params.position.line,
                character: params.position.character
            },
            triggerKind: params.context?.triggerKind,
            triggerCharacter: params.context?.triggerCharacter
        });

        return {
            isIncomplete: result.isIncomplete ?? false,
            items: result.items.map(toLspCompletionItem)
        };
    });

    connection.onCompletionResolve(async (item: CompletionItem): Promise<CompletionItem> => {
        if (!completionService.resolveCompletionItem) {
            return item;
        }

        const documentUri = getCompletionData(item.data)?.documentUri;
        const requestContext = contextFactory.createCapabilityContext(documentUri);
        const resolved = await completionService.resolveCompletionItem({
            context: requestContext,
            item: fromLspCompletionItem(item)
        });

        return toLspCompletionItem(resolved);
    });
}

function toLspCompletionItem(item: LanguageCompletionItem): CompletionItem {
    return {
        label: item.label,
        kind: toLspCompletionItemKind(item.kind),
        detail: item.detail,
        documentation: item.documentation ? toLspMarkupContent(item.documentation) : undefined,
        insertText: item.insertText,
        insertTextFormat: item.insertText
            ? item.insertText.includes('$') ? InsertTextFormat.Snippet : InsertTextFormat.PlainText
            : undefined,
        sortText: item.sortText,
        filterText: item.filterText,
        data: item.data
    };
}

function fromLspCompletionItem(item: CompletionItem): LanguageCompletionItem {
    return {
        label: item.label,
        kind: fromLspCompletionItemKind(item.kind),
        detail: item.detail,
        documentation: item.documentation && typeof item.documentation !== 'string'
            ? {
                kind: item.documentation.kind === 'plaintext' ? 'plaintext' : 'markdown',
                value: item.documentation.value
            }
            : undefined,
        insertText: typeof item.insertText === 'string' ? item.insertText : undefined,
        sortText: item.sortText,
        filterText: item.filterText,
        data: getCompletionData(item.data)
    };
}

function fromLspCompletionItemKind(kind?: CompletionItemKind): string | undefined {
    switch (kind) {
        case CompletionItemKind.Method:
            return 'method';
        case CompletionItemKind.Function:
            return 'function';
        case CompletionItemKind.Struct:
            return 'struct';
        case CompletionItemKind.Class:
            return 'class';
        case CompletionItemKind.Field:
            return 'field';
        case CompletionItemKind.Variable:
            return 'variable';
        case CompletionItemKind.Keyword:
            return 'keyword';
        case CompletionItemKind.Text:
            return 'text';
        default:
            return undefined;
    }
}

function getCompletionData(data: unknown): LanguageCompletionItemData | undefined {
    return data as LanguageCompletionItemData | undefined;
}

function toLspCompletionItemKind(kind?: string): CompletionItemKind {
    switch (kind) {
        case 'method':
            return CompletionItemKind.Method;
        case 'function':
            return CompletionItemKind.Function;
        case 'struct':
            return CompletionItemKind.Struct;
        case 'class':
            return CompletionItemKind.Class;
        case 'field':
            return CompletionItemKind.Field;
        case 'variable':
            return CompletionItemKind.Variable;
        case 'keyword':
            return CompletionItemKind.Keyword;
        default:
            return CompletionItemKind.Text;
    }
}
