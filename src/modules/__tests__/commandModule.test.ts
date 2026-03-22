import * as path from 'path';
import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerCommands } from '../commandModule';
import { FunctionDocPanel } from '../../functionDocPanel';
import { ErrorTreeDataProvider } from '../../errorTreeDataProvider';
import { LPCConfigManager } from '../../config';
import { LPCCompiler } from '../../compiler';
import {
    clearGlobalParsedDocumentService,
    getGlobalParsedDocumentService
} from '../../parser/ParsedDocumentService';

jest.mock('../../functionDocPanel', () => ({
    FunctionDocPanel: {
        createOrShow: jest.fn()
    }
}));

jest.mock('../../errorTreeDataProvider', () => ({
    ErrorTreeDataProvider: jest.fn()
}));

jest.mock('../../config', () => ({
    LPCConfigManager: jest.fn()
}));

jest.mock('../../compiler', () => ({
    LPCCompiler: jest.fn()
}));

jest.mock('../../parser/ParsedDocumentService', () => ({
    getGlobalParsedDocumentService: jest.fn(),
    clearGlobalParsedDocumentService: jest.fn()
}));

describe('registerCommands', () => {
    const expectedCommandIds = [
        'lpc.efunDocsSettings',
        'lpc-support.checkUnusedVariables',
        'lpc.scanFolder',
        'lpc.showFunctionDoc',
        'lpc.errorTree.refresh',
        'lpc.errorTree.clear',
        'lpc.errorTree.addServer',
        'lpc.errorTree.removeServer',
        'lpc.errorTree.manageServers',
        'lpc.errorTree.selectServer',
        'lpc.errorTree.openErrorLocation',
        'lpc.errorTree.copyError',
        'lpc.compileFolder',
        'lpc.showParseTree',
        'lpc.debugParseErrors',
        'lpc.scanInheritance',
        'lpc.addServer',
        'lpc.selectServer',
        'lpc.removeServer',
        'lpc.manageServers',
        'lpc.compileFile',
        'lpc.showMacros',
        'lpc.configureMacroPath',
        'lpc.migrateProjectConfig',
        'lpc.startDriver',
        'lpc.showPerformanceStats',
        'lpc.clearCache'
    ];

    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let macroManager: { showMacrosList: jest.Mock; configurePath: jest.Mock };
    let diagnostics: { analyzeDocument: jest.Mock; scanFolder: jest.Mock };
    let completionProvider: { scanInheritance: jest.Mock; clearCache: jest.Mock };
    let completionInstrumentation: {
        showReport: jest.Mock;
        formatSummary: jest.Mock;
        clear: jest.Mock;
    };
    let configManager: {
        addServer: jest.Mock;
        selectServer: jest.Mock;
        removeServer: jest.Mock;
        showServerManager: jest.Mock;
    };
    let compiler: { compileFile: jest.Mock };
    let projectConfigService: {
        loadForWorkspace: jest.Mock;
        ensureConfigForWorkspace: jest.Mock;
        readConfigFile: jest.Mock;
        getProjectConfigPath: jest.Mock;
    };
    let errorTreeProvider: {
        refresh: jest.Mock;
        clearErrors: jest.Mock;
        getServers: jest.Mock;
        setActiveServer: jest.Mock;
    };
    let parsedDocumentService: { getStats: jest.Mock };
    let freshConfigManager: { id: string };
    let freshCompiler: { compileFolder: jest.Mock };

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = {
            subscriptions: [],
            extensionPath: '/mock/extension',
            globalStoragePath: '/mock/storage'
        } as vscode.ExtensionContext;

        macroManager = {
            showMacrosList: jest.fn(),
            configurePath: jest.fn()
        };
        diagnostics = {
            analyzeDocument: jest.fn(),
            scanFolder: jest.fn()
        };
        completionProvider = {
            scanInheritance: jest.fn(),
            clearCache: jest.fn()
        };
        completionInstrumentation = {
            showReport: jest.fn(),
            formatSummary: jest.fn().mockReturnValue('performance summary'),
            clear: jest.fn()
        };
        configManager = {
            addServer: jest.fn(),
            selectServer: jest.fn(),
            removeServer: jest.fn(),
            showServerManager: jest.fn()
        };
        compiler = {
            compileFile: jest.fn()
        };
        projectConfigService = {
            loadForWorkspace: jest.fn().mockResolvedValue(undefined),
            ensureConfigForWorkspace: jest.fn().mockResolvedValue(undefined),
            readConfigFile: jest.fn().mockResolvedValue({ version: 1, configHellPath: 'config.hell' }),
            getProjectConfigPath: jest.fn().mockReturnValue('D:/workspace/lpc-support.json')
        };
        errorTreeProvider = {
            refresh: jest.fn(),
            clearErrors: jest.fn(),
            getServers: jest.fn().mockReturnValue([
                { name: 'Alpha', address: 'http://127.0.0.1:8092' }
            ]),
            setActiveServer: jest.fn()
        };
        parsedDocumentService = {
            getStats: jest.fn().mockReturnValue({ size: 2, memory: 2048 })
        };
        freshConfigManager = { id: 'fresh-config-manager' };
        freshCompiler = { compileFolder: jest.fn() };

        registry.register(Services.MacroManager, macroManager as any);
        registry.register(Services.Diagnostics, diagnostics as any);
        registry.register(Services.Completion, completionProvider as any);
        registry.register(Services.CompletionInstrumentation, completionInstrumentation as any);
        registry.register(Services.ConfigManager, configManager as any);
        registry.register(Services.Compiler, compiler as any);
        registry.register(Services.ProjectConfig, projectConfigService as any);
        registry.register(Services.ErrorTree, errorTreeProvider as any);

        (ErrorTreeDataProvider as unknown as jest.Mock).mockReset().mockImplementation(() => errorTreeProvider);
        (LPCConfigManager as unknown as jest.Mock).mockReset().mockImplementation(() => freshConfigManager);
        (LPCCompiler as unknown as jest.Mock).mockReset().mockImplementation(() => freshCompiler);
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

            if (section === 'lpc.errorViewer') {
                return {
                    get: jest.fn().mockReturnValue([]),
                    update: jest.fn().mockResolvedValue(undefined)
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

        handlers.get('lpc-support.checkUnusedVariables')?.();
        handlers.get('lpc.scanFolder')?.();
        handlers.get('lpc.showFunctionDoc')?.();
        await handlers.get('lpc.compileFile')?.();
        await handlers.get('lpc.compileFolder')?.({ fsPath: 'D:/workspace/project' } as vscode.Uri);
        handlers.get('lpc.scanInheritance')?.();
        handlers.get('lpc.showMacros')?.();
        handlers.get('lpc.configureMacroPath')?.();
        await handlers.get('lpc.migrateProjectConfig')?.();
        handlers.get('lpc.errorTree.refresh')?.();
        handlers.get('lpc.showPerformanceStats')?.();
        handlers.get('lpc.clearCache')?.();

        expect(diagnostics.analyzeDocument).toHaveBeenCalledWith(activeDocument, true);
        expect(diagnostics.scanFolder).toHaveBeenCalledTimes(1);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已完成未使用变量检查');
        expect(FunctionDocPanel.createOrShow).toHaveBeenCalledWith(context, macroManager);
        expect(compiler.compileFile).toHaveBeenCalledWith(activeDocument.fileName);
        expect(LPCConfigManager).toHaveBeenCalledWith(context);
        expect(LPCCompiler).toHaveBeenCalledWith(freshConfigManager);
        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith('D:/workspace');
        expect(freshCompiler.compileFolder).toHaveBeenCalledWith('D:/workspace/project');
        expect(completionProvider.scanInheritance).toHaveBeenCalledWith(activeDocument);
        expect(macroManager.showMacrosList).toHaveBeenCalledTimes(1);
        expect(macroManager.configurePath).toHaveBeenCalledTimes(1);
        expect(projectConfigService.ensureConfigForWorkspace).toHaveBeenCalledWith('D:/workspace', 'config.hell');
        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
        expect(parsedDocumentService.getStats).toHaveBeenCalledTimes(1);
        expect(completionInstrumentation.showReport).toHaveBeenCalledWith({ size: 2, memory: 2048 });
        expect(completionInstrumentation.formatSummary).toHaveBeenCalledWith({ size: 2, memory: 2048 });
        expect(clearGlobalParsedDocumentService).toHaveBeenCalledTimes(1);
        expect(completionProvider.clearCache).toHaveBeenCalledTimes(1);
        expect(completionInstrumentation.clear).toHaveBeenCalledTimes(1);
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('已创建并同步 lpc-support.json');
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('LPC 解析与补全缓存已清理');
    });

    test('compileFolder shows an error and skips compiler setup when no workspace folders are open', async () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.workspace as any).workspaceFolders = [];

        await handlers.get('lpc.compileFolder')?.();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('请先打开一个工作区');
        expect(LPCConfigManager).not.toHaveBeenCalled();
        expect(LPCCompiler).not.toHaveBeenCalled();
        expect(freshCompiler.compileFolder).not.toHaveBeenCalled();
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

    test('starts the driver in a terminal using the configured command', () => {
        const driverCommand = 'C:\\mud\\driver.exe --boot';
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.workspace.getConfiguration as jest.Mock).mockImplementation((section?: string) => {
            if (section === 'lpc') {
                return {
                    get: jest.fn((key: string) => key === 'driver.command' ? driverCommand : undefined)
                };
            }

            if (section === 'lpc.errorViewer') {
                return {
                    get: jest.fn().mockReturnValue([]),
                    update: jest.fn().mockResolvedValue(undefined)
                };
            }

            return {
                get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
                update: jest.fn().mockResolvedValue(undefined)
            };
        });

        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        handlers.get('lpc.startDriver')?.();

        const terminal = (vscode.window.createTerminal as jest.Mock).mock.results[0].value;
        expect(projectConfigService.loadForWorkspace).toHaveBeenCalledWith('D:/workspace');
        expect(vscode.window.createTerminal).toHaveBeenCalledWith({
            name: 'MUD Driver',
            cwd: path.dirname(driverCommand)
        });
        expect(terminal.sendText).toHaveBeenCalledWith(driverCommand);
        expect(terminal.show).toHaveBeenCalledTimes(1);
    });

    test('warns and does not create a terminal when no driver command is configured', () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();

        handlers.get('lpc.startDriver')?.();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            '未配置驱动启动命令。请在设置中配置 `lpc.driver.command`。',
            '打开设置'
        );
        expect(vscode.window.createTerminal).not.toHaveBeenCalled();
        expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
            'workbench.action.openSettings',
            'lpc.driver.command'
        );
    });

    test('warns instead of scanning inheritance for a non-lpc editor', () => {
        registerCommands(registry, context);
        const handlers = getRegisteredHandlers();
        (vscode.window as any).activeTextEditor = {
            document: {
                fileName: 'D:/code/lpc-support/test/example.txt',
                languageId: 'plaintext'
            }
        };

        handlers.get('lpc.scanInheritance')?.();

        expect(completionProvider.scanInheritance).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('请在LPC文件中使用此命令');
    });
});
