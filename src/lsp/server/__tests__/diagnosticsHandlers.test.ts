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
import { WorkspaceChangeIndex } from '../runtime/WorkspaceChangeIndex';
import { WorkspaceSession } from '../runtime/WorkspaceSession';
import {
    SourceFileChangeNotification,
    type SourceFileChangePayload
} from '../../shared/protocol/sourceFileChange';
import {
    WorkspaceConfigSyncNotification,
    type WorkspaceConfigSyncPayload
} from '../../shared/protocol/workspaceConfigSync';

describe('diagnostics session and handlers', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('DiagnosticsSession.refresh publishes diagnostics for the stored document text', async () => {
        const publishDiagnostics = jest.fn();
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace']
        });
        workspaceSession.updateWorkspaceConfig('D:/workspace', {
            projectConfigPath: 'D:/workspace/lpc-support.json',
            configHellPath: 'config/config.dev',
            resolvedConfig: {
                mudlibDirectory: '../mudlib',
                includeDirectories: ['/include']
            }
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
                        expect(context.workspace.projectConfig).toMatchObject({
                            projectConfigPath: 'D:/workspace/lpc-support.json',
                            configHellPath: 'config/config.dev',
                            resolvedConfig: {
                                mudlibDirectory: '../mudlib',
                                includeDirectories: ['/include']
                            }
                        });
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

    test('DiagnosticsSession.refresh skips documents outside configured LPC projects', async () => {
        const publishDiagnostics = jest.fn();
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace-without-config']
        });
        const diagnosticsService = {
            collectDiagnostics: jest.fn(async () => [{
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 1 }
                },
                severity: 'warning' as const,
                message: 'should not run'
            }])
        };
        documentStore.open('file:///D:/workspace-without-config/diagnostics.c', 1, 'void demo() {}');

        const { DiagnosticsSession } = require('../runtime/DiagnosticsSession') as typeof import('../runtime/DiagnosticsSession');
        const diagnosticsSession = new DiagnosticsSession({
            documentStore,
            workspaceSession,
            diagnosticsService,
            publishDiagnostics
        });

        await diagnosticsSession.refresh('file:///D:/workspace-without-config/diagnostics.c');

        expect(diagnosticsService.collectDiagnostics).not.toHaveBeenCalled();
        expect(publishDiagnostics).toHaveBeenCalledWith('file:///D:/workspace-without-config/diagnostics.c', []);
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

    test('source file change notification marks one URI dirty and invalidates its caches', () => {
        let sourceFileChangeHandler: ((payload: SourceFileChangePayload) => void) | undefined;
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const connection = createConnectionStub({
            onNotification: jest.fn((type, handler) => {
                if (type === SourceFileChangeNotification.type) {
                    sourceFileChangeHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const changeIndex = new WorkspaceChangeIndex();
        const onDocumentInvalidated = jest.fn();
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
            changeIndex,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any,
            onDocumentInvalidated
        });

        sourceFileChangeHandler?.({
            uri: 'file:///D:/workspace/include/settings.h',
            changeType: 'changed'
        });

        expect(changeIndex.get('file:///D:/workspace/include/settings.h')).toEqual(expect.objectContaining({
            dirty: true,
            deleted: false
        }));
        expect(onDocumentInvalidated).toHaveBeenCalledWith('file:///D:/workspace/include/settings.h');
        expect(diagnosticsSession.refresh).not.toHaveBeenCalled();
        expect(diagnosticsSession.clear).not.toHaveBeenCalled();

        sourceFileChangeHandler?.({
            uri: 'file:///D:/workspace/include/settings.h',
            changeType: 'deleted'
        });

        expect(changeIndex.get('file:///D:/workspace/include/settings.h')).toEqual(expect.objectContaining({
            dirty: true,
            deleted: true
        }));
        expect(diagnosticsSession.clear).toHaveBeenCalledWith('file:///D:/workspace/include/settings.h');
    });

    test('source file changes debounce diagnostics refreshes for maybe stale open owners', async () => {
        jest.useFakeTimers();
        let sourceFileChangeHandler: ((payload: SourceFileChangePayload) => void) | undefined;
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const connection = createConnectionStub({
            onNotification: jest.fn((type, handler) => {
                if (type === SourceFileChangeNotification.type) {
                    sourceFileChangeHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const changeIndex = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/adm/daemons/ownerd.c';
        const dependencyUri = 'file:///D:/workspace/include/settings.h';
        documentStore.open(ownerUri, 7, '#include "/include/settings.h"\nvoid create() {}');
        changeIndex.markOpened(ownerUri, 7);
        changeIndex.recordDependencyFootprint(ownerUri, [dependencyUri]);
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
            changeIndex,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any
        });

        sourceFileChangeHandler?.({
            uri: dependencyUri,
            changeType: 'changed'
        });
        sourceFileChangeHandler?.({
            uri: dependencyUri,
            changeType: 'changed'
        });

        expect(diagnosticsSession.refresh).not.toHaveBeenCalled();
        jest.advanceTimersByTime(199);
        expect(diagnosticsSession.refresh).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1);
        await Promise.resolve();

        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(1);
        expect(diagnosticsSession.refresh).toHaveBeenCalledWith(ownerUri);
        expect(changeIndex.get(ownerUri)).toEqual(expect.objectContaining({
            dirty: false,
            maybeStale: false
        }));

        sourceFileChangeHandler?.({
            uri: 'file:///D:/workspace/include/unrelated.h',
            changeType: 'changed'
        });
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(1);
    });

    test('stale diagnostics refresh completion does not clear newer maybe stale state', async () => {
        jest.useFakeTimers();
        let sourceFileChangeHandler: ((payload: SourceFileChangePayload) => void) | undefined;
        const refreshResolvers: Array<() => void> = [];
        const diagnosticsSession = {
            refresh: jest.fn(() => new Promise<void>((resolve) => {
                refreshResolvers.push(resolve);
            })),
            clear: jest.fn(() => [])
        };
        const connection = createConnectionStub({
            onNotification: jest.fn((type, handler) => {
                if (type === SourceFileChangeNotification.type) {
                    sourceFileChangeHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const changeIndex = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/adm/daemons/ownerd.c';
        const dependencyUri = 'file:///D:/workspace/include/settings.h';
        documentStore.open(ownerUri, 7, '#include "/include/settings.h"\nvoid create() {}');
        changeIndex.markOpened(ownerUri, 7);
        changeIndex.recordDependencyFootprint(ownerUri, [dependencyUri]);
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
            changeIndex,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any
        });

        sourceFileChangeHandler?.({
            uri: dependencyUri,
            changeType: 'changed'
        });
        jest.advanceTimersByTime(200);
        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(1);

        sourceFileChangeHandler?.({
            uri: dependencyUri,
            changeType: 'changed'
        });
        refreshResolvers[0]?.();
        await Promise.resolve();

        expect(changeIndex.get(ownerUri)).toEqual(expect.objectContaining({
            maybeStale: true
        }));

        jest.advanceTimersByTime(200);
        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(2);
        refreshResolvers[1]?.();
        await Promise.resolve();

        expect(changeIndex.get(ownerUri)).toEqual(expect.objectContaining({
            dirty: false,
            maybeStale: false
        }));
    });

    test('closing a maybe stale document drops queued refreshes before it is reopened', async () => {
        jest.useFakeTimers();
        const openHandlers: Array<(params: DidOpenTextDocumentParams) => void> = [];
        const closeHandlers: Array<(params: DidCloseTextDocumentParams) => void> = [];
        let sourceFileChangeHandler: ((payload: SourceFileChangePayload) => void) | undefined;
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const connection = createConnectionStub({
            onDidOpenTextDocument: jest.fn(handler => {
                openHandlers.push(handler);
                return Disposable.create(() => undefined);
            }),
            onDidCloseTextDocument: jest.fn(handler => {
                closeHandlers.push(handler);
                return Disposable.create(() => undefined);
            }),
            onNotification: jest.fn((type, handler) => {
                if (type === SourceFileChangeNotification.type) {
                    sourceFileChangeHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const changeIndex = new WorkspaceChangeIndex();
        const ownerUri = 'file:///D:/workspace/adm/daemons/ownerd.c';
        const dependencyUri = 'file:///D:/workspace/include/settings.h';
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
            changeIndex,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any
        });

        openHandlers[0]?.({
            textDocument: {
                uri: ownerUri,
                languageId: 'lpc',
                version: 7,
                text: '#include "/include/settings.h"\nvoid create() {}'
            }
        });
        await Promise.resolve();
        changeIndex.recordDependencyFootprint(ownerUri, [dependencyUri]);
        diagnosticsSession.refresh.mockClear();

        sourceFileChangeHandler?.({
            uri: dependencyUri,
            changeType: 'changed'
        });
        closeHandlers[0]?.({
            textDocument: {
                uri: ownerUri
            }
        });
        openHandlers[0]?.({
            textDocument: {
                uri: ownerUri,
                languageId: 'lpc',
                version: 8,
                text: '#include "/include/settings.h"\nvoid create() { int fresh = 1; }'
            }
        });
        await Promise.resolve();
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(1);
        expect(diagnosticsSession.refresh).toHaveBeenCalledWith(ownerUri);

        sourceFileChangeHandler?.({
            uri: 'file:///D:/workspace/include/unrelated.h',
            changeType: 'changed'
        });
        jest.advanceTimersByTime(200);
        await Promise.resolve();

        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(1);
    });

    test('workspace config sync refreshes diagnostics for already open documents', async () => {
        let configSyncHandler: ((payload: WorkspaceConfigSyncPayload) => void) | undefined;
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const onWorkspaceConfigSync = jest.fn(async () => undefined);
        const connection = createConnectionStub({
            onNotification: jest.fn((type, handler) => {
                if (type === WorkspaceConfigSyncNotification.type) {
                    configSyncHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const changeIndex = new WorkspaceChangeIndex();
        const uri = 'file:///D:/workspace/diagnostics.c';
        const workspaceSession = new WorkspaceSession({});
        const loggerOutput = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        };
        const logger = new ServerLogger(loggerOutput);
        documentStore.open(uri, 1, 'new_bind("/x");');
        changeIndex.markOpened(uri, 1);
        changeIndex.markClean(uri);

        registerCapabilities({
            connection,
            changeIndex,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any,
            onWorkspaceConfigSync
        });

        configSyncHandler?.({
            workspaceRoots: ['D:/workspace'],
            workspaces: [{
                workspaceRoot: 'D:/workspace',
                projectConfigPath: 'D:/workspace/lpc-support.json',
                configHellPath: 'config/config.dev',
                resolvedConfig: {
                    simulatedEfunFile: '/adm/single/simul_efun'
                },
                lastSyncedAt: '2026-06-08T00:00:00.000Z'
            }]
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(onWorkspaceConfigSync).toHaveBeenCalledTimes(1);
        expect(diagnosticsSession.refresh).toHaveBeenCalledWith(uri);
        expect(changeIndex.get(uri)).toEqual(expect.objectContaining({
            dirty: false,
            workspaceConfigGeneration: 1
        }));
    });

    test('defers diagnostics opened before the first workspace config sync is ready', async () => {
        const openHandlers: Array<(params: DidOpenTextDocumentParams) => void> = [];
        let configSyncHandler: ((payload: WorkspaceConfigSyncPayload) => void) | undefined;
        let finishWorkspaceConfigSync: (() => void) | undefined;
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const onWorkspaceConfigSync = jest.fn(() => new Promise<void>((resolve) => {
            finishWorkspaceConfigSync = resolve;
        }));
        const connection = createConnectionStub({
            onDidOpenTextDocument: jest.fn(handler => {
                openHandlers.push(handler);
                return Disposable.create(() => undefined);
            }),
            onNotification: jest.fn((type, handler) => {
                if (type === WorkspaceConfigSyncNotification.type) {
                    configSyncHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({});
        const loggerOutput = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        };
        const logger = new ServerLogger(loggerOutput);

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any,
            onWorkspaceConfigSync
        });

        openHandlers[0]?.({
            textDocument: {
                uri: 'file:///D:/workspace/diagnostics.c',
                languageId: 'lpc',
                version: 1,
                text: 'new_bind("/x");'
            }
        });

        expect(diagnosticsSession.refresh).not.toHaveBeenCalled();

        configSyncHandler?.({
            workspaceRoots: ['D:/workspace'],
            workspaces: [{
                workspaceRoot: 'D:/workspace',
                projectConfigPath: 'D:/workspace/lpc-support.json',
                configHellPath: 'config/config.dev',
                resolvedConfig: {
                    simulatedEfunFile: '/adm/single/simul_efun'
                },
                lastSyncedAt: '2026-06-08T00:00:00.000Z'
            }]
        });
        await Promise.resolve();

        expect(diagnosticsSession.refresh).not.toHaveBeenCalled();

        finishWorkspaceConfigSync?.();
        await Promise.resolve();
        await Promise.resolve();

        expect(diagnosticsSession.refresh).toHaveBeenCalledTimes(1);
        expect(diagnosticsSession.refresh).toHaveBeenCalledWith('file:///D:/workspace/diagnostics.c');
    });

    test('releases deferred diagnostics when workspace config sync fails', async () => {
        const openHandlers: Array<(params: DidOpenTextDocumentParams) => void> = [];
        let configSyncHandler: ((payload: WorkspaceConfigSyncPayload) => void) | undefined;
        const diagnosticsSession = {
            refresh: jest.fn(async () => []),
            clear: jest.fn(() => [])
        };
        const onWorkspaceConfigSync = jest.fn(async () => {
            throw new Error('sync failed');
        });
        const connection = createConnectionStub({
            onDidOpenTextDocument: jest.fn(handler => {
                openHandlers.push(handler);
                return Disposable.create(() => undefined);
            }),
            onNotification: jest.fn((type, handler) => {
                if (type === WorkspaceConfigSyncNotification.type) {
                    configSyncHandler = handler as any;
                }
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({});
        const loggerOutput = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        };
        const logger = new ServerLogger(loggerOutput);

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            diagnosticsSession: diagnosticsSession as any,
            onWorkspaceConfigSync
        });

        openHandlers[0]?.({
            textDocument: {
                uri: 'file:///D:/workspace/diagnostics.c',
                languageId: 'lpc',
                version: 1,
                text: 'new_bind("/x");'
            }
        });

        configSyncHandler?.({
            workspaceRoots: ['D:/workspace'],
            workspaces: [{
                workspaceRoot: 'D:/workspace',
                projectConfigPath: 'D:/workspace/lpc-support.json',
                configHellPath: 'config/config.dev',
                resolvedConfig: {
                    simulatedEfunFile: '/adm/single/simul_efun'
                },
                lastSyncedAt: '2026-06-08T00:00:00.000Z'
            }]
        });
        await Promise.resolve();
        await Promise.resolve();

        expect(loggerOutput.error).toHaveBeenCalledWith('Failed to apply workspace configuration sync: sync failed');
        expect(diagnosticsSession.refresh).toHaveBeenCalledWith('file:///D:/workspace/diagnostics.c');
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
