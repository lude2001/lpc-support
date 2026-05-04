import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DirectSymbolDefinitionResolver } from '../definition/DirectSymbolDefinitionResolver';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';
import { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';

function createDocument(filePath: string, source: string): vscode.TextDocument {
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
        }),
        offsetAt: jest.fn((position: vscode.Position) => offsetAt(position)),
        getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, 4))
    } as unknown as vscode.TextDocument;
}

function createSupport(overrides: Partial<ConstructorParameters<typeof DefinitionResolverSupport>[0]> = {}): DefinitionResolverSupport {
    const defaultHost = {
        onDidChangeTextDocument: () => ({ dispose() {} }),
        openTextDocument: jest.fn(),
        findFiles: jest.fn(),
        getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:/workspace' } })),
        getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:/workspace' } }]),
        fileExists: jest.fn().mockReturnValue(true)
    };
    const resolvedHost = (overrides.host as any) ?? defaultHost;
    return new DefinitionResolverSupport({
        analysisService: {
            getSemanticSnapshot: jest.fn(() => ({
                includeStatements: [],
                inheritStatements: [],
                symbolTable: {
                    getAllSymbols: () => []
                }
            })),
            getBestAvailableSnapshot: jest.fn(() => ({
                includeStatements: [],
                inheritStatements: [],
                symbolTable: {
                    getAllSymbols: () => []
                }
            }))
        } as any,
        host: resolvedHost,
        pathSupport: new WorkspaceDocumentPathSupport({ host: resolvedHost }),
        ...overrides
    } as any);
}

function createAnalysisBackedSupport(
    documents: vscode.TextDocument[],
    mutateSnapshot?: (document: vscode.TextDocument, snapshot: ReturnType<DocumentSemanticSnapshotService['getSemanticSnapshot']>) => void
): DefinitionResolverSupport {
    const byKey = new Map<string, vscode.TextDocument>();
    for (const document of documents) {
        byKey.set(normalizeDocumentKey(document.uri.fsPath), document);
        byKey.set(normalizeDocumentKey(document.uri.toString()), document);
    }

    const host = {
        onDidChangeTextDocument: () => ({ dispose() {} }),
        openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
            const key = normalizeDocumentKey(typeof target === 'string' ? target : target.fsPath);
            const document = byKey.get(key);
            if (!document) {
                throw new Error(`Missing test document: ${key}`);
            }

            return document;
        }),
        findFiles: jest.fn(),
        getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:/workspace' } })),
        getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:/workspace' } }]),
        fileExists: jest.fn((filePath: string) => byKey.has(normalizeDocumentKey(filePath)))
    };
    const analysisService = DocumentSemanticSnapshotService.getInstance();
    return createSupport({
        host,
        analysisService: {
            getSemanticSnapshot: jest.fn((targetDocument: vscode.TextDocument) => {
                const snapshot = analysisService.getSemanticSnapshot(targetDocument, false);
                mutateSnapshot?.(targetDocument, snapshot);
                return snapshot;
            }),
            getBestAvailableSnapshot: jest.fn((targetDocument: vscode.TextDocument) => {
                const snapshot = analysisService.getSemanticSnapshot(targetDocument, false);
                mutateSnapshot?.(targetDocument, snapshot);
                return snapshot;
            })
        } as any
    });
}

function normalizeDocumentKey(value: string): string {
    return value.replace(/\\/g, '/').replace(/^file:\/\/\/+/, '').replace(/^\/+/, '').toLowerCase();
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
        const document = createDocument('D:/workspace/cmds/test.c', [
            '#define USER_OB "/obj/user"',
            'USER_OB->query_name();'
        ].join('\n'));
        const support = createAnalysisBackedSupport([document]);
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const result = await resolver.resolve(
            document,
            new vscode.Position(1, 2),
            'USER_OB',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            vscode.Uri.parse(document.uri.toString()),
            new vscode.Range(0, 0, 0, '#define USER_OB "/obj/user"'.length)
        ));
    });

    test('returns visible variable definitions before inherited fallback', async () => {
        const support = createSupport();
        const resolver = new DirectSymbolDefinitionResolver({
            support,
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
            efunDocsManager: {
                getSimulatedDoc: jest.fn().mockReturnValue({
                    name: 'message_vision',
                    sourcePath: 'D:/workspace/adm/simul_efun/message.c',
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

    test('returns explicit class member definitions for statically typed receivers', async () => {
        const source = [
            'class Payload {',
            '    string title;',
            '}',
            '',
            'void demo() {',
            '    class Payload payload;',
            '    payload.title;',
            '}'
        ].join('\n');
        const document = createDocument('D:/workspace/room.c', source);
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const support = createSupport({
            analysisService: {
                getSemanticSnapshot: jest.fn((targetDocument: vscode.TextDocument) =>
                    analysisService.getSemanticSnapshot(targetDocument, false)
                ),
                getBestAvailableSnapshot: jest.fn((targetDocument: vscode.TextDocument) =>
                    analysisService.getSemanticSnapshot(targetDocument, false)
                )
            } as any
        });
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const result = await resolver.resolve(
            document,
            new vscode.Position(6, '    payload.tit'.length),
            'title',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            document.uri,
            new vscode.Range(1, 11, 1, 16)
        ));
    });

    test('returns include-backed class member definitions for statically typed receivers', async () => {
        const headerDocument = createDocument('D:/workspace/include/payload.h', [
            'class Payload {',
            '    string title;',
            '}'
        ].join('\n'));
        const sourceDocument = createDocument('D:/workspace/include_room.c', [
            '#include "/include/payload.h"',
            '',
            'void demo() {',
            '    class Payload payload;',
            '    payload.title;',
            '}'
        ].join('\n'));
        const support = createAnalysisBackedSupport([sourceDocument, headerDocument], (document, snapshot) => {
            if (document === sourceDocument && snapshot.includeStatements[0]) {
                snapshot.includeStatements[0].resolvedUri = headerDocument.uri.toString();
            }
        });
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const result = await resolver.resolve(
            sourceDocument,
            new vscode.Position(4, '    payload.tit'.length),
            'title',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            headerDocument.uri,
            new vscode.Range(1, 11, 1, 16)
        ));
    });

    test('returns inherited class member definitions for statically typed receivers', async () => {
        const baseDocument = createDocument('D:/workspace/base.c', [
            'class BasePayload {',
            '    string title;',
            '}'
        ].join('\n'));
        const sourceDocument = createDocument('D:/workspace/inherit_room.c', [
            'inherit "/base";',
            '',
            'void demo() {',
            '    class BasePayload payload;',
            '    payload.title;',
            '}'
        ].join('\n'));
        const support = createAnalysisBackedSupport([sourceDocument, baseDocument]);
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const result = await resolver.resolve(
            sourceDocument,
            new vscode.Position(4, '    payload.tit'.length),
            'title',
            'D:/workspace'
        );

        expect(result).toEqual(new vscode.Location(
            baseDocument.uri,
            new vscode.Range(1, 11, 1, 16)
        ));
    });

    test('returns chained struct and class member definitions for statically typed receivers', async () => {
        const source = [
            'class Payload {',
            '    string title;',
            '    int amount;',
            '}',
            '',
            'struct Record {',
            '    class Payload payload;',
            '}',
            '',
            'void demo() {',
            '    struct Record record;',
            '    record.payload.title;',
            '    record.payload->amount;',
            '}'
        ].join('\n');
        const document = createDocument('D:/workspace/chain_room.c', source);
        const analysisService = DocumentSemanticSnapshotService.getInstance();
        const support = createSupport({
            analysisService: {
                getSemanticSnapshot: jest.fn((targetDocument: vscode.TextDocument) =>
                    analysisService.getSemanticSnapshot(targetDocument, false)
                ),
                getBestAvailableSnapshot: jest.fn((targetDocument: vscode.TextDocument) =>
                    analysisService.getSemanticSnapshot(targetDocument, false)
                )
            } as any
        });
        const resolver = new DirectSymbolDefinitionResolver({
            support,
            efunDocsManager: { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            semanticAdapter: {
                resolveVisibleVariableLocation: jest.fn().mockReturnValue(undefined)
            }
        } as any);

        const title = await resolver.resolve(
            document,
            new vscode.Position(11, '    record.payload.tit'.length),
            'title',
            'D:/workspace'
        );
        const amount = await resolver.resolve(
            document,
            new vscode.Position(12, '    record.payload->amo'.length),
            'amount',
            'D:/workspace'
        );

        expect(title).toEqual(new vscode.Location(
            document.uri,
            new vscode.Range(1, 11, 1, 16)
        ));
        expect(amount).toEqual(new vscode.Location(
            document.uri,
            new vscode.Range(2, 8, 2, 14)
        ));
    });
});
