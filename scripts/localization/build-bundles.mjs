import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

export function placeholders(message) {
    return [...new Set([...message.matchAll(/\{([^}]+)\}/g)]
        .map(match => match[1]).filter(key => /^\w+$/.test(key)))].sort(compare);
}

export function parseCatalogue(text, filename) {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${filename}: a message catalogue must be an object`);
    }
    const source = ts.parseJsonText(filename, text);
    const keys = new Set();
    for (const property of source.statements[0]?.expression?.properties ?? []) {
        const key = property.name?.text;
        if (keys.has(key)) {
            throw new Error(`${filename}: duplicate message ${JSON.stringify(key)}`);
        }
        keys.add(key);
    }
    for (const [message, translation] of Object.entries(value)) {
        if (!message.trim() || typeof translation !== 'string' || !translation.trim()) {
            throw new Error(`${filename}: messages and translations must be nonempty strings`);
        }
        if (/\p{Script=Han}/u.test(message)) {
            throw new Error(`${filename}: source message templates must be English`);
        }
        if (JSON.stringify(placeholders(message)) !== JSON.stringify(placeholders(translation))) {
            throw new Error(`${filename}: placeholder mismatch for ${JSON.stringify(message)}`);
        }
    }
    return value;
}

export async function loadCatalogues(directory) {
    const merged = new Map();
    const owners = new Map();
    const files = (await readdir(directory)).filter(name => name.endsWith('.json')).sort(compare);
    if (files.length === 0) {
        throw new Error('No source message catalogues were found');
    }
    for (const filename of files) {
        const entries = parseCatalogue(await readFile(path.join(directory, filename), 'utf8'), filename);
        for (const [message, translation] of Object.entries(entries)) {
            if (merged.has(message) && merged.get(message) !== translation) {
                throw new Error(`Conflicting translations in ${owners.get(message)} and ${filename}: ${JSON.stringify(message)}`);
            }
            merged.set(message, translation);
            owners.set(message, filename);
        }
    }
    return { messages: Object.fromEntries([...merged].sort(([left], [right]) => compare(left, right))), files };
}

async function sourceFiles(directory) {
    const results = [];
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => compare(a.name, b.name))) {
        if (entry.isDirectory() && !['__tests__', '__mocks__', 'node_modules'].includes(entry.name)) {
            results.push(...await sourceFiles(path.join(directory, entry.name)));
        } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
            results.push(path.join(directory, entry.name));
        }
    }
    return results;
}

export async function collectSourceMessages(root) {
    const messages = new Set();
    for (const filename of await sourceFiles(path.join(root, 'src'))) {
        const text = await readFile(filename, 'utf8');
        const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
        function visit(node) {
            if (ts.isCallExpression(node) && ['vscode.l10n.t', 'l10n.t', 'localize'].includes(node.expression.getText(source))) {
                const message = node.arguments[0];
                if (!message || !ts.isStringLiteralLike(message)) {
                    const location = source.getLineAndCharacterOfPosition(node.getStart(source));
                    throw new Error(`${path.relative(root, filename)}:${location.line + 1}: localized messages must be literal templates`);
                }
                const args = node.arguments.slice(1);
                const argumentObject = args.length === 1 && ts.isObjectLiteralExpression(args[0]) ? args[0] : undefined;
                const argumentKeys = argumentObject ? new Set(argumentObject.properties.map(property => property.name?.text)) : undefined;
                for (const placeholder of placeholders(message.text)) {
                    const supplied = argumentKeys ? argumentKeys.has(placeholder)
                        : /^\d+$/.test(placeholder) && Number(placeholder) < args.length;
                    if (!supplied) {
                        throw new Error(`${path.relative(root, filename)}: missing argument for {${placeholder}} in ${JSON.stringify(message.text)}`);
                    }
                }
                messages.add(message.text);
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
    return messages;
}

export async function buildBundles(root, { write = false, checkSource = true } = {}) {
    const { messages, files } = await loadCatalogues(path.join(root, 'l10n', 'source'));
    if (checkSource) {
        const used = await collectSourceMessages(root);
        const missing = [...used].filter(message => !Object.hasOwn(messages, message));
        const unused = Object.keys(messages).filter(message => !used.has(message));
        if (missing.length || unused.length) {
            throw new Error(`Message coverage mismatch: ${JSON.stringify({ missing, unused })}`);
        }
    }
    const bundles = {
        'bundle.l10n.json': Object.fromEntries(Object.keys(messages).map(message => [message, message])),
        'bundle.l10n.zh-cn.json': messages
    };
    for (const [filename, entries] of Object.entries(bundles)) {
        const destination = path.join(root, 'l10n', filename);
        const expected = `${JSON.stringify(entries, null, 4)}\n`;
        if (write) {
            await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, expected, 'utf8');
        } else {
            let actual;
            try {
                actual = await readFile(destination, 'utf8');
            } catch (error) {
                if (error.code !== 'ENOENT') { throw error; }
            }
            if (actual !== expected) {
                throw new Error(`${filename} is missing or stale; run the explicit --write command`);
            }
        }
    }
    return { result: 'passed', mode: write ? 'write' : 'check', catalogueFiles: files.length, messages: Object.keys(messages).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.some(arg => !['--check', '--write'].includes(arg)) || args.includes('--write') && args.includes('--check')) {
        process.stderr.write('Use --check (the default) or --write\n');
        process.exitCode = 1;
    } else {
        try {
            process.stdout.write(`${JSON.stringify(await buildBundles(repositoryRoot, { write: args.includes('--write') }))}\n`);
        } catch (error) {
            process.stderr.write(`${error.message}\n`);
            process.exitCode = 1;
        }
    }
}
