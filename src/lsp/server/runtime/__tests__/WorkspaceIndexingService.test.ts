import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { WorkspaceIndexingService } from '../WorkspaceIndexingService';

describe('WorkspaceIndexingService', () => {
    test('rebuilds a best-effort workspace index from LPC source files', async () => {
        const sourceDocument = createDocument('file:///D:/mud/room/main.c', 'D:/mud/room/main.c');
        const headerDocument = createDocument('file:///D:/mud/include/base.h', 'D:/mud/include/base.h');
        const degradedDocument = createDocument('file:///D:/mud/lib/broken.lpc', 'D:/mud/lib/broken.lpc');
        const projectSymbolIndex = {
            clear: jest.fn(),
            updateFromSemanticSnapshot: jest.fn()
        };
        const pathSupport = {
            findWorkspaceSourceFiles: jest.fn(async (_workspaceRoot: string, extension: string) => {
                if (extension === '.c') {
                    return ['D:/mud/room/main.c'];
                }
                if (extension === '.h') {
                    return ['D:/mud/include/base.h'];
                }
                if (extension === '.lpc') {
                    return ['D:/mud/lib/broken.lpc'];
                }
                return [];
            }),
            tryOpenTextDocument: jest.fn(async (filePath: string) => {
                if (filePath.endsWith('main.c')) {
                    return sourceDocument;
                }
                if (filePath.endsWith('base.h')) {
                    return headerDocument;
                }
                if (filePath.endsWith('broken.lpc')) {
                    return degradedDocument;
                }
                return undefined;
            }),
            getWorkspaceFolderRoot: jest.fn(() => 'D:/mud'),
            resolveIncludeFilePaths: jest.fn(async () => ['D:/mud/include/base.h']),
            fileExists: jest.fn((filePath: string) => filePath.endsWith('base.h'))
        };
        const analysisService = {
            getSemanticSnapshot: jest.fn((document: vscode.TextDocument) => {
                if (document === degradedDocument) {
                    return createSemanticSnapshot(document, { degraded: true });
                }
                if (document === sourceDocument) {
                    return createSemanticSnapshot(document, {
                        includeStatements: [{
                            value: '/include/base.h',
                            isSystemInclude: false,
                            range: createRange()
                        }]
                    });
                }
                return createSemanticSnapshot(document);
            })
        };
        const service = new WorkspaceIndexingService({
            analysisService,
            pathSupport: pathSupport as any,
            projectSymbolIndex: projectSymbolIndex as any
        });

        const progress = jest.fn();
        const result = await service.rebuild({
            workspaceRoots: ['D:/mud'],
            workspaces: [{
                workspaceRoot: 'D:/mud',
                projectConfigPath: 'D:/mud/lpc-support.json'
            }]
        }, progress);

        expect(projectSymbolIndex.clear).toHaveBeenCalledTimes(1);
        expect(pathSupport.findWorkspaceSourceFiles).toHaveBeenCalledWith('D:/mud', '.c');
        expect(pathSupport.findWorkspaceSourceFiles).toHaveBeenCalledWith('D:/mud', '.h');
        expect(pathSupport.findWorkspaceSourceFiles).toHaveBeenCalledWith('D:/mud', '.lpc');
        expect(projectSymbolIndex.updateFromSemanticSnapshot).toHaveBeenCalledTimes(2);
        expect(projectSymbolIndex.updateFromSemanticSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            uri: sourceDocument.uri.toString(),
            includeStatements: [expect.objectContaining({
                resolvedUri: vscode.Uri.file('D:/mud/include/base.h').toString()
            })]
        }));
        expect(result).toEqual(expect.objectContaining({
            status: 'ready',
            totalFiles: 3,
            indexedFiles: 2,
            skippedFiles: 1,
            failedFiles: 0
        }));
        expect(progress).toHaveBeenCalledWith(expect.objectContaining({
            status: 'building',
            totalFiles: 3,
            processedFiles: 0
        }));
        expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({
            status: 'building',
            totalFiles: 3,
            processedFiles: 3,
            indexedFiles: 2,
            skippedFiles: 1,
            failedFiles: 0
        }));
    });

    test('keeps the previous index when workspace file collection fails', async () => {
        const projectSymbolIndex = {
            clear: jest.fn(),
            updateFromSemanticSnapshot: jest.fn()
        };
        const pathSupport = {
            findWorkspaceSourceFiles: jest.fn(async () => {
                throw new Error('scan failed');
            })
        };
        const service = new WorkspaceIndexingService({
            analysisService: {
                getSemanticSnapshot: jest.fn()
            },
            pathSupport: pathSupport as any,
            projectSymbolIndex: projectSymbolIndex as any
        });

        await expect(service.rebuild({
            workspaceRoots: ['D:/mud'],
            workspaces: []
        })).rejects.toThrow('scan failed');

        expect(projectSymbolIndex.clear).not.toHaveBeenCalled();
        expect(projectSymbolIndex.updateFromSemanticSnapshot).not.toHaveBeenCalled();
    });
});

function createDocument(uri: string, fileName: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.parse(uri),
        fileName,
        languageId: 'lpc',
        version: 1,
        lineCount: 1,
        isDirty: false,
        isClosed: false,
        getText: () => '',
        lineAt: jest.fn() as any,
        offsetAt: jest.fn() as any,
        positionAt: jest.fn() as any,
        save: jest.fn() as any,
        eol: vscode.EndOfLine.LF
    } as vscode.TextDocument;
}

function createSemanticSnapshot(
    document: vscode.TextDocument,
    overrides: Record<string, unknown> = {}
) {
    return {
        uri: document.uri.toString(),
        version: document.version,
        exportedFunctions: [],
        symbols: [],
        typeDefinitions: [],
        fileGlobals: [],
        inheritStatements: [],
        includeStatements: [],
        macroDefinitions: [],
        macroReferences: [],
        createdAt: 1,
        ...overrides
    };
}

function createRange(): vscode.Range {
    return new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));
}
