import * as vscode from 'vscode';
import { registerLpcCodeActionCommands } from '../codeActions';
import { ServiceRegistry } from '../core/ServiceRegistry';

export async function registerHostLanguageAffordances(
    _registry: ServiceRegistry,
    _context: vscode.ExtensionContext
): Promise<void> {
    registerLpcCodeActionCommands();
}
