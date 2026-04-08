import * as vscode from 'vscode';
import { ServiceRegistry } from './core/ServiceRegistry';
import { registerCommands } from './modules/commandModule';
import { registerCoreServices } from './modules/coreModule';
import { registerDiagnostics } from './modules/diagnosticsModule';
import { registerLanguageProviders } from './modules/languageModule';
import { registerUI } from './modules/uiModule';
import { disposeGlobalParsedDocumentService } from './parser/ParsedDocumentService';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const registry = new ServiceRegistry();
    context.subscriptions.push(registry);

    registerCoreServices(registry, context);
    registerDiagnostics(registry, context);
    await registerLanguageProviders(registry, context);
    registerUI(registry, context);
    registerCommands(registry, context);
}

export function deactivate(): void {
    disposeGlobalParsedDocumentService();
}
