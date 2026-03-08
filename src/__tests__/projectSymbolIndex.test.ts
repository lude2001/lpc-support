import * as vscode from 'vscode';
import { SymbolTable } from '../ast/symbolTable';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';
import { DocumentSemanticSnapshot } from '../completion/types';

function createSnapshot(uriPath: string): DocumentSemanticSnapshot {
    return {
        uri: vscode.Uri.file(uriPath).toString(),
        version: 1,
        parseDiagnostics: [],
        exportedFunctions: [],
        localScopes: [],
        typeDefinitions: [],
        inheritStatements: [],
        includeStatements: [],
        macroReferences: [],
        symbolTable: new SymbolTable(vscode.Uri.file(uriPath).toString()),
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
            .mockImplementation((snapshot: DocumentSemanticSnapshot) => snapshot.inheritStatements.map(statement => ({
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
});
