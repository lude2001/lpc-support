import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ASTManager } from '../../../../ast/astManager';
import { InheritedSymbolRelationService } from '../InheritedSymbolRelationService';

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

describe('InheritedSymbolRelationService', () => {
    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
    });

    test('collectInheritedReferences includes only provable inherit-family function positions', async () => {
        const baseSource = 'void create() {}\n';
        const childSource = 'inherit "/base";\nvoid demo() {\n    ::create();\n}\n';
        const otherSource = 'void demo() { create(); }\n';
        const baseDocument = createTextDocument('file:///D:/workspace/base.c', baseSource);
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const otherDocument = createTextDocument('file:///D:/workspace/other.c', otherSource);
        const documents = new Map([
            [baseDocument.uri.toString(), baseDocument],
            [childDocument.uri.toString(), childDocument],
            [otherDocument.uri.toString(), otherDocument]
        ]);

        const service = new InheritedSymbolRelationService({
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
                    if (snapshot.uri === childDocument.uri.toString()) {
                        return [{
                            rawValue: '/base',
                            expressionKind: 'string',
                            sourceUri: childDocument.uri.toString(),
                            resolvedUri: baseDocument.uri.toString(),
                            isResolved: true
                        }];
                    }

                    return [];
                })
            } as any,
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = typeof target === 'string' ? target : target.toString();
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            },
            scopedMethodResolver: {
                resolveCallAt: jest.fn(async (document: vscode.TextDocument, position: vscode.Position) => {
                    if (
                        document.uri.toString() === childDocument.uri.toString()
                        && position.line === 2
                    ) {
                        return {
                            status: 'resolved',
                            methodName: 'create',
                            targets: [{
                                path: baseDocument.fileName,
                                methodName: 'create',
                                document: baseDocument,
                                location: new vscode.Location(baseDocument.uri, new vscode.Range(0, 5, 0, 11)),
                                declarationRange: new vscode.Range(0, 5, 0, 11),
                                sourceLabel: baseDocument.fileName
                            }]
                        };
                    }

                    return undefined;
                })
            } as any
        });

        const matches = await service.collectInheritedReferences(
            childDocument,
            positionOn(childSource, 'create'),
            { includeDeclaration: true }
        );

        expect(matches).toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: expect.stringContaining('/base.c'), range: expect.objectContaining({ start: { line: 0, character: 5 } }) }),
            expect.objectContaining({ uri: expect.stringContaining('/room.c'), range: expect.objectContaining({ start: { line: 2, character: 4 } }) })
        ]));
        expect(matches).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: expect.stringContaining('/other.c') })
        ]));
    });

    test('collectInheritedReferences returns no scoped function matches when room:: qualifier is not unique', async () => {
        const childSource = 'void demo() {\n    room::init();\n}\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const service = new InheritedSymbolRelationService({
            inheritanceResolver: {
                resolveInheritTargets: jest.fn(() => [])
            } as any,
            host: {
                openTextDocument: jest.fn()
            },
            scopedMethodResolver: {
                resolveCallAt: jest.fn(async () => ({
                    status: 'multiple',
                    qualifier: 'room',
                    methodName: 'init',
                    targets: []
                }))
            } as any
        });

        const matches = await service.collectInheritedReferences(
            childDocument,
            positionOn(childSource, 'init'),
            { includeDeclaration: true }
        );

        expect(matches).toEqual([]);
    });

    test('collectInheritedReferences does not expand function references when the traversed inherit chain is unresolved', async () => {
        const childSource = 'void create() {}\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const service = new InheritedSymbolRelationService({
            inheritanceResolver: {
                resolveInheritTargets: jest.fn(() => [{
                    rawValue: '/base',
                    expressionKind: 'string',
                    sourceUri: childDocument.uri.toString(),
                    resolvedUri: undefined,
                    isResolved: false
                }])
            } as any,
            host: {
                openTextDocument: jest.fn()
            }
        });

        const matches = await service.collectInheritedReferences(
            childDocument,
            positionOn(childSource, 'create'),
            { includeDeclaration: true }
        );

        expect(matches).toEqual([]);
    });

    test('buildInheritedRenameEdits returns no inherited edits when sibling inherit branches make the global binding ambiguous', async () => {
        const childSource = 'void demo() { GLOBAL_D += 1; }\n';
        const parentASource = 'int GLOBAL_D;\n';
        const parentBSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentADocument = createTextDocument('file:///D:/workspace/a.c', parentASource);
        const parentBDocument = createTextDocument('file:///D:/workspace/b.c', parentBSource);
        const documents = new Map([
            [childDocument.uri.toString(), childDocument],
            [parentADocument.uri.toString(), parentADocument],
            [parentBDocument.uri.toString(), parentBDocument]
        ]);

        const service = new InheritedSymbolRelationService({
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = typeof target === 'string' ? target : target.toString();
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            }
        });

        const edits = await service.buildInheritedRenameEdits(
            childDocument,
            positionOn(childSource, 'GLOBAL_D'),
            'RENAMED_D'
        );

        expect(edits).toEqual({});
    });
});
