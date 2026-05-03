import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { SymbolTable } from '../ast/symbolTable';
import { SemanticSnapshot } from '../semantic/semanticSnapshot';
import { createSyntaxDocument, SyntaxKind } from '../syntax/types';

function createSnapshot(uriPath: string): SemanticSnapshot {
    const uri = vscode.Uri.file(uriPath).toString();

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
        symbolTable: new SymbolTable(uri),
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
        const resolver = new InheritanceResolver([root]);
        const snapshot = createSnapshot(path.join(root, 'room.c'));
        snapshot.macroDefinitions = [{
            name: 'BASE_D',
            value: '"/lib/macro_base"',
            range: new vscode.Range(0, 0, 0, 0),
            isFunctionLike: false,
            sourceUri: snapshot.uri
        }];

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

    test('resolves macro inherit directives from semantic macro definitions', () => {
        fs.writeFileSync(path.join(root, 'lib', 'frontend_base.c'), 'int frontend_call() { return 1; }', 'utf8');
        const resolver = new InheritanceResolver([root]);
        const snapshot = createSnapshot(path.join(root, 'room.c'));
        snapshot.macroDefinitions = [{
            name: 'BASE_D',
            value: '"/lib/frontend_base"',
            range: new vscode.Range(0, 0, 0, 0),
            isFunctionLike: false,
            sourceUri: snapshot.uri
        }];
        snapshot.inheritStatements = [{
            rawText: 'inherit BASE_D;',
            expressionKind: 'macro',
            value: 'BASE_D',
            range: new vscode.Range(1, 0, 1, 15),
            isResolved: false
        }];

        const targets = resolver.resolveInheritTargets(snapshot);

        expect(targets).toHaveLength(1);
        expect(targets[0].isResolved).toBe(true);
        expect(path.basename(vscode.Uri.parse(targets[0].resolvedUri!).fsPath)).toBe('frontend_base.c');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
