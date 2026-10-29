import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBaseline, compareBaselines, fingerprint } from './efun-baseline.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const hashMode = 'sha256-canonical-json-v1';
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const sortedKeys = value => Object.keys(value).sort();
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export const canonicalHash = value => fingerprint(value).slice('sha256:'.length);
const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'));
const inlineCode = text => [...text.matchAll(/(?<!`)`([^`\n]+)`(?!`)/gu)].map(match => match[1]).sort();
const codeBlocks = text => text.match(/```[^\n]*\n[\s\S]*?```/gu) ?? [];
const urls = text => (text.match(/https?:\/\/[^\s<>()[\]{}"'\u3000-\u303f\uff00-\uffef]+/gu) ?? [])
    .map(value => value.replace(/[.,;!?]+$/u, '')).sort();
const protectedParts = { 'url': urls, 'inline-code': inlineCode, 'fenced-code': codeBlocks };
// Add a concrete name/field/text only after reviewing a real proper-name need.
// The current corpus uses code literals and examples; it needs no name waiver.
const properNameExceptions = new Set();
const codeLiteral = /^"(?:[^"\\\r\n]|\\.)*"$|^'(?:[^'\\\r\n]|\\.)*'$/u;
const exampleFragment = text => /^\/\/[^\r\n]*$/u.test(text)
    || /^\(\{[^\r\n]*\}\)$/u.test(text) || codeLiteral.test(text);
const containsToken = (text, token) => /^[A-Za-z_$][\w$]*$/u.test(token)
    ? new RegExp(`(?<![A-Za-z0-9_$])${token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?![A-Za-z0-9_$])`, 'u').test(text)
    : text.includes(token);

function expectedProtectedParts(source, field, corrections, problems, name) {
    const expected = Object.fromEntries(Object.entries(protectedParts).map(([kind, extract]) => [kind, extract(source)]));
    for (const correction of corrections.filter(item => item?.field === field)) {
        for (const change of Array.isArray(correction.protectedChanges) ? correction.protectedChanges : []) {
            const parts = expected[change.kind];
            if (!parts || !(change.before === null || typeof change.before === 'string' && change.before.length)
                || !(change.after === null || typeof change.after === 'string' && change.after.length)
                || change.before === change.after) {
                problems.push(`${name}/${field}: invalid protected source correction`);
                continue;
            }
            if (change.before !== null) {
                const index = parts.indexOf(change.before);
                if (index < 0) problems.push(`${name}/${field}: protected correction does not match source`);
                else parts.splice(index, 1, ...(change.after === null ? [] : [change.after]));
            } else if (change.after !== null) {
                parts.push(change.after);
            }
        }
    }
    // Code-block order remains significant. An edited block replaces its old position.
    for (const kind of ['url', 'inline-code']) expected[kind].sort();
    return expected;
}

export function validateDocumentTranslations(name, source, translations, review) {
    const problems = [];
    const expectedFields = sortedKeys(source.fields);
    const corrections = review.sourceCorrections ?? [];
    if (!Array.isArray(corrections) || corrections.some(item => !item || !own(source.fields, item.field)
        || typeof item.reference !== 'string' || !item.reference.trim()
        || typeof item.detail !== 'string' || !item.detail.trim()
        || item.protectedChanges !== undefined && !Array.isArray(item.protectedChanges))) {
        problems.push(`${name}: source corrections require a field, evidence and rationale`);
    }
    const expectedParts = Object.fromEntries(expectedFields.map(field => [field,
        expectedProtectedParts(source.fields[field], field, Array.isArray(corrections) ? corrections : [], problems, name)]));
    if (review.name !== name || review.sourceSha256 !== source.sourceSha256
        || review.status !== 'self-reviewed' || !Array.isArray(review.reviewedFields)
        || !equal([...(review.reviewedFields ?? [])].sort(), expectedFields)) {
        problems.push(`${name}: author review does not match the locked source and fields`);
    }
    for (const locale of ['en', 'zh-cn']) {
        const document = translations[locale];
        if (!document || !equal(sortedKeys(document), expectedFields)) {
            problems.push(`${name}/${locale}: missing or unexpected natural-language fields`);
            continue;
        }
        const recorded = locale === 'en' ? review.enSha256 : review.zhCnSha256;
        if (recorded !== canonicalHash(document)) problems.push(`${name}/${locale}: translation hash changed after review`);
        for (const field of expectedFields) {
            const value = document[field];
            if (typeof value !== 'string' || source.fields[field].trim() && !value.trim()) {
                problems.push(`${name}/${locale}/${field}: missing text`);
                continue;
            }
            if (!equal(urls(value), expectedParts[field].url)) problems.push(`${name}/${locale}/${field}: URL changed`);
            // Backticks may move when translating prose. Preserve the exact token
            // or expression, including example whitespace, rather than word repetition.
            const expectedInline = expectedParts[field]['inline-code'];
            if (expectedInline.some(token => !containsToken(value, token))
                || inlineCode(value).some(token => !containsToken(source.fields[field], token) && !expectedInline.includes(token))) {
                problems.push(`${name}/${locale}/${field}: inline code changed`);
            }
            if (!equal(codeBlocks(value), expectedParts[field]['fenced-code'])) problems.push(`${name}/${locale}/${field}: fenced example changed`);
            if (/\b(?:TODO|TBD)\b/iu.test(value) && !/\b(?:TODO|TBD)\b/iu.test(source.fields[field])) {
                problems.push(`${name}/${locale}/${field}: new translation placeholder`);
            }
        }
    }
    const fragments = review.retainedFragments ?? [];
    const declared = new Set();
    for (const fragment of fragments) {
        const identity = `${fragment.field}\0${fragment.text}`;
        const validKind = fragment.reason === 'code-literal' ? codeLiteral.test(fragment.text)
            : fragment.reason === 'code-example' ? exampleFragment(fragment.text)
                : fragment.reason === 'proper-name' && properNameExceptions.has(`${name}\0${identity}`);
        if (!own(source.fields, fragment.field) || typeof fragment.text !== 'string' || !fragment.text
            || !validKind || fragment.text.trim() === source.fields[fragment.field]?.trim()
            || !source.fields[fragment.field]?.includes(fragment.text)
            || !translations.en?.[fragment.field]?.includes(fragment.text) || declared.has(identity)) {
            problems.push(`${name}: invalid retained source fragment`);
        }
        declared.add(identity);
    }
    for (const field of expectedFields) {
        if (typeof translations.en?.[field] !== 'string') continue;
        let naturalText = translations.en[field];
        for (const fragment of fragments.filter(item => item.field === field && typeof item.text === 'string')) {
            naturalText = naturalText.replaceAll(fragment.text, '');
        }
        if (/\p{Script=Han}/u.test(naturalText)) problems.push(`${name}/en/${field}: undeclared untranslated Chinese text`);
    }
    return problems;
}

export async function checkEfunLocalization(root = repositoryRoot) {
    const docsRoot = path.join(root, 'config/efun-docs');
    const fixtureRoot = path.join(root, 'tests/fixtures/localization');
    const expected = await readJson(path.join(fixtureRoot, 'efun-baseline.json'));
    const differences = compareBaselines(expected, await buildBaseline(docsRoot));
    if (differences.length) throw new Error(`Efun structural drift: ${differences.slice(0, 12).join(', ')}`);
    const original = await readJson(path.join(fixtureRoot, 'efun-source-text.json'));
    if (original.schemaVersion !== 1 || original.hashMode !== hashMode
        || original.structuralFingerprint !== expected.semanticFingerprint) throw new Error('Unrecognized source text baseline');
    const names = expected.documents.map(document => document.name).sort();
    if (!equal(sortedKeys(original.documents), names)) throw new Error('Source text baseline does not cover the structural catalogue');
    const reviews = new Map();
    const independent = new Map();
    const originalAuthors = ['/root/m1_text_inventory', '/root/m1_snippet_locale_review', '/root/m1_efun_baseline'];
    for (let group = 0; group < 3; group++) {
        for (const [prefix, target] of [['group', reviews], ['independent-group', independent]]) {
            const ledger = await readJson(path.join(root, `docs/i18n-efun-review/${prefix}-${group}.json`));
            if (ledger.group !== group || ledger.hashMode !== hashMode || !Array.isArray(ledger.items)) {
                throw new Error(`Invalid ${prefix}-${group} ledger`);
            }
            for (const item of ledger.items) {
                if (!names.includes(item.name) || target.has(item.name)) {
                    throw new Error(`Unexpected or duplicate ${prefix} entry ${item.name}`);
                }
                target.set(item.name, { ...item, group, author: ledger.author ?? originalAuthors[group], reviewer: ledger.reviewer });
            }
        }
    }
    const problems = [];
    for (const locale of ['en', 'zh-cn']) {
        const files = (await readdir(path.join(docsRoot, 'locales', locale)))
            .filter(filename => filename.endsWith('.json') && filename !== 'categories.json')
            .map(filename => filename.slice(0, -5)).sort();
        if (!equal(files, names)) problems.push(`${locale}: language file catalogue does not match the Efun names`);
        const categories = await readJson(path.join(docsRoot, 'locales', locale, 'categories.json'));
        if (!equal(sortedKeys(categories), expected.categories.map(category => category.id).sort())
            || Object.values(categories).some(value => typeof value !== 'string' || !value.trim())) {
            problems.push(`${locale}: category translations are incomplete`);
        }
        if (locale === 'en' && Object.values(categories).some(value => /\p{Script=Han}/u.test(value))) {
            problems.push('en: category names contain untranslated Chinese');
        }
    }
    for (const name of names) {
        const source = original.documents[name];
        const structure = await readJson(path.join(docsRoot, 'docs', `${name}.json`));
        const permitted = (value, keys) => sortedKeys(value).every(key => keys.includes(key));
        if (!permitted(structure, ['name', 'categoryId', 'signatures', 'reference'])
            || structure.signatures.some(signature => !permitted(signature, ['label', 'returnType', 'isVariadic', 'parameters', 'arity'])
                || signature.parameters.some(parameter => !permitted(parameter, ['name', 'type', 'optional', 'variadic'])))) {
            problems.push(`${name}: structure contains unexpected keys or duplicated prose`);
        }
        const { categoryId, ...originalStructure } = structure;
        const legacyName = expected.categoryIdentities.find(category => category.id === categoryId)?.legacyName;
        if (!legacyName || source.sourceSha256 !== canonicalHash({ ...originalStructure, category: legacyName, ...source.fields })) {
            problems.push(`${name}: locked original text or structure hash no longer matches its provenance`);
        }
        const review = reviews.get(name);
        const proof = independent.get(name);
        if (!review || !proof) { problems.push(`${name}: missing author or independent review`); continue; }
        const translations = Object.fromEntries(await Promise.all(['en', 'zh-cn'].map(async locale =>
            [locale, await readJson(path.join(docsRoot, 'locales', locale, `${name}.json`))])));
        problems.push(...validateDocumentTranslations(name, source, translations, review));
        if (proof.status !== 'reviewed' || !Array.isArray(proof.issues)
            || proof.issues.some(issue => issue.status !== 'resolved' || !issue.resolution?.reference || !issue.resolution?.detail)
            || proof.sourceSha256 !== source.sourceSha256 || proof.enSha256 !== canonicalHash(translations.en)
            || proof.zhCnSha256 !== canonicalHash(translations['zh-cn'])
            || !equal([...(proof.reviewedFields ?? [])].sort(), sortedKeys(source.fields))
            || proof.group !== review.group || typeof proof.reviewer !== 'string' || !proof.reviewer.trim()
            || proof.reviewer === review.author) {
            problems.push(`${name}: independent review is unresolved or stale`);
        }
    }
    if (problems.length) throw new Error(`Efun localization checks failed (${problems.length}):\n${problems.slice(0, 40).join('\n')}`);
    return { result: 'passed', documents: names.length, languages: 2,
        fieldsPerLanguage: Object.values(original.documents).reduce((count, entry) => count + Object.keys(entry.fields).length, 0),
        categories: expected.categories.length, independentReviews: independent.size,
        structuralFingerprint: expected.semanticFingerprint };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        if (process.argv.length > 2) throw new Error('This check accepts no write or rebaseline options');
        console.log(JSON.stringify(await checkEfunLocalization()));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
