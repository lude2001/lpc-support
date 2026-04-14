import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { AstBackedLanguageDefinitionService } from '../LanguageDefinitionService';

function createDeferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

function createDocument(filePath: string, symbolName: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        version: 1,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return `${symbolName}();`;
            }

            return symbolName;
        }),
        getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, symbolName.length))
    } as unknown as vscode.TextDocument;
}

function createTextDocument(filePath: string, source: string): vscode.TextDocument {
    const lines = source.split(/\r?\n/);

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        version: 1,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            const start = range.start.line === 0 ? range.start.character : 0;
            const end = range.end.line === 0 ? range.end.character : source.length;
            return source.slice(start, end);
        }),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
        getWordRangeAtPosition: jest.fn()
    } as unknown as vscode.TextDocument;
}

describe('AstBackedLanguageDefinitionService', () => {
    test('reuses simulated efun source locations from docs before graph traversal', async () => {
        const workspaceRoot = 'D:\\workspace';
        const sourceFile = 'D:\\workspace\\adm\\simul_efun\\message.c';
        const document = createDocument(path.join(workspaceRoot, 'adm', 'npc', 'ganjiang.c'), 'message_vision');
        const host = {
            onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: workspaceRoot } }]),
            fileExists: jest.fn().mockReturnValue(true)
        };
        const service = new AstBackedLanguageDefinitionService(
            { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            {
                getSimulatedDoc: jest.fn().mockReturnValue({
                    name: 'message_vision',
                    sourceFile,
                    sourceRange: {
                        start: { line: 252, character: 0 },
                        end: { line: 252, character: 48 }
                    }
                })
            } as any,
            {
                inferObjectAccess: jest.fn().mockResolvedValue(undefined)
            } as any,
            undefined,
            undefined,
            host as any
        );

        const graphSpy = jest.spyOn(service as any, 'findInSimulatedEfuns');

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: {
                    workspaceRoot
                },
                mode: 'lsp'
            },
            position: { line: 0, character: 2 }
        });

        expect(definition).toEqual([
            {
                uri: vscode.Uri.file(sourceFile).toString(),
                range: {
                    start: { line: 252, character: 0 },
                    end: { line: 252, character: 48 }
                }
            }
        ]);
        expect(graphSpy).not.toHaveBeenCalled();
    });

    test('resolves simulated efun definitions from included source files', async () => {
        const workspaceRoot = 'D:\\workspace';
        const simulatedEfunEntryFile = 'D:\\workspace\\adm\\single\\simul_efun.c';
        const includedSourceFile = 'D:\\workspace\\adm\\simul_efun\\message.c';
        const document = createDocument(path.join(workspaceRoot, 'adm', 'npc', 'ganjiang.c'), 'message_vision');
        const simulatedEntryDocument = createTextDocument(
            simulatedEfunEntryFile,
            '#include "/adm/simul_efun/message.c"\n'
        );
        const includedSourceDocument = createTextDocument(
            includedSourceFile,
            'varargs void message_vision(string msg, object me, object you)\n{\n}\n'
        );
        const host = {
            onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                const targetPath = typeof target === 'string' ? target : target.fsPath;
                if (targetPath === simulatedEfunEntryFile) {
                    return simulatedEntryDocument;
                }

                if (targetPath === includedSourceFile) {
                    return includedSourceDocument;
                }

                throw new Error(`unexpected file open: ${targetPath}`);
            }),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: workspaceRoot } }]),
            fileExists: jest.fn((filePath: string) => (
                filePath === simulatedEfunEntryFile || filePath === includedSourceFile
            ))
        };
        const semanticAdapter = {
            getIncludeStatements: jest.fn((targetDocument: vscode.TextDocument) => {
                if (targetDocument === simulatedEntryDocument) {
                    return [{
                        value: '/adm/simul_efun/message.c',
                        isSystemInclude: false,
                        range: { contains: () => false }
                    }];
                }

                return [];
            }),
            getInheritStatements: jest.fn().mockReturnValue([]),
            findFunctionLocation: jest.fn((targetDocument: vscode.TextDocument, functionName: string) => {
                if (targetDocument === includedSourceDocument && functionName === 'message_vision') {
                    return {
                        uri: includedSourceFile,
                        range: {
                            start: { line: 252, character: 0 },
                            end: { line: 252, character: 48 }
                        }
                    };
                }

                return undefined;
            })
        };
        const service = new AstBackedLanguageDefinitionService(
            { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            { getSimulatedDoc: jest.fn().mockReturnValue({ name: 'message_vision' }) } as any,
            {
                inferObjectAccess: jest.fn().mockResolvedValue(undefined)
            } as any,
            undefined,
            {
                getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(simulatedEfunEntryFile)
            } as any,
            {
                host,
                semanticAdapter
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: {
                    workspaceRoot,
                    projectConfig: {
                        projectConfigPath: path.join(workspaceRoot, 'lpc-support.json'),
                        resolvedConfig: {
                            simulatedEfunFile: '/adm/single/simul_efun'
                        }
                    }
                },
                mode: 'lsp'
            },
            position: { line: 0, character: 2 }
        });

        expect(definition).toEqual([
            {
                uri: includedSourceFile,
                range: {
                    start: { line: 252, character: 0 },
                    end: { line: 252, character: 48 }
                }
            }
        ]);
    });

    test('resolves simulated efun definitions from workspace project config paths', async () => {
        const workspaceRoot = 'D:\\workspace';
        const simulatedEfunFile = 'D:\\workspace\\adm\\single\\simul_efun.c';
        const document = createDocument(path.join(workspaceRoot, 'cmds', 'test.c'), 'write');
        const simulatedDocument = {
            uri: vscode.Uri.file(simulatedEfunFile),
            fileName: simulatedEfunFile,
            version: 1
        } as unknown as vscode.TextDocument;
        const host = {
            onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                const targetPath = typeof target === 'string' ? target : target.fsPath;
                if (targetPath === simulatedEfunFile) {
                    return simulatedDocument;
                }

                throw new Error(`unexpected file open: ${targetPath}`);
            }),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: workspaceRoot } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: workspaceRoot } }]),
            fileExists: jest.fn((filePath: string) => filePath === simulatedEfunFile)
        };
        const service = new AstBackedLanguageDefinitionService(
            { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            { getSimulatedDoc: jest.fn().mockReturnValue({ name: 'write' }) } as any,
            {
                inferObjectAccess: jest.fn().mockResolvedValue(undefined)
            } as any,
            undefined,
            {
                getSimulatedEfunFileForWorkspace: jest.fn().mockResolvedValue(simulatedEfunFile)
            } as any,
            {
                host,
                semanticAdapter: {
                    findFunctionLocation: jest.fn((_doc: vscode.TextDocument, functionName: string) => {
                        if (functionName !== 'write') {
                            return undefined;
                        }

                        return {
                            uri: simulatedEfunFile,
                            range: {
                                start: { line: 2, character: 0 },
                                end: { line: 4, character: 1 }
                            }
                        };
                    })
                }
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: {
                    workspaceRoot,
                    projectConfig: {
                        projectConfigPath: path.join(workspaceRoot, 'lpc-support.json'),
                        resolvedConfig: {
                            simulatedEfunFile: '/adm/single/simul_efun'
                        }
                    }
                },
                mode: 'lsp'
            },
            position: { line: 0, character: 1 }
        });

        expect(definition).toEqual([
            {
                uri: simulatedEfunFile,
                range: {
                    start: { line: 2, character: 0 },
                    end: { line: 4, character: 1 }
                }
            }
        ]);
    });

    test('concurrent definition requests keep traversal state isolated per request', async () => {
        const host = {
            onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn((uri: vscode.Uri) => ({ uri: { fsPath: uri.fsPath.replace(/\\[^\\]+$/, '') } })),
            getWorkspaceFolders: jest.fn(),
            fileExists: jest.fn().mockReturnValue(false)
        };
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue(undefined)
        };
        const service = new AstBackedLanguageDefinitionService(
            { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            objectInferenceService as any,
            undefined,
            undefined,
            host as any
        );
        const alphaDocument = createDocument('D:\\workspace\\alpha.c', 'alpha_call');
        const betaDocument = createDocument('D:\\workspace\\beta.c', 'beta_call');
        const alphaLocation = new vscode.Location(
            alphaDocument.uri,
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10))
        );
        const betaLocation = new vscode.Location(
            betaDocument.uri,
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 9))
        );
        const firstRequestGate = createDeferred<void>();

        jest.spyOn(service as any, 'findFunctionDefinitions').mockImplementation(
            async (document: vscode.TextDocument, requestState: { functionDefinitions: Map<string, vscode.Location> }) => {
            if (document === alphaDocument) {
                requestState.functionDefinitions.set('alpha_call', alphaLocation);
                await firstRequestGate.promise;
                return;
            }

            if (document === betaDocument) {
                requestState.functionDefinitions.set('beta_call', betaLocation);
            }
        });
        jest.spyOn(service as any, 'findInheritedFunctionDefinitions').mockResolvedValue(undefined);
        jest.spyOn(service as any, 'findFunctionInCurrentFileIncludes').mockResolvedValue(undefined);

        const alphaPromise = service.provideDefinition({
            context: {
                document: alphaDocument as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 0, character: 1 }
        });
        await Promise.resolve();

        const betaResult = await service.provideDefinition({
            context: {
                document: betaDocument as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 0, character: 1 }
        });

        firstRequestGate.resolve();
        const alphaResult = await alphaPromise;

        expect(betaResult).toEqual([
            {
                uri: betaDocument.uri.toString(),
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 9 }
                }
            }
        ]);
        expect(alphaResult).toEqual([
            {
                uri: alphaDocument.uri.toString(),
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 }
                }
            }
        ]);
    });
});
