import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildBundles, collectSourceMessages, loadCatalogues, parseCatalogue, placeholders } from './build-bundles.mjs';

async function fixture(t, catalogues, source = 'vscode.l10n.t("Hello {0}", name);') {
    const root = await mkdtemp(path.join(tmpdir(), 'lpc-l10n-bundles-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, 'l10n', 'source'), { recursive: true });
    await mkdir(path.join(root, 'src'), { recursive: true });
    for (const [filename, entries] of Object.entries(catalogues)) {
        await writeFile(path.join(root, 'l10n', 'source', filename), JSON.stringify(entries));
    }
    await writeFile(path.join(root, 'src', 'extension.ts'), source);
    return root;
}

test('matches named and numbered arguments without inventing brace escape rules', () => {
    assert.deepEqual(placeholders('Hello {name}, {0}, {name}; {{literal}}'), ['0', 'name']);
    assert.doesNotThrow(() => parseCatalogue('{"{0} {name}":"{name} {0}"}', 'test.json'));
});

test('rejects empty, malformed, duplicate and mismatched catalogue entries', () => {
    for (const text of ['[]', 'null', '{"Hello":3}', '{"Hello":""}', '{"Hello":"你好","Hello":"您好"}', '{"{0}":"{1}"}', '{"未迁移文案":"未迁移文案"}']) {
        assert.throws(() => parseCatalogue(text, 'invalid.json'));
    }
});

test('rejects missing interpolation values and accepts explicitly named arguments', async t => {
    const root = await fixture(t, {}, 'vscode.l10n.t("Missing {0}");');
    await assert.rejects(collectSourceMessages(root), /missing argument/);
    await writeFile(path.join(root, 'src', 'extension.ts'), 'vscode.l10n.t("Hello {name}", { name: value });');
    assert.deepEqual([...await collectSourceMessages(root)], ['Hello {name}']);
    await writeFile(path.join(root, 'src', 'extension.ts'), 'vscode.l10n.t("Hello {name}", { wrong: value });');
    await assert.rejects(collectSourceMessages(root), /missing argument/);
});

test('merges identical shared translations and rejects conflicting ones', async t => {
    const root = await fixture(t, { 'b.json': { Hello: '你好' }, 'a.json': { Hello: '你好' } });
    assert.deepEqual((await loadCatalogues(path.join(root, 'l10n', 'source'))).messages, { Hello: '你好' });
    await writeFile(path.join(root, 'l10n', 'source', 'b.json'), JSON.stringify({ Hello: '您好' }));
    await assert.rejects(loadCatalogues(path.join(root, 'l10n', 'source')), /Conflicting translations/);
});

test('extracts native literal templates and rejects dynamic message keys', async t => {
    const root = await fixture(t, {}, 'vscode.l10n.t("Hello"); l10n.t(`Goodbye`); localize("Ready");');
    assert.deepEqual([...await collectSourceMessages(root)], ['Hello', 'Goodbye', 'Ready']);
    await writeFile(path.join(root, 'src', 'extension.ts'), 'vscode.l10n.t(`Hello ${name}`);');
    await assert.rejects(collectSourceMessages(root), /literal templates/);
});

test('ignores test and mock source messages', async t => {
    const root = await fixture(t, {});
    await mkdir(path.join(root, 'src', '__tests__'));
    await writeFile(path.join(root, 'src', '__tests__', 'ignored.test.ts'), 'vscode.l10n.t(dynamicValue);');
    assert.deepEqual([...await collectSourceMessages(root)], ['Hello {0}']);
});

test('checks are read-only and reject missing or stale bundles', async t => {
    const root = await fixture(t, { 'host.json': { 'Hello {0}': '你好 {0}' } });
    await assert.rejects(buildBundles(root), /missing or stale/);
    const result = await buildBundles(root, { write: true });
    assert.equal(result.messages, 1);
    assert.equal((await buildBundles(root)).mode, 'check');
    const english = await readFile(path.join(root, 'l10n', 'bundle.l10n.json'), 'utf8');
    assert.deepEqual(JSON.parse(english), { 'Hello {0}': 'Hello {0}' });
    await writeFile(path.join(root, 'l10n', 'bundle.l10n.zh-cn.json'), '{}');
    await assert.rejects(buildBundles(root), /missing or stale/);
    assert.equal(await readFile(path.join(root, 'l10n', 'bundle.l10n.zh-cn.json'), 'utf8'), '{}');
});

test('missing translations and orphaned source keys stop generation', async t => {
    const root = await fixture(t, { 'host.json': { Unused: '未使用' } });
    await assert.rejects(buildBundles(root, { write: true }), /coverage mismatch/);
});
