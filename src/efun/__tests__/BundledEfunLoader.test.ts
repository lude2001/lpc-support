import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { BundledEfunLoader } from '../BundledEfunLoader';
import { BundledEfunDocsProvider } from '../BundledEfunDocsProvider';

const repository = path.resolve(__dirname, '../../..');
const context = (extensionPath: string): vscode.ExtensionContext => ({ extensionPath } as vscode.ExtensionContext);
const read = (filename: string) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const roots: string[] = [];

function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-efun-loader-'));
    roots.push(root);
    const write = (filename: string, value: unknown) => {
        const target = path.join(root, 'config/efun-docs', filename);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify(value));
    };
    write('categories.json', { strings: ['sample'] });
    write('docs/sample.json', { name: 'sample', categoryId: 'strings', signatures: [{
        label: 'string sample(string value)', returnType: 'string', isVariadic: false,
        parameters: [{ name: 'value', type: 'string' }], arity: { min: 1, max: 1 }
    }] });
    write('locales/en/categories.json', { strings: 'Strings' });
    write('locales/zh-cn/categories.json', { strings: '字符串' });
    write('locales/en/sample.json', { summary: '  Returns a string.\n', details: '```lpc\n sample("x");\n```\n', note: 'English note.' });
    write('locales/zh-cn/sample.json', { summary: '  返回字符串。\n', details: 5, note: '' });
    return root;
}

afterEach(() => {
    jest.restoreAllMocks();
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('bundled Efun text overlays', () => {
    test.each(['en', 'zh-cn'] as const)('materializes all 413 %s documents without changing facts or body whitespace', async locale => {
        const loader = new BundledEfunLoader(locale);
        await loader.load(context(repository));
        const baseline = read(path.join(repository, 'tests/fixtures/localization/efun-baseline.json'));
        expect(loader.getAllNames().sort()).toEqual(baseline.documents.map((doc: any) => doc.name));
        expect(loader.getCategories().size).toBe(23);
        for (const expected of baseline.documents) {
            const structure = read(path.join(repository, 'config/efun-docs/docs', `${expected.name}.json`));
            const text = read(path.join(repository, 'config/efun-docs/locales', locale, `${expected.name}.json`));
            const actual = loader.getStructuredDoc(expected.name)!;
            expect(actual.name).toBe(expected.name);
            expect(actual.categoryId).toBe(expected.categoryId);
            expect(loader.getCategories().get(expected.categoryId)).toContain(expected.name);
            expect(actual.signatures).toEqual(structure.signatures);
            for (const field of ['summary', 'details', 'note'] as const) expect(actual[field]).toBe(text[field]);
        }
    });

    test('falls back by field and category, retaining signatures when both language files fail', async () => {
        const root = fixture();
        const loader = new BundledEfunLoader('zh-cn');
        await loader.load(context(root));
        const first = loader.getStructuredDoc('sample')!;
        expect(first.summary).toBe('  返回字符串。\n');
        expect(first.details).toBe('```lpc\n sample("x");\n```\n');
        expect(first.note).toBe('English note.');
        expect(loader.getCategoryLabel('strings')).toBe('字符串');
        fs.writeFileSync(path.join(root, 'config/efun-docs/locales/zh-cn/categories.json'), '{');
        fs.writeFileSync(path.join(root, 'config/efun-docs/locales/zh-cn/sample.json'), '{');
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        await loader.load(context(root));
        expect(loader.getStructuredDoc('sample')?.summary).toBe('  Returns a string.\n');
        expect(loader.getCategoryLabel('strings')).toBe('Strings');
        fs.unlinkSync(path.join(root, 'config/efun-docs/locales/en/sample.json'));
        await loader.load(context(root));
        const absent = loader.getStructuredDoc('sample')!;
        expect(absent.summary).toBeUndefined();
        expect(absent.details).toBeUndefined();
        expect(absent.note).toBeUndefined();
        expect(absent.signatures).toEqual(first.signatures);
        expect(loader.getAllNames()).toEqual(['sample']);
    });

    test('selects the host language once and serves cached bodies with stable declaration identities', async () => {
        const root = fixture();
        const originalLanguage = vscode.env.language;
        Object.defineProperty(vscode.env, 'language', { value: 'zh-cn', configurable: true });
        try {
            const provider = new BundledEfunDocsProvider(context(root));
            await provider.bundledDocsReady;
            fs.rmSync(path.join(root, 'config'), { recursive: true });
            expect(provider.getStandardCallableDoc('sample')).toMatchObject({
                declarationKey: 'efun:sample', sourceKind: 'efun', summary: '  返回字符串。\n',
                details: '```lpc\n sample("x");\n```\n', note: 'English note.'
            });
            expect(provider.getCategories().get('strings')).toEqual(['sample']);
            expect(provider.getCategoryLabel('strings')).toBe('字符串');
        } finally {
            Object.defineProperty(vscode.env, 'language', { value: originalLanguage, configurable: true });
        }
    });
});
