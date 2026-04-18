import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import {
    CodeActionKind,
    type CodeActionParams,
    Disposable,
    SymbolKind,
    TextDocumentSyncKind,
    type Connection,
    type DefinitionParams,
    type DocumentSymbolParams,
    type DocumentSymbolResult,
    type Hover,
    type HoverParams,
    type InitializeParams,
    type InitializeResult,
    type Location,
    type PrepareRenameParams,
    type ReferenceParams,
    type RenameParams,
    type WorkspaceEdit
} from 'vscode-languageserver/node';
import * as vscode from 'vscode';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { ASTManager } from '../../../ast/astManager';
import { SymbolTable, SymbolType } from '../../../ast/symbolTable';
import type { LanguageLocation, LanguageRange } from '../../../language/contracts/LanguagePosition';
import type { LanguageMarkupContent } from '../../../language/contracts/LanguageMarkup';
import { toLspLocation, toLspMarkupContent, toLspPosition, toLspRange } from '../../../language/adapters/lsp/conversions';
import {
    ObjectInferenceLanguageHoverService,
    type LanguageNavigationService
} from '../../../language/services/navigation/LanguageHoverService';
import {
    AstBackedLanguageReferenceService,
    type LanguageReferenceService
} from '../../../language/services/navigation/LanguageReferenceService';
import {
    AstBackedLanguageRenameService,
    type LanguageRenameService
} from '../../../language/services/navigation/LanguageRenameService';
import type { LanguageSymbolService } from '../../../language/services/navigation/LanguageSymbolService';
import { registerCapabilities, type ServerConnection } from '../bootstrap/registerCapabilities';
import { registerDefinitionHandler } from '../handlers/navigation/registerDefinitionHandler';
import { registerDocumentSymbolHandler } from '../handlers/navigation/registerDocumentSymbolHandler';
import { registerHoverHandler } from '../handlers/navigation/registerHoverHandler';
import { registerReferencesHandler } from '../handlers/navigation/registerReferencesHandler';
import { registerRenameHandler } from '../handlers/navigation/registerRenameHandler';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

type NavigationHandlerService =
    LanguageNavigationService &
    LanguageReferenceService &
    LanguageRenameService &
    LanguageSymbolService;

interface NavigationConnection extends ServerConnection {
    onHover: jest.Mock;
    onDefinition: jest.Mock;
    onReferences: jest.Mock;
    onPrepareRename: jest.Mock;
    onRenameRequest: jest.Mock;
    onDocumentSymbol: jest.Mock;
    onCodeAction: jest.Mock;
}

describe('lsp conversions', () => {
    test('shared range/location conversion', () => {
        const position = { line: 1, character: 2 };
        const range: LanguageRange = {
            start: position,
            end: { line: 3, character: 4 }
        };
        const location: LanguageLocation = {
            uri: 'file:///navigation.c',
            range
        };
        const markup: LanguageMarkupContent = {
            kind: 'markdown',
            value: '### Symbol docs'
        };

        expect(toLspPosition(position)).toEqual({
            line: 1,
            character: 2
        });
        expect(toLspRange(range)).toEqual({
            start: { line: 1, character: 2 },
            end: { line: 3, character: 4 }
        });
        expect(toLspLocation(location)).toEqual({
            uri: 'file:///navigation.c',
            range: {
                start: { line: 1, character: 2 },
                end: { line: 3, character: 4 }
            }
        });
        expect(toLspMarkupContent(markup)).toEqual({
            kind: 'markdown',
            value: '### Symbol docs'
        });
    });
});

describe('navigation handlers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.resetModules();
    });

    test('registerHoverHandler delegates through the shared navigation service and converts hover content', async () => {
        let hoverHandler: ((params: HoverParams) => Promise<Hover | undefined> | Hover | undefined) | undefined;
        const connection = createNavigationConnection({
            onHover: jest.fn(handler => {
                hoverHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const navigationService: NavigationHandlerService = {
            provideHover: jest.fn(async (request) => {
                expect(request.position).toEqual({ line: 1, character: 4 });
                expect(request.context.workspace.workspaceRoot).toBe('D:/workspace');
                expect(request.context.workspace.services?.navigationService).toBe(navigationService);
                expect(request.context.document.uri.toString()).toBe('file:///D:/workspace/nav.c');
                expect(request.context.document.getText()).toBe('int main() {\n    call_other();\n}');

                return {
                    contents: [
                        {
                            kind: 'markdown',
                            value: '### call_other'
                        }
                    ],
                    range: {
                        start: { line: 1, character: 4 },
                        end: { line: 1, character: 14 }
                    }
                };
            }),
            provideDefinition: jest.fn(async () => []),
            provideReferences: jest.fn(async () => []),
            prepareRename: jest.fn(async () => undefined),
            provideRenameEdits: jest.fn(async () => ({ changes: {} })),
            provideDocumentSymbols: jest.fn(async () => [])
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 2, 'int main() {\n    call_other();\n}');

        registerHoverHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const hover = await hoverHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 1, character: 4 }
        } as HoverParams);

        expect(navigationService.provideHover).toHaveBeenCalledTimes(1);
        expect(hover).toEqual({
            contents: {
                kind: 'markdown',
                value: '### call_other'
            },
            range: {
                start: { line: 1, character: 4 },
                end: { line: 1, character: 14 }
            }
        });
    });

    test('registerHoverHandler supports the real hover service seam, including getWordRangeAtPosition', async () => {
        let hoverHandler: ((params: HoverParams) => Promise<Hover | undefined> | Hover | undefined) | undefined;
        const connection = createNavigationConnection({
            onHover: jest.fn(handler => {
                hoverHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const hoverService = new ObjectInferenceLanguageHoverService(
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
        const navigationService = {
            ...createNavigationServiceStub(),
            provideHover: hoverService.provideHover.bind(hoverService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'target->query_name();');

        registerHoverHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const hover = await hoverHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 10 }
        } as HoverParams);

        expect(hover).toEqual(expect.objectContaining({
            contents: expect.objectContaining({
                kind: 'markdown',
                value: expect.stringContaining('string query_name()')
            })
        }));
    });

    test('registerDefinitionHandler converts language locations to LSP locations', async () => {
        let definitionHandler:
            | ((params: DefinitionParams) => Promise<Location | Location[] | undefined> | Location | Location[] | undefined)
            | undefined;
        const connection = createNavigationConnection({
            onDefinition: jest.fn(handler => {
                definitionHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const navigationService = createNavigationServiceStub({
            provideDefinition: jest.fn(async (request) => {
                expect(request.position).toEqual({ line: 0, character: 5 });
                return [
                    {
                        uri: 'file:///D:/workspace/include/test.h',
                        range: {
                            start: { line: 2, character: 0 },
                            end: { line: 2, character: 8 }
                        }
                    }
                ];
            })
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'inherit TEST;');

        registerDefinitionHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const locations = await definitionHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 5 }
        } as DefinitionParams);

        expect(navigationService.provideDefinition).toHaveBeenCalledTimes(1);
        expect(locations).toEqual({
            uri: 'file:///D:/workspace/include/test.h',
            range: {
                start: { line: 2, character: 0 },
                end: { line: 2, character: 8 }
            }
        });
    });

    test('registerReferencesHandler preserves includeDeclaration and returns LSP locations', async () => {
        let referencesHandler: ((params: ReferenceParams) => Promise<Location[]> | Location[]) | undefined;
        const connection = createNavigationConnection({
            onReferences: jest.fn(handler => {
                referencesHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const navigationService = createNavigationServiceStub({
            provideReferences: jest.fn(async (request) => {
                expect(request.includeDeclaration).toBe(false);
                return [
                    {
                        uri: 'file:///D:/workspace/nav.c',
                        range: {
                            start: { line: 1, character: 4 },
                            end: { line: 1, character: 8 }
                        }
                    }
                ];
            })
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int foo;\nfoo = 1;');

        registerReferencesHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const references = await referencesHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 1, character: 4 },
            context: {
                includeDeclaration: false
            }
        } as ReferenceParams);

        expect(navigationService.provideReferences).toHaveBeenCalledTimes(1);
        expect(references).toEqual([
            {
                uri: 'file:///D:/workspace/nav.c',
                range: {
                    start: { line: 1, character: 4 },
                    end: { line: 1, character: 8 }
                }
            }
        ]);
    });

    test('registerReferencesHandler can return multiple workspace locations from the real reference service seam', async () => {
        let referencesHandler: ((params: ReferenceParams) => Promise<Location[]> | Location[]) | undefined;
        const connection = createNavigationConnection({
            onReferences: jest.fn(handler => {
                referencesHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const inheritedRelationService = {
            collectInheritedReferences: jest.fn().mockImplementation(async (_targetDocument, _position, options) => {
                expect(options).toEqual({ includeDeclaration: false });
                return [
                    {
                        uri: 'file:///D:/workspace/rooms/a.c',
                        range: {
                            start: { line: 1, character: 0 },
                            end: { line: 1, character: 8 }
                        }
                    },
                    {
                        uri: 'file:///D:/workspace/rooms/b.c',
                        range: {
                            start: { line: 4, character: 2 },
                            end: { line: 4, character: 10 }
                        }
                    }
                ];
            })
        };
        const referenceService: LanguageReferenceService = new AstBackedLanguageReferenceService({
            inheritedRelationService
        } as any);
        const navigationService = {
            ...createNavigationServiceStub(),
            provideReferences: referenceService.provideReferences.bind(referenceService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int round; round += 1;');

        registerReferencesHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const references = await referencesHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 12 },
            context: {
                includeDeclaration: false
            }
        } as ReferenceParams);

        expect(inheritedRelationService.collectInheritedReferences).toHaveBeenCalledTimes(1);
        expect(references).toHaveLength(3);
        expect(references).toEqual(expect.arrayContaining([
            {
                uri: 'file:///D:/workspace/nav.c',
                range: {
                    start: { line: 0, character: 11 },
                    end: { line: 0, character: 16 }
                }
            },
            {
                uri: 'file:///D:/workspace/rooms/a.c',
                range: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 8 }
                }
            },
            {
                uri: 'file:///D:/workspace/rooms/b.c',
                range: {
                    start: { line: 4, character: 2 },
                    end: { line: 4, character: 10 }
                }
            }
        ]));
    });

    test('registerRenameHandler wires prepareRename and rename request through the shared rename service', async () => {
        let prepareRenameHandler:
            | ((params: PrepareRenameParams) => Promise<LanguageRange | { range: LanguageRange; placeholder?: string } | undefined> | LanguageRange | { range: LanguageRange; placeholder?: string } | undefined)
            | undefined;
        let renameHandler: ((params: RenameParams) => Promise<WorkspaceEdit> | WorkspaceEdit) | undefined;
        const connection = createNavigationConnection({
            onPrepareRename: jest.fn(handler => {
                prepareRenameHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onRenameRequest: jest.fn(handler => {
                renameHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const navigationService = createNavigationServiceStub({
            prepareRename: jest.fn(async (request) => {
                expect(request.position).toEqual({ line: 0, character: 4 });
                return {
                    range: {
                        start: { line: 0, character: 4 },
                        end: { line: 0, character: 7 }
                    },
                    placeholder: 'foo'
                };
            }),
            provideRenameEdits: jest.fn(async (request) => {
                expect(request.newName).toBe('bar');
                return {
                    changes: {
                        'file:///D:/workspace/nav.c': [
                            {
                                range: {
                                    start: { line: 0, character: 4 },
                                    end: { line: 0, character: 7 }
                                },
                                newText: 'bar'
                            }
                        ]
                    }
                };
            })
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int foo;');

        registerRenameHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const prepareResult = await prepareRenameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 4 }
        } as PrepareRenameParams);

        const renameResult = await renameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 4 },
            newName: 'bar'
        } as RenameParams);

        expect(navigationService.prepareRename).toHaveBeenCalledTimes(1);
        expect(navigationService.provideRenameEdits).toHaveBeenCalledTimes(1);
        expect(prepareResult).toEqual({
            range: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 7 }
            },
            placeholder: 'foo'
        });
        expect(renameResult).toEqual({
            changes: {
                'file:///D:/workspace/nav.c': [
                    {
                        newText: 'bar',
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 7 }
                        }
                    }
                ]
            }
        });
    });

    test('registerRenameHandler supports the real rename service seam, including word-range and position conversion', async () => {
        let prepareRenameHandler:
            | ((params: PrepareRenameParams) => Promise<LanguageRange | { range: LanguageRange; placeholder?: string } | undefined> | LanguageRange | { range: LanguageRange; placeholder?: string } | undefined)
            | undefined;
        let renameHandler: ((params: RenameParams) => Promise<WorkspaceEdit> | WorkspaceEdit) | undefined;
        const connection = createNavigationConnection({
            onPrepareRename: jest.fn(handler => {
                prepareRenameHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onRenameRequest: jest.fn(handler => {
                renameHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const renameService = new AstBackedLanguageRenameService();
        const navigationService = {
            ...createNavigationServiceStub(),
            prepareRename: renameService.prepareRename.bind(renameService),
            provideRenameEdits: renameService.provideRenameEdits.bind(renameService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });
        const parseDocumentSpy = jest.spyOn(ASTManager.getInstance(), 'parseDocument').mockImplementation((document) => {
            const symbolTable = new SymbolTable(document.uri.toString());
            const declarationRange = new vscode.Range(0, 4, 0, 9);
            symbolTable.addSymbol({
                name: 'round',
                type: SymbolType.VARIABLE,
                dataType: 'int',
                range: declarationRange,
                selectionRange: declarationRange,
                scope: symbolTable.getGlobalScope()
            });

            return {
                symbolTable,
                parsed: {
                    tokens: {
                        getTokens: () => [
                            {
                                channel: LPCLexer.DEFAULT_TOKEN_CHANNEL,
                                type: LPCLexer.Identifier,
                                text: 'round',
                                startIndex: 4,
                                stopIndex: 8
                            },
                            {
                                channel: LPCLexer.DEFAULT_TOKEN_CHANNEL,
                                type: LPCLexer.Identifier,
                                text: 'round',
                                startIndex: 11,
                                stopIndex: 15
                            }
                        ]
                    }
                }
            } as any;
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int round; round += 1;');

        registerRenameHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const prepareResult = await prepareRenameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 12 }
        } as PrepareRenameParams);

        const renameResult = await renameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 12 },
            newName: 'turn'
        } as RenameParams);

        expect(parseDocumentSpy).toHaveBeenCalled();
        expect(prepareResult).toEqual({
            range: {
                start: { line: 0, character: 11 },
                end: { line: 0, character: 16 }
            },
            placeholder: 'round'
        });
        expect(renameResult).toEqual({
            changes: {
                'file:///D:/workspace/nav.c': [
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

    test('registerRenameHandler returns undefined when the real rename service rejects function rename', async () => {
        let prepareRenameHandler:
            | ((params: PrepareRenameParams) => Promise<LanguageRange | { range: LanguageRange; placeholder?: string } | undefined> | LanguageRange | { range: LanguageRange; placeholder?: string } | undefined)
            | undefined;
        const connection = createNavigationConnection({
            onPrepareRename: jest.fn(handler => {
                prepareRenameHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onRenameRequest: jest.fn(handler => {
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'unsupported' }),
            buildInheritedRenameEdits: jest.fn()
        };
        const renameService = new AstBackedLanguageRenameService({
            inheritedRelationService
        } as any);
        const navigationService = {
            ...createNavigationServiceStub(),
            prepareRename: renameService.prepareRename.bind(renameService),
            provideRenameEdits: renameService.provideRenameEdits.bind(renameService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int query_id() { return 1; }');

        registerRenameHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const prepareResult = await prepareRenameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 6 }
        } as PrepareRenameParams);

        expect(inheritedRelationService.classifyRenameTarget).toHaveBeenCalledTimes(1);
        expect(prepareResult).toBeUndefined();
    });

    test('registerRenameHandler keeps real current-file prepareRename working on runtime shim documents', async () => {
        let prepareRenameHandler:
            | ((params: PrepareRenameParams) => Promise<LanguageRange | { range: LanguageRange; placeholder?: string } | undefined> | LanguageRange | { range: LanguageRange; placeholder?: string } | undefined)
            | undefined;
        const connection = createNavigationConnection({
            onPrepareRename: jest.fn((handler) => {
                prepareRenameHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onRenameRequest: jest.fn(() => Disposable.create(() => undefined))
        });
        const documentStore = new DocumentStore();
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'current-file-only' }),
            buildInheritedRenameEdits: jest.fn()
        };
        const renameService = new AstBackedLanguageRenameService({
            referenceResolver: {
                resolveReferences: jest.fn().mockReturnValue({
                    wordRange: {
                        start: { line: 2, character: 4 },
                        end: { line: 2, character: 12 }
                    },
                    matches: [
                        {
                            range: {
                                start: { line: 1, character: 8 },
                                end: { line: 1, character: 16 }
                            },
                            isDeclaration: true
                        },
                        {
                            range: {
                                start: { line: 2, character: 4 },
                                end: { line: 2, character: 12 }
                            },
                            isDeclaration: false
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);
        const navigationService = {
            ...createNavigationServiceStub(),
            prepareRename: renameService.prepareRename.bind(renameService),
            provideRenameEdits: renameService.provideRenameEdits.bind(renameService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open(
            'file:///D:/workspace/nav.c',
            1,
            'void demo() {\n    int local_hp = 1;\n    local_hp += 1;\n}'
        );

        registerRenameHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const prepareResult = await prepareRenameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 2, character: 6 }
        } as PrepareRenameParams);

        expect(inheritedRelationService.classifyRenameTarget).toHaveBeenCalledTimes(1);
        expect(prepareResult).toEqual({
            range: {
                start: { line: 2, character: 4 },
                end: { line: 2, character: 12 }
            },
            placeholder: 'local_hp'
        });
    });

    test('registerRenameHandler keeps current-file file-global edits when inherited expansion downgrades to empty', async () => {
        let renameHandler: ((params: RenameParams) => Promise<WorkspaceEdit> | WorkspaceEdit) | undefined;
        const connection = createNavigationConnection({
            onPrepareRename: jest.fn(handler => Disposable.create(() => undefined)),
            onRenameRequest: jest.fn(handler => {
                renameHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'file-global' }),
            buildInheritedRenameEdits: jest.fn().mockResolvedValue({})
        };
        const renameService = new AstBackedLanguageRenameService({
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
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);
        const navigationService = {
            ...createNavigationServiceStub(),
            prepareRename: renameService.prepareRename.bind(renameService),
            provideRenameEdits: renameService.provideRenameEdits.bind(renameService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int round;');

        registerRenameHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const renameResult = await renameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 5 },
            newName: 'turn'
        } as RenameParams);

        expect(inheritedRelationService.buildInheritedRenameEdits).toHaveBeenCalledTimes(1);
        expect(renameResult).toEqual({
            changes: {
                'file:///D:/workspace/nav.c': [
                    {
                        newText: 'turn',
                        range: {
                            start: { line: 0, character: 4 },
                            end: { line: 0, character: 9 }
                        }
                    }
                ]
            }
        });
    });

    test('registerRenameHandler can return multi-file workspace edits from the real inherited relation seam', async () => {
        let renameHandler: ((params: RenameParams) => Promise<WorkspaceEdit> | WorkspaceEdit) | undefined;
        const connection = createNavigationConnection({
            onPrepareRename: jest.fn(handler => Disposable.create(() => undefined)),
            onRenameRequest: jest.fn(handler => {
                renameHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const inheritedRelationService = {
            classifyRenameTarget: jest.fn().mockResolvedValue({ kind: 'file-global' }),
            buildInheritedRenameEdits: jest.fn().mockResolvedValue({
                'file:///D:/workspace/rooms/a.c': [
                    {
                        range: {
                            start: { line: 1, character: 0 },
                            end: { line: 1, character: 8 }
                        },
                        newText: 'turn'
                    }
                ],
                'file:///D:/workspace/rooms/b.c': [
                    {
                        range: {
                            start: { line: 4, character: 2 },
                            end: { line: 4, character: 10 }
                        },
                        newText: 'turn'
                    }
                ]
            })
        };
        const renameService = new AstBackedLanguageRenameService({
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
                        }
                    ]
                })
            },
            inheritedRelationService
        } as any);
        const navigationService = {
            ...createNavigationServiceStub(),
            prepareRename: renameService.prepareRename.bind(renameService),
            provideRenameEdits: renameService.provideRenameEdits.bind(renameService)
        };
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'int round;');

        registerRenameHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const renameResult = await renameHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            position: { line: 0, character: 5 },
            newName: 'turn'
        } as RenameParams);

        expect(inheritedRelationService.buildInheritedRenameEdits).toHaveBeenCalledTimes(1);
        expect(Object.keys(renameResult?.changes || {})).toHaveLength(3);
        expect(Object.keys(renameResult?.changes || {})).toEqual(expect.arrayContaining([
            'file:///D:/workspace/nav.c',
            'file:///D:/workspace/rooms/a.c',
            'file:///D:/workspace/rooms/b.c'
        ]));
        expect(renameResult?.changes?.['file:///D:/workspace/nav.c']).toEqual([
            {
                newText: 'turn',
                range: {
                    start: { line: 0, character: 4 },
                    end: { line: 0, character: 9 }
                }
            }
        ]);
        expect(renameResult?.changes?.['file:///D:/workspace/rooms/a.c']).toEqual([
            {
                newText: 'turn',
                range: {
                    start: { line: 1, character: 0 },
                    end: { line: 1, character: 8 }
                }
            }
        ]);
        expect(renameResult?.changes?.['file:///D:/workspace/rooms/b.c']).toEqual([
            {
                newText: 'turn',
                range: {
                    start: { line: 4, character: 2 },
                    end: { line: 4, character: 10 }
                }
            }
        ]);
    });

    test('registerDocumentSymbolHandler converts nested document symbols to LSP symbol kinds', async () => {
        let documentSymbolHandler:
            | ((params: DocumentSymbolParams) => Promise<DocumentSymbolResult> | DocumentSymbolResult)
            | undefined;
        const connection = createNavigationConnection({
            onDocumentSymbol: jest.fn(handler => {
                documentSymbolHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const documentStore = new DocumentStore();
        const navigationService = createNavigationServiceStub({
            provideDocumentSymbols: jest.fn(async () => [
                {
                    name: 'TestStruct',
                    detail: 'struct',
                    kind: 'struct',
                    range: {
                        start: { line: 0, character: 0 },
                        end: { line: 3, character: 1 }
                    },
                    selectionRange: {
                        start: { line: 0, character: 7 },
                        end: { line: 0, character: 17 }
                    },
                    children: [
                        {
                            name: 'value',
                            detail: 'int',
                            kind: 'field',
                            range: {
                                start: { line: 1, character: 4 },
                                end: { line: 1, character: 13 }
                            },
                            selectionRange: {
                                start: { line: 1, character: 8 },
                                end: { line: 1, character: 13 }
                            }
                        }
                    ]
                },
                {
                    name: 'query_value',
                    detail: 'int',
                    kind: 'function',
                    range: {
                        start: { line: 5, character: 0 },
                        end: { line: 7, character: 1 }
                    },
                    selectionRange: {
                        start: { line: 5, character: 4 },
                        end: { line: 5, character: 15 }
                    }
                }
            ])
        });
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });

        documentStore.open('file:///D:/workspace/nav.c', 1, 'struct TestStruct {\n    int value;\n}\n');

        registerDocumentSymbolHandler({
            connection,
            documentStore,
            workspaceSession,
            navigationService
        });

        const symbols = await documentSymbolHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' }
        } as DocumentSymbolParams);

        expect(navigationService.provideDocumentSymbols).toHaveBeenCalledTimes(1);
        expect(symbols).toEqual([
            expect.objectContaining({
                name: 'TestStruct',
                detail: 'struct',
                kind: SymbolKind.Struct,
                children: [
                    expect.objectContaining({
                        name: 'value',
                        detail: 'int',
                        kind: SymbolKind.Field
                    })
                ]
            }),
            expect.objectContaining({
                name: 'query_value',
                detail: 'int',
                kind: SymbolKind.Function
            })
        ]);
    });

    test('registerCapabilities advertises and registers navigation handlers when the shared navigation service is present', async () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let hoverHandler: ((params: HoverParams) => Promise<Hover | undefined> | Hover | undefined) | undefined;
        let definitionHandler:
            | ((params: DefinitionParams) => Promise<Location | Location[] | undefined> | Location | Location[] | undefined)
            | undefined;
        let referencesHandler: ((params: ReferenceParams) => Promise<Location[]> | Location[]) | undefined;
        let prepareRenameHandler:
            | ((params: PrepareRenameParams) => Promise<LanguageRange | { range: LanguageRange; placeholder?: string } | undefined> | LanguageRange | { range: LanguageRange; placeholder?: string } | undefined)
            | undefined;
        let renameHandler: ((params: RenameParams) => Promise<WorkspaceEdit> | WorkspaceEdit) | undefined;
        let documentSymbolHandler:
            | ((params: DocumentSymbolParams) => Promise<DocumentSymbolResult> | DocumentSymbolResult)
            | undefined;

        const connection = createNavigationConnection({
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onHover: jest.fn(handler => {
                hoverHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDefinition: jest.fn(handler => {
                definitionHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onReferences: jest.fn(handler => {
                referencesHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onPrepareRename: jest.fn(handler => {
                prepareRenameHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onRenameRequest: jest.fn(handler => {
                renameHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onDocumentSymbol: jest.fn(handler => {
                documentSymbolHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const navigationService = createNavigationServiceStub();
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                navigationService
            }
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        registerCapabilities({
            connection,
            documentStore: new DocumentStore(),
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual({
            capabilities: {
                hoverProvider: true,
                definitionProvider: true,
                referencesProvider: true,
                renameProvider: {
                    prepareProvider: true
                },
                documentSymbolProvider: true,
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: '0.40.0-test'
            }
        });
        expect(connection.onHover).toHaveBeenCalledTimes(1);
        expect(connection.onDefinition).toHaveBeenCalledTimes(1);
        expect(connection.onReferences).toHaveBeenCalledTimes(1);
        expect(connection.onPrepareRename).toHaveBeenCalledTimes(1);
        expect(connection.onRenameRequest).toHaveBeenCalledTimes(1);
        expect(connection.onDocumentSymbol).toHaveBeenCalledTimes(1);
        expect(hoverHandler).toBeDefined();
        expect(definitionHandler).toBeDefined();
        expect(referencesHandler).toBeDefined();
        expect(prepareRenameHandler).toBeDefined();
        expect(renameHandler).toBeDefined();
        expect(documentSymbolHandler).toBeDefined();
    });

    test('registerCapabilities advertises and registers code action handlers when the shared code action service is present', async () => {
        let initializeHandler: ((params: InitializeParams) => InitializeResult) | undefined;
        let codeActionHandler:
            | ((params: CodeActionParams) => Promise<any[] | undefined> | any[] | undefined)
            | undefined;

        const connection = createNavigationConnection({
            onInitialize: jest.fn(handler => {
                initializeHandler = handler;
                return Disposable.create(() => undefined);
            }),
            onCodeAction: jest.fn(handler => {
                codeActionHandler = handler;
                return Disposable.create(() => undefined);
            })
        });
        const codeActionsService = {
            provideCodeActions: jest.fn(async () => [
                {
                    title: '删除未使用的变量',
                    kind: 'quickfix',
                    diagnostics: [
                        {
                            range: {
                                start: { line: 0, character: 0 },
                                end: { line: 0, character: 3 }
                            },
                            severity: 'warning',
                            message: 'unused',
                            code: 'unusedVar',
                            source: 'lpc'
                        }
                    ],
                    edit: {
                        changes: {
                            'file:///D:/workspace/nav.c': [
                                {
                                    range: {
                                        start: { line: 0, character: 0 },
                                        end: { line: 0, character: 3 }
                                    },
                                    newText: ''
                                }
                            ]
                        }
                    }
                }
            ])
        };
        const documentStore = new DocumentStore();
        documentStore.open('file:///D:/workspace/nav.c', 1, 'int foo;');
        const workspaceSession = new WorkspaceSession({
            workspaceRoots: ['D:/workspace'],
            featureServices: {
                codeActionsService
            } as any
        });
        const logger = new ServerLogger({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            log: jest.fn()
        });

        registerCapabilities({
            connection: connection as any,
            documentStore,
            logger,
            serverVersion: '0.40.0-test',
            workspaceSession
        });

        expect(initializeHandler?.({} as InitializeParams)).toEqual(expect.objectContaining({
            capabilities: expect.objectContaining({
                codeActionProvider: {
                    codeActionKinds: [CodeActionKind.QuickFix]
                }
            })
        }));

        const result = await codeActionHandler?.({
            textDocument: { uri: 'file:///D:/workspace/nav.c' },
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 3 }
            },
            context: {
                diagnostics: [
                    {
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 3 }
                        },
                        severity: 2,
                        message: 'unused',
                        code: 'unusedVar',
                        source: 'lpc'
                    }
                ],
                only: [CodeActionKind.QuickFix]
            }
        } as any);

        expect(codeActionsService.provideCodeActions).toHaveBeenCalledTimes(1);
        expect(result).toEqual([
            {
                title: '删除未使用的变量',
                kind: CodeActionKind.QuickFix,
                diagnostics: [
                    {
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 3 }
                        },
                        severity: 2,
                        message: 'unused',
                        code: 'unusedVar',
                        source: 'lpc'
                    }
                ],
                edit: {
                    changes: {
                        'file:///D:/workspace/nav.c': [
                            {
                                range: {
                                    start: { line: 0, character: 0 },
                                    end: { line: 0, character: 3 }
                                },
                                newText: ''
                            }
                        ]
                    }
                }
            }
        ]);
    });

    test('createServer threads the shared navigation service into the workspace session before bootstrap registration', () => {
        const fakeConnection = {
            console: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                log: jest.fn()
            },
            listen: jest.fn()
        } as unknown as Connection;
        const registerCapabilitiesMock = jest.fn();

        jest.isolateModules(() => {
            jest.doMock('vscode-languageserver/node', () => ({
                createConnection: jest.fn(() => fakeConnection),
                ProposedFeatures: {
                    all: {}
                }
            }));
            jest.doMock('../bootstrap/registerCapabilities', () => ({
                registerCapabilities: registerCapabilitiesMock
            }));

            const { createServer } = require('../bootstrap/createServer') as typeof import('../bootstrap/createServer');
            const navigationService = createNavigationServiceStub();
            const runtime = createServer({ navigationService });
            const registrationContext = registerCapabilitiesMock.mock.calls[0]?.[0] as {
                workspaceSession: WorkspaceSession;
            };

            expect(runtime.workspaceSession.toLanguageWorkspaceContext('').services?.navigationService).toBe(navigationService);
            expect(registrationContext.workspaceSession.toLanguageWorkspaceContext('').services?.navigationService)
                .toBe(navigationService);
        });
    });
});

function createNavigationServiceStub(
    overrides: Partial<NavigationHandlerService> = {}
): NavigationHandlerService {
    return {
        provideHover: jest.fn(async () => undefined),
        provideDefinition: jest.fn(async () => []),
        provideReferences: jest.fn(async () => []),
        prepareRename: jest.fn(async () => undefined),
        provideRenameEdits: jest.fn(async () => ({ changes: {} })),
        provideDocumentSymbols: jest.fn(async () => []),
        ...overrides
    };
}

function createNavigationConnection(overrides: Partial<NavigationConnection> = {}): NavigationConnection {
    return {
        onInitialize: jest.fn(() => Disposable.create(() => undefined)),
        onDidOpenTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidChangeTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onDidCloseTextDocument: jest.fn(() => Disposable.create(() => undefined)),
        onNotification: jest.fn(() => Disposable.create(() => undefined)),
        onRequest: jest.fn(() => Disposable.create(() => undefined)),
        onCompletion: jest.fn(() => Disposable.create(() => undefined)),
        onCompletionResolve: jest.fn(() => Disposable.create(() => undefined)),
        onHover: jest.fn(() => Disposable.create(() => undefined)),
        onDefinition: jest.fn(() => Disposable.create(() => undefined)),
        onReferences: jest.fn(() => Disposable.create(() => undefined)),
        onPrepareRename: jest.fn(() => Disposable.create(() => undefined)),
        onRenameRequest: jest.fn(() => Disposable.create(() => undefined)),
        onDocumentSymbol: jest.fn(() => Disposable.create(() => undefined)),
        onCodeAction: jest.fn(() => Disposable.create(() => undefined)),
        ...overrides
    };
}
