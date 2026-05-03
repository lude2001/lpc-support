import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createDefaultFunctionDocumentationService } from '../../language/documentation/FunctionDocumentationService';
import { FileFunctionDocTracker } from '../FileFunctionDocTracker';
import type { RawFunctionDocLookup } from '../FunctionDocLookupTypes';
import type { CallableDoc, DocumentCallableDocs } from '../../language/documentation/types';

function createLookup(
    overrides: Partial<RawFunctionDocLookup> = {}
): RawFunctionDocLookup {
    return {
        inheritedFiles: [],
        currentFile: {
            source: '当前文件',
            filePath: '/virtual/main.c',
            sourceKind: 'local',
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

function createDocumentDocs(docs: CallableDoc[] = [], uri = 'file:///virtual/main.c'): DocumentCallableDocs {
    const byDeclaration = new Map<string, CallableDoc>();
    const byName = new Map<string, string[]>();
    const declarationOrder: string[] = [];

    for (const doc of docs) {
        declarationOrder.push(doc.declarationKey);
        byDeclaration.set(doc.declarationKey, doc);
        byName.set(doc.name, [...(byName.get(doc.name) ?? []), doc.declarationKey]);
    }

    return {
        uri,
        declarationOrder,
        byDeclaration,
        byName
    };
}

describe('FileFunctionDocTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('public include lookup and grouped lookup reuse the same cached traversal result', async () => {
        const includeDoc: CallableDoc = {
            name: 'helper_live',
            declarationKey: 'file:///virtual/include/helper.h#helper_live',
            signatures: [],
            sourceKind: 'include'
        };
        const includeDocs = createDocumentDocs([includeDoc], 'file:///virtual/include/helper.h');
        const buildLookup = jest.fn().mockResolvedValue(createLookup({
            includeGroups: [{
                source: '包含自 helper.h',
                filePath: '/virtual/include/helper.h',
                sourceKind: 'include',
                docs: includeDocs
            }]
        }));

        const tracker = new FileFunctionDocTracker({
            lookupBuilder: { buildLookup },
            documentationService: createDefaultFunctionDocumentationService()
        });
        const document = {
            languageId: 'lpc',
            version: 1,
            fileName: '/virtual/main.c',
            uri: { fsPath: '/virtual/main.c', toString: () => 'file:///virtual/main.c' },
            getText: () => '#include "/include/helper.h"\n'
        } as unknown as vscode.TextDocument;

        const includeDocResult = await tracker.getDocFromIncludes(document, 'helper_live');
        const lookup = await tracker.getFunctionDocLookup(document);

        expect(includeDocResult).toMatchObject(includeDoc);
        expect(lookup.includeGroups).toHaveLength(1);
        expect(lookup.includeGroups[0].docs.get('helper_live')).toBe(includeDocResult);
        expect(buildLookup).toHaveBeenCalledTimes(1);
    });

    test('forceFresh bypasses cached lookup reuse for public lookups', async () => {
        const buildLookup = jest.fn()
            .mockResolvedValueOnce(createLookup())
            .mockResolvedValueOnce(createLookup());

        const tracker = new FileFunctionDocTracker({
            lookupBuilder: { buildLookup },
            documentationService: createDefaultFunctionDocumentationService()
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
    });
});
