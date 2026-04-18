import { describe, expect, test } from '@jest/globals';
import * as vscode from 'vscode';
import { DefinitionResolverSupport } from '../definition/DefinitionResolverSupport';

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

describe('DefinitionResolverSupport', () => {
    test('createRequestState returns fresh traversal state per request', () => {
        const support = new DefinitionResolverSupport({
            astManager: {} as any,
            host: {
                onDidChangeTextDocument: () => ({ dispose() {} })
            } as any
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
        const support = new DefinitionResolverSupport({
            astManager: {} as any,
            host: {
                onDidChangeTextDocument: () => ({ dispose() {} })
            } as any
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
        const support = new DefinitionResolverSupport({
            astManager: {} as any,
            host: {
                onDidChangeTextDocument: () => ({ dispose() {} }),
                getWorkspaceFolder: () => undefined
            }
        } as any);

        expect(support.getWorkspaceRoot(createDocument('D:/workspace/cmds/std/test.c'))).toBe('D:/workspace/cmds/std');
    });
});
