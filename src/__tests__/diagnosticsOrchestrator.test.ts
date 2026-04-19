import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { ASTManager } from '../ast/astManager';
import { DiagnosticsOrchestrator } from '../diagnostics/DiagnosticsOrchestrator';
import { createSharedDiagnosticsService } from '../language/services/diagnostics/createSharedDiagnosticsService';
import type { IDiagnosticCollector } from '../diagnostics/types';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from './testAstManagerSingleton';

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

function createOrchestrator(
    overrides: {
        diagnosticsService?: ReturnType<typeof createSharedDiagnosticsService>;
        context?: vscode.ExtensionContext;
    } = {}
): DiagnosticsOrchestrator {
    const collectors: IDiagnosticCollector[] = [];
    const diagnosticsService = overrides.diagnosticsService ?? createSharedDiagnosticsService({} as ASTManager, collectors);
    const context = overrides.context ?? ({ subscriptions: [], extensionPath: process.cwd() } as any);

    return new DiagnosticsOrchestrator(context, {
        diagnosticsService
    });
}

describe('DiagnosticsOrchestrator', () => {
    beforeEach(() => {
        configureAstManagerSingletonForTests();
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
    });

    test('does not register host document lifecycle listeners and only keeps diagnostics UX wiring', () => {
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: jest.fn(),
            clearCache: jest.fn()
        } as unknown as ASTManager);

        const onDidChangeTextDocument = jest.fn().mockReturnValue({ dispose: jest.fn() });
        const onDidOpenTextDocument = jest.fn().mockReturnValue({ dispose: jest.fn() });
        const onDidCloseTextDocument = jest.fn().mockReturnValue({ dispose: jest.fn() });
        const onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });
        (vscode.workspace as any).onDidChangeTextDocument = onDidChangeTextDocument;
        (vscode.workspace as any).onDidOpenTextDocument = onDidOpenTextDocument;
        (vscode.workspace as any).onDidCloseTextDocument = onDidCloseTextDocument;
        (vscode.workspace as any).onDidDeleteFiles = onDidDeleteFiles;

        const orchestrator = createOrchestrator();

        expect(orchestrator).toBeDefined();
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            'lpc.showVariables',
            expect.any(Function)
        );
        expect(onDidChangeTextDocument).not.toHaveBeenCalled();
        expect(onDidOpenTextDocument).not.toHaveBeenCalled();
        expect(onDidCloseTextDocument).not.toHaveBeenCalled();
        expect(onDidDeleteFiles).not.toHaveBeenCalled();
    });

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

        const orchestrator = createOrchestrator({
            diagnosticsService: createSharedDiagnosticsService(astManagerMock as unknown as ASTManager, [])
        });

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

        const orchestrator = createOrchestrator({
            diagnosticsService: createSharedDiagnosticsService(ASTManager.getInstance(), [])
        });

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

        const orchestrator = createOrchestrator({
            diagnosticsService: createSharedDiagnosticsService(ASTManager.getInstance(), [])
        });

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

        const collectors = [{
            name: 'context-aware',
            collect: collectSpy
        }];
        const orchestrator = createOrchestrator({
            collectors,
            diagnosticsService: createSharedDiagnosticsService(ASTManager.getInstance(), collectors as any)
        });

        await (orchestrator as any).collectDiagnostics(createDocument('int demo() { return 1; }'));

        expect(collectSpy).toHaveBeenCalledTimes(1);
        expect(collectSpy.mock.calls[0][2]).toEqual({
            parsed: expect.any(Object),
            syntax: syntaxDocument,
            semantic: semanticSnapshot
        });
    });

    test('preserves async batching and yield scheduling when analyzeDocumentAsync uses enableAsyncDiagnostics', async () => {
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
            syntax: { nodes: [] } as any,
            semantic: {
                parseDiagnostics: []
            } as any,
            snapshot: { parseDiagnostics: [] }
        }));
        const diagnosticCollection = {
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        };
        const collectors = [
            {
                name: 'collector-one',
                collect: jest.fn().mockResolvedValue([
                    new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), 'one', vscode.DiagnosticSeverity.Warning)
                ])
            },
            {
                name: 'collector-two',
                collect: jest.fn().mockResolvedValue([
                    new vscode.Diagnostic(new vscode.Range(0, 1, 0, 2), 'two', vscode.DiagnosticSeverity.Warning)
                ])
            }
        ];

        (vscode.languages.createDiagnosticCollection as jest.Mock).mockReturnValue(diagnosticCollection);
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue({
            parseDocument: parseDocumentSpy,
            clearCache: jest.fn()
        } as unknown as ASTManager);
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string) => {
                if (key === 'enableAsyncDiagnostics') {
                    return true;
                }

                if (key === 'batchSize') {
                    return 1;
                }

                if (key === 'debounceDelay') {
                    return 0;
                }

                return undefined;
            })
        });
        (vscode.workspace as any).getWorkspaceFolder = jest.fn().mockReturnValue({
            uri: vscode.Uri.file('/workspace/project')
        });
        (vscode.workspace as any).onDidDeleteFiles = jest.fn().mockReturnValue({ dispose: jest.fn() });

        const orchestrator = createOrchestrator({
            collectors: collectors as any,
            diagnosticsService: createSharedDiagnosticsService(ASTManager.getInstance(), collectors as any)
        });
        (orchestrator as any).yieldToMainThread = jest.fn().mockResolvedValue(undefined);

        const document = createDocument('int async_demo() { return 1; }', '/workspace/project/src/async.c');
        await (orchestrator as any).analyzeDocumentAsync(document, { showMessage: false });

        expect(parseDocumentSpy).toHaveBeenCalledTimes(1);
        expect((orchestrator as any).yieldToMainThread).toHaveBeenCalledTimes(2);
        expect(collectors[0].collect).toHaveBeenCalledTimes(1);
        expect(collectors[1].collect).toHaveBeenCalledTimes(1);
        expect(diagnosticCollection.set).toHaveBeenCalledWith(
            document.uri,
            expect.arrayContaining([
                expect.objectContaining({ message: 'one' }),
                expect.objectContaining({ message: 'two' })
            ])
        );
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

        const orchestrator = createOrchestrator();
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

        const orchestrator = createOrchestrator();
        const folderScanner = {
            scanFolder: jest.fn().mockResolvedValue(undefined)
        };
        (orchestrator as any).folderScanner = folderScanner;

        await orchestrator.scanFolder();

        expect(folderScanner.scanFolder).toHaveBeenCalledTimes(1);
    });

    test('dispose clears diagnostics collection without touching shared parse caches', () => {
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
        (vscode.languages.createDiagnosticCollection as jest.Mock).mockReturnValue(diagnosticCollection);
        jest.spyOn(ASTManager, 'getInstance').mockReturnValue(astManager as unknown as ASTManager);
        const orchestrator = createOrchestrator();

        orchestrator.dispose();

        expect(diagnosticCollection.clear).toHaveBeenCalledTimes(1);
        expect(diagnosticCollection.dispose).toHaveBeenCalledTimes(1);
        expect(astManager.clearCache).not.toHaveBeenCalled();
    });
});
