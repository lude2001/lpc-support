import * as vscode from 'vscode';
import { registerLpcCodeActionCommands } from '../codeActions';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';

export async function registerHostLanguageAffordances(
    registry: ServiceRegistry,
    _context: vscode.ExtensionContext
): Promise<void> {
    registerLpcCodeActionCommands(registry.get(Services.Analysis));
}
