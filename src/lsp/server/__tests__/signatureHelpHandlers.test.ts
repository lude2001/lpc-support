import { Disposable } from 'vscode-languageserver/node';
import {
    type InitializeParams,
    type InitializeResult,
    type SignatureHelp,
    type SignatureHelpParams,
    TextDocumentSyncKind
} from 'vscode-languageserver/node';
import { describe, expect, jest, test } from '@jest/globals';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { registerSignatureHelpHandler } from '../handlers/signatureHelp/registerSignatureHelpHandler';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLanguageContextFactory } from '../runtime/ServerLanguageContextFactory';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

type SignatureHelpService = {
    provideSignatureHelp: jest.Mock;
};

interface SignatureHelpConnection extends ServerConnection {
    onSignatureHelp: jest.Mock;
}

describe('signature help handlers', () => {
    test('registerSignatureHelpHandler delegates to the shared service and preserves active indices plus parameter docs', async () => {
        let signatureHelpHandler:
            | ((params: SignatureHelpParams) => Promise<SignatureHelp | undefined> | SignatureHelp | undefined)
            | undefined;
        const connection = createSignatureHelpConnection({
            onSignatureHelp: jest.fn((handler) => {
                signatureHelpHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const signatureHelpService: SignatureHelpService = {
            provideSignatureHelp: jest.fn(async (request) => {
                expect(request.position).toEqual({ line: 1, character: 17 });
                expect(request.context.document.getText()).toContain('shared_call(1, 2)');

                return {
                    signatures: [{
                        label: 'int shared_call(int left, int right)',
                        documentation: 'Source: current-file\n\nAdds two values.',
                        sourceLabel: 'current-file',
                        parameters: [
                            { label: 'int left', documentation: 'int left: Left operand' },
                            { label: 'int right', documentation: 'int right: Right operand' }
                        ]
                    }],
                    activeSignature: 0,
                    activeParameter: 1
                };
            })
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                signatureHelpService
            } as any
        });

        documentStore.open('file:///D:/workspace/test.c', 3, 'void test() {\n    shared_call(1, 2);\n}');

        registerSignatureHelpHandler({
            connection,
            contextFactory: new ServerLanguageContextFactory(documentStore, workspaceSession),
            signatureHelpService: signatureHelpService as any
        });

        const result = await signatureHelpHandler?.({
            textDocument: { uri: 'file:///D:/workspace/test.c' },
            position: { line: 1, character: 17 }
        } as SignatureHelpParams);

        expect(signatureHelpService.provideSignatureHelp).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            signatures: [{
                label: 'int shared_call(int left, int right)',
                documentation: {
                    kind: 'markdown',
                    value: 'Source: current-file\n\nAdds two values.'
                },
                parameters: [
                    {
                        label: 'int left',
                        documentation: {
                            kind: 'markdown',
                            value: 'int left: Left operand'
                        }
                    },
                    {
                        label: 'int right',
                        documentation: {
                            kind: 'markdown',
                            value: 'int right: Right operand'
                        }
                    }
                ]
            }],
            activeSignature: 0,
            activeParameter: 1
        });
    });

    test('registerCapabilities advertises signature help capability and registers the handler when the shared service is present', () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let signatureHelpHandler:
            | ((params: SignatureHelpParams) => Promise<SignatureHelp | undefined> | SignatureHelp | undefined)
            | undefined;
        const connection = createSignatureHelpConnection({
            onInitialize: jest.fn((handler) => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onSignatureHelp: jest.fn((handler) => {
                signatureHelpHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const signatureHelpService: SignatureHelpService = {
            provideSignatureHelp: jest.fn(async () => undefined)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                signatureHelpService
            } as any
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
            serverVersion: '0.40.0-test',
            workspaceSession,
            signatureHelpService: signatureHelpService as any
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                signatureHelpProvider: {
                    triggerCharacters: ['(', ','],
                    retriggerCharacters: [',']
                },
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.40.0-test'
            }
        });
        expect(connection.onSignatureHelp).toHaveBeenCalledTimes(1);
        expect(signatureHelpHandler).toBeDefined();
    });
});

function createSignatureHelpConnection(overrides: Partial<SignatureHelpConnection> = {}): SignatureHelpConnection {
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
        onCodeAction: jest.fn(() => Disposable.create(() => undefined)),
        onFoldingRanges: jest.fn(() => Disposable.create(() => undefined)),
        languages: {} as any,
        onSignatureHelp: jest.fn(() => Disposable.create(() => undefined)),
        ...overrides
    };
}
