import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const defaultFluffosRoot = process.env.FLUFFOS_ROOT ?? 'D:/code/fluffos';
const fluffosRoot = path.resolve(readArgument('--fluffos-root') ?? defaultFluffosRoot);
const docsRoot = path.join(fluffosRoot, 'docs', 'efun');
const outputRoot = path.join(repoRoot, 'config', 'efun-docs');
const outputDocs = path.join(outputRoot, 'docs');
const checkOnly = process.argv.includes('--check');

const groups = [
    {
        directory: 'promises',
        category: 'Promise 与异步（Promise / Async）',
        packageName: 'core',
        availability: '始终启用的 PACKAGE_CORE',
        names: [
            'promise_create', 'promise_resolve', 'promise_reject', 'promise_then',
            'promise_catch', 'promise_status', 'promise_result', 'promisep',
            'async_info', 'async_yield'
        ]
    },
    {
        directory: 'contrib',
        category: '引用环（Reference Cycles）',
        packageName: 'contrib',
        availability: '需要 PACKAGE_CONTRIB（官方默认启用）',
        names: ['has_cycle', 'find_cycles', 'break_cycles']
    },
    {
        directory: 'internals',
        category: '驱动内部与调试（Internals / Debug）',
        packageName: 'develop',
        availability: '需要 PACKAGE_DEVELOP、DEBUGMALLOC 和 DEBUGMALLOC_EXTENSIONS',
        names: ['find_orphaned_cycles']
    },
    {
        directory: 'ffi',
        category: '外部函数接口（FFI）',
        packageName: 'ffi',
        availability: '需要 PACKAGE_FFI 和 libffi；WebAssembly 目标不可用',
        names: [
            'ffi_load', 'ffi_unload', 'ffi_symbol', 'ffi_prepare', 'ffi_call',
            'ffi_alloc', 'ffi_free', 'ffi_sizeof', 'ffi_peek', 'ffi_address',
            'ffi_read', 'ffi_write', 'ffi_struct_layout', 'ffi_callback',
            'ffi_callback_addr', 'ffi_callback_free', 'ffi_error', 'ffi_status'
        ]
    },
    {
        directory: 'jsbridge',
        category: 'WebAssembly JS Bridge',
        packageName: 'jsbridge',
        availability: '仅 EMSCRIPTEN 且启用 PACKAGE_JSBRIDGE 时可用',
        names: ['js_eval', 'js_export', 'js_call']
    }
];

const expectedCount = groups.reduce((count, group) => count + group.names.length, 0);
if (expectedCount !== 35) {
    throw new Error(`Expected 35 FluffOS additions, got ${expectedCount}`);
}

const generated = new Map();
for (const group of groups) {
    for (const name of group.names) {
        const sourcePath = path.join(docsRoot, group.directory, `${name}.md`);
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Missing official FluffOS documentation: ${sourcePath}`);
        }
        const source = fs.readFileSync(sourcePath, 'utf8');
        generated.set(name, buildDocument(name, source, sourcePath, group));
    }
}

const categoriesPath = path.join(outputRoot, 'categories.json');
const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
for (const refs of Object.values(categories)) {
    if (Array.isArray(refs)) {
        const staleIndex = refs.indexOf('mapping_origin_stats');
        if (staleIndex >= 0) {
            refs.splice(staleIndex, 1);
        }
    }
}
for (const group of groups) {
    categories[group.category] = [...group.names].sort((left, right) => left.localeCompare(right));
}

const expectedFiles = new Map([
    [categoriesPath, `${JSON.stringify(categories, null, 2)}\n`],
    ...[...generated].map(([name, document]) => [
        path.join(outputDocs, `${name}.json`),
        `${JSON.stringify(document, null, 2)}\n`
    ])
]);

const stalePath = path.join(outputDocs, 'mapping_origin_stats.json');
const changes = [];
for (const [filePath, expected] of expectedFiles) {
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : undefined;
    if (current !== expected) {
        changes.push(path.relative(repoRoot, filePath).replaceAll('\\', '/'));
        if (!checkOnly) {
            fs.writeFileSync(filePath, expected, 'utf8');
        }
    }
}
if (fs.existsSync(stalePath)) {
    changes.push(path.relative(repoRoot, stalePath).replaceAll('\\', '/'));
    if (!checkOnly) {
        fs.unlinkSync(stalePath);
    }
}

if (checkOnly && changes.length > 0) {
    console.error(`FluffOS efun docs are out of sync:\n${changes.join('\n')}`);
    process.exit(1);
}

console.log(`${checkOnly ? 'Checked' : 'Synchronized'} ${generated.size} FluffOS efun documents.`);
if (changes.length > 0) {
    console.log(changes.join('\n'));
}

function buildDocument(name, source, sourcePath, group) {
    const synopsis = readSection(source, 'SYNOPSIS');
    const signatures = parseStatements(synopsis)
        .map(statement => parseSignature(name, statement))
        .filter(Boolean);
    if (signatures.length === 0) {
        throw new Error(`No signatures found for ${name} in ${sourcePath}`);
    }

    if (name === 'find_orphaned_cycles') {
        signatures[0].arity = { min: 0, max: 1 };
        signatures[0].parameters[0].optional = true;
    }

    const description = firstParagraph(readSection(source, 'DESCRIPTION'));
    const references = parseReferences(readSection(source, 'SEE ALSO'));
    return {
        name,
        summary: description || readNameSummary(source, name),
        reference: references,
        category: group.category,
        availability: {
            package: group.packageName,
            condition: group.availability,
            source: path.relative(fluffosRoot, sourcePath).replaceAll('\\', '/')
        },
        signatures
    };
}

function readSection(source, heading) {
    const match = source.match(new RegExp(`^### ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^### |(?![\\s\\S]))`, 'mi'));
    return match?.[1]?.trim() ?? '';
}

function parseStatements(source) {
    return source
        .replace(/\/\/[^\n]*/g, '')
        .split(';')
        .map(statement => statement.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map(statement => `${statement};`);
}

function parseSignature(name, statement) {
    const normalized = statement.replace(/\s*;\s*$/, '').trim();
    const nameIndex = normalized.indexOf(`${name}(`);
    if (nameIndex < 0 || !normalized.endsWith(')')) {
        return undefined;
    }
    const returnType = normalized.slice(0, nameIndex).trim();
    const parameterSource = normalized.slice(nameIndex + name.length + 1, -1).trim();
    const rawParameters = parameterSource && parameterSource !== 'void'
        ? splitTopLevel(parameterSource)
        : [];
    const parameters = rawParameters.map((parameter, index) => parseParameter(parameter, index));
    const isVariadic = rawParameters.some(parameter => parameter.includes('...'));
    const required = parameters.filter(parameter => !parameter.optional && !parameter.variadic).length;
    return {
        label: normalized,
        returnType,
        isVariadic,
        parameters,
        arity: {
            min: required,
            max: isVariadic ? null : parameters.length
        }
    };
}

function parseParameter(source, index) {
    const variadic = source.includes('...');
    const withoutVariadic = source.replace(/\.\.\./g, '').trim();
    const optional = /\bvoid\b/.test(withoutVariadic) || /\bdefault\s*:/.test(withoutVariadic);
    const withoutDefault = withoutVariadic.replace(/\bdefault\s*:[\s\S]*$/, '').trim();
    const identifiers = [...withoutDefault.matchAll(/[A-Za-z_]\w*/g)];
    const nameMatch = identifiers.at(-1);
    const name = nameMatch?.[0] ?? `arg${index + 1}`;
    const type = nameMatch
        ? withoutDefault.slice(0, nameMatch.index).trim().replace(/\s+/g, ' ')
        : 'mixed';
    return {
        name,
        type: type || 'mixed',
        ...(optional ? { optional: true } : {}),
        ...(variadic ? { variadic: true } : {})
    };
}

function splitTopLevel(source) {
    const output = [];
    let current = '';
    let depth = 0;
    for (const character of source) {
        if ('([{<'.includes(character)) {
            depth++;
        } else if ([')', ']', '}', '>'].includes(character)) {
            depth = Math.max(0, depth - 1);
        }
        if (character === ',' && depth === 0) {
            output.push(current.trim());
            current = '';
        } else {
            current += character;
        }
    }
    if (current.trim()) {
        output.push(current.trim());
    }
    return output;
}

function firstParagraph(source) {
    const lines = source.split(/\r?\n/).map(line => line.trim());
    const paragraph = [];
    let started = false;
    for (const line of lines) {
        if (!line) {
            if (started) {
                break;
            }
            continue;
        }
        if (line.startsWith('```') || line.startsWith('- ')) {
            break;
        }
        started = true;
        paragraph.push(line);
    }
    return paragraph.join(' ').replace(/\s+/g, ' ').trim();
}

function readNameSummary(source, fallback) {
    const section = readSection(source, 'NAME');
    const separator = section.indexOf(' - ');
    return separator >= 0 ? section.slice(separator + 3).trim() : fallback;
}

function parseReferences(source) {
    return [...source.matchAll(/\b([A-Za-z_]\w*)\s*\(\d+\)/g)]
        .map(match => match[1])
        .filter((name, index, values) => values.indexOf(name) === index);
}

function readArgument(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
