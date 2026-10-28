import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
    buildBaseline,
    CATEGORY_IDENTITIES,
    compareBaselines,
    projectDocument,
    run,
    validateBaseline
} from './efun-baseline.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const category = CATEGORY_IDENTITIES.find(item => item.id === 'arrays');
const sample = {
    name: 'example',
    category: category.legacyName,
    summary: '中文摘要',
    details: 'Existing English details.',
    note: '',
    reference: ['arrayp', 'allocate'],
    signatures: [{
        label: 'mixed example(string value, mixed extra ...)',
        returnType: 'mixed',
        isVariadic: true,
        parameters: [
            { name: 'value', type: 'string', description: '参数说明' },
            { name: 'extra', type: 'mixed', optional: true, variadic: true }
        ],
        arity: { min: 1, max: null }
    }]
};

async function temporaryFixture(t) {
    const temporaryRoot = path.resolve(os.tmpdir());
    const directory = await mkdtemp(path.join(temporaryRoot, 'lpc-efun-localization-'));
    t.after(async () => {
        const relative = path.relative(temporaryRoot, path.resolve(directory));
        assert.ok(relative.startsWith('lpc-efun-localization-') && !relative.includes(path.sep),
            'cleanup target must remain the test-created child of the temporary directory');
        await rm(directory, { recursive: true, force: true });
    });
    const docsRoot = path.join(directory, 'source');
    const baselinePath = path.join(directory, 'efun-baseline.json');
    await mkdir(path.join(docsRoot, 'docs'), { recursive: true });
    const writeSource = async (document = sample, categories = { [category.legacyName]: ['example'] }) => {
        await writeFile(path.join(docsRoot, 'categories.json'), JSON.stringify(categories));
        await writeFile(path.join(docsRoot, 'docs', 'example.json'), JSON.stringify(document));
    };
    await writeSource();
    return { docsRoot, baselinePath, writeSource,
        args: ['--docs-root', docsRoot, '--baseline', baselinePath] };
}

test('committed baseline covers every current Efun and category', async () => {
    const expected = JSON.parse(await readFile(path.join(repositoryRoot,
        'tests', 'fixtures', 'localization', 'efun-baseline.json'), 'utf8'));
    const actual = await buildBaseline(path.join(repositoryRoot, 'config', 'efun-docs'));
    assert.deepEqual(actual.counts, { documents: 413, categories: 23, signatures: 492, parameters: 738 });
    assert.deepEqual(compareBaselines(expected, actual), []);
    assert.equal(actual.fieldCoverage.signatures.returnType, 454);
    assert.equal(actual.fieldCoverage.parameters.type, 709);
    assert.equal(actual.fieldCoverage.parameters.optional, 187);
    assert.equal(actual.fieldCoverage.parameters.variadic, 35);
    // Existing source oddities are facts to retain, not an invitation to repair.
    assert.equal(actual.documents.find(document => document.name === 'filter')
        .signatures[0].parameters[0].type, 'string | mixed *|');
});

test('translated prose never changes a document or signature fingerprint', () => {
    const translated = structuredClone(sample);
    translated.summary = 'English summary';
    translated.details = '中文详细说明';
    delete translated.note;
    translated.signatures[0].description = 'Signature explanation';
    translated.signatures[0].parameters[0].description = 'English parameter description';
    translated.signatures[0].parameters[1].description = '新增译文';
    assert.deepEqual(projectDocument(translated, 'example'), projectDocument(sample, 'example'));
});

const semanticMutations = [
    ['signature label', value => { value.signatures[0].label += ' '; }],
    ['return type', value => { value.signatures[0].returnType = 'int'; }],
    ['parameter identity', value => { value.signatures[0].parameters[0].name = 'other'; }],
    ['parameter type', value => { value.signatures[0].parameters[0].type = 'mixed'; }],
    ['optional marker', value => { value.signatures[0].parameters[1].optional = false; }],
    ['variadic marker', value => { value.signatures[0].parameters[1].variadic = false; }],
    ['signature variadic marker', value => { value.signatures[0].isVariadic = false; }],
    ['minimum arity', value => { value.signatures[0].arity.min = 0; }],
    ['maximum arity', value => { value.signatures[0].arity.max = 5; }],
    ['reference relationship', value => { value.reference.push('copy'); }]
];
for (const [name, mutate] of semanticMutations) {
    test(`semantic fingerprint detects ${name}`, () => {
        const changed = structuredClone(sample);
        mutate(changed);
        assert.notEqual(projectDocument(changed, 'example').semanticFingerprint,
            projectDocument(sample, 'example').semanticFingerprint);
    });
}

test('missing optional fields stay distinct from explicitly false or empty fields', () => {
    const missing = structuredClone(sample);
    delete missing.signatures[0].returnType;
    delete missing.signatures[0].parameters[0].type;
    const projected = projectDocument(missing, 'example');
    assert.equal(Object.hasOwn(projected.signatures[0], 'returnType'), false);
    assert.equal(Object.hasOwn(projected.signatures[0].parameters[0], 'type'), false);
    assert.equal(Object.hasOwn(projected.signatures[0].parameters[0], 'optional'), false);
    const explicit = structuredClone(missing);
    explicit.signatures[0].parameters[0].optional = false;
    assert.notEqual(projected.semanticFingerprint, projectDocument(explicit, 'example').semanticFingerprint);
});

test('categoryId migration preserves facts, IDs, and membership fingerprints', async t => {
    const fixture = await temporaryFixture(t);
    const before = await buildBaseline(fixture.docsRoot);
    const migrated = structuredClone(sample);
    migrated.categoryId = category.id;
    delete migrated.category;
    delete migrated.summary;
    delete migrated.details;
    delete migrated.note;
    migrated.reference.reverse();
    await fixture.writeSource(migrated, { arrays: ['example'] });
    const after = await buildBaseline(fixture.docsRoot);
    assert.deepEqual(compareBaselines(before, after), []);
    assert.equal(before.semanticFingerprint, after.semanticFingerprint);
});

test('category membership changes and inconsistent dual identities fail', async t => {
    const fixture = await temporaryFixture(t);
    const before = await buildBaseline(fixture.docsRoot);
    const moved = { ...sample, category: 'calls' };
    await fixture.writeSource(moved, { calls: ['example'] });
    const after = await buildBaseline(fixture.docsRoot);
    assert.ok(compareBaselines(before, after).some(location => location.startsWith('categories')));
    assert.notEqual(before.semanticFingerprint, after.semanticFingerprint);
    await fixture.writeSource({ ...sample, categoryId: 'calls' });
    await assert.rejects(buildBaseline(fixture.docsRoot), /conflicting category/);
});

test('dangling, missing, duplicate, and mismatched category membership fail closed', async t => {
    const fixture = await temporaryFixture(t);
    for (const [categories, pattern] of [
        [{ arrays: ['missing'] }, /missing document/],
        [{ arrays: [] }, /does not match/],
        [{ arrays: ['example', 'example'] }, /duplicate members/],
        [{ arrays: ['example'], calls: ['example'] }, /more than one category/],
        [{ calls: ['example'] }, /does not match/],
        [{ unknown: ['example'] }, /unknown category/],
        [{ arrays: ['example'], [category.legacyName]: [] }, /repeats the category/]
    ]) {
        await fixture.writeSource(sample, categories);
        await assert.rejects(buildBaseline(fixture.docsRoot), pattern);
    }
});

test('bad JSON facts are rejected instead of deriving or repairing a signature', () => {
    for (const [mutate, pattern] of [
        [value => { value.name = 'renamed'; }, /file identity/],
        [value => { delete value.signatures[0].isVariadic; }, /boolean isVariadic/],
        [value => { value.signatures[0].parameters[0].optional = 'yes'; }, /must be boolean/],
        [value => { value.signatures[0].arity.max = 0; }, /arity requires/],
        [value => { value.signatures.push(structuredClone(value.signatures[0])); }, /duplicate signature/]
    ]) {
        const changed = structuredClone(sample);
        mutate(changed);
        assert.throws(() => projectDocument(changed, 'example'), pattern);
    }
});

test('default and --check are read-only and cannot create a missing baseline', async t => {
    const fixture = await temporaryFixture(t);
    await assert.rejects(run(fixture.args), /baseline is missing/);
    await assert.rejects(run([...fixture.args, '--check']), /baseline is missing/);
    await assert.rejects(stat(fixture.baselinePath), { code: 'ENOENT' });
    const initial = await run([...fixture.args, '--write-baseline']);
    assert.equal(initial.baselineWritten, true);
    const saved = await readFile(fixture.baselinePath, 'utf8');
    const before = await stat(fixture.baselinePath);
    for (const args of [fixture.args, [...fixture.args, '--check'], [...fixture.args, '--write-baseline']]) {
        assert.equal((await run(args)).baselineWritten, false);
    }
    assert.equal(await readFile(fixture.baselinePath, 'utf8'), saved);
    assert.equal((await stat(fixture.baselinePath)).mtimeMs, before.mtimeMs);
});

test('source drift cannot silently rebaseline; replacement requires the reviewed previous hash', async t => {
    const fixture = await temporaryFixture(t);
    const initial = await run([...fixture.args, '--write-baseline']);
    const saved = await readFile(fixture.baselinePath, 'utf8');
    const changed = structuredClone(sample);
    changed.signatures[0].arity.min = 0;
    await fixture.writeSource(changed);
    for (const args of [fixture.args, [...fixture.args, '--check'], [...fixture.args, '--write-baseline']]) {
        await assert.rejects(run(args), /structural drift.*Baseline was not modified/);
        assert.equal(await readFile(fixture.baselinePath, 'utf8'), saved);
    }
    await assert.rejects(run([...fixture.args, '--write-baseline', '--expected-baseline', 'wrong']),
        /does not match/);
    const updated = await run([...fixture.args, '--write-baseline', '--expected-baseline', initial.semanticFingerprint]);
    assert.equal(updated.baselineWritten, true);
    assert.notEqual(updated.semanticFingerprint, initial.semanticFingerprint);
    assert.equal((await run(fixture.args)).result, 'passed');
});

test('manually edited baseline facts cannot hide behind a stale fingerprint', async t => {
    const fixture = await temporaryFixture(t);
    const baseline = await buildBaseline(fixture.docsRoot);
    baseline.documents[0].signatures[0].arity.min = 0;
    assert.throws(() => validateBaseline(baseline), /integrity failure/);
    await writeFile(fixture.baselinePath, JSON.stringify(baseline));
    await assert.rejects(run([...fixture.args, '--write-baseline']), /integrity failure/);
});

test('baseline counts and field coverage are checked against the recorded facts', async t => {
    const fixture = await temporaryFixture(t);
    const original = await buildBaseline(fixture.docsRoot);
    for (const mutate of [
        value => { value.counts.documents = 99; },
        value => { value.fieldCoverage.parameters.optional = 99; }
    ]) {
        const changed = structuredClone(original);
        mutate(changed);
        assert.throws(() => validateBaseline(changed), /counts or field coverage integrity failure/);
    }
});

test('conflicting modes, unrecognized options, and incomplete arguments never write', async t => {
    const fixture = await temporaryFixture(t);
    for (const args of [
        ['--check', '--write-baseline'],
        ['--expected-baseline', 'hash'],
        ['--docs-root'],
        ['--baseline', '--check'],
        ['--typo']
    ]) {
        await assert.rejects(run([...fixture.args, ...args]));
    }
    await assert.rejects(stat(fixture.baselinePath), { code: 'ENOENT' });
});
