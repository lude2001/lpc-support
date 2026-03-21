import * as vscode from 'vscode';
import { Services } from '../../core/ServiceKeys';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { ErrorTreeDataProvider } from '../../errorTreeDataProvider';
import { registerUI } from '../uiModule';

jest.mock('../../errorTreeDataProvider', () => ({
    ErrorTreeDataProvider: jest.fn()
}));

describe('registerUI', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let errorTreeProvider: {
        refresh: jest.Mock;
    };
    let treeView: vscode.Disposable;
    let statusBarItem: vscode.StatusBarItem;
    let configWatcher: vscode.Disposable;

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = { subscriptions: [] } as vscode.ExtensionContext;
        errorTreeProvider = {
            refresh: jest.fn()
        };
        treeView = { dispose: jest.fn() };
        statusBarItem = {
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            text: '',
            tooltip: undefined,
            command: undefined
        } as unknown as vscode.StatusBarItem;
        configWatcher = { dispose: jest.fn() };

        (ErrorTreeDataProvider as unknown as jest.Mock).mockReset().mockImplementation(() => errorTreeProvider);
        (vscode.window.createTreeView as jest.Mock).mockReset().mockReturnValue(treeView);
        (vscode.window.createStatusBarItem as jest.Mock).mockReset().mockReturnValue(statusBarItem);
        (vscode.workspace.onDidChangeConfiguration as jest.Mock).mockReset().mockReturnValue(configWatcher);
        (vscode.commands.registerCommand as jest.Mock).mockClear();
    });

    test('registers the error tree service, tree view, driver status bar, and config watcher', () => {
        registerUI(registry, context);

        expect(ErrorTreeDataProvider).toHaveBeenCalledTimes(1);
        expect(registry.get(Services.ErrorTree)).toBe(errorTreeProvider);
        expect(vscode.window.createTreeView).toHaveBeenCalledWith('lpcErrorTree', {
            treeDataProvider: errorTreeProvider
        });
        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 100);
        expect(statusBarItem.command).toBe('lpc.startDriver');
        expect(statusBarItem.text).toBe('$(play) 启动驱动');
        expect(statusBarItem.tooltip).toBe('启动 MUD 驱动程序');
        expect(statusBarItem.show).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalledTimes(1);
        expect(context.subscriptions).toEqual([treeView, statusBarItem, configWatcher]);
        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
    });

    test('refreshes the error tree provider only when error viewer servers configuration changes', () => {
        registerUI(registry, context);

        const onDidChangeConfiguration = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
        onDidChangeConfiguration({
            affectsConfiguration: jest.fn().mockReturnValue(false)
        });
        onDidChangeConfiguration({
            affectsConfiguration: jest.fn().mockImplementation((section: string) => section === 'lpc.errorViewer.servers')
        });

        expect(errorTreeProvider.refresh).toHaveBeenCalledTimes(1);
    });
});
