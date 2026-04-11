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
import type { LanguageCapabilityContext } from '../../../../language/contracts/LanguageCapabilityContext';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';

type CompletionConnection = Pick<Connection, 'onCompletion' | 'onCompletionResolve'>;

export interface CompletionRegistrationContext {
    connection: CompletionConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    completionService: LanguageCompletionService;
}

export function registerCompletionHandler(context: CompletionRegistrationContext): void {
    const { connection, documentStore, workspaceSession, completionService } = context;

    connection.onCompletion(async (params: CompletionParams): Promise<CompletionList> => {
        const requestContext = createCapabilityContext(
            params.textDocument.uri,
            documentStore,
            workspaceSession
        );
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
        const requestContext = createCapabilityContext(
            documentUri,
            documentStore,
            workspaceSession
        );
        const resolved = await completionService.resolveCompletionItem({
            context: requestContext,
            item: fromLspCompletionItem(item)
        });

        return toLspCompletionItem(resolved);
    });
}

function createCapabilityContext(
    documentUri: string | undefined,
    documentStore: DocumentStore,
    workspaceSession: WorkspaceSession
): LanguageCapabilityContext {
    const storedDocument = documentUri ? documentStore.get(documentUri) : undefined;
    const workspaceRoot = resolveWorkspaceRoot(documentUri, workspaceSession);

    return {
        document: createTextDocumentShim(documentUri, storedDocument),
        workspace: workspaceSession.toLanguageWorkspaceContext(workspaceRoot),
        mode: 'lsp',
        cancellation: {
            isCancellationRequested: false
        }
    };
}

function resolveWorkspaceRoot(documentUri: string | undefined, workspaceSession: WorkspaceSession): string {
    const workspaceRoots = workspaceSession.getWorkspaceRoots();
    if (workspaceRoots.length === 0) {
        return '';
    }

    if (!documentUri) {
        return workspaceRoots[0];
    }

    const normalizedDocumentPath = normalizeComparablePath(fromFileUri(documentUri));
    const matchedWorkspaceRoot = workspaceRoots.reduce<string | undefined>((bestMatch, root) => {
        const normalizedRoot = normalizeComparablePath(root);
        if (!isPathPrefix(normalizedRoot, normalizedDocumentPath)) {
            return bestMatch;
        }

        if (!bestMatch) {
            return root;
        }

        return normalizedRoot.length > normalizeComparablePath(bestMatch).length ? root : bestMatch;
    }, undefined);
    return matchedWorkspaceRoot ?? workspaceRoots[0];
}

function createTextDocumentShim(
    documentUri: string | undefined,
    storedDocument: Readonly<{ uri: string; version: number; text: string }> | undefined
): LanguageCapabilityContext['document'] {
    const uri = documentUri ?? '';
    const text = storedDocument?.text ?? '';
    const version = storedDocument?.version ?? 0;
    const fileName = fromFileUri(uri);
    const lines = text.split(/\r?\n/);
    const lineStarts = buildLineStarts(text);
    const uriLike = createUriLike(uri, fileName);

    return {
        uri: uriLike,
        version,
        fileName,
        languageId: 'lpc',
        lineCount: lines.length,
        getText: (range?: { start: { line: number; character: number }; end: { line: number; character: number } }) => {
            if (!range) {
                return text;
            }

            return text.slice(offsetAt(range.start, lineStarts, text), offsetAt(range.end, lineStarts, text));
        },
        lineAt: (lineOrPosition: number | { line: number }) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const lineText = lines[line] ?? '';
            const lineStart = lineStarts[line] ?? text.length;
            const lineEnd = lineStart + lineText.length;
            const range = {
                start: { line, character: 0 },
                end: { line, character: lineText.length }
            };

            return {
                lineNumber: line,
                text: lineText,
                range,
                rangeIncludingLineBreak: {
                    start: range.start,
                    end: {
                        line,
                        character: text[lineEnd] === '\n' ? lineText.length + 1 : lineText.length
                    }
                },
                firstNonWhitespaceCharacterIndex: lineText.search(/\S|$/),
                isEmptyOrWhitespace: lineText.trim().length === 0
            };
        },
        offsetAt: (position: { line: number; character: number }) => offsetAt(position, lineStarts, text),
        positionAt: (offset: number) => {
            const safeOffset = Math.max(0, Math.min(offset, text.length));
            let line = 0;

            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= safeOffset) {
                    line = index;
                } else {
                    break;
                }
            }

            return {
                line,
                character: safeOffset - lineStarts[line]
            };
        }
    } as unknown as LanguageCapabilityContext['document'];
}

function createUriLike(uri: string, fileName: string): { fsPath: string; path: string; scheme: string; toString(): string } {
    return {
        fsPath: fileName,
        path: fileName.startsWith('/') ? fileName : `/${fileName}`,
        scheme: uri.startsWith('file://') ? 'file' : '',
        toString: () => uri
    };
}

function offsetAt(
    position: { line: number; character: number },
    lineStarts: number[],
    text: string
): number {
    const lineStart = lineStarts[position.line] ?? text.length;
    return Math.min(lineStart + position.character, text.length);
}

function buildLineStarts(text: string): number[] {
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return lineStarts;
}

function fromFileUri(uri: string): string {
    if (!uri.startsWith('file://')) {
        return uri;
    }

    const decoded = decodeURIComponent(uri.replace(/^file:\/\/+/, '/'));
    return decoded.replace(/^\/([A-Za-z]:\/)/, '$1');
}

function normalizeComparablePath(path: string): string {
    const normalizedPath = path
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');

    return isWindowsDrivePath(normalizedPath)
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}

function isPathPrefix(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(`${root}/`);
}

function isWindowsDrivePath(path: string): boolean {
    return /^[A-Za-z]:\//.test(path);
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
