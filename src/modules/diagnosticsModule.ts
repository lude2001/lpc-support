import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator, createDiagnosticsStack } from '../diagnostics';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const analysisService = registry.get(Services.Analysis);
    const macroManager = registry.get(Services.MacroManager);
    const textDocumentHost = registry.get(Services.TextDocumentHost);
    const { diagnosticsService } = createDiagnosticsStack(macroManager, analysisService);
    const diagnostics = new DiagnosticsOrchestrator(context, {
        diagnosticsService,
        textDocumentHost,
        analysisService
    });
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(diagnostics);
}
