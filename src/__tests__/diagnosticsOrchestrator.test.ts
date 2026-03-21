import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';

function createDocument(content: string): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineOffsets = lines.reduce<number[]>((offsets, line, index) => {
        const previous = offsets[index - 1] ?? 0;
        const previousLineLength = index === 0 ? 0 : lines[index - 1].length + 1;
        offsets.push(previous + previousLineLength);
        return offsets;
    }, []);

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
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineOffsets.length; index++) {
                if (lineOffsets[index] <= offset) {
                    line = index;
                }
            }
            return new vscode.Position(line, offset - lineOffsets[line]);
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

    test('delegates show variables command to variable inspector for active lpc documents', async () => {
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: jest.fn(),
            clearCache: jest.fn()
        } as unknown as ASTManager);
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });
        (vscode.commands.registerCommand as jest.Mock).mockClear();

        const lpcDocument = createDocument('int value;');
        const variableInspector = {
            show: jest.fn().mockResolvedValue(undefined)
        };
        const onDidReceiveMessage = jest.fn();
        (vscode.window as any).createWebviewPanel = jest.fn().mockReturnValue({
            webview: {
                html: '',
                onDidReceiveMessage
            }
        });
        (vscode.window as any).activeTextEditor = {
            document: lpcDocument
        };

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );
        (orchestrator as any).variableInspector = variableInspector;

        const showVariablesRegistration = (vscode.commands.registerCommand as jest.Mock).mock.calls
            .find(([commandId]) => commandId === 'lpc.showVariables');
        expect(showVariablesRegistration).toBeDefined();

        const [, handler] = showVariablesRegistration!;

        await handler();

        expect(variableInspector.show).toHaveBeenCalledTimes(1);
        expect(variableInspector.show).toHaveBeenCalledWith(lpcDocument);
    });

    test('delegates scanFolder to folder scanner', async () => {
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: jest.fn(),
            clearCache: jest.fn()
        } as unknown as ASTManager);
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );
        const folderScanner = {
            scanFolder: jest.fn().mockResolvedValue(undefined)
        };
        (orchestrator as any).folderScanner = folderScanner;

        await orchestrator.scanFolder();

        expect(folderScanner.scanFolder).toHaveBeenCalledTimes(1);
    });
});
