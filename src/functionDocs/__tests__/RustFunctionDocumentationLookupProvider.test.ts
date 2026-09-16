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
                    structuredDocumentation: {
                        rawText: '/** structured by Rust */',
                        summary: 'Query a name from Rust.',
                        parameters: [{
                            typeName: 'object',
                            name: 'who',
                            description: 'Target object from Rust.'
                        }],
                        returns: { typeName: 'string', description: 'Display name.' },
                        details: 'Preserves multiline structured content.',
                        note: 'Indexed once.',
                        returnObjects: [],
                        extraTags: [{ name: 'warning', value: 'Preserved by Rust.' }],
                        issues: [{ code: 'stale-parameter-name', parameterName: 'old_name' }]
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
            summary: 'Query a name from Rust.',
            details: 'Preserves multiline structured content.',
            note: 'Indexed once.',
            returns: { type: 'string', description: 'Display name.' },
            modifiers: ['public', 'varargs'],
            declarationKind: 'implementation',
            documentationIssues: [{ code: 'stale-parameter-name', parameterName: 'old_name' }]
        }));
        expect(lookup.currentFile.entries[0].signatures[0]).toEqual(expect.objectContaining({
            returnType: 'string',
            parameters: [
                expect.objectContaining({ name: 'who', type: 'object', description: 'Target object from Rust.' }),
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

    test('loads simulated efun documentation from the indexed Rust workspace', async () => {
        (vscode.workspace as any).getWorkspaceFolder = jest.fn(() => ({
            uri: vscode.Uri.file('D:/mud')
        }));
        const sendRequest = jest.fn(async (_method: string, payload: any) => {
            if (!payload.textDocument.uri.endsWith('/adm/single/simul_efun.c')) {
                return undefined;
            }
            return {
                currentFile: {
                    uri: payload.textDocument.uri,
                    sourceKind: 'local',
                    depth: 0,
                    entries: [{
                        name: 'mud_write',
                        signature: 'void mud_write(string message)',
                        parameters: ['string message'],
                        documentation: '/** @brief Write to the player. */',
                        documentationRange: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 38 }
                        },
                        returnObjects: [],
                        range: {
                            start: { line: 1, character: 0 },
                            end: { line: 1, character: 38 }
                        },
                        selectionRange: {
                            start: { line: 1, character: 5 },
                            end: { line: 1, character: 14 }
                        },
                        hasBody: true
                    }]
                },
                inheritedGroups: [],
                includeGroups: []
            };
        });
        const provider = new RustFunctionDocumentationLookupProvider(
            { sendRequest } as any,
            { getAllFunctions: () => [], getStandardCallableDoc: jest.fn() } as any
        );
        const document = { uri: vscode.Uri.file('D:/mud/cmds/demo.c') } as vscode.TextDocument;
        const projectConfig = {
            projectConfigPath: 'D:/mud/lpc-support.json',
            resolvedConfig: { simulatedEfunFile: 'adm/single/simul_efun' }
        };

        await provider.ensureWorkspaceStateCurrent(document, projectConfig);

        expect(provider.getAllSimulatedFunctions(document, projectConfig)).toEqual(['mud_write']);
        expect(provider.getSimulatedDoc('mud_write', document, projectConfig)).toEqual(expect.objectContaining({
            summary: 'Write to the player.',
            sourceKind: 'simulEfun',
            declarationKind: 'external'
        }));
        expect(sendRequest).toHaveBeenCalledTimes(1);
    });
});
