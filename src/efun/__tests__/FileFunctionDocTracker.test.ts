import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileFunctionDocTracker } from '../FileFunctionDocTracker';

function createTextDocument(filePath: string, content: string): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lineStarts = [0];
    const lines = normalized.split('\n');

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
        languageId: filePath.endsWith('.h') || filePath.endsWith('.c') ? 'lpc' : 'plaintext',
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
            text: lines[line] ?? ''
        }),
        positionAt,
        offsetAt,
        save: async () => true,
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position
    } as unknown as vscode.TextDocument;
}

describe('FileFunctionDocTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.workspaceFolders as unknown) = [];
        (vscode.workspace.openTextDocument as jest.Mock).mockImplementation(async (target: string) => {
            const filePath = typeof target === 'string' ? target : target.fsPath;
            return createTextDocument(filePath, fs.readFileSync(filePath, 'utf8'));
        });
    });

    test('only the latest async update wins when updates overlap', async () => {
        const tracker = new FileFunctionDocTracker() as any;
        tracker.parseInheritStatements = jest
            .fn()
            .mockImplementation((content: string) => content.includes('first') ? ['first.c'] : ['second.c']);
        tracker.loadInheritedFileDocs = jest
            .fn()
            .mockImplementation(async (_currentFilePath: string, inheritedFiles: string[]) => {
                if (inheritedFiles[0] === 'first.c') {
                    await new Promise(resolve => setTimeout(resolve, 20));
                    return new Map([['first-path', new Map()]]);
                }

                return new Map([['second-path', new Map()]]);
            });

        const firstDocument = {
            languageId: 'lpc',
            version: 1,
            fileName: 'first.c',
            uri: { fsPath: 'first.c' },
            getText: () => 'inherit "first";'
        } as vscode.TextDocument;
        const secondDocument = {
            languageId: 'lpc',
            version: 1,
            fileName: 'second.c',
            uri: { fsPath: 'second.c' },
            getText: () => 'inherit "second";'
        } as vscode.TextDocument;

        const firstUpdate = tracker.update(firstDocument);
        const secondUpdate = tracker.update(secondDocument);
        await Promise.all([firstUpdate, secondUpdate]);

        expect(tracker.currentFilePath).toBe('second.c');
        expect(tracker.inheritedFiles).toEqual(['second.c']);
        expect(Array.from(tracker.inheritedFileDocs.keys())).toEqual(['second-path']);
    });

    test('include lookup uses live unsaved document text', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-tracker-live-'));
        const includeDir = path.join(tempRoot, 'include');
        const mainFile = path.join(tempRoot, 'main.c');
        const includeFile = path.join(includeDir, 'helper.h');

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(mainFile, '');
        fs.writeFileSync(
            includeFile,
            [
                '/**',
                ' * @brief live include helper',
                ' */',
                'int helper_live();'
            ].join('\n')
        );

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: tempRoot } }];

        const tracker = new FileFunctionDocTracker();
        const document = {
            uri: { fsPath: mainFile },
            getText: () => '#include "/include/helper.h"\n'
        } as unknown as vscode.TextDocument;

        const doc = await tracker.getDocFromIncludes(document, 'helper_live');

        expect(doc).toMatchObject({
            name: 'helper_live',
            category: '包含自 helper.h',
            description: 'live include helper',
            syntax: 'int helper_live();'
        });

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('multi-root workspaces resolve root-relative includes against the owning workspace folder', async () => {
        const rootA = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-root-a-'));
        const rootB = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-root-b-'));
        const includeDir = path.join(rootB, 'include');
        const mainFile = path.join(rootB, 'main.c');
        const includeFile = path.join(includeDir, 'helper.h');

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(mainFile, '#include "/include/helper.h"\n');
        fs.writeFileSync(
            includeFile,
            [
                '/**',
                ' * @brief multi root helper',
                ' */',
                'int helper_multi_root();'
            ].join('\n')
        );

        (vscode.workspace.workspaceFolders as unknown) = [
            { uri: { fsPath: rootA } },
            { uri: { fsPath: rootB } }
        ];

        const tracker = new FileFunctionDocTracker();
        const document = {
            uri: { fsPath: mainFile },
            getText: () => '#include "/include/helper.h"\n'
        } as unknown as vscode.TextDocument;

        const doc = await tracker.getDocFromIncludes(document, 'helper_multi_root');

        expect(doc).toMatchObject({
            name: 'helper_multi_root',
            category: '包含自 helper.h',
            description: 'multi root helper',
            syntax: 'int helper_multi_root();'
        });

        fs.rmSync(rootA, { recursive: true, force: true });
        fs.rmSync(rootB, { recursive: true, force: true });
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
