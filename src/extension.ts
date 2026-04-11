import * as vscode from 'vscode';
import { ServiceRegistry } from './core/ServiceRegistry';
import { activateLspClient } from './lsp/client/activateLspClient';
import { registerCommands } from './modules/commandModule';
import { registerCoreServices } from './modules/coreModule';
import { registerDiagnostics } from './modules/diagnosticsModule';
import { registerHostLanguageAffordances } from './modules/languageModule';
import { registerUI } from './modules/uiModule';
import { disposeGlobalParsedDocumentService } from './parser/ParsedDocumentService';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const registry = new ServiceRegistry();
    context.subscriptions.push(registry);

    registerCoreServices(registry, context);
    registerDiagnostics(registry, context);
    await registerHostLanguageAffordances(registry, context);
    registerUI(registry, context);
    registerCommands(registry, context);
    await activateLspClient(context);
}

export function deactivate(): void {
    disposeGlobalParsedDocumentService();
}
