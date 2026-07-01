import * as vscode from 'vscode';
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import type { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { DefaultDiagnosticFactsProvider, createCurrentFileVisibleSymbols } from '../DiagnosticTypeFacts';
import type { VisibleDiagnosticSymbols } from '../DiagnosticSymbolResolver';

function createDocument(): vscode.TextDocument {
    return {
        uri: vscode.Uri.file('/workspace/demo.c'),
        fileName: '/workspace/demo.c',
        languageId: 'lpc',
        version: 1,
        lineCount: 1,
        getText: () => '',
        lineAt: () => ({ text: '' })
    } as vscode.TextDocument;
}

function createSnapshot(document: vscode.TextDocument): SemanticSnapshot {
    return {
        uri: document.uri.toString(),
        version: document.version,
        syntax: { parsed: {} } as any,
        parseDiagnostics: [],
        exportedFunctions: [],
        symbols: [],
        localScopes: [],
        typeDefinitions: [],
        fileGlobals: [],
        inheritStatements: [],
        includeStatements: [],
        macroDefinitions: [],
        macroReferences: [],
        symbolTable: {} as any,
        createdAt: Date.now()
    };
}

describe('DefaultDiagnosticFactsProvider', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('deduplicates concurrent visible symbol resolution for the same document key', async () => {
        const document = createDocument();
        const semantic = createSnapshot(document);
        const visibleSymbols: VisibleDiagnosticSymbols = createCurrentFileVisibleSymbols(semantic);
        const resolver = {
            resolveVisibleSymbols: jest.fn(async () => visibleSymbols)
        };
        const provider = new DefaultDiagnosticFactsProvider({ resolver });

        const [first, second] = await Promise.all([
            provider.getFacts(document, semantic, { workspaceRoot: '/workspace' }),
            provider.getFacts(document, semantic, { workspaceRoot: '/workspace' })
        ]);

        expect(resolver.resolveVisibleSymbols).toHaveBeenCalledTimes(1);
        expect(first.visibleSymbols).toBe(visibleSymbols);
        expect(second.visibleSymbols).toBe(visibleSymbols);
        expect(first.options.enabled).toBe(true);
    });

    test('does not reuse fulfilled visible symbol facts across diagnostic requests', async () => {
        const document = createDocument();
        const semantic = createSnapshot(document);
        const firstSymbols: VisibleDiagnosticSymbols = {
            ...createCurrentFileVisibleSymbols(semantic),
            hasUnresolvedDependencies: false
        };
        const secondSymbols: VisibleDiagnosticSymbols = {
            ...createCurrentFileVisibleSymbols(semantic),
            hasUnresolvedDependencies: true
        };
        const resolver = {
            resolveVisibleSymbols: jest.fn()
                .mockResolvedValueOnce(firstSymbols)
                .mockResolvedValueOnce(secondSymbols)
        };
        const provider = new DefaultDiagnosticFactsProvider({ resolver });

        const first = await provider.getFacts(document, semantic, { workspaceRoot: '/workspace' });
        const second = await provider.getFacts(document, semantic, { workspaceRoot: '/workspace' });

        expect(resolver.resolveVisibleSymbols).toHaveBeenCalledTimes(2);
        expect(first.visibleSymbols).toBe(firstSymbols);
        expect(second.visibleSymbols).toBe(secondSymbols);
    });

    test('keeps current-file fallback signatures typed', async () => {
        const document = createDocument();
        const semantic = createSnapshot(document);
        semantic.exportedFunctions = [{
            name: 'query_name',
            returnType: 'string',
            parameters: [{
                name: 'who',
                dataType: 'object',
                range: new vscode.Range(0, 0, 0, 0)
            }],
            requiredParameterCount: 1,
            maxParameterCount: 1,
            isVariadic: false,
            modifiers: [],
            sourceUri: document.uri.toString(),
            range: new vscode.Range(0, 0, 0, 0),
            origin: 'local'
        }];
        const provider = new DefaultDiagnosticFactsProvider();

        const facts = await provider.getFacts(document, semantic);

        expect(facts.visibleSymbols.callableSignatures[0]).toMatchObject({
            name: 'query_name',
            returnType: 'string',
            parameters: [{
                name: 'who',
                dataType: 'object'
            }]
        });
    });

    test('uses workspace-scoped type checking options in facts and cache keys', async () => {
        const document = createDocument();
        const semantic = createSnapshot(document);
        const resolver = {
            resolveVisibleSymbols: jest.fn(async () => createCurrentFileVisibleSymbols(semantic))
        };
        const provider = new DefaultDiagnosticFactsProvider({ resolver });

        const disabled = await provider.getFacts(document, semantic, {
            workspaceRoot: '/workspace',
            typeChecking: {
                enabled: false
            }
        });
        const enabled = await provider.getFacts(document, semantic, {
            workspaceRoot: '/workspace',
            typeChecking: {
                enabled: true
            }
        });

        expect(disabled.options.enabled).toBe(false);
        expect(enabled.options.enabled).toBe(true);
        expect(resolver.resolveVisibleSymbols).toHaveBeenCalledTimes(2);
    });
});
