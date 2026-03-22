import * as vscode from 'vscode';
import { Services } from '../core/ServiceKeys';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { ErrorTreeDataProvider } from '../errorTreeDataProvider';

export function registerUI(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const errorTreeProvider = new ErrorTreeDataProvider();
    registry.register(Services.ErrorTree, errorTreeProvider);

    const errorTreeView = vscode.window.createTreeView('lpcErrorTree', {
        treeDataProvider: errorTreeProvider
    });
    const driverStatusBarItem = registerDriverStatusBar(context);
    const configWatcher = registerConfigWatcher(registry);

    context.subscriptions.push(errorTreeView, driverStatusBarItem, configWatcher);
}

function registerDriverStatusBar(_context: vscode.ExtensionContext): vscode.StatusBarItem {
    const driverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    driverStatusBarItem.command = 'lpc.startDriver';
    driverStatusBarItem.text = '$(play) 启动驱动';
    driverStatusBarItem.tooltip = '启动 MUD 驱动程序';
    driverStatusBarItem.show();
    return driverStatusBarItem;
}

function registerConfigWatcher(registry: ServiceRegistry): vscode.Disposable {
    const errorTreeProvider = registry.get(Services.ErrorTree);

    return vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('lpc.errorViewer.servers')) {
            errorTreeProvider.refresh();
        }
    });
}
