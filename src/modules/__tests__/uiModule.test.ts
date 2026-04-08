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
    let projectConfigService: { id: string };
    let treeView: vscode.Disposable;
    let statusBarItem: vscode.StatusBarItem;

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = { subscriptions: [] } as vscode.ExtensionContext;
        errorTreeProvider = {
            refresh: jest.fn()
        };
        projectConfigService = { id: 'project-config' };
        treeView = { dispose: jest.fn() };
        statusBarItem = {
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            text: '',
            tooltip: undefined,
            command: undefined
        } as unknown as vscode.StatusBarItem;

        (ErrorTreeDataProvider as unknown as jest.Mock).mockReset().mockImplementation(() => errorTreeProvider);
        (vscode.window.createTreeView as jest.Mock).mockReset().mockReturnValue(treeView);
        (vscode.window.createStatusBarItem as jest.Mock).mockReset().mockReturnValue(statusBarItem);
        (vscode.commands.registerCommand as jest.Mock).mockClear();

        registry.register(Services.ProjectConfig, projectConfigService as any);
    });

    test('registers the error tree service, tree view, and driver status bar', () => {
        registerUI(registry, context);

        expect(ErrorTreeDataProvider).toHaveBeenCalledTimes(1);
        expect(ErrorTreeDataProvider).toHaveBeenCalledWith(projectConfigService);
        expect(registry.get(Services.ErrorTree)).toBe(errorTreeProvider);
        expect(vscode.window.createTreeView).toHaveBeenCalledWith('lpcErrorTree', {
            treeDataProvider: errorTreeProvider
        });
        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 100);
        expect(statusBarItem.command).toBe('lpc.startDriver');
        expect(statusBarItem.text).toBe('$(play) 启动驱动');
        expect(statusBarItem.tooltip).toBe('启动 MUD 驱动程序');
        expect(statusBarItem.show).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.onDidChangeConfiguration).not.toHaveBeenCalled();
        expect(context.subscriptions).toEqual([treeView, statusBarItem]);
        expect(vscode.commands.registerCommand).not.toHaveBeenCalled();
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
