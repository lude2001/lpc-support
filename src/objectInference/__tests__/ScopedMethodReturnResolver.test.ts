import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

declare const require: any;

const { ScopedMethodReturnResolver } = require('../ScopedMethodReturnResolver');

function createTextDocument(filePath: string, content: string): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];
    for (let index = 0; index < normalized.length; index += 1) {
        if (normalized[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    const offsetAt = (position: vscode.Position): number => {
        const lineStart = lineStarts[position.line] ?? normalized.length;
        return Math.min(lineStart + position.character, normalized.length);
    };

    const positionAt = (offset: number): vscode.Position => {
        let line = 0;
        for (let index = 0; index < lineStarts.length; index += 1) {
            if (lineStarts[index] <= offset) {
                line = index;
            } else {
                break;
            }
        }

        return new vscode.Position(line, offset - lineStarts[line]);
    };

    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lineStarts.length,
        isDirty: false,
        isClosed: false,
        isUntitled: false,
        eol: vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => {
            if (!range) {
                return normalized;
            }

            return normalized.slice(offsetAt(range.start), offsetAt(range.end));
        },
        lineAt: (line: number) => ({
            text: normalized.split('\n')[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

function scopedTarget(pathName: string, methodName: string) {
    return {
        path: pathName,
        methodName,
        declarationRange: new vscode.Range(0, 0, 0, methodName.length),
        document: createTextDocument(pathName, `${methodName}();\n`),
        sourceLabel: pathName
    };
}

describe('ScopedMethodReturnResolver', () => {
    function fixturePath(relativePath: string): string {
        return path.join(process.cwd(), '.tmp-scoped-method-return-resolver', relativePath.replace(/^[/\\]+/, ''));
    }

    beforeEach(() => {
        jest.clearAllMocks();
        fs.rmSync(path.join(process.cwd(), '.tmp-scoped-method-return-resolver'), { recursive: true, force: true });
        fs.mkdirSync(path.dirname(fixturePath('/obj/sword.c')), { recursive: true });
        fs.mkdirSync(path.dirname(fixturePath('/obj/shield.c')), { recursive: true });
        fs.mkdirSync(path.dirname(fixturePath('/obj/room_item.c')), { recursive: true });
        fs.mkdirSync(path.dirname(fixturePath('/std/base_room.c')), { recursive: true });
        fs.mkdirSync(path.dirname(fixturePath('/std/weapon_room.c')), { recursive: true });
        fs.mkdirSync(path.dirname(fixturePath('/std/room.c')), { recursive: true });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        fs.rmSync(path.join(process.cwd(), '.tmp-scoped-method-return-resolver'), { recursive: true, force: true });
    });

    test('::factory() merges documented return objects from resolved scoped implementations', async () => {
        const document = createTextDocument(fixturePath('/d/city/room.c'), 'object ob = ::factory();\n');
        const scopedTargets = [
            scopedTarget(fixturePath('/std/base_room.c'), 'factory'),
            scopedTarget(fixturePath('/std/weapon_room.c'), 'factory')
        ];

        const resolveDocumentedReturnOutcome = jest.fn()
            .mockResolvedValueOnce({
                candidates: [{ path: fixturePath('/obj/sword.c'), source: 'doc' }]
            })
            .mockResolvedValueOnce({
                candidates: [{ path: fixturePath('/obj/shield.c'), source: 'doc' }]
            });
        const resolver = new ScopedMethodReturnResolver(resolveDocumentedReturnOutcome);

        const outcome = await resolver.resolveScopedMethodReturnOutcome(document, scopedTargets);

        expect(outcome.candidates.map((candidate: { path: string }) => candidate.path)).toEqual([
            fixturePath('/obj/sword.c'),
            fixturePath('/obj/shield.c')
        ]);
    });

    test('::factory() downgrades to diagnostics when any scoped implementation lacks returnObjects', async () => {
        const document = createTextDocument(fixturePath('/d/city/room.c'), 'object ob = ::factory();\n');
        const scopedTargets = [
            scopedTarget(fixturePath('/std/base_room.c'), 'factory'),
            scopedTarget(fixturePath('/std/weapon_room.c'), 'factory')
        ];

        const resolveDocumentedReturnOutcome = jest.fn()
            .mockResolvedValueOnce({
                candidates: [{ path: fixturePath('/obj/sword.c'), source: 'doc' }]
            })
            .mockResolvedValueOnce({
                candidates: [],
                diagnostics: [{ code: 'missing-return-annotation', methodName: 'factory' }]
            });
        const resolver = new ScopedMethodReturnResolver(resolveDocumentedReturnOutcome);

        const outcome = await resolver.resolveScopedMethodReturnOutcome(document, scopedTargets);

        expect(outcome.candidates).toEqual([]);
        expect(outcome.diagnostics).toEqual([
            { code: 'missing-return-annotation', methodName: 'factory' }
        ]);
    });

    test('room::factory() resolves documented return objects from the uniquely matched direct inherit branch', async () => {
        const document = createTextDocument(fixturePath('/d/city/room.c'), 'object ob = room::factory();\n');
        const scopedTargets = [
            scopedTarget(fixturePath('/std/room.c'), 'factory')
        ];

        const resolveDocumentedReturnOutcome = jest.fn().mockResolvedValue({
            candidates: [{ path: fixturePath('/obj/room_item.c'), source: 'doc' }]
        });
        const resolver = new ScopedMethodReturnResolver(resolveDocumentedReturnOutcome);

        const outcome = await resolver.resolveScopedMethodReturnOutcome(document, scopedTargets);

        expect(outcome.candidates).toEqual([
            { path: fixturePath('/obj/room_item.c'), source: 'doc' }
        ]);
    });
});
