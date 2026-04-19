import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerDiagnostics } from '../diagnosticsModule';
import { DiagnosticsOrchestrator, createDiagnosticsStack } from '../../diagnostics';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.mock('../../diagnostics', () => ({
    DiagnosticsOrchestrator: jest.fn(),
    createDiagnosticsStack: jest.fn(() => ({
        collectors: ['collector'],
        diagnosticsService: { collectDiagnostics: jest.fn() }
    }))
}));

describe('registerDiagnostics', () => {
    let registry: ServiceRegistry;
    let context: vscode.ExtensionContext;
    let diagnosticsOrchestrator: { analyzeDocument: jest.Mock; dispose: jest.Mock };
    let macroManager: { id: string };
    let analysisService: { parseDocument: jest.Mock };
    let originalActiveTextEditor: unknown;

    beforeEach(() => {
        registry = new ServiceRegistry();
        context = { subscriptions: [] } as vscode.ExtensionContext;
        macroManager = { id: 'macroManager' };
        analysisService = { parseDocument: jest.fn() };
        diagnosticsOrchestrator = { analyzeDocument: jest.fn(), dispose: jest.fn() };
        originalActiveTextEditor = (vscode.window as any).activeTextEditor;

        (DiagnosticsOrchestrator as unknown as jest.Mock).mockReset().mockImplementation(() => diagnosticsOrchestrator);
    });

    afterEach(() => {
        (vscode.window as any).activeTextEditor = originalActiveTextEditor;
    });

    test('registers diagnostics service, tracks lifecycle, and disables host document diagnostics on the public path', () => {
        const activeDocument = { fileName: 'test.c', languageId: 'lpc' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);
        registry.register(Services.Analysis, analysisService as any);

        registerDiagnostics(registry, context);

        expect(DiagnosticsOrchestrator).toHaveBeenCalledTimes(1);
        expect(createDiagnosticsStack).toHaveBeenCalledTimes(1);
        expect(createDiagnosticsStack).toHaveBeenCalledWith(macroManager, analysisService);
        expect(DiagnosticsOrchestrator).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                diagnosticsService: expect.anything()
            })
        );
        expect((DiagnosticsOrchestrator as unknown as jest.Mock).mock.calls[0][1]?.registerDocumentLifecycle).toBeUndefined();
        expect(registry.get(Services.Diagnostics)).toBe(diagnosticsOrchestrator);
        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();

        registry.dispose();
        expect(diagnosticsOrchestrator.dispose).toHaveBeenCalledTimes(1);
    });

    test('does not analyze document when active editor is not lpc', () => {
        const activeDocument = { fileName: 'test.txt', languageId: 'txt' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);
        registry.register(Services.Analysis, analysisService as any);

        registerDiagnostics(registry, context);

        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
        expect(createDiagnosticsStack).toHaveBeenCalledWith(macroManager, analysisService);
    });

    test('does not analyze document when no active editor exists', () => {
        (vscode.window as any).activeTextEditor = undefined;

        registry.register(Services.MacroManager, macroManager);
        registry.register(Services.Analysis, analysisService as any);

        registerDiagnostics(registry, context);

        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
        expect(createDiagnosticsStack).toHaveBeenCalledWith(macroManager, analysisService);
    });

    test('keeps diagnostics UX registered while diagnostics stack always comes from the shared factory', () => {
        const activeDocument = { fileName: 'test.c', languageId: 'lpc' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);
        registry.register(Services.Analysis, analysisService as any);

        registerDiagnostics(registry, context);

        expect(createDiagnosticsStack).toHaveBeenCalledTimes(1);
        expect(DiagnosticsOrchestrator).toHaveBeenCalledWith(
            context,
            expect.objectContaining({
                diagnosticsService: expect.anything()
            })
        );
        expect(registry.get(Services.Diagnostics)).toBe(diagnosticsOrchestrator);
        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
    });
});
