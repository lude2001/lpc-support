import fs from 'fs';
import path from 'path';
import process from 'process';

const defaultFluffosRoot = 'D:/code/fluffos';
const defaultDocsDir = path.resolve('config/efun-docs/docs');

const manualOperators = new Map(Object.entries({
    catch: [{
        min: 1,
        max: 1,
        source: 'docs/efun/calls/catch.md',
        line: 13,
        declaration: 'mixed catch( mixed expr );'
    }],
    new: [{
        min: 1,
        max: null,
        source: 'docs/efun/objects/new.md',
        line: 13,
        declaration: 'object new( string filename, ... ); / class ClassName new(class ClassName, ...);'
    }],
    opcprof: [{
        min: 0,
        max: 1,
        source: 'docs/efun/internals/opcprof.md',
        line: 13,
        declaration: 'void opcprof( string | void );'
    }],
    parse_command: [{
        min: 3,
        max: null,
        source: 'src/compiler/internal/grammar.y',
        line: 2993,
        declaration: 'L_PARSE_COMMAND \'(\' expr0 \',\' expr0 \',\' expr0 lvalue_list \')\''
    }],
    sscanf: [{
        min: 2,
        max: null,
        source: 'src/compiler/internal/grammar.y',
        line: 2985,
        declaration: 'L_SSCANF \'(\' expr0 \',\' expr0 lvalue_list \')\''
    }],
    time_expression: [{
        min: 1,
        max: 1,
        source: 'src/compiler/internal/grammar.y',
        line: 3010,
        declaration: 'L_TIME_EXPRESSION expr_or_block'
    }]
}));

function getArgValue(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function walk(dir, predicate, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(filePath, predicate, out);
        } else if (predicate(filePath)) {
            out.push(filePath);
        }
    }
    return out;
}

function preprocessSpec(text) {
    const lines = text.split(/\r?\n/);
    let skipDepth = 0;

    return lines.map(line => {
        const trimmed = line.trim();
        if (/^#\s*if\s+0\b/.test(trimmed)) {
            skipDepth++;
            return '';
        }

        if (skipDepth > 0) {
            if (/^#\s*if\b/.test(trimmed)) {
                skipDepth++;
            }
            if (/^#\s*endif\b/.test(trimmed)) {
                skipDepth--;
            }
            return '';
        }

        return trimmed.startsWith('#') ? '' : line;
    }).join('\n');
}

function splitStatements(text) {
    const statements = [];
    let current = '';
    let startLine = 1;
    let line = 1;
    let quote = '';
    let inBlockComment = false;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '\n') {
            line++;
        }

        if (inBlockComment) {
            if (char === '*' && next === '/') {
                inBlockComment = false;
                index++;
            }
            continue;
        }

        if (!quote && char === '/' && next === '*') {
            inBlockComment = true;
            index++;
            continue;
        }

        if (!quote && char === '/' && next === '/') {
            while (index < text.length && text[index] !== '\n') {
                index++;
            }
            line++;
            continue;
        }

        if (quote) {
            current += char;
            if (char === quote && text[index - 1] !== '\\') {
                quote = '';
            }
            continue;
        }

        if (char === '"' || char === '\'') {
            quote = char;
            current += char;
            continue;
        }

        if (!current.trim()) {
            startLine = line;
        }
        current += char;

        if (char === ';') {
            const statement = current.trim();
            if (statement) {
                statements.push({ statement, line: startLine });
            }
            current = '';
        }
    }

    return statements;
}

function splitTopLevel(text) {
    const parts = [];
    let current = '';
    let depth = 0;
    let quote = '';

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (quote) {
            current += char;
            if (char === quote && text[index - 1] !== '\\') {
                quote = '';
            }
            continue;
        }

        if (char === '"' || char === '\'') {
            quote = char;
            current += char;
            continue;
        }

        if (char === '(' || char === '[' || char === '{') {
            depth++;
        } else if (char === ')' || char === ']' || char === '}') {
            depth = Math.max(0, depth - 1);
        }

        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}

function getPublicName(beforeParen) {
    const identifiers = [...beforeParen.matchAll(/[A-Za-z_]\w*/g)].map(match => match[0]);
    if (identifiers.length < 2) {
        return undefined;
    }
    return identifiers.length >= 3
        ? identifiers[identifiers.length - 2]
        : identifiers[identifiers.length - 1];
}

function getSpecArity(argsText) {
    const raw = argsText.trim();
    if (!raw || raw === 'void') {
        return { min: 0, max: 0 };
    }

    const args = splitTopLevel(raw);
    let min = 0;
    let max = 0;
    let variadic = false;

    for (const arg of args) {
        if (!arg || arg === 'void') {
            continue;
        }
        if (arg === '...' || /(^|\s)\.\.\.(\s|$)/.test(arg)) {
            variadic = true;
            continue;
        }
        max++;
        if (!/\bvoid\b/.test(arg) && !/\bdefault\s*:/.test(arg)) {
            min++;
        }
    }

    return {
        min,
        max: variadic ? null : max
    };
}

function toSpecEntry(arity, source, line, declaration) {
    return {
        min: arity.min,
        max: arity.max,
        source,
        line,
        declaration
    };
}

function loadSpecArities(fluffosRoot) {
    const specRoot = path.join(fluffosRoot, 'src', 'packages');
    const specs = new Map();

    for (const [name, ranges] of manualOperators) {
        specs.set(name, ranges.map(range => ({
            ...range,
            source: path.join(fluffosRoot, range.source).replace(/\\/g, '/')
        })));
    }

    for (const file of walk(specRoot, value => value.endsWith('.spec'))) {
        const text = preprocessSpec(fs.readFileSync(file, 'utf8'));
        for (const { statement, line } of splitStatements(text)) {
            const normalized = statement.replace(/\s+/g, ' ').trim();
            if (!normalized.endsWith(';') || !normalized.includes('(') || normalized.startsWith('operator ')) {
                continue;
            }

            const match = normalized.match(/^(.*?)\((.*)\)\s*;/);
            if (!match) {
                continue;
            }

            const name = getPublicName(match[1]);
            if (!name || name.startsWith('_')) {
                continue;
            }

            const arity = getSpecArity(match[2]);
            if (!specs.has(name)) {
                specs.set(name, []);
            }
            specs.get(name).push(toSpecEntry(
                arity,
                file.replace(/\\/g, '/'),
                line,
                normalized
            ));
        }
    }

    return specs;
}

function loadDocArities(docsDir) {
    const docs = new Map();
    for (const file of walk(docsDir, value => value.endsWith('.json'))) {
        const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        const name = doc.name ?? path.basename(file, '.json');
        const ranges = (doc.signatures ?? [])
            .map(signature => signature.arity)
            .filter(arity => arity
                && Number.isInteger(arity.min)
                && (Number.isInteger(arity.max) || arity.max === null));
        docs.set(name, ranges);
    }
    return docs;
}

function accepts(ranges, count) {
    return ranges.some(range => count >= range.min && (range.max === null || count <= range.max));
}

function describeRange(range) {
    return `${range.min}-${range.max === null ? '*' : range.max}`;
}

function audit({ fluffosRoot, docsDir }) {
    const specs = loadSpecArities(fluffosRoot);
    const docs = loadDocArities(docsDir);
    const tooNarrow = [];
    const tooBroad = [];
    const missingSpec = [];
    const missingDoc = [];

    for (const [name, docRanges] of docs) {
        const specRanges = specs.get(name);
        if (!specRanges) {
            missingSpec.push({ name, doc: docRanges.map(describeRange) });
            continue;
        }

        const specOnly = [];
        const docOnly = [];
        for (let count = 0; count <= 20; count++) {
            const docAccepts = accepts(docRanges, count);
            const specAccepts = accepts(specRanges, count);
            if (specAccepts && !docAccepts) {
                specOnly.push(count);
            }
            if (docAccepts && !specAccepts) {
                docOnly.push(count);
            }
        }

        if (specOnly.length) {
            tooNarrow.push({
                name,
                doc: docRanges.map(describeRange),
                spec: specRanges.map(describeRange),
                specOnly
            });
        }
        if (docOnly.length) {
            tooBroad.push({
                name,
                doc: docRanges.map(describeRange),
                spec: specRanges.map(describeRange),
                docOnly
            });
        }
    }

    for (const [name, specRanges] of specs) {
        if (!docs.has(name)) {
            missingDoc.push({ name, spec: specRanges.map(describeRange) });
        }
    }

    return {
        docCount: docs.size,
        specCount: specs.size,
        tooNarrow,
        tooBroad,
        missingSpec,
        missingDoc,
        entries: [...docs.keys()].sort((a, b) => a.localeCompare(b)).map(name => ({
            name,
            doc: (docs.get(name) ?? []).map(describeRange),
            spec: (specs.get(name) ?? []).map(describeRange),
            sources: (specs.get(name) ?? []).map(range => ({
                source: range.source,
                line: range.line,
                declaration: range.declaration
            }))
        }))
    };
}

function relativeToProject(filePath, root) {
    const relative = path.relative(root, filePath).replace(/\\/g, '/');
    return relative.startsWith('..') ? filePath.replace(/\\/g, '/') : relative;
}

function escapeTable(value) {
    return String(value)
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '\\|');
}

function formatSource(source) {
    const line = Number.isInteger(source.line) ? `:${source.line}` : '';
    return `${source.source}${line} ${source.declaration}`;
}

function writeReport(result, reportPath, { fluffosRoot, docsDir }) {
    const repoRoot = process.cwd();
    const lines = [
        '# Efun Arity Audit',
        '',
        'This report is generated by `npm run audit:efun-arity -- --report docs/efun-arity-audit.md`.',
        '',
        `- Local docs: ${relativeToProject(docsDir, repoRoot)}`,
        `- FluffOS source: ${fluffosRoot.replace(/\\/g, '/')}`,
        `- Docs entries: ${result.docCount}`,
        `- Source entries: ${result.specCount}`,
        `- Too narrow: ${result.tooNarrow.length}`,
        `- Too broad: ${result.tooBroad.length}`,
        `- Missing local docs: ${result.missingDoc.length}`,
        `- Missing source evidence: ${result.missingSpec.length}`,
        '',
        '| Efun | Doc arity | Source arity | Source evidence |',
        '| --- | --- | --- | --- |',
        ...result.entries.map(entry => `| ${[
            escapeTable(entry.name),
            escapeTable(entry.doc.join(', ')),
            escapeTable(entry.spec.join(', ')),
            escapeTable(entry.sources.map(formatSource).join('<br>'))
        ].join(' | ')} |`)
    ];

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

const fluffosRoot = path.resolve(getArgValue('--fluffos-root', process.env.FLUFFOS_ROOT ?? defaultFluffosRoot));
const docsDir = path.resolve(getArgValue('--docs-dir', defaultDocsDir));
const reportPath = getArgValue('--report', undefined);
const json = process.argv.includes('--json');

if (!fs.existsSync(path.join(fluffosRoot, 'src', 'packages'))) {
    const result = { skipped: true, reason: `FluffOS checkout not found: ${fluffosRoot}` };
    console.log(json ? JSON.stringify(result) : result.reason);
    process.exit(0);
}

const result = audit({ fluffosRoot, docsDir });
const hasMismatch = result.tooNarrow.length
    || result.tooBroad.length
    || result.missingSpec.length
    || result.missingDoc.length;

if (json) {
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log(`docs=${result.docCount} spec=${result.specCount}`);
    console.log(`tooNarrow=${result.tooNarrow.length} tooBroad=${result.tooBroad.length} missingSpec=${result.missingSpec.length} missingDoc=${result.missingDoc.length}`);
    if (hasMismatch) {
        console.log(JSON.stringify({
            tooNarrow: result.tooNarrow,
            tooBroad: result.tooBroad,
            missingSpec: result.missingSpec,
            missingDoc: result.missingDoc
        }, null, 2));
    }
}

if (reportPath) {
    writeReport(result, path.resolve(reportPath), { fluffosRoot, docsDir });
}

process.exit(hasMismatch ? 1 : 0);
