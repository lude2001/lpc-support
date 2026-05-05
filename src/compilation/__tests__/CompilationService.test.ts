import * as path from 'path';
import * as vscode from 'vscode';
import { CompilationService } from '../CompilationService';

describe('CompilationService', () => {
    let projectConfigService: {
        loadForWorkspace: jest.Mock;
        resolveWorkspacePath: jest.Mock;
    };
    let localBackend: { compile: jest.Mock };
    let remoteBackend: { compile: jest.Mock };

    beforeEach(() => {
        projectConfigService = {
            loadForWorkspace: jest.fn(),
            resolveWorkspacePath: jest.fn((workspaceRoot: string, targetPath: string) => path.resolve(workspaceRoot, targetPath))
        };
        localBackend = {
            compile: jest.fn()
        };
        remoteBackend = {
            compile: jest.fn()
        };

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({
            uri: { fsPath: 'D:/workspace' }
        });
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (filePath: string) => ({
            uri: vscode.Uri.file(filePath),
            fileName: filePath,
            languageId: 'lpc'
        }));
        (vscode.languages.createDiagnosticCollection as jest.Mock).mockClear();
        (vscode.window.createOutputChannel as jest.Mock).mockClear();
    });

    test('uses local backend for file compilation when compile.mode is local', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'etc/config.test',
            compile: {
                mode: 'local',
                local: {
                    useSystemCommand: true,
                    compileMode: 'fresh-required'
                }
            }
        });
        localBackend.compile.mockResolvedValue({
            version: 1,
            ok: true,
            kind: 'file',
            target: '/single/master.c',
            diagnostics: [],
            files_total: 0,
            files_ok: 0,
            files_failed: 0,
            results: []
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFile('D:/workspace/single/master.c');

        expect(localBackend.compile).toHaveBeenCalledWith(expect.objectContaining({
            workspaceRoot: 'D:/workspace',
            targetKind: 'file',
            targetPath: '/single/master.c',
            localConfig: expect.objectContaining({
                useSystemCommand: true,
                compileMode: 'fresh-required',
                driverConfigPath: path.resolve('D:/workspace', 'etc/config.test')
            })
        }));
        expect(remoteBackend.compile).not.toHaveBeenCalled();
    });

    test('uses local backend directory mode instead of fan-out for folder compilation', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'etc/config.test',
            compile: {
                mode: 'local',
                local: {
                    useSystemCommand: true
                }
            }
        });
        localBackend.compile.mockResolvedValue({
            version: 1,
            ok: true,
            kind: 'directory',
            target: '/single/',
            diagnostics: [],
            files_total: 1,
            files_ok: 1,
            files_failed: 0,
            results: [
                { file: '/single/master.c', ok: true, diagnostics: [] }
            ]
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFolder('D:/workspace/single');

        expect(localBackend.compile).toHaveBeenCalledTimes(1);
        expect(localBackend.compile).toHaveBeenCalledWith(expect.objectContaining({
            targetKind: 'directory',
            targetPath: '/single/'
        }));
        expect(remoteBackend.compile).not.toHaveBeenCalled();
    });

    test('uses remote backend when compile.mode is remote', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'config.hell',
            compile: {
                mode: 'remote',
                remote: {
                    activeServer: 'Alpha',
                    servers: [{ name: 'Alpha', url: 'http://127.0.0.1:8080' }]
                }
            }
        });
        remoteBackend.compile.mockResolvedValue({
            ok: true,
            diagnosticsByFile: new Map()
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFile('D:/workspace/single/master.c');

        expect(remoteBackend.compile).toHaveBeenCalledWith(expect.objectContaining({
            workspaceRoot: 'D:/workspace',
            targetKind: 'file',
            targetPath: '/single/master.c',
            remoteConfig: expect.objectContaining({
                activeServer: 'Alpha'
            })
        }));
        expect(localBackend.compile).not.toHaveBeenCalled();
    });

    test('maps file diagnostics returned by local backend into VS Code diagnostics', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'etc/config.test',
            compile: {
                mode: 'local',
                local: {
                    useSystemCommand: true
                }
            }
        });
        localBackend.compile.mockResolvedValue({
            version: 1,
            ok: false,
            kind: 'file',
            target: '/single/master.c',
            diagnostics: [
                { severity: 'error', file: '/single/master.c', line: 12, message: 'syntax error' }
            ],
            files_total: 0,
            files_ok: 0,
            files_failed: 0,
            results: []
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFile('D:/workspace/single/master.c');

        const diagnosticCollection = (vscode.languages.createDiagnosticCollection as jest.Mock).mock.results[0].value;
        expect(diagnosticCollection.set).toHaveBeenCalled();
    });

    test('maps lpccp runtime errors into VS Code diagnostics', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'etc/config.test',
            compile: {
                mode: 'local',
                local: {
                    useSystemCommand: true
                }
            }
        });
        localBackend.compile.mockResolvedValue({
            version: 1,
            ok: false,
            kind: 'file',
            target: '/single/runtime.c',
            diagnostics: [],
            runtime_errors: [
                {
                    object: '/single/runtime',
                    program: '/single/runtime.c',
                    line: 23,
                    error_type: 'runtime_error',
                    message: 'bad argument',
                    trace: []
                }
            ],
            files_total: 0,
            files_ok: 0,
            files_failed: 0,
            results: []
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFile('D:/workspace/single/runtime.c');

        const diagnosticCollection = (vscode.languages.createDiagnosticCollection as jest.Mock).mock.results[0].value;
        const [, diagnostics] = diagnosticCollection.set.mock.calls[0];
        expect(diagnostics[0].message).toBe('bad argument');
    });

    test('shows structured lpccp connection failure message instead of throwing', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'etc/config.test',
            compile: {
                mode: 'local',
                local: {
                    useSystemCommand: true
                }
            }
        });
        localBackend.compile.mockResolvedValue({
            ok: false,
            phase: 'connect',
            reason: 'pipe_connect_failed',
            message: 'cannot connect to compile service pipe'
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFile('D:/workspace/single/master.c');

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('cannot connect to compile service pipe');
    });

    test('shows missing dev_test as warning when compile succeeded', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValue({
            version: 1,
            configHellPath: 'etc/config.test',
            compile: {
                mode: 'local',
                local: {
                    useSystemCommand: true
                }
            }
        });
        localBackend.compile.mockResolvedValue({
            ok: false,
            compile_status: 'ok',
            test_status: 'missing',
            phase: 'dev_test',
            reason: 'test_missing',
            message: 'Object does not define dev_test()'
        });

        const service = new CompilationService(projectConfigService as any, localBackend as any, remoteBackend as any);
        await service.compileFile('D:/workspace/single/master.c');

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Object does not define dev_test()');
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalledWith('Object does not define dev_test()');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
