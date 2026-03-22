import * as vscode from 'vscode';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator } from '../diagnostics';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const diagnostics = new DiagnosticsOrchestrator(context, macroManager);
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(diagnostics);

    if (vscode.window.activeTextEditor?.document.languageId === 'lpc') {
        diagnostics.analyzeDocument(vscode.window.activeTextEditor.document);
    }
}
