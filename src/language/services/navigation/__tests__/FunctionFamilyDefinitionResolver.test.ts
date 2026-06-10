import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { FunctionFamilyDefinitionResolver } from '../definition/FunctionFamilyDefinitionResolver';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';

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
        getText: jest.fn(() => source),
        lineAt: jest.fn((line: number) => ({ text: lines[line] ?? '' })),
        offsetAt,
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }
            return new vscode.Position(line, offset - lineStarts[line]);
        })
    } as unknown as vscode.TextDocument;
}

describe('FunctionFamilyDefinitionResolver', () => {
    afterEach(() => {
        DocumentSemanticSnapshotService.getInstance().clear();
    });

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

    test('resolves nested absolute inherit definitions through workspace path support', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-function-family-'));
        const roomPath = path.join(workspaceRoot, 'room.c');
        const midPath = path.join(workspaceRoot, 'mid.c');
        const basePath = path.join(workspaceRoot, 'base.c');
        fs.writeFileSync(roomPath, 'inherit "/mid";\nvoid demo() { root_call(1); }\n', 'utf8');
        fs.writeFileSync(midPath, 'inherit "/base";\n', 'utf8');
        fs.writeFileSync(basePath, 'int root_call(int value) { return value; }\n', 'utf8');

        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const host = {
            openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                const filePath = typeof target === 'string' ? target : target.fsPath;
                return createTextDocument(filePath, fs.readFileSync(filePath, 'utf8'));
            }),
            fileExists: (filePath: string) => fs.existsSync(filePath),
            getWorkspaceFolder: (uri: vscode.Uri) => uri.fsPath.startsWith(workspaceRoot)
                ? { uri: { fsPath: workspaceRoot } }
                : undefined
        };
        const pathSupport = new WorkspaceDocumentPathSupport({
            host,
            analysisService
        });
        const support = new DefinitionResolverSupport({
            analysisService,
            host: {
                ...host,
                onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
            },
            pathSupport
        } as any);
        const resolver = new FunctionFamilyDefinitionResolver({ support } as any);
        const document = createTextDocument(roomPath, fs.readFileSync(roomPath, 'utf8'));

        expect(analysisService.getSemanticSnapshot(document, false).inheritStatements.map((statement) => statement.value))
            .toEqual(['/mid']);

        const result = await resolver.resolve(document, 'root_call', {
            processedFiles: new Set<string>(),
            functionDefinitions: new Map<string, vscode.Location>()
        });

        expect(host.openTextDocument.mock.calls.map((call) => typeof call[0] === 'string' ? call[0] : call[0].fsPath))
            .toEqual([midPath, basePath]);
        expect(result).toEqual(new vscode.Location(
            vscode.Uri.file(basePath),
            new vscode.Range(0, 4, 0, 13)
        ));
    });
});
