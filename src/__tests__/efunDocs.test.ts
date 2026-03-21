import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LPCCompletionItemProvider } from '../completionProvider';
import { SimulatedEfunScanner } from '../efun/SimulatedEfunScanner';
import { EfunDocsManager } from '../efunDocs';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        get: jest.fn()
    }
}));

describe('EfunDocsManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_: string, defaultValue?: unknown) => defaultValue),
            update: jest.fn().mockResolvedValue(undefined)
        });
        (vscode.workspace.workspaceFolders as unknown[]) = [];
        (vscode.window.activeTextEditor as unknown) = undefined;
    });

    test('should load bundled efun docs without network access', async () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context);
        const doc = await manager.getEfunDoc('allocate');

        expect(manager.getAllFunctions()).toContain('allocate');
        expect(manager.getCategories().get('数组相关函数（Arrays）')).toContain('allocate');
        expect(doc).toMatchObject({
            name: 'allocate',
            returnType: 'mixed *',
            category: '数组相关函数（Arrays）'
        });
        expect(doc?.syntax).toContain('varargs mixed *allocate');
        expect(doc?.description).toContain('配置一个有 `size` 个元素的数组');
        expect(doc?.returnValue).toContain('allocate() 返回数组');
    });

    test('should build completion documentation from bundled docs synchronously', () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context);
        const provider = new LPCCompletionItemProvider(manager, {
            getMacro: jest.fn(),
            scanMacros: jest.fn().mockResolvedValue(undefined),
            getIncludePath: jest.fn()
        } as any);

        const staticItems = (provider as any).staticItems as Array<{ label: string; documentation?: { value: string } }>;
        const allocateItem = staticItems.find(item => item.label === 'allocate');

        expect(allocateItem).toBeDefined();
        expect(allocateItem?.documentation?.value).toContain('varargs mixed *allocate');
        expect(allocateItem?.documentation?.value).toContain('**Return Type:** `mixed *`');
        expect(allocateItem?.documentation?.value).toContain('配置一个有 `size` 个元素的数组');
    });

    test('should fetch MudWiki docs on demand when bundled doc is missing', async () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;
        const manager = new EfunDocsManager(context);
        const mudWikiHtml = `
            <div id="mw-content-text">
                <div class="mw-parser-output">
                    <h3><span class="mw-headline">语法</span></h3>
                    <pre>int valid_read( string file, object user, string func );</pre>
                    <h3><span class="mw-headline">描述</span></h3>
                    <pre>检查读取权限。</pre>
                    <h3><span class="mw-headline">返回值</span></h3>
                    <pre>成功返回 1，失败返回 0。</pre>
                    <h3><span class="mw-headline">参考</span></h3>
                    <pre><a href="/Valid_write">valid_write</a></pre>
                </div>
            </div>
            <div class="printfooter"></div>
        `;

        (manager as any).efunDocs.delete('valid_read');
        (axios.get as jest.Mock).mockResolvedValue({
            data: mudWikiHtml
        });

        const doc = await manager.getEfunDoc('valid_read');

        expect(axios.get).toHaveBeenCalled();
        expect(doc).toMatchObject({
            name: 'valid_read',
            syntax: 'int valid_read( string file, object user, string func );',
            returnType: 'int',
            description: '检查读取权限。',
            returnValue: '成功返回 1，失败返回 0。'
        });
        expect(doc?.reference).toEqual(['valid_write']);
        expect(manager.getStandardDoc('valid_read')).toMatchObject({
            returnType: 'int'
        });
    });

    test('hover markdown is not trusted and preserves pointer-like parameter types in the table', () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context) as any;
        const hover = manager.createHoverContent({
            name: 'demo',
            syntax: 'mixed demo(mixed * items, string* label)',
            description: 'demo description\n\n参数:\nmixed * items: item list\nstring* label: label text'
        });

        const content = hover.contents as vscode.MarkdownString;
        expect(content.isTrusted).toBe(false);
        expect(content.value).toContain('| `items` | `mixed *` | item list |');
        expect(content.value).toContain('| `label` | `string*` | label text |');
    });

    test('include lookup parses functions from included .c files', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-'));
        const mainFile = path.join(tempRoot, 'main.c');
        const includeFile = path.join(tempRoot, 'helper.c');

        fs.writeFileSync(
            mainFile,
            '#include "helper.c"\n'
        );
        fs.writeFileSync(
            includeFile,
            [
                '/**',
                ' * helper description',
                ' * @return int helper result',
                ' */',
                'int helper_func()'
            ].join('\n')
        );

        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context) as any;
        const document = {
            uri: { fsPath: mainFile }
        } as vscode.TextDocument;

        const doc = await manager.findFunctionDocInIncludes(document, 'helper_func');

        expect(doc).toMatchObject({
            name: 'helper_func',
            category: `包含自 ${path.basename(includeFile)}`
        });
        expect(doc?.description).toContain('helper description');

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('include lookup resolves workspace-root LPC include paths', async () => {
        const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-root-'));
        const includeDir = path.join(tempRoot, 'include');
        const mainFile = path.join(tempRoot, 'main.c');
        const includeFile = path.join(includeDir, 'helper.h');

        fs.mkdirSync(includeDir, { recursive: true });
        fs.writeFileSync(mainFile, '#include "/include/helper.h"\n');
        fs.writeFileSync(
            includeFile,
            [
                '/**',
                ' * root include helper',
                ' */',
                'int helper_root()'
            ].join('\n')
        );

        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: tempRoot } }];

        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context) as any;
        const document = {
            uri: { fsPath: mainFile }
        } as vscode.TextDocument;

        const doc = await manager.findFunctionDocInIncludes(document, 'helper_root');

        expect(doc).toMatchObject({
            name: 'helper_root',
            category: '包含自 helper.h'
        });

        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    test('missing remote docs are negatively cached after the first miss', async () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;
        const manager = new EfunDocsManager(context);

        (axios.get as jest.Mock).mockRejectedValue(new Error('not found'));
        (manager as any).efunDocs.delete('totally_missing_efun');

        const first = await manager.getEfunDoc('totally_missing_efun');
        const firstCallCount = (axios.get as jest.Mock).mock.calls.length;
        const second = await manager.getEfunDoc('totally_missing_efun');

        expect(first).toBeUndefined();
        expect(second).toBeUndefined();
        expect(firstCallCount).toBeGreaterThan(0);
        expect((axios.get as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });

    test('only the latest async current-file update wins when updates overlap', async () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context) as any;
        manager.parseInheritStatements = jest
            .fn()
            .mockImplementation((content: string) => content.includes('first') ? ['first.c'] : ['second.c']);
        manager.loadInheritedFileDocs = jest
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
            fileName: 'first.c',
            uri: { fsPath: 'first.c' },
            getText: () => 'inherit "first";'
        } as vscode.TextDocument;
        const secondDocument = {
            languageId: 'lpc',
            fileName: 'second.c',
            uri: { fsPath: 'second.c' },
            getText: () => 'inherit "second";'
        } as vscode.TextDocument;

        const firstUpdate = manager.updateCurrentFileDocs(firstDocument);
        const secondUpdate = manager.updateCurrentFileDocs(secondDocument);
        await Promise.all([firstUpdate, secondUpdate]);

        expect(manager.currentFilePath).toBe('second.c');
        expect(manager.inheritedFiles).toEqual(['second.c']);
        expect(Array.from(manager.inheritedFileDocs.keys())).toEqual(['second-path']);
    });

    test('same-file hover waits for the latest in-flight current-file update', async () => {
        const context = {
            subscriptions: [],
            extensionPath: process.cwd()
        } as unknown as vscode.ExtensionContext;

        const manager = new EfunDocsManager(context) as any;
        manager.currentFilePath = 'same.c';
        manager.currentFileDocs = new Map([
            ['helper', {
                name: 'helper',
                syntax: 'int helper()',
                description: 'old description'
            }]
        ]);
        manager.currentFileUpdatePromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                manager.currentFileDocs = new Map([
                    ['helper', {
                        name: 'helper',
                        syntax: 'int helper()',
                        description: 'new description'
                    }]
                ]);
                resolve();
            }, 20);
        });

        const hover = await manager.provideHover({
            uri: { fsPath: 'same.c' },
            getWordRangeAtPosition: () => ({}) as vscode.Range,
            getText: () => 'helper'
        } as unknown as vscode.TextDocument, {} as vscode.Position);

        const content = hover?.contents as vscode.MarkdownString;
        expect(content.value).toContain('new description');
    });
});

describe('SimulatedEfunScanner', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((_: string, defaultValue?: unknown) => defaultValue),
            update: jest.fn().mockResolvedValue(undefined)
        });
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(''));
        (vscode.workspace.workspaceFolders as unknown) = [];
    });

    test('clears previously loaded docs when a later reload cannot scan', async () => {
        const scanner = new SimulatedEfunScanner();

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string) => key === 'lpc.simulatedEfunsPath' ? 'simul_efuns' : undefined)
        });
        (vscode.workspace.workspaceFolders as unknown) = [{ uri: { fsPath: 'D:/workspace' } }];
        (vscode.workspace.findFiles as jest.Mock).mockResolvedValueOnce([{ fsPath: 'D:/workspace/simul_efuns/foo.c' }]);
        (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValueOnce(Buffer.from([
            '/**',
            ' * @brief simulated helper',
            ' */',
            'int sim_helper()'
        ].join('\n')));

        await scanner.loadSimulatedEfuns();
        expect(scanner.get('sim_helper')).toBeDefined();

        (vscode.workspace.workspaceFolders as unknown) = [];
        await scanner.loadSimulatedEfuns();

        expect(scanner.get('sim_helper')).toBeUndefined();
        expect(scanner.getAllNames()).toEqual([]);
    });
});
