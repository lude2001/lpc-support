#!/usr/bin/env node
// Inspect the archive in memory. Never extract, install, build, or start its code.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yauzl from 'yauzl';
import { parseStringPromise } from 'xml2js';
import { fingerprint, projectDocument, validateBaseline } from './efun-baseline.mjs';
import { checkEfunLocalization } from './check-efun-localization.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const targets = new Set(['win32-x64', 'win32-arm64', 'linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64']);
const locales = ['en', 'zh-cn'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const same = (left, right) => fingerprint(left) === fingerprint(right);
const hash = value => createHash('sha256').update(value).digest('hex');
const keys = value => Object.keys(value).sort();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const referencePattern = /^%([^%]+)%$/u;
const resourcePaths = [
    'package.nls.json', 'package.nls.zh-cn.json',
    'l10n/bundle.l10n.json', 'l10n/bundle.l10n.zh-cn.json',
    'snippets/lpc.json', 'snippets/lpc.zh-cn.json',
    'config/efun-docs/locales/en/categories.json', 'config/efun-docs/locales/zh-cn/categories.json'
];
const runtimeFiles = [
    'dist/templates/functionDocPanel.html', 'dist/templates/functionDocPanel.js', 'dist/templates/functionDocPanel.css'
];

function archivePath(value, location, prefix = 'extension/') {
    requireThat(typeof value === 'string' && value.length > 0, `${location}: expected a local file path`);
    const relative = value.replace(/^\.\//u, '');
    requireThat(!relative.includes('\\') && !relative.startsWith('/') && !/^[A-Za-z][\w+.-]*:/u.test(relative)
        && relative.split('/').every(part => part && part !== '.' && part !== '..'), `${location}: unsafe local file path`);
    return `${prefix}${relative}`;
}

async function readArchive(filename) {
    const archive = await yauzl.openPromise(filename, { strictFileNames: true, validateEntrySizes: true });
    const files = new Map();
    const modes = new Map();
    const seen = new Set();
    let totalSize = 0;
    try {
        for await (const entry of archive.eachEntry()) {
            const name = entry.fileName;
            requireThat(!seen.has(name), `Duplicate ZIP entry: ${name}`);
            seen.add(name);
            requireThat(seen.size <= 20000, 'VSIX contains too many entries');
            requireThat(path.posix.normalize(name) === name, `Noncanonical ZIP entry: ${name}`);
            requireThat(((entry.externalFileAttributes >>> 16) & 0o170000) !== 0o120000, `Symbolic link in VSIX: ${name}`);
            if (name.endsWith('/')) continue;
            totalSize += entry.uncompressedSize;
            requireThat(entry.uncompressedSize <= 256 * 1024 * 1024 && totalSize <= 512 * 1024 * 1024,
                `VSIX resource exceeds inspection limits: ${name}`);
            const stream = await archive.openReadStreamPromise(entry);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            files.set(name, Buffer.concat(chunks));
            modes.set(name, (entry.externalFileAttributes >>> 16) & 0xffff);
        }
    } finally {
        archive.close();
    }
    return { files, modes };
}

function requiredFile(files, name) {
    requireThat(files.has(name), `Missing VSIX resource: ${name}`);
    return files.get(name);
}

function jsonFile(files, name) {
    try {
        const value = JSON.parse(requiredFile(files, name).toString('utf8'));
        requireThat(record(value), `${name}: expected a JSON object`);
        return value;
    } catch (error) {
        throw new Error(`${name}: ${error.message}`);
    }
}

async function readJson(filename) {
    return JSON.parse(await readFile(filename, 'utf8'));
}

// Production always uses this repository's reviewed contract. The injected
// contract option below is for small synthetic-archive tests, never a CLI flag.
export async function loadReviewedContract(root = repositoryRoot) {
    // Reuse the provenance, author and independent-review gate in full. An
    // updated author hash alone must not make unreviewed packaged text valid.
    await checkEfunLocalization(root);
    const baseline = await readJson(path.join(root, 'tests/fixtures/localization/efun-baseline.json'));
    const original = await readJson(path.join(root, 'tests/fixtures/localization/efun-source-text.json'));
    const documents = {};
    for (let group = 0; group < 3; group++) {
        const ledger = await readJson(path.join(root, `docs/i18n-efun-review/group-${group}.json`));
        for (const item of ledger.items) {
            documents[item.name] = {
                fields: keys(original.documents[item.name].fields),
                hashes: { en: item.enSha256, 'zh-cn': item.zhCnSha256 }
            };
        }
    }
    const resources = Object.fromEntries(await Promise.all(resourcePaths.map(async filename =>
        [filename, await readJson(path.join(root, filename))])));
    return { baseline, documents, resources };
}

function checkMessageMap(english, chinese, location, identity = false) {
    requireThat(same(keys(english), keys(chinese)) && keys(english).length > 0, `${location}: language keys differ or are empty`);
    for (const key of keys(english)) {
        requireThat(typeof english[key] === 'string' && english[key].trim()
            && typeof chinese[key] === 'string' && chinese[key].trim(), `${location}/${key}: missing text`);
        if (identity) requireThat(english[key] === key, `${location}/${key}: English bundle is not an identity map`);
        const placeholders = text => [...text.matchAll(/\{([^}]+)\}/gu)].map(match => match[1]).sort();
        requireThat(same(placeholders(english[key]), placeholders(chinese[key])), `${location}/${key}: placeholders differ`);
    }
}

function checkManifestReferences(files, manifest, nls) {
    const references = new Set();
    const requireReference = (value, location, locale) => {
        const match = typeof value === 'string' && referencePattern.exec(value);
        const resolved = match ? nls[locale][match[1]] : value;
        requiredFile(files, archivePath(resolved, location));
    };
    function visit(value, location) {
        if (typeof value === 'string') {
            const match = referencePattern.exec(value);
            if (match) references.add(match[1]);
            return;
        }
        if (Array.isArray(value)) { value.forEach((item, i) => visit(item, `${location}[${i}]`)); return; }
        if (!record(value)) return;
        for (const [key, child] of Object.entries(value)) {
            const at = `${location}.${key}`;
            if ((key === 'path' || key === 'configuration') && typeof child === 'string') {
                for (const locale of locales) requireReference(child, at, locale);
            }
            if (key === 'icon') {
                const icons = typeof child === 'string' ? [child] : record(child) ? Object.values(child) : [];
                for (const icon of icons) {
                    if (typeof icon === 'string' && !icon.startsWith('$(')) {
                        for (const locale of locales) requireReference(icon, at, locale);
                    }
                }
            }
            visit(child, at);
        }
    }
    // package.files contains inclusion globs, not runtime file references.
    visit(manifest, 'package');
    for (const locale of locales) {
        requireReference(manifest.main, 'package.main', locale);
        if (manifest.browser) requireReference(manifest.browser, 'package.browser', locale);
        if (manifest.icon) requireReference(manifest.icon, 'package.icon', locale);
        for (const key of references) requireThat(typeof nls[locale][key] === 'string' && nls[locale][key].trim(),
            `package.nls/${locale}: unresolved reference %${key}%`);
        requireThat(same([...references].sort(), keys(nls[locale])), `package.nls/${locale}: missing or unused manifest resource keys`);
    }
}

async function checkVsixManifest(files, manifest, requestedTarget) {
    let xml;
    try {
        xml = await parseStringPromise(requiredFile(files, 'extension.vsixmanifest').toString('utf8'));
    } catch (error) { throw new Error(`extension.vsixmanifest: ${error.message}`); }
    const packageManifest = xml.PackageManifest;
    const identities = packageManifest?.Metadata?.flatMap(metadata => metadata.Identity ?? []) ?? [];
    requireThat(identities.length === 1, 'extension.vsixmanifest: expected one Identity');
    const identity = identities[0].$ ?? {};
    const target = identity.TargetPlatform;
    requireThat(targets.has(target), 'extension.vsixmanifest: missing or unsupported TargetPlatform');
    if (requestedTarget) requireThat(target === requestedTarget, `VSIX TargetPlatform ${target} does not match --target ${requestedTarget}`);
    requireThat(identity.Id === manifest.name && identity.Version === manifest.version && identity.Publisher === manifest.publisher,
        'extension.vsixmanifest: identity does not match package.json');
    const assets = packageManifest?.Assets?.flatMap(container => container.Asset ?? []) ?? [];
    requireThat(assets.filter(asset => asset.$?.Type === 'Microsoft.VisualStudio.Code.Manifest'
        && asset.$?.Path === 'extension/package.json').length === 1, 'extension.vsixmanifest: missing unique package manifest asset');
    for (const asset of assets) requiredFile(files, archivePath(asset.$?.Path, 'VSIX asset', ''));
    let contentTypes;
    try { contentTypes = await parseStringPromise(requiredFile(files, '[Content_Types].xml').toString('utf8')); }
    catch (error) { throw new Error(`[Content_Types].xml: ${error.message}`); }
    requireThat(record(contentTypes.Types), '[Content_Types].xml: missing Types');
    for (const override of contentTypes.Types.Override ?? []) {
        const part = override.$?.PartName;
        requireThat(typeof part === 'string' && part.startsWith('/'), '[Content_Types].xml: invalid Override PartName');
        requiredFile(files, archivePath(part.slice(1), 'content type override', ''));
    }
    return target;
}

function nativeTarget(bytes) {
    if (bytes.length >= 64 && bytes.toString('ascii', 0, 2) === 'MZ') {
        const offset = bytes.readUInt32LE(0x3c);
        requireThat(offset >= 64 && offset <= bytes.length - 24
            && bytes.toString('ascii', offset, offset + 4) === 'PE\0\0', 'Invalid PE sidecar header');
        const optionalSize = bytes.readUInt16LE(offset + 20);
        const sections = bytes.readUInt16LE(offset + 6);
        const characteristics = bytes.readUInt16LE(offset + 22);
        requireThat(optionalSize >= 112 && sections > 0 && offset + 24 + optionalSize + sections * 40 <= bytes.length
            && bytes.readUInt16LE(offset + 24) === 0x20b, 'Invalid or incomplete PE32+ sidecar header');
        requireThat((characteristics & 0x0002) !== 0 && (characteristics & 0x2000) === 0,
            'PE sidecar must be an executable image, not a DLL');
        const architecture = new Map([[0x8664, 'x64'], [0xaa64, 'arm64']]).get(bytes.readUInt16LE(offset + 4));
        requireThat(architecture, 'Unsupported PE sidecar architecture');
        return `win32-${architecture}`;
    }
    if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
        requireThat(bytes.length >= 64 && bytes[4] === 2 && bytes[5] === 1 && bytes[6] === 1
            && bytes.readUInt16LE(52) === 64 && bytes.readUInt32LE(20) === 1, 'Invalid or incomplete little-endian ELF64 sidecar header');
        requireThat([0, 3].includes(bytes[7]), 'ELF sidecar ABI must be SYSV or Linux');
        requireThat([2, 3].includes(bytes.readUInt16LE(16)), 'ELF sidecar must be EXEC or DYN, not a relocatable object');
        const entry = bytes.readBigUInt64LE(24);
        const table = bytes.readBigUInt64LE(32);
        const entrySize = bytes.readUInt16LE(54);
        const count = bytes.readUInt16LE(56);
        requireThat(entry !== 0n && entrySize === 56 && count > 0 && table >= 64n
            && table + BigInt(entrySize) * BigInt(count) <= BigInt(bytes.length), 'Invalid ELF sidecar entry point or program headers');
        let executableEntry = false;
        for (let i = 0; i < count; i++) {
            const at = Number(table) + i * entrySize;
            if (bytes.readUInt32LE(at) !== 1) continue; // PT_LOAD
            const fileOffset = bytes.readBigUInt64LE(at + 8);
            const address = bytes.readBigUInt64LE(at + 16);
            const fileSize = bytes.readBigUInt64LE(at + 32);
            const memorySize = bytes.readBigUInt64LE(at + 40);
            requireThat(fileSize <= memorySize && fileOffset + fileSize <= BigInt(bytes.length), 'Invalid ELF sidecar load segment');
            if ((bytes.readUInt32LE(at + 4) & 1) !== 0 && entry >= address && entry < address + memorySize) executableEntry = true;
        }
        requireThat(executableEntry, 'ELF sidecar entry point is not in an executable load segment');
        const architecture = new Map([[62, 'x64'], [183, 'arm64']]).get(bytes.readUInt16LE(18));
        requireThat(architecture, 'Unsupported ELF sidecar architecture');
        return `linux-${architecture}`;
    }
    if (bytes.length >= 4 && bytes.readUInt32LE(0) === 0xfeedfacf) {
        requireThat(bytes.length >= 32 && bytes.readUInt32LE(12) === 2, 'Mach-O sidecar must have a complete MH_EXECUTE header');
        const commands = bytes.readUInt32LE(16);
        const commandSize = bytes.readUInt32LE(20);
        requireThat(commands > 0 && commandSize >= commands * 8 && 32 + commandSize <= bytes.length,
            'Invalid or incomplete Mach-O sidecar load commands');
        const architecture = new Map([[0x01000007, 'x64'], [0x0100000c, 'arm64']]).get(bytes.readUInt32LE(4));
        requireThat(architecture, 'Unsupported Mach-O sidecar architecture');
        return `darwin-${architecture}`;
    }
    throw new Error('Unrecognized native sidecar header');
}

function checkNative(files, modes, target) {
    const executable = target.startsWith('win32-') ? 'lpc-language-server.exe' : 'lpc-language-server';
    const filename = `extension/dist/bin/${executable}`;
    const bytes = requiredFile(files, filename);
    requireThat(nativeTarget(bytes) === target, `Sidecar file header does not match VSIX target ${target}`);
    if (!target.startsWith('win32-')) requireThat((modes.get(filename) & 0o111) !== 0, 'Unix sidecar has no executable permission in the VSIX');
    const other = executable.endsWith('.exe') ? executable.slice(0, -4) : `${executable}.exe`;
    requireThat(!files.has(`extension/dist/bin/${other}`) && !files.has(`extension/dist/bin/${other}.sha256`),
        'VSIX contains a sidecar for another operating system');
    const checksum = requiredFile(files, `${filename}.sha256`).toString('utf8');
    const match = /^([a-f\d]{64})[ \t]+\*?([^\r\n]+)\r?\n?$/iu.exec(checksum);
    requireThat(match && match[2] === executable && match[1].toLowerCase() === hash(bytes), 'Native sidecar SHA-256 or checksum filename does not match');
    return { executable, sha256: hash(bytes) };
}

function exactCatalogue(files, prefix, expected) {
    const actual = [...files.keys()].filter(name => name.startsWith(prefix) && name.endsWith('.json'))
        .map(name => name.slice(prefix.length)).sort();
    requireThat(same(actual, expected.slice().sort()), `${prefix}: resource catalogue differs from the reviewed baseline`);
}

function checkEfunResources(files, contract) {
    const { baseline } = contract;
    validateBaseline(baseline);
    const filenames = baseline.documents.map(document => `${document.name}.json`);
    const prefix = 'extension/config/efun-docs/';
    exactCatalogue(files, `${prefix}docs/`, filenames);
    const categoryMap = jsonFile(files, `${prefix}categories.json`);
    requireThat(same(keys(categoryMap), baseline.categories.map(category => category.id).sort()), 'Efun category identities differ');
    for (const category of baseline.categories) {
        const members = categoryMap[category.id];
        requireThat(Array.isArray(members) && members.every(member => typeof member === 'string')
            && same(members.slice().sort(), category.members), `Efun category membership differs: ${category.id}`);
    }
    for (const expected of baseline.documents) {
        const structure = jsonFile(files, `${prefix}docs/${expected.name}.json`);
        const permitted = (value, allowed) => record(value) && keys(value).every(key => allowed.includes(key));
        requireThat(permitted(structure, ['name', 'categoryId', 'signatures', 'reference'])
            && Array.isArray(structure.signatures) && structure.signatures.every(signature =>
                permitted(signature, ['label', 'returnType', 'isVariadic', 'parameters', 'arity'])
                && permitted(signature.arity, ['min', 'max'])
                && Array.isArray(signature.parameters) && signature.parameters.every(parameter =>
                    permitted(parameter, ['name', 'type', 'optional', 'variadic']))),
        `${expected.name}: structure contains duplicated prose or unexpected fields`);
        requireThat(same(projectDocument(structure, expected.name), expected), `${expected.name}: packaged Efun facts differ from the reviewed baseline`);
    }
    for (const locale of locales) {
        exactCatalogue(files, `${prefix}locales/${locale}/`, [...filenames, 'categories.json']);
        const categories = jsonFile(files, `${prefix}locales/${locale}/categories.json`);
        requireThat(same(keys(categories), baseline.categories.map(category => category.id).sort())
            && Object.values(categories).every(value => typeof value === 'string' && value.trim()), `${locale}: missing Efun category labels`);
        for (const expected of baseline.documents) {
            const filename = `${prefix}locales/${locale}/${expected.name}.json`;
            const body = jsonFile(files, filename);
            const reviewed = contract.documents[expected.name];
            requireThat(reviewed && same(keys(body), reviewed.fields)
                && Object.values(body).every(value => typeof value === 'string'), `${locale}/${expected.name}: unexpected or missing Efun body fields`);
            requireThat(fingerprint(body) === `sha256:${reviewed.hashes[locale]}`, `${locale}/${expected.name}: packaged body differs from the reviewed translation`);
        }
    }
    return { documents: baseline.documents.length, categories: baseline.categories.length };
}

export async function checkVsixLocalization(filename, { target, contract } = {}) {
    requireThat(typeof filename === 'string' && filename.length > 0, 'An explicit VSIX path is required');
    requireThat(target === undefined || targets.has(target), 'Unsupported --target');
    const { files, modes } = await readArchive(filename);
    for (const name of files.keys()) {
        requireThat(!/(?:^|\/)(?:fixtures|tests|__tests__|i18n-efun-review)(?:\/|$)/iu.test(name)
            && !/(?:^|\/)(?:efun[-_]catalogue|dev[-_]?catalogue)(?:[./]|$)/iu.test(name)
            && !/^extension\/(?:rust|scripts|\.tmp|\.git)\//u.test(name)
            && !/^extension\/l10n\/source\//u.test(name)
            && !/(?:^|\/)(?:[^/]*[-_.])?reviews?(?:[-_.][^/]*)?(?:\/|$)/iu.test(name), `Development or review resource leaked into VSIX: ${name}`);
    }
    const expected = contract ?? await loadReviewedContract();
    const manifest = jsonFile(files, 'extension/package.json');
    const actualTarget = await checkVsixManifest(files, manifest, target);
    const languageFiles = pattern => [...files.keys()].filter(name => pattern.test(name)).sort();
    requireThat(same(languageFiles(/^extension\/package\.nls(?:\.[^/]+)?\.json$/u),
        ['extension/package.nls.json', 'extension/package.nls.zh-cn.json']), 'Expected exactly two manifest NLS resources');
    requireThat(same(languageFiles(/^extension\/l10n\/bundle\.l10n(?:\.[^/]+)?\.json$/u),
        ['extension/l10n/bundle.l10n.json', 'extension/l10n/bundle.l10n.zh-cn.json']), 'Expected exactly two runtime localization bundles');
    exactCatalogue(files, 'extension/snippets/', ['lpc.json', 'lpc.zh-cn.json']);
    const nls = { en: jsonFile(files, 'extension/package.nls.json'), 'zh-cn': jsonFile(files, 'extension/package.nls.zh-cn.json') };
    checkMessageMap(nls.en, nls['zh-cn'], 'package.nls');
    const bundles = {
        en: jsonFile(files, 'extension/l10n/bundle.l10n.json'),
        'zh-cn': jsonFile(files, 'extension/l10n/bundle.l10n.zh-cn.json')
    };
    checkMessageMap(bundles.en, bundles['zh-cn'], 'l10n bundle', true);
    requireThat(manifest.l10n === './l10n', 'package.l10n must reference ./l10n');
    const snippets = manifest.contributes?.snippets;
    requireThat(Array.isArray(snippets) && snippets.length === 1 && snippets[0].language === 'lpc'
        && snippets[0].path === '%snippetPath%', 'Expected one native LPC snippet contribution using %snippetPath%');
    checkManifestReferences(files, manifest, nls);
    for (const filename of runtimeFiles) requiredFile(files, `extension/${filename}`);
    const english = jsonFile(files, archivePath(nls.en.snippetPath, 'English snippetPath'));
    const chinese = jsonFile(files, archivePath(nls['zh-cn'].snippetPath, 'Chinese snippetPath'));
    requireThat(nls.en.snippetPath !== nls['zh-cn'].snippetPath && keys(english).length === 9 && same(keys(english), keys(chinese)),
        'Expected nine native snippets in each distinct language resource');
    for (const name of keys(english)) {
        const { description: enDescription, ...enFacts } = english[name];
        const { description: zhDescription, ...zhFacts } = chinese[name];
        requireThat(same(enFacts, zhFacts) && own(enFacts, 'prefix') && own(enFacts, 'body'), `${name}: snippet insertion facts differ between languages`);
        requireThat(typeof enDescription === 'string' && enDescription.trim() && typeof zhDescription === 'string' && zhDescription.trim(),
            `${name}: missing native snippet description`);
    }
    for (const [resource, value] of Object.entries(expected.resources)) {
        requireThat(same(jsonFile(files, `extension/${resource}`), value), `${resource}: packaged localization differs from the reviewed resource`);
    }
    const efuns = checkEfunResources(files, expected);
    const native = checkNative(files, modes, actualTarget);
    return { result: 'passed', target: actualTarget, languages: locales, nativeSnippetsPerLanguage: 9,
        efunDocuments: efuns.documents, efunBodies: efuns.documents * locales.length,
        efunCategoriesPerLanguage: efuns.categories, runtimeMessages: keys(bundles.en).length,
        native, inspectedFiles: files.size };
}

export async function run(args) {
    let filename;
    let target;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--target') {
            requireThat(target === undefined && args[i + 1] && !args[i + 1].startsWith('-'), '--target requires one platform value');
            target = args[++i];
        } else {
            requireThat(!args[i].startsWith('-') && filename === undefined, 'Usage: check-vsix-localization.mjs <package.vsix> [--target <platform>]');
            filename = args[i];
        }
    }
    requireThat(filename, 'Usage: check-vsix-localization.mjs <package.vsix> [--target <platform>]');
    return checkVsixLocalization(filename, { target });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { console.log(JSON.stringify(await run(process.argv.slice(2)))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
