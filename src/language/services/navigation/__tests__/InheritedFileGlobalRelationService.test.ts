import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { InheritedFileGlobalRelationService } from '../InheritedFileGlobalRelationService';
import {
    configureAstManagerSingletonForTests,
    resetAstManagerSingletonForTests
} from '../../../../__tests__/testAstManagerSingleton';

function createTextDocument(uriValue: string, source: string, version: number = 1): vscode.TextDocument {
    const uri = vscode.Uri.parse(uriValue);
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

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri,
        fileName: uri.fsPath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
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
        positionAt: jest.fn(positionAt),
        offsetAt: jest.fn(offsetAt),
        save: jest.fn(async () => true),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function positionOn(source: string, symbol: string, occurrence: number = 1): vscode.Position {
    let fromIndex = 0;
    let symbolIndex = -1;

    for (let seen = 0; seen < occurrence; seen += 1) {
        symbolIndex = source.indexOf(symbol, fromIndex);
        if (symbolIndex === -1) {
            throw new Error(`Could not find occurrence ${occurrence} of ${symbol}`);
        }

        fromIndex = symbolIndex + symbol.length;
    }

    const prefix = source.slice(0, symbolIndex);
    const line = prefix.split('\n').length - 1;
    const lastNewlineIndex = prefix.lastIndexOf('\n');
    const character = lastNewlineIndex === -1
        ? prefix.length
        : prefix.length - lastNewlineIndex - 1;

    return new vscode.Position(line, character + 1);
}

function documentLookupKey(target: string | vscode.Uri): string {
    const normalizeFsPathKey = (value: string): string => value.replace(/^\/+([A-Za-z]:[\\/])/, '/$1');

    if (typeof target === 'string') {
        return normalizeFsPathKey(vscode.Uri.parse(target).fsPath);
    }

    return normalizeFsPathKey(target.fsPath);
}

function createInheritanceResolverStub(
    implementation: (snapshot: { uri: string }) => unknown[] = () => []
): { resolveInheritTargets: jest.Mock } {
    return {
        resolveInheritTargets: jest.fn(implementation)
    };
}

describe('InheritedFileGlobalRelationService', () => {
    const analysisService = DocumentSemanticSnapshotService.getInstance();

    beforeEach(() => {
        configureAstManagerSingletonForTests(analysisService);
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
    });

    test('resolves a visible inherited file-global binding across a single provable branch', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/base.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [{
                            rawValue: '/base',
                            expressionKind: 'string',
                            sourceUri: childDocument.uri.toString(),
                            resolvedUri: parentDocument.uri.toString(),
                            isResolved: true
                        }];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution.status).toBe('resolved');
        if (resolution.status !== 'resolved') {
            throw new Error(`Expected resolved status, got ${resolution.status}`);
        }
        expect(resolution.binding.ownerUri).toBe('file:///D:/workspace/base.c');
        expect(resolution.binding.pathDocuments.map((document) => document.uri.toString())).toEqual([
            childDocument.uri.toString(),
            parentDocument.uri.toString()
        ]);
    });

    test('marks sibling branches with the same file-global as ambiguous', async () => {
        const childSource = 'inherit "/a";\ninherit "/b";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentASource = 'int GLOBAL_D;\n';
        const parentBSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentADocument = createTextDocument('file:///D:/workspace/a.c', parentASource);
        const parentBDocument = createTextDocument('file:///D:/workspace/b.c', parentBSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentADocument.uri.fsPath, parentADocument],
            [parentBDocument.uri.fsPath, parentBDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [
                            {
                                rawValue: '/a',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: parentADocument.uri.toString(),
                                isResolved: true
                            },
                            {
                                rawValue: '/b',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: parentBDocument.uri.toString(),
                                isResolved: true
                            }
                        ];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution).toEqual({ status: 'ambiguous' });
    });

    test('does not expand file-global references when inherit traversal is unresolved', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub(() => [{
                    rawValue: '/base',
                    expressionKind: 'string',
                    sourceUri: childDocument.uri.toString(),
                    resolvedUri: undefined,
                    isResolved: false
                }]),
            host: {
                openTextDocument: jest.fn()
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution).toEqual({ status: 'unresolved' });
    });

    test('returns unresolved when one inherited branch resolves but another resolved target cannot be opened', async () => {
        const childSource = 'inherit "/good";\ninherit "/bad";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/good.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [
                            {
                                rawValue: '/good',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: parentDocument.uri.toString(),
                                isResolved: true
                            },
                            {
                                rawValue: '/bad',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: 'file:///D:/workspace/missing.c',
                                isResolved: true
                            }
                        ];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution).toEqual({ status: 'unresolved' });
    });

    test('propagates nested unresolved branches instead of collapsing them into ambiguous', async () => {
        const childSource = 'inherit "/good";\ninherit "/nested";\nvoid demo() { GLOBAL_D += 1; }\n';
        const goodParentSource = 'int GLOBAL_D;\n';
        const nestedParentSource = 'inherit "/missing";\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const goodParentDocument = createTextDocument('file:///D:/workspace/good.c', goodParentSource);
        const nestedParentDocument = createTextDocument('file:///D:/workspace/nested.c', nestedParentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [goodParentDocument.uri.fsPath, goodParentDocument],
            [nestedParentDocument.uri.fsPath, nestedParentDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [
                            {
                                rawValue: '/good',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: goodParentDocument.uri.toString(),
                                isResolved: true
                            },
                            {
                                rawValue: '/nested',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: nestedParentDocument.uri.toString(),
                                isResolved: true
                            }
                        ];
                    }

                    if (snapshot.uri === nestedParentDocument.uri.toString()) {
                        return [{
                            rawValue: '/missing',
                            expressionKind: 'string',
                            sourceUri: nestedParentDocument.uri.toString(),
                            resolvedUri: undefined,
                            isResolved: false
                        }];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution).toEqual({ status: 'unresolved' });
    });

    test('merges same-owner diamond inheritance into one resolved binding instead of marking it ambiguous', async () => {
        const childSource = 'inherit "/left";\ninherit "/right";\nvoid demo() { GLOBAL_D += 1; }\n';
        const leftSource = 'inherit "/root";\n';
        const rightSource = 'inherit "/root";\n';
        const rootSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const leftDocument = createTextDocument('file:///D:/workspace/left.c', leftSource);
        const rightDocument = createTextDocument('file:///D:/workspace/right.c', rightSource);
        const rootDocument = createTextDocument('file:///D:/workspace/root.c', rootSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [leftDocument.uri.fsPath, leftDocument],
            [rightDocument.uri.fsPath, rightDocument],
            [rootDocument.uri.fsPath, rootDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [
                            {
                                rawValue: '/left',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: leftDocument.uri.toString(),
                                isResolved: true
                            },
                            {
                                rawValue: '/right',
                                expressionKind: 'string',
                                sourceUri: childDocument.uri.toString(),
                                resolvedUri: rightDocument.uri.toString(),
                                isResolved: true
                            }
                        ];
                    }

                    if (snapshot.uri === leftDocument.uri.toString() || snapshot.uri === rightDocument.uri.toString()) {
                        return [{
                            rawValue: '/root',
                            expressionKind: 'string',
                            sourceUri: snapshot.uri,
                            resolvedUri: rootDocument.uri.toString(),
                            isResolved: true
                        }];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution.status).toBe('resolved');
        if (resolution.status !== 'resolved') {
            throw new Error(`Expected resolved status, got ${resolution.status}`);
        }

        expect(resolution.binding.ownerUri).toBe('file:///D:/workspace/root.c');
        expect(new Set(resolution.binding.pathDocuments.map((document) => document.uri.toString()))).toEqual(new Set([
            childDocument.uri.toString(),
            leftDocument.uri.toString(),
            rightDocument.uri.toString(),
            rootDocument.uri.toString()
        ]));
    });

    test('returns none when no local or inherited file-global binding can be proven', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int OTHER_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/base.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [{
                            rawValue: '/base',
                            expressionKind: 'string',
                            sourceUri: childDocument.uri.toString(),
                            resolvedUri: parentDocument.uri.toString(),
                            isResolved: true
                        }];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution).toEqual({ status: 'none' });
    });

    test('collects only matches that still resolve to the same binding owner', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'inherit "/root";\nint GLOBAL_D;\nvoid demo() { GLOBAL_D += 1; }\n';
        const grandParentSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/base.c', parentSource);
        const grandParentDocument = createTextDocument('file:///D:/workspace/root.c', grandParentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument],
            [grandParentDocument.uri.fsPath, grandParentDocument]
        ]);
        const service = new InheritedFileGlobalRelationService({
            analysisService,
            inheritanceResolver: createInheritanceResolverStub((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [{
                            rawValue: '/base',
                            expressionKind: 'string',
                            sourceUri: childDocument.uri.toString(),
                            resolvedUri: parentDocument.uri.toString(),
                            isResolved: true
                        }];
                    }

                    if (snapshot.uri === parentDocument.uri.toString()) {
                        return [{
                            rawValue: '/root',
                            expressionKind: 'string',
                            sourceUri: parentDocument.uri.toString(),
                            resolvedUri: grandParentDocument.uri.toString(),
                            isResolved: true
                        }];
                    }

                    return [];
                }),
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const resolution = await service.resolveVisibleBinding(
            childDocument,
            'GLOBAL_D',
            positionOn(childSource, 'GLOBAL_D')
        );

        expect(resolution.status).toBe('resolved');
        if (resolution.status !== 'resolved') {
            throw new Error(`Expected resolved status, got ${resolution.status}`);
        }

        const matches = await service.collectReferences(resolution.binding, { includeDeclaration: true });

        expect(matches).toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: 'file:///D:/workspace/base.c', range: expect.objectContaining({ start: { line: 1, character: 4 } }) }),
            expect.objectContaining({ uri: 'file:///D:/workspace/base.c', range: expect.objectContaining({ start: { line: 2, character: 14 } }) }),
            expect.objectContaining({ uri: 'file:///D:/workspace/room.c', range: expect.objectContaining({ start: { line: 1, character: 14 } }) })
        ]));
        expect(matches).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: 'file:///D:/workspace/root.c' })
        ]));
    });
});
