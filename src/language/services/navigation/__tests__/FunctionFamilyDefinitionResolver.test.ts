import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { FunctionFamilyDefinitionResolver } from '../definition/FunctionFamilyDefinitionResolver';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';

function createTextDocument(filePath: string, source: string): vscode.TextDocument {
    const lines = source.split(/\r?\n/);
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        getText: jest.fn(() => source),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' }))
    } as unknown as vscode.TextDocument;
}

describe('FunctionFamilyDefinitionResolver', () => {
    test('returns current-file exported function definitions first', async () => {
        const document = createTextDocument('D:/workspace/room.c', 'void create() {}\n');
        const support = {
            getSemanticSnapshot: jest.fn(() => ({
                exportedFunctions: [{ name: 'create' }]
            })),
            findFunctionInSemanticSnapshot: jest.fn(() => new vscode.Location(
                vscode.Uri.file('D:/workspace/room.c'),
                new vscode.Range(0, 5, 0, 11)
            )),
            findInherits: jest.fn(() => new Set<string>()),
            openInheritedDocument: jest.fn(),
            getIncludeFiles: jest.fn()
        } as unknown as DefinitionResolverSupport;
        const resolver = new FunctionFamilyDefinitionResolver({ support } as any);

        const result = await resolver.resolve(document, 'create', {
            processedFiles: new Set<string>(),
            functionDefinitions: new Map<string, vscode.Location>()
        });

        expect(result).toEqual(new vscode.Location(
            vscode.Uri.file('D:/workspace/room.c'),
            new vscode.Range(0, 5, 0, 11)
        ));
    });

    test('falls back to inherited definitions when the current file misses', async () => {
        const document = createTextDocument('D:/workspace/room.c', 'void demo() { create(); }\n');
        const inheritedDocument = createTextDocument('D:/workspace/std/base_room.c', 'void create() {}\n');
        const support = {
            getSemanticSnapshot: jest.fn((target: vscode.TextDocument) => ({
                exportedFunctions: target === document ? [] : [{ name: 'create' }]
            })),
            findFunctionInSemanticSnapshot: jest.fn((target: vscode.TextDocument) => {
                if (target === inheritedDocument) {
                    return new vscode.Location(
                        vscode.Uri.file('D:/workspace/std/base_room.c'),
                        new vscode.Range(0, 5, 0, 11)
                    );
                }

                return undefined;
            }),
            findInherits: jest.fn((target: vscode.TextDocument) => (
                target === document ? new Set(['/std/base_room.c']) : new Set<string>()
            )),
            openInheritedDocument: jest.fn(async () => inheritedDocument),
            getIncludeFiles: jest.fn(async () => [])
        } as unknown as DefinitionResolverSupport;
        const resolver = new FunctionFamilyDefinitionResolver({ support } as any);

        const result = await resolver.resolve(document, 'create', {
            processedFiles: new Set<string>(),
            functionDefinitions: new Map<string, vscode.Location>()
        });

        expect(result).toEqual(new vscode.Location(
            vscode.Uri.file('D:/workspace/std/base_room.c'),
            new vscode.Range(0, 5, 0, 11)
        ));
    });

    test('uses include implementation before header prototype when both exist', async () => {
        const document = createTextDocument('D:/workspace/room.c', 'create();\n');
        const prototypeLocation = new vscode.Location(
            vscode.Uri.file('D:/workspace/include/room.h'),
            new vscode.Range(0, 0, 0, 18)
        );
        const implementationLocation = new vscode.Location(
            vscode.Uri.file('D:/workspace/std/room.c'),
            new vscode.Range(4, 0, 4, 12)
        );
        const support = {
            getSemanticSnapshot: jest.fn(() => ({
                exportedFunctions: []
            })),
            findFunctionInSemanticSnapshot: jest.fn((target: vscode.TextDocument) => {
                if (target.fileName === 'D:/workspace/std/room.c') {
                    return implementationLocation;
                }

                if (target.fileName === 'D:/workspace/include/room.h') {
                    return prototypeLocation;
                }

                return undefined;
            }),
            findInherits: jest.fn(() => new Set<string>()),
            openInheritedDocument: jest.fn(),
            getIncludeFiles: jest.fn(async () => ['D:/workspace/include/room.h', 'D:/workspace/std/room.c']),
            getHeaderFunctionIndex: jest.fn(async () => new Map<string, vscode.Location>([
                ['create', prototypeLocation]
            ])),
            openWorkspaceDocument: jest.fn(async (_current: vscode.TextDocument, filePath: string) =>
                createTextDocument(filePath, 'void create() {}\n')
            )
        } as unknown as DefinitionResolverSupport;
        const resolver = new FunctionFamilyDefinitionResolver({ support } as any);

        const result = await resolver.resolve(document, 'create', {
            processedFiles: new Set<string>(),
            functionDefinitions: new Map<string, vscode.Location>()
        });

        expect(result).toEqual(implementationLocation);
    });
});
