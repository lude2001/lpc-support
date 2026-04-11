import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type * as vscode from 'vscode';
import {
    CompletionItemKind,
    Disposable,
    type CompletionList,
    type CompletionParams,
    type Definition,
    type DefinitionParams,
    type DocumentSymbol,
    type DocumentSymbolParams,
    type Hover,
    type HoverParams,
    type InitializeParams,
    type InitializeResult,
    type Location,
    type PrepareRenameParams,
    type PrepareRenameResult,
    type ReferenceParams,
    type RenameParams,
    type SemanticTokens,
    type SemanticTokensParams,
    type WorkspaceEdit
} from 'vscode-languageserver/node';
import type {
    LanguageCompletionItem,
    LanguageCompletionService
} from '../../language/services/completion/LanguageCompletionService';
import type { LanguageNavigationService } from '../../language/services/navigation/LanguageHoverService';
import type { LanguageStructureService } from '../../language/services/structure/LanguageFoldingService';
import {
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS,
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES
} from '../../language/services/structure/LanguageSemanticTokensService';
import { registerCapabilities, type ServerConnection } from '../server/bootstrap/registerCapabilities';
import { DocumentStore } from '../server/runtime/DocumentStore';
import { ServerLogger } from '../server/runtime/ServerLogger';
import { WorkspaceSession } from '../server/runtime/WorkspaceSession';

const vscodeApi = jest.requireMock('vscode') as typeof import('vscode') & Record<string, unknown>;

interface CapabilityMatrixEntry {
    capability: string;
    sharedSurface: string;
    lspSurface: string;
    parity: 'exact' | 'mismatch';
}

interface BoundaryEntry {
    scope: string;
    summary: string;
}

interface RuntimeResult {
    initializeResult: InitializeResult;
    capabilityMatrix: CapabilityMatrixEntry[];
    boundaries: BoundaryEntry[];
}

interface CapturedHandlers {
    initialize?: (params: InitializeParams) => InitializeResult;
    completion?: (params: CompletionParams) => Promise<CompletionList> | CompletionList;
    hover?: (params: HoverParams) => Promise<Hover | undefined> | Hover | undefined;
    definition?: (params: DefinitionParams) => Promise<Definition> | Definition;
    references?: (params: ReferenceParams) => Promise<Location[]> | Location[];
    prepareRename?: (
        params: PrepareRenameParams
    ) => Promise<PrepareRenameResult | undefined> | PrepareRenameResult | undefined;
    rename?: (params: RenameParams) => Promise<WorkspaceEdit> | WorkspaceEdit;
    documentSymbol?: (params: DocumentSymbolParams) => Promise<DocumentSymbol[]> | DocumentSymbol[];
    semanticTokens?: (params: SemanticTokensParams) => Promise<SemanticTokens> | SemanticTokens;
    folding?: (
        params: { textDocument: { uri: string } }
    ) => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>;
}

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscodeApi.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            return content.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscodeApi.Position(line, offset - lineStarts[line]);
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position)),
        getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let anchor = Math.max(0, Math.min(position.character, Math.max(lineText.length - 1, 0)));
            if (!isWordCharacter(lineText[anchor]) && anchor > 0 && isWordCharacter(lineText[anchor - 1])) {
                anchor -= 1;
            }
            if (!isWordCharacter(lineText[anchor])) {
                return undefined;
            }

            let start = anchor;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = anchor + 1;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            return new vscodeApi.Range(position.line, start, position.line, end);
        })
    } as unknown as vscode.TextDocument;
}

function ensureVsCodeCapabilityMocks(): void {
    (vscodeApi as any).Hover = class Hover {
        public constructor(public contents: unknown, public range?: unknown) {}
    };
}

function createCompletionService(documentUri: string, documentVersion: number): LanguageCompletionService {
    const itemData = {
        candidate: {
            key: 'scope:local_call',
            label: 'local_call',
            kind: vscodeApi.CompletionItemKind.Function,
            detail: 'int local_call',
            sortGroup: 'scope',
            metadata: {
                sourceType: 'local'
            }
        },
        context: {
            kind: 'identifier',
            currentWord: 'local_'
        } as any,
        documentUri,
        documentVersion,
        resolved: false
    } satisfies LanguageCompletionItem['data'];

    return {
        provideCompletion: jest.fn().mockResolvedValue({
            isIncomplete: false,
            items: [
                {
                    label: 'local_call',
                    kind: 'function',
                    detail: 'int local_call',
                    sortText: '0_local_call',
                    data: itemData
                }
            ]
        })
    };
}

function createNavigationService(targetUri: string, documentUri: string): LanguageNavigationService {
    return {
        provideHover: jest.fn().mockResolvedValue({
            contents: [
                {
                    kind: 'markdown',
                    value: '### local_call\n\nShared parity hover'
                }
            ],
            range: {
                start: { line: 4, character: 4 },
                end: { line: 4, character: 14 }
            }
        }),
        provideDefinition: jest.fn().mockResolvedValue([
            {
                uri: targetUri,
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 2, character: 1 }
                }
            }
        ]),
        provideReferences: jest.fn().mockResolvedValue([
            {
                uri: documentUri,
                range: {
                    start: { line: 4, character: 4 },
                    end: { line: 4, character: 14 }
                }
            },
            {
                uri: documentUri,
                range: {
                    start: { line: 5, character: 4 },
                    end: { line: 5, character: 14 }
                }
            }
        ]),
        prepareRename: jest.fn().mockResolvedValue({
            range: {
                start: { line: 4, character: 4 },
                end: { line: 4, character: 14 }
            },
            placeholder: 'local_call'
        }),
        provideRenameEdits: jest.fn().mockResolvedValue({
            changes: {
                [documentUri]: [
                    {
                        range: {
                            start: { line: 4, character: 4 },
                            end: { line: 4, character: 14 }
                        },
                        newText: 'shared_call'
                    },
                    {
                        range: {
                            start: { line: 5, character: 4 },
                            end: { line: 5, character: 14 }
                        },
                        newText: 'shared_call'
                    }
                ]
            }
        }),
        provideDocumentSymbols: jest.fn().mockResolvedValue([
            {
                name: 'Payload',
                detail: 'class',
                kind: 'class',
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 2, character: 1 }
                },
                selectionRange: {
                    start: { line: 0, character: 6 },
                    end: { line: 0, character: 13 }
                },
                children: [
                    {
                        name: 'hp',
                        detail: 'int',
                        kind: 'field',
                        range: {
                            start: { line: 1, character: 4 },
                            end: { line: 1, character: 10 }
                        },
                        selectionRange: {
                            start: { line: 1, character: 8 },
                            end: { line: 1, character: 10 }
                        }
                    }
                ]
            },
            {
                name: 'local_call',
                detail: 'int',
                kind: 'function',
                range: {
                    start: { line: 4, character: 0 },
                    end: { line: 6, character: 1 }
                },
                selectionRange: {
                    start: { line: 4, character: 4 },
                    end: { line: 4, character: 14 }
                }
            }
        ])
    };
}

function createStructureService(): LanguageStructureService {
    return {
        provideFoldingRanges: jest.fn().mockResolvedValue([
            {
                startLine: 0,
                endLine: 2,
                startCharacter: 0,
                endCharacter: 1,
                kind: 'region'
            },
            {
                startLine: 4,
                endLine: 6,
                startCharacter: 0,
                endCharacter: 1,
                kind: 'comment'
            }
        ]),
        provideSemanticTokens: jest.fn().mockResolvedValue({
            legend: {
                tokenTypes: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                tokenModifiers: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
            },
            tokens: [
                {
                    line: 0,
                    startCharacter: 6,
                    length: 7,
                    tokenType: 'type'
                },
                {
                    line: 4,
                    startCharacter: 4,
                    length: 10,
                    tokenType: 'function'
                }
            ]
        })
    };
}

function createConnection(handlers: CapturedHandlers): ServerConnection {
    return {
        onInitialize: jest.fn(handler => {
            handlers.initialize = handler;
            return Disposable.create(() => undefined);
        }),
        onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onNotification: jest.fn(() => Disposable.create(() => undefined)),
        onRequest: jest.fn(() => Disposable.create(() => undefined)),
        onCompletion: jest.fn(handler => {
            handlers.completion = handler;
            return Disposable.create(() => undefined);
        }),
        onCompletionResolve: jest.fn(() => Disposable.create(() => undefined)),
        onHover: jest.fn(handler => {
            handlers.hover = handler;
            return Disposable.create(() => undefined);
        }),
        onDefinition: jest.fn(handler => {
            handlers.definition = handler;
            return Disposable.create(() => undefined);
        }),
        onReferences: jest.fn(handler => {
            handlers.references = handler;
            return Disposable.create(() => undefined);
        }),
        onPrepareRename: jest.fn(handler => {
            handlers.prepareRename = handler;
            return Disposable.create(() => undefined);
        }),
        onRenameRequest: jest.fn(handler => {
            handlers.rename = handler;
            return Disposable.create(() => undefined);
        }),
        onDocumentSymbol: jest.fn(handler => {
            handlers.documentSymbol = handler;
            return Disposable.create(() => undefined);
        }),
        onFoldingRanges: jest.fn(handler => {
            handlers.folding = handler as CapturedHandlers['folding'];
            return Disposable.create(() => undefined);
        }),
        languages: {
            semanticTokens: {
                on: jest.fn(handler => {
                    handlers.semanticTokens = handler;
                    return Disposable.create(() => undefined);
                })
            }
        }
    } as unknown as ServerConnection;
}

function normalizeCompletion(output: { items?: Array<{ label: string; detail?: string; sortText?: string; filterText?: string }> } | CompletionList | undefined): unknown {
    const items = output?.items ?? [];
    return items.map((item) => ({
        label: item.label,
        detail: item.detail,
        sortText: item.sortText,
        filterText: item.filterText
    }));
}

function normalizeHover(output: { contents?: unknown } | Hover | undefined): unknown {
    if (!output) {
        return undefined;
    }

    const contents = 'contents' in output ? output.contents : undefined;
    const normalizedContents = Array.isArray(contents)
        ? contents.map((content) => normalizeHoverContent(content))
        : [normalizeHoverContent(contents)];

    return {
        contents: normalizedContents
    };
}

function normalizeHoverContent(content: unknown): unknown {
    if (!content) {
        return undefined;
    }

    if (typeof content === 'string') {
        return {
            kind: 'plaintext',
            value: content
        };
    }

    if (typeof (content as { value?: unknown }).value === 'string') {
        return {
            kind: (content as { kind?: string }).kind ?? 'markdown',
            value: (content as { value: string }).value
        };
    }

    return content;
}

function normalizeRange(range: unknown): unknown {
    if (!range) {
        return undefined;
    }

    return {
        start: {
            line: (range as { start: { line: number; character: number } }).start.line,
            character: (range as { start: { line: number; character: number } }).start.character
        },
        end: {
            line: (range as { end: { line: number; character: number } }).end.line,
            character: (range as { end: { line: number; character: number } }).end.character
        }
    };
}

function normalizeLocations(output: Array<{ uri: string; range: unknown }> | Definition | Location[] | undefined): Array<unknown> {
    if (!output) {
        return [];
    }

    const locations = Array.isArray(output) ? output : [output];
    return locations.map((location) => ({
        uri: normalizeUriString(typeof location.uri === 'string' ? location.uri : location.uri.toString()),
        range: normalizeRange(location.range)
    }));
}

function normalizePrepareRename(output: unknown): unknown {
    if (!output) {
        return undefined;
    }

    if ('range' in (output as Record<string, unknown>)) {
        return {
            range: normalizeRange((output as { range: unknown }).range),
            placeholder: (output as { placeholder?: string }).placeholder
        };
    }

    return {
        range: normalizeRange(output)
    };
}

function normalizeWorkspaceEdit(output: { changes?: Record<string, Array<{ range: unknown; newText: string }>> } | WorkspaceEdit): unknown {
    return Object.entries(output.changes ?? {}).map(([uri, edits]) => ({
        uri: normalizeUriString(uri),
        edits: edits.map((edit) => ({
            range: normalizeRange(edit.range),
            newText: edit.newText
        }))
    }));
}

function normalizeUriString(uri: string): string {
    return uri.replace(/^file:\/\/+/, 'file:///');
}

function normalizeDocumentSymbols(output: Array<{ name: string; detail?: string; children?: DocumentSymbol[] }> | DocumentSymbol[] | undefined): unknown {
    return (output ?? []).map((symbol) => ({
        name: symbol.name,
        detail: symbol.detail,
        children: normalizeDocumentSymbols(symbol.children)
    }));
}

function normalizeFoldingRanges(output: Array<Record<string, unknown>> | undefined): unknown {
    return (output ?? []).map((range) => ({
        startLine: range.startLine ?? range.start,
        endLine: range.endLine ?? range.end,
        kind: range.kind
    }));
}

function normalizeSemanticTokens(output: { tokens?: unknown[] } | SemanticTokens): unknown {
    const tokenArray = (output as { tokens?: unknown[] }).tokens;
    if (Array.isArray(tokenArray)) {
        return tokenArray.map((token) => ({
            line: (token as { line: number }).line,
            char: (token as { startCharacter: number }).startCharacter,
            length: (token as { length: number }).length,
            tokenType: DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES.indexOf((token as { tokenType: string }).tokenType),
            tokenModifiers: ((token as { tokenModifiers?: string[] }).tokenModifiers ?? []).reduce((mask, modifier) => {
                const modifierIndex = DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS.indexOf(modifier);
                return modifierIndex === -1 ? mask : mask | (1 << modifierIndex);
            }, 0)
        }));
    }

    return decodeLspSemanticTokens((output as SemanticTokens).data ?? []);
}

function decodeLspSemanticTokens(encoded: number[]): Array<{
    line: number;
    char: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
}> {
    const decoded: Array<{
        line: number;
        char: number;
        length: number;
        tokenType: number;
        tokenModifiers: number;
    }> = [];
    let line = 0;
    let character = 0;

    for (let index = 0; index < encoded.length; index += 5) {
        line += encoded[index];
        character = encoded[index] === 0
            ? character + encoded[index + 1]
            : encoded[index + 1];

        decoded.push({
            line,
            char: character,
            length: encoded[index + 2],
            tokenType: encoded[index + 3],
            tokenModifiers: encoded[index + 4]
        });
    }

    return decoded;
}

async function buildRuntime(): Promise<RuntimeResult> {
    ensureVsCodeCapabilityMocks();

    const workspaceRoot = 'D:/workspace';
    const fileName = `${workspaceRoot}/parity.c`;
    const documentUri = 'file:///D:/workspace/parity.c';
    const targetUri = 'file:///D:/workspace/target.c';
    const content = [
        'class Payload {',
        '    int hp;',
        '}',
        '',
        'int local_call() {',
        '    return 1;',
        '}'
    ].join('\n');
    const document = createDocument(fileName, content, 3);

    const completionService = createCompletionService(documentUri, document.version);
    const navigationService = createNavigationService(targetUri, documentUri);
    const structureService = createStructureService();

    const handlers: CapturedHandlers = {};
    const connection = createConnection(handlers);
    const documentStore = new DocumentStore();
    const workspaceSession = new WorkspaceSession({
        workspaceRoots: [workspaceRoot],
        featureServices: {
            completionService,
            navigationService,
            structureService
        }
    });
    const logger = new ServerLogger({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn()
    });
    const sharedContext = {
        document,
        workspace: {
            workspaceRoot
        },
        mode: 'lsp' as const,
        cancellation: {
            isCancellationRequested: false
        }
    };

    documentStore.open(documentUri, document.version, content);

    registerCapabilities({
        connection,
        documentStore,
        logger,
        serverVersion: '0.34.0-test',
        workspaceSession,
        completionService
    });

    const initializeResult = handlers.initialize?.({} as InitializeParams);
    if (!initializeResult) {
        throw new Error('Expected LSP initialize handler to be registered');
    }

    const completionDirect = await completionService.provideCompletion({
        context: sharedContext,
        position: {
            line: 4,
            character: 8
        },
        triggerKind: vscodeApi.CompletionTriggerKind.Invoke
    });
    const completionLsp = await handlers.completion?.({
        textDocument: { uri: documentUri },
        position: { line: 4, character: 8 }
    } as CompletionParams);

    const hoverDirect = await navigationService.provideHover({
        context: sharedContext,
        position: { line: 4, character: 8 }
    });
    const hoverLsp = await handlers.hover?.({
        textDocument: { uri: documentUri },
        position: { line: 4, character: 8 }
    } as HoverParams);

    const definitionDirect = await navigationService.provideDefinition({
        context: sharedContext,
        position: { line: 4, character: 8 }
    });
    const definitionLsp = await handlers.definition?.({
        textDocument: { uri: documentUri },
        position: { line: 4, character: 8 }
    } as DefinitionParams);

    const referencesDirect = await navigationService.provideReferences({
        context: sharedContext,
        position: { line: 4, character: 8 },
        includeDeclaration: false
    });
    const referencesLsp = await handlers.references?.({
        textDocument: { uri: documentUri },
        position: { line: 4, character: 8 },
        context: {
            includeDeclaration: false
        }
    } as ReferenceParams);

    const prepareRenameDirect = await navigationService.prepareRename({
        context: sharedContext,
        position: { line: 4, character: 8 }
    });
    const prepareRenameLsp = await handlers.prepareRename?.({
        textDocument: { uri: documentUri },
        position: { line: 4, character: 8 }
    } as PrepareRenameParams);
    const renameDirect = await navigationService.provideRenameEdits({
        context: sharedContext,
        position: { line: 4, character: 8 },
        newName: 'shared_call'
    });
    const renameLsp = await handlers.rename?.({
        textDocument: { uri: documentUri },
        position: { line: 4, character: 8 },
        newName: 'shared_call'
    } as RenameParams);

    const documentSymbolDirect = await navigationService.provideDocumentSymbols({
        context: sharedContext
    });
    const documentSymbolLsp = await handlers.documentSymbol?.({
        textDocument: { uri: documentUri }
    } as DocumentSymbolParams);

    const foldingDirect = await structureService.provideFoldingRanges({
        context: sharedContext
    });
    const foldingLsp = await handlers.folding?.({
        textDocument: { uri: documentUri }
    });

    const semanticTokensDirect = await structureService.provideSemanticTokens({
        context: sharedContext
    });
    const semanticTokensLsp = await handlers.semanticTokens?.({
        textDocument: { uri: documentUri }
    } as SemanticTokensParams);

    const capabilityMatrix = [
        {
            capability: 'completion',
            sharedSurface: 'LanguageCompletionService',
            lspSurface: 'registerCompletionHandler',
            parity: JSON.stringify(normalizeCompletion(completionDirect)) === JSON.stringify(normalizeCompletion(completionLsp))
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'hover',
            sharedSurface: 'LanguageNavigationService.provideHover',
            lspSurface: 'registerHoverHandler',
            parity: JSON.stringify(normalizeHover(hoverDirect)) === JSON.stringify(normalizeHover(hoverLsp))
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'definition',
            sharedSurface: 'LanguageNavigationService.provideDefinition',
            lspSurface: 'registerDefinitionHandler',
            parity: JSON.stringify(normalizeLocations(definitionDirect)) === JSON.stringify(normalizeLocations(definitionLsp))
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'references',
            sharedSurface: 'LanguageNavigationService.provideReferences',
            lspSurface: 'registerReferencesHandler',
            parity: JSON.stringify(normalizeLocations(referencesDirect)) === JSON.stringify(normalizeLocations(referencesLsp))
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'rename',
            sharedSurface: 'LanguageNavigationService.prepareRename/provideRenameEdits',
            lspSurface: 'registerRenameHandler',
            parity: JSON.stringify({
                prepare: normalizePrepareRename(prepareRenameDirect),
                edits: normalizeWorkspaceEdit(renameDirect)
            }) === JSON.stringify({
                prepare: normalizePrepareRename(prepareRenameLsp),
                edits: normalizeWorkspaceEdit(renameLsp as WorkspaceEdit)
            })
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'documentSymbol',
            sharedSurface: 'LanguageNavigationService.provideDocumentSymbols',
            lspSurface: 'registerDocumentSymbolHandler',
            parity: JSON.stringify(normalizeDocumentSymbols(documentSymbolDirect)) === JSON.stringify(normalizeDocumentSymbols(documentSymbolLsp))
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'foldingRange',
            sharedSurface: 'LanguageStructureService.provideFoldingRanges',
            lspSurface: 'registerFoldingRangeHandler',
            parity: JSON.stringify(normalizeFoldingRanges(foldingDirect as Array<Record<string, unknown>>)) === JSON.stringify(normalizeFoldingRanges(foldingLsp))
                ? 'exact'
                : 'mismatch'
        },
        {
            capability: 'semanticTokens',
            sharedSurface: 'LanguageStructureService.provideSemanticTokens',
            lspSurface: 'registerSemanticTokensHandler',
            parity: JSON.stringify(normalizeSemanticTokens(semanticTokensDirect)) === JSON.stringify(normalizeSemanticTokens(semanticTokensLsp as SemanticTokens))
                ? 'exact'
                : 'mismatch'
        }
    ] satisfies CapabilityMatrixEntry[];

    const boundaries = [
        {
            scope: 'host affordances',
            summary: 'Code actions and macro hover remain host-side affordances and are intentionally outside the LSP handler matrix.'
        }
    ] satisfies BoundaryEntry[];

    return {
        initializeResult,
        capabilityMatrix,
        boundaries
    };
}

describe('LSP capability matrix', () => {
    test('records exact parity between shared services and registered LSP handlers for the eight migrated capabilities', async () => {
        const result = await buildRuntime();

        expect(result.initializeResult).toEqual({
            capabilities: {
                hoverProvider: true,
                definitionProvider: true,
                referencesProvider: true,
                renameProvider: {
                    prepareProvider: true
                },
                documentSymbolProvider: true,
                completionProvider: {
                    resolveProvider: false
                },
                foldingRangeProvider: true,
                semanticTokensProvider: {
                    legend: {
                        tokenTypes: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                        tokenModifiers: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
                    },
                    full: true
                },
                textDocumentSync: 1
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.34.0-test'
            }
        });
        expect(result.capabilityMatrix).toHaveLength(8);
        expect(result.capabilityMatrix.every((entry) => entry.parity === 'exact')).toBe(true);
    });

    test('records the remaining host-side affordance boundary after compatibility cleanup', async () => {
        const result = await buildRuntime();

        expect(result.boundaries).toEqual([
            {
                scope: 'host affordances',
                summary: expect.stringContaining('Code actions and macro hover')
            }
        ]);
    });
});
