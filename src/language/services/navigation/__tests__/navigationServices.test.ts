import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { LanguageCapabilityContext } from '../../../contracts/LanguageCapabilityContext';
import type { LanguageDocument } from '../../../contracts/LanguageDocument';
import type { LanguagePosition, LanguageRange } from '../../../contracts/LanguagePosition';
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

describe('navigation services', () => {
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
