import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DirectSymbolDefinitionResolver } from '../definition/DirectSymbolDefinitionResolver';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';

function createDocument(filePath: string, source: string): vscode.TextDocument {
    const lines = source.split(/\r?\n/);
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        version: 1,
        languageId: 'lpc',
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return source;
            }

            if (range.start.line === range.end.line) {
                return lines[range.start.line].slice(range.start.character, range.end.character);
            }

            return source;
        }),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
        getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, 4))
    } as unknown as vscode.TextDocument;
}

function createSupport(overrides: Partial<ConstructorParameters<typeof DefinitionResolverSupport>[0]> = {}): DefinitionResolverSupport {
    return new DefinitionResolverSupport({
        astManager: {
            getSemanticSnapshot: jest.fn(() => ({
                includeStatements: [],
                inheritStatements: [],
                symbolTable: {
                    getAllSymbols: () => []
                }
            }))
        } as any,
        host: {
            onDidChangeTextDocument: () => ({ dispose() {} }),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:/workspace' } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:/workspace' } }]),
            fileExists: jest.fn().mockReturnValue(true)
        },
        macroManager: { getMacro: jest.fn() } as any,
        ...overrides
    } as any);
}

describe('DirectSymbolDefinitionResolver', () => {
    test('returns include-path definitions when the cursor is on an include statement', async () => {
        const support = createSupport({
            semanticAdapter: {
                getIncludeStatements: jest.fn().mockReturnValue([{
                    value: '/std/room.h',
                    isSystemInclude: false,
                    range: new vscode.Range(0, 0, 0, 20)
                }])
            } as any
        });
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            macroManager: { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);
        jest.spyOn(support, 'resolveIncludeFilePath').mockResolvedValue('D:/workspace/std/room.h');

        const result = await resolver.resolve(
            createDocument('D:/workspace/room.c', '#include "/std/room.h"\n'),
            new vscode.Position(0, 5),
            'room',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            vscode.Uri.file('D:/workspace/std/room.h'),
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
        ));
    });

    test('returns macro definitions before other direct fallbacks', async () => {
        const macroDoc = createDocument('D:/workspace/include/defs.h', '#define USER_OB "/obj/user"\n');
        const support = createSupport({
            host: {
                onDidChangeTextDocument: () => ({ dispose() {} }),
                openTextDocument: jest.fn(async () => macroDoc),
                findFiles: jest.fn(),
                getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:/workspace' } })),
                getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:/workspace' } }]),
                fileExists: jest.fn().mockReturnValue(true)
            } as any
        });
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            macroManager: {
                getMacro: jest.fn().mockReturnValue({
                    file: 'D:/workspace/include/defs.h',
                    line: 1
                })
            } as any,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const result = await resolver.resolve(
            createDocument('D:/workspace/cmds/test.c', 'USER_OB->query_name();\n'),
            new vscode.Position(0, 2),
            'USER_OB',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            vscode.Uri.file('D:/workspace/include/defs.h'),
            new vscode.Range(0, 0, 0, '#define USER_OB "/obj/user"'.length)
        ));
    });

    test('returns visible variable definitions before inherited fallback', async () => {
        const support = createSupport();
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            macroManager: { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue({
                    uri: 'file:///D:/workspace/room.c',
                    range: {
                        start: { line: 1, character: 8 },
                        end: { line: 1, character: 13 }
                    }
                })
            }
        } as any);

        const result = await resolver.resolve(
            createDocument('D:/workspace/room.c', 'void demo() {\n    int round;\n    round += 1;\n}\n'),
            new vscode.Position(2, 6),
            'round',
            'D:/workspace'
        );

        expect(result).toEqual(expect.objectContaining({
            uri: vscode.Uri.parse('file:///D:/workspace/room.c'),
            range: new vscode.Range(1, 8, 1, 13)
        }));
    });

    test('returns simul_efun source-doc locations before graph traversal', async () => {
        const resolver = new DirectSymbolDefinitionResolver({
            support: createSupport(),
            macroManager: { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            efunDocsManager: {
                getSimulatedDoc: jest.fn().mockReturnValue({
                    name: 'message_vision',
                    sourceFile: 'D:/workspace/adm/simul_efun/message.c',
                    sourceRange: {
                        start: { line: 252, character: 0 },
                        end: { line: 252, character: 48 }
                    }
                })
            } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const result = await resolver.resolve(
            createDocument('D:/workspace/cmds/test.c', 'message_vision();\n'),
            new vscode.Position(0, 2),
            'message_vision',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            vscode.Uri.file('D:/workspace/adm/simul_efun/message.c'),
            new vscode.Range(252, 0, 252, 48)
        ));
    });
});
