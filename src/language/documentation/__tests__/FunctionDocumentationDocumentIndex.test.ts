import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import type { CallableDoc, DocumentCallableDocs } from '../types';
import { FunctionDocumentationDocumentIndex } from '../FunctionDocumentationDocumentIndex';

function createDocument(
    content: string,
    fileName: string = '/virtual/function-docs.c',
    version: number = 1
): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        getText: () => content
    } as unknown as vscode.TextDocument;
}

function createDocumentDocs(summary: string, uri: string): DocumentCallableDocs {
    const callableDoc: CallableDoc = {
        name: 'cached_doc',
        declarationKey: `${uri}#0:0-0:10`,
        signatures: [{
            label: 'int cached_doc()',
            parameters: [],
            isVariadic: false,
            returnType: 'int',
            rawSyntax: 'int cached_doc()'
        }],
        summary,
        sourceKind: 'local'
    };

    return {
        uri,
        declarationOrder: [callableDoc.declarationKey],
        byDeclaration: new Map([[callableDoc.declarationKey, callableDoc]]),
        byName: new Map([[callableDoc.name, [callableDoc.declarationKey]]])
    };
}

describe('FunctionDocumentationDocumentIndex', () => {
    test('reuses cached docs until text changes, then invalidates parsed state and rebuilds', () => {
        const originalDocument = createDocument('int cached_doc() { return 1; }', '/virtual/cache.c', 1);
        const updatedDocument = createDocument('int cached_doc() { return 2; }', '/virtual/cache.c', 1);
        const builder = {
            build: jest.fn()
                .mockReturnValueOnce(createDocumentDocs('Original summary', originalDocument.uri.toString()))
                .mockReturnValueOnce(createDocumentDocs('Updated summary', updatedDocument.uri.toString()))
        };
        const invalidateParsedDocument = jest.fn();
        const index = new FunctionDocumentationDocumentIndex({
            builder,
            invalidateParsedDocument
        });

        const first = index.getOrBuild(updatedDocument);
        const second = index.getOrBuild(updatedDocument);
        const refreshed = index.getOrBuild(originalDocument);

        expect(first.byDeclaration.get(first.declarationOrder[0])?.summary).toBe('Original summary');
        expect(second).toBe(first);
        expect(refreshed.byDeclaration.get(refreshed.declarationOrder[0])?.summary).toBe('Updated summary');
        expect(builder.build).toHaveBeenCalledTimes(2);
        expect(invalidateParsedDocument).toHaveBeenCalledWith(originalDocument.uri);
    });

    test('invalidate(uri) drops cached docs and clears the parsed-document owner', () => {
        const document = createDocument('int cached_doc() { return 1; }', '/virtual/cache.c', 1);
        const builder = {
            build: jest.fn()
                .mockReturnValueOnce(createDocumentDocs('Original summary', document.uri.toString()))
                .mockReturnValueOnce(createDocumentDocs('Rebuilt summary', document.uri.toString()))
        };
        const invalidateParsedDocument = jest.fn();
        const index = new FunctionDocumentationDocumentIndex({
            builder,
            invalidateParsedDocument
        });

        index.getOrBuild(document);
        index.invalidate(document.uri.toString());
        const rebuilt = index.getOrBuild(document);

        expect(rebuilt.byDeclaration.get(rebuilt.declarationOrder[0])?.summary).toBe('Rebuilt summary');
        expect(builder.build).toHaveBeenCalledTimes(2);
        expect(invalidateParsedDocument).toHaveBeenCalledWith(document.uri);
    });
});
