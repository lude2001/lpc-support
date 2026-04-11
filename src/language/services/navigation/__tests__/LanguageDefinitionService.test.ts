import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { AstBackedLanguageDefinitionService } from '../LanguageDefinitionService';

function createDeferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

function createDocument(filePath: string, symbolName: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        version: 1,
        getText: jest.fn((range?: vscode.Range) => {
            if (!range) {
                return `${symbolName}();`;
            }

            return symbolName;
        }),
        getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, symbolName.length))
    } as unknown as vscode.TextDocument;
}

describe('AstBackedLanguageDefinitionService', () => {
    test('concurrent definition requests keep traversal state isolated per request', async () => {
        const host = {
            onDidChangeTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            openTextDocument: jest.fn(),
            findFiles: jest.fn(),
            getWorkspaceFolder: jest.fn((uri: vscode.Uri) => ({ uri: { fsPath: uri.fsPath.replace(/\\[^\\]+$/, '') } })),
            getWorkspaceFolders: jest.fn(),
            fileExists: jest.fn().mockReturnValue(false)
        };
        const objectInferenceService = {
            inferObjectAccess: jest.fn().mockResolvedValue(undefined)
        };
        const service = new AstBackedLanguageDefinitionService(
            { getMacro: jest.fn().mockReturnValue(undefined) } as any,
            { getSimulatedDoc: jest.fn().mockReturnValue(undefined) } as any,
            objectInferenceService as any,
            undefined,
            undefined,
            host as any
        );
        const alphaDocument = createDocument('D:\\workspace\\alpha.c', 'alpha_call');
        const betaDocument = createDocument('D:\\workspace\\beta.c', 'beta_call');
        const alphaLocation = new vscode.Location(
            alphaDocument.uri,
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10))
        );
        const betaLocation = new vscode.Location(
            betaDocument.uri,
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 9))
        );
        const firstRequestGate = createDeferred<void>();

        jest.spyOn(service as any, 'findFunctionDefinitions').mockImplementation(
            async (document: vscode.TextDocument, requestState: { functionDefinitions: Map<string, vscode.Location> }) => {
            if (document === alphaDocument) {
                requestState.functionDefinitions.set('alpha_call', alphaLocation);
                await firstRequestGate.promise;
                return;
            }

            if (document === betaDocument) {
                requestState.functionDefinitions.set('beta_call', betaLocation);
            }
        });
        jest.spyOn(service as any, 'findInheritedFunctionDefinitions').mockResolvedValue(undefined);
        jest.spyOn(service as any, 'findFunctionInCurrentFileIncludes').mockResolvedValue(undefined);

        const alphaPromise = service.provideDefinition({
            context: {
                document: alphaDocument as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 0, character: 1 }
        });
        await Promise.resolve();

        const betaResult = await service.provideDefinition({
            context: {
                document: betaDocument as any,
                workspace: { workspaceRoot: 'D:\\workspace' },
                mode: 'lsp'
            },
            position: { line: 0, character: 1 }
        });

        firstRequestGate.resolve();
        const alphaResult = await alphaPromise;

        expect(betaResult).toEqual([
            {
                uri: betaDocument.uri.toString(),
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 9 }
                }
            }
        ]);
        expect(alphaResult).toEqual([
            {
                uri: alphaDocument.uri.toString(),
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 }
                }
            }
        ]);
    });
});
