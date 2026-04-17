import * as vscode from 'vscode';
import { afterEach, describe, expect, test } from '@jest/globals';
import { ASTManager } from '../../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../../completion/documentSemanticSnapshotService';
import { clearGlobalParsedDocumentService } from '../../../parser/ParsedDocumentService';
import { FunctionDocumentationService } from '../FunctionDocumentationService';

function createDocument(
    content: string,
    fileName: string = '/virtual/function-docs.c',
    version: number = 1
): vscode.TextDocument {
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lineStarts.length,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return content;
            }

            const startOffset = lineStarts[range.start.line] + range.start.character;
            const endOffset = lineStarts[range.end.line] + range.end.character;
            return content.slice(startOffset, endOffset);
        }),
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
        offsetAt: jest.fn((position: vscode.Position) => lineStarts[position.line] + position.character),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const start = lineStarts[line] ?? 0;
            const nextStart = line + 1 < lineStarts.length ? lineStarts[line + 1] : content.length;
            const end = content[nextStart - 1] === '\n' ? nextStart - 1 : nextStart;

            return {
                text: content.slice(start, end)
            };
        })
    } as unknown as vscode.TextDocument;
}

describe('FunctionDocumentationService', () => {
    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
        DocumentSemanticSnapshotService.getInstance().clear();
        clearGlobalParsedDocumentService();
    });

    test('parses supported tags, ignores malformed tags, and indexes declarations deterministically', () => {
        const source = [
            '/**',
            ' * @brief Primary summary',
            ' * @brief Ignored summary',
            ' * @details First details line',
            ' *   continuation line',
            ' *',
            ' *   second paragraph',
            ' * @details Second details block',
            ' * @note First note block',
            ' * @note Second note block',
            ' * @unknown should be ignored',
            ' * still ignored',
            ' * @param int value Value parameter description',
            ' *   continuation',
            ' * @param string name Name parameter description',
            ' * @param missing',
            ' * @return Returns the computed value.',
            ' * @return Ignored duplicate return.',
            ' * @lpc-return-objects { "/obj/alpha", "/obj/beta" }',
            ' */',
            'public int parse_me(int value, string name) {',
            '    return value;',
            '}',
            '',
            '/**',
            ' * @unknown no supported tags here',
            ' */',
            'int signature_only() {',
            '    return 0;',
            '}'
        ].join('\n');
        const document = createDocument(source);
        const service = new FunctionDocumentationService();

        const docs = service.getDocumentDocs(document);
        const declarationKey = docs.declarationOrder[0];
        const callableDoc = docs.byDeclaration.get(declarationKey);

        expect(docs.uri).toBe(document.uri.toString());
        expect(docs.declarationOrder).toHaveLength(2);
        expect(declarationKey).toMatch(/^file:\/\/.+#\d+:\d+-\d+:\d+$/);
        expect(docs.byName.get('parse_me')).toEqual([declarationKey]);
        expect(callableDoc).toBeDefined();
        expect(service.getDocForDeclaration(document, declarationKey)).toEqual(callableDoc);
        expect(service.getDocsByName(document, 'parse_me')).toEqual([callableDoc]);
        expect(callableDoc).toMatchObject({
            name: 'parse_me',
            summary: 'Primary summary',
            details: 'First details line\ncontinuation line\n\nsecond paragraph\n\nSecond details block',
            note: 'First note block\n\nSecond note block',
            returns: {
                description: 'Returns the computed value.'
            },
            returnObjects: ['/obj/alpha', '/obj/beta']
        });
        expect(callableDoc?.signatures).toHaveLength(1);
        expect(callableDoc?.signatures[0]).toMatchObject({
            label: 'public int parse_me(int value, string name)',
            returnType: 'int',
            isVariadic: false,
            parameters: [
                {
                    name: 'value',
                    type: 'int',
                    description: 'Value parameter description\ncontinuation'
                },
                {
                    name: 'name',
                    type: 'string',
                    description: 'Name parameter description'
                }
            ]
        });

        const signatureOnlyKey = docs.declarationOrder[1];
        const signatureOnlyDoc = docs.byDeclaration.get(signatureOnlyKey);
        expect(signatureOnlyDoc).toBeDefined();
        expect(signatureOnlyDoc).toMatchObject({
            name: 'signature_only',
            summary: undefined,
            details: undefined,
            note: undefined,
            returns: undefined,
            returnObjects: undefined
        });
        expect(signatureOnlyDoc?.signatures[0].label).toBe('int signature_only()');
    });

    test('returns undefined for malformed @lpc-return-objects without dropping other supported tags', () => {
        const source = [
            '/**',
            ' * @brief Broken objects summary',
            ' * @details Details still survive.',
            ' * @lpc-return-objects { "/obj/valid", 12 }',
            ' */',
            'int broken_objects() {',
            '    return 1;',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/broken-objects.c');
        const service = new FunctionDocumentationService();

        const [callableDoc] = service.getDocsByName(document, 'broken_objects');

        expect(callableDoc).toBeDefined();
        expect(callableDoc.summary).toBe('Broken objects summary');
        expect(callableDoc.details).toBe('Details still survive.');
        expect(callableDoc.returnObjects).toBeUndefined();
    });

    test('prefers an in-file implementation ahead of a leading prototype for same-name docs', () => {
        const source = [
            'private mapping execute_command(object actor, string arg);',
            '',
            '/**',
            ' * @brief 执行最小正式突破命令的结构化逻辑。',
            ' */',
            'mapping execute_command(object actor, string arg) {',
            '    return ([]);',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/prototype-leading-docs.c');
        const service = new FunctionDocumentationService();

        const docs = service.getDocsByName(document, 'execute_command');

        expect(docs).toHaveLength(2);
        expect(docs[0].summary).toBe('执行最小正式突破命令的结构化逻辑。');
        expect(docs[0].signatures[0].label).toBe('mapping execute_command(object actor, string arg)');
        expect(docs[1].summary).toBeUndefined();
        expect(docs[1].signatures[0].label).toBe('private mapping execute_command(object actor, string arg);');
    });

    test('rebuilds a document after invalidate(uri) and auto-refreshes same-version text changes', () => {
        const originalDocument = createDocument([
            '/**',
            ' * @brief Original summary',
            ' */',
            'int cached_doc() {',
            '    return 1;',
            '}'
        ].join('\n'), '/virtual/cache-rebuild.c', 1);
        const updatedDocument = createDocument([
            '/**',
            ' * @brief Updated summary',
            ' */',
            'int cached_doc() {',
            '    return 2;',
            '}'
        ].join('\n'), '/virtual/cache-rebuild.c', 1);
        const service = new FunctionDocumentationService();

        const originalDoc = service.getDocsByName(originalDocument, 'cached_doc')[0];
        const refreshedDoc = service.getDocsByName(updatedDocument, 'cached_doc')[0];

        expect(originalDoc.summary).toBe('Original summary');
        expect(refreshedDoc.summary).toBe('Updated summary');

        service.invalidate(updatedDocument.uri.toString());

        const rebuiltDoc = service.getDocsByName(updatedDocument, 'cached_doc')[0];
        expect(rebuiltDoc.summary).toBe('Updated summary');
    });

    test('rebuilds automatically when a newer document version is requested for the same uri', () => {
        const originalDocument = createDocument([
            '/**',
            ' * @brief Version one summary',
            ' */',
            'int versioned_doc() {',
            '    return 1;',
            '}'
        ].join('\n'), '/virtual/version-aware.c', 1);
        const updatedDocument = createDocument([
            '/**',
            ' * @brief Version two summary',
            ' */',
            'int versioned_doc() {',
            '    return 2;',
            '}'
        ].join('\n'), '/virtual/version-aware.c', 2);
        const service = new FunctionDocumentationService();

        const originalDoc = service.getDocsByName(originalDocument, 'versioned_doc')[0];
        const rebuiltDoc = service.getDocsByName(updatedDocument, 'versioned_doc')[0];

        expect(originalDoc.summary).toBe('Version one summary');
        expect(rebuiltDoc.summary).toBe('Version two summary');
    });

    test('returns defensive copies so callers cannot mutate the cached document docs', () => {
        const document = createDocument([
            '/**',
            ' * @brief Immutable summary',
            ' * @param int value Immutable parameter',
            ' */',
            'int immutable_doc(int value) {',
            '    return value;',
            '}'
        ].join('\n'), '/virtual/immutable-docs.c', 1);
        const service = new FunctionDocumentationService();

        const firstRead = service.getDocumentDocs(document);
        const declarationKey = firstRead.declarationOrder[0];
        const cachedDoc = firstRead.byDeclaration.get(declarationKey)!;

        firstRead.declarationOrder.push('corrupted-key');
        firstRead.byName.get('immutable_doc')?.push('corrupted-key');
        firstRead.byDeclaration.set('corrupted-key', cachedDoc);
        cachedDoc.summary = 'Mutated summary';
        cachedDoc.signatures[0].parameters[0].description = 'Mutated parameter';

        const secondRead = service.getDocumentDocs(document);
        const secondDoc = secondRead.byDeclaration.get(declarationKey)!;

        expect(secondRead.declarationOrder).toEqual([declarationKey]);
        expect(secondRead.byName.get('immutable_doc')).toEqual([declarationKey]);
        expect(secondRead.byDeclaration.has('corrupted-key')).toBe(false);
        expect(secondDoc.summary).toBe('Immutable summary');
        expect(secondDoc.signatures[0].parameters[0].description).toBe('Immutable parameter');
        expect(secondRead).not.toBe(firstRead);
        expect(secondDoc).not.toBe(cachedDoc);
    });
});
