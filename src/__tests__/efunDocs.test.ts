import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LPCCompletionItemProvider } from '../completionProvider';
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
});
