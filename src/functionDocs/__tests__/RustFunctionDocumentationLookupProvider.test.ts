import * as vscode from 'vscode';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { RustFunctionDocumentationLookupProvider } from '../services/RustFunctionDocumentationLookupProvider';

describe('RustFunctionDocumentationLookupProvider', () => {
    const locales = [
        { language: 'en', unavailable: 'The Rust language server did not return function documentation data.' },
        { language: 'zh-cn', unavailable: 'Rust 语言服务器未返回函数文档数据。' }
    ];

    afterEach(() => {
        (vscode.env as { language: string }).language = 'zh-cn';
    });

    test.each(locales)('reports a missing Rust snapshot in $language without changing the request', async locale => {
        (vscode.env as { language: string }).language = locale.language;
        const sendRequest = jest.fn(async () => undefined);
        const bundledEfuns = { getAllFunctions: jest.fn(() => []), getStandardCallableDoc: jest.fn() };
        const provider = new RustFunctionDocumentationLookupProvider({ sendRequest } as any, bundledEfuns as any);
        const document = { uri: vscode.Uri.parse('file:///mud/demo.c') } as vscode.TextDocument;

        await expect(provider.getFunctionDocLookupForDocument(document)).rejects.toThrow(new Error(locale.unavailable));

        expect(sendRequest).toHaveBeenCalledTimes(1);
        expect(sendRequest).toHaveBeenCalledWith('lpc/functionDocumentation', {
            textDocument: { uri: document.uri.toString() }
        });
        expect(bundledEfuns.getStandardCallableDoc).not.toHaveBeenCalled();
    });

    test.each(locales)('preserves an external Rust request failure verbatim in $language', async locale => {
        (vscode.env as { language: string }).language = locale.language;
        const original = new Error('Raw sidecar failure: 原始消息 {0}');
        const sendRequest = jest.fn(async () => { throw original; });
        const provider = new RustFunctionDocumentationLookupProvider(
            { sendRequest } as any, { getAllFunctions: () => [], getStandardCallableDoc: jest.fn() } as any
        );
        const document = { uri: vscode.Uri.parse('file:///mud/demo.c') } as vscode.TextDocument;

        await expect(provider.getFunctionDocLookupForDocument(document)).rejects.toBe(original);
        expect(sendRequest).toHaveBeenCalledWith('lpc/functionDocumentation', {
            textDocument: { uri: document.uri.toString() }
        });
    });

    test.each(locales)('materializes identical structured facts and user docs without parsing LPC in $language', async locale => {
        (vscode.env as { language: string }).language = locale.language;
        const sendRequest = jest.fn(async () => ({
            currentFile: {
                uri: 'file:///mud/demo.c',
                sourceKind: 'local',
                depth: 0,
                entries: [{
                    name: 'query_name',
                    signature: 'public varargs string query_name(object who, int mode)',
                    parameters: ['object who', 'int mode'],
                    structuredSignature: {
                        label: 'public varargs string query_name(object who, int mode: (: 0 :))',
                        rawSyntax: 'public varargs string query_name(object who, int mode: (: 0 :));',
                        returnType: 'string',
                        modifiers: ['public', 'varargs'],
                        parameters: [{
                            label: 'object who',
                            name: 'who',
                            typeName: 'object',
                            passingMode: 'value',
                            arrayDepth: 0,
                            variadic: false,
                            isVariadicCollector: false,
                            optional: false
                        }, {
                            label: 'int mode: (: 0 :)',
                            name: 'mode',
                            typeName: 'int',
                            passingMode: 'value',
                            arrayDepth: 0,
                            variadic: false,
                            isVariadicCollector: false,
                            optional: true,
                            defaultValueText: '(: 0 :)'
                        }],
                        functionVarargs: true,
                        trueVariadic: false,
                        variadicKind: 'permissiveModifier',
                        declaredArity: 2,
                        minimumArity: 0,
                        maximumArity: null
                    },
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
            label: 'public varargs string query_name(object who, int mode: (: 0 :))',
            rawSyntax: 'public varargs string query_name(object who, int mode: (: 0 :));',
            returnType: 'string',
            parameters: [
                expect.objectContaining({
                    name: 'who',
                    sourceName: 'who',
                    type: 'object',
                    passingMode: 'value',
                    arrayDepth: 0,
                    description: 'Target object from Rust.'
                }),
                expect.objectContaining({
                    name: 'mode',
                    type: 'int',
                    optional: true,
                    defaultValueText: '(: 0 :)'
                })
            ],
            arity: { min: 0, max: null }
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
        const sendRequest = jest.fn(async () => {
            return {
                currentFile: {
                    uri: 'file:///D:/mud/adm/single/simul_efun.c',
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
                includeGroups: [{
                    uri: 'file:///D:/mud/adm/simul_efun/chinese.c',
                    sourceKind: 'include',
                    depth: 1,
                    entries: [{
                        name: 'chinese_number',
                        signature: 'string chinese_number(int value)',
                        parameters: ['int value'],
                        returnObjects: [],
                        range: {
                            start: { line: 11, character: 0 },
                            end: { line: 11, character: 44 }
                        },
                        selectionRange: {
                            start: { line: 11, character: 7 },
                            end: { line: 11, character: 21 }
                        },
                        hasBody: true
                    }]
                }]
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

        expect(provider.getAllSimulatedFunctions(document, projectConfig)).toEqual(['mud_write', 'chinese_number']);
        expect(provider.getSimulatedDoc('mud_write', document, projectConfig)).toEqual(expect.objectContaining({
            summary: 'Write to the player.',
            sourceKind: 'simulEfun',
            declarationKind: 'external'
        }));
        expect(sendRequest).toHaveBeenCalledTimes(1);
        expect(sendRequest).toHaveBeenCalledWith('lpc/simulatedFunctionDocumentation', {
            textDocument: { uri: document.uri.toString() }
        });
        expect(provider.getSimulatedDoc('chinese_number', document, projectConfig)).toEqual(expect.objectContaining({
            sourceKind: 'simulEfun',
            declarationKind: 'external'
        }));
    });

    test('retries an unavailable Rust snapshot and refreshes later searches', async () => {
        (vscode.workspace as any).getWorkspaceFolder = jest.fn(() => ({
            uri: vscode.Uri.file('D:/mud')
        }));
        const sendRequest = jest.fn<(...args: any[]) => Promise<any>>()
            .mockResolvedValueOnce(undefined)
            .mockResolvedValue({
                currentFile: {
                    uri: 'file:///D:/mud/adm/single/simul_efun.c',
                    sourceKind: 'local',
                    depth: 0,
                    entries: []
                },
                inheritedGroups: [],
                includeGroups: []
            });
        const provider = new RustFunctionDocumentationLookupProvider(
            { sendRequest } as any,
            { getAllFunctions: () => [], getStandardCallableDoc: jest.fn() } as any
        );
        const document = { uri: vscode.Uri.file('D:/mud/demo.c') } as vscode.TextDocument;
        const projectConfig = {
            projectConfigPath: 'D:/mud/lpc-support.json',
            resolvedConfig: { simulatedEfunFile: '/adm/single/simul_efun' }
        };

        await provider.ensureWorkspaceStateCurrent(document, projectConfig);
        await provider.ensureWorkspaceStateCurrent(document, projectConfig);
        await provider.ensureWorkspaceStateCurrent(document, projectConfig);

        expect(sendRequest).toHaveBeenCalledTimes(3);
    });
});
