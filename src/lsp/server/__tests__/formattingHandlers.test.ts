import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Disposable, TextDocumentSyncKind, type DocumentFormattingParams, type DocumentRangeFormattingParams, type InitializeParams, type InitializeResult } from 'vscode-languageserver/node';
import type { LanguageFormattingService } from '../../../../language/services/formatting/LanguageFormattingService';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { registerFormattingHandlers } from '../handlers/formatting/registerFormattingHandlers';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

describe('formatting handlers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('registerFormattingHandlers delegates to the shared formatting service and converts edits to LSP text edits', async () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let documentFormattingHandler:
            | ((params: DocumentFormattingParams) => Promise<unknown[]> | unknown[])
            | undefined;
        let documentRangeFormattingHandler:
            | ((params: DocumentRangeFormattingParams) => Promise<unknown[]> | unknown[])
            | undefined;

        const formattingService: LanguageFormattingService = {
            formatDocument: jest.fn(async (request) => {
                expect(request.document.uri).toBe('file:///D:/workspace/format.c');
                expect(request.document.version).toBe(7);
                expect(request.document.getText()).toBe('void test(){}');

                return [
                    {
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 13 }
                        },
                        newText: 'void test()\n{\n}'
                    }
                ];
            }),
            formatRange: jest.fn(async (request) => {
                expect(request.document.uri).toBe('file:///D:/workspace/format.c');
                expect(request.range).toEqual({
                    start: { line: 0, character: 4 },
                    end: { line: 0, character: 12 }
                });

                return [
                    {
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 12 }
                        },
                        newText: 'test()\n{\n}'
                    }
                ];
            })
        };

        const connection = createConnectionStub({
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDocumentFormatting: jest.fn(handler => {
                documentFormattingHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDocumentRangeFormatting: jest.fn(handler => {
                documentRangeFormattingHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                formattingService
            }
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open('file:///D:/workspace/format.c', 7, 'void test(){}');

        registerFormattingHandlers({
            connection,
            documentStore,
            workspaceSession,
            formattingService
        });

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.34.0-test',
            workspaceSession,
            formattingService
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                documentFormattingProvider: true,
                documentRangeFormattingProvider: true,
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.34.0-test'
            }
        });

        const formattedDocument = await documentFormattingHandler?.({
            textDocument: { uri: 'file:///D:/workspace/format.c' }
        } as DocumentFormattingParams);
        const formattedRange = await documentRangeFormattingHandler?.({
            textDocument: { uri: 'file:///D:/workspace/format.c' },
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 12 }
            }
        } as DocumentRangeFormattingParams);

        expect(formattingService.formatDocument).toHaveBeenCalledTimes(1);
        expect(formattingService.formatRange).toHaveBeenCalledTimes(1);
        expect(formattedDocument).toEqual([
            {
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 13 }
                },
                newText: 'void test()\n{\n}'
            }
        ]);
        expect(formattedRange).toEqual([
            {
                range: {
                    start: { line: 0, character: 4 },
                    end: { line: 0, character: 12 }
                },
                newText: 'test()\n{\n}'
            }
        ]);
    });

    test('registerCapabilities omits formatting capabilities when no formatting service is available', () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        const connection = createConnectionStub({
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace']
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
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.34.0-test'
            }
        });
    });
});

function createConnectionStub(overrides: Partial<ServerConnection> = {}): ServerConnection {
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
        onDocumentFormatting: jest.fn(() => Disposable.create(() => undefined)),
        onDocumentRangeFormatting: jest.fn(() => Disposable.create(() => undefined)),
        languages: {
            semanticTokens: {
                on: jest.fn(() => Disposable.create(() => undefined))
            }
        },
        ...overrides
    };
}
