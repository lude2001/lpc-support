import { describe, expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import type * as vscode from 'vscode';
import { registerWorkspaceIndexController } from '../client/workspaceIndexController';
import {
    WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
    WORKSPACE_INDEX_READY_NOTIFICATION,
    WORKSPACE_INDEX_REBUILD_REQUEST
} from '../shared/protocol/workspaceIndex';

type StatusBarMock = {
    show: jest.Mock;
    dispose: jest.Mock;
    text: string;
    tooltip: string;
    command: string | undefined;
};

type IndexAction = { title: string; action: string };

const locales = [
    { language: 'en', build: 'Build index', later: 'Later', idle: '$(database) LPC Index', ready: '$(database) LPC Index: Ready',
        progress: '$(sync~spin) LPC Index: 40/100', progressDetails: '32 indexed, 7 skipped, 1 failed.' },
    { language: 'zh-cn', build: '构建索引', later: '稍后', idle: '$(database) LPC 索引', ready: '$(database) LPC 索引：就绪',
        progress: '$(sync~spin) LPC 索引：40/100', progressDetails: '已索引 32 个，跳过 7 个，失败 1 个。' }
];

const chooseAction = (action: string) => async (_message: unknown, ...options: unknown[]): Promise<IndexAction | undefined> =>
    options.find((option): option is IndexAction => typeof option === 'object' && option !== null
        && 'action' in option && option.action === action && 'title' in option && typeof option.title === 'string');

type RebuildResponse = {
    status: string;
    totalFiles: number;
    indexedFiles: number;
    skippedFiles: number;
    failedFiles: number;
    durationMs: number;
};

type SendRequestMethod = (
    method: string,
    params: { workspaces: Array<Record<string, unknown>> }
) => Promise<RebuildResponse>;

jest.mock('vscode', () => ({
    l10n: jest.requireActual<typeof import('vscode')>('vscode').l10n,
    env: jest.requireActual<typeof import('vscode')>('vscode').env,
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
    env: { language: string };
    window: {
        createStatusBarItem: jest.Mock<() => StatusBarMock>;
        showInformationMessage: jest.Mock<(...args: unknown[]) => Promise<IndexAction | undefined>>;
        showWarningMessage: jest.Mock<(...args: unknown[]) => Promise<string | undefined>>;
        showErrorMessage: jest.Mock<(...args: unknown[]) => Promise<string | undefined>>;
    };
    workspace: {
        workspaceFolders: Array<{ uri: { fsPath: string } }>;
    };
};

describe('workspace index controller', () => {
    beforeEach(() => {
        vscodeMock.env.language = 'zh-cn';
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

    afterEach(() => {
        vscodeMock.env.language = 'zh-cn';
    });

    test.each(locales)('prompts once and rebuilds from the stable action in $language', async locale => {
        vscodeMock.env.language = locale.language;
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/mud' } }];
        vscodeMock.window.showInformationMessage.mockImplementationOnce(chooseAction('build')).mockResolvedValueOnce(undefined);
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
        expect(vscodeMock.window.showInformationMessage.mock.calls[0].slice(1)).toEqual([
            { title: locale.build, action: 'build' },
            { title: locale.later, action: 'later' }
        ]);
        expect(manager.sendRequest).toHaveBeenCalledTimes(1);
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
        const statusBarItem = vscodeMock.window.createStatusBarItem.mock.results[0].value as StatusBarMock;
        expect(statusBarItem.text).toBe(locale.ready);
        expect(statusBarItem.command).toBe('lpc.rebuildWorkspaceIndex');
    });

    test.each(locales)('does not rebuild for the later action in $language', async locale => {
        vscodeMock.env.language = locale.language;
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/mud' } }];
        vscodeMock.window.showInformationMessage.mockImplementationOnce(chooseAction('later'));
        const context = {
            subscriptions: [],
            workspaceState: { get: jest.fn(() => false), update: jest.fn(async () => undefined) }
        } as unknown as vscode.ExtensionContext;
        const manager = { onNotification: jest.fn(() => ({ dispose: jest.fn() })), sendRequest: jest.fn() };

        registerWorkspaceIndexController({
            context,
            manager: manager as any,
            projectConfigService: {
                getProjectConfigPath: jest.fn(() => 'D:/mud/lpc-support.json'),
                loadForWorkspace: jest.fn(async () => ({ version: 1, configHellPath: 'config.hell' }))
            } as any,
            registerRebuildCommand: jest.fn(() => ({ dispose: jest.fn() }))
        });
        await flushPromises();

        expect(vscodeMock.window.showInformationMessage.mock.calls[0].slice(1)).toEqual([
            { title: locale.build, action: 'build' },
            { title: locale.later, action: 'later' }
        ]);
        expect(context.workspaceState.update).toHaveBeenCalledWith('lpc.workspaceIndex.prompted.d:/mud', true);
        expect(manager.sendRequest).not.toHaveBeenCalled();
        const statusBarItem = vscodeMock.window.createStatusBarItem.mock.results[0].value as StatusBarMock;
        expect(statusBarItem.text).toBe(locale.idle);
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
            sendRequest: jest.fn<SendRequestMethod>(async () => ({
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

    test.each(locales)('updates localized workspace progress while rebuilding in $language', async locale => {
        vscodeMock.env.language = locale.language;
        vscodeMock.workspace.workspaceFolders = [{ uri: { fsPath: 'D:/mud' } }];
        const context = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => true),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        const notificationHandlers = new Map<string, (payload: unknown) => void>();
        let finishRebuild: (() => void) | undefined;
        const manager = {
            onNotification: jest.fn((method: string, handler: (payload: unknown) => void) => {
                notificationHandlers.set(method, handler);
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
        notificationHandlers.get(WORKSPACE_INDEX_PROGRESS_NOTIFICATION)?.({
            status: 'building',
            totalFiles: 100,
            processedFiles: 40,
            indexedFiles: 32,
            skippedFiles: 7,
            failedFiles: 1
        });

        const statusBarItem = vscodeMock.window.createStatusBarItem.mock.results[0].value as StatusBarMock;
        expect(manager.onNotification).toHaveBeenCalledWith(
            WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
            expect.any(Function)
        );
        expect(statusBarItem.text).toBe(locale.progress);
        expect(statusBarItem.tooltip).toContain(locale.progressDetails);

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

    test('refreshes index consumers when the background index becomes ready', () => {
        const context = {
            subscriptions: [],
            workspaceState: {
                get: jest.fn(() => true),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        const notificationHandlers = new Map<string, (payload: unknown) => void>();
        const onIndexReady = jest.fn();

        registerWorkspaceIndexController({
            context,
            manager: {
                onNotification: jest.fn((method: string, handler: (payload: unknown) => void) => {
                    notificationHandlers.set(method, handler);
                    return { dispose: jest.fn() };
                }),
                sendRequest: jest.fn()
            } as any,
            projectConfigService: {
                getProjectConfigPath: jest.fn(),
                loadForWorkspace: jest.fn()
            } as any,
            registerRebuildCommand: jest.fn(() => ({ dispose: jest.fn() })),
            onIndexReady
        });

        const ready = {
            status: 'ready' as const,
            totalFiles: 120,
            indexedFiles: 118,
            skippedFiles: 2,
            failedFiles: 0,
            durationMs: 20000
        };
        notificationHandlers.get(WORKSPACE_INDEX_READY_NOTIFICATION)?.(ready);

        expect(onIndexReady).toHaveBeenCalledWith(ready);
        const statusBarItem = vscodeMock.window.createStatusBarItem.mock.results[0].value as StatusBarMock;
        expect(statusBarItem.text).toBe('$(database) LPC 索引：就绪');
    });
});

async function flushPromises(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
}
