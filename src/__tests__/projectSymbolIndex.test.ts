import * as vscode from 'vscode';
import { SymbolTable } from '../ast/symbolTable';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { createSyntaxDocument, SyntaxKind } from '../syntax/types';

function createSnapshot(uriPath: string): SemanticSnapshot {
    const uri = vscode.Uri.file(uriPath).toString();
    const symbolTable = new SymbolTable(uri);

    return {
        uri,
        version: 1,
        syntax: createSyntaxDocument({
            parsed: {
                uri,
                version: 1,
                text: '',
                tokenStream: {} as any,
                tokens: {} as any,
                allTokens: [],
                visibleTokens: [],
                hiddenTokens: [],
                tokenTriviaIndex: {} as any,
                tree: {} as any,
                diagnostics: [],
                createdAt: Date.now(),
                lastAccessed: Date.now(),
                parseTimeMs: 0,
                parseTime: 0,
                size: 0,
                layoutTriviaSource: 'lexer-hidden-channel'
            },
            root: {
                kind: SyntaxKind.SourceFile,
                category: 'document',
                range: new vscode.Range(0, 0, 0, 0),
                tokenRange: { start: 0, end: 0 },
                children: [],
                leadingTrivia: [],
                trailingTrivia: [],
                isMissing: false,
                isOpaque: false
            }
        }),
        parseDiagnostics: [],
        exportedFunctions: [],
        localScopes: [],
        typeDefinitions: [],
        inheritStatements: [],
        includeStatements: [],
        macroReferences: [],
        symbolTable,
        createdAt: Date.now()
    };
}

describe('ProjectSymbolIndex', () => {
    test('builds inherited symbol sets and type lookups from snapshots', () => {
        const baseSnapshot = createSnapshot('/virtual/base.c');
        baseSnapshot.exportedFunctions = [{
            name: 'inherited_call',
            returnType: 'int',
            parameters: [],
            modifiers: [],
            sourceUri: baseSnapshot.uri,
            range: new vscode.Range(0, 0, 0, 10),
            origin: 'local'
        }];
        baseSnapshot.typeDefinitions = [{
            name: 'Payload',
            kind: 'class',
            members: [{
                name: 'hp',
                dataType: 'int',
                range: new vscode.Range(1, 0, 1, 5)
            }],
            sourceUri: baseSnapshot.uri,
            range: new vscode.Range(0, 0, 2, 1)
        }];

        const childSnapshot = createSnapshot('/virtual/child.c');
        childSnapshot.inheritStatements = [{
            rawText: 'inherit "/virtual/base";',
            expressionKind: 'string',
            value: '/virtual/base',
            range: new vscode.Range(0, 0, 0, 22),
            resolvedUri: baseSnapshot.uri,
            isResolved: true
        }];

        const resolver = new InheritanceResolver(undefined, ['/']);
        jest.spyOn(resolver, 'resolveInheritTargets')
            .mockImplementation((snapshot: Pick<SemanticSnapshot, 'uri' | 'inheritStatements'>) => snapshot.inheritStatements.map(statement => ({
                rawValue: statement.value,
                expressionKind: statement.expressionKind,
                sourceUri: snapshot.uri,
                resolvedUri: statement.resolvedUri,
                isResolved: statement.isResolved
            })));

        const index = new ProjectSymbolIndex(resolver);
        index.updateFromSnapshot(baseSnapshot);
        index.updateFromSnapshot(childSnapshot);

        const inherited = index.getInheritedSymbols(childSnapshot.uri);

        expect(inherited.chain).toEqual([baseSnapshot.uri]);
        expect(inherited.functions.map(func => func.name)).toEqual(['inherited_call']);
        expect(index.findType('class Payload *')?.name).toBe('Payload');
    });

    test('stores fileGlobals summaries on file records', () => {
        const snapshot = createSnapshot('/virtual/room.c');
        (snapshot as any).fileGlobals = [{
            name: 'COMBAT_D',
            dataType: 'object',
            sourceUri: snapshot.uri,
            range: new vscode.Range(0, 0, 0, 8)
        }];

        const index = new ProjectSymbolIndex(new InheritanceResolver(undefined, ['/']));
        index.updateFromSnapshot(snapshot as any);

        expect((index.getRecord(snapshot.uri) as any)?.fileGlobals).toEqual([
            expect.objectContaining({
                name: 'COMBAT_D',
                dataType: 'object',
                sourceUri: snapshot.uri,
                range: expect.any(vscode.Range)
            })
        ]);
        expect((index.getAllRecords()[0] as any).fileGlobals).toEqual([
            expect.objectContaining({
                name: 'COMBAT_D',
                dataType: 'object',
                sourceUri: snapshot.uri,
                range: expect.any(vscode.Range)
            })
        ]);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
