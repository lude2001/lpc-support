import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createDefaultFunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
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
            documentationService: createDefaultFunctionDocumentationService(),
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
            documentationService: createDefaultFunctionDocumentationService(),
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
