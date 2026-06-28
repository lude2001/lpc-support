import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import type * as vscode from 'vscode';
import { registerWorkspaceIndexController } from '../client/workspaceIndexController';
import {
    WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
    WORKSPACE_INDEX_REBUILD_REQUEST
} from '../shared/protocol/workspaceIndex';

jest.mock('vscode', () => ({
    StatusBarAlignment: {
        Right: 2
    },
    window: {
        createStatusBarItem: jest.fn(() => ({
            show: jest.fn(),
            dispose: jest.fn(),
            text: '',
            tooltip: '',
            command: undefined
        })),
        showInformationMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    workspace: {
        workspaceFolders: []
    }
}), { virtual: true });

const vscodeMock = jest.requireMock('vscode') as {
    window: {
        createStatusBarItem: jest.Mock;
        showInformationMessage: jest.Mock;
        showWarningMessage: jest.Mock;
        showErrorMessage: jest.Mock;
    };
    workspace: {
        workspaceFolders: Array<{ uri: { fsPath: string } }>;
    };
};

describe('workspace index controller', () => {
    beforeEach(() => {
        vscodeMock.window.createStatusBarItem.mockClear().mockReturnValue({
            show: jest.fn(),
            dispose: jest.fn(),
            text: '',
            tooltip: '',
            command: undefined
        });
        vscodeMock.window.showInformationMessage.mockReset();
        vscodeMock.window.showWarningMessage.mockReset();
        vscodeMock.window.showErrorMessage.mockReset();
        vscodeMock.workspace.workspaceFolders = [];
    });

    test('prompts once and rebuilds the workspace index when accepted', async () => {
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/mud' } }];
        vscodeMock.window.showInformationMessage.mockResolvedValueOnce('构建索引').mockResolvedValueOnce(undefined);
        const workspaceState = {
            get: jest.fn(() => false),
            update: jest.fn(async () => undefined)
        };
        const context = {
            subscriptions: [],
            workspaceState
        } as unknown as vscode.ExtensionContext;
        const manager = {
            onNotification: jest.fn(() => ({ dispose: jest.fn() })),
            sendRequest: jest.fn(async () => ({
                status: 'ready',
                totalFiles: 2,
                indexedFiles: 2,
                skippedFiles: 0,
                failedFiles: 0,
                durationMs: 7
            }))
        };
        const projectConfigService = {
            getProjectConfigPath: jest.fn(() => 'D:/mud/lpc-support.json'),
            loadForWorkspace: jest.fn(async () => ({ version: 1, configHellPath: 'config.hell' }))
        };
        const registerRebuildCommand = jest.fn(() => ({ dispose: jest.fn() }));

        registerWorkspaceIndexController({
            context,
            manager: manager as any,
            projectConfigService: projectConfigService as any,
            registerRebuildCommand
        });
        await flushPromises();

        expect(workspaceState.update).toHaveBeenCalledWith(
            'lpc.workspaceIndex.prompted.d:/mud',
            true
        );
        expect(manager.sendRequest).toHaveBeenCalledWith(
            WORKSPACE_INDEX_REBUILD_REQUEST,
            expect.objectContaining({
                workspaceRoots: ['D:/mud'],
                workspaces: [expect.objectContaining({
                    workspaceRoot: 'D:/mud',
                    projectConfigPath: 'D:/mud/lpc-support.json'
                })]
            })
        );
        const statusBarItem = vscodeMock.window.createStatusBarItem.mock.results[0].value;
        expect(statusBarItem.text).toBe('$(database) LPC Index: Ready');
    });

    test('skips the initial prompt when no workspace has LPC project config', async () => {
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/plain' } }];
        const context = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => false),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        const manager = {
            onNotification: jest.fn(() => ({ dispose: jest.fn() })),
            sendRequest: jest.fn()
        };

        registerWorkspaceIndexController({
            context,
            manager: manager as any,
            projectConfigService: {
                getProjectConfigPath: jest.fn(() => 'D:/plain/lpc-support.json'),
                loadForWorkspace: jest.fn(async () => undefined)
            } as any,
            registerRebuildCommand: jest.fn(() => ({ dispose: jest.fn() }))
        });
        await flushPromises();

        expect(vscodeMock.window.showInformationMessage).not.toHaveBeenCalled();
        expect(context.workspaceState.update).not.toHaveBeenCalled();
        expect(manager.sendRequest).not.toHaveBeenCalled();
    });

    test('manual rebuild indexes only configured LPC workspaces', async () => {
        vscodeMock.workspace.workspaceFolders = [
            { uri: { fsPath: 'D:/mud' } },
            { uri: { fsPath: 'D:/plain' } }
        ];
        const context = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => true),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        const manager = {
            onNotification: jest.fn(() => ({ dispose: jest.fn() })),
            sendRequest: jest.fn(async () => ({
                status: 'ready',
                totalFiles: 1,
                indexedFiles: 1,
                skippedFiles: 0,
                failedFiles: 0,
                durationMs: 3
            }))
        };
        const projectConfigService = {
            getProjectConfigPath: jest.fn((workspaceRoot: string) => `${workspaceRoot}/lpc-support.json`),
            loadForWorkspace: jest.fn(async (workspaceRoot: string) => workspaceRoot === 'D:/mud'
                ? { version: 1, configHellPath: 'config.hell' }
                : undefined
            )
        };
        let rebuild: (() => Promise<void>) | undefined;
        const registerRebuildCommand = jest.fn((handler: () => Promise<void>) => {
            rebuild = handler;
            return { dispose: jest.fn() };
        });

        registerWorkspaceIndexController({
            context,
            manager: manager as any,
            projectConfigService: projectConfigService as any,
            registerRebuildCommand
        });
        await rebuild?.();

        expect(manager.sendRequest).toHaveBeenCalledWith(
            WORKSPACE_INDEX_REBUILD_REQUEST,
            expect.objectContaining({
                workspaceRoots: ['D:/mud'],
                workspaces: [expect.objectContaining({
                    workspaceRoot: 'D:/mud',
                    projectConfigPath: 'D:/mud/lpc-support.json'
                })]
            })
        );
        expect(manager.sendRequest.mock.calls[0][1].workspaces).toHaveLength(1);
    });

    test('updates the status bar with workspace index progress while rebuilding', async () => {
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/mud' } }];
        const context = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => true),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        let progressHandler: ((payload: unknown) => void) | undefined;
        let finishRebuild: (() => void) | undefined;
        const manager = {
            onNotification: jest.fn((_method: string, handler: (payload: unknown) => void) => {
                progressHandler = handler;
                return { dispose: jest.fn() };
            }),
            sendRequest: jest.fn(() => new Promise(resolve => {
                finishRebuild = () => resolve({
                    status: 'ready',
                    totalFiles: 100,
                    indexedFiles: 80,
                    skippedFiles: 19,
                    failedFiles: 1,
                    durationMs: 50
                });
            }))
        };
        const projectConfigService = {
            getProjectConfigPath: jest.fn(() => 'D:/mud/lpc-support.json'),
            loadForWorkspace: jest.fn(async () => ({ version: 1, configHellPath: 'config.hell' }))
        };
        let rebuild: (() => Promise<void>) | undefined;
        const registerRebuildCommand = jest.fn((handler: () => Promise<void>) => {
            rebuild = handler;
            return { dispose: jest.fn() };
        });

        registerWorkspaceIndexController({
            context,
            manager: manager as any,
            projectConfigService: projectConfigService as any,
            registerRebuildCommand
        });
        const rebuildPromise = rebuild?.() ?? Promise.resolve();
        await flushPromises();
        progressHandler?.({
            status: 'building',
            totalFiles: 100,
            processedFiles: 40,
            indexedFiles: 32,
            skippedFiles: 7,
            failedFiles: 1
        });

        const statusBarItem = vscodeMock.window.createStatusBarItem.mock.results[0].value;
        expect(manager.onNotification).toHaveBeenCalledWith(
            WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
            expect.any(Function)
        );
        expect(statusBarItem.text).toBe('$(sync~spin) LPC Index: 40/100');
        expect(statusBarItem.tooltip).toContain('已索引 32 个，跳过 7 个，失败 1 个。');

        finishRebuild?.();
        await rebuildPromise;
    });

    test('registers a rebuild command for manual status bar use', () => {
        const context = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => true),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        const registerRebuildCommand = jest.fn(() => ({ dispose: jest.fn() }));

        registerWorkspaceIndexController({
            context,
            manager: {
                onNotification: jest.fn(() => ({ dispose: jest.fn() })),
                sendRequest: jest.fn()
            } as any,
            projectConfigService: {
                getProjectConfigPath: jest.fn(),
                loadForWorkspace: jest.fn()
            } as any,
            registerRebuildCommand
        });

        expect(registerRebuildCommand).toHaveBeenCalledWith(
            expect.any(Function)
        );
    });
});

async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
}
