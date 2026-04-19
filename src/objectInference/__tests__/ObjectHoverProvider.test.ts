import * as vscode from 'vscode';
import { CallableDocRenderer } from '../../language/documentation/CallableDocRenderer';
import {
    FunctionDocumentationService,
    createDefaultFunctionDocumentationService
} from '../../language/documentation/FunctionDocumentationService';
import { DocumentSemanticSnapshotService } from '../../semantic/documentSemanticSnapshotService';
import { ObjectHoverProvider } from '../ObjectHoverProvider';
import {
    createDefaultObjectInferenceLanguageHoverService,
    type LanguageHoverService
} from '../../language/services/navigation/LanguageHoverService';

const mockGetSemanticSnapshot = jest.fn();

jest.mock('../../ast/astManager', () => ({
    ASTManager: {
        getInstance: () => ({
            getSemanticSnapshot: mockGetSemanticSnapshot
        })
    }
}));

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true)
}));

function createProviderHoverService(
    objectInferenceService: { inferObjectAccess: jest.Mock },
    targetMethodLookup: { findMethod: jest.Mock },
    documentationService: FunctionDocumentationService
): LanguageHoverService {
    return createDefaultObjectInferenceLanguageHoverService(
        objectInferenceService as any,
        undefined,
        {
            documentAdapter: {
                fromLanguageDocument: (document) => document as any
            },
            objectAccessProvider: {
                inferObjectAccess: async (_context, document, position) =>
                    objectInferenceService.inferObjectAccess(
                        document as any,
                        new vscode.Position(position.line, position.character)
                    )
            },
            methodResolver: {
                findMethod: async (_context, document, targetPath, methodName) =>
                    targetMethodLookup.findMethod(document as any, targetPath, methodName)
            },
            documentationService,
            renderer: new CallableDocRenderer()
        }
    );
}

describe('ObjectHoverProvider', () => {
    beforeEach(() => {
        (vscode.workspace.openTextDocument as jest.Mock).mockReset();
    });

    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
    });

    test('delegates hover requests through LanguageHoverService without changing the returned markdown', async () => {
        const stubService: LanguageHoverService = {
            provideHover: jest.fn().mockResolvedValue({
                contents: [
                    {
                        kind: 'markdown',
                        value: '```lpc\nstring query_name()\n```\n\nshared docs'
                    }
                ]
            })
        };
        const provider = new ObjectHoverProvider(stubService);
        const document = {
            uri: vscode.Uri.file('D:/code/lpc/obj/test.c'),
            fileName: 'D:/code/lpc/obj/test.c',
            version: 3,
            getText: jest.fn(() => 'target->query_name();')
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(
            document,
            new vscode.Position(0, 10)
        );

        expect(stubService.provideHover).toHaveBeenCalledTimes(1);
        expect(stubService.provideHover).toHaveBeenCalledWith({
            context: expect.objectContaining({
                document: document,
                mode: 'lsp',
                workspace: expect.objectContaining({
                    workspaceRoot: expect.any(String)
                })
            }),
            position: {
                line: 0,
                character: 10
            }
        });
        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('string query_name()');
        expect(hoverContent.value).toContain('shared docs');
    });

    test('hovering the receiver side of USER_D->query_name() does not return object-method hover', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'USER_D->query_name();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'USER_D',
                memberName: 'query_name',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/userd.c', source: 'macro' }]
                }
            })
        };
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
            getText: () => [
                '/**',
                ' * @brief 返回名字。',
                ' */',
                'string query_name() {',
                '    return "npc";',
                '}'
            ].join('\n')
        });
        const targetMethodLookup = {
            findMethod: jest.fn().mockResolvedValue({
                path: 'D:/code/lpc/obj/userd.c',
                document: {
                    uri: vscode.Uri.file('D:/code/lpc/obj/userd.c'),
                    getText: () => [
                        '/**',
                        ' * @brief 返回名字。',
                        ' */',
                        'string query_name() {',
                        '    return "npc";',
                        '}'
                    ].join('\n')
                },
                location: new vscode.Location(vscode.Uri.file('D:/code/lpc/obj/userd.c'), new vscode.Position(3, 0))
            })
        };

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, 6)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 2));

        expect(hover).toBeUndefined();
    });

    test('resolved target file shows method syntax and structured shared docs without legacy reparsing', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'target->query_name();';
        const getDocsByNameSpy = jest.spyOn(FunctionDocumentationService.prototype, 'getDocsByName');
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'target',
                memberName: 'query_name',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/npc.c', source: 'literal' }]
                }
            })
        };
        const targetMethodLookup = {
            resolvedDocument: {
                uri: vscode.Uri.file('D:/code/lpc/obj/npc.c'),
                fileName: 'D:/code/lpc/obj/npc.c',
                version: 7,
                getText: () => [
                    '/**',
                    ' * @brief 返回名字。',
                    ' * @param string style 显示风格。',
                    ' * @details 这是对象方法的详细说明。',
                    ' * @note 支持共享文档渲染。',
                    ' */',
                    'string query_name(string style) {',
                    '    return "npc";',
                    '}'
                ].join('\n')
            },
            findMethod: jest.fn().mockResolvedValue({
                path: 'D:/code/lpc/obj/npc.c',
                document: undefined,
                location: new vscode.Location(vscode.Uri.file('D:/code/lpc/obj/npc.c'), new vscode.Position(3, 0))
            })
        };
        targetMethodLookup.findMethod.mockResolvedValue({
            path: 'D:/code/lpc/obj/npc.c',
            document: targetMethodLookup.resolvedDocument,
            location: new vscode.Location(vscode.Uri.file('D:/code/lpc/obj/npc.c'), new vscode.Position(3, 0))
        });

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 8, 0, 18)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(objectInferenceService.inferObjectAccess).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(hover).toBeInstanceOf(vscode.Hover);
        expect(getDocsByNameSpy).toHaveBeenCalledWith(targetMethodLookup.resolvedDocument, 'query_name');

        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('string query_name(');
        expect(hoverContent.value).toContain('返回名字。');
        expect(hoverContent.value).toContain('#### Parameters');
        expect(hoverContent.value).toContain('显示风格');
        expect(hoverContent.value).toContain('#### Details');
        expect(hoverContent.value).toContain('这是对象方法的详细说明');
        expect(hoverContent.value).toContain('Note');
        expect(hoverContent.value).toContain('支持共享文档渲染');
    });

    test('merged candidates without unique implementation return a conservative summary containing 可能来自多个对象', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'ob->start();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'ob',
                memberName: 'start',
                inference: {
                    status: 'multiple',
                    candidates: [
                        { path: 'D:/code/lpc/obj/a.c', source: 'assignment' },
                        { path: 'D:/code/lpc/obj/b.c', source: 'assignment' }
                    ]
                }
            })
        };
        const targetMethodLookup = {
            findMethod: jest.fn().mockResolvedValue(undefined)
        };

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );

        const hover = await provider.provideHover({
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 4, 0, 9)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument, new vscode.Position(0, 5));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('可能来自多个对象');
    });

    test('include-backed method hover reuses shared lookup results', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'factory->method();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'factory',
                memberName: 'method',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/child.c', source: 'assignment' }]
                }
            })
        };
        const targetMethodLookup = {
            findMethod: jest.fn().mockResolvedValue({
                path: 'D:/code/lpc/include/factory-method.c',
                document: {
                    uri: vscode.Uri.file('D:/code/lpc/include/factory-method.c'),
                    getText: () => [
                        '/**',
                        ' * @brief include-backed hover docs。',
                        ' */',
                        'object method() {',
                        '    return 0;',
                        '}'
                    ].join('\n')
                },
                location: new vscode.Location(vscode.Uri.file('D:/code/lpc/include/factory-method.c'), new vscode.Position(3, 0))
            })
        };

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 9, 0, 15)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('object method()');
        expect(hoverContent.value).toContain('include-backed hover docs');
        expect(targetMethodLookup.findMethod).toHaveBeenCalledWith(document, 'D:/code/lpc/obj/child.c', 'method');
    });

    test('method not found in direct file but found in inherited parent shows parent doc', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'child->quest_info();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'child',
                memberName: 'quest_info',
                inference: {
                    status: 'resolved',
                    candidates: [{ path: 'D:/code/lpc/obj/child.c', source: 'literal' }]
                }
            })
        };

        const targetMethodLookup = {
            findMethod: jest.fn().mockResolvedValue({
                path: 'D:/code/lpc/obj/parent.c',
                document: {
                    uri: vscode.Uri.file('D:/code/lpc/obj/parent.c'),
                    getText: () => [
                        '/**',
                        ' * @brief 父类任务描述。',
                        ' */',
                        'string quest_info() { return "parent quest"; }'
                    ].join('\n')
                },
                location: new vscode.Location(vscode.Uri.file('D:/code/lpc/obj/parent.c'), new vscode.Position(3, 0))
            })
        };

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 7, 0, 17)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 10));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('string quest_info()');
        expect(hoverContent.value).toContain('父类任务描述');
    });

    test('multiple candidates converging to same parent implementation shows the unique doc', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'ob->shared_method();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'ob',
                memberName: 'shared_method',
                inference: {
                    status: 'multiple',
                    candidates: [
                        { path: 'D:/code/lpc/obj/childA.c', source: 'assignment' },
                        { path: 'D:/code/lpc/obj/childB.c', source: 'assignment' }
                    ]
                }
            })
        };

        const parentContent = [
            '/**',
            ' * @brief 共享实现。',
            ' */',
            'void shared_method() {}'
        ].join('\n');
        const targetMethodLookup = {
            findMethod: jest.fn().mockResolvedValue({
                path: 'D:/code/lpc/obj/parent.c',
                document: {
                    uri: vscode.Uri.file('D:/code/lpc/obj/parent.c'),
                    getText: () => parentContent
                },
                location: new vscode.Location(vscode.Uri.file('D:/code/lpc/obj/parent.c'), new vscode.Position(3, 0))
            })
        };

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 4, 0, 17)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 5));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('shared_method');
        expect(hoverContent.value).toContain('共享实现');
        expect(hoverContent.value).not.toContain('可能来自多个对象');
    });

    test('distinct implementations render separate hover blocks even when docs are similar', async () => {
        const documentationService = createDefaultFunctionDocumentationService();
        const content = 'ob->start();';
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue({
                receiver: 'ob',
                memberName: 'start',
                inference: {
                    status: 'multiple',
                    candidates: [
                        { path: 'D:/code/lpc/obj/a.c', source: 'assignment' },
                        { path: 'D:/code/lpc/obj/b.c', source: 'assignment' }
                    ]
                }
            })
        };
        const createMethodDocument = (filePath: string) => ({
            uri: vscode.Uri.file(filePath),
            getText: () => [
                '/**',
                ' * @brief Shared docs。',
                ' */',
                'void start() {}'
            ].join('\n')
        });
        const targetMethodLookup = {
            findMethod: jest.fn(async (_document: vscode.TextDocument, targetFilePath: string) => ({
                path: targetFilePath,
                document: createMethodDocument(targetFilePath),
                location: new vscode.Location(vscode.Uri.file(targetFilePath), new vscode.Position(3, 0))
            }))
        };

        const provider = new ObjectHoverProvider(
            createProviderHoverService(objectInferenceService as any, targetMethodLookup as any, documentationService)
        );
        const document = {
            getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 4, 0, 9)),
            getText: jest.fn((range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(range.start.character, range.end.character);
            })
        } as unknown as vscode.TextDocument;

        const hover = await provider.provideHover(document, new vscode.Position(0, 5));

        expect(hover).toBeInstanceOf(vscode.Hover);
        const hoverContent = (hover as vscode.Hover).contents as vscode.MarkdownString;
        expect(hoverContent.value).toContain('D:/code/lpc/obj/a.c');
        expect(hoverContent.value).toContain('D:/code/lpc/obj/b.c');
        expect(hoverContent.value).toContain('void start()');
        expect(hoverContent.value).not.toContain('可能来自多个对象');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
