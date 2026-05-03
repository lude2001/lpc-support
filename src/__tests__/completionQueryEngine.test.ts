import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import { CompletionContextAnalyzer } from '../completion/completionContextAnalyzer';
import { CompletionQueryEngine } from '../completion/completionQueryEngine';
import { InheritanceResolver } from '../completion/inheritanceResolver';
import { ProjectSymbolIndex } from '../completion/projectSymbolIndex';
import {
    configureAstManagerSingletonForTests,
    getAstManagerForTests,
    resetAstManagerSingletonForTests
} from './testAstManagerSingleton';

function createDocument(fileName: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    const lineStarts = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return {
        uri: vscode.Uri.file(fileName),
        fileName,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: jest.fn(() => content),
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            return { text: lines[line] ?? '' };
        }),
        positionAt: jest.fn((offset: number) => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        }),
        offsetAt: jest.fn((position: vscode.Position) => lineStarts[position.line] + position.character)
    } as unknown as vscode.TextDocument;
}

describe('CompletionQueryEngine', () => {
    const root = path.join(process.cwd(), '.tmp-query-engine');

    beforeEach(() => {
        configureAstManagerSingletonForTests();
        fs.rmSync(root, { recursive: true, force: true });
        fs.mkdirSync(path.join(root, 'lib'), { recursive: true });

        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockImplementation(() => ({
            uri: { fsPath: root }
        }));
        (vscode.workspace as any).workspaceFolders = [{ uri: { fsPath: root } }];
    });

    afterEach(() => {
        resetAstManagerSingletonForTests();
        fs.rmSync(root, { recursive: true, force: true });
        jest.clearAllMocks();
    });

    test('queries inherited identifiers and member candidates from snapshots plus project index', () => {
        const basePath = path.join(root, 'lib', 'base.c');
        const childPath = path.join(root, 'room.c');
        const baseContent = [
            'class Payload {',
            '    int hp;',
            '}',
            '',
            'int inherited_call() {',
            '    return 1;',
            '}'
        ].join('\n');
        const childContent = [
            'inherit "/lib/base";',
            '',
            'void demo() {',
            '    class Payload payload;',
            '    payload->hp;',
            '    inherited_call();',
            '}'
        ].join('\n');

        fs.writeFileSync(basePath, baseContent, 'utf8');
        fs.writeFileSync(childPath, childContent, 'utf8');

        const baseDocument = createDocument(basePath, baseContent);
        const childDocument = createDocument(childPath, childContent);
        const astManager = getAstManagerForTests();
        const resolver = new InheritanceResolver(undefined, [root]);
        const projectSymbolIndex = new ProjectSymbolIndex(resolver);
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer(),
            efunProvider: {
                getAllFunctions: () => ['write'],
                getAllSimulatedFunctions: () => []
            }
        });

        projectSymbolIndex.updateFromSemanticSnapshot(astManager.getSemanticSnapshot(baseDocument, false));

        const memberResult = engine.query(
            childDocument,
            new vscode.Position(4, '    payload->h'.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );
        expect(memberResult.context.kind).toBe('member');
        expect(memberResult.candidates.map(candidate => candidate.label)).toEqual(['hp']);

        const identifierResult = engine.query(
            childDocument,
            new vscode.Position(5, '    inhe'.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );
        expect(identifierResult.context.kind).toBe('identifier');
        expect(identifierResult.candidates.map(candidate => candidate.label)).toContain('inherited_call');
    });

    test('returns generic object methods for object-style member receivers', () => {
        const filePath = path.join(root, 'object-member.c');
        const content = [
            'object foo() {',
            '    return this_object();',
            '}',
            '',
            'void demo() {',
            '    object ob;',
            '    mixed *arr;',
            '    ob->query();',
            '    this_object()->query();',
            '    foo()->query();',
            '    arr[0]->query();',
            '}'
        ].join('\n');

        fs.writeFileSync(filePath, content, 'utf8');

        const document = createDocument(filePath, content);
        const astManager = getAstManagerForTests();
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined, [root]));
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            contextAnalyzer: new CompletionContextAnalyzer()
        });

        const expectObjectMethods = (line: number, prefix: string) => {
            const result = engine.query(
                document,
                new vscode.Position(line, prefix.length),
                {} as vscode.CompletionContext,
                { isCancellationRequested: false } as vscode.CancellationToken
            );

            expect(result.context.kind).toBe('member');
            expect(result.candidates.map(candidate => candidate.label)).toEqual(expect.arrayContaining(['query', 'set', 'add', 'delete']));
        };

        expectObjectMethods(7, '    ob->');
        expectObjectMethods(8, '    this_object()->');
        expectObjectMethods(9, '    foo()->');
        expectObjectMethods(10, '    arr[0]->');
    });

    test('returns path and macro candidates for inherit-path contexts and honors cancellation', () => {
        const childPath = path.join(root, 'room.c');
        const childContent = 'inherit BA';
        fs.writeFileSync(path.join(root, 'lib', 'base.c'), 'int inherited_call() { return 1; }', 'utf8');

        const childDocument = createDocument(childPath, childContent);
        const astManager = getAstManagerForTests();
        const resolver = new InheritanceResolver(undefined, [root]);
        const projectSymbolIndex = new ProjectSymbolIndex(resolver);
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            macroManager: {
                getAllMacros: () => [{ name: 'BASE_D', value: '"/lib/base"' } as any]
            } as any
        });

        projectSymbolIndex.updateFromSemanticSnapshot({
            ...astManager.getSemanticSnapshot(childDocument, false),
            uri: vscode.Uri.file(path.join(root, 'lib', 'base.c')).toString(),
            inheritStatements: [],
            exportedFunctions: [],
            typeDefinitions: []
        });

        const result = engine.query(
            childDocument,
            new vscode.Position(0, childContent.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );
        expect(result.context.kind).toBe('inherit-path');
        expect(result.candidates.map(candidate => candidate.label)).toContain('BASE_D');

        const cancelled = engine.query(
            childDocument,
            new vscode.Position(0, childContent.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: true } as vscode.CancellationToken
        );
        expect(cancelled.candidates).toEqual([]);
    });

    test('returns local frontend macro definitions for path completion without MacroManager', () => {
        const childPath = path.join(root, 'macro-room.c');
        const childContent = [
            '#define BASE_D "/lib/base"',
            'inherit BA'
        ].join('\n');
        fs.writeFileSync(childPath, childContent, 'utf8');

        const childDocument = createDocument(childPath, childContent);
        const astManager = getAstManagerForTests();
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined, [root]));
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex
        });

        const result = engine.query(
            childDocument,
            new vscode.Position(1, 'inherit BA'.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );

        expect(result.context.kind).toBe('inherit-path');
        expect(result.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                label: 'BASE_D',
                detail: '"/lib/base"'
            })
        ]));
    });

    test('deduplicates legacy macro candidates when frontend macro facts already define the name', () => {
        const childPath = path.join(root, 'dedupe-macro-room.c');
        const childContent = [
            '#define BASE_D "/lib/base"',
            'inherit '
        ].join('\n');
        fs.writeFileSync(childPath, childContent, 'utf8');

        const childDocument = createDocument(childPath, childContent);
        const astManager = getAstManagerForTests();
        const projectSymbolIndex = new ProjectSymbolIndex(new InheritanceResolver(undefined, [root]));
        const engine = new CompletionQueryEngine({
            snapshotProvider: astManager,
            projectSymbolIndex,
            macroManager: {
                getAllMacros: () => [
                    { name: 'BASE_D', value: '"/legacy/base"' },
                    { name: 'ROOM_D', value: '"/lib/room"' }
                ] as any[]
            } as any
        });

        const result = engine.query(
            childDocument,
            new vscode.Position(1, 'inherit '.length),
            {} as vscode.CompletionContext,
            { isCancellationRequested: false } as vscode.CancellationToken
        );
        const baseCandidates = result.candidates.filter(candidate => candidate.label === 'BASE_D');

        expect(baseCandidates).toHaveLength(1);
        expect(baseCandidates[0].detail).toBe('"/lib/base"');
        expect(result.candidates.map(candidate => candidate.label)).toContain('ROOM_D');
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
