#!/usr/bin/env node
// Efun localization guard: project the repository's JSON facts verbatim, without
// parsing signatures, deriving arity, or consulting a driver reference tree.
// Default and --check are read-only. Initial creation requires --write-baseline;
// replacing facts also requires --expected-baseline <the reviewed old hash>.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

// Stable identities are independent of both the old combined display name and
// future translated names. A category map keyed by these IDs is also accepted.
export const CATEGORY_IDENTITIES = Object.freeze([
    ['arrays', '数组相关函数（Arrays）', 'Arrays'],
    ['buffers', '缓冲区相关函数（Buffers）', 'Buffers'],
    ['calls', '调用相关函数（Calls）', 'Calls'],
    ['class', '结构体（类）相关函数（Class）', 'Classes'],
    ['db', '数据库相关函数（DB）', 'Database'],
    ['ed', '在线编辑相关函数（ED）', 'Editor'],
    ['filesystem', '文件系统相关函数（Filesystem）', 'Filesystem'],
    ['floats', '浮点运算相关函数（Floats）', 'Floating-point operations'],
    ['functions', '函数相关函数（Functions）', 'Functions'],
    ['general', '常规函数（General）', 'General'],
    ['interactive', '互动对象(玩家)相关函数（Interactive）', 'Interactive objects'],
    ['internals', '内部处理相关函数（Internals）', 'Internals'],
    ['mappings', '映射相关函数（Mappings）', 'Mappings'],
    ['mudlib', 'MUDLIB相关函数（Mudlib）', 'Mudlib'],
    ['numbers', '数字相关函数（Numbers）', 'Numbers'],
    ['objects', '对象相关函数（Objects）', 'Objects'],
    ['parsing', '语法分析相关函数（Parsing）', 'Parsing'],
    ['pcre', 'PCRE 相关函数(PCRE)', 'PCRE'],
    ['sockets', 'SOCKET相关函数（Sockets）', 'Sockets'],
    ['strings', '字符串相关函数（Strings）', 'Strings'],
    ['system', '系统相关函数（System）', 'System'],
    ['contrib', 'FluffOS新增函数（Contrib）', 'FluffOS contributions'],
    ['uncategorized', '未归类函数', 'Uncategorized']
].map(([id, legacyName, english]) => Object.freeze({
    id,
    legacyName,
    displayNames: Object.freeze({ en: english, 'zh-cn': legacyName })
})));

function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalize);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort(compare)
            .map(key => [key, canonicalize(value[key])]));
    }
    return value;
}

export function fingerprint(value) {
    return `sha256:${createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;
}

function assertRecord(value, location) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${location} must be an object`);
    }
}

function assertString(value, location) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${location} must be a nonempty string`);
    }
}

function copyOptional(source, target, key, kind, location) {
    if (own(source, key)) {
        if (typeof source[key] !== kind) {
            throw new Error(`${location}.${key} must be ${kind} when present`);
        }
        target[key] = source[key];
    }
}

function categoryId(value, location) {
    const category = CATEGORY_IDENTITIES.find(item => item.id === value || item.legacyName === value);
    if (!category) {
        throw new Error(`${location} has an unknown category identity: ${String(value)}`);
    }
    return category.id;
}

function projectSignature(value, location) {
    assertRecord(value, location);
    assertString(value.label, `${location}.label`);
    if (typeof value.isVariadic !== 'boolean' || !Array.isArray(value.parameters)) {
        throw new Error(`${location} requires boolean isVariadic and a parameters array`);
    }
    assertRecord(value.arity, `${location}.arity`);
    const { min, max } = value.arity;
    if (!Number.isInteger(min) || min < 0 || (max !== null && (!Number.isInteger(max) || max < min))) {
        throw new Error(`${location}.arity requires nonnegative min and max >= min (or null)`);
    }
    const projected = {
        label: value.label,
        isVariadic: value.isVariadic,
        parameters: value.parameters.map((parameter, index) => {
            const parameterLocation = `${location}.parameters[${index}]`;
            assertRecord(parameter, parameterLocation);
            assertString(parameter.name, `${parameterLocation}.name`);
            const result = { parameterId: `p${index}`, name: parameter.name };
            copyOptional(parameter, result, 'type', 'string', parameterLocation);
            copyOptional(parameter, result, 'optional', 'boolean', parameterLocation);
            copyOptional(parameter, result, 'variadic', 'boolean', parameterLocation);
            return result;
        }),
        arity: { min, max }
    };
    copyOptional(value, projected, 'returnType', 'string', location);
    return { signatureId: fingerprint(projected), ...projected };
}

export function projectDocument(value, name) {
    const location = `docs/${name}.json`;
    assertRecord(value, location);
    if (value.name !== name) {
        throw new Error(`${location}.name must match its file identity`);
    }
    const category = categoryId(value.categoryId ?? value.category, `${location}.categoryId/category`);
    if (own(value, 'categoryId') && own(value, 'category')
        && categoryId(value.category, `${location}.category`) !== category) {
        throw new Error(`${location} has conflicting category and categoryId`);
    }
    if (!Array.isArray(value.signatures) || value.signatures.length === 0) {
        throw new Error(`${location}.signatures must be a nonempty array`);
    }
    const signatures = value.signatures.map((signature, index) =>
        projectSignature(signature, `${location}.signatures[${index}]`));
    if (new Set(signatures.map(signature => signature.signatureId)).size !== signatures.length) {
        throw new Error(`${location} has duplicate signature identities`);
    }
    const projected = { name, categoryId: category, signatures };
    if (own(value, 'reference')) {
        if (!Array.isArray(value.reference) || value.reference.some(item => typeof item !== 'string')) {
            throw new Error(`${location}.reference must be an array of strings`);
        }
        // Reference order and category-map order are presentation, not identity.
        projected.reference = [...value.reference].sort(compare);
    }
    return { ...projected, semanticFingerprint: fingerprint(projected) };
}

function structuralContent(baseline) {
    return {
        categories: baseline.categories,
        documents: baseline.documents.map(({ semanticFingerprint, ...document }) => document)
    };
}

function countFields(records, fields) {
    return Object.fromEntries(fields.map(field => [field, records.filter(record => own(record, field)).length]));
}

function statistics(documents, categories) {
    const signatures = documents.flatMap(document => document.signatures);
    const parameters = signatures.flatMap(signature => signature.parameters);
    return {
        counts: { documents: documents.length, categories: categories.length,
            signatures: signatures.length, parameters: parameters.length },
        fieldCoverage: {
            documents: countFields(documents, ['name', 'categoryId', 'signatures', 'reference']),
            signatures: countFields(signatures, ['label', 'returnType', 'parameters', 'isVariadic', 'arity']),
            parameters: countFields(parameters, ['name', 'type', 'optional', 'variadic'])
        }
    };
}

export async function buildBaseline(docsRoot) {
    const categoriesSource = JSON.parse(await readFile(path.join(docsRoot, 'categories.json'), 'utf8'));
    assertRecord(categoriesSource, 'categories.json');
    const filenames = (await readdir(path.join(docsRoot, 'docs')))
        .filter(filename => filename.endsWith('.json')).sort(compare);
    const documents = await Promise.all(filenames.map(async filename =>
        projectDocument(JSON.parse(await readFile(path.join(docsRoot, 'docs', filename), 'utf8')),
            path.basename(filename, '.json'))));
    const documentsByName = new Map(documents.map(document => [document.name, document]));
    const categoriesById = new Map();
    const membership = new Map();
    for (const [key, members] of Object.entries(categoriesSource)) {
        const id = categoryId(key, 'categories.json');
        if (categoriesById.has(id)) {
            throw new Error(`categories.json repeats the category identity ${id}`);
        }
        if (!Array.isArray(members) || members.some(member => typeof member !== 'string')) {
            throw new Error(`categories.json.${key} must be an array of document names`);
        }
        if (new Set(members).size !== members.length) {
            throw new Error(`categories.json.${key} contains duplicate members`);
        }
        for (const name of members) {
            if (!documentsByName.has(name)) {
                throw new Error(`categories.json.${key} refers to missing document ${name}`);
            }
            if (membership.has(name)) {
                throw new Error(`Document ${name} belongs to more than one category`);
            }
            membership.set(name, id);
        }
        categoriesById.set(id, { id, members: [...members].sort(compare) });
    }
    for (const document of documents) {
        if (membership.get(document.name) !== document.categoryId) {
            throw new Error(`Document ${document.name} category does not match categories.json membership`);
        }
    }
    const categories = [...categoriesById.values()].sort((left, right) => compare(left.id, right.id));
    const baseline = {
        schemaVersion: 1,
        fingerprintAlgorithm: 'sha256-canonical-json-v1',
        // Provenance only: display text never enters a semantic fingerprint.
        categoryIdentities: CATEGORY_IDENTITIES.filter(item => categoriesById.has(item.id)),
        excludedTextFields: ['summary', 'details', 'note', 'signatures[].description',
            'signatures[].parameters[].description', 'category display names'],
        ...statistics(documents, categories),
        categories,
        documents
    };
    return { ...baseline, semanticFingerprint: fingerprint(structuralContent(baseline)) };
}

export function validateBaseline(baseline) {
    assertRecord(baseline, 'baseline');
    if (baseline.schemaVersion !== 1 || baseline.fingerprintAlgorithm !== 'sha256-canonical-json-v1'
        || !Array.isArray(baseline.categories) || !Array.isArray(baseline.documents)) {
        throw new Error('Unsupported or malformed Efun baseline schema');
    }
    for (const { semanticFingerprint, ...document } of baseline.documents) {
        if (semanticFingerprint !== fingerprint(document)) {
            throw new Error(`Baseline integrity failure for document ${document.name}`);
        }
        for (const { signatureId, ...signature } of document.signatures) {
            if (signatureId !== fingerprint(signature)) {
                throw new Error(`Baseline signature identity failure for document ${document.name}`);
            }
        }
    }
    if (baseline.semanticFingerprint !== fingerprint(structuralContent(baseline))) {
        throw new Error('Baseline semantic fingerprint integrity failure');
    }
    const actualStatistics = statistics(baseline.documents, baseline.categories);
    if (fingerprint({ counts: baseline.counts, fieldCoverage: baseline.fieldCoverage })
        !== fingerprint(actualStatistics)) {
        throw new Error('Baseline counts or field coverage integrity failure');
    }
}

function differencePaths(expected, actual, location = '') {
    if (JSON.stringify(canonicalize(expected)) === JSON.stringify(canonicalize(actual))) {
        return [];
    }
    if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object'
        || Array.isArray(expected) !== Array.isArray(actual)) {
        return [location];
    }
    return [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort(compare).flatMap(key => {
        const next = Array.isArray(expected) ? `${location}[${key}]` : `${location}.${key}`;
        if (!own(expected, key) || !own(actual, key)) {
            return [next.replace(/^\./u, '')];
        }
        return differencePaths(expected[key], actual[key], next.replace(/^\./u, ''));
    });
}

export function compareBaselines(expected, actual) {
    validateBaseline(expected);
    validateBaseline(actual);
    const expectedDocuments = Object.fromEntries(expected.documents.map(document => [document.name, document]));
    const actualDocuments = Object.fromEntries(actual.documents.map(document => [document.name, document]));
    return differencePaths({ categories: expected.categories, documents: expectedDocuments },
        { categories: actual.categories, documents: actualDocuments });
}

function parseArguments(args) {
    const options = {
        docsRoot: path.join(repositoryRoot, 'config', 'efun-docs'),
        baselinePath: path.join(repositoryRoot, 'tests', 'fixtures', 'localization', 'efun-baseline.json'),
        write: false,
        check: false,
        json: false
    };
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === '--write-baseline') {
            options.write = true;
        } else if (argument === '--check') {
            options.check = true;
        } else if (argument === '--json') {
            options.json = true;
        } else if (['--docs-root', '--baseline', '--expected-baseline'].includes(argument)) {
            const value = args[++index];
            if (!value || value.startsWith('--')) {
                throw new Error(`${argument} requires a value`);
            }
            if (argument === '--docs-root') options.docsRoot = path.resolve(value);
            if (argument === '--baseline') options.baselinePath = path.resolve(value);
            if (argument === '--expected-baseline') options.expectedFingerprint = value;
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    if ((options.check && options.write) || (options.expectedFingerprint && !options.write)) {
        throw new Error('Use --check alone, or --write-baseline [--expected-baseline <reviewed old hash>]');
    }
    return options;
}

export async function run(args) {
    const options = parseArguments(args);
    const actual = await buildBaseline(options.docsRoot);
    let expected;
    try {
        expected = JSON.parse(await readFile(options.baselinePath, 'utf8'));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!options.write) {
            throw new Error('Efun baseline is missing; review the source, then use --write-baseline explicitly');
        }
        if (options.expectedFingerprint) {
            throw new Error('--expected-baseline was provided but no existing baseline was found');
        }
    }
    const differences = expected ? compareBaselines(expected, actual) : [];
    if (options.expectedFingerprint && options.expectedFingerprint !== expected?.semanticFingerprint) {
        throw new Error('--expected-baseline does not match the existing baseline fingerprint');
    }
    if (differences.length > 0 && (!options.write || !options.expectedFingerprint)) {
        throw new Error(`Efun structural drift (${differences.length} fields): ${differences.slice(0, 12).join(', ')}. `
            + `Baseline was not modified. Review the change before using --write-baseline --expected-baseline ${expected.semanticFingerprint}`);
    }
    if (options.write && (!expected || differences.length > 0)) {
        await mkdir(path.dirname(options.baselinePath), { recursive: true });
        await writeFile(options.baselinePath, `${JSON.stringify(actual, null, 2)}\n`, 'utf8');
    }
    return {
        mode: options.write ? 'write-baseline' : 'check',
        result: 'passed',
        ...actual.counts,
        semanticFingerprint: actual.semanticFingerprint,
        baselineWritten: Boolean(options.write && (!expected || differences.length > 0)),
        json: options.json
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const { json, ...result } = await run(process.argv.slice(2));
        console.log(json ? JSON.stringify(result, null, 2)
            : `Efun baseline ${result.result}: ${result.documents} documents, ${result.categories} categories, `
                + `${result.signatures} signatures, ${result.parameters} parameters; ${result.semanticFingerprint}`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
