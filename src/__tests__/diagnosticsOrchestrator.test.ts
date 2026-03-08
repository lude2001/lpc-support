import * as vscode from 'vscode';
import * as parseCache from '../parseCache';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';

function createDocument(content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);

    return {
        uri: vscode.Uri.file('/virtual/diagnostics-test.c'),
        fileName: '/virtual/diagnostics-test.c',
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: jest.fn(() => content),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        })
    } as unknown as vscode.TextDocument;
}

describe('DiagnosticsOrchestrator', () => {
    test('uses snapshot parse diagnostics without reparsing for syntax errors', async () => {
        const snapshotDiagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            'snapshot parse error',
            vscode.DiagnosticSeverity.Error
        );
        const getParsedSpy = jest.spyOn(parseCache, 'getParsed').mockReturnValue({
            version: 1,
            tokens: {} as any,
            tree: {} as any,
            diagnostics: [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'stale', vscode.DiagnosticSeverity.Error)],
            lastAccessed: Date.now(),
            parseTime: 1,
            size: 1
        });

        const astManagerMock = {
            getSnapshot: jest.fn(() => ({ parseDiagnostics: [snapshotDiagnostic] })),
            clearCache: jest.fn()
        };
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue(astManagerMock as unknown as ASTManager);
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );

        (orchestrator as any).collectors = [];

        const diagnostics = await (orchestrator as any).collectDiagnostics(createDocument('int broken('));

        expect(getParsedSpy).toHaveBeenCalledTimes(1);
        expect(astManagerMock.getSnapshot).toHaveBeenCalledTimes(1);
        expect(diagnostics.map((diagnostic: vscode.Diagnostic) => diagnostic.message)).toContain('snapshot parse error');
        expect(diagnostics.map((diagnostic: vscode.Diagnostic) => diagnostic.message)).not.toContain('stale');
    });
});
