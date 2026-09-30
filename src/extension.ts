import * as vscode from 'vscode';
import { ServiceRegistry } from './core/ServiceRegistry';
import { FunctionDocPanel } from './functionDocPanel';
import { activateLspClient } from './lsp/client/activateLspClient';
import { registerWorkspaceIndexController } from './lsp/client/workspaceIndexController';
import { WORKSPACE_INDEX_CHANGED_NOTIFICATION } from './lsp/shared/protocol/workspaceIndex';
import { registerCommands, registerWorkspaceIndexRebuildCommand } from './modules/commandModule';
import { getRegisteredProjectConfigService, registerCoreServices } from './modules/coreModule';
import { registerDiagnostics } from './modules/diagnosticsModule';
import { registerUI } from './modules/uiModule';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const registry = new ServiceRegistry();
    context.subscriptions.push(registry);

    await registerCoreServices(registry, context);
    registerUI(registry, context);
    const lspClientManager = await activateLspClient(context);
    registerDiagnostics(registry, context, lspClientManager);
    registerCommands(registry, context, lspClientManager);
    const projectConfigService = getRegisteredProjectConfigService();
    if (lspClientManager && projectConfigService) {
        context.subscriptions.push(lspClientManager.onNotification(
            WORKSPACE_INDEX_CHANGED_NOTIFICATION,
            () => FunctionDocPanel.refreshAfterIndexChange()
        ));
        registerWorkspaceIndexController({
            context,
            manager: lspClientManager,
            projectConfigService,
            registerRebuildCommand: (handler) => registerWorkspaceIndexRebuildCommand(context, handler),
            onIndexReady: () => FunctionDocPanel.refreshCurrent()
        });
    }
}

export function deactivate(): void {
    // VS Code disposes all registered services through context.subscriptions.
}
