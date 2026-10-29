#!/usr/bin/env node
// Exercise the production TS and Rust JSON loaders. No driver or VS Code is started.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { canonicalHash } from './check-efun-localization.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.argv.length > 2) throw new Error('This check accepts no arguments');
const compiled = await build({
    entryPoints: [path.join(root, 'src/efun/BundledEfunLoader.ts')], bundle: true,
    write: false, platform: 'node', format: 'esm', target: 'node18',
    plugins: [{ name: 'isolated-vscode-environment', setup(builder) {
        builder.onResolve({ filter: /^vscode$/ }, () => ({ path: 'vscode', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const env = { language: "en" };' }));
    } }]
});
const { BundledEfunLoader } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
const results = [];
for (const locale of ['en', 'zh-cn']) {
    const start = performance.now();
    const loader = new BundledEfunLoader(locale);
    await loader.load({ extensionPath: root });
    const loadedAt = performance.now();
    const names = loader.getAllNames().sort();
    const typescript = names.map(name => {
        const doc = loader.getStructuredDoc(name);
        return { name, summary: doc.summary ?? null, details: doc.details ?? null, note: doc.note ?? null,
            signatures: doc.signatures.map(signature => ({ label: signature.label,
                parameters: signature.parameters.map(parameter => {
                    const prefix = parameter.variadic ? '...' : '';
                    return parameter.type ? `${parameter.type}${prefix} ${parameter.name}` : `${prefix}${parameter.name}`;
                }), min: signature.arity.min, max: signature.arity.max ?? null })) };
    });
    const rust = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/run-cargo.mjs'),
        'run', '--offline', '--quiet', '--manifest-path', path.join(root, 'rust/Cargo.toml'),
        '--package', 'lpc-language-server', '--example', 'efun-catalogue', '--', root, locale
    ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
    // Fail with names only, never dump complete documentation into CI logs.
    assert.equal(typescript.length, 413);
    assert.equal(rust.length, typescript.length);
    for (let index = 0; index < typescript.length; index++) {
        assert.equal(canonicalHash(rust[index]), canonicalHash(typescript[index]), `${locale}/${typescript[index].name}: consumer mismatch`);
    }
    const queryStart = performance.now();
    for (let pass = 0; pass < 20; pass++) for (const name of names) loader.getStructuredDoc(name);
    results.push({ locale, documents: names.length, categories: loader.getCategories().size,
        materializedSha256: canonicalHash(typescript), tsLoadMs: Math.round(loadedAt - start),
        cachedLookups: names.length * 20, tsCachedLookupMs: Math.round(performance.now() - queryStart) });
}
const report = { result: 'passed', consumers: ['typescript', 'rust'], results };
const reportPath = path.join(root, '.tmp/i18n/efun-consumers.json');
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
