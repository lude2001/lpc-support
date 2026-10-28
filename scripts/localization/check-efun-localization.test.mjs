import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildBaseline, CATEGORY_IDENTITIES } from './efun-baseline.mjs';
import { canonicalHash, checkEfunLocalization, validateDocumentTranslations } from './check-efun-localization.mjs';

function fixture() {
    const source = { sourceSha256: 'locked-source', fields: {
        summary: '返回 `value`；参见 https://example.com/efun。',
        details: '```lpc\nwrite("中文");\n```'
    } };
    const translations = {
        en: { summary: 'Returns `value`; see https://example.com/efun.', details: source.fields.details },
        'zh-cn': { ...source.fields }
    };
    const review = { name: 'sample', sourceSha256: source.sourceSha256,
        enSha256: canonicalHash(translations.en), zhCnSha256: canonicalHash(translations['zh-cn']),
        reviewedFields: ['summary', 'details'], status: 'self-reviewed',
        retainedFragments: [{ field: 'details', text: '"中文"', reason: 'code-literal' }] };
    return { source, translations, review };
}

test('canonical fingerprints ignore object key ordering and JSON formatting', () => {
    assert.equal(canonicalHash({ a: { y: 2, x: 1 }, b: [3, 4] }),
        canonicalHash({ b: [3, 4], a: { x: 1, y: 2 } }));
    assert.notEqual(canonicalHash([3, 4]), canonicalHash([4, 3]));
});

test('accepts fully reviewed translations with exact code and declared source literals', () => {
    const { source, translations, review } = fixture();
    assert.deepEqual(validateDocumentTranslations('sample', source, translations, review), []);
});

test('missing text, missing fields and stale reviewer hashes fail independently', () => {
    const { source, translations, review } = fixture();
    translations.en.summary = '';
    delete translations['zh-cn'].details;
    const problems = validateDocumentTranslations('sample', source, translations, review);
    assert.ok(problems.some(problem => problem.includes('hash changed')));
    assert.ok(problems.some(problem => problem.includes('missing text')));
    assert.ok(problems.some(problem => problem.includes('unexpected natural-language fields')));
});

test('a translated natural-language field cannot silently retain Chinese', () => {
    const { source, translations, review } = fixture();
    translations.en.summary += ' 漏译';
    review.enSha256 = canonicalHash(translations.en);
    assert.ok(validateDocumentTranslations('sample', source, translations, review)
        .some(problem => problem.includes('undeclared untranslated Chinese')));
});

test('retained fragments must be present in both the source and target', () => {
    const { source, translations, review } = fixture();
    review.retainedFragments.push({ field: 'summary', text: '漏译', reason: 'code-literal' });
    assert.ok(validateDocumentTranslations('sample', source, translations, review)
        .some(problem => problem.includes('invalid retained source fragment')));
});

test('retained-fragment labels cannot waive a whole untranslated paragraph', () => {
    const { source, translations, review } = fixture();
    translations.en.summary = source.fields.summary;
    review.enSha256 = canonicalHash(translations.en);
    for (const reason of ['proper-name', 'code-literal', 'code-example']) {
        review.retainedFragments = [{ field: 'summary', text: source.fields.summary, reason }];
        assert.ok(validateDocumentTranslations('sample', source, translations, review)
            .some(problem => problem.includes('invalid retained source fragment')), reason);
    }
});

test('translated examples, identifiers and URLs cannot drift even with updated hashes', () => {
    const { source, translations, review } = fixture();
    translations.en.summary = 'Returns `other`; see https://invalid.example/changed';
    translations.en.details = '```lpc\nwrite("changed");\n```';
    review.enSha256 = canonicalHash(translations.en);
    const problems = validateDocumentTranslations('sample', source, translations, review);
    for (const kind of ['URL changed', 'inline code changed', 'fenced example changed']) {
        assert.ok(problems.some(problem => problem.includes(kind)));
    }
});

test('new placeholder prose and incomplete review fields are rejected', () => {
    const { source, translations, review } = fixture();
    translations.en.summary = 'TODO';
    review.reviewedFields = ['summary'];
    review.enSha256 = canonicalHash(translations.en);
    const problems = validateDocumentTranslations('sample', source, translations, review);
    assert.ok(problems.some(problem => problem.includes('author review')));
    assert.ok(problems.some(problem => problem.includes('translation placeholder')));
});

test('inline identifiers keep exact text while prose may move backticks or remove repetition', () => {
    const { source, translations, review } = fixture();
    translations.en.summary = 'Returns value; see https://example.com/efun.';
    review.enSha256 = canonicalHash(translations.en);
    assert.deepEqual(validateDocumentTranslations('sample', source, translations, review), []);
    translations.en.summary = 'Returns value_changed; see https://example.com/efun.';
    review.enSha256 = canonicalHash(translations.en);
    assert.ok(validateDocumentTranslations('sample', source, translations, review).some(problem => problem.includes('inline code changed')));
});

test('a protected correction requires explicit original tokens and source evidence in both languages', () => {
    const { source, translations, review } = fixture();
    for (const locale of ['en', 'zh-cn']) translations[locale].summary = translations[locale].summary.replace('`value`', '`corrected`');
    review.enSha256 = canonicalHash(translations.en);
    review.zhCnSha256 = canonicalHash(translations['zh-cn']);
    review.sourceCorrections = [{ field: 'summary', reference: 'driver@pinned:path:1', detail: 'Fix a proven identifier typo.',
        protectedChanges: [{ kind: 'inline-code', before: 'value', after: 'corrected' }] }];
    assert.deepEqual(validateDocumentTranslations('sample', source, translations, review), []);
    review.sourceCorrections[0].reference = '';
    assert.ok(validateDocumentTranslations('sample', source, translations, review).some(problem => problem.includes('evidence')));
    review.sourceCorrections[0].reference = 'driver@pinned:path:1';
    review.sourceCorrections[0].protectedChanges[0].before = 'unrelated';
    assert.ok(validateDocumentTranslations('sample', source, translations, review).some(problem => problem.includes('does not match source')));
});

async function catalogueFixture(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'lpc-efun-guard-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const write = async (filename, value) => {
        const absolute = path.join(root, filename);
        await mkdir(path.dirname(absolute), { recursive: true });
        await writeFile(absolute, `${JSON.stringify(value)}\n`);
    };
    const read = async filename => JSON.parse(await readFile(path.join(root, filename), 'utf8'));
    const names = ['alpha', 'beta', 'gamma'];
    const originals = {};
    for (const name of names) {
        const structure = { name, categoryId: 'arrays', signatures: [{
            label: `int ${name}(int value)`, parameters: [{ name: 'value', type: 'int' }],
            isVariadic: false, returnType: 'int', arity: { min: 1, max: 1 }
        }] };
        await write(`config/efun-docs/docs/${name}.json`, structure);
        const { categoryId, ...legacy } = structure;
        originals[name] = { sourceSha256: canonicalHash({ ...legacy, category: CATEGORY_IDENTITIES[0].legacyName, summary: '原文' }), fields: { summary: '原文' } };
        for (const locale of ['en', 'zh-cn']) await write(`config/efun-docs/locales/${locale}/${name}.json`, { summary: locale === 'en' ? 'Original text.' : '原文' });
    }
    await write('config/efun-docs/categories.json', { arrays: names });
    for (const locale of ['en', 'zh-cn']) await write(`config/efun-docs/locales/${locale}/categories.json`, { arrays: locale === 'en' ? 'Arrays' : '数组' });
    const baseline = await buildBaseline(path.join(root, 'config/efun-docs'));
    await write('tests/fixtures/localization/efun-baseline.json', baseline);
    await write('tests/fixtures/localization/efun-source-text.json', {
        schemaVersion: 1, hashMode: 'sha256-canonical-json-v1', structuralFingerprint: baseline.semanticFingerprint, documents: originals
    });
    for (const [group, name] of names.entries()) {
        const item = { name, sourceSha256: originals[name].sourceSha256,
            enSha256: canonicalHash({ summary: 'Original text.' }), zhCnSha256: canonicalHash({ summary: '原文' }),
            reviewedFields: ['summary'] };
        await write(`docs/i18n-efun-review/group-${group}.json`, {
            group, hashMode: 'sha256-canonical-json-v1', author: `author-${group}`, items: [{ ...item, status: 'self-reviewed' }]
        });
        await write(`docs/i18n-efun-review/independent-group-${group}.json`, {
            group, hashMode: 'sha256-canonical-json-v1', reviewer: `reviewer-${group}`, items: [{ ...item, status: 'reviewed', issues: [] }]
        });
    }
    return { root, write, read };
}

test('whole-catalogue guard verifies provenance, both reviews, resources and immutable facts', async t => {
    const { root } = await catalogueFixture(t);
    assert.deepEqual(await checkEfunLocalization(root), {
        result: 'passed', documents: 3, languages: 2, fieldsPerLanguage: 3, categories: 1,
        independentReviews: 3, structuralFingerprint: (await buildBaseline(path.join(root, 'config/efun-docs'))).semanticFingerprint
    });
});

test('whole-catalogue guard rejects a reviewer approving their own work or unresolved history', async t => {
    const { root, read, write } = await catalogueFixture(t);
    const filename = 'docs/i18n-efun-review/independent-group-1.json';
    const ledger = await read(filename);
    ledger.reviewer = 'author-1';
    await write(filename, ledger);
    await assert.rejects(checkEfunLocalization(root), /independent review is unresolved or stale/u);
    ledger.reviewer = 'reviewer-1';
    ledger.items[0].issues = [{ field: 'summary', status: 'unresolved', detail: 'A real defect.' }];
    await write(filename, ledger);
    await assert.rejects(checkEfunLocalization(root), /independent review is unresolved or stale/u);
});

test('whole-catalogue guard rejects edited source snapshots, hidden prose and signature drift', async t => {
    const { root, read, write } = await catalogueFixture(t);
    const filename = 'config/efun-docs/docs/alpha.json';
    const structure = await read(filename);
    await write(filename, { ...structure, summary: 'Hidden duplicated text' });
    await assert.rejects(checkEfunLocalization(root), /unexpected keys or duplicated prose/u);
    await write(filename, structure);
    const sourceFile = 'tests/fixtures/localization/efun-source-text.json';
    const original = await read(sourceFile);
    original.documents.alpha.fields.summary = '改过的原文';
    await write(sourceFile, original);
    await assert.rejects(checkEfunLocalization(root), /no longer matches its provenance/u);
    structure.signatures[0].arity.min = 0;
    await write(filename, structure);
    await assert.rejects(checkEfunLocalization(root), /Efun structural drift/u);
});

test('whole-catalogue guard rejects missing categories and stale target hashes', async t => {
    const { root, write } = await catalogueFixture(t);
    await write('config/efun-docs/locales/en/categories.json', {});
    await write('config/efun-docs/locales/zh-cn/alpha.json', { summary: '另一个说明' });
    await assert.rejects(checkEfunLocalization(root), error => error.message.includes('category translations are incomplete')
        && error.message.includes('translation hash changed') && error.message.includes('independent review is unresolved or stale'));
});
