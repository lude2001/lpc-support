import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { scanTextInventory } from '../localization/text-inventory.mjs';

async function fixture(t, sources, manifest = {}) {
    const temporaryParent = path.resolve(os.tmpdir());
    const root = await fs.mkdtemp(path.join(temporaryParent, 'lpc-i18n-inventory-'));
    t.after(async () => {
        const resolved = path.resolve(root);
        assert.ok(resolved.startsWith(`${temporaryParent}${path.sep}lpc-i18n-inventory-`));
        await fs.rm(resolved, { recursive: true, force: true });
    });
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    for (const [relative, content] of Object.entries(sources)) {
        await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
        await fs.writeFile(path.join(root, relative), content);
    }
    return root;
}

const find = (report, message) => {
    const entry = report.entries.find(candidate => candidate.message === message);
    assert.ok(entry, `Missing inventory message: ${message}`);
    return entry;
};

test('manifest display fields include English, enum descriptions and nested settings but exclude identity', async t => {
    const root = await fixture(t, {}, {
        name: 'extension-identity', displayName: 'LPC Support', description: 'English extension description',
        contributes: {
            commands: [{ command: 'lpc.refresh', title: 'Refresh', category: 'LPC' }],
            views: { explorer: [{ id: 'view-identity', name: 'Errors' }] },
            configuration: { title: 'LPC Settings', properties: {
                'lpc.style': { type: 'string', default: 'internal-default', enum: ['internal-enum'],
                    enumDescriptions: ['Allman style', '中文样式'], markdownDescription: 'Choose a **style**',
                    items: { properties: { name: { type: 'string', description: 'Display name' } } } }
            } },
            semanticTokenTypes: [{ id: 'token-identity', description: 'Built-in function' }]
        }
    });
    const report = await scanTextInventory({ rootDir: root });
    assert.equal(find(report, 'Refresh').category, 'manifest-command');
    assert.equal(find(report, 'LPC').classification, 'user-interface');
    assert.equal(find(report, 'Allman style').category, 'manifest-setting');
    assert.equal(find(report, 'Display name').context.jsonPointer, '/contributes/configuration/properties/lpc.style/items/properties/name/description');
    assert.equal(find(report, '中文样式').languageHint, 'zh');
    find(report, 'Built-in function');
    find(report, 'English extension description');
    assert.ok(!report.entries.some(entry => /identity|internal-default|internal-enum/.test(entry.message)));
});

test('host notification, QuickPick, input validation, progress, status, errors and non-UI text remain distinct', async t => {
    const root = await fixture(t, { 'src/ui.ts': [
        'const id = "lpc.command";',
        'type Mode = "local" | "remote";',
        'vscode.window.showInformationMessage(`Ready: ${count}`, "Open");',
        'vscode.window.showQuickPick([{ id: "stable-id", label: "Open workspace", description: "Read the project" }], { placeHolder: "Choose a project" });',
        'vscode.window.showInputBox({ prompt: "Enter project name", validateInput: value => value ? null : "Name cannot be empty" });',
        'vscode.window.withProgress({ title: "Reading project" }, progress => progress.report({ message: "Loading files" }));',
        'statusBarItem.text = "$(database) LPC Index: Ready";',
        'statusBarItem.tooltip = "Click to rebuild";',
        'console.error("Failed to read template:", error);',
        'outputChannel.appendLine(`Read ${count} files`);',
        'throw new Error("Server did not return a result");',
        'const systemPrompt = `Generate Chinese Javadoc for ${code}`;',
        'const userPrompt = "请生成中文注释";',
        'function renderSkeleton() { return "TODO: Describe the return value."; }',
        'const unknownConsumer = "This is already English copy.";',
        '// "Comment must not become a candidate"',
        'const file = "./templates/panel.html";',
        'const protocol = { type: "ready", kind: "local", modelId: "stable-model" };'
    ].join('\n') });
    const report = await scanTextInventory({ rootDir: root });
    const ready = find(report, 'Ready: {0}');
    assert.equal(ready.category, 'notification');
    assert.equal(ready.line, 3);
    assert.deepEqual(ready.placeholders.map(slot => [slot.name, slot.expression, slot.line]), [['0', 'count', 3]]);
    assert.equal(find(report, 'Open').category, 'notification-action');
    assert.equal(find(report, 'Open workspace').category, 'quick-pick');
    assert.equal(find(report, 'Name cannot be empty').category, 'input-box');
    assert.equal(find(report, 'Reading project').category, 'progress');
    assert.equal(find(report, 'Loading files').category, 'progress');
    assert.equal(find(report, '$(database) LPC Index: Ready').category, 'status');
    assert.equal(find(report, 'Click to rebuild').category, 'status');
    assert.equal(find(report, 'Failed to read template:').classification, 'log');
    assert.equal(find(report, 'Read {0} files').classification, 'log');
    assert.equal(find(report, 'Server did not return a result').classification, 'manual-review');
    assert.equal(find(report, 'Generate Chinese Javadoc for {0}').classification, 'generation-prompt');
    assert.equal(find(report, '请生成中文注释').classification, 'generation-prompt');
    assert.equal(find(report, 'TODO: Describe the return value.').classification, 'generated-documentation');
    assert.equal(find(report, 'This is already English copy.').classification, 'manual-review');
    assert.ok(!report.entries.some(entry => /Comment must|stable-id|stable-model|lpc\.command|panel\.html/.test(entry.message)));
});

test('large Webview templates retain all static text, dynamic branches, attributes and inline script copy', async t => {
    const largeText = `Large copy ${'x'.repeat(160_000)}`;
    const source = [
        'function panel() { return `<!DOCTYPE html><html lang="zh-CN"><body>',
        '<h1>Document Center</h1>',
        `<p>${largeText}</p>`,
        '<input title="Search > all" aria-label="Find functions" placeholder="Search ${scope}">',
        '<p>${loading ? `<strong>正在加载 ${count} 个函数</strong>` : "Ready to browse"}</p>',
        '<script>document.title = "Functions"; console.log("Script debug message");</script>',
        '<style>.hidden::before { content: "CSS is separate"; }</style>',
        '</body></html>`; }'
    ].join('\n');
    const root = await fixture(t, { 'src/panel.ts': source });
    const report = await scanTextInventory({ rootDir: root });
    assert.equal(find(report, 'Document Center').line, 2);
    assert.equal(find(report, largeText).message.length, largeText.length);
    assert.equal(find(report, 'Search > all').context.attribute, 'title');
    assert.equal(find(report, 'Find functions').context.attribute, 'aria-label');
    const placeholder = find(report, 'Search {0}');
    assert.equal(placeholder.context.attribute, 'placeholder');
    assert.equal(placeholder.placeholders[0].expression, 'scope');
    assert.equal(placeholder.line, 4);
    const nested = find(report, '正在加载 {0} 个函数');
    assert.equal(nested.placeholders[0].expression, 'count');
    assert.equal(nested.line, 5);
    assert.equal(nested.classification, 'manual-review');
    find(report, 'Ready to browse');
    const slot = report.entries.find(entry => entry.message === '{1}' && entry.category === 'webview-text');
    assert.ok(slot, 'Keep the whole dynamic HTML slot for consumer review as well as nested static branches.');
    assert.equal(slot.classification, 'manual-review');
    assert.match(slot.placeholders[0].expression, /loading \?/);
    assert.equal(find(report, 'Functions').line, 6);
    assert.equal(find(report, 'Functions').classification, 'user-interface');
    assert.equal(find(report, 'Script debug message').classification, 'log');
    assert.ok(!report.entries.some(entry => entry.message.includes('CSS is separate')));
    assert.equal(report.summary.parseDiagnostics, 0);
});

test('standalone HTML includes accessibility and JS strings, excluding comments, style, DOM IDs and protocol values', async t => {
    const root = await fixture(t, { 'src/templates/view.html': [
        '<!doctype html><html lang="en"><head><title>Function Help</title></head><body>',
        '<!-- Comment copy must be ignored -->',
        '<button id="button-id" title="Refresh" aria-label="Refresh function documentation">刷新</button>',
        '<img src="./img.svg" alt="Function relationship">',
        '<input placeholder="Find a function" aria-description="Search is case insensitive">',
        '<script>',
        'const message = "Failed to load functions";',
        'document.getElementById("button-id").textContent = "Reload";',
        'button.setAttribute("aria-label", "Open declaration");',
        'vscode.postMessage({ type: "ready" });',
        '</script></body></html>'
    ].join('\n') });
    const report = await scanTextInventory({ rootDir: root });
    assert.equal(find(report, 'Function Help').classification, 'user-interface');
    assert.equal(find(report, '刷新').line, 3);
    assert.equal(find(report, 'Function relationship').context.attribute, 'alt');
    assert.equal(find(report, 'Search is case insensitive').context.attribute, 'aria-description');
    assert.equal(find(report, 'Failed to load functions').line, 7);
    assert.equal(find(report, 'Reload').line, 8);
    assert.equal(find(report, 'Open declaration').context.attribute, 'aria-label');
    assert.ok(!report.entries.some(entry => /button-id|Comment copy|^ready$|\.\/img/.test(entry.message)));
});

test('escaped literals map HTML fragments to real source lines without evaluation', async t => {
    const root = await fixture(t, { 'src/escaped.ts': [
        'const html = "<h1>English title</h1>\\n<p>\\u4e2d\\u6587内容</p>";',
        'const multiline = `<h2>Second title</h2>',
        '<p>Text &amp; details</p>`;'
    ].join('\n') });
    const report = await scanTextInventory({ rootDir: root });
    const escaped = find(report, '中文内容');
    assert.equal(escaped.line, 1, 'A decoded newline must not shift to a nonexistent source line.');
    assert.equal(escaped.column, 42);
    assert.equal(find(report, 'Text & details').line, 3);
});

test('scope excludes tests, fixtures, mocks, declarations, LPC sources and files outside src', async t => {
    const sources = {
        'src/main.ts': 'const message = "Production candidate text";',
        'src/main.test.ts': 'const message = "Test candidate text";',
        'src/main.spec.js': 'const message = "Spec candidate text";',
        'src/types.d.ts': 'type Label = "Declaration candidate text";',
        'src/__tests__/helper.ts': 'const message = "Nested test candidate text";',
        'src/fixtures/example.js': 'const message = "Fixture candidate text";',
        'src/__mocks__/vscode.js': 'const message = "Mock candidate text";',
        'src/example.c': 'void f() { write("User LPC source text"); }',
        'external/linked.ts': 'const message = "Symlinked candidate text";',
        'test/example.ts': 'const message = "Outside production text";'
    };
    const root = await fixture(t, sources);
    const report = await scanTextInventory({ rootDir: root });
    assert.deepEqual(report.files.map(file => file.path), ['package.json', 'src/main.ts']);
    assert.deepEqual(report.entries.map(entry => entry.message), ['Production candidate text']);
    assert.ok(!JSON.stringify(report).includes(root));
});

test('reports are deterministic and IDs survive line shifts while identical occurrences remain distinct', async t => {
    const root = await fixture(t, { 'src/repeated.ts': 'function show() {\nnotify("Review this text");\nnotify("Review this text");\n}\n' });
    const first = await scanTextInventory({ rootDir: root });
    const repeated = await scanTextInventory({ rootDir: root });
    assert.deepEqual(first, repeated);
    assert.equal(new Set(first.entries.map(entry => entry.id)).size, first.entries.length);
    await fs.writeFile(path.join(root, 'src/repeated.ts'), '// Shift lines only\n\nfunction show() {\nnotify("Review this text");\nnotify("Review this text");\n}\n');
    const shifted = await scanTextInventory({ rootDir: root });
    assert.deepEqual(first.entries.map(entry => entry.id), shifted.entries.map(entry => entry.id));
    assert.equal(shifted.entries[0].line, first.entries[0].line + 2);
    assert.notEqual(first.files[1].sha256, shifted.files[1].sha256);
});

test('parser errors are reported instead of silently implying complete coverage', async t => {
    const root = await fixture(t, { 'src/broken.ts': 'const message = "Still readable copy";\nfunction broken( {' });
    const report = await scanTextInventory({ rootDir: root });
    find(report, 'Still readable copy');
    assert.ok(report.summary.parseDiagnostics > 0);
    assert.ok(report.files.find(file => file.path === 'src/broken.ts').parseDiagnostics[0].line >= 2);
});

test('CLI defaults to JSON on stdout and rejects writes outside the report directory', () => {
    const script = fileURLToPath(new URL('../localization/text-inventory.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.ok(report.summary.filesScanned > 0);
    assert.equal(report.schemaVersion, 1);
    const rejected = spawnSync(process.execPath, [script, '--out', 'src/inventory-rejected.json'], { encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /inside \.tmp\/i18n/);
});
