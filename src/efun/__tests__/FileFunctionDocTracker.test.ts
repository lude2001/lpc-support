import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileFunctionDocTracker } from '../FileFunctionDocTracker';

describe('FileFunctionDocTracker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.workspaceFolders as unknown) = [];
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
                ' * live include helper',
                ' */',
                'int helper_live()'
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
            category: '包含自 helper.h'
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
                ' * multi root helper',
                ' */',
                'int helper_multi_root()'
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
            category: '包含自 helper.h'
        });

        fs.rmSync(rootA, { recursive: true, force: true });
        fs.rmSync(rootB, { recursive: true, force: true });
    });
});
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
