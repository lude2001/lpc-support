import * as vscode from 'vscode';
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
    test('uses unified ASTManager analysis for diagnostics and surfaces snapshot parse errors', async () => {
        const snapshotDiagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            'snapshot parse error',
            vscode.DiagnosticSeverity.Error
        );
        const parseDocumentSpy = jest.fn(() => ({
            parsed: {
                version: 1,
                tokens: {} as any,
                tree: {} as any,
                diagnostics: [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'stale', vscode.DiagnosticSeverity.Error)],
                lastAccessed: Date.now(),
                parseTime: 1,
                size: 1
            },
            snapshot: { parseDiagnostics: [snapshotDiagnostic] }
        }));

        const astManagerMock = {
            parseDocument: parseDocumentSpy,
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

        expect(parseDocumentSpy).toHaveBeenCalledTimes(1);
        expect(diagnostics.map((diagnostic: vscode.Diagnostic) => diagnostic.message)).toContain('snapshot parse error');
        expect(diagnostics.map((diagnostic: vscode.Diagnostic) => diagnostic.message)).not.toContain('stale');
    });

    test('passes syntax and semantic analysis context to collectors', async () => {
        const syntaxDocument = { nodes: [] } as any;
        const semanticSnapshot = {
            uri: '/virtual/diagnostics-test.c',
            version: 1,
            syntax: syntaxDocument,
            parseDiagnostics: [],
            exportedFunctions: [],
            localScopes: [],
            typeDefinitions: [],
            inheritStatements: [],
            includeStatements: [],
            macroReferences: [],
            symbolTable: {} as any,
            createdAt: Date.now()
        };
        const parseDocumentSpy = jest.fn(() => ({
            parsed: {
                version: 1,
                tokens: {} as any,
                tree: {} as any,
                diagnostics: [],
                lastAccessed: Date.now(),
                parseTime: 1,
                size: 1
            },
            syntax: syntaxDocument,
            semantic: semanticSnapshot,
            snapshot: { parseDiagnostics: [] }
        }));
        const collectSpy = jest.fn().mockResolvedValue([]);

        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: parseDocumentSpy,
            clearCache: jest.fn()
        } as unknown as ASTManager);
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );

        (orchestrator as any).collectors = [{
            name: 'context-aware',
            collect: collectSpy
        }];

        await (orchestrator as any).collectDiagnostics(createDocument('int demo() { return 1; }'));

        expect(collectSpy).toHaveBeenCalledTimes(1);
        expect(collectSpy.mock.calls[0][2]).toEqual({
            parsed: expect.any(Object),
            syntax: syntaxDocument,
            semantic: semanticSnapshot
        });
    });
});
