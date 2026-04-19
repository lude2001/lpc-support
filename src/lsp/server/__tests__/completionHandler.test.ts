import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    Disposable,
    CompletionItemKind,
    TextDocumentSyncKind,
    type CompletionItem,
    type CompletionParams,
    type CompletionResult,
    type InitializeParams,
    type InitializeResult,
} from 'vscode-languageserver/node';
import * as vscode from 'vscode';
import type {
    LanguageCompletionItem,
    LanguageCompletionService
} from '../../../language/services/completion/LanguageCompletionService';
import { QueryBackedLanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import { DocumentSemanticSnapshotService } from '../../../semantic/documentSemanticSnapshotService';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

describe('registerCompletionHandler', () => {
    beforeEach(() => {
    });

    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
        jest.restoreAllMocks();
    });

    test('registers completion and completion-resolve handlers backed by the completion service', async () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let completionHandler: ((params: CompletionParams) => Promise<CompletionResult> | CompletionResult) | undefined;
        let resolveHandler: ((item: CompletionItem) => Promise<CompletionItem> | CompletionItem) | undefined;

        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async () => ({
                isIncomplete: false,
                items: [
                    {
                        label: 'local_call',
                        kind: 'function',
                        detail: 'int local_call',
                        data: {
                            candidate: {} as LanguageCompletionItem['data']['candidate'],
                            context: {} as LanguageCompletionItem['data']['context'],
                            documentUri: 'file:///workspace/test.c',
                            documentVersion: 3,
                            resolved: false
                        }
                    }
                ]
            })),
            resolveCompletionItem: jest.fn(async (request) => ({
                ...request.item,
                documentation: {
                    kind: 'markdown',
                    value: '### local_call'
                },
                insertText: 'local_call(${1:arg})',
                data: {
                    ...request.item.data,
                    resolved: true
                }
            }))
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(handler => {
                completionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCompletionResolve: jest.fn(handler => {
                resolveHandler = handler;
                return Disposable.create(() => undefined);
            })
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                completionService
            }
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open('file:///workspace/test.c', 3, 'int main() { local_ }');

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                completionProvider: {
                    resolveProvider: true
                },
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.40.0-test'
            }
        });

        const completionResult = await completionHandler?.({
            textDocument: { uri: 'file:///workspace/test.c' },
            position: { line: 0, character: 19 }
        } as CompletionParams);

        expect(completionService.provideCompletion).toHaveBeenCalledTimes(1);
        expect(completionResult).toEqual({
            isIncomplete: false,
            items: [
                expect.objectContaining({
                    label: 'local_call',
                    kind: CompletionItemKind.Function,
                    detail: 'int local_call'
                })
            ]
        });
        expect((completionResult as { items: CompletionItem[] }).items.map(item => item.label)).toContain('local_call');

        const resolved = await resolveHandler?.((completionResult as { items: CompletionItem[] }).items[0]);

        expect(completionService.resolveCompletionItem).toHaveBeenCalledTimes(1);
        expect(resolved).toEqual(expect.objectContaining({
            label: 'local_call',
            kind: CompletionItemKind.Function,
            documentation: {
                kind: 'markdown',
                value: '### local_call'
            },
            insertText: 'local_call(${1:arg})'
        }));
    });

    test('passes a text-document-compatible shim and normalized workspace root to the completion service', async () => {
        let completionHandler: ((params: CompletionParams) => Promise<CompletionResult> | CompletionResult) | undefined;

        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async (request) => {
                const document = request.context.document as {
                    uri: string;
                    version: number;
                    fileName: string;
                    languageId: string;
                    lineCount: number;
                    getText: () => string;
                    lineAt: (line: number) => { text: string };
                    offsetAt: (position: { line: number; character: number }) => number;
                    positionAt: (offset: number) => { line: number; character: number };
                };

                expect(request.context.workspace.workspaceRoot).toBe('D:/workspace');
                expect(document.uri.toString()).toBe('file:///D:/workspace/test.c');
                expect(document.uri.fsPath).toBe('D:/workspace/test.c');
                expect(document.version).toBe(7);
                expect(document.fileName).toBe('D:/workspace/test.c');
                expect(document.languageId).toBe('lpc');
                expect(document.lineCount).toBe(3);
                expect(document.getText()).toBe('int main() {\n    local_\n}');
                expect(document.getText(new vscode.Range(1, 4, 1, 10))).toBe('local_');
                expect(document.lineAt(1)).toEqual(expect.objectContaining({ text: '    local_' }));
                expect(document.offsetAt({ line: 1, character: 4 })).toBe(17);
                expect(document.positionAt(17)).toEqual({ line: 1, character: 4 });

                return {
                    isIncomplete: false,
                    items: [
                        {
                            label: 'local_call',
                            kind: 'function',
                            detail: 'int local_call'
                        }
                    ]
                };
            })
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(() => Disposable.create(() => undefined)),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(handler => {
                completionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCompletionResolve: jest.fn(() => Disposable.create(() => undefined))
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/work', 'D:/workspace']
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open('file:///D:/workspace/test.c', 7, 'int main() {\n    local_\n}');

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        const result = await completionHandler?.({
            textDocument: { uri: 'file:///D:/workspace/test.c' },
            position: { line: 1, character: 9 }
        } as CompletionParams);

        expect(completionService.provideCompletion).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            isIncomplete: false,
            items: [
                expect.objectContaining({
                    label: 'local_call',
                    detail: 'int local_call'
                })
            ]
        });
    });

    test('keeps completion resolve stable when item data has no documentUri', async () => {
        let resolveHandler: ((item: CompletionItem) => Promise<CompletionItem> | CompletionItem) | undefined;

        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async () => ({
                isIncomplete: false,
                items: []
            })),
            resolveCompletionItem: jest.fn(async (request) => {
                expect(request.context.workspace.workspaceRoot).toBe('D:/workspace');
                expect(request.context.document.getText()).toBe('');
                expect(request.context.document.uri.toString()).toBe('');

                return {
                    ...request.item,
                    documentation: {
                        kind: 'markdown',
                        value: 'fallback resolve'
                    }
                };
            })
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(() => Disposable.create(() => undefined)),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(() => Disposable.create(() => undefined)),
            onCompletionResolve: jest.fn(handler => {
                resolveHandler = handler;
                return Disposable.create(() => undefined);
            })
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace']
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        const resolved = await resolveHandler?.({
            label: 'fallback_item',
            kind: CompletionItemKind.Function,
            data: {
                resolved: false
            }
        });

        expect(completionService.resolveCompletionItem).toHaveBeenCalledTimes(1);
        expect(resolved).toEqual(expect.objectContaining({
            label: 'fallback_item',
            documentation: {
                kind: 'markdown',
                value: 'fallback resolve'
            }
        }));
    });

    test('prefers the deepest matching workspace root for nested workspaces', async () => {
        let completionHandler: ((params: CompletionParams) => Promise<CompletionResult> | CompletionResult) | undefined;

        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async (request) => {
                expect(request.context.workspace.workspaceRoot).toBe('D:/workspace/sub');

                return {
                    isIncomplete: false,
                    items: []
                };
            })
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(() => Disposable.create(() => undefined)),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(handler => {
                completionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCompletionResolve: jest.fn(() => Disposable.create(() => undefined))
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace', 'D:/workspace/sub']
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open('file:///D:/workspace/sub/test.c', 1, 'int main() { return 0; }');

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        await completionHandler?.({
            textDocument: { uri: 'file:///D:/workspace/sub/test.c' },
            position: { line: 0, character: 3 }
        } as CompletionParams);

        expect(completionService.provideCompletion).toHaveBeenCalledTimes(1);
    });

    test('supports the real query-backed completion service through the handler document shim', async () => {
        let completionHandler: ((params: CompletionParams) => Promise<CompletionResult> | CompletionResult) | undefined;

        const efunDocsManager = {
            getAllFunctions: jest.fn(() => []),
            getStandardDoc: jest.fn(() => undefined),
            getAllSimulatedFunctions: jest.fn(() => []),
            getSimulatedDoc: jest.fn(() => undefined)
        };
        const macroManager = {
            getMacro: jest.fn(),
            getAllMacros: jest.fn(() => []),
            getMacroHoverContent: jest.fn(),
            scanMacros: jest.fn(),
            getIncludePath: jest.fn(() => undefined)
        };
        const realService = new QueryBackedLanguageCompletionService(
            efunDocsManager as any,
            macroManager as any,
            undefined,
            undefined,
            undefined,
            {
                analysisService: DocumentSemanticSnapshotService.getInstance()
            }
        );
        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async (request) => {
                const document = request.context.document as unknown as {
                    uri: { fsPath: string; toString(): string };
                    getText(range?: vscode.Range): string;
                };

                expect(typeof document.uri?.toString).toBe('function');
                expect(document.uri.toString()).toBe('file:///D:/workspace/test.c');
                expect(document.uri.fsPath).toBe('D:/workspace/test.c');
                expect(document.getText(new vscode.Range(0, 0, 0, 14))).toBe('int local_call');

                return realService.provideCompletion(request);
            }),
            resolveCompletionItem: jest.fn(async request => realService.resolveCompletionItem!(request))
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(() => Disposable.create(() => undefined)),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(handler => {
                completionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCompletionResolve: jest.fn(() => Disposable.create(() => undefined))
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                completionService
            }
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open(
            'file:///D:/workspace/test.c',
            1,
            ['int local_call() {', '    return 1;', '}', '', 'void demo() {', '    local_call();', '}'].join('\n')
        );

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        const result = await completionHandler?.({
            textDocument: { uri: 'file:///D:/workspace/test.c' },
            position: { line: 5, character: 9 }
        } as CompletionParams);

        expect(completionService.provideCompletion).toHaveBeenCalledTimes(1);
        expect((result as { items: CompletionItem[] }).items.map(item => item.label)).toContain('local_call');
    });

    test('preserves POSIX file URIs when building the document shim and resolving the workspace root', async () => {
        let completionHandler: ((params: CompletionParams) => Promise<CompletionResult> | CompletionResult) | undefined;

        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async (request) => {
                const document = request.context.document as {
                    uri: { fsPath: string; toString(): string };
                    fileName: string;
                };

                expect(request.context.workspace.workspaceRoot).toBe('/workspace');
                expect(document.uri.toString()).toBe('file:///workspace/test.c');
                expect(document.uri.fsPath).toBe('/workspace/test.c');
                expect(document.fileName).toBe('/workspace/test.c');

                return {
                    isIncomplete: false,
                    items: []
                };
            })
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(() => Disposable.create(() => undefined)),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(handler => {
                completionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCompletionResolve: jest.fn(() => Disposable.create(() => undefined))
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['/opt/project', '/workspace']
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open('file:///workspace/test.c', 2, 'int main() { return 0; }');

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        await completionHandler?.({
            textDocument: { uri: 'file:///workspace/test.c' },
            position: { line: 0, character: 3 }
        } as CompletionParams);

        expect(completionService.provideCompletion).toHaveBeenCalledTimes(1);
    });

    test('keeps POSIX workspace-root matching case-sensitive', async () => {
        let completionHandler: ((params: CompletionParams) => Promise<CompletionResult> | CompletionResult) | undefined;

        const completionService: LanguageCompletionService = {
            provideCompletion: jest.fn(async (request) => {
                expect(request.context.workspace.workspaceRoot).toBe('/opt/project');

                return {
                    isIncomplete: false,
                    items: []
                };
            })
        };

        const connection: ServerConnection = {
            onInitialize: jest.fn(() => Disposable.create(() => undefined)),
            onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
            onNotification: jest.fn(() => Disposable.create(() => undefined)),
            onRequest: jest.fn(() => Disposable.create(() => undefined)),
            onCompletion: jest.fn(handler => {
                completionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCompletionResolve: jest.fn(() => Disposable.create(() => undefined))
        };
        const documentStore = new DocumentStore();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['/opt/project', '/workspace']
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        documentStore.open('file:///Workspace/test.c', 2, 'int main() { return 0; }');

        registerCapabilities({
            connection,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession,
            completionService
        });

        await completionHandler?.({
            textDocument: { uri: 'file:///Workspace/test.c' },
            position: { line: 0, character: 3 }
        } as CompletionParams);

        expect(completionService.provideCompletion).toHaveBeenCalledTimes(1);
    });
});
