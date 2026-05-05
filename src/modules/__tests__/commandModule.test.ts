import * as path from 'path';
import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerCommands } from '../commandModule';
import { FunctionDocPanel } from '../../functionDocPanel';
import { createLpcCodeActionCommandHandlers } from '../../codeActions';
import { ErrorTreeDataProvider } from '../../errorTreeDataProvider';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../../parser/ParsedDocumentService';

jest.mock('../../utils/lpcprj', () => ({
    hasLpcprjCommand: jest.fn(),
    getLpcprjStartCommand: jest.fn((configPath: string) => `lpcprj "${configPath}"`)
}), { virtual: true });

jest.mock('../../functionDocPanel', () => ({
    FunctionDocPanel: {
        createOrShow: jest.fn()
    }
}));

jest.mock('../../codeActions', () => ({
    createLpcCodeActionCommandHandlers: jest.fn().mockReturnValue([
        { id: 'lpc.renameVarToSnakeCase', handler: jest.fn() },
        { id: 'lpc.renameVarToCamelCase', handler: jest.fn() },
        { id: 'lpc.generateJavadoc', handler: jest.fn() }
    ])
}));

jest.mock('../../errorTreeDataProvider', () => ({
    ErrorTreeDataProvider: jest.fn()
}));

jest.mock('../../parser/ParsedDocumentService', () => ({
    getGlobalParsedDocumentService: jest.fn(),
    clearGlobalParsedDocumentService: jest.fn()
}));

describe('registerCommands', () => {
    const expectedCommandIds = [
        'lpc.scanFolder',
        'lpc.showVariables',
        'lpc.showFunctionDoc',
        'lpc.errorTree.refresh',
        'lpc.errorTree.clear',
        'lpc.errorTree.openErrorLocation',
        'lpc.errorTree.copyError',
        'lpc.compileFolder',
        'lpc.manageCompilation',
        'lpc.compileFile',
        'lpc.startDriver',
        'lpc.configureSimulatedEfuns',
        'lpc.renameVarToSnakeCase',
        'lpc.renameVarToCamelCase',
        'lpc.generateJavadoc'
    ];

    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let analysisService: { getSyntaxDocument: jest.Mock };
    let efunDocsManager: { id: string; configureSimulatedEfuns: jest.Mock };
    let diagnostics: { analyzeDocument: jest.Mock; scanFolder: jest.Mock; showVariables: jest.Mock };
    let completionInstrumentation: {
        showReport: jest.Mock;
        formatSummary: jest.Mock;
        clear: jest.Mock;
    };
    let compiler: { compileFile: jest.Mock; compileFolder: jest.Mock };
    let projectConfigService: {
        loadForWorkspace: jest.Mock;
        ensureConfigForWorkspace: jest.Mock;
        getCompileConfigForWorkspace: jest.Mock;
        updateCompileConfigForWorkspace: jest.Mock;
        toWorkspaceRelativePath: jest.Mock;
        resolveWorkspacePath: jest.Mock;
        readConfigFile: jest.Mock;
        getProjectConfigPath: jest.Mock;
    };
    let errorTreeProvider: {
        refresh: jest.Mock;
        clearErrors: jest.Mock;
    };
    let parsedDocumentService: { getStats: jest.Mock };
    let lpcprj: {
        hasLpcprjCommand: jest.Mock;
        getLpcprjStartCommand: jest.Mock;
    };

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = {
            subscriptions: [],
            extensionPath: '/mock/extension',
            globalStoragePath: '/mock/storage'
        } as vscode.ExtensionContext;

        analysisService = {
            getSyntaxDocument: jest.fn()
        };
        efunDocsManager = {
            id: 'efun-docs-manager',
            configureSimulatedEfuns: jest.fn()
        };
        diagnostics = {
            analyzeDocument: jest.fn(),
            scanFolder: jest.fn(),
            showVariables: jest.fn()
        };
        completionInstrumentation = {
            showReport: jest.fn(),
            formatSummary: jest.fn().mockReturnValue('performance summary'),
            clear: jest.fn()
        };
        compiler = {
            compileFile: jest.fn(),
            compileFolder: jest.fn()
        };
        projectConfigService = {
            loadForWorkspace: jest.fn().mockResolvedValue({
                version: 1,
                configHellPath: 'config.hell'
            }),
            ensureConfigForWorkspace: jest.fn().mockResolvedValue(undefined),
            getCompileConfigForWorkspace: jest.fn().mockResolvedValue({
                mode: 'remote',
                local: {
                    useSystemCommand: false,
                    lpccpPath: ''
                },
                remote: {
                    activeServer: 'Alpha',
                    servers: [{ name: 'Alpha', url: 'http://127.0.0.1:8080', description: 'local' }]
                }
            }),
            updateCompileConfigForWorkspace: jest.fn().mockImplementation(async (_workspaceRoot, updater) => ({
                version: 1,
                configHellPath: 'config.hell',
                compile: updater({
                    mode: 'remote',
                    local: {
                        useSystemCommand: false,
                        lpccpPath: ''
                    },
                    remote: {
                        activeServer: 'Alpha',
                        servers: [{ name: 'Alpha', url: 'http://127.0.0.1:8080', description: 'local' }]
                    }
                })
            })),
            toWorkspaceRelativePath: jest.fn((workspaceRoot: string, targetPath: string) => path.relative(workspaceRoot, targetPath)),
            resolveWorkspacePath: jest.fn((workspaceRoot: string, targetPath: string) => path.resolve(workspaceRoot, targetPath)),
            readConfigFile: jest.fn().mockResolvedValue({ version: 1, configHellPath: 'config.hell' }),
            getProjectConfigPath: jest.fn().mockReturnValue('D:/workspace/lpc-support.json')
        };
        errorTreeProvider = {
            refresh: jest.fn(),
            clearErrors: jest.fn()
        };
        parsedDocumentService = {
            getStats: jest.fn().mockReturnValue({ size: 2, memory: 2048 })
        };
        lpcprj = jest.requireMock('../../utils/lpcprj') as {
            hasLpcprjCommand: jest.Mock;
            getLpcprjStartCommand: jest.Mock;
        };
        lpcprj.hasLpcprjCommand.mockReset().mockReturnValue(true);
        lpcprj.getLpcprjStartCommand.mockReset().mockImplementation((configPath: string) => `lpcprj "${configPath}"`);

        registry.register(Services.Analysis, analysisService as any);
        registry.register(Services.EfunDocs, efunDocsManager as any);
        registry.register(Services.Diagnostics, diagnostics as any);
        registry.register(Services.CompletionInstrumentation, completionInstrumentation as any);
        registry.register(Services.Compiler, compiler as any);
        registry.register(Services.ProjectConfig, projectConfigService as any);
        registry.register(Services.ErrorTree, errorTreeProvider as any);
        registry.register(Services.TextDocumentHost, {
            openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                const filePath = typeof target === 'string' ? target : target.fsPath;
                return {
                    uri: vscode.Uri.file(filePath),
                    fileName: filePath,
                    languageId: 'lpc'
                } as unknown as vscode.TextDocument;
            }),
            fileExists: jest.fn().mockReturnValue(true),
            getWorkspaceFolder: jest.fn().mockReturnValue({ uri: { fsPath: 'D:/workspace' } })
        } as any);

        (ErrorTreeDataProvider as unknown as jest.Mock).mockReset().mockImplementation(() => errorTreeProvider);
        (createLpcCodeActionCommandHandlers as jest.Mock).mockClear();
        (getGlobalParsedDocumentService as unknown as jest.Mock).mockReset().mockReturnValue(parsedDocumentService);
        (clearGlobalParsedDocumentService as unknown as jest.Mock).mockReset();

        (vscode.commands.registerCommand as jest.Mock).mockClear();
        (vscode.commands.executeCommand as jest.Mock).mockClear();
        (vscode.window.createTreeView as jest.Mock).mockClear();
        (vscode.window.createStatusBarItem as jest.Mock).mockClear();
        (vscode.window.createTerminal as jest.Mock).mockClear();
        (vscode.window.showInformationMessage as jest.Mock).mockClear();
        (vscode.window.showWarningMessage as jest.Mock).mockClear();
        (vscode.window.showErrorMessage as jest.Mock).mockClear();
        (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockClear();
        (vscode.workspace.getConfiguration as jest.Mock).mockImplementation((section?: string) => {
            if (section === 'lpc') {
                return {
                    get: jest.fn().mockReturnValue(undefined)
                };
            }

            return {
                get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
                update: jest.fn().mockResolvedValue(undefined)
            };
        });
        (vscode.workspace as any).workspaceFolders = [];
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: 'D:/workspace' } });
        (vscode.window as any).activeTextEditor = undefined;
    });

    function getRegisteredHandlers(): Map<string, (...args: any[]) => any> {
        return new Map(
            (vscode.commands.registerCommand as jest.Mock).mock.calls.map(
                ([commandId, handler]) => [commandId, handler]
            )
        );
    }

    test('registers the expected command set using the registry error tree provider', () => {
        registerCommands(registry, context);

        const registeredCommandIds = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .map(([commandId]) => commandId)
            .sort();

        expect(registeredCommandIds).toEqual([...expectedCommandIds].sort());
        expect(registry.get(Services.ErrorTree)).toBe(errorTreeProvider);
        expect(ErrorTreeDataProvider).not.toHaveBeenCalled();
        expect(vscode.window.createTreeView).not.toHaveBeenCalled();
        expect(vscode.workspace.onDidChangeConfiguration).not.toHaveBeenCalled();
        expect(vscode.window.createStatusBarItem).not.toHaveBeenCalled();
        expect(createLpcCodeActionCommandHandlers).toHaveBeenCalledWith(registry.get(Services.Analysis));
        expect(registeredCommandIds).not.toContain('lpc.addServer');
        expect(registeredCommandIds).not.toContain('lpc.selectServer');
        expect(registeredCommandIds).not.toContain('lpc.removeServer');
    });

    test('delegates representative commands to registry services and helpers', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        const activeDocument = {
            fileName: 'D:/code/lpc-support/test/example.c',
            languageId: 'lpc'
        } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = { document: activeDocument };

        handlers.get('lpc.scanFolder')?.();
        handlers.get('lpc.showVariables')?.();
        handlers.get('lpc.showFunctionDoc')?.();
        handlers.get('lpc.configureSimulatedEfuns')?.();
        await handlers.get('lpc.compileFile')?.();
        await handlers.get('lpc.compileFolder')?.({ fsPath: 'D:/workspace/project' } as vscode.Uri);
        handlers.get('lpc.errorTree.refresh')?.();

        expect(diagnostics.scanFolder).toHaveBeenCalledTimes(1);
        expect(diagnostics.showVariables).toHaveBeenCalledTimes(1);
        expect(efunDocsManager.configureSimulatedEfuns).toHaveBeenCalledTimes(1);
        expect(FunctionDocPanel.createOrShow).toHaveBeenCalledWith(
            context,
            efunDocsManager,
            expect.objectContaining({
                openTextDocument: expect.any(Function)
            })
        );
        expect(compiler.compileFile).toHaveBeenCalledWith(activeDocument.fileName);
        expect((compiler as any).compileFolder).toHaveBeenCalledWith('D:/workspace/project');
        expect(projectConfigService.ensureConfigForWorkspace).toHaveBeenCalledWith('D:/workspace', 'config.hell');
        expect(projectConfigService.getCompileConfigForWorkspace).toHaveBeenCalledWith('D:/workspace');
        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
    });

    test('compileFolder shows an error and skips compiler setup when no workspace folders are open', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [];

        await handlers.get('lpc.compileFolder')?.();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('请先打开一个工作区');
        expect((compiler as any).compileFolder).not.toHaveBeenCalled();
    });

    test('manageCompilation toggles local system command in project config', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.window.showQuickPick as jest.Mock)
            .mockResolvedValueOnce({ value: 'local' })
            .mockResolvedValueOnce({ action: 'toggleSystemCommand' });

        await handlers.get('lpc.manageCompilation')?.();

        expect(projectConfigService.updateCompileConfigForWorkspace).toHaveBeenCalledWith(
            'D:/workspace',
            expect.any(Function)
        );
        const updater = projectConfigService.updateCompileConfigForWorkspace.mock.calls[1][1];
        expect(updater({
            mode: 'remote',
            local: {
                useSystemCommand: false,
                lpccpPath: ''
            },
            remote: {
                activeServer: 'Alpha',
                servers: []
            }
        })).toEqual({
            mode: 'local',
            local: {
                useSystemCommand: true,
                lpccpPath: ''
            },
            remote: {
                activeServer: 'Alpha',
                servers: []
            }
        });
    });

    test('manageCompilation writes remote server into project config', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.window.showQuickPick as jest.Mock)
            .mockResolvedValueOnce({ value: 'remote' })
            .mockResolvedValueOnce({ action: 'addServer' });
        (vscode.window.showInputBox as jest.Mock)
            .mockResolvedValueOnce('Beta')
            .mockResolvedValueOnce('http://127.0.0.1:8081')
            .mockResolvedValueOnce('backup');

        await handlers.get('lpc.manageCompilation')?.();

        expect(projectConfigService.updateCompileConfigForWorkspace).toHaveBeenCalledWith(
            'D:/workspace',
            expect.any(Function)
        );
        const updater = projectConfigService.updateCompileConfigForWorkspace.mock.calls[1][1];
        expect(updater({
            mode: 'remote',
            local: {
                useSystemCommand: false,
                lpccpPath: ''
            },
            remote: {
                activeServer: 'Alpha',
                servers: [{ name: 'Alpha', url: 'http://127.0.0.1:8080', description: 'local' }]
            }
        })).toEqual({
            mode: 'remote',
            local: {
                useSystemCommand: false,
                lpccpPath: ''
            },
            remote: {
                activeServer: 'Alpha',
                servers: [
                    { name: 'Alpha', url: 'http://127.0.0.1:8080', description: 'local' },
                    { name: 'Beta', url: 'http://127.0.0.1:8081', description: 'backup' }
                ]
            }
        });
        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
    });

    test('manageCompilation updates active remote server in project config and refreshes error tree', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.window.showQuickPick as jest.Mock)
            .mockResolvedValueOnce({ value: 'remote' })
            .mockResolvedValueOnce({ action: 'selectServer' })
            .mockResolvedValueOnce({
                label: 'Alpha',
                description: 'local',
                detail: 'http://127.0.0.1:8080'
            });

        await handlers.get('lpc.manageCompilation')?.();

        expect(projectConfigService.updateCompileConfigForWorkspace).toHaveBeenCalledWith(
            'D:/workspace',
            expect.any(Function)
        );
        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
    });

    test('manageCompilation sets lpccp path via file picker and no longer exposes driver config action', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.window.showQuickPick as jest.Mock)
            .mockResolvedValueOnce({ value: 'local' })
            .mockResolvedValueOnce({ action: 'setLpccpPath' });
        (vscode.window.showOpenDialog as jest.Mock).mockResolvedValueOnce([
            { fsPath: 'D:/workspace/tools/lpccp.exe' }
        ]);

        await handlers.get('lpc.manageCompilation')?.();

        const localActions = (vscode.window.showQuickPick as jest.Mock).mock.calls[1][0];
        expect(localActions.some((entry: any) => entry.action === 'setDriverConfigPath')).toBe(false);
        expect(vscode.window.showOpenDialog).toHaveBeenCalled();

        const updater = projectConfigService.updateCompileConfigForWorkspace.mock.calls[1][1];
        expect(updater({
            mode: 'remote',
            local: {
                useSystemCommand: false,
                lpccpPath: ''
            },
            remote: {
                activeServer: 'Alpha',
                servers: []
            }
        })).toEqual({
            mode: 'local',
            local: {
                useSystemCommand: false,
                lpccpPath: path.join('tools', 'lpccp.exe')
            },
            remote: {
                activeServer: 'Alpha',
                servers: []
            }
        });
        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
    });

    test('manageCompilation sets local lpccp compile mode in project config', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.window.showQuickPick as jest.Mock)
            .mockResolvedValueOnce({ value: 'local' })
            .mockResolvedValueOnce({ action: 'setCompileMode' })
            .mockResolvedValueOnce({ value: 'fresh-required' });

        await handlers.get('lpc.manageCompilation')?.();

        const updater = projectConfigService.updateCompileConfigForWorkspace.mock.calls[1][1];
        expect(updater({
            mode: 'local',
            local: {
                useSystemCommand: true,
                lpccpPath: '',
                compileMode: 'reload-loaded'
            },
            remote: {
                activeServer: 'Alpha',
                servers: []
            }
        })).toEqual({
            mode: 'local',
            local: {
                useSystemCommand: true,
                lpccpPath: '',
                compileMode: 'fresh-required'
            },
            remote: {
                activeServer: 'Alpha',
                servers: []
            }
        });
        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
    });

    test('openErrorLocation shows an error when no workspace folders are open', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [];

        await expect(
            handlers.get('lpc.errorTree.openErrorLocation')?.({
                file: 'errors/test.c',
                line: 12
            })
        ).resolves.toBeUndefined();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('请先打开一个工作区');
        expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
    });

    test('starts the driver in a terminal with configHellPath from lpc-support.json when lpcprj is available', async () => {
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];

        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        await handlers.get('lpc.startDriver')?.();

        const terminal = (vscode.window.createTerminal as jest.Mock).mock.results[0].value;
        expect(lpcprj.hasLpcprjCommand).toHaveBeenCalledTimes(1);
        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith('D:/workspace');
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'MUD Driver',
            cwd: 'D:/workspace'
        });
        expect(lpcprj.getLpcprjStartCommand).toHaveBeenCalledWith('D:\\workspace\\config.hell');
        expect(terminal.sendText).toHaveBeenCalledWith('lpcprj "D:\\workspace\\config.hell"');
        expect(terminal.show).toHaveBeenCalledTimes(1);
    });

    test('warns and does not create a terminal when project config is missing configHellPath', async () => {
        projectConfigService.loadForWorkspace.mockResolvedValueOnce(undefined);
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];

        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();

        await handlers.get('lpc.startDriver')?.();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            '当前工作区缺少可用的 `lpc-support.json` 或 `configHellPath`，无法启动开发驱动。'
        );
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    });

    test('warns and does not create a terminal when lpcprj is unavailable', async () => {
        lpcprj.hasLpcprjCommand.mockReturnValue(false);
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();

        await handlers.get('lpc.startDriver')?.();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            '未检测到系统命令 `lpcprj`。请前往 GitHub 获取并安装开发驱动环境（预览版）后，再使用“启动驱动”功能。'
        );
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
