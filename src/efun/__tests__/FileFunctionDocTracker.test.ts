import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import { FileFunctionDocTracker } from '../FileFunctionDocTracker';
import type { MaterializedFunctionDocLookup, RawFunctionDocLookup } from '../FunctionDocLookupTypes';

function createLookup(
    overrides: Partial<RawFunctionDocLookup> = {}
): RawFunctionDocLookup {
    return {
        inheritedFiles: [],
        currentFile: {
            source: '当前文件',
            filePath: '/virtual/main.c',
            docs: {
                uri: 'file:///virtual/main.c',
                declarationOrder: [],
                byDeclaration: new Map(),
                byName: new Map()
            }
        },
        inheritedGroups: [],
        includeGroups: [],
        ...overrides
    };
}

function createMaterializedLookup(
    overrides: Partial<MaterializedFunctionDocLookup> = {}
): MaterializedFunctionDocLookup {
    return {
        inheritedFiles: [],
        currentFileDocs: new Map(),
        inheritedFileDocs: new Map(),
        includeFileDocs: new Map(),
        lookup: {
            currentFile: {
                source: '当前文件',
                filePath: '/virtual/main.c',
                docs: new Map()
            },
            inheritedGroups: [],
            includeGroups: []
        },
        ...overrides
    };
}

describe('FileFunctionDocTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('only the latest async update wins when updates overlap', async () => {
        const buildLookup = jest.fn().mockImplementation(async (document: vscode.TextDocument) => {
            if (document.fileName === 'first.c') {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return createLookup({
                    inheritedFiles: ['first.c'],
                    inheritedGroups: [{
                        source: '继承自 first.c',
                        filePath: 'first-path',
                        docs: {
                            uri: 'file:///first-path',
                            declarationOrder: [],
                            byDeclaration: new Map(),
                            byName: new Map()
                        }
                    }]
                });
            }

            return createLookup({
                inheritedFiles: ['second.c'],
                inheritedGroups: [{
                    source: '继承自 second.c',
                    filePath: 'second-path',
                    docs: {
                        uri: 'file:///second-path',
                        declarationOrder: [],
                        byDeclaration: new Map(),
                        byName: new Map()
                    }
                }]
            });
        });
        const materializeLookup = jest.fn().mockImplementation((lookup: RawFunctionDocLookup) => createMaterializedLookup({
            inheritedFiles: lookup.inheritedFiles,
            inheritedFileDocs: new Map(lookup.inheritedGroups.map((group) => [group.filePath, new Map()])),
            lookup: {
                currentFile: {
                    source: '当前文件',
                    filePath: 'virtual',
                    docs: new Map()
                },
                inheritedGroups: [],
                includeGroups: []
            }
        }));

        const tracker = new FileFunctionDocTracker({
            lookupBuilder: { buildLookup },
            documentationService: new FunctionDocumentationService(),
            compatMaterializer: { materializeLookup } as any
        }) as any;
        const firstDocument = {
            languageId: 'lpc',
            version: 1,
            fileName: 'first.c',
            uri: { fsPath: 'first.c', toString: () => 'file:///first.c' },
            getText: () => 'inherit "first";'
        } as vscode.TextDocument;
        const secondDocument = {
            languageId: 'lpc',
            version: 1,
            fileName: 'second.c',
            uri: { fsPath: 'second.c', toString: () => 'file:///second.c' },
            getText: () => 'inherit "second";'
        } as vscode.TextDocument;

        const firstUpdate = tracker.update(firstDocument);
        const secondUpdate = tracker.update(secondDocument);
        await Promise.all([firstUpdate, secondUpdate]);

        expect(tracker.currentFilePath).toBe('second.c');
        expect(tracker.inheritedFiles).toEqual(['second.c']);
        expect(Array.from(tracker.inheritedFileDocs.keys())).toEqual(['second-path']);
    });

    test('public include lookup and grouped lookup reuse the same cached traversal result', async () => {
        const includeDocs = new Map([['helper_live', { name: 'helper_live', category: '包含自 helper.h' } as any]]);
        const buildLookup = jest.fn().mockResolvedValue(createLookup());
        const materializeLookup = jest.fn().mockReturnValue(createMaterializedLookup({
            includeFileDocs: new Map([['/virtual/include/helper.h', includeDocs]]),
            lookup: {
                currentFile: {
                    source: '当前文件',
                    filePath: '/virtual/main.c',
                    docs: new Map()
                },
                inheritedGroups: [],
                includeGroups: [{
                    source: '包含自 helper.h',
                    filePath: '/virtual/include/helper.h',
                    docs: includeDocs
                }]
            }
        }));

        const tracker = new FileFunctionDocTracker({
            lookupBuilder: { buildLookup },
            documentationService: new FunctionDocumentationService(),
            compatMaterializer: { materializeLookup } as any
        });
        const document = {
            languageId: 'lpc',
            version: 1,
            fileName: '/virtual/main.c',
            uri: { fsPath: '/virtual/main.c', toString: () => 'file:///virtual/main.c' },
            getText: () => '#include "/include/helper.h"\n'
        } as unknown as vscode.TextDocument;

        const includeDoc = await tracker.getDocFromIncludes(document, 'helper_live');
        const lookup = await tracker.getFunctionDocLookup(document);

        expect(includeDoc).toBe(includeDocs.get('helper_live'));
        expect(lookup.includeGroups).toHaveLength(1);
        expect(lookup.includeGroups[0].docs.get('helper_live')).toBe(includeDocs.get('helper_live'));
        expect(buildLookup).toHaveBeenCalledTimes(1);
        expect(materializeLookup).toHaveBeenCalledTimes(1);
    });

    test('forceFresh bypasses cached lookup reuse for public lookups', async () => {
        const buildLookup = jest.fn()
            .mockResolvedValueOnce(createLookup())
            .mockResolvedValueOnce(createLookup());
        const materializeLookup = jest.fn().mockImplementation(() => createMaterializedLookup());

        const tracker = new FileFunctionDocTracker({
            lookupBuilder: { buildLookup },
            documentationService: new FunctionDocumentationService(),
            compatMaterializer: { materializeLookup } as any
        });
        const document = {
            languageId: 'lpc',
            version: 1,
            fileName: '/virtual/main.c',
            uri: { fsPath: '/virtual/main.c', toString: () => 'file:///virtual/main.c' },
            getText: () => 'int test();\n'
        } as unknown as vscode.TextDocument;

        await tracker.getFunctionDocLookup(document);
        await tracker.getDocFromIncludes(document, 'helper_live', { forceFresh: true });

        expect(buildLookup).toHaveBeenCalledTimes(2);
        expect(materializeLookup).toHaveBeenCalledTimes(2);
    });
});
