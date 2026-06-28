import { describe, expect, jest, test, beforeEach, afterEach } from '@jest/globals';
import * as vscode from 'vscode';
import { LpcProjectConfigSnapshotService } from '../LpcProjectConfigSnapshotService';

describe('LpcProjectConfigSnapshotService', () => {
    const originalCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher;
    const originalOnDidChangeWorkspaceFolders = vscode.workspace.onDidChangeWorkspaceFolders;
    const originalWorkspaceFolders = vscode.workspace.workspaceFolders;

    beforeEach(() => {
        (vscode.workspace as any).workspaceFolders = [
            { uri: { fsPath: 'D:\\workspace' } }
        ];
    });

    afterEach(() => {
        (vscode.workspace as any).createFileSystemWatcher = originalCreateFileSystemWatcher;
        (vscode.workspace as any).onDidChangeWorkspaceFolders = originalOnDidChangeWorkspaceFolders;
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        jest.restoreAllMocks();
    });

    test('keeps project config in memory and refreshes it from file watcher events', async () => {
        const watcherHandlers: Array<() => void> = [];
        (vscode.workspace as any).createFileSystemWatcher = jest.fn(() => ({
            onDidChange: jest.fn((handler: () => void) => {
                watcherHandlers.push(handler);
                return { dispose: jest.fn() };
            }),
            onDidCreate: jest.fn((handler: () => void) => {
                watcherHandlers.push(handler);
                return { dispose: jest.fn() };
            }),
            onDidDelete: jest.fn((handler: () => void) => {
                watcherHandlers.push(handler);
                return { dispose: jest.fn() };
            }),
            dispose: jest.fn()
        }));
        (vscode.workspace as any).onDidChangeWorkspaceFolders = jest.fn(() => ({ dispose: jest.fn() }));

        const projectConfigService = {
            getProjectConfigPath: jest.fn(() => 'D:\\workspace\\lpc-support.json'),
            loadForWorkspace: jest.fn()
                .mockResolvedValueOnce({
                    version: 1 as const,
                    configHellPath: 'config.hell',
                    instanceResolutionFunctions: {
                        this_player: ['/clone/user/user']
                    },
                    resolved: {
                        masterFile: '/adm/obj/master',
                        includeDirectories: ['include']
                    },
                    lastSyncedAt: '2026-06-28T00:00:00.000Z'
                })
                .mockResolvedValueOnce({
                    version: 1 as const,
                    configHellPath: 'config.hell',
                    instanceResolutionFunctions: {
                        get_actor: ['/adm/objects/player']
                    },
                    resolved: {
                        masterFile: '/adm/obj/master'
                    },
                    lastSyncedAt: '2026-06-28T00:01:00.000Z'
                })
        };
        const service = new LpcProjectConfigSnapshotService(projectConfigService);

        await service.refreshAllWorkspaceSnapshots();

        const firstSnapshot = service.getWorkspaceProjectConfig('D:/workspace');
        expect(firstSnapshot?.instanceResolutionFunctions).toEqual({
            this_player: ['/clone/user/user']
        });
        expect(firstSnapshot?.resolvedConfig?.includeDirectories).toEqual(['include']);
        firstSnapshot?.instanceResolutionFunctions?.this_player.push('/mutated');

        expect(service.getWorkspaceProjectConfig('D:/workspace')?.instanceResolutionFunctions).toEqual({
            this_player: ['/clone/user/user']
        });
        expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('D:/workspace/lpc-support.json');
        expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('D:/workspace/config.hell');

        watcherHandlers[0]();
        await Promise.resolve();
        await Promise.resolve();

        expect(service.getWorkspaceProjectConfig('D:/workspace')?.instanceResolutionFunctions).toEqual({
            get_actor: ['/adm/objects/player']
        });
        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledTimes(2);
    });
});
