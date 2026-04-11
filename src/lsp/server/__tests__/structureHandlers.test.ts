import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    Disposable,
    SemanticTokensBuilder,
    TextDocumentSyncKind,
    type Connection,
    type FoldingRange,
    type FoldingRangeParams,
    type InitializeParams,
    type InitializeResult,
    type SemanticTokens,
    type SemanticTokensParams
} from 'vscode-languageserver/node';
import type { LanguageStructureService } from '../../../language/services/structure/LanguageFoldingService';
import {
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS,
    DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES
} from '../../../language/services/structure/LanguageSemanticTokensService';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { registerFoldingRangeHandler } from '../handlers/structure/registerFoldingRangeHandler';
import { registerSemanticTokensHandler } from '../handlers/structure/registerSemanticTokensHandler';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

interface StructureConnection extends ServerConnection {
    onFoldingRanges: jest.Mock;
    languages: {
        semanticTokens: {
            on: jest.Mock;
        };
    };
}

describe('structure handlers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('registerFoldingRangeHandler delegates through the shared structure service and converts LSP ranges', async () => {
        let foldingHandler:
            | ((params: FoldingRangeParams) => Promise<FoldingRange[] | undefined | null> | FoldingRange[] | undefined | null)
            | undefined;
        const connection = createStructureConnection({
            onFoldingRanges: jest.fn(handler => {
                foldingHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const structureService = createStructureServiceStub({
            provideFoldingRanges: jest.fn(async (request) => {
                expect(request.context.workspace.workspaceRoot).toBe('D:/workspace');
                expect(request.context.workspace.services?.structureService).toBe(structureService);
                expect(request.context.document.uri.toString()).toBe('file:///D:/workspace/structure.c');
                expect(request.context.document.getText()).toBe('if (value) {\n    call_other();\n}\n');

                return [
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
                        endCharacter: 2,
                        kind: 'comment'
                    }
                ];
            })
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                structureService
            }
        });

        documentStore.open('file:///D:/workspace/structure.c', 4, 'if (value) {\n    call_other();\n}\n');

        registerFoldingRangeHandler({
            connection,
            documentStore,
            workspaceSession,
            structureService
        });

        const ranges = await foldingHandler?.({
            textDocument: { uri: 'file:///D:/workspace/structure.c' }
        } as FoldingRangeParams);

        expect(structureService.provideFoldingRanges).toHaveBeenCalledTimes(1);
        expect(ranges).toEqual([
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
                endCharacter: 2,
                kind: 'comment'
            }
        ]);
    });

    test('registerSemanticTokensHandler encodes semantic tokens using the advertised legend order', async () => {
        let semanticTokensHandler:
            | ((params: SemanticTokensParams) => Promise<SemanticTokens> | SemanticTokens)
            | undefined;
        const legend = {
            tokenTypes: ['property', 'function', 'keyword'],
            tokenModifiers: []
        };
        const connection = createStructureConnection({
            languages: {
                semanticTokens: {
                    on: jest.fn(handler => {
                        semanticTokensHandler = handler;
                        return Disposable.create(() => undefined);
                    })
                }
            }
        });
        const documentStore = new DocumentStore();
        const structureService = createStructureServiceStub({
            provideSemanticTokens: jest.fn(async (request) => {
                expect(request.context.workspace.workspaceRoot).toBe('D:/workspace');
                expect(request.context.workspace.services?.structureService).toBe(structureService);
                expect(request.context.document.uri.toString()).toBe('file:///D:/workspace/structure.c');

                return {
                    legend,
                    tokens: [
                        {
                            line: 0,
                            startCharacter: 0,
                            length: 2,
                            tokenType: 'keyword'
                        },
                        {
                            line: 0,
                            startCharacter: 3,
                            length: 4,
                            tokenType: 'function'
                        },
                        {
                            line: 1,
                            startCharacter: 4,
                            length: 2,
                            tokenType: 'property'
                        }
                    ]
                };
            })
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                structureService
            }
        });

        documentStore.open('file:///D:/workspace/structure.c', 9, 'if foo\n    hp\n');

        registerSemanticTokensHandler({
            connection,
            documentStore,
            workspaceSession,
            structureService
        });

        const result = await semanticTokensHandler?.({
            textDocument: { uri: 'file:///D:/workspace/structure.c' }
        } as SemanticTokensParams);

        const builder = new SemanticTokensBuilder();
        builder.push(0, 0, 2, legend.tokenTypes.indexOf('keyword'), 0);
        builder.push(0, 3, 4, legend.tokenTypes.indexOf('function'), 0);
        builder.push(1, 4, 2, legend.tokenTypes.indexOf('property'), 0);

        expect(structureService.provideSemanticTokens).toHaveBeenCalledTimes(1);
        expect(result).toEqual(builder.build());
    });

    test('registerCapabilities and createServer expose only structure capabilities when structure service is provided', () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        const connection = createStructureConnection({
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const structureService = createStructureServiceStub();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                structureService
            }
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        registerCapabilities({
            connection,
            documentStore: new DocumentStore(),
            logger,
            serverVersion: '0.34.0-test',
            workspaceSession
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                foldingRangeProvider: true,
                semanticTokensProvider: {
                    legend: {
                        tokenTypes: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                        tokenModifiers: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
                    },
                    full: true
                },
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.34.0-test'
            }
        });
        expect(connection.onFoldingRanges).toHaveBeenCalledTimes(1);
        expect(connection.languages.semanticTokens.on).toHaveBeenCalledTimes(1);

        const fakeConnection = {
            console: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                log: jest.fn()
            },
            listen: jest.fn()
        } as unknown as Connection;
        const registerCapabilitiesMock = jest.fn();

        jest.isolateModules(() => {
            jest.doMock('vscode-languageserver/node', () => ({
                createConnection: jest.fn(() => fakeConnection),
                ProposedFeatures: {
                    all: {}
                }
            }));
            jest.doMock('../bootstrap/registerCapabilities', () => ({
                registerCapabilities: registerCapabilitiesMock
            }));

            const isolatedCreateServer = (
                require('../bootstrap/createServer') as typeof import('../bootstrap/createServer')
            ).createServer;
            const runtime = isolatedCreateServer({ structureService });
            const registrationContext = registerCapabilitiesMock.mock.calls[0]?.[0] as {
                workspaceSession: WorkspaceSession;
            };

            expect(runtime.workspaceSession.toLanguageWorkspaceContext('').services?.structureService)
                .toBe(structureService);
            expect(registrationContext.workspaceSession.toLanguageWorkspaceContext('').services?.structureService)
                .toBe(structureService);
        });
    });
});

function createStructureServiceStub(
    overrides: Partial<LanguageStructureService> = {}
): LanguageStructureService {
    return {
        provideFoldingRanges: jest.fn(async () => []),
        provideSemanticTokens: jest.fn(async () => ({
            legend: {
                tokenTypes: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                tokenModifiers: [...DEFAULT_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
            },
            tokens: []
        })),
        ...overrides
    };
}

function createStructureConnection(overrides: Partial<StructureConnection> = {}): StructureConnection {
    return {
        onInitialize: jest.fn(() => Disposable.create(() => undefined)),
        onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onNotification: jest.fn(() => Disposable.create(() => undefined)),
        onRequest: jest.fn(() => Disposable.create(() => undefined)),
        onCompletion: jest.fn(() => Disposable.create(() => undefined)),
        onCompletionResolve: jest.fn(() => Disposable.create(() => undefined)),
        onHover: jest.fn(() => Disposable.create(() => undefined)),
        onDefinition: jest.fn(() => Disposable.create(() => undefined)),
        onReferences: jest.fn(() => Disposable.create(() => undefined)),
        onPrepareRename: jest.fn(() => Disposable.create(() => undefined)),
        onRenameRequest: jest.fn(() => Disposable.create(() => undefined)),
        onDocumentSymbol: jest.fn(() => Disposable.create(() => undefined)),
        onFoldingRanges: jest.fn(() => Disposable.create(() => undefined)),
        languages: {
            semanticTokens: {
                on: jest.fn(() => Disposable.create(() => undefined))
            }
        },
        ...overrides
    };
}
