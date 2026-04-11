import * as vscode from 'vscode';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { Services } from '../../core/ServiceKeys';
import { registerDiagnostics } from '../diagnosticsModule';
import { DiagnosticsOrchestrator } from '../../diagnostics';
import { createSharedDiagnosticsService } from '../../language/services/diagnostics/createSharedDiagnosticsService';

jest.mock('../../diagnostics', () => ({
    DiagnosticsOrchestrator: jest.fn(),
    createDefaultDiagnosticsCollectors: jest.fn(() => ['collector'])
}));
jest.mock('../../language/services/diagnostics/createSharedDiagnosticsService', () => ({
    createSharedDiagnosticsService: jest.fn(() => ({ collectDiagnostics: jest.fn() }))
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

    test('registers diagnostics service, tracks lifecycle, and disables host document diagnostics on the public path', () => {
        const activeDocument = { fileName: 'test.c', languageId: 'lpc' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);

        registerDiagnostics(registry, context);

        expect(DiagnosticsOrchestrator).toHaveBeenCalledTimes(1);
        expect(createSharedDiagnosticsService).toHaveBeenCalledTimes(1);
        expect(DiagnosticsOrchestrator).toHaveBeenCalledWith(
            context,
            macroManager,
            expect.objectContaining({
                registerDocumentLifecycle: false,
                diagnosticsService: expect.anything(),
                collectors: expect.any(Array)
            })
        );
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

        registerDiagnostics(registry, context);

        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
    });

    test('does not analyze document when no active editor exists', () => {
        (vscode.window as any).activeTextEditor = undefined;

        registry.register(Services.MacroManager, macroManager);

        registerDiagnostics(registry, context);

        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
    });

    test('keeps diagnostics UX registered while host document lifecycle stays disabled', () => {
        const activeDocument = { fileName: 'test.c', languageId: 'lpc' } as vscode.TextDocument;
        (vscode.window as any).activeTextEditor = {
            document: activeDocument
        };

        registry.register(Services.MacroManager, macroManager);

        registerDiagnostics(registry, context);

        expect(createSharedDiagnosticsService).toHaveBeenCalledTimes(1);
        expect(DiagnosticsOrchestrator).toHaveBeenCalledWith(
            context,
            macroManager,
            expect.objectContaining({
                registerDocumentLifecycle: false,
                diagnosticsService: expect.anything(),
                collectors: expect.any(Array)
            })
        );
        expect(registry.get(Services.Diagnostics)).toBe(diagnosticsOrchestrator);
        expect(diagnosticsOrchestrator.analyzeDocument).not.toHaveBeenCalled();
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
