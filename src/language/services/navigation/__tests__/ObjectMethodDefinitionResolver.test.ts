import { describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { ObjectMethodDefinitionResolver } from '../definition/ObjectMethodDefinitionResolver';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';
import { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';

function createTextDocument(filePath: string, source: string): vscode.TextDocument {
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        getText: jest.fn(() => source),
        getWordRangeAtPosition: jest.fn(() => new vscode.Range(0, 0, 0, 8))
    } as unknown as vscode.TextDocument;
}

function createSupport(): DefinitionResolverSupport {
    const host = {
        onDidChangeTextDocument: () => ({ dispose() {} }),
        openTextDocument: jest.fn(),
        findFiles: jest.fn(),
        getWorkspaceFolder: jest.fn(() => ({ uri: { fsPath: 'D:/workspace' } })),
        getWorkspaceFolders: jest.fn(() => [{ uri: { fsPath: 'D:/workspace' } }]),
        fileExists: jest.fn().mockReturnValue(false)
    };
    return new DefinitionResolverSupport({
        astManager: {} as any,
        host,
        pathSupport: new WorkspaceDocumentPathSupport({ host }),
    } as any);
}

describe('ObjectMethodDefinitionResolver', () => {
    test('returns deduped locations for valid receiver candidates', async () => {
        const sharedLocation = new vscode.Location(
            vscode.Uri.file('D:/workspace/obj/npc.c'),
            new vscode.Range(4, 0, 4, 10)
        );
        const resolver = new ObjectMethodDefinitionResolver({
            support: createSupport(),
            objectInferenceService: {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_hp',
                    inference: {
                        status: 'resolved',
                        candidates: [
                            { path: 'D:/workspace/obj/npc.c' },
                            { path: 'D:/workspace/obj/npc_alias.c' }
                        ]
                    }
                })
            },
            targetMethodLookup: {
                findMethod: jest.fn()
                    .mockResolvedValueOnce({ location: sharedLocation })
                    .mockResolvedValueOnce({ location: sharedLocation })
            }
        } as any);

        const result = await resolver.resolve(
            createTextDocument('D:/workspace/cmds/test.c', 'target->query_hp();'),
            new vscode.Position(0, 10),
            'query_hp'
        );

        expect(result).toEqual([sharedLocation]);
    });

    test('returns undefined for unknown or unsupported object inference', async () => {
        const resolver = new ObjectMethodDefinitionResolver({
            support: createSupport(),
            objectInferenceService: {
                inferObjectAccess: jest.fn().mockResolvedValue({
                    memberName: 'query_hp',
                    inference: {
                        status: 'unknown',
                        candidates: []
                    }
                })
            },
            targetMethodLookup: {
                findMethod: jest.fn()
            }
        } as any);

        await expect(
            resolver.resolve(
                createTextDocument('D:/workspace/cmds/test.c', 'target->query_hp();'),
                new vscode.Position(0, 10),
                'query_hp'
            )
        ).resolves.toBeUndefined();
    });
});
