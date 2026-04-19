import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';
import { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';

function createDocument(filePath: string): vscode.TextDocument {
    return {
        uri: {
            fsPath: filePath,
            toString: () => `file:///${filePath.replace(/\\/g, '/')}`
        },
        fileName: filePath,
        version: 1,
        getText: () => '',
        getWordRangeAtPosition: () => undefined
    } as unknown as vscode.TextDocument;
}

function normalizePath(filePath: string): string {
    return filePath.replace(/\//g, '\\').toLowerCase();
}

function createTextDocument(filePath: string, text: string = ''): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: Math.max(1, text.split(/\r?\n/).length),
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: jest.fn(() => text),
        lineAt: jest.fn((line: number) => ({ text: text.split(/\r?\n/)[line] ?? '' })),
        getWordRangeAtPosition: jest.fn(() => undefined),
        save: jest.fn(async () => true),
        positionAt: jest.fn((offset: number) => new vscode.Position(0, offset)),
        offsetAt: jest.fn((position: vscode.Position) => position.character),
        validateRange: jest.fn((range: vscode.Range) => range),
        validatePosition: jest.fn((position: vscode.Position) => position)
    } as unknown as vscode.TextDocument;
}

function createSupportHarness() {
    let changeListener: ((event: { document: { uri: { fsPath: string } } }) => void) | undefined;
    const sourcePath = 'D:/workspace/src/test.c';
    const headerPath = 'D:/workspace/src/include/shared.h';
    const sourceDocument = createTextDocument(sourcePath, '#include "shared.h"\nvoid entry() {}');
    const headerDocument = createTextDocument(headerPath, 'void headerFn() {}');
    const openTextDocument = jest.fn(async (target: string | vscode.Uri) => {
        const fsPath = typeof target === 'string' ? target : target.fsPath;
        const normalized = normalizePath(fsPath);
        if (normalized.endsWith('test.c')) {
            return sourceDocument;
        }
        if (normalized.endsWith('shared.h')) {
            return headerDocument;
        }

        throw new Error(`Unexpected document request: ${fsPath}`);
    });
    const getSemanticSnapshot = jest.fn((document: vscode.TextDocument) => {
        if (normalizePath(document.uri.fsPath) === normalizePath(headerPath)) {
            return {
                exportedFunctions: [{ name: 'headerFn' }]
            };
        }

        return {
            includeStatements: [{
                value: 'include/shared',
                isSystemInclude: false,
                range: new vscode.Range(0, 0, 0, 0)
            }],
            exportedFunctions: []
        };
    });
    const host = {
        onDidChangeTextDocument: (listener: (event: { document: { uri: { fsPath: string } } }) => void) => {
            changeListener = listener;
            return { dispose() {} };
        },
        openTextDocument,
        findFiles: jest.fn(),
        getWorkspaceFolder: () => ({ uri: { fsPath: 'D:/workspace' } }),
        getWorkspaceFolders: () => [{ uri: { fsPath: 'D:/workspace' } }],
        fileExists: jest.fn((filePath: string) =>
            normalizePath(filePath).endsWith('test.c')
            || normalizePath(filePath).endsWith('shared.h'))
    } as any;
    const semanticAdapter = {
        findFunctionLocation: jest.fn((document: vscode.TextDocument, functionName: string) => {
            if (normalizePath(document.uri.fsPath) === normalizePath(headerPath) && functionName === 'headerFn') {
                return new vscode.Location(document.uri, new vscode.Range(0, 5, 0, 14));
            }

            return undefined;
        }),
        getIncludeStatements: jest.fn((document: vscode.TextDocument) => {
            if (normalizePath(document.uri.fsPath).endsWith('.c')) {
                return [{
                    value: 'include/shared',
                    isSystemInclude: false,
                    range: new vscode.Range(0, 0, 0, 0)
                }];
            }

            return [];
        })
    };
    const support = new DefinitionResolverSupport({
        astManager: {
            getSemanticSnapshot
        } as any,
        host,
        pathSupport: new WorkspaceDocumentPathSupport({ host }),
        semanticAdapter: semanticAdapter as any
    } as any);

    return {
        support,
        sourcePath,
        headerPath,
        sourceDocument,
        headerDocument,
        openTextDocument,
        getSemanticSnapshot,
        semanticAdapter,
        emitChange(filePath: string) {
            changeListener?.({
                document: {
                    uri: {
                        fsPath: filePath
                    }
                }
            });
        }
    };
}

describe('DefinitionResolverSupport', () => {
    test('createRequestState returns fresh traversal state per request', () => {
        const host = {
            onDidChangeTextDocument: () => ({ dispose() {} }),
            openTextDocument: jest.fn(),
            fileExists: jest.fn().mockReturnValue(false),
            getWorkspaceFolder: jest.fn(() => undefined)
        } as any;
        const support = new DefinitionResolverSupport({
            astManager: {} as any,
            host,
            pathSupport: new WorkspaceDocumentPathSupport({ host })
        } as any);

        const first = support.createRequestState();
        const second = support.createRequestState();

        first.processedFiles.add('D:/workspace/std/room.c');
        first.functionDefinitions.set('create', new vscode.Location(vscode.Uri.file('D:/workspace/std/room.c'), new vscode.Position(0, 0)));

        expect(second.processedFiles.size).toBe(0);
        expect(second.functionDefinitions.size).toBe(0);
        expect(second).not.toBe(first);
    });

    test('toVsCodeLocation preserves the original language source uri for downstream normalization', () => {
        const host = {
            onDidChangeTextDocument: () => ({ dispose() {} }),
            openTextDocument: jest.fn(),
            fileExists: jest.fn().mockReturnValue(false),
            getWorkspaceFolder: jest.fn(() => undefined)
        } as any;
        const support = new DefinitionResolverSupport({
            astManager: {} as any,
            host,
            pathSupport: new WorkspaceDocumentPathSupport({ host })
        } as any);

        const location = support.toVsCodeLocation({
            uri: 'file:///D:/workspace/include/helper.h',
            range: {
                start: { line: 4, character: 2 },
                end: { line: 4, character: 18 }
            }
        });

        expect(location.uri.fsPath).toContain('D:/workspace/include/helper.h');
        expect((location as vscode.Location & { __languageSourceUri?: string }).__languageSourceUri)
            .toBe('file:///D:/workspace/include/helper.h');
    });

    test('getWorkspaceRoot falls back to the document directory when the host has no workspace folder', () => {
        const host = {
            onDidChangeTextDocument: () => ({ dispose() {} }),
            openTextDocument: jest.fn(),
            fileExists: jest.fn().mockReturnValue(false),
            getWorkspaceFolder: () => undefined
        } as any;
        const support = new DefinitionResolverSupport({
            astManager: {} as any,
            host,
            pathSupport: new WorkspaceDocumentPathSupport({ host })
        } as any);

        expect(support.getWorkspaceRoot(createDocument('D:/workspace/cmds/std/test.c'))).toBe('D:/workspace/cmds/std');
    });

    test('.h changes invalidate headerFunctionCache through public lookup behavior', async () => {
        const {
            support,
            headerPath,
            getSemanticSnapshot,
            emitChange
        } = createSupportHarness();

        await support.getHeaderFunctionIndex(headerPath);
        expect(getSemanticSnapshot).toHaveBeenCalledTimes(1);

        emitChange(headerPath);

        await support.getHeaderFunctionIndex(headerPath);
        expect(getSemanticSnapshot).toHaveBeenCalledTimes(2);
    });

    test('.h changes invalidate dependent includeFileCache entries through public lookup behavior', async () => {
        const {
            support,
            sourcePath,
            headerPath,
            openTextDocument,
            emitChange
        } = createSupportHarness();

        const first = await support.getIncludeFiles(sourcePath);
        expect(first).toHaveLength(1);
        expect(openTextDocument).toHaveBeenCalledTimes(1);

        emitChange(first[0]);

        await support.getIncludeFiles(sourcePath);
        expect(openTextDocument).toHaveBeenCalledTimes(2);
    });

    test('non-.h changes only invalidate their own include cache and preserve header cache', async () => {
        const {
            support,
            sourcePath,
            headerPath,
            getSemanticSnapshot,
            openTextDocument,
            emitChange
        } = createSupportHarness();

        await support.getHeaderFunctionIndex(headerPath);
        await support.getIncludeFiles(sourcePath);
        expect(getSemanticSnapshot).toHaveBeenCalledTimes(1);
        expect(openTextDocument).toHaveBeenCalledTimes(2);

        emitChange(sourcePath);

        await support.getHeaderFunctionIndex(headerPath);
        await support.getIncludeFiles(sourcePath);

        expect(getSemanticSnapshot).toHaveBeenCalledTimes(1);
        expect(openTextDocument).toHaveBeenCalledTimes(3);
    });
});
