import * as vscode from 'vscode';
import { Services } from '../core/ServiceKeys';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { ErrorTreeDataProvider } from '../errorTreeDataProvider';

export function registerUI(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const projectConfigService = registry.get(Services.ProjectConfig);
    const errorTreeProvider = new ErrorTreeDataProvider(projectConfigService);
    registry.register(Services.ErrorTree, errorTreeProvider);

    const errorTreeView = vscode.window.createTreeView('lpcErrorTree', {
        treeDataProvider: errorTreeProvider
    });
    const driverStatusBarItem = registerDriverStatusBar(context);

    context.subscriptions.push(errorTreeView, driverStatusBarItem);
}

function registerDriverStatusBar(_context: vscode.ExtensionContext): vscode.StatusBarItem {
    const driverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    driverStatusBarItem.command = 'lpc.startDriver';
    driverStatusBarItem.text = vscode.l10n.t('$(play) Start driver');
    driverStatusBarItem.tooltip = vscode.l10n.t('Start the MUD driver');
    driverStatusBarItem.show();
    return driverStatusBarItem;
}
