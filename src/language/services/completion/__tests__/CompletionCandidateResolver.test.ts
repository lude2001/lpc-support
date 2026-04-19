import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { InheritanceResolver } from '../../../../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../../../../completion/projectSymbolIndex';
import type { CompletionCandidate, CompletionQueryResult } from '../../../../completion/types';

declare const require: any;

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? content.length;
        return Math.min(lineStart + position.character, content.length);
    };

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: () => content,
        lineAt: (lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        },
        positionAt: (offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        },
        offsetAt: (position: vscode.Position) => offsetAt(position)
    } as unknown as vscode.TextDocument;
}

function createSnapshot(
    document: vscode.TextDocument,
    options?: {
        functionNames?: string[];
        inherits?: string[];
    }
): any {
    const functionNames = options?.functionNames ?? [path.basename(document.fileName, '.c')];
    const inherits = options?.inherits ?? [];

    return {
        uri: document.uri.toString(),
        version: document.version,
        parseDiagnostics: [],
        exportedFunctions: functionNames.map((functionName, index) => ({
            name: functionName,
            returnType: 'void',
            parameters: [],
            modifiers: [],
            sourceUri: document.uri.toString(),
            range: new vscode.Range(index, 0, index, functionName.length),
            origin: 'local',
            definition: `void ${functionName}() {}`
        })),
        localScopes: [],
        typeDefinitions: [],
        fileGlobals: [],
        inheritStatements: inherits.map((inheritValue, index) => ({
            rawText: `inherit "${inheritValue}";`,
            expressionKind: 'string',
            value: inheritValue,
            range: new vscode.Range(index, 0, index, inheritValue.length + 10),
            isResolved: false
        })),
        includeStatements: [],
        macroReferences: [],
        createdAt: Date.now()
    };
}

function loadResolver(): any {
    return require('../CompletionCandidateResolver').CompletionCandidateResolver;
}

function createResult(
    kind: CompletionQueryResult['context']['kind'],
    candidates: CompletionCandidate[],
    currentWord = ''
): CompletionQueryResult {
    return {
        context: {
            kind,
            receiverChain: [],
            currentWord,
            linePrefix: currentWord
        },
        candidates
    };
}

describe('CompletionCandidateResolver', () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-candidate-resolver-'));
    });

    afterEach(() => {
        fs.rmSync(workspaceRoot, { recursive: true, force: true });
    });

    test('inherited fallback appends inherited candidates without duplicating existing labels', async () => {
        const CompletionCandidateResolver = loadResolver();
        const rootPath = path.join(workspaceRoot, 'root.c');
        const parentPath = path.join(workspaceRoot, 'parent.c');
        fs.writeFileSync(rootPath, 'inherit "parent";\n');
        fs.writeFileSync(parentPath, 'void inherited_only() {}\nvoid duplicated_name() {}\n');

        const rootDocument = createDocument(rootPath, 'inherit "parent";\n', 1);
        const rootSnapshot = createSnapshot(rootDocument, { functionNames: ['local_fn'], inherits: ['parent'] });
        const parentDocument = createDocument(parentPath, 'void inherited_only() {}\nvoid duplicated_name() {}\n', 1);
        const parentSnapshot = createSnapshot(parentDocument, {
            functionNames: ['inherited_only', 'duplicated_name']
        });

        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined as any, [workspaceRoot]));
        projectSymbolIndex.updateFromSnapshot(rootSnapshot);
        projectSymbolIndex.updateFromSnapshot(parentSnapshot);

        const resolver = new CompletionCandidateResolver(
            { inferObjectAccess: jest.fn() } as any,
            { discoverAt: jest.fn() } as any,
            { buildCandidates: jest.fn() } as any,
            {
                refreshInheritedIndex: jest.fn(),
                getInheritedSymbols: jest.fn((uri: string) => projectSymbolIndex.getInheritedSymbols(uri)),
                getRecord: jest.fn((uri: string) => projectSymbolIndex.getRecord(uri)),
                getResolvedInheritTargets: jest.fn((uri: string) => projectSymbolIndex.getResolvedInheritTargets(uri)),
                getDocumentForUri: jest.fn()
            } as any
        );

        const resolved = await resolver.resolveCompletionCandidates(
            rootDocument,
            new vscode.Position(0, 0),
            { isCancellationRequested: false },
            createResult('identifier', [
                {
                    key: 'local:duplicated_name',
                    label: 'duplicated_name',
                    kind: vscode.CompletionItemKind.Function,
                    detail: 'void duplicated_name',
                    sortGroup: 'scope',
                    metadata: { sourceType: 'local', sourceUri: rootDocument.uri.toString() }
                }
            ])
        );

        expect(resolved.map(candidate => candidate.label)).toEqual(['duplicated_name', 'inherited_only']);
    });

    test('object-member candidates rank shared implementations ahead of specific duplicates', async () => {
        const CompletionCandidateResolver = loadResolver();
        const swordPath = path.join(workspaceRoot, 'sword.c');
        const shieldPath = path.join(workspaceRoot, 'shield.c');
        const ownerDocument = createDocument(path.join(workspaceRoot, 'room.c'), 'object ob;\nob->\n', 1);
        fs.writeFileSync(swordPath, 'void query_name() {}\nvoid sword_only() {}\n');
        fs.writeFileSync(shieldPath, 'void query_name() {}\nvoid shield_only() {}\n');

        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined as any, [workspaceRoot]));
        projectSymbolIndex.updateFromSnapshot(createSnapshot(createDocument(swordPath, '', 1), {
            functionNames: ['query_name', 'sword_only']
        }));
        projectSymbolIndex.updateFromSnapshot(createSnapshot(createDocument(shieldPath, '', 1), {
            functionNames: ['query_name', 'shield_only']
        }));

        const resolver = new CompletionCandidateResolver(
            {
                inferObjectAccess: jest.fn(async () => ({
                    inference: {
                        status: 'multiple',
                        candidates: [
                            { path: swordPath, source: 'builtin-call' },
                            { path: shieldPath, source: 'builtin-call' }
                        ]
                    }
                }))
            } as any,
            { discoverAt: jest.fn() } as any,
            { buildCandidates: jest.fn() } as any,
            {
                refreshInheritedIndex: jest.fn(),
                getInheritedSymbols: jest.fn((uri: string) => projectSymbolIndex.getInheritedSymbols(uri)),
                getRecord: jest.fn((uri: string) => projectSymbolIndex.getRecord(uri)),
                getResolvedInheritTargets: jest.fn((uri: string) => projectSymbolIndex.getResolvedInheritTargets(uri)),
                getDocumentForUri: jest.fn()
            } as any
        );

        const resolved = await resolver.resolveCompletionCandidates(
            ownerDocument,
            new vscode.Position(1, 4),
            { isCancellationRequested: false },
            createResult('member', [])
        );

        expect(resolved.map(candidate => candidate.label)).toEqual(['query_name', 'shield_only', 'sword_only']);
        expect(resolved[0].key).toContain('shared');
    });

    test('scoped-member resolution returns only scoped candidates and bypasses object inference merging', async () => {
        const CompletionCandidateResolver = loadResolver();
        const document = createDocument(path.join(workspaceRoot, 'room.c'), '::cr\n', 1);
        const inferObjectAccess = jest.fn();
        const discoverAt = jest.fn(async () => ({ status: 'resolved', methods: [] }));
        const buildCandidates = jest.fn(() => [{
            key: 'scoped:create',
            label: 'create',
            kind: vscode.CompletionItemKind.Method,
            detail: 'void create',
            sortGroup: 'inherited',
            metadata: { sourceType: 'scoped-method' }
        }]);
        const resolver = new CompletionCandidateResolver(
            { inferObjectAccess } as any,
            { discoverAt } as any,
            { buildCandidates } as any,
            {
                refreshInheritedIndex: jest.fn(),
                getInheritedSymbols: jest.fn(() => ({ chain: [], functions: [], types: [], unresolvedTargets: [] })),
                getRecord: jest.fn(),
                getResolvedInheritTargets: jest.fn(() => []),
                getDocumentForUri: jest.fn()
            } as any
        );

        const resolved = await resolver.resolveCompletionCandidates(
            document,
            new vscode.Position(0, 3),
            { isCancellationRequested: false },
            createResult('scoped-member', [
                {
                    key: 'fallback',
                    label: 'fallback',
                    kind: vscode.CompletionItemKind.Function,
                    detail: 'void fallback',
                    sortGroup: 'scope',
                    metadata: { sourceType: 'local' }
                }
            ], 'cr')
        );

        expect(resolved.map(candidate => candidate.label)).toEqual(['create']);
        expect(discoverAt).toHaveBeenCalledWith(document, expect.any(vscode.Position));
        expect(buildCandidates).toHaveBeenCalled();
        expect(inferObjectAccess).not.toHaveBeenCalled();
    });

    test('member resolution merges object-member candidates with fallback candidates only when no current word exists', async () => {
        const CompletionCandidateResolver = loadResolver();
        const swordPath = path.join(workspaceRoot, 'sword.c');
        fs.writeFileSync(swordPath, 'void query_name() {}\n');
        const ownerDocument = createDocument(path.join(workspaceRoot, 'room.c'), 'object ob;\nob->\n', 1);

        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined as any, [workspaceRoot]));
        projectSymbolIndex.updateFromSnapshot(createSnapshot(createDocument(swordPath, '', 1), {
            functionNames: ['query_name']
        }));

        const resolver = new CompletionCandidateResolver(
            {
                inferObjectAccess: jest.fn(async () => ({
                    inference: {
                        status: 'resolved',
                        candidates: [{ path: swordPath, source: 'builtin-call' }]
                    }
                }))
            } as any,
            { discoverAt: jest.fn() } as any,
            { buildCandidates: jest.fn() } as any,
            {
                refreshInheritedIndex: jest.fn(),
                getInheritedSymbols: jest.fn((uri: string) => projectSymbolIndex.getInheritedSymbols(uri)),
                getRecord: jest.fn((uri: string) => projectSymbolIndex.getRecord(uri)),
                getResolvedInheritTargets: jest.fn((uri: string) => projectSymbolIndex.getResolvedInheritTargets(uri)),
                getDocumentForUri: jest.fn()
            } as any
        );

        const resolvedWithoutPrefix = await resolver.resolveCompletionCandidates(
            ownerDocument,
            new vscode.Position(1, 4),
            { isCancellationRequested: false },
            createResult('member', [
                {
                    key: 'fallback',
                    label: 'fallback_choice',
                    kind: vscode.CompletionItemKind.Function,
                    detail: 'void fallback_choice',
                    sortGroup: 'scope',
                    metadata: { sourceType: 'local' }
                }
            ])
        );

        const resolvedWithPrefix = await resolver.resolveCompletionCandidates(
            ownerDocument,
            new vscode.Position(1, 4),
            { isCancellationRequested: false },
            createResult('member', [
                {
                    key: 'fallback',
                    label: 'fallback_choice',
                    kind: vscode.CompletionItemKind.Function,
                    detail: 'void fallback_choice',
                    sortGroup: 'scope',
                    metadata: { sourceType: 'local' }
                }
            ], 'qu')
        );

        expect(resolvedWithoutPrefix.map(candidate => candidate.label)).toEqual(['query_name', 'fallback_choice']);
        expect(resolvedWithPrefix.map(candidate => candidate.label)).toEqual(['query_name']);
    });
});
