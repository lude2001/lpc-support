import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as path from 'path';
import * as vscode from 'vscode';
import { AstBackedLanguageDefinitionService } from '../LanguageDefinitionService';
import { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
import { ASTManager } from '../../../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { TargetMethodLookup } from '../../../../targetMethodLookup';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../../../__tests__/testAstManagerSingleton';

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
    const lineStarts = [0];

    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? source.length;
        return Math.min(lineStart + position.character, source.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            return source.slice(offsetAt(range.start), offsetAt(range.end));
        }),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
        getWordRangeAtPosition: jest.fn((position: vscode.Position) => {
            const lineText = lines[position.line] ?? '';
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));

            let start = position.character;
            while (start > 0 && isWordCharacter(lineText[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < lineText.length && isWordCharacter(lineText[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return new vscode.Range(position.line, start, position.line, end);
        }),
        positionAt: jest.fn(positionAt),
        offsetAt: jest.fn(offsetAt),
        save: jest.fn(async () => true),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function createScopedMethodResolverStub(
    resolution: Awaited<ReturnType<ScopedMethodResolver['resolveCallAt']>>
): Pick<ScopedMethodResolver, 'resolveCallAt'> {
    return {
        resolveCallAt: jest.fn().mockResolvedValue(resolution)
    };
}

describe('AstBackedLanguageDefinitionService', () => {
    const analysisService = DocumentSemanticSnapshotService.getInstance();

    function createDefinitionService(
        efunDocsManager: unknown,
        objectInferenceService?: unknown,
        targetMethodLookup?: unknown,
        projectConfigService?: unknown,
        hostOrDependencies: Record<string, unknown> = {}
    ): AstBackedLanguageDefinitionService {
        const defaultHost = {
            onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(),
            getWorkspaceFolders: jest.fn(),
            fileExists: jest.fn().mockReturnValue(false)
        };
        const resolvedHost = 'onDidChangeTextDocument' in hostOrDependencies
            ? hostOrDependencies
            : (hostOrDependencies as any).host ?? defaultHost;
        const resolvedDependencies = 'onDidChangeTextDocument' in hostOrDependencies
            ? {
                host: resolvedHost,
                analysisService,
                pathSupport: new WorkspaceDocumentPathSupport({
                    host: resolvedHost as any,
                    projectConfigService: projectConfigService as any
                })
            }
            : {
                analysisService,
                host: resolvedHost,
                pathSupport: new WorkspaceDocumentPathSupport({
                    host: resolvedHost as any,
                    projectConfigService: projectConfigService as any
                }),
                ...hostOrDependencies
            };
        const resolvedObjectInferenceService = objectInferenceService ?? {
            inferObjectAccess: jest.fn().mockResolvedValue(undefined)
        };
        const resolvedTargetMethodLookup = targetMethodLookup
            ?? new TargetMethodLookup(analysisService, resolvedDependencies.pathSupport);

        return new AstBackedLanguageDefinitionService(
            efunDocsManager as any,
            resolvedObjectInferenceService as any,
            resolvedTargetMethodLookup as any,
            projectConfigService as any,
            resolvedDependencies as any
        );
    }

    beforeEach(() => {
        configureAstManagerSingletonForTests(analysisService);
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
    });

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
        const service = createDefinitionService(
            {
                getSimulatedDoc: jest.fn().mockReturnValue({
                    name: 'message_vision',
                    sourcePath: sourceFile,
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

        const graphSpy = jest.spyOn((service as any).directSymbolDefinitionResolver, 'findFunctionInSimulatedEfunGraph');

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
        const service = createDefinitionService(
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
        const service = createDefinitionService(
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
        const service = createDefinitionService(
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

        jest.spyOn((service as any).functionFamilyDefinitionResolver, 'resolve').mockImplementation(
            async (
                document: vscode.TextDocument,
                word: string,
                requestState: { functionDefinitions: Map<string, vscode.Location> }
            ) => {
                if (document === alphaDocument) {
                    requestState.functionDefinitions.set('alpha_call', alphaLocation);
                    await firstRequestGate.promise;
                    return requestState.functionDefinitions.get(word);
                }

                if (document === betaDocument) {
                    requestState.functionDefinitions.set('beta_call', betaLocation);
                    return requestState.functionDefinitions.get(word);
                }

                return undefined;
            }
        );

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

    test('definition service resolves a leading prototype name to the later in-file implementation', async () => {
        const source = [
            'private mapping execute_command(object actor, string arg);',
            '',
            'void demo() {',
            '    execute_command(this_object(), "go");',
            '}',
            '',
            '/**',
            ' * @brief 执行最小正式突破命令的结构化逻辑。',
            ' */',
            'mapping execute_command(object actor, string arg) {',
            '    return ([]);',
            '}'
        ].join('\n');
        const document = createTextDocument('D:\\workspace\\prototype-definition.c', source);
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:\\workspace' } })),
                    getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:\\workspace' } }]),
                    fileExists: jest.fn().mockReturnValue(false)
                }
            } as any
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 0, character: 18 }
        });

        expect(definition).toEqual([
            {
                uri: document.uri.toString(),
                range: {
                    start: { line: 9, character: 8 },
                    end: { line: 9, character: 23 }
                }
            }
        ]);
    });

    test('definition service short-circuits object-method hits before direct symbol and function-family lookup', async () => {
        const document = createTextDocument('D:\\workspace\\obj\\demo.c', 'void demo() {\n    target->query_hp();\n}\n');
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_hp',
                    inference: {
                        status: 'resolved',
                        candidates: [{ path: 'D:\\workspace\\obj\\npc.c' }]
                    }
                })
            } as any,
            {
                findMethod: jest.fn().mockResolvedValue({
                    location: new vscode.Location(
                        vscode.Uri.file('D:\\workspace\\obj\\npc.c'),
                        new vscode.Range(4, 0, 4, 8)
                    )
                })
            } as any,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:\\workspace' } })),
                    getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:\\workspace' } }]),
                    fileExists: jest.fn().mockReturnValue(false)
                }
            } as any
        );

        const directSpy = jest.spyOn((service as any).directSymbolDefinitionResolver, 'resolve');
        const functionSpy = jest.spyOn((service as any).functionFamilyDefinitionResolver, 'resolve');

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 14 }
        });

        expect(definition).toEqual([
            {
                uri: vscode.Uri.file('D:\\workspace\\obj\\npc.c').toString(),
                range: {
                    start: { line: 4, character: 0 },
                    end: { line: 4, character: 8 }
                }
            }
        ]);
        expect(directSpy).not.toHaveBeenCalled();
        expect(functionSpy).not.toHaveBeenCalled();
    });

    test('definition service short-circuits direct-symbol hits before function-family lookup', async () => {
        const document = createTextDocument('D:\\workspace\\cmds\\test.c', [
            '#define USER_OB "/obj/user"',
            'USER_OB->query_name();'
        ].join('\n'));
        const service = createDefinitionService(
             { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:\\workspace' } })),
                    getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:\\workspace' } }]),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
                }
            } as any
        );

        const functionSpy = jest.spyOn((service as any).functionFamilyDefinitionResolver, 'resolve');

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 2 }
        });

        expect(definition).toEqual([
            {
                uri: vscode.Uri.parse(document.uri.toString()).toString(),
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: '#define USER_OB "/obj/user"'.length }
                }
            }
        ]);
        expect(functionSpy).not.toHaveBeenCalled();
    });

    test('definition service resolves bare ::create() before ordinary function fallback', async () => {
        const document = createTextDocument('D:\\workspace\\room.c', 'void demo() {\n    ::create();\n}\n');
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(),
                    getWorkspaceFolders: jest.fn(),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    getInheritStatements: jest.fn().mockReturnValue([]),
                    getExportedFunctionNames: jest.fn().mockReturnValue(['create']),
                    findFunctionLocation: jest.fn().mockReturnValue({
                        uri: document.uri.toString(),
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 4 }
                        }
                    }),
                    resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
                },
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    methodName: 'create',
                    targets: [{
                        path: 'D:\\workspace\\std\\base_room.c',
                        methodName: 'create',
                        declarationRange: new vscode.Range(0, 5, 0, 11),
                        location: new vscode.Location(
                            vscode.Uri.file('D:\\workspace\\std\\base_room.c'),
                            new vscode.Range(0, 5, 0, 11)
                        ),
                        document: createTextDocument('D:\\workspace\\std\\base_room.c', 'void create() {}\n'),
                        sourceLabel: 'D:\\workspace\\std\\base_room.c'
                    }]
                })
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 6 }
        });

        expect(definition).toEqual([
            {
                uri: vscode.Uri.file('D:\\workspace\\std\\base_room.c').toString(),
                range: {
                    start: { line: 0, character: 5 },
                    end: { line: 0, character: 11 }
                }
            }
        ]);
    });

    test('definition service resolves room::init() to the uniquely matched direct inherit branch', async () => {
        const document = createTextDocument('D:\\workspace\\room.c', 'void demo() {\n    room::init();\n}\n');
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(),
                    getWorkspaceFolders: jest.fn(),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    getInheritStatements: jest.fn().mockReturnValue([]),
                    getExportedFunctionNames: jest.fn().mockReturnValue([]),
                    findFunctionLocation: jest.fn().mockReturnValue(undefined),
                    resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
                },
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:\\workspace\\std\\room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(1, 5, 1, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:\\workspace\\std\\room.c'),
                            new vscode.Range(1, 5, 1, 9)
                        ),
                        document: createTextDocument('D:\\workspace\\std\\room.c', 'void init() {}\n'),
                        sourceLabel: 'D:\\workspace\\std\\room.c'
                    }]
                })
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 10 }
        });

        expect(definition).toEqual([
            {
                uri: vscode.Uri.file('D:\\workspace\\std\\room.c').toString(),
                range: {
                    start: { line: 1, character: 5 },
                    end: { line: 1, character: 9 }
                }
            }
        ]);
    });

    test('definition service resolves multiline room::init() when the position is on the method identifier', async () => {
        const document = createTextDocument('D:\\workspace\\room.c', 'void demo() {\n    room::\n    init();\n}\n');
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(),
                    getWorkspaceFolders: jest.fn(),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    getInheritStatements: jest.fn().mockReturnValue([]),
                    getExportedFunctionNames: jest.fn().mockReturnValue([]),
                    findFunctionLocation: jest.fn().mockReturnValue(undefined),
                    resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
                },
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:\\workspace\\std\\room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(1, 5, 1, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:\\workspace\\std\\room.c'),
                            new vscode.Range(1, 5, 1, 9)
                        ),
                        document: createTextDocument('D:\\workspace\\std\\room.c', 'void init() {}\n'),
                        sourceLabel: 'D:\\workspace\\std\\room.c'
                    }]
                })
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 2, character: 6 }
        });

        expect(definition).toEqual([
            {
                uri: vscode.Uri.file('D:\\workspace\\std\\room.c').toString(),
                range: {
                    start: { line: 1, character: 5 },
                    end: { line: 1, character: 9 }
                }
            }
        ]);
    });

    test('definition service returns no result for ambiguous room::init() instead of falling back', async () => {
        const document = createTextDocument('D:\\workspace\\room.c', 'void demo() {\n    room::init();\n}\n');
        const fallbackSpy = jest.fn().mockReturnValue({
            uri: document.uri.toString(),
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 4 }
            }
        });
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue({ name: 'init' }) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(),
                    getWorkspaceFolders: jest.fn(),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    getInheritStatements: jest.fn().mockReturnValue([]),
                    getExportedFunctionNames: jest.fn().mockReturnValue(['init']),
                    findFunctionLocation: fallbackSpy,
                    resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
                },
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'unknown',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: []
                })
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 10 }
        });

        expect(definition).toEqual([]);
        expect(fallbackSpy).not.toHaveBeenCalled();
    });

    test('definition service does not resolve scoped room::init(arg) when the position is on the qualifier', async () => {
        const document = createTextDocument('D:\\workspace\\room.c', 'void demo() {\n    room::init(arg);\n}\n');
        const qualifierLocation = {
            uri: document.uri.toString(),
            range: {
                start: { line: 1, character: 4 },
                end: { line: 1, character: 8 }
            }
        };
        const visibleVariableSpy = jest.fn((_: vscode.TextDocument, variableName: string) => (
            variableName === 'room' ? qualifierLocation : undefined
        ));
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(),
                    getWorkspaceFolders: jest.fn(),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    getInheritStatements: jest.fn().mockReturnValue([]),
                    getExportedFunctionNames: jest.fn().mockReturnValue([]),
                    findFunctionLocation: jest.fn().mockReturnValue(undefined),
                    resolveVisibleVariableLocation: visibleVariableSpy
                },
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:\\workspace\\std\\room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(1, 5, 1, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:\\workspace\\std\\room.c'),
                            new vscode.Range(1, 5, 1, 9)
                        ),
                        document: createTextDocument('D:\\workspace\\std\\room.c', 'void init() {}\n'),
                        sourceLabel: 'D:\\workspace\\std\\room.c'
                    }]
                })
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 6 }
        });

        expect(definition).toEqual([qualifierLocation]);
        expect(visibleVariableSpy).toHaveBeenCalled();
    });

    test('definition service does not resolve scoped room::init(init) when the position is on the argument', async () => {
        const document = createTextDocument('D:\\workspace\\room.c', 'void demo() {\n    room::init(init);\n}\n');
        const argumentLocation = {
            uri: document.uri.toString(),
            range: {
                start: { line: 1, character: 15 },
                end: { line: 1, character: 19 }
            }
        };
        const visibleVariableSpy = jest.fn((_: vscode.TextDocument, variableName: string) => (
            variableName === 'init' ? argumentLocation : undefined
        ));
        const service = createDefinitionService(
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            { inferObjectAccess: jest.fn().mockResolvedValue(undefined) } as any,
            undefined,
            undefined,
            {
                host: {
                    onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                    openTextDocument: jest.fn(),
                    findFiles: jest.fn(),
                    getWorkspaceFolder: jest.fn(),
                    getWorkspaceFolders: jest.fn(),
                    fileExists: jest.fn().mockReturnValue(false)
                },
                semanticAdapter: {
                    getIncludeStatements: jest.fn().mockReturnValue([]),
                    getInheritStatements: jest.fn().mockReturnValue([]),
                    getExportedFunctionNames: jest.fn().mockReturnValue([]),
                    findFunctionLocation: jest.fn().mockReturnValue(undefined),
                    resolveVisibleVariableLocation: visibleVariableSpy
                },
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:\\workspace\\std\\room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(1, 5, 1, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:\\workspace\\std\\room.c'),
                            new vscode.Range(1, 5, 1, 9)
                        ),
                        document: createTextDocument('D:\\workspace\\std\\room.c', 'void init() {}\n'),
                        sourceLabel: 'D:\\workspace\\std\\room.c'
                    }]
                })
            }
        );

        const definition = await service.provideDefinition({
            context: {
                document: document as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 1, character: 17 }
        });

        expect(definition).toEqual([argumentLocation]);
        expect(visibleVariableSpy).toHaveBeenCalled();
    });
});
