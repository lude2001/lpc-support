import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerDiagnostics } from '../diagnosticsModule';
import { DiagnosticsOrchestrator } from '../../diagnostics';

jest.mock('../../diagnostics', () => ({
    DiagnosticsOrchestrator: jest.fn()
}));

describe('registerDiagnostics', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let diagnosticsOrchestrator: { analyzeDocument: jest.Mock; dispose: jest.Mock };
    let macroManager: { id: string };
    let originalActiveTextEditor: unknown;

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = { subscriptions: [] } as vscode.ExtensionContext;
        macroManager = { id: 'macroManager' };
        diagnosticsOrchestrator = { analyzeDocument: jest.fn(), dispose: jest.fn() };
        originalActiveTextEditor = (vscode.window as any).activeTextEditor;

        (DiagnosticsOrchestrator as unknown as jest.Mock).mockReset().mockImplementation(() => diagnosticsOrchestrator);
    });

    afterEach(() => {
        (vscode.window as any).activeTextEditor = originalActiveTextEditor;
    });

    test('registers diagnostics service, tracks lifecycle, and analyzes active lpc document', () => {
        const activeDocument = { fileName: 'test.c', languageId: 'lpc' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);

        registerDiagnostics(registry, context);

        expect(DiagnosticsOrchestrator).toHaveBeenCalledTimes(1);
        expect(DiagnosticsOrchestrator).toHaveBeenCalledWith(context, macroManager);
        expect(registry.get(Services.Diagnostics)).toBe(diagnosticsOrchestrator);
        expect(diagnosticsOrchestrator.analyzeDocument).toHaveBeenCalledTimes(1);
        expect(diagnosticsOrchestrator.analyzeDocument).toHaveBeenCalledWith(activeDocument);

        registry.dispose();
        expect(diagnosticsOrchestrator.dispose).toHaveBeenCalledTimes(1);
    });

    test('does not analyze document when active editor is not lpc', () => {
        const activeDocument = { fileName: 'test.txt', languageId: 'txt' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);

        registerDiagnostics(registry, context);

        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
    });

    test('does not analyze document when no active editor exists', () => {
        (vscode.window as any).activeTextEditor = undefined;

        registry.register(Services.MacroManager, macroManager);

        registerDiagnostics(registry, context);

        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
    });
});
