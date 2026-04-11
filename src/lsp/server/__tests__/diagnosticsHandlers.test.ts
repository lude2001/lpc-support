import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    Disposable,
    type DidChangeTextDocumentParams,
    type DidCloseTextDocumentParams,
    type DidOpenTextDocumentParams
} from 'vscode-languageserver/node';
import { createLanguageDiagnosticsService, type LanguageDiagnostic } from '../../../language/services/diagnostics/LanguageDiagnosticsService';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

describe('diagnostics session and handlers', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('DiagnosticsSession.refresh publishes diagnostics for the stored document text', async () => {
        const publishDiagnostics = jest.fn();
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace']
        });
        const expectedDiagnostics: LanguageDiagnostic[] = [
            {
                range: {
                    start: { line: 1, character: 4 },
                    end: { line: 1, character: 14 }
                },
                severity: 'warning',
                message: '对象名应该使用大写字母和下划线，例如: USER_OB'
            }
        ];
        const diagnosticsService = createLanguageDiagnosticsService({
            analyzeDocument: {
                analyze: jest.fn(async () => ({
                    parseDiagnostics: []
                }))
            },
            collectors: [
                {
                    collect: jest.fn(async (_document, _analysis, context) => {
                        expect(context.workspace.workspaceRoot).toBe('D:/workspace');
                        return expectedDiagnostics;
                    })
                }
            ]
        });

        documentStore.open('file:///D:/workspace/diagnostics.c', 1, [
            'void demo() {',
            '    BAD_OBJECT->query_name();',
            '}'
        ].join('\n'));

        const { DiagnosticsSession } = require('../runtime/DiagnosticsSession') as typeof import('../runtime/DiagnosticsSession');
        const diagnosticsSession = new DiagnosticsSession({
            documentStore,
            workspaceSession,
            diagnosticsService,
            publishDiagnostics
        });

        await diagnosticsSession.refresh('file:///D:/workspace/diagnostics.c');

        expect(publishDiagnostics).toHaveBeenCalledWith('file:///D:/workspace/diagnostics.c', expectedDiagnostics);
    });

    test('registerCapabilities wires diagnostics publication through document lifecycle events', async () => {
        const openHandlers: Array<(params: DidOpenTextDocumentParams) => void> = [];
        const changeHandlers: Array<(params: DidChangeTextDocumentParams) => void> = [];
        const closeHandlers: Array<(params: DidCloseTextDocumentParams) => void> = [];
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const connection = createConnectionStub({
            onDidOpenTextDocument: jest.fn(handler => {
                openHandlers.push(handler);
                return Disposable.create(() => undefined);
            }),
            onDidChangeTextDocument: jest.fn(handler => {
                changeHandlers.push(handler);
                return Disposable.create(() => undefined);
            }),
            onDidCloseTextDocument: jest.fn(handler => {
                closeHandlers.push(handler);
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

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any
        });

        for (const openHandler of openHandlers) {
            openHandler({
                textDocument: {
                    uri: 'file:///D:/workspace/diagnostics.c',
                    languageId: 'lpc',
                    version: 1,
                    text: 'error'
                }
            });
        }
        for (const changeHandler of changeHandlers) {
            changeHandler({
                textDocument: {
                    uri: 'file:///D:/workspace/diagnostics.c',
                    version: 2
                },
                contentChanges: [
                    {
                        text: 'still error'
                    }
                ]
            });
        }
        for (const closeHandler of closeHandlers) {
            closeHandler({
                textDocument: {
                    uri: 'file:///D:/workspace/diagnostics.c'
                }
            });
        }

        expect(diagnosticsSession.refresh).toHaveBeenNthCalledWith(1, 'file:///D:/workspace/diagnostics.c');
        expect(diagnosticsSession.refresh).toHaveBeenNthCalledWith(2, 'file:///D:/workspace/diagnostics.c');
        expect(diagnosticsSession.clear).toHaveBeenCalledWith('file:///D:/workspace/diagnostics.c');
        expect(documentStore.get('file:///D:/workspace/diagnostics.c')).toBeUndefined();
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
        languages: {
            semanticTokens: {
                on: jest.fn(() => Disposable.create(() => undefined))
            }
        },
        ...overrides
    };
}
