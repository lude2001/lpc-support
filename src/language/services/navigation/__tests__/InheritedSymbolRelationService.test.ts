import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ASTManager } from '../../../../ast/astManager';
import { DocumentSemanticSnapshotService } from '../../../../semantic/documentSemanticSnapshotService';
import { InheritedFileGlobalRelationService } from '../InheritedFileGlobalRelationService';
import { InheritedFunctionRelationService } from '../InheritedFunctionRelationService';
import { InheritedSymbolRelationService } from '../InheritedSymbolRelationService';
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

function createInheritedSymbolRelationService(
    options: {
        analysisService: ConstructorParameters<typeof InheritedFunctionRelationService>[0]['analysisService'];
        functionRelationService?: Pick<InheritedFunctionRelationService, 'collectFunctionReferences'>;
        fileGlobalRelationService?: Pick<InheritedFileGlobalRelationService, 'resolveVisibleBinding' | 'collectReferences'>;
        inheritanceResolver?: any;
        host?: { openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument> };
        scopedMethodResolver?: any;
    }
): InheritedSymbolRelationService {
    return new InheritedSymbolRelationService({
        analysisService: options.analysisService,
        functionRelationService: options.functionRelationService ?? new InheritedFunctionRelationService({
            analysisService: options.analysisService,
            inheritanceResolver: options.inheritanceResolver,
            host: options.host,
            scopedMethodResolver: options.scopedMethodResolver
        }),
        fileGlobalRelationService: options.fileGlobalRelationService ?? new InheritedFileGlobalRelationService({
            analysisService: options.analysisService,
            inheritanceResolver: options.inheritanceResolver,
            host: options.host
        })
    });
}

describe('InheritedSymbolRelationService', () => {
    const analysisService = DocumentSemanticSnapshotService.getInstance();

    beforeEach(() => {
        configureAstManagerSingletonForTests(analysisService);
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        jest.restoreAllMocks();
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

        const service = createInheritedSymbolRelationService({
            analysisService,
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

    test('collectInheritedReferences delegates function references through the injected function relation seam without changing matches', async () => {
        const childSource = 'void create() {}\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const delegatedMatches = [{
            uri: 'file:///D:/workspace/base.c',
            range: new vscode.Range(0, 5, 0, 11)
        }];
        const functionRelationService = {
            collectFunctionReferences: jest.fn(async () => delegatedMatches)
        };

        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn(() => [])
            } as any,
            host: {
                openTextDocument: jest.fn()
            },
            functionRelationService
        });

        const matches = await service.collectInheritedReferences(
            childDocument,
            positionOn(childSource, 'create'),
            { includeDeclaration: true }
        );

        expect(functionRelationService.collectFunctionReferences).toHaveBeenCalledWith(
            childDocument,
            expect.any(vscode.Position),
            { includeDeclaration: true }
        );
        expect(matches).toEqual(delegatedMatches);
    });

    test('collectInheritedReferences returns no scoped function matches when room:: qualifier is not unique', async () => {
        const childSource = 'void demo() {\n    room::init();\n}\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const service = createInheritedSymbolRelationService({
            analysisService,
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
        const service = createInheritedSymbolRelationService({
            analysisService,
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

    test('collectInheritedReferences canonicalizes four-slash Windows inherit target URIs through the live path', async () => {
        const baseSource = 'void create() {}\n';
        const childSource = 'inherit "/base";\nvoid demo() {\n    ::create();\n}\n';
        const baseDocument = createTextDocument('file:////D:/workspace/base.c', baseSource);
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const documents = new Map([
            [baseDocument.uri.toString(), baseDocument],
            [childDocument.uri.toString(), childDocument]
        ]);

        const service = createInheritedSymbolRelationService({
            analysisService,
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

        const baseMatches = matches.filter((match) => match.uri === 'file:///D:/workspace/base.c');
        expect(baseMatches).toHaveLength(1);
        expect(matches).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: 'file://///D:/workspace/base.c' })
        ]));
    });

    test('classifyRenameTarget returns current-file-only for local variables and parameters', async () => {
        const localSource = 'void demo() { int localValue = 1; localValue += 1; }\n';
        const parameterSource = 'void demo(int value) { value += 1; }\n';
        const localDocument = createTextDocument('file:///D:/workspace/local.c', localSource);
        const parameterDocument = createTextDocument('file:///D:/workspace/parameter.c', parameterSource);
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn(() => [])
            } as any,
            host: {
                openTextDocument: jest.fn()
            }
        });

        await expect(service.classifyRenameTarget(
            localDocument,
            positionOn(localSource, 'localValue', 2)
        )).resolves.toEqual({ kind: 'current-file-only' });
        await expect(service.classifyRenameTarget(
            parameterDocument,
            positionOn(parameterSource, 'value', 2)
        )).resolves.toEqual({ kind: 'current-file-only' });
    });

    test.each([
        ['function', 'int query_id() { return 1; }\n', 'query_id'],
        ['struct', 'struct Payload {\n    int hp;\n}\n', 'Payload'],
        ['class', 'class Payload {\n    int hp;\n}\n', 'Payload']
    ] as const)('classifyRenameTarget returns unsupported for %s symbols', async (_label, source, symbol) => {
        const document = createTextDocument(`file:///D:/workspace/${symbol}.c`, source);
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn(() => [])
            } as any,
            host: {
                openTextDocument: jest.fn()
            }
        });

        await expect(service.classifyRenameTarget(
            document,
            positionOn(source, symbol)
        )).resolves.toEqual({ kind: 'unsupported' });
    });

    test('classifyRenameTarget returns file-global for current-file global variables', async () => {
        const source = 'int GLOBAL_D;\nvoid demo() { GLOBAL_D += 1; }\n';
        const document = createTextDocument('file:///D:/workspace/current-global.c', source);
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn(() => [])
            } as any,
            host: {
                openTextDocument: jest.fn()
            }
        });

        await expect(service.classifyRenameTarget(
            document,
            positionOn(source, 'GLOBAL_D', 2)
        )).resolves.toEqual({ kind: 'file-global' });
    });

    test('classifyRenameTarget returns file-global for provable inherited globals', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/base.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
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

        await expect(service.classifyRenameTarget(
            childDocument,
            positionOn(childSource, 'GLOBAL_D')
        )).resolves.toEqual({ kind: 'file-global' });
    });

    test('classifyRenameTarget stays unsupported when one inherited branch cannot be opened', async () => {
        const childSource = 'inherit "/good";\ninherit "/bad";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int GLOBAL_D;\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/good.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
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

        await expect(service.classifyRenameTarget(
            childDocument,
            positionOn(childSource, 'GLOBAL_D')
        )).resolves.toEqual({ kind: 'unsupported' });
    });

    test('collectInheritedReferences falls through to file-global matches when function and scoped paths miss', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int GLOBAL_D;\nvoid demo() { GLOBAL_D += 2; }\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/base.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const functionRelationService = {
            collectFunctionReferences: jest.fn(async () => [])
        };
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            },
            functionRelationService
        });

        const matches = await service.collectInheritedReferences(
            childDocument,
            positionOn(childSource, 'GLOBAL_D'),
            { includeDeclaration: true }
        );

        expect(functionRelationService.collectFunctionReferences).toHaveBeenCalledTimes(1);
        expect(matches).toEqual(expect.arrayContaining([
            expect.objectContaining({ uri: 'file:///D:/workspace/base.c', range: expect.objectContaining({ start: { line: 0, character: 4 } }) }),
            expect.objectContaining({ uri: 'file:///D:/workspace/base.c', range: expect.objectContaining({ start: { line: 1, character: 14 } }) }),
            expect.objectContaining({ uri: 'file:///D:/workspace/room.c', range: expect.objectContaining({ start: { line: 1, character: 14 } }) })
        ]));
    });

    test('collectInheritedReferences returns no inherited global matches when a nested branch is unresolved', async () => {
        const childSource = 'inherit "/good";\ninherit "/nested";\nvoid demo() { GLOBAL_D += 1; }\n';
        const goodParentSource = 'int GLOBAL_D;\nvoid demo() { GLOBAL_D += 2; }\n';
        const nestedParentSource = 'inherit "/missing";\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const goodParentDocument = createTextDocument('file:///D:/workspace/good.c', goodParentSource);
        const nestedParentDocument = createTextDocument('file:///D:/workspace/nested.c', nestedParentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [goodParentDocument.uri.fsPath, goodParentDocument],
            [nestedParentDocument.uri.fsPath, nestedParentDocument]
        ]);
        const functionRelationService = {
            collectFunctionReferences: jest.fn(async () => [])
        };
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
            host: {
                openTextDocument: jest.fn(async (target: string | vscode.Uri) => {
                    const key = documentLookupKey(target);
                    const document = documents.get(key);
                    if (!document) {
                        throw new Error(`Unknown document ${key}`);
                    }

                    return document;
                })
            },
            functionRelationService
        });

        const matches = await service.collectInheritedReferences(
            childDocument,
            positionOn(childSource, 'GLOBAL_D'),
            { includeDeclaration: true }
        );

        expect(functionRelationService.collectFunctionReferences).toHaveBeenCalledTimes(1);
        expect(matches).toEqual([]);
    });

    test('buildInheritedRenameEdits keeps same-owner diamond globals renameable instead of treating them as ambiguous', async () => {
        const childSource = 'inherit "/left";\ninherit "/right";\nvoid demo() { GLOBAL_D += 1; }\n';
        const leftSource = 'inherit "/root";\n';
        const rightSource = 'inherit "/root";\n';
        const rootSource = 'int GLOBAL_D;\nvoid demo() { GLOBAL_D += 2; }\n';
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
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
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

        await expect(service.classifyRenameTarget(
            childDocument,
            positionOn(childSource, 'GLOBAL_D')
        )).resolves.toEqual({ kind: 'file-global' });

        const edits = await service.buildInheritedRenameEdits(
            childDocument,
            positionOn(childSource, 'GLOBAL_D'),
            'RENAMED_D'
        );

        expect(edits).toEqual({
            'file:///D:/workspace/root.c': [
                {
                    range: new vscode.Range(0, 4, 0, 12),
                    newText: 'RENAMED_D'
                },
                {
                    range: new vscode.Range(1, 14, 1, 22),
                    newText: 'RENAMED_D'
                }
            ],
            'file:///D:/workspace/room.c': [
                {
                    range: new vscode.Range(2, 14, 2, 22),
                    newText: 'RENAMED_D'
                }
            ]
        });
    });

    test('buildInheritedRenameEdits returns inherited edits for a proved file-global success path', async () => {
        const childSource = 'inherit "/base";\nvoid demo() { GLOBAL_D += 1; }\n';
        const parentSource = 'int GLOBAL_D;\nvoid demo() { GLOBAL_D += 2; }\n';
        const childDocument = createTextDocument('file:///D:/workspace/room.c', childSource);
        const parentDocument = createTextDocument('file:///D:/workspace/base.c', parentSource);
        const documents = new Map([
            [childDocument.uri.fsPath, childDocument],
            [parentDocument.uri.fsPath, parentDocument]
        ]);
        const service = createInheritedSymbolRelationService({
            analysisService,
            inheritanceResolver: {
                resolveInheritTargets: jest.fn((snapshot: { uri: string }) => {
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
                })
            } as any,
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

        const edits = await service.buildInheritedRenameEdits(
            childDocument,
            positionOn(childSource, 'GLOBAL_D'),
            'RENAMED_D'
        );

        expect(edits).toEqual({
            'file:///D:/workspace/base.c': [
                {
                    range: new vscode.Range(0, 4, 0, 12),
                    newText: 'RENAMED_D'
                },
                {
                    range: new vscode.Range(1, 14, 1, 22),
                    newText: 'RENAMED_D'
                }
            ],
            'file:///D:/workspace/room.c': [
                {
                    range: new vscode.Range(1, 14, 1, 22),
                    newText: 'RENAMED_D'
                }
            ]
        });
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

        const service = createInheritedSymbolRelationService({
            analysisService,
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
