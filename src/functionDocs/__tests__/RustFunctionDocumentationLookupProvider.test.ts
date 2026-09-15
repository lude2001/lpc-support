import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import { RustFunctionDocumentationLookupProvider } from '../services/RustFunctionDocumentationLookupProvider';

describe('RustFunctionDocumentationLookupProvider', () => {
    test('materializes structured docs and dependency groups without parsing LPC in TS', async () => {
        const sendRequest = jest.fn(async () => ({
            currentFile: {
                uri: 'file:///mud/demo.c',
                sourceKind: 'local',
                depth: 0,
                entries: [{
                    name: 'query_name',
                    signature: 'public varargs string query_name(object who, int mode)',
                    parameters: ['object who', 'int mode'],
                    documentation: '/**\n * @brief Query a name.\n * @param object who Target object.\n * @return string Display name.\n */',
                    documentationRange: {
                        start: { line: 0, character: 0 },
                        end: { line: 4, character: 3 }
                    },
                    returnObjects: [],
                    range: {
                        start: { line: 5, character: 0 },
                        end: { line: 7, character: 1 }
                    },
                    selectionRange: {
                        start: { line: 5, character: 22 },
                        end: { line: 5, character: 32 }
                    },
                    hasBody: true
                }]
            },
            inheritedGroups: [{
                uri: 'file:///mud/std/base.c',
                sourceKind: 'inherit',
                depth: 1,
                parentUri: 'file:///mud/demo.c',
                entries: []
            }],
            includeGroups: []
        }));
        const provider = new RustFunctionDocumentationLookupProvider(
            { sendRequest } as any,
            { getAllFunctions: () => ['write'], getStandardCallableDoc: jest.fn() } as any
        );
        const document = {
            uri: vscode.Uri.parse('file:///mud/demo.c')
        } as vscode.TextDocument;

        const lookup = await provider.getFunctionDocLookupForDocument(document);

        expect(sendRequest).toHaveBeenCalledWith('lpc/functionDocumentation', {
            textDocument: { uri: document.uri.toString() }
        });
        expect(lookup.currentFile.entries[0]).toEqual(expect.objectContaining({
            name: 'query_name',
            summary: 'Query a name.',
            returns: { type: 'string', description: 'string Display name.' },
            modifiers: ['public', 'varargs'],
            declarationKind: 'implementation'
        }));
        expect(lookup.currentFile.entries[0].signatures[0]).toEqual(expect.objectContaining({
            returnType: 'string',
            parameters: [
                expect.objectContaining({ name: 'who', type: 'object', description: 'Target object.' }),
                expect.objectContaining({ name: 'mode', type: 'int' })
            ],
            arity: { min: 0, max: 2 }
        }));
        expect(lookup.inheritedGroups[0]).toEqual(expect.objectContaining({
            sourceKind: 'inherit',
            depth: 1
        }));
        expect(provider.getAllFunctions()).toEqual(['write']);
    });
});
