import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../../contracts/LanguageCapabilityContext';
import type { LanguageDocument } from '../../../contracts/LanguageDocument';
import type { LanguagePosition, LanguageRange } from '../../../contracts/LanguagePosition';
import type { ScopedMethodResolver } from '../../../../objectInference/ScopedMethodResolver';
import { ASTManager } from '../../../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { configureTargetMethodLookupAnalysisService } from '../../../../targetMethodLookup';
import {
    ObjectInferenceLanguageHoverService,
    type LanguageHoverService
} from '../LanguageHoverService';
import { UnifiedLanguageHoverService } from '../UnifiedLanguageHoverService';
import {
    AstBackedLanguageDefinitionService,
    type LanguageDefinitionService
} from '../LanguageDefinitionService';
import {
    AstBackedLanguageReferenceService,
    type LanguageReferenceService
} from '../LanguageReferenceService';
import {
    AstBackedLanguageRenameService,
    type LanguageRenameService
} from '../LanguageRenameService';
import {
    AstBackedLanguageSymbolService,
    type LanguageSymbolService
} from '../LanguageSymbolService';
import { configureScopedMethodIdentifierAnalysisService } from '../ScopedMethodIdentifierSupport';

interface RangeCapableLanguageDocument extends LanguageDocument {
    getText(range?: LanguageRange): string;
    getWordRangeAtPosition(position: LanguagePosition): LanguageRange | undefined;
    lineAt?(line: number): { text: string };
}

function createContext(document: RangeCapableLanguageDocument): LanguageCapabilityContext {
    return {
        document,
        workspace: {
            workspaceRoot: 'D:/workspace'
        },
        mode: 'lsp'
    };
}

function createDocument(source: string): RangeCapableLanguageDocument {
    return {
        uri: 'file:///D:/workspace/test.c',
        version: 1,
        getText: (range?: LanguageRange) => {
            if (!range) {
                return source;
            }

            return source.slice(range.start.character, range.end.character);
        },
        getWordRangeAtPosition: (position: LanguagePosition) => {
            const isWordCharacter = (char: string | undefined) => Boolean(char && /[A-Za-z0-9_]/.test(char));
            let start = position.character;
            while (start > 0 && isWordCharacter(source[start - 1])) {
                start -= 1;
            }

            let end = position.character;
            while (end < source.length && isWordCharacter(source[end])) {
                end += 1;
            }

            if (start === end) {
                return undefined;
            }

            return {
                start: { line: 0, character: start },
                end: { line: 0, character: end }
            };
        },
        lineAt: (_line: number) => ({ text: source })
    };
}

function createScopedMethodResolverStub(
    resolution: Awaited<ReturnType<ScopedMethodResolver['resolveCallAt']>>
): Pick<ScopedMethodResolver, 'resolveCallAt'> {
    return {
        resolveCallAt: jest.fn().mockResolvedValue(resolution)
    };
}

function createVsCodeTextDocument(filePath: string, source: string): vscode.TextDocument {
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

function createCallableDoc(name: string, label: string, summary: string) {
    return {
        name,
        declarationKey: `${name}-declaration`,
        signatures: [{
            label,
            parameters: [],
            isVariadic: false
        }],
        summary,
        sourceKind: 'scopedMethod' as const
    };
}

describe('navigation services', () => {
    const analysisService = DocumentSemanticSnapshotService.getInstance();

    beforeEach(() => {
        configureScopedMethodIdentifierAnalysisService(analysisService);
        configureTargetMethodLookupAnalysisService(analysisService);
    });

    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        DocumentSemanticSnapshotService.getInstance().clear();
        configureScopedMethodIdentifierAnalysisService(undefined);
        configureTargetMethodLookupAnalysisService(undefined);
    });

    test('hover service can operate on host-agnostic documents via injected boundaries', async () => {
        const document = createDocument('target->query_name();');
        const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
            {} as any,
            undefined,
            undefined,
            undefined,
            {
                objectAccessProvider: {
                    inferObjectAccess: jest.fn().mockResolvedValue({
                        memberName: 'query_name',
                        inference: {
                            status: 'resolved',
                            candidates: [{ path: '/obj/npc.c', source: 'literal' }]
                        }
                    })
                },
                methodResolver: {
                    findMethod: jest.fn().mockResolvedValue({
                        path: '/obj/npc.c',
                        documentText: [
                            '/**',
                            ' * @brief 返回名字。',
                            ' */',
                            'string query_name() {',
                            '}'
                        ].join('\n')
                    })
                }
            } as any
        );

        const hover = await service.provideHover({
            context: createContext(document),
            position: { line: 0, character: 10 }
        });

        expect(hover).toBeDefined();
        expect(hover?.contents[0].value).toContain('string query_name()');
        expect(hover?.contents[0].value).toContain('返回名字');
    });

    test('hover service can render bare ::create() docs through injected scoped boundaries', async () => {
        const document = createVsCodeTextDocument('D:/workspace/test.c', '::create();');
        const targetDocument = createVsCodeTextDocument(
            'D:/workspace/std/base_room.c',
            [
                '/**',
                ' * @brief 父类创建。',
                ' */',
                'void create() {}'
            ].join('\n')
        );
        const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
            {} as any,
            undefined,
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    methodName: 'create',
                    targets: [{
                        path: 'D:/workspace/std/base_room.c',
                        methodName: 'create',
                        declarationRange: new vscode.Range(3, 5, 3, 11),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/base_room.c'),
                            new vscode.Range(3, 5, 3, 11)
                        ),
                        document: targetDocument,
                        sourceLabel: 'D:/workspace/std/base_room.c'
                    }]
                }),
                objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) },
                documentationService: {
                    getDocForDeclaration: jest.fn().mockReturnValue(
                        createCallableDoc('create', 'void create()', '父类创建')
                    )
                } as any
            } as any
        );

        const hover = await service.provideHover({
            context: createContext(document as any),
            position: { line: 0, character: 4 }
        });

        expect(hover?.contents[0].value).toContain('父类创建');
        expect(hover?.contents[0].value).toContain('void create()');
    });

    test('hover service can render room::init() docs from the uniquely matched named scope branch', async () => {
        const document = createVsCodeTextDocument('D:/workspace/test.c', 'room::init();');
        const targetDocument = createVsCodeTextDocument(
            'D:/workspace/std/room.c',
            [
                '/**',
                ' * @brief 房间初始化。',
                ' */',
                'void init() {}'
            ].join('\n')
        );
        const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
            {} as any,
            undefined,
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:/workspace/std/room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(3, 5, 3, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/room.c'),
                            new vscode.Range(3, 5, 3, 9)
                        ),
                        document: targetDocument,
                        sourceLabel: 'D:/workspace/std/room.c'
                    }]
                }),
                objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) },
                documentationService: {
                    getDocForDeclaration: jest.fn().mockReturnValue(
                        createCallableDoc('init', 'void init()', '房间初始化')
                    )
                } as any
            } as any
        );

        const hover = await service.provideHover({
            context: createContext(document as any),
            position: { line: 0, character: 8 }
        });

        expect(hover?.contents[0].value).toContain('房间初始化');
        expect(hover?.contents[0].value).toContain('void init()');
    });

    test('hover service can render multiline ::create() docs when hovering the method identifier', async () => {
        const document = createVsCodeTextDocument('D:/workspace/test.c', '::\ncreate();');
        const targetDocument = createVsCodeTextDocument(
            'D:/workspace/std/base_room.c',
            [
                '/**',
                ' * @brief 父类创建。',
                ' */',
                'void create() {}'
            ].join('\n')
        );
        const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
            {} as any,
            undefined,
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    methodName: 'create',
                    targets: [{
                        path: 'D:/workspace/std/base_room.c',
                        methodName: 'create',
                        declarationRange: new vscode.Range(3, 5, 3, 11),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/base_room.c'),
                            new vscode.Range(3, 5, 3, 11)
                        ),
                        document: targetDocument,
                        sourceLabel: 'D:/workspace/std/base_room.c'
                    }]
                }),
                objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) },
                documentationService: {
                    getDocForDeclaration: jest.fn().mockReturnValue(
                        createCallableDoc('create', 'void create()', '父类创建')
                    )
                } as any
            } as any
        );

        const hover = await service.provideHover({
            context: createContext(document as any),
            position: { line: 1, character: 2 }
        });

        expect(hover?.contents[0].value).toContain('父类创建');
        expect(hover?.contents[0].value).toContain('void create()');
    });

    test.each([
        'unknown',
        'unsupported'
    ] as const)('hover service delegates scoped identifier hit-testing to the shared helper for %s', async (status) => {
        let hoverPromise: ReturnType<LanguageHoverService['provideHover']> | undefined;
        const isOnScopedMethodIdentifier = jest.fn().mockReturnValue(true);

        jest.isolateModules(() => {
            jest.doMock('../ScopedMethodIdentifierSupport', () => ({
                isOnScopedMethodIdentifier
            }));

            const {
                ObjectInferenceLanguageHoverService: IsolatedHoverService
            } = require('../LanguageHoverService') as typeof import('../LanguageHoverService');
            const document = createVsCodeTextDocument('D:/workspace/test.c', 'room::init();');
            const targetDocument = createVsCodeTextDocument(
                'D:/workspace/std/room.c',
                [
                    '/**',
                    ' * @brief 房间初始化。',
                    ' */',
                    'void init() {}'
                ].join('\n')
            );

            const service: LanguageHoverService = new IsolatedHoverService(
                {} as any,
                undefined,
                {} as any,
                undefined,
                {
                    scopedMethodResolver: createScopedMethodResolverStub({
                        status,
                        qualifier: 'room',
                        methodName: 'init',
                        targets: [{
                            path: 'D:/workspace/std/room.c',
                            methodName: 'init',
                            declarationRange: new vscode.Range(3, 5, 3, 9),
                            location: new vscode.Location(
                                vscode.Uri.file('D:/workspace/std/room.c'),
                                new vscode.Range(3, 5, 3, 9)
                            ),
                            document: targetDocument,
                            sourceLabel: 'D:/workspace/std/room.c'
                        }]
                    }),
                    objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) },
                    documentationService: {
                        getDocForDeclaration: jest.fn().mockReturnValue(
                            createCallableDoc('init', 'void init()', '房间初始化')
                        )
                    } as any
                } as any
            );

            hoverPromise = service.provideHover({
                context: createContext(document as any),
                position: { line: 0, character: 8 }
            });
        });

        const hover = await hoverPromise;

        expect(isOnScopedMethodIdentifier).toHaveBeenCalledTimes(1);
        expect(hover).toBeUndefined();
    });

    test('hover service does not render room::init(arg) scoped docs when hovering the qualifier', async () => {
        const document = createVsCodeTextDocument('D:/workspace/test.c', 'room::init(arg);');
        const documentationService = {
            getDocForDeclaration: jest.fn().mockReturnValue(
                createCallableDoc('init', 'void init()', '房间初始化')
            )
        };
        const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
            {} as any,
            undefined,
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:/workspace/std/room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(3, 5, 3, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/room.c'),
                            new vscode.Range(3, 5, 3, 9)
                        ),
                        document: createVsCodeTextDocument('D:/workspace/std/room.c', 'void init() {}'),
                        sourceLabel: 'D:/workspace/std/room.c'
                    }]
                }),
                objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) },
                documentationService: documentationService as any
            } as any
        );

        const hover = await service.provideHover({
            context: createContext(document as any),
            position: { line: 0, character: 2 }
        });

        expect(hover).toBeUndefined();
        expect(documentationService.getDocForDeclaration).not.toHaveBeenCalled();
    });

    test('hover service does not render room::init(init) scoped docs when hovering the argument', async () => {
        const document = createVsCodeTextDocument('D:/workspace/test.c', 'room::init(init);');
        const documentationService = {
            getDocForDeclaration: jest.fn().mockReturnValue(
                createCallableDoc('init', 'void init()', '房间初始化')
            )
        };
        const service: LanguageHoverService = new ObjectInferenceLanguageHoverService(
            {} as any,
            undefined,
            undefined,
            undefined,
            {
                scopedMethodResolver: createScopedMethodResolverStub({
                    status: 'resolved',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: [{
                        path: 'D:/workspace/std/room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(3, 5, 3, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/room.c'),
                            new vscode.Range(3, 5, 3, 9)
                        ),
                        document: createVsCodeTextDocument('D:/workspace/std/room.c', 'void init() {}'),
                        sourceLabel: 'D:/workspace/std/room.c'
                    }]
                }),
                objectAccessProvider: { inferObjectAccess: jest.fn().mockResolvedValue(undefined) },
                documentationService: documentationService as any
            } as any
        );

        const hover = await service.provideHover({
            context: createContext(document as any),
            position: { line: 0, character: 13 }
        });

        expect(hover).toBeUndefined();
        expect(documentationService.getDocForDeclaration).not.toHaveBeenCalled();
    });

    test('unified hover service resolves macro hovers before other hover sources', async () => {
        const document = createDocument('USER_D');
        const macroHoverContent = { value: 'macro docs' };
        const service: LanguageHoverService = new UnifiedLanguageHoverService(
            {
                provideHover: jest.fn(async () => undefined)
            },
            {} as any,
            {
                getMacro: jest.fn(() => ({ name: 'USER_D', value: '/adm/user' })),
                getMacroHoverContent: jest.fn(() => macroHoverContent),
                canResolveMacro: jest.fn(async () => false)
            } as any,
            {
                efunHoverService: {
                    provideHover: jest.fn(async () => undefined)
                }
            }
        );

        const hover = await service.provideHover({
            context: createContext(document),
            position: { line: 0, character: 2 }
        });

        expect(hover).toEqual({
            contents: [
                {
                    kind: 'markdown',
                    value: 'macro docs'
                }
            ],
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 6 }
            }
        });
    });

    test('unified hover service falls back to efun docs when macro and object hovers do not resolve', async () => {
        const document = createDocument('allocate');
        const service: LanguageHoverService = new UnifiedLanguageHoverService(
            {
                provideHover: jest.fn(async () => undefined)
            },
            {} as any,
            {
                getMacro: jest.fn(() => undefined),
                getMacroHoverContent: jest.fn(),
                canResolveMacro: jest.fn(async () => false)
            } as any,
            {
                efunHoverService: {
                    provideHover: jest.fn(async () => ({
                        contents: [
                            {
                                kind: 'markdown',
                                value: 'efun docs'
                            }
                        ]
                    }))
                }
            }
        );

        const hover = await service.provideHover({
            context: createContext(document),
            position: { line: 0, character: 2 }
        });

        expect(hover).toEqual({
            contents: [
                {
                    kind: 'markdown',
                    value: 'efun docs'
                }
            ]
        });
    });

    test('definition service can operate on host-agnostic documents via injected boundaries', async () => {
        const source = 'local_call();';
        const document = createDocument(source);
        const service: LanguageDefinitionService = new AstBackedLanguageDefinitionService(
            {} as any,
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            {
                inferObjectAccess: jest.fn().mockResolvedValue(undefined)
            } as any,
            undefined,
            undefined,
            {
                analysisService,
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
                    getExportedFunctionNames: jest.fn().mockReturnValue(['local_call']),
                    findFunctionLocation: jest.fn().mockReturnValue({
                        uri: document.uri,
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 10 }
                        }
                    }),
                    resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined),
                    findInheritedVariableLocation: jest.fn().mockReturnValue(undefined)
                }
            } as any
        );

        const definition = await service.provideDefinition({
            context: createContext(document),
            position: { line: 0, character: 2 }
        });

        expect(definition).toEqual([
            {
                uri: 'file:///D:/workspace/test.c',
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 }
                }
            }
        ]);
    });

    test('reference service can operate on host-agnostic documents via injected boundaries', async () => {
        const document = createDocument('int round; round += 1;');
        const service: LanguageReferenceService = new AstBackedLanguageReferenceService({
            analysisService,
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            }
        } as any);

        const references = await service.provideReferences({
            context: createContext(document),
            position: { line: 0, character: 12 },
            includeDeclaration: false
        });

        expect(references).toEqual([
            {
                uri: 'file:///D:/workspace/test.c',
                range: {
                    start: { line: 0, character: 11 },
                    end: { line: 0, character: 16 }
                }
            }
        ]);
    });

    test('rename service can operate on host-agnostic documents via injected boundaries', async () => {
        const document = createDocument('int round; round += 1;');
        const service: LanguageRenameService = new AstBackedLanguageRenameService({
            analysisService,
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            }
        } as any);

        const prepared = await service.prepareRename({
            context: createContext(document),
            position: { line: 0, character: 12 }
        });
        const edit = await service.provideRenameEdits({
            context: createContext(document),
            position: { line: 0, character: 12 },
            newName: 'turn'
        });

        expect(prepared).toEqual({
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 9 }
            },
            placeholder: 'round'
        });
        expect(edit).toEqual({
            changes: {
                'file:///D:/workspace/test.c': [
                    {
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 9 }
                        },
                        newText: 'turn'
                    },
                    {
                        range: {
                            start: { line: 0, character: 11 },
                            end: { line: 0, character: 16 }
                        },
                        newText: 'turn'
                    }
                ]
            }
        });
    });

    test('reference service appends inherited relation matches to current-file results', async () => {
        const document = createDocument('int round; round += 1;');
        const inheritedRelationService = {
            collectInheritedReferences: jest.fn().mockImplementation(async (_targetDocument, _position, options) => {
                expect(options).toEqual({ includeDeclaration: false });
                return [
                    {
                        uri: 'file:///D:/workspace/alpha.c',
                        range: {
                            start: { line: 1, character: 0 },
                            end: { line: 1, character: 5 }
                        }
                    },
                    {
                        uri: 'file:///D:/workspace/beta.c',
                        range: {
                            start: { line: 3, character: 2 },
                            end: { line: 3, character: 7 }
                        }
                    }
                ];
            })
        };
        const service: LanguageReferenceService = new AstBackedLanguageReferenceService({
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);

        const references = await service.provideReferences({
            context: createContext(document),
            position: { line: 0, character: 12 },
            includeDeclaration: false
        });

        expect(inheritedRelationService.collectInheritedReferences).toHaveBeenCalledTimes(1);
        expect(references).toHaveLength(3);
        expect(references).toEqual(expect.arrayContaining([
            {
                uri: 'file:///D:/workspace/test.c',
                range: {
                    start: { line: 0, character: 11 },
                    end: { line: 0, character: 16 }
                }
            },
            {
                uri: 'file:///D:/workspace/alpha.c',
                range: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 5 }
                }
            },
            {
                uri: 'file:///D:/workspace/beta.c',
                range: {
                    start: { line: 3, character: 2 },
                    end: { line: 3, character: 7 }
                }
            }
        ]));
    });

    test('reference service preserves current-file references when inherited relation returns no matches', async () => {
        const document = createDocument('int round; round += 1;');
        const inheritedRelationService = {
            collectInheritedReferences: jest.fn().mockImplementation(async (_targetDocument, _position, options) => {
                expect(options).toEqual({ includeDeclaration: false });
                return [];
            })
        };
        const service: LanguageReferenceService = new AstBackedLanguageReferenceService({
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);

        const references = await service.provideReferences({
            context: createContext(document),
            position: { line: 0, character: 12 },
            includeDeclaration: false
        });

        expect(inheritedRelationService.collectInheritedReferences).toHaveBeenCalledTimes(1);
        expect(references).toEqual([
            {
                uri: 'file:///D:/workspace/test.c',
                range: {
                    start: { line: 0, character: 11 },
                    end: { line: 0, character: 16 }
                }
            }
        ]);
    });

    test('reference service dedupes current-file references that are also returned by inherited relation matches', async () => {
        const document = createDocument('int round; round += 1;');
        const inheritedRelationService = {
            collectInheritedReferences: jest.fn(async () => [
                {
                    uri: 'file:///D:/workspace/test.c',
                    range: {
                        start: { line: 0, character: 11 },
                        end: { line: 0, character: 16 }
                    }
                }
            ])
        };
        const service: LanguageReferenceService = new AstBackedLanguageReferenceService({
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);

        const references = await service.provideReferences({
            context: createContext(document),
            position: { line: 0, character: 12 }
        });

        expect(references).toEqual([
            {
                uri: 'file:///D:/workspace/test.c',
                range: {
                    start: { line: 0, character: 11 },
                    end: { line: 0, character: 16 }
                }
            }
        ]);
    });

    test('rename service keeps prepareRename undefined when inherited relation rejects function rename', async () => {
        const document = createDocument('int query_id() { return 1; }');
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'unsupported' }),
            buildInheritedRenameEdits: jest.fn()
        };
        const service: LanguageRenameService = new AstBackedLanguageRenameService({
            analysisService,
            inheritedRelationService
        } as any);

        const prepared = await service.prepareRename({
            context: createContext(document),
            position: { line: 0, character: 6 }
        });

        expect(inheritedRelationService.classifyRenameTarget).toHaveBeenCalledTimes(1);
        expect(prepared).toBeUndefined();
    });

    test('rename service preserves current-file rename results for current-file-only targets', async () => {
        const document = createDocument('int round; round += 1;');
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'current-file-only' }),
            buildInheritedRenameEdits: jest.fn()
        };
        const service: LanguageRenameService = new AstBackedLanguageRenameService({
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);

        const prepared = await service.prepareRename({
            context: createContext(document),
            position: { line: 0, character: 12 }
        });
        const edit = await service.provideRenameEdits({
            context: createContext(document),
            position: { line: 0, character: 12 },
            newName: 'turn'
        });

        expect(inheritedRelationService.classifyRenameTarget).toHaveBeenCalledTimes(2);
        expect(inheritedRelationService.buildInheritedRenameEdits).not.toHaveBeenCalled();
        expect(prepared).toEqual({
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 9 }
            },
            placeholder: 'round'
        });
        expect(edit).toEqual({
            changes: {
                'file:///D:/workspace/test.c': [
                    {
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 9 }
                        },
                        newText: 'turn'
                    },
                    {
                        range: {
                            start: { line: 0, character: 11 },
                            end: { line: 0, character: 16 }
                        },
                        newText: 'turn'
                    }
                ]
            }
        });
    });

    test('rename service appends inherited file-global edits while preserving current-file edits', async () => {
        const document = createDocument('int round; round += 1;');
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'file-global' }),
            buildInheritedRenameEdits: jest.fn().mockResolvedValue({
                'file:///D:/workspace/base.c': [
                    {
                        range: {
                            start: { line: 1, character: 0 },
                            end: { line: 1, character: 5 }
                        },
                        newText: 'turn'
                    }
                ]
            })
        };
        const service: LanguageRenameService = new AstBackedLanguageRenameService({
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);

        const edit = await service.provideRenameEdits({
            context: createContext(document),
            position: { line: 0, character: 12 },
            newName: 'turn'
        });

        expect(inheritedRelationService.buildInheritedRenameEdits).toHaveBeenCalledTimes(1);
        expect(edit).toEqual({
            changes: {
                'file:///D:/workspace/test.c': [
                    {
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 9 }
                        },
                        newText: 'turn'
                    },
                    {
                        range: {
                            start: { line: 0, character: 11 },
                            end: { line: 0, character: 16 }
                        },
                        newText: 'turn'
                    }
                ],
                'file:///D:/workspace/base.c': [
                    {
                        range: {
                            start: { line: 1, character: 0 },
                            end: { line: 1, character: 5 }
                        },
                        newText: 'turn'
                    }
                ]
            }
        });
    });

    test('rename service keeps current-file file-global edits when inherited expansion downgrades to empty', async () => {
        const document = createDocument('int round; round += 1;');
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'file-global' }),
            buildInheritedRenameEdits: jest.fn().mockResolvedValue({})
        };
        const service: LanguageRenameService = new AstBackedLanguageRenameService({
            analysisService,
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 9 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 0, character: 4 },
                                end: { line: 0, character: 9 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 0, character: 11 },
                                end: { line: 0, character: 16 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);

        const edit = await service.provideRenameEdits({
            context: createContext(document),
            position: { line: 0, character: 12 },
            newName: 'turn'
        });

        expect(edit).toEqual({
            changes: {
                'file:///D:/workspace/test.c': [
                    {
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 9 }
                        },
                        newText: 'turn'
                    },
                    {
                        range: {
                            start: { line: 0, character: 11 },
                            end: { line: 0, character: 16 }
                        },
                        newText: 'turn'
                    }
                ]
            }
        });
    });

    test('symbol service can operate on host-agnostic documents via injected boundaries', async () => {
        const document = createDocument('class Payload { }');
        const service: LanguageSymbolService = new AstBackedLanguageSymbolService({
            snapshotAdapter: {
                getDocumentSymbolsSnapshot: jest.fn().mockReturnValue({
                    typeDefinitions: [
                        {
                            name: 'Payload',
                            kind: 'class',
                            range: {
                                start: { line: 0, character: 0 },
                                end: { line: 0, character: 10 }
                            },
                            members: [
                                {
                                    name: 'query_id',
                                    dataType: 'string',
                                    parameters: [],
                                    range: {
                                        start: { line: 0, character: 11 },
                                        end: { line: 0, character: 19 }
                                    }
                                },
                                {
                                    name: 'hp',
                                    dataType: 'int',
                                    range: {
                                        start: { line: 0, character: 20 },
                                        end: { line: 0, character: 22 }
                                    }
                                }
                            ]
                        }
                    ],
                    exportedFunctions: [
                        {
                            name: 'alpha',
                            returnType: 'void',
                            range: {
                                start: { line: 1, character: 0 },
                                end: { line: 1, character: 5 }
                            }
                        }
                    ]
                })
            }
        } as any);

        const symbols = await service.provideDocumentSymbols({
            context: createContext(document)
        });

        expect(symbols).toEqual([
            {
                name: 'Payload',
                detail: 'class',
                kind: 'class',
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 }
                },
                selectionRange: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 }
                },
                children: [
                    {
                        name: 'query_id',
                        detail: 'string',
                        kind: 'method',
                        range: {
                            start: { line: 0, character: 11 },
                            end: { line: 0, character: 19 }
                        },
                        selectionRange: {
                            start: { line: 0, character: 11 },
                            end: { line: 0, character: 19 }
                        }
                    },
                    {
                        name: 'hp',
                        detail: 'int',
                        kind: 'field',
                        range: {
                            start: { line: 0, character: 20 },
                            end: { line: 0, character: 22 }
                        },
                        selectionRange: {
                            start: { line: 0, character: 20 },
                            end: { line: 0, character: 22 }
                        }
                    }
                ]
            },
            {
                name: 'alpha',
                detail: 'void',
                kind: 'function',
                range: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 5 }
                },
                selectionRange: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 5 }
                }
            }
        ]);
    });
});
