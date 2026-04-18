import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator } from '../diagnostics';
import { createDiagnosticsStack } from '../diagnostics/createDiagnosticsStack';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const { collectors, diagnosticsService } = createDiagnosticsStack(macroManager);
    const diagnostics = new DiagnosticsOrchestrator(context, macroManager, {
        collectors,
        diagnosticsService
    });
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(diagnostics);
}
