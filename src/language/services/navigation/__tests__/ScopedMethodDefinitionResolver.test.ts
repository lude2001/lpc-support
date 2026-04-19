import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ASTManager } from '../../../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { ScopedMethodDefinitionResolver } from '../definition/ScopedMethodDefinitionResolver';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../../../__tests__/testAstManagerSingleton';

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

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
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
        positionAt: jest.fn(),
        offsetAt: jest.fn(offsetAt),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function createSupport(): DefinitionResolverSupport {
    return new DefinitionResolverSupport({
        astManager: ASTManager.getInstance(),
        host: {
            onDidChangeTextDocument: () => ({ dispose() {} }),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:/workspace' } })),
            getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:/workspace' } }]),
            fileExists: jest.fn().mockReturnValue(false)
        },
        macroManager: { getMacro: jest.fn() } as any
    } as any);
}

describe('ScopedMethodDefinitionResolver', () => {
    const analysisService = DocumentSemanticSnapshotService.getInstance();

    beforeEach(() => {
        configureAstManagerSingletonForTests(analysisService);
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
    });

    test('returns locations for bare scoped method identifiers only', async () => {
        const document = createTextDocument('D:/workspace/room.c', 'void demo() {\n    ::create();\n}\n');
        const resolver = new ScopedMethodDefinitionResolver({
            astManager: ASTManager.getInstance(),
            analysisService,
            support: createSupport(),
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    methodName: 'create',
                    targets: [{
                        path: 'D:/workspace/std/base_room.c',
                        methodName: 'create',
                        declarationRange: new vscode.Range(0, 5, 0, 11),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/base_room.c'),
                            new vscode.Range(0, 5, 0, 11)
                        )
                    }]
                })
            }
        } as any);

        const result = await resolver.resolve(document, new vscode.Position(1, 8));

        expect(result).toEqual([
            new vscode.Location(
                vscode.Uri.file('D:/workspace/std/base_room.c'),
                new vscode.Range(0, 5, 0, 11)
            )
        ]);
    });

    test('returns undefined on qualifier and argument positions', async () => {
        const document = createTextDocument('D:/workspace/room.c', 'void demo() {\n    room::init(arg);\n}\n');
        const resolver = new ScopedMethodDefinitionResolver({
            astManager: ASTManager.getInstance(),
            analysisService,
            support: createSupport(),
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'resolved',
                    methodName: 'init',
                    targets: [{
                        path: 'D:/workspace/std/room.c',
                        methodName: 'init',
                        declarationRange: new vscode.Range(0, 5, 0, 9),
                        location: new vscode.Location(
                            vscode.Uri.file('D:/workspace/std/room.c'),
                            new vscode.Range(0, 5, 0, 9)
                        )
                    }]
                })
            }
        } as any);

        await expect(resolver.resolve(document, new vscode.Position(1, 5))).resolves.toBeUndefined();
        await expect(resolver.resolve(document, new vscode.Position(1, 15))).resolves.toBeUndefined();
    });

    test('returns an empty handled result for ambiguous scoped resolutions', async () => {
        const document = createTextDocument('D:/workspace/room.c', 'void demo() {\n    room::init();\n}\n');
        const resolver = new ScopedMethodDefinitionResolver({
            astManager: ASTManager.getInstance(),
            analysisService,
            support: createSupport(),
            scopedMethodResolver: {
                resolveCallAt: jest.fn().mockResolvedValue({
                    status: 'ambiguous',
                    methodName: 'init',
                    targets: []
                })
            }
        } as any);

        await expect(resolver.resolve(document, new vscode.Position(1, 10))).resolves.toEqual([]);
    });
});
