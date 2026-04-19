import { afterEach, describe, expect, jest, test } from '@jest/globals';
import {
    __closeTextDocument,
    Disposable,
    type DidChangeTextDocumentParams,
    type DidOpenTextDocumentParams,
    workspace
} from '../runtime/vscodeShim';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

describe('document sync runtime bridge', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('didOpen only syncs the runtime mirror and does not emit a change event', () => {
        const uri = 'file:///D:/workspace/runtime-bridge-open-test.c';
        const { openHandlers, listener, cleanup } = createBridgeHarness(uri);

        try {
            openHandlers[0]?.({
                textDocument: {
                    uri,
                    languageId: 'lpc',
                    version: 1,
                    text: 'int main() { return 0; }'
                }
            });

            expect(listener.changeEvents).toHaveLength(0);
            expect(workspace.textDocuments.find(document => document.uri.toString() === uri)).toEqual(
                expect.objectContaining({
                    uri: expect.objectContaining({
                        toString: expect.any(Function)
                    }),
                    version: 1,
                    getText: expect.any(Function)
                })
            );
            const mirroredDocument = workspace.textDocuments.find(document => document.uri.toString() === uri);
            expect(mirroredDocument?.getText()).toBe('int main() { return 0; }');
            expect(mirroredDocument?.version).toBe(1);
        } finally {
            cleanup();
        }
    });

    test('didChange emits a runtime change event after the mirror update', () => {
        const uri = 'file:///D:/workspace/runtime-bridge-change-test.c';
        const { openHandlers, changeHandlers, listener, cleanup } = createBridgeHarness(uri);

        try {
            openHandlers[0]?.({
                textDocument: {
                    uri,
                    languageId: 'lpc',
                    version: 1,
                    text: 'int main() { return 0; }'
                }
            });

            changeHandlers[0]?.({
                textDocument: {
                    uri,
                    version: 2
                },
                contentChanges: [
                    {
                        text: 'int main() { return 1; }'
                    }
                ]
            });

            expect(listener.changeEvents).toHaveLength(1);
            expect(listener.changeEvents[0]).toEqual({
                uri,
                text: 'int main() { return 1; }',
                version: 2
            });
        } finally {
            cleanup();
        }
    });

    test('emitted change event sees the post-sync text and version', () => {
        const uri = 'file:///D:/workspace/runtime-bridge-post-sync-test.c';
        const { openHandlers, changeHandlers, listener, cleanup } = createBridgeHarness(uri);

        try {
            openHandlers[0]?.({
                textDocument: {
                    uri,
                    languageId: 'lpc',
                    version: 1,
                    text: 'int main() { return 0; }'
                }
            });

            changeHandlers[0]?.({
                textDocument: {
                    uri,
                    version: 7
                },
                contentChanges: [
                    {
                        text: 'int main() { return 2; }'
                    }
                ]
            });

            expect(listener.changeEvents).toEqual([
                {
                    uri,
                    text: 'int main() { return 2; }',
                    version: 7
                }
            ]);
            expect(workspace.textDocuments.find(document => document.uri.toString() === uri)?.getText()).toBe(
                'int main() { return 2; }'
            );
            expect(workspace.textDocuments.find(document => document.uri.toString() === uri)?.version).toBe(7);
        } finally {
            cleanup();
        }
    });

    test('workspace.textDocuments projects the latest synchronized text directly from DocumentStore', () => {
        const uri = 'file:///D:/workspace/runtime-bridge-projection-test.c';
        const { openHandlers, documentStore, cleanup } = createBridgeHarness(uri);

        try {
            openHandlers[0]?.({
                textDocument: {
                    uri,
                    languageId: 'lpc',
                    version: 1,
                    text: 'int main() { return 0; }'
                }
            });

            documentStore.applyFullChange(uri, 9, 'int main() { return 9; }');

            expect(workspace.textDocuments.find(document => document.uri.toString() === uri)?.getText()).toBe(
                'int main() { return 9; }'
            );
            expect(workspace.textDocuments.find(document => document.uri.toString() === uri)?.version).toBe(9);
        } finally {
            cleanup();
        }
    });

    test('workspace.textDocuments drops synchronized documents once DocumentStore closes them', () => {
        const uri = 'file:///D:/workspace/runtime-bridge-store-close-test.c';
        const { openHandlers, documentStore, cleanup } = createBridgeHarness(uri);

        try {
            openHandlers[0]?.({
                textDocument: {
                    uri,
                    languageId: 'lpc',
                    version: 1,
                    text: 'int main() { return 0; }'
                }
            });

            documentStore.close(uri);

            expect(workspace.textDocuments.find(document => document.uri.toString() === uri)).toBeUndefined();
        } finally {
            cleanup();
        }
    });
});

function createBridgeHarness(uri: string): {
    openHandlers: Array<(params: DidOpenTextDocumentParams) => void>;
    changeHandlers: Array<(params: DidChangeTextDocumentParams) => void>;
    documentStore: DocumentStore;
    listener: {
        changeEvents: Array<{ uri: string; text: string; version: number }>;
        dispose(): void;
    };
    cleanup: () => void;
} {
    const openHandlers: Array<(params: DidOpenTextDocumentParams) => void> = [];
    const changeHandlers: Array<(params: DidChangeTextDocumentParams) => void> = [];
    const connection = createConnectionStub({
        onDidOpenTextDocument: jest.fn(handler => {
            openHandlers.push(handler);
            return Disposable.create(() => undefined);
        }),
        onDidChangeTextDocument: jest.fn(handler => {
            changeHandlers.push(handler);
            return Disposable.create(() => undefined);
        })
    });
    const documentStore = new DocumentStore();
    const workspaceSession = new WorkspaceSession({
        workspaceRoots: ['D:/workspace']
    });
    const logger = new ServerLogger({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn()
    });
    const changeEvents: Array<{ uri: string; text: string; version: number }> = [];
    const listener = workspace.onDidChangeTextDocument(({ document }) => {
        changeEvents.push({
            uri: document.uri.toString(),
            text: document.getText(),
            version: document.version
        });
    });

    registerCapabilities({
        connection,
        documentStore,
        logger,
        serverVersion: '0.40.0-test',
        workspaceSession
    });

    return {
        openHandlers,
        changeHandlers,
        documentStore,
        listener: {
            changeEvents,
            dispose: () => listener.dispose()
        },
        cleanup: () => {
            listener.dispose();
            __closeTextDocument(uri);
        }
    };
}

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
        languages: {
            semanticTokens: {
                on: jest.fn(() => Disposable.create(() => undefined))
            }
        },
        ...overrides
    };
}
