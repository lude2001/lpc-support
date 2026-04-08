import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';

function createDocument(content: string, fileName: string = '/virtual/member-types.c', version: number = 1): vscode.TextDocument {
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
        lineCount: lineStarts.length,
        getText: jest.fn(() => content),
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
        lineAt: jest.fn((lineOrPosition: number | vscode.Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const start = lineStarts[line] ?? 0;
            const nextStart = line + 1 < lineStarts.length ? lineStarts[line + 1] : content.length;
            const end = content[nextStart - 1] === '\n' ? nextStart - 1 : nextStart;

            return { text: content.slice(start, end) };
        })
    } as unknown as vscode.TextDocument;
}

describe('ASTManager compound type lookup', () => {
    afterEach(() => {
        ASTManager.getInstance().clearAllCache();
    });

    test('resolves class-typed variables to class member completions', () => {
        const source = [
            'class Payload {',
            '    int hp;',
            '    string *tags;',
            '}',
            '',
            'void demo() {',
            '    class Payload payload;',
            '}'
        ].join('\n');

        const document = createDocument(source);
        const items = ASTManager.getInstance().getStructMemberCompletions(
            document,
            new vscode.Position(6, 18),
            'payload'
        );

        expect(items.map(item => item.label)).toEqual(['hp', 'tags']);
        expect(items.map(item => item.detail)).toEqual(['int hp', 'string * tags']);
    });

    test('returns the last successful snapshot while refreshing a newer version in the background', () => {
        jest.useFakeTimers();

        const fileName = '/virtual/stale-snapshot.c';
        const firstDocument = createDocument('int first_call() { return 1; }', fileName, 1);
        const manager = ASTManager.getInstance();
        const initialSnapshot = manager.getSnapshot(firstDocument, false);

        expect(initialSnapshot.version).toBe(1);
        expect(initialSnapshot.exportedFunctions.map(item => item.name)).toContain('first_call');

        const updatedDocument = createDocument('int second_call() { return 2; }', fileName, 2);
        manager.scheduleSnapshotRefresh(updatedDocument);

        const bestAvailableSnapshot = manager.getBestAvailableSnapshot(updatedDocument);
        expect(bestAvailableSnapshot.version).toBe(1);
        expect(bestAvailableSnapshot.exportedFunctions.map(item => item.name)).toContain('first_call');
        expect(manager.hasFreshSnapshot(updatedDocument)).toBe(false);

        jest.advanceTimersByTime(350);

        const refreshedSnapshot = manager.getSnapshot(updatedDocument);
        expect(refreshedSnapshot.version).toBe(2);
        expect(refreshedSnapshot.exportedFunctions.map(item => item.name)).toContain('second_call');
        expect(manager.hasFreshSnapshot(updatedDocument)).toBe(true);

        jest.useRealTimers();
    });

    test('exposes semantic snapshots as the canonical analysis output', () => {
        const source = [
            'inherit "/std/room";',
            '',
            'int query_hp() {',
            '    return 100;',
            '}'
        ].join('\n');
        const document = createDocument(source, '/virtual/semantic-snapshot.c', 1);
        const semantic = ASTManager.getInstance().getSemanticSnapshot(document, false);

        expect(semantic.syntax.uri).toBe(document.uri.toString());
        expect(semantic.exportedFunctions.map(item => item.name)).toEqual(['query_hp']);
        expect(semantic.inheritStatements.map(item => item.value)).toEqual(['/std/room']);
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
