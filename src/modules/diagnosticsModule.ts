import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator, createDiagnosticsStack } from '../diagnostics';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const { diagnosticsService } = createDiagnosticsStack(macroManager);
    const diagnostics = new DiagnosticsOrchestrator(context, {
        diagnosticsService
    });
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(diagnostics);
}
