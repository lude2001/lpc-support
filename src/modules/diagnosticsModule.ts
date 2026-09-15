import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { RustDiagnosticsCommands } from '../diagnostics/RustDiagnosticsCommands';
import type { LspClientManager } from '../lsp/client/LspClientManager';

export function registerDiagnostics(
    registry: ServiceRegistry,
    context: vscode.ExtensionContext,
    manager: LspClientManager | undefined
): void {
    const diagnostics = new RustDiagnosticsCommands(context, manager);
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(diagnostics);
}
