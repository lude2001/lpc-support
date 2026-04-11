import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { Services } from '../core/ServiceKeys';
import { DiagnosticsOrchestrator, createDefaultDiagnosticsCollectors } from '../diagnostics';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';

export function registerDiagnostics(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const registerDocumentLifecycle = false;
    const collectors = createDefaultDiagnosticsCollectors(macroManager);
    const diagnosticsService = createSharedDiagnosticsService(ASTManager.getInstance(), collectors);
    const diagnostics = new DiagnosticsOrchestrator(context, macroManager, {
        registerDocumentLifecycle,
        collectors,
        diagnosticsService
    });
    registry.register(Services.Diagnostics, diagnostics);
    registry.track(diagnostics);

    if (registerDocumentLifecycle && vscode.window.activeTextEditor?.document.languageId === 'lpc') {
        diagnostics.analyzeDocument(vscode.window.activeTextEditor.document);
    }
}
