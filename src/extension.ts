import * as vscode from 'vscode';
import { ServiceRegistry } from './core/ServiceRegistry';
import { activateLspClient } from './lsp/client/activateLspClient';
import { registerWorkspaceIndexController } from './lsp/client/workspaceIndexController';
import { registerCommands, registerWorkspaceIndexRebuildCommand } from './modules/commandModule';
import { getRegisteredProjectConfigService, registerCoreServices } from './modules/coreModule';
import { registerDiagnostics } from './modules/diagnosticsModule';
import { registerUI } from './modules/uiModule';
import { disposeGlobalParsedDocumentService } from './parser/ParsedDocumentService';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const registry = new ServiceRegistry();
    context.subscriptions.push(registry);

    registerCoreServices(registry, context);
    registerDiagnostics(registry, context);
    registerUI(registry, context);
    registerCommands(registry, context);
    const lspClientManager = await activateLspClient(context);
    const projectConfigService = getRegisteredProjectConfigService();
    if (lspClientManager && projectConfigService) {
        registerWorkspaceIndexController({
            context,
            manager: lspClientManager,
            projectConfigService,
            registerRebuildCommand: (handler) => registerWorkspaceIndexRebuildCommand(context, handler)
        });
    }
}

export function deactivate(): void {
    disposeGlobalParsedDocumentService();
}
