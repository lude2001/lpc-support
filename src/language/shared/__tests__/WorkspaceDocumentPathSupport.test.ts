import * as path from 'path';
import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import { WorkspaceDocumentPathSupport } from '../WorkspaceDocumentPathSupport';

function createDocument(filePath: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath
    } as unknown as vscode.TextDocument;
}

describe('WorkspaceDocumentPathSupport', () => {
    test('tryOpenTextDocument returns undefined when the host throws', async () => {
        const support = new WorkspaceDocumentPathSupport({
            host: {
                openTextDocument: jest.fn(async () => {
                    throw new Error('boom');
                }),
                fileExists: jest.fn(() => false),
                getWorkspaceFolder: jest.fn(() => undefined)
            }
        });

        await expect(support.tryOpenTextDocument('D:/workspace/missing.c')).resolves.toBeUndefined();
    });

    test('resolves workspace and inherited file paths with macro expansion', () => {
        const workspaceRoot = 'D:/workspace';
        const document = createDocument('D:/workspace/obj/room.c');
        const support = new WorkspaceDocumentPathSupport({
            host: {
                openTextDocument: jest.fn(),
                fileExists: jest.fn(() => false),
                getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } }))
            },
            macroManager: {
                getMacro: jest.fn(() => ({ value: '"/std/base_room"' }))
            } as any
        });

        expect(support.getWorkspaceRoot(document)).toBe(workspaceRoot);
        expect(support.resolveWorkspaceFilePath(document, 'std/base_room.c', workspaceRoot)).toBe(
            path.join(workspaceRoot, 'std', 'base_room.c')
        );
        expect(support.resolveInheritedFilePath(document, 'ROOM_BASE', workspaceRoot)).toBe(
            path.join(workspaceRoot, 'std', 'base_room.c')
        );
    });

    test('resolves object file paths from string literals and macros through the shared owner', () => {
        const workspaceRoot = 'D:/workspace';
        const document = createDocument('D:/workspace/obj/room.c');
        const support = new WorkspaceDocumentPathSupport({
            host: {
                openTextDocument: jest.fn(),
                fileExists: jest.fn((candidate: string) => candidate.replace(/\\/g, '/') === 'D:/workspace/std/base_room.c'),
                getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } }))
            },
            macroManager: {
                getMacro: jest.fn((name: string) => name === 'ROOM_BASE'
                    ? { value: '"/std/base_room"' }
                    : undefined)
            } as any
        });

        expect(support.resolveObjectFilePath(document, '"/std/base_room"')?.replace(/\\/g, '/')).toBe(
            'D:/workspace/std/base_room.c'
        );
        expect(support.resolveObjectFilePath(document, 'ROOM_BASE')?.replace(/\\/g, '/')).toBe(
            'D:/workspace/std/base_room.c'
        );
        expect(support.resolveObjectFilePath(document, 'relative_room')).toBeUndefined();
    });

    test('resolves system include paths from project configuration first', async () => {
        const workspaceRoot = 'D:/workspace';
        const document = createDocument('D:/workspace/obj/room.c');
        const support = new WorkspaceDocumentPathSupport({
            host: {
                openTextDocument: jest.fn(),
                fileExists: jest.fn(() => false),
                getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } }))
            },
            projectConfigService: {
                getIncludeDirectoriesForWorkspace: jest.fn(async () => ['D:/workspace/include', 'D:/workspace/include2']),
                getPrimaryIncludeDirectoryForWorkspace: jest.fn(async () => 'D:/workspace/include')
            } as any
        });

        await expect(support.resolveIncludeFilePaths(document, 'common/config', true, workspaceRoot)).resolves.toEqual([
            path.join('D:/workspace/include', 'common/config.h'),
            path.join('D:/workspace/include2', 'common/config.h')
        ]);
        await expect(support.resolveIncludeFilePath(document, 'common/config', true, workspaceRoot)).resolves.toBe(
            path.join('D:/workspace/include', 'common/config.h')
        );
    });

    test('resolves configured simulated efun path and existing code path', async () => {
        const workspaceRoot = 'D:/workspace';
        const support = new WorkspaceDocumentPathSupport({
            host: {
                openTextDocument: jest.fn(),
                fileExists: jest.fn((candidate: string) =>
                    candidate.replace(/\\/g, '/') === 'D:/workspace/adm/simul_efun.c'
                ),
                getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } }))
            },
            projectConfigService: {
                getSimulatedEfunFileForWorkspace: jest.fn(async () => undefined)
            } as any
        });

        const simulatedPath = await support.getConfiguredSimulatedEfunFile(workspaceRoot, {
            resolvedConfig: {
                simulatedEfunFile: '/adm/simul_efun'
            }
        } as any);

        expect(simulatedPath?.replace(/\\/g, '/')).toBe('D:/workspace/adm/simul_efun.c');
        expect(support.resolveExistingCodePath('D:/workspace/adm/simul_efun').replace(/\\/g, '/')).toBe('D:/workspace/adm/simul_efun.c');
    });

    test('resolves mudlibDirectory relative to configHellPath when project config comes from workspace sync', async () => {
        const workspaceRoot = 'D:/code/shuiyuzhengfeng_lpc';
        const support = new WorkspaceDocumentPathSupport({
            host: {
                openTextDocument: jest.fn(),
                fileExists: jest.fn((candidate: string) =>
                    ['D:/code/shuiyuzhengfeng_lpc/include/globals.h', 'D:/code/shuiyuzhengfeng_lpc/adm/single/simul_efun.c']
                        .includes(candidate.replace(/\\/g, '/'))
                ),
                getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } }))
            },
            projectConfigService: {
                getSimulatedEfunFileForWorkspace: jest.fn(async () => undefined)
            } as any
        });

        const projectConfig = {
            configHellPath: 'config/config.dev',
            resolvedConfig: {
                mudlibDirectory: '../',
                includeDirectories: ['/include'],
                simulatedEfunFile: '/adm/single/simul_efun'
            }
        } as any;

        const includeDir = await support.getPrimaryIncludeDirectory(workspaceRoot, projectConfig);
        const simulatedPath = await support.getConfiguredSimulatedEfunFile(workspaceRoot, projectConfig);

        expect(includeDir?.replace(/\\/g, '/')).toBe('D:/code/shuiyuzhengfeng_lpc/include');
        expect(simulatedPath?.replace(/\\/g, '/')).toBe('D:/code/shuiyuzhengfeng_lpc/adm/single/simul_efun.c');
    });
});
