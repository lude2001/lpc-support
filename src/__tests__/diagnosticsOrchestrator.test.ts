import * as vscode from 'vscode';
import * as fs from 'fs';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';
import * as parsedDocumentService from '../parser/ParsedDocumentService';

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        existsSync: jest.fn(actual.existsSync),
        readFileSync: jest.fn(actual.readFileSync)
    };
});

function createDocument(content: string, fileName = '/virtual/diagnostics-test.c', version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineOffsets = lines.reduce<number[]>((offsets, line, index) => {
        const previous = offsets[index - 1] ?? 0;
        const previousLineLength = index === 0 ? 0 : lines[index - 1].length + 1;
        offsets.push(previous + previousLineLength);
        return offsets;
    }, []);

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
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

    test('skips lpc diagnostics for workspace c files when workspace root lacks lpc-support.json', () => {
        const parseDocumentSpy = jest.fn();
        const diagnosticCollection = {
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        };

        (vscode.languages.createDiagnosticCollection as jest.Mock).mockReturnValue(diagnosticCollection);
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: parseDocumentSpy,
            clearCache: jest.fn()
        } as unknown as ASTManager);
        (fs.existsSync as jest.Mock).mockImplementation((targetPath: fs.PathLike) => (
            String(targetPath).endsWith('config/lpc-config.json')
        ));
        (vscode.workspace as any).getWorkspaceFolder = jest.fn().mockReturnValue({
            uri: vscode.Uri.file('/workspace/project')
        });
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );

        const document = createDocument('int value;', '/workspace/project/src/sample.c');
        orchestrator.analyzeDocument(document);

        expect(parseDocumentSpy).not.toHaveBeenCalled();
        expect(diagnosticCollection.delete).toHaveBeenCalledWith(document.uri);
        expect(diagnosticCollection.set).not.toHaveBeenCalled();
    });

    test('allows lpc diagnostics for workspace c files when workspace root contains lpc-support.json', async () => {
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
                diagnostics: [],
                lastAccessed: Date.now(),
                parseTime: 1,
                size: 1
            },
            snapshot: { parseDiagnostics: [snapshotDiagnostic] }
        }));
        const diagnosticCollection = {
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        };

        (vscode.languages.createDiagnosticCollection as jest.Mock).mockReturnValue(diagnosticCollection);
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: parseDocumentSpy,
            clearCache: jest.fn()
        } as unknown as ASTManager);
        (fs.existsSync as jest.Mock).mockImplementation((targetPath: fs.PathLike) => {
            const normalized = String(targetPath).replace(/\\/g, '/');
            return normalized.endsWith('config/lpc-config.json') || normalized.endsWith('/workspace/project/lpc-support.json');
        });
        (vscode.workspace as any).getWorkspaceFolder = jest.fn().mockReturnValue({
            uri: vscode.Uri.file('/workspace/project')
        });
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );
        (orchestrator as any).collectors = [];

        const document = createDocument('int value;', '/workspace/project/src/sample.c');
        orchestrator.analyzeDocument(document);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(parseDocumentSpy).toHaveBeenCalledTimes(1);
        expect(diagnosticCollection.set).toHaveBeenCalledWith(
            document.uri,
            expect.arrayContaining([
                expect.objectContaining({ message: 'snapshot parse error' })
            ])
        );
        expect(diagnosticCollection.delete).not.toHaveBeenCalled();
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

    test('cleans local analysis state on lpc close without invalidating shared caches', () => {
        const astManager = {
            parseDocument: jest.fn(),
            clearCache: jest.fn()
        };
        const parsedService = {
            invalidate: jest.fn()
        };

        jest.spyOn(ASTManager, 'getInstance').mockReturnValue(astManager as unknown as ASTManager);
        jest.spyOn(parsedDocumentService, 'getGlobalParsedDocumentService').mockReturnValue(parsedService as any);
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );

        (orchestrator as any).isAnalyzing.add('file:////virtual/diagnostics-test.c');
        (orchestrator as any).lastAnalysisVersion.set('file:////virtual/diagnostics-test.c', 3);

        (orchestrator as any).onDidCloseTextDocument(createDocument('int value;', '/virtual/diagnostics-test.c', 3));

        expect((orchestrator as any).isAnalyzing.has('file:////virtual/diagnostics-test.c')).toBe(false);
        expect((orchestrator as any).lastAnalysisVersion.has('file:////virtual/diagnostics-test.c')).toBe(false);
        expect(parsedService.invalidate).not.toHaveBeenCalled();
        expect(astManager.clearCache).not.toHaveBeenCalled();
    });

    test('cleans diagnostics and local analysis state on delete without invalidating shared caches', () => {
        const diagnosticCollection = {
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        };
        const astManager = {
            parseDocument: jest.fn(),
            clearCache: jest.fn()
        };
        const parsedService = {
            invalidate: jest.fn()
        };

        (vscode.languages.createDiagnosticCollection as jest.Mock).mockReturnValue(diagnosticCollection);
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue(astManager as unknown as ASTManager);
        jest.spyOn(parsedDocumentService, 'getGlobalParsedDocumentService').mockReturnValue(parsedService as any);
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = new DiagnosticsOrchestrator(
            { subscriptions: [], extensionPath: process.cwd() } as any,
            { getMacro: jest.fn(), getMacroHoverContent: jest.fn(), canResolveMacro: jest.fn() } as any
        );
        const deletedUri = vscode.Uri.file('/virtual/deleted.c');

        (orchestrator as any).isAnalyzing.add(deletedUri.toString());
        (orchestrator as any).lastAnalysisVersion.set(deletedUri.toString(), 4);

        (orchestrator as any).onDidDeleteFiles({ files: [deletedUri] });

        expect(diagnosticCollection.delete).toHaveBeenCalledTimes(1);
        expect(diagnosticCollection.delete).toHaveBeenCalledWith(deletedUri);
        expect((orchestrator as any).isAnalyzing.has(deletedUri.toString())).toBe(false);
        expect((orchestrator as any).lastAnalysisVersion.has(deletedUri.toString())).toBe(false);
        expect(parsedService.invalidate).not.toHaveBeenCalled();
        expect(astManager.clearCache).not.toHaveBeenCalled();
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
