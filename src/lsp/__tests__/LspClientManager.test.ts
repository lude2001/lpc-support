import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type * as vscode from 'vscode';
import { activateLspClient } from '../client/activateLspClient';
import {
    initializeConfigurationBridge,
    WORKSPACE_CONFIG_SYNC_NOTIFICATION
} from '../client/bridges/configurationBridge';
import { LspClientManager } from '../client/LspClientManager';
import { getRegisteredProjectConfigService } from '../../modules/coreModule';

const mockLanguageClientSendNotification = jest.fn();
const mockLanguageClientStart = jest.fn().mockResolvedValue(undefined);
const mockLanguageClientStop = jest.fn().mockResolvedValue(undefined);
const mockLanguageClientDispose = jest.fn();
const mockLanguageClientConstructor = jest.fn();

jest.mock('vscode-languageclient/node', () => ({
    TransportKind: {
        ipc: 'ipc'
    },
    LanguageClient: jest.fn().mockImplementation((...args: unknown[]) => {
        mockLanguageClientConstructor(...args);
        return {
            start: mockLanguageClientStart,
            stop: mockLanguageClientStop,
            sendNotification: mockLanguageClientSendNotification,
            dispose: mockLanguageClientDispose
        };
    })
}));

jest.mock('../client/bridges/configurationBridge', () => ({
    WORKSPACE_CONFIG_SYNC_NOTIFICATION: 'lpc/workspaceConfigSync',
    initializeConfigurationBridge: jest.fn()
}));

jest.mock('../../modules/coreModule', () => ({
    getRegisteredProjectConfigService: jest.fn()
}));

const actualConfigurationBridge = jest.requireActual('../client/bridges/configurationBridge') as typeof import('../client/bridges/configurationBridge');

jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [],
        onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
        onDidChangeWorkspaceFolders: jest.fn(() => ({ dispose: jest.fn() })),
        createFileSystemWatcher: jest.fn()
    },
    window: {
        createOutputChannel: jest.fn(() => ({ dispose: jest.fn() }))
    }
}), { virtual: true });

type WatcherRegistration = {
    onDidChange: jest.Mock;
    onDidCreate: jest.Mock;
    onDidDelete: jest.Mock;
    dispose: jest.Mock;
    __changeHandler?: () => void;
    __createHandler?: () => void;
    __deleteHandler?: () => void;
};

const vscodeMock = jest.requireMock('vscode') as {
    workspace: {
        workspaceFolders: Array<{ uri: { fsPath: string } }>;
        onDidChangeConfiguration: jest.Mock;
        onDidChangeWorkspaceFolders: jest.Mock;
        createFileSystemWatcher: jest.Mock;
    };
    window: {
        createOutputChannel: jest.Mock;
    };
};

describe('LspClientManager activation', () => {
    beforeEach(() => {
        vscodeMock.workspace.workspaceFolders = [];
        vscodeMock.workspace.onDidChangeConfiguration.mockReset().mockReturnValue({ dispose: jest.fn() });
        vscodeMock.workspace.onDidChangeWorkspaceFolders.mockReset().mockReturnValue({ dispose: jest.fn() });
        vscodeMock.workspace.createFileSystemWatcher.mockReset().mockImplementation(() => {
            const watcher: WatcherRegistration = {
                onDidChange: jest.fn(handler => {
                    watcher.__changeHandler = handler;
                    return { dispose: jest.fn() };
                }),
                onDidCreate: jest.fn(handler => {
                    watcher.__createHandler = handler;
                    return { dispose: jest.fn() };
                }),
                onDidDelete: jest.fn(handler => {
                    watcher.__deleteHandler = handler;
                    return { dispose: jest.fn() };
                }),
                dispose: jest.fn()
            };
            return watcher;
        });
        vscodeMock.window.createOutputChannel.mockReset().mockReturnValue({ dispose: jest.fn() });
        mockLanguageClientConstructor.mockReset();
        mockLanguageClientSendNotification.mockReset();
        mockLanguageClientStart.mockReset().mockResolvedValue(undefined);
        mockLanguageClientStop.mockReset().mockResolvedValue(undefined);
        mockLanguageClientDispose.mockReset();
        (initializeConfigurationBridge as jest.Mock).mockReset().mockImplementation(async () => ({ dispose: jest.fn() }));
        (getRegisteredProjectConfigService as jest.Mock).mockReset().mockReturnValue({
            getProjectConfigPath: jest.fn(),
            loadForWorkspace: jest.fn()
        });
    });

    test('activateLspClient starts and tracks a manager on the public LSP path', async () => {
        const context = { subscriptions: [] } as unknown as vscode.ExtensionContext;
        const startSpy = jest.fn().mockResolvedValue(undefined);
        const stopSpy = jest.fn().mockResolvedValue(undefined);
        const managerFactory = () => new LspClientManager({
            start: startSpy,
            stop: stopSpy
        });

        const manager = await activateLspClient(context, managerFactory);

        expect(manager).toBeInstanceOf(LspClientManager);
        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(context.subscriptions).toContain(manager);

        context.subscriptions[0].dispose();
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('activateLspClient initializes the configuration bridge on the production path', async () => {
        const context = {
            subscriptions: [],
            asAbsolutePath: jest.fn((targetPath: string) => `D:/code/lpc-support/${targetPath}`)
        } as unknown as vscode.ExtensionContext;
        const bridgeDisposable = { dispose: jest.fn() };
        const projectConfigService = {
            getProjectConfigPath: jest.fn(),
            loadForWorkspace: jest.fn()
        };

        (initializeConfigurationBridge as jest.Mock).mockResolvedValue(bridgeDisposable);
        (getRegisteredProjectConfigService as jest.Mock).mockReturnValue(projectConfigService);

        const manager = await activateLspClient(context);

        expect(manager).toBeInstanceOf(LspClientManager);
        expect(mockLanguageClientConstructor).toHaveBeenCalledTimes(1);
        expect(initializeConfigurationBridge).toHaveBeenCalledWith({
            client: expect.any(Object),
            projectConfigService
        });

        const bridgeClient = (initializeConfigurationBridge as jest.Mock).mock.calls[0][0].client as {
            sendNotification: (method: string, payload: unknown) => Promise<void>;
        };
        const payload = { workspaceRoots: ['D:/workspace'], workspaces: [] };
        await bridgeClient.sendNotification(WORKSPACE_CONFIG_SYNC_NOTIFICATION, payload);

        expect(mockLanguageClientSendNotification).toHaveBeenCalledWith(
            WORKSPACE_CONFIG_SYNC_NOTIFICATION,
            payload
        );
        expect(mockLanguageClientStart).toHaveBeenCalledTimes(1);

        await manager?.stop();
        expect(mockLanguageClientStop).toHaveBeenCalledTimes(1);
        expect(bridgeDisposable.dispose).toHaveBeenCalledTimes(1);
    });

    test('manager stop is idempotent after start', async () => {
        const startSpy = jest.fn().mockResolvedValue(undefined);
        const stopSpy = jest.fn().mockResolvedValue(undefined);
        const manager = new LspClientManager({
            start: startSpy,
            stop: stopSpy
        });

        await manager.start();
        await manager.stop();
        await manager.stop();

        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('dispose waits for an in-flight start and shuts down exactly once', async () => {
        let resolveStart: (() => void) | undefined;
        const startSpy = jest.fn().mockImplementation(async () => {
            await new Promise<void>(resolve => {
                resolveStart = resolve;
            });
        });
        const stopSpy = jest.fn().mockResolvedValue(undefined);
        const manager = new LspClientManager({
            start: startSpy,
            stop: stopSpy
        });

        const startPromise = manager.start();
        manager.dispose();

        resolveStart?.();
        await startPromise;
        await manager.stop();

        expect(startSpy).toHaveBeenCalledTimes(1);
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });

    test('initializeConfigurationBridge sends a synchronized config snapshot on the public LSP path', async () => {
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];

        const sendNotification = jest.fn();
        const projectConfigService = {
            getProjectConfigPath: jest.fn((workspaceRoot: string) => `${workspaceRoot}/lpc-support.json`),
            loadForWorkspace: jest.fn().mockResolvedValue({
                version: 1,
                configHellPath: 'config.hell',
                resolved: {
                    includeDirectories: ['include']
                },
                lastSyncedAt: '2026-04-10T00:00:00.000Z'
            })
        };

        const disposable = await actualConfigurationBridge.initializeConfigurationBridge({
            client: { sendNotification },
            projectConfigService
        });

        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith('D:/workspace');
        expect(sendNotification).toHaveBeenCalledWith(
            WORKSPACE_CONFIG_SYNC_NOTIFICATION,
            {
                workspaceRoots: ['D:/workspace'],
                workspaces: [
                    {
                        workspaceRoot: 'D:/workspace',
                        projectConfigPath: 'D:/workspace/lpc-support.json',
                        configHellPath: 'config.hell',
                        resolvedConfig: {
                            includeDirectories: ['include']
                        },
                        lastSyncedAt: '2026-04-10T00:00:00.000Z'
                    }
                ]
            }
        );
        expect(vscodeMock.workspace.onDidChangeConfiguration).toHaveBeenCalledTimes(1);
        expect(vscodeMock.workspace.onDidChangeWorkspaceFolders).toHaveBeenCalledTimes(1);
        expect(vscodeMock.workspace.createFileSystemWatcher).toHaveBeenCalledWith('D:/workspace/lpc-support.json');
        expect(vscodeMock.workspace.createFileSystemWatcher).toHaveBeenCalledWith('D:/workspace/config.hell');

        disposable.dispose();
    });

    test('initializeConfigurationBridge resyncs when workspace roots change and cleans up watchers on dispose', async () => {
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/workspace-a' } }];

        const sendNotification = jest.fn();
        const projectConfigService = {
            getProjectConfigPath: jest.fn((workspaceRoot: string) => `${workspaceRoot}/lpc-support.json`),
            loadForWorkspace: jest.fn().mockResolvedValue({
                version: 1,
                configHellPath: 'config.hell'
            })
        };

        const disposable = await actualConfigurationBridge.initializeConfigurationBridge({
            client: { sendNotification },
            projectConfigService
        });

        const workspaceFoldersHandler = vscodeMock.workspace.onDidChangeWorkspaceFolders.mock.calls[0][0] as () => void;
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/workspace-b' } }];

        await workspaceFoldersHandler();

        expect(sendNotification).toHaveBeenNthCalledWith(2, WORKSPACE_CONFIG_SYNC_NOTIFICATION, {
            workspaceRoots: ['D:/workspace-b'],
            workspaces: [
                {
                    workspaceRoot: 'D:/workspace-b',
                    projectConfigPath: 'D:/workspace-b/lpc-support.json',
                    configHellPath: 'config.hell',
                    resolvedConfig: undefined,
                    lastSyncedAt: undefined
                }
            ]
        });

        const firstWatcher = vscodeMock.workspace.createFileSystemWatcher.mock.results[0].value as WatcherRegistration;
        disposable.dispose();

        expect(firstWatcher.dispose).toHaveBeenCalled();
    });

    test('initializeConfigurationBridge normalizes and deduplicates nested multi-workspace sync payloads', async () => {
        vscodeMock.workspace.workspaceFolders = [
            { uri: { fsPath: 'D:\\workspace-a\\' } },
            { uri: { fsPath: 'D:/workspace-a/nested/' } },
            { uri: { fsPath: 'D:/workspace-a' } }
        ];

        const sendNotification = jest.fn();
        const projectConfigService = {
            getProjectConfigPath: jest.fn((workspaceRoot: string) => `${workspaceRoot}\\lpc-support.json`),
            loadForWorkspace: jest.fn((workspaceRoot: string) => Promise.resolve({
                version: 1,
                configHellPath: workspaceRoot.includes('nested')
                    ? '.vscode\\nested.hell'
                    : 'config.hell'
            }))
        };

        const disposable = await actualConfigurationBridge.initializeConfigurationBridge({
            mode: 'lsp',
            client: { sendNotification },
            projectConfigService
        });

        expect(sendNotification).toHaveBeenCalledWith(WORKSPACE_CONFIG_SYNC_NOTIFICATION, {
            workspaceRoots: ['D:/workspace-a', 'D:/workspace-a/nested'],
            workspaces: [
                {
                    workspaceRoot: 'D:/workspace-a',
                    projectConfigPath: 'D:/workspace-a/lpc-support.json',
                    configHellPath: 'config.hell',
                    resolvedConfig: undefined,
                    lastSyncedAt: undefined
                },
                {
                    workspaceRoot: 'D:/workspace-a/nested',
                    projectConfigPath: 'D:/workspace-a/nested/lpc-support.json',
                    configHellPath: '.vscode\\nested.hell',
                    resolvedConfig: undefined,
                    lastSyncedAt: undefined
                }
            ]
        });
        expect(vscodeMock.workspace.createFileSystemWatcher.mock.calls.map(call => call[0])).toEqual([
            'D:/workspace-a/lpc-support.json',
            'D:/workspace-a/config.hell',
            'D:/workspace-a/nested/lpc-support.json',
            'D:/workspace-a/nested/.vscode/nested.hell'
        ]);

        disposable.dispose();
    });

    test('initializeConfigurationBridge resyncs on watched file changes and reports async errors', async () => {
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];

        const sendNotification = jest.fn();
        const syncError = new Error('sync failed');
        const onError = jest.fn();
        const projectConfigService = {
            getProjectConfigPath: jest.fn((workspaceRoot: string) => `${workspaceRoot}/lpc-support.json`),
            loadForWorkspace: jest.fn()
                .mockResolvedValueOnce({
                    version: 1,
                    configHellPath: 'config.hell',
                    resolved: {
                        includeDirectories: ['include']
                    }
                })
                .mockRejectedValueOnce(syncError)
        };

        const disposable = await actualConfigurationBridge.initializeConfigurationBridge({
            client: { sendNotification },
            projectConfigService,
            onError
        });

        const projectConfigWatcher = vscodeMock.workspace.createFileSystemWatcher.mock.results[0].value as WatcherRegistration;

        await projectConfigWatcher.__changeHandler?.();

        expect(onError).toHaveBeenCalledWith(syncError);
        expect(sendNotification).toHaveBeenCalledTimes(1);

        disposable.dispose();
    });

});
