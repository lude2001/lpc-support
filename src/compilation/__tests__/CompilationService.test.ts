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
                    useSystemCommand: true
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
});
