import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import yazl from 'yazl';
import { buildBaseline, fingerprint } from './efun-baseline.mjs';
import { checkVsixLocalization, loadReviewedContract, run } from './check-vsix-localization.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value));
const bodyHash = value => fingerprint(value).slice('sha256:'.length);

function nativeHeader(target) {
    // Synthetic executable metadata only; these bytes are never executed and
    // do not claim to be a real binary for any of the six platforms.
    const bytes = Buffer.alloc(512);
    const arm = target.endsWith('arm64');
    if (target.startsWith('win32-')) {
        bytes.write('MZ');
        bytes.writeUInt32LE(0x80, 0x3c);
        bytes.write('PE\0\0', 0x80);
        bytes.writeUInt16LE(arm ? 0xaa64 : 0x8664, 0x84);
        bytes.writeUInt16LE(1, 0x86); // NumberOfSections
        bytes.writeUInt16LE(240, 0x94); // SizeOfOptionalHeader
        bytes.writeUInt16LE(0x22, 0x96); // EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE
        bytes.writeUInt16LE(0x20b, 0x98); // PE32+
    } else if (target.startsWith('linux-')) {
        Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]).copy(bytes);
        bytes.writeUInt16LE(3, 16); // ET_DYN (PIE)
        bytes.writeUInt16LE(arm ? 183 : 62, 18);
        bytes.writeUInt32LE(1, 20);
        bytes.writeBigUInt64LE(0x1100n, 24);
        bytes.writeBigUInt64LE(64n, 32); // Program header table
        bytes.writeUInt16LE(64, 52);
        bytes.writeUInt16LE(56, 54);
        bytes.writeUInt16LE(1, 56);
        bytes.writeUInt32LE(1, 64); // PT_LOAD
        bytes.writeUInt32LE(5, 68); // PF_R | PF_X
        bytes.writeBigUInt64LE(0x1000n, 80);
        bytes.writeBigUInt64LE(BigInt(bytes.length), 96);
        bytes.writeBigUInt64LE(BigInt(bytes.length), 104);
    } else {
        bytes.writeUInt32LE(0xfeedfacf, 0);
        bytes.writeUInt32LE(arm ? 0x0100000c : 0x01000007, 4);
        bytes.writeUInt32LE(2, 12); // MH_EXECUTE
        bytes.writeUInt32LE(1, 16);
        bytes.writeUInt32LE(24, 20);
        bytes.writeUInt32LE(0x80000028, 32); // LC_MAIN
        bytes.writeUInt32LE(24, 36);
        bytes.writeBigUInt64LE(0x100n, 40);
    }
    return bytes;
}

async function fixture(t, target = 'win32-x64') {
    const root = await mkdtemp(path.join(tmpdir(), 'lpc-vsix-localization-'));
    t.after(async () => {
        assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
        assert.ok(path.basename(root).startsWith('lpc-vsix-localization-'));
        await rm(root, { recursive: true, force: true });
    });
    const files = new Map();
    const modes = new Map();
    const put = (name, value) => files.set(name, typeof value === 'string' ? Buffer.from(value) : Buffer.isBuffer(value) ? value : json(value));
    const structure = {
        name: 'sample', categoryId: 'strings', signatures: [{
            label: 'string sample(string value)', returnType: 'string', isVariadic: false,
            parameters: [{ name: 'value', type: 'string' }], arity: { min: 1, max: 1 }
        }]
    };
    // Build the tiny test baseline through the existing production projector.
    const docsRoot = path.join(root, 'efun-docs');
    await mkdir(path.join(docsRoot, 'docs'), { recursive: true });
    await writeFile(path.join(docsRoot, 'docs/sample.json'), json(structure));
    await writeFile(path.join(docsRoot, 'categories.json'), json({ strings: ['sample'] }));
    const baseline = await buildBaseline(docsRoot);
    const manifest = {
        name: 'lpc-support', version: '1.0.0', publisher: 'fixture',
        displayName: '%title%', main: './dist/extension.js', icon: 'icon.png', l10n: './l10n',
        contributes: {
            languages: [{ id: 'lpc', configuration: './language-configuration.json' }],
            grammars: [{ language: 'lpc', path: './syntaxes/lpc.tmLanguage.json' }],
            snippets: [{ language: 'lpc', path: '%snippetPath%' }],
            commands: [{ command: 'lpc.example', title: '%command%', icon: { light: './media/light.svg', dark: './media/dark.svg' } }]
        }
    };
    const snippets = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Snippet ${i}`, {
        prefix: `s${i}`, body: [`sample(${i});`], description: `Sample ${i}`
    }]));
    const chineseSnippets = Object.fromEntries(Object.entries(snippets).map(([name, value]) => [name, { ...value, description: '示例' }]));
    const resources = {
        'package.nls.json': { title: 'LPC Support', command: 'Example', snippetPath: './snippets/lpc.json' },
        'package.nls.zh-cn.json': { title: 'LPC 支持', command: '示例', snippetPath: './snippets/lpc.zh-cn.json' },
        'l10n/bundle.l10n.json': { 'Value {0}': 'Value {0}' },
        'l10n/bundle.l10n.zh-cn.json': { 'Value {0}': '值 {0}' },
        'snippets/lpc.json': snippets,
        'snippets/lpc.zh-cn.json': chineseSnippets,
        'config/efun-docs/locales/en/categories.json': { strings: 'Strings' },
        'config/efun-docs/locales/zh-cn/categories.json': { strings: '字符串' }
    };
    const texts = {
        en: { summary: 'Returns a string.', details: '```lpc\n sample("value");\n```\n', note: 'A note.' },
        'zh-cn': { summary: '返回字符串。', details: '```lpc\n sample("value");\n```\n', note: '备注。' }
    };
    put('extension/package.json', manifest);
    put('extension/config/efun-docs/docs/sample.json', structure);
    put('extension/config/efun-docs/categories.json', { strings: ['sample'] });
    for (const [name, value] of Object.entries(resources)) put(`extension/${name}`, value);
    for (const [locale, value] of Object.entries(texts)) put(`extension/config/efun-docs/locales/${locale}/sample.json`, value);
    for (const name of ['dist/extension.js', 'icon.png', 'language-configuration.json', 'syntaxes/lpc.tmLanguage.json',
        'media/light.svg', 'media/dark.svg', 'dist/templates/functionDocPanel.html', 'dist/templates/functionDocPanel.js',
        'dist/templates/functionDocPanel.css']) put(`extension/${name}`, 'fixture');
    put('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/extension/package.json" ContentType="application/json"/></Types>');
    put('extension.vsixmanifest', `<?xml version="1.0"?><PackageManifest xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Id="lpc-support" Version="1.0.0" Publisher="fixture" TargetPlatform="${target}"/></Metadata><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json"/></Assets></PackageManifest>`);
    const executable = target.startsWith('win32-') ? 'lpc-language-server.exe' : 'lpc-language-server';
    const native = nativeHeader(target);
    put(`extension/dist/bin/${executable}`, native);
    modes.set(`extension/dist/bin/${executable}`, 0o100755);
    put(`extension/dist/bin/${executable}.sha256`, `${digest(native)}  ${executable}\n`);
    const contract = {
        baseline, resources,
        documents: { sample: { fields: Object.keys(texts.en).sort(), hashes: { en: bodyHash(texts.en), 'zh-cn': bodyHash(texts['zh-cn']) } } }
    };
    let nextArchive = 0;
    return {
        root, files, modes, put, manifest, contract, executable,
        async reviewedSource() {
            const write = async (relative, bytes) => {
                const filename = path.join(root, relative);
                await mkdir(path.dirname(filename), { recursive: true });
                await writeFile(filename, bytes);
            };
            for (const [name, bytes] of files) if (name.startsWith('extension/')) await write(name.slice('extension/'.length), bytes);
            await write('tests/fixtures/localization/efun-baseline.json', json(baseline));
            const { categoryId, ...legacy } = structure;
            const sourceSha256 = bodyHash({ ...legacy,
                category: baseline.categoryIdentities.find(category => category.id === categoryId).legacyName, ...texts['zh-cn'] });
            await write('tests/fixtures/localization/efun-source-text.json', json({
                schemaVersion: 1, hashMode: 'sha256-canonical-json-v1', structuralFingerprint: baseline.semanticFingerprint,
                documents: { sample: { sourceSha256, fields: texts['zh-cn'] } }
            }));
            for (let group = 0; group < 3; group++) {
                const item = { name: 'sample', sourceSha256, enSha256: bodyHash(texts.en), zhCnSha256: bodyHash(texts['zh-cn']),
                    reviewedFields: Object.keys(texts.en).sort() };
                await write(`docs/i18n-efun-review/group-${group}.json`, json({
                    group, hashMode: 'sha256-canonical-json-v1', author: 'fixture-author',
                    items: group === 0 ? [{ ...item, status: 'self-reviewed' }] : []
                }));
                await write(`docs/i18n-efun-review/independent-group-${group}.json`, json({
                    group, hashMode: 'sha256-canonical-json-v1', reviewer: 'fixture-reviewer',
                    items: group === 0 ? [{ ...item, status: 'reviewed', issues: [] }] : []
                }));
            }
        },
        async archive(extraEntries = []) {
            const zip = new yazl.ZipFile();
            const filename = path.join(root, `fixture-${nextArchive++}.vsix`);
            const completed = pipeline(zip.outputStream, createWriteStream(filename));
            for (const [name, value] of [...files, ...extraEntries]) zip.addBuffer(value, name, { mode: modes.get(name) ?? 0o100644 });
            zip.end();
            await completed;
            return filename;
        },
        async check(options = {}) { return checkVsixLocalization(await this.archive(), { contract, ...options }); }
    };
}

for (const target of ['win32-x64', 'win32-arm64', 'linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64']) {
    test(`checks a synthetic ${target} package without extracting or executing it`, async t => {
        const f = await fixture(t, target);
        const result = await f.check({ target });
        assert.equal(result.result, 'passed');
        assert.equal(result.target, target);
        assert.equal(result.nativeSnippetsPerLanguage, 9);
        assert.equal(result.efunDocuments, 1);
        assert.equal(result.efunBodies, 2);
        assert.equal(result.efunCategoriesPerLanguage, 1);
        assert.equal(result.native.sha256, digest(nativeHeader(target)));
    });
}

test('derives the target from VSIX metadata when --target is omitted', async t => {
    const f = await fixture(t, 'linux-arm64');
    assert.equal((await f.check()).target, 'linux-arm64');
});

test('production contract loading requires current independent review, not only a new author hash', async t => {
    const f = await fixture(t);
    await f.reviewedSource();
    assert.deepEqual(await loadReviewedContract(f.root), f.contract);
    const bodyPath = path.join(f.root, 'config/efun-docs/locales/en/sample.json');
    const changed = JSON.parse(await readFile(bodyPath, 'utf8'));
    changed.summary = 'Updated without independent review.';
    await writeFile(bodyPath, json(changed));
    const ledgerPath = path.join(f.root, 'docs/i18n-efun-review/group-0.json');
    const author = JSON.parse(await readFile(ledgerPath, 'utf8'));
    author.items[0].enSha256 = bodyHash(changed);
    await writeFile(ledgerPath, json(author));
    await assert.rejects(loadReviewedContract(f.root), /independent review is unresolved or stale/u);
});

test('requires an explicit path and accepts only one known target', async () => {
    for (const args of [[], ['--target'], ['x.vsix', '--target', 'universal'], ['--write'], ['x.vsix', 'another.vsix'],
        ['x.vsix', '--target', 'linux-x64', '--target', 'linux-x64']]) {
        await assert.rejects(run(args), /Usage|target/u);
    }
});

for (const resource of ['package.nls.zh-cn.json', 'l10n/bundle.l10n.zh-cn.json', 'snippets/lpc.zh-cn.json',
    'config/efun-docs/locales/zh-cn/sample.json', 'dist/templates/functionDocPanel.js']) {
    test(`rejects a package missing ${resource}`, async t => {
        const f = await fixture(t);
        f.files.delete(`extension/${resource}`);
        await assert.rejects(f.check(), /Missing VSIX resource|resource catalogue differs|exactly two/u);
    });
}

test('requires one native snippet contribution and stable prefix/body', async t => {
    const f = await fixture(t);
    f.manifest.contributes.snippets.push({ language: 'lpc', path: './snippets/lpc.zh-cn.json' });
    f.put('extension/package.json', f.manifest);
    await assert.rejects(f.check(), /one native LPC snippet/u);
    f.manifest.contributes.snippets.pop();
    f.put('extension/package.json', f.manifest);
    const changed = structuredClone(f.contract.resources['snippets/lpc.zh-cn.json']);
    changed['Snippet 0'].body = ['changed();'];
    f.put('extension/snippets/lpc.zh-cn.json', changed);
    await assert.rejects(f.check(), /snippet insertion facts differ/u);
});

test('rejects incomplete or changed message bundles, including placeholder drift', async t => {
    const f = await fixture(t);
    f.put('extension/l10n/bundle.l10n.zh-cn.json', { 'Value {0}': '值 {1}' });
    await assert.rejects(f.check(), /placeholders differ/u);
    f.put('extension/l10n/bundle.l10n.zh-cn.json', { 'Value {0}': '不同的值 {0}' });
    await assert.rejects(f.check(), /packaged localization differs/u);
});

test('rejects extra language resources that could select a locale the sidecar does not ship', async t => {
    const f = await fixture(t);
    f.put('extension/package.nls.fr.json', {});
    await assert.rejects(f.check(), /exactly two manifest NLS/u);
    f.files.delete('extension/package.nls.fr.json');
    f.put('extension/l10n/bundle.l10n.fr.json', {});
    await assert.rejects(f.check(), /exactly two runtime localization/u);
});

test('rejects missing manifest file references and unresolved NLS keys', async t => {
    const f = await fixture(t);
    f.files.delete('extension/media/dark.svg');
    await assert.rejects(f.check(), /Missing VSIX resource: extension\/media\/dark.svg/u);
    f.put('extension/media/dark.svg', 'fixture');
    f.manifest.displayName = '%missing%';
    f.put('extension/package.json', f.manifest);
    await assert.rejects(f.check(), /unresolved reference %missing%/u);
});

test('checks VSIX asset and content-type references as well as package.json paths', async t => {
    const f = await fixture(t);
    const original = f.files.get('extension.vsixmanifest').toString();
    f.put('extension.vsixmanifest', original.replace('</Assets>', '<Asset Type="test" Path="extension/missing.txt"/></Assets>'));
    await assert.rejects(f.check(), /Missing VSIX resource: extension\/missing.txt/u);
    f.put('extension.vsixmanifest', original);
    f.put('[Content_Types].xml', '<Types><Override PartName="/missing.txt"/></Types>');
    await assert.rejects(f.check(), /Missing VSIX resource: missing.txt/u);
});

test('rejects structural prose duplication and immutable signature changes', async t => {
    const f = await fixture(t);
    const filename = 'extension/config/efun-docs/docs/sample.json';
    const structure = JSON.parse(f.files.get(filename));
    f.put(filename, { ...structure, summary: 'Duplicated body.' });
    await assert.rejects(f.check(), /duplicated prose/u);
    structure.signatures[0].arity.note = 'Hidden duplicated body.';
    f.put(filename, structure);
    await assert.rejects(f.check(), /duplicated prose/u);
    delete structure.signatures[0].arity.note;
    structure.signatures[0].arity.min = 0;
    f.put(filename, structure);
    await assert.rejects(f.check(), /packaged Efun facts differ/u);
});

test('rejects incomplete category translations and changed reviewed Efun bodies', async t => {
    const f = await fixture(t);
    f.put('extension/config/efun-docs/locales/en/categories.json', {});
    await assert.rejects(f.check(), /packaged localization differs|missing Efun category labels/u);
    f.put('extension/config/efun-docs/locales/en/categories.json', f.contract.resources['config/efun-docs/locales/en/categories.json']);
    f.put('extension/config/efun-docs/locales/en/sample.json', { summary: 'Wrong body.', details: 'Details.', note: 'Note.' });
    await assert.rejects(f.check(), /packaged body differs from the reviewed translation/u);
    f.put('extension/config/efun-docs/locales/en/sample.json', { summary: 'Incomplete.' });
    await assert.rejects(f.check(), /unexpected or missing Efun body fields/u);
});

test('rejects invalid JSON and duplicate archive paths', async t => {
    const f = await fixture(t);
    f.put('extension/package.nls.json', '{ invalid');
    await assert.rejects(f.check(), /package.nls.json/u);
    const duplicate = await f.archive([['extension/package.json', f.files.get('extension/package.json')]]);
    await assert.rejects(checkVsixLocalization(duplicate, { contract: f.contract }), /Duplicate ZIP entry/u);
});

test('matches requested target, archive target, binary architecture and checksum', async t => {
    const f = await fixture(t);
    await assert.rejects(f.check({ target: 'linux-x64' }), /does not match --target/u);
    const nativePath = `extension/dist/bin/${f.executable}`;
    f.put(nativePath, nativeHeader('win32-arm64'));
    await assert.rejects(f.check(), /file header does not match/u);
    f.put(nativePath, nativeHeader('win32-x64'));
    f.put(`${nativePath}.sha256`, `${'0'.repeat(64)}  ${f.executable}\n`);
    await assert.rejects(f.check(), /SHA-256/u);
    f.put(`${nativePath}.sha256`, `${digest(nativeHeader('win32-x64'))}  other.exe\n`);
    await assert.rejects(f.check(), /SHA-256 or checksum filename/u);
});

for (const [target, kind, change, message] of [
    ['win32-x64', 'a DLL', bytes => bytes.writeUInt16LE(0x2022, 0x96), /not a DLL/u],
    ['win32-x64', 'a nonexecutable COFF image', bytes => bytes.writeUInt16LE(0x20, 0x96), /executable image/u],
    ['win32-x64', 'a PE32 image', bytes => bytes.writeUInt16LE(0x10b, 0x98), /PE32\+/u],
    ['win32-x64', 'an incomplete PE header', bytes => bytes.writeUInt16LE(512, 0x94), /incomplete PE/u],
    ['linux-x64', 'an ELF relocatable object', bytes => bytes.writeUInt16LE(1, 16), /not a relocatable object/u],
    ['linux-x64', 'an explicit FreeBSD ELF ABI', bytes => { bytes[7] = 9; }, /ABI must be SYSV or Linux/u],
    ['linux-x64', 'an ELF with no entry point', bytes => bytes.writeBigUInt64LE(0n, 24), /entry point or program headers/u],
    ['linux-x64', 'an ELF with out-of-range program headers', bytes => bytes.writeBigUInt64LE(500n, 32), /entry point or program headers/u],
    ['linux-x64', 'an ELF with no executable load segment', bytes => bytes.writeUInt32LE(4, 68), /not in an executable load segment/u],
    ['darwin-arm64', 'a Mach-O dylib', bytes => bytes.writeUInt32LE(6, 12), /MH_EXECUTE/u],
    ['darwin-arm64', 'incomplete Mach-O load commands', bytes => bytes.writeUInt32LE(512, 20), /incomplete Mach-O/u]
]) {
    test(`rejects ${kind} as the ${target} sidecar even with a matching checksum`, async t => {
        const f = await fixture(t, target);
        const bytes = nativeHeader(target);
        change(bytes);
        f.put(`extension/dist/bin/${f.executable}`, bytes);
        f.put(`extension/dist/bin/${f.executable}.sha256`, `${digest(bytes)}  ${f.executable}\n`);
        await assert.rejects(f.check(), message);
    });
}

for (const target of ['linux-x64', 'darwin-arm64']) {
    test(`rejects a ${target} sidecar packaged without executable permission`, async t => {
        const f = await fixture(t, target);
        f.modes.set(`extension/dist/bin/${f.executable}`, 0o100644);
        await assert.rejects(f.check(), /no executable permission/u);
    });
}

test('does not require Unix executable bits for the Windows sidecar', async t => {
    const f = await fixture(t);
    f.modes.set(`extension/dist/bin/${f.executable}`, 0o100644);
    assert.equal((await f.check()).result, 'passed');
});

for (const leak of ['extension/tests/fixtures/example.json', 'extension/docs/i18n-efun-review/group-1.json',
    'extension/docs/i18n-m5-loader-review.md', 'extension/dist/bin/efun-catalogue.exe', 'extension/l10n/source/commands.json',
    'extension/config/efun-docs/review.json']) {
    test(`rejects development-only file ${leak}`, async t => {
        const f = await fixture(t);
        f.put(leak, '{}');
        await assert.rejects(f.check(), /Development or review resource leaked/u);
    });
}
