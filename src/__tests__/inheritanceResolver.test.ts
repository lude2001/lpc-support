import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { DocumentSemanticSnapshot } from '../completion/types';
import { SymbolTable } from '../ast/symbolTable';

function createSnapshot(uri: string): DocumentSemanticSnapshot {
    return {
        uri: vscode.Uri.file(uri).toString(),
        version: 1,
        parseDiagnostics: [],
        exportedFunctions: [],
        localScopes: [],
        typeDefinitions: [],
        inheritStatements: [],
        includeStatements: [],
        macroReferences: [],
        symbolTable: new SymbolTable(vscode.Uri.file(uri).toString()),
        createdAt: Date.now()
    };
}

describe('InheritanceResolver', () => {
    const root = path.join(process.cwd(), '.tmp-inheritance-resolver');

    beforeEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
        fs.writeFileSync(path.join(root, 'lib', 'base.c'), 'int inherited_call() { return 1; }', 'utf8');
        fs.writeFileSync(path.join(root, 'lib', 'macro_base.c'), 'int macro_call() { return 1; }', 'utf8');
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    test('resolves string and macro inherit directives to workspace files', () => {
        const resolver = new InheritanceResolver(
            {
                getMacro: jest.fn((name: string) => name === 'BASE_D' ? ({ value: '"/lib/macro_base"' } as any) : undefined),
                getIncludePath: jest.fn(() => undefined)
            } as any,
            [root]
        );
        const snapshot = createSnapshot(path.join(root, 'room.c'));

        snapshot.inheritStatements = [
            {
                rawText: 'inherit "/lib/base";',
                expressionKind: 'string',
                value: '/lib/base',
                range: new vscode.Range(0, 0, 0, 18),
                isResolved: false
            },
            {
                rawText: 'inherit BASE_D;',
                expressionKind: 'macro',
                value: 'BASE_D',
                range: new vscode.Range(1, 0, 1, 15),
                isResolved: false
            }
        ];

        const targets = resolver.resolveInheritTargets(snapshot);

        expect(targets).toHaveLength(2);
        expect(targets.every(target => target.isResolved)).toBe(true);
        expect(targets.map(target => path.basename(vscode.Uri.parse(target.resolvedUri!).fsPath))).toEqual(['base.c', 'macro_base.c']);
    });
});
