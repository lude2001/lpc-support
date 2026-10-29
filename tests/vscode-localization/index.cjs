const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require('ws');
const vscode = require('vscode');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
let config;
const screenshotSizes = [];

async function waitFor(probe, description, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        try { const result = await probe(); if (result) return result; } catch (error) { lastError = error; }
        await delay(100);
    }
    throw new Error(`Timed out: ${description}${lastError ? ` (${lastError.message})` : ''}`);
}

function getTargets() {
    return new Promise((resolve, reject) => {
        const request = http.get(`http://127.0.0.1:${config.debugPort}/json/list`, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; if (body.length > 5_000_000) request.destroy(new Error('Oversized CDP response')); });
            response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
        });
        request.setTimeout(5000, () => request.destroy(new Error('Owned CDP endpoint timed out')));
        request.once('error', reject);
    });
}

function cdp(target, method, params = {}) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        const timer = setTimeout(() => { socket.terminate(); reject(new Error(`Owned CDP ${method} timed out`)); }, 5000);
        socket.once('open', () => socket.send(JSON.stringify({ id: 1, method, params })));
        socket.once('error', error => { clearTimeout(timer); reject(error); });
        socket.on('message', data => {
            const message = JSON.parse(data.toString());
            if (message.id !== 1) return;
            clearTimeout(timer); socket.close();
            if (message.error) reject(new Error(message.error.message));
            else if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text));
            else resolve(message.result);
        });
    });
}

async function evaluate(target, expression) {
    return (await cdp(target, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
}

async function workbenchTarget() {
    return waitFor(async () => (await getTargets()).find(target => target.type === 'page'
        && /workbench|vscode-file:/i.test(target.url)), 'this instance\'s workbench CDP target');
}

async function workbench(expression) { return evaluate(await workbenchTarget(), expression); }

async function viewportState(target) {
    return evaluate(target, `({ width:innerWidth, height:innerHeight,
        outerWidth, outerHeight, deviceScaleFactor:devicePixelRatio })`);
}

async function prepareViewport() {
    const target = await workbenchTarget();
    const initial = await viewportState(target);
    let toggledFullScreen = false;
    if (initial.width < 1200 || initial.height < 750) {
        // This public command targets only the current Extension Host window.
        await vscode.commands.executeCommand('workbench.action.toggleFullScreen');
        toggledFullScreen = true;
        await waitFor(async () => {
            const state = await viewportState(target);
            return state.width >= 1200 && state.height >= 750;
        }, 'the owned workbench to provide a full visual acceptance viewport');
    }
    return { initial, toggledFullScreen, prepared: await viewportState(target) };
}

async function restoreViewport(target, before, frameWidth) {
    // Electron does not expose Browser window APIs, and older Chromium may
    // retain 480×800 after clearDeviceMetricsOverride. Explicitly replace the
    // narrow metrics with the observed original viewport until this owned
    // instance exits, using the same Emulation method as the narrow check.
    await cdp(target, 'Emulation.setDeviceMetricsOverride', { width: before.width, height: before.height,
        deviceScaleFactor: before.deviceScaleFactor, mobile: false });
    let restored;
    let inspectorAfter;
    try {
        await waitFor(async () => {
            restored = await viewportState(target);
            inspectorAfter = await frame('#inspection-content', `doc => {
                const rectangle = doc.querySelector('#inspection-content').getBoundingClientRect();
                return { width:doc.documentElement.clientWidth, height:doc.documentElement.clientHeight,
                    scrollWidth:doc.documentElement.scrollWidth, visible:rectangle.width > 0 && rectangle.height > 0 };
            }`);
            const sameSize = Math.abs(restored.width - before.width) <= 2
                && Math.abs(restored.height - before.height) <= 2;
            // The VS Code grid may redistribute pane widths after a narrow
            // layout. Require a visible, contained page rather than its old width.
            return sameSize && inspectorAfter?.visible && inspectorAfter.width > 0
                && inspectorAfter.scrollWidth <= inspectorAfter.width + 2;
        }, 'the original workbench viewport and a visible inspector without root overflow');
    } catch (error) {
        throw new Error(`${error.message}; viewport=${JSON.stringify({ before, restored, inspectorBefore:frameWidth, inspectorAfter })}`);
    }
    assert.ok(restored.width >= 1200 && restored.height >= 750, 'The restored viewport is too small for page visual acceptance');
    return { ...restored, inspectorBefore:frameWidth, inspectorAfter };
}

// Only inspect documents reachable from this runner's loopback debugging port.
async function frame(selector, body) {
    const expression = `(() => {
        const documents = [document];
        for (let index = 0; index < documents.length; index++) {
            const doc = documents[index];
            if (doc.querySelector(${JSON.stringify(selector)})) return (${body})(doc);
            for (const iframe of doc.querySelectorAll('iframe')) {
                try { if (iframe.contentDocument) documents.push(iframe.contentDocument); } catch {}
            }
        }
        return null;
    })()`;
    for (const target of (await getTargets()).filter(item => ['page', 'iframe'].includes(item.type) && item.webSocketDebuggerUrl)) {
        try {
            const value = await evaluate(target, expression);
            if (value !== null && value !== undefined) return value;
        } catch { /* A renderer may be replaced while a Webview starts. */ }
    }
}

async function key(key, code, virtualKey) {
    const target = await workbenchTarget();
    await cdp(target, 'Input.dispatchKeyEvent', { type: 'keyDown', key, code,
        windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
    await cdp(target, 'Input.dispatchKeyEvent', { type: 'keyUp', key, code,
        windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey });
}

async function screenshot(name) {
    if (!config.screenshots) return;
    fs.mkdirSync(config.screenshots, { recursive: true });
    const result = await cdp(await workbenchTarget(), 'Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(result.data, 'base64');
    const size = { name, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    fs.writeFileSync(path.join(config.screenshots, `${name}.png`), png);
    screenshotSizes.push(size);
    if (name.startsWith('function-documentation-before-') || name === 'generated-comments' || name === 'efun-documentation') {
        assert.ok(size.width >= 1200 && size.height >= 750, `Visual evidence ${name} is cropped to ${size.width}×${size.height}`);
    }
}

function markdown(value) {
    if (Array.isArray(value)) return value.map(markdown).join('\n\n');
    return typeof value === 'string' ? value : value?.value ?? '';
}

function label(item) { return typeof item.label === 'string' ? item.label : item.label?.label; }

function positionOf(document, token, inside = 0, last = false) {
    const offset = last ? document.getText().lastIndexOf(token) : document.getText().indexOf(token);
    assert.ok(offset >= 0, `Synthetic token missing: ${token}`);
    return document.positionAt(offset + inside);
}

async function nativeUiProof() {
    assert.equal(vscode.env.language.toLowerCase(), config.locale, 'VS Code must actually initialize the requested language');
    const pack = vscode.extensions.getExtension(config.pack.id);
    assert.ok(pack, 'The dedicated language pack was not recognized as an installed extension');
    assert.equal(pack.packageJSON.version, config.pack.version);
    await vscode.commands.executeCommand('workbench.action.showCommands');
    try {
        const text = await waitFor(() => workbench(`(() => {
            const inputs = [...document.querySelectorAll('.quick-input-widget input')];
            const input = inputs.find(item => item.getBoundingClientRect().height > 0);
            return input ? { placeholder: input.getAttribute('placeholder') || '', label: input.getAttribute('aria-label') || '' } : null;
        })()`), 'the native command palette input');
        const strings = Object.values(text).filter(Boolean);
        if (config.locale === 'zh-cn') {
            assert.ok(strings.some(value => /\p{Script=Han}/u.test(value) && config.pack.nativeStrings.includes(value)),
                `--locale alone is insufficient: native command palette was not translated (${JSON.stringify(text)})`);
        } else {
            assert.ok(strings.some(value => /command/i.test(value)), 'The native English command palette prompt was not observed');
            assert.ok(strings.every(value => !/\p{Script=Han}/u.test(value)));
        }
        return text;
    } finally { await vscode.commands.executeCommand('workbench.action.closeQuickOpen'); }
}

async function registeredLanguagePack() {
    const filename = path.join(config.userData, 'languagepacks.json');
    await waitFor(() => {
        if (!fs.existsSync(filename)) return false;
        const registry = readJson(filename);
        const entry = registry['zh-cn'];
        if (!entry?.hash || !entry.translations?.vscode) return false;
        const translated = path.resolve(entry.translations.vscode);
        const within = root => {
            const relative = path.relative(root, translated);
            return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
        };
        assert.ok(within(config.extensionsDir) || within(config.userData), 'Native locale registry points outside this test environment');
        assert.ok(fs.existsSync(translated), 'Registered native translation resource is missing');
        return entry;
    }, 'a real languagepacks.json registration in this runtime\'s owned user-data');
    return { registered: true };
}

function manifestAndBundle(extension) {
    const source = readJson(path.join(config.repositoryRoot, 'package.json'));
    const english = readJson(path.join(config.repositoryRoot, 'package.nls.json'));
    const translations = readJson(path.join(config.repositoryRoot, config.locale === 'zh-cn' ? 'package.nls.zh-cn.json' : 'package.nls.json'));
    let checked = 0;
    let localizedOriginals = 0;
    const visit = (raw, resolved, pointer) => {
        if (typeof raw === 'string' && /^%[^%]+%$/.test(raw)) {
            const key = raw.slice(1, -1);
            const message = translations[key];
            assert.equal(typeof message, 'string', `${pointer}: missing manifest translation`);
            const displayField = /\/(?:displayName|description|markdownDescription|title|category|name|label)$/.test(pointer)
                || /\/(?:enumDescriptions|markdownEnumDescriptions)\/\d+$/.test(pointer);
            if (resolved && typeof resolved === 'object' && displayField) {
                // VS Code retains both command source text and translated UI text.
                assert.equal(resolved.original, english[key], `${pointer}: localized original changed from English source`);
                assert.equal(resolved.value, message, `${pointer}: VS Code did not localize the display value`);
                localizedOriginals++;
            } else {
                // In particular, snippetPath remains an exact technical string.
                assert.equal(resolved, message, `${pointer}: VS Code did not localize the manifest`);
            }
            checked++;
        } else if (raw && typeof raw === 'object') {
            for (const [key, value] of Object.entries(raw)) visit(value, resolved?.[key], `${pointer}/${key}`);
        }
    };
    visit(source, extension.packageJSON, 'package');
    assert.ok(checked >= 60, 'Manifest acceptance must cover commands, settings and descriptions');
    const expected = config.locale === 'zh-cn' ? 'LPC 分析查看器' : 'LPC Analysis Inspector';
    assert.equal(vscode.l10n.t('LPC Analysis Inspector'), expected, 'Actual vscode.l10n must load this extension\'s runtime messages');
    if (config.locale === 'zh-cn') {
        assert.equal(vscode.l10n.bundle?.['LPC Analysis Inspector'], expected, 'A real Chinese bundle must be present');
        assert.ok(vscode.l10n.uri, 'VS Code must expose the loaded localization resource URI');
    }
    return { manifestPlaceholders: checked, localizedOriginals, bundleTranslation: expected,
        bundleResource: vscode.l10n.uri ? path.basename(vscode.l10n.uri.fsPath) : 'English source templates' };
}

function expandedSnippet(body) {
    const source = Array.isArray(body) ? body.join('\n') : body;
    const values = new Map();
    for (const match of source.matchAll(/\$\{(\d+):([^}]*)\}/g)) if (!values.has(match[1])) values.set(match[1], match[2]);
    return source.replace(/\$\{(\d+)(?::[^}]*)?\}/g, (_, index) => values.get(index) ?? '');
}

async function snippetProof(extension) {
    const contributions = extension.packageJSON.contributes.snippets;
    assert.equal(contributions.length, 1, 'Do not register both localized snippet resources');
    assert.equal(contributions[0].language, 'lpc');
    const expectedPath = config.locale === 'zh-cn' ? './snippets/lpc.zh-cn.json' : './snippets/lpc.json';
    assert.equal(contributions[0].path, expectedPath, 'Native manifest must select the localized resource');
    const snippets = readJson(path.resolve(extension.extensionPath, contributions[0].path));
    const english = readJson(path.join(config.repositoryRoot, 'snippets/lpc.json'));
    assert.deepEqual(Object.keys(snippets), Object.keys(english));
    assert.equal(Object.keys(snippets).length, 9);
    const document = await vscode.workspace.openTextDocument(path.join(config.workspace, 'snippets.c'));
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const facts = [];
    for (const [name, snippet] of Object.entries(snippets)) {
        assert.equal(snippet.prefix, english[name].prefix);
        assert.deepEqual(snippet.body, english[name].body);
        await vscode.commands.executeCommand('leaveSnippet');
        await editor.edit(builder => builder.replace(new vscode.Range(0, 0, document.lineCount, 0), ''));
        editor.selection = new vscode.Selection(0, 0, 0, 0);
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        // The native Insert Snippet picker proves candidate prefix/description and no duplicate registration.
        const picker = vscode.commands.executeCommand('editor.action.insertSnippet');
        await waitFor(() => workbench(`!![...document.querySelectorAll('.quick-input-widget input')].find(i => i.getBoundingClientRect().height > 0)`), 'native snippet picker');
        await cdp(await workbenchTarget(), 'Input.insertText', { text: snippet.prefix });
        const candidate = await waitFor(() => workbench(`(() => {
            const rows = [...document.querySelectorAll('.quick-input-list .monaco-list-row')];
            const matches = rows.filter(row => row.querySelector('.label-name')?.textContent === ${JSON.stringify(snippet.prefix)});
            if (!matches.length) return null;
            return { count: matches.length, text: matches[0].textContent };
        })()`), `native snippet candidate ${name}`);
        assert.equal(candidate.count, 1, `${name}: duplicate native snippet candidates`);
        assert.ok(candidate.text.includes(snippet.description), `${name}: native candidate description is not localized`);
        await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
        await picker;
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        await vscode.commands.executeCommand('type', { text: snippet.prefix });
        await waitFor(() => document.getText() === snippet.prefix, `typed prefix ${name}`);
        await delay(150); // Allow the native Tab-completion context to observe the cursor event.
        await key('Tab', 'Tab', 9);
        const expected = expandedSnippet(snippet.body);
        await waitFor(() => document.getText() === expected, `physical Tab expansion of ${name}`);
        if (name === 'Create Function') {
            await waitFor(() => document.getText(editor.selection) === 'void', 'the first native snippet placeholder');
            await key('Tab', 'Tab', 9);
            await waitFor(() => document.getText(editor.selection) === 'function_name', 'native Tab navigation to the second placeholder');
        }
        facts.push({ name, prefix: snippet.prefix, expandedBodySha256: sha256(document.getText()) });
    }
    await vscode.commands.executeCommand('leaveSnippet');
    return { resource: expectedPath, count: facts.length, facts };
}

async function languageServiceProof(document) {
    const atName = positionOf(document, 'allocate(2)', 3);
    const atArgument = positionOf(document, 'allocate(2)', 'allocate('.length);
    const body = readJson(path.join(config.repositoryRoot, 'config/efun-docs/locales', config.locale, 'allocate.json'));
    const hovers = await waitFor(async () => {
        const value = await vscode.commands.executeCommand('vscode.executeHoverProvider', document.uri, atName);
        return value?.length ? value : null;
    }, 'native Efun hover');
    const completions = await waitFor(async () => {
        const value = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, atName, undefined, 100);
        return value?.items?.some(item => label(item) === 'allocate') ? value : null;
    }, 'native Efun completion');
    const completion = completions.items.find(item => label(item) === 'allocate');
    const signature = await waitFor(async () => {
        const value = await vscode.commands.executeCommand('vscode.executeSignatureHelpProvider', document.uri, atArgument);
        return value?.signatures?.length ? value : null;
    }, 'native Efun signature help');
    for (const text of [markdown(hovers[0].contents), markdown(completion.documentation), ...signature.signatures.map(item => markdown(item.documentation))]) {
        for (const field of ['summary', 'details', 'note']) if (body[field]) assert.ok(text.includes(body[field]), `Native Efun ${field} does not use ${config.locale}`);
    }
    const diagnostics = await waitFor(() => {
        const value = vscode.languages.getDiagnostics(document.uri);
        return value.some(item => item.message.includes('unused_locale_probe')) ? value : null;
    }, 'Rust diagnostics through native VS Code');
    const unused = diagnostics.find(item => item.message.includes('unused_locale_probe'));
    // Rust emits LSP Warning (2); vscode-languageclient maps it to VS Code Warning (1).
    assert.equal(unused.severity, vscode.DiagnosticSeverity.Warning);
    assert.equal(typeof unused.code === 'object' ? unused.code.value : unused.code, 'unusedVar');
    assert.equal(unused.source, 'lpc-support');
    const unusedStart = positionOf(document, 'unused_locale_probe');
    assert.deepEqual(unused.range, new vscode.Range(unusedStart, unusedStart.translate(0, 'unused_locale_probe'.length)));
    assert.ok(config.locale === 'zh-cn' ? /未被使用/.test(unused.message) : /is unused/.test(unused.message));
    const documented = await vscode.commands.executeCommand('vscode.executeHoverProvider', document.uri, positionOf(document, 'documented_value(1)', 3));
    const userText = markdown(documented?.[0]?.contents);
    for (const value of ['USER_BODY 中文原文', 'USER_PARAM 中文原文.', 'USER_RETURN 不翻译.']) assert.ok(userText.includes(value), 'User-authored documentation must remain unchanged');
    for (const heading of config.locale === 'zh-cn' ? ['参数', '返回值'] : ['Parameters', 'Returns']) assert.ok(userText.includes(`**${heading}**`));
    return { efunBodySha256: sha256(body.summary), diagnosticMessage: unused.message, facts: {
        efunSignatures: signature.signatures.map(item => item.label),
        efunCompletion: { label: label(completion), kind: completion.kind,
            insertText: typeof completion.insertText === 'string' ? completion.insertText : completion.insertText?.value },
        diagnostic: { code: typeof unused.code === 'object' ? unused.code.value : unused.code, source: unused.source,
            severity: unused.severity, range: [unused.range.start.line, unused.range.start.character, unused.range.end.line, unused.range.end.character] }
    } };
}

async function inspectorProof(document) {
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const position = positionOf(document, 'HTML_LITERAL', 3, true);
    editor.selection = new vscode.Selection(position, position);
    await vscode.commands.executeCommand('lpc.showAnalysisInspector');
    const state = await waitFor(async () => {
        const value = await frame('#inspection-content', `doc => ({
            title: doc.querySelector('.title')?.textContent, lang: doc.documentElement.lang,
            busy: doc.querySelector('#inspection-content').getAttribute('aria-busy'),
            status: doc.querySelector('#status').textContent, text: doc.body.textContent,
            tabs: [...doc.querySelectorAll('[role="tab"]')].map(e => ({ id:e.id, text:e.textContent, controls:e.getAttribute('aria-controls') })),
            refresh: doc.querySelector('#refresh').getAttribute('aria-label'),
            csp: doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
            injected: Boolean(doc.defaultView.__lpcInjected || doc.querySelector('img[src="x"]'))
        })`);
        return value?.busy === 'false' && value.text.includes('<img src=x onerror=globalThis.__lpcInjected=1>') ? value : null;
    }, 'real inspector snapshot and escaped macro replacement text');
    assert.equal(state.title, vscode.l10n.t('LPC Analysis Inspector'));
    assert.equal(state.lang.toLowerCase(), config.locale);
    assert.equal(state.refresh, vscode.l10n.t('Refresh analysis'));
    assert.deepEqual(state.tabs.map(item => item.id), ['tab-overview', 'tab-macros', 'tab-dependencies', 'tab-preprocessed']);
    assert.equal(state.tabs[0].text, vscode.l10n.t('Overview'));
    assert.ok(state.csp.includes("default-src 'none'"));
    assert.equal(state.injected, false);
    await frame('#inspection-content', `doc => {
        const first = doc.querySelector('#tab-overview'); first.focus();
        first.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key:'ArrowRight', bubbles:true }));
        return true;
    }`);
    const keyboard = await frame('#inspection-content', `doc => ({ selected:doc.querySelector('[role="tab"][aria-selected="true"]').id,
        focused:doc.activeElement.id, visible:!doc.querySelector('#macros').hidden })`);
    assert.deepEqual(keyboard, { selected: 'tab-macros', focused: 'tab-macros', visible: true });
    await screenshot('inspector');
    const target = await workbenchTarget();
    const originalViewport = await viewportState(target);
    const originalFrameWidth = await frame('#inspection-content', 'doc => doc.documentElement.clientWidth');
    let restoredViewport;
    try {
        await cdp(target, 'Emulation.setDeviceMetricsOverride', { width: 480, height: 800, deviceScaleFactor: 1, mobile: false });
        const narrow = await waitFor(async () => {
            const value = await frame('#inspection-content', `doc => ({ width:doc.documentElement.clientWidth, scroll:doc.documentElement.scrollWidth })`);
            return value?.width > 0 && value.width < 480 ? value : null;
        }, 'inspector layout to receive the narrow workbench size');
        assert.ok(narrow.width > 0 && narrow.scroll <= narrow.width + 2, 'Inspector root overflows in a narrow workbench');
        await screenshot('inspector-narrow');
    } finally { restoredViewport = await restoreViewport(target, originalViewport, originalFrameWidth); }
    // Resizing may invalidate an older generation. Observe a real refreshed
    // snapshot and use its Location binding, rather than guessing the first link.
    await frame('#inspection-content', `doc => {
        const win = doc.defaultView;
        win.__lpcAcceptanceSnapshot = null;
        win.addEventListener('message', event => {
            if (event.data?.type === 'snapshot') win.__lpcAcceptanceSnapshot = event.data;
        });
        doc.querySelector('#refresh').click();
        return true;
    }`);
    const expectedUri = document.uri.toString();
    const navigation = await waitFor(() => frame('#inspection-content', `doc => {
        const snapshot = doc.defaultView.__lpcAcceptanceSnapshot;
        if (!snapshot || doc.querySelector('#inspection-content').getAttribute('aria-busy') !== 'false') return null;
        const index = snapshot.view.locations.findIndex(location => location.uri === ${JSON.stringify(expectedUri)} && location.range.start.line === 0);
        if (index < 0) return null;
        doc.querySelector('#tab-overview').click();
        const button = doc.querySelector('#overview .locations [data-location="' + index + '"]');
        if (!button) return null;
        const target = { generation:snapshot.generation, index, location:snapshot.view.locations[index],
            label:button.textContent, title:button.title };
        button.click();
        return target;
    }`), 'a refreshed macro-definition Location bound to a real overview button');
    assert.equal(navigation.location.uri, expectedUri);
    assert.equal(navigation.location.range.start.line, 0);
    assert.equal(navigation.label, `${vscode.workspace.asRelativePath(document.uri, true)}:1`);
    assert.equal(navigation.title, vscode.l10n.t('Open source: {0}', navigation.label));
    try {
        await waitFor(() => {
            const active = vscode.window.activeTextEditor;
            return active?.document.uri.toString() === navigation.location.uri
                && active.selection.start.line === navigation.location.range.start.line
                && active.selection.start.character === navigation.location.range.start.character;
        }, 'inspector source navigation to the bound macro-definition Location');
    } catch (error) {
        const active = vscode.window.activeTextEditor;
        throw new Error(`${error.message}; target=${JSON.stringify(navigation)}; actual=${JSON.stringify({
            uri:active?.document.uri.toString(), line:active?.selection.start.line, character:active?.selection.start.character
        })}`);
    }
    return { title: state.title, lang: state.lang, tabLabels: state.tabs.map(item => item.text),
        keyboardNavigation: true, escapedSource: true,
        viewport: { before:originalViewport, restored:restoredViewport },
        navigation: { label:navigation.label, line:navigation.location.range.start.line,
            character:navigation.location.range.start.character, generation:navigation.generation, index:navigation.index } };
}

async function efunCenterProof(document) {
    await vscode.window.showTextDocument(document, { preview: false });
    await vscode.commands.executeCommand('lpc.showFunctionDoc');
    await waitFor(() => frame('#function-list', 'doc => !!doc.querySelector(".function-row")'), 'the real documentation center snapshot');
    await frame('#function-list', `doc => {
        const win = doc.defaultView;
        win.__lpcAcceptanceExternal = null;
        win.addEventListener('message', event => {
            if (event.data?.type === 'externalSearchResult') win.__lpcAcceptanceExternal = event.data;
        });
        doc.querySelector('[data-filter-group="scope"][data-filter-value="efun"]').click();
        return true;
    }`);
    const results = [];
    const facts = [];
    const names = ['allocate_mapping', 'sprintf', 'read_file', 'clone_object', 'db_exec', 'async_read'];
    const signatureFacts = (signature, panel) => ({
        label: signature.label, returnType: signature.returnType ?? null,
        parameters: signature.parameters.map(parameter => ({ name: parameter.name, type: parameter.type ?? null,
            optional: parameter.optional === true, variadic: parameter.variadic === true })),
        variadic: (panel ? signature.isParameterVariadic : signature.isVariadic) === true,
        arity: signature.arity ? { min: signature.arity.min, max: signature.arity.max ?? null } : null
    });
    try {
        for (const name of names) {
            const localized = readJson(path.join(config.repositoryRoot, 'config/efun-docs/locales', config.locale, `${name}.json`));
            const source = readJson(path.join(config.repositoryRoot, 'config/efun-docs/docs', `${name}.json`));
            await frame('#function-list', `doc => {
                doc.defaultView.__lpcAcceptanceExternal = null;
                const search = doc.querySelector('#search-input');
                search.value = ${JSON.stringify(name)};
                search.dispatchEvent(new doc.defaultView.Event('input', { bubbles:true }));
                return true;
            }`);
            const received = await waitFor(() => frame('#function-list', `doc => {
                const message = doc.defaultView.__lpcAcceptanceExternal;
                if (!message || doc.querySelector('#search-input').value !== ${JSON.stringify(name)}) return null;
                const entries = message.entries.filter(entry => entry.sourceKind === 'efun' && entry.name === ${JSON.stringify(name)});
                const rows = [...doc.querySelectorAll('.function-row')].filter(row => row.querySelector('.function-name')?.textContent === ${JSON.stringify(name)});
                if (!rows.length || !entries.length) return null;
                rows[0].click();
                return { entries, rows:rows.length, diagnostics:message.diagnostics || [] };
            }`), `real Efun external result and catalogue selection ${name}`);
            assert.equal(received.rows, 1, `${name}: native Efun catalogue has duplicate entries`);
            assert.equal(received.entries.length, 1, `${name}: host sent duplicate Efun entries`);
            assert.deepEqual(received.diagnostics, [], `${name}: external search returned a failure diagnostic`);
            const entry = received.entries[0];
            const expectedSignatures = source.signatures.map(signature => signatureFacts(signature, false));
            const actualSignatures = entry.signatures.map(signature => signatureFacts(signature, true));
            assert.deepEqual(actualSignatures, expectedSignatures, `${name}: host changed structured signatures`);
            assert.equal(new Set(entry.signatures.map(signature => signature.label)).size, source.signatures.length, `${name}: duplicated structural signature`);
            for (const field of ['summary', 'details', 'note']) {
                assert.equal(entry.documentation[field], localized[field], `${name}/${field}: TS provider/host used the wrong locale body`);
            }
            const detail = await waitFor(() => frame('#function-list', `doc => {
                const panel = doc.querySelector('#detail-panel');
                if (panel.querySelector('h2')?.textContent !== ${JSON.stringify(name)}) return null;
                return { name:panel.querySelector('h2').textContent,
                    sections:[...panel.querySelectorAll('.detail-section')].map(section => ({
                        title:section.querySelector('.section-kicker')?.textContent,
                        text:section.querySelector('.doc-copy')?.textContent
                    })),
                    tabs:[...panel.querySelectorAll('.signature-tab')].map(tab => tab.title),
                    cards:[...panel.querySelectorAll('.signature-card pre code')].map(code => code.textContent) };
            }`), `rendered Efun details ${name}`);
            for (const [field, heading] of [['summary', 'Summary'], ['details', 'Details'], ['note', 'Notes']]) {
                if (!localized[field]) continue;
                const sections = detail.sections.filter(section => section.title === vscode.l10n.t(heading));
                assert.equal(sections.length, 1, `${name}/${field}: rendered detail section is missing or duplicated`);
                assert.equal(sections[0].text, localized[field], `${name}/${field}: Webview changed the locale body`);
            }
            assert.deepEqual(detail.tabs, source.signatures.length > 1 ? source.signatures.map(signature => signature.label) : []);
            for (let index = 0; index < source.signatures.length; index++) {
                if (source.signatures.length > 1) {
                    await frame('#function-list', `doc => { doc.querySelectorAll('#detail-panel .signature-tab')[${index}].click(); return true; }`);
                }
                const cards = await frame('#function-list', 'doc => [...doc.querySelectorAll("#detail-panel .signature-card pre code")].map(code => code.textContent)');
                assert.deepEqual(cards, [source.signatures[index].label], `${name}: show exactly the selected original signature`);
            }
            if (name === 'db_exec') {
                await frame('#function-list', `doc => {
                    const summary = [...doc.querySelectorAll('#detail-panel .detail-section')].find(section =>
                        section.querySelector('.section-kicker')?.textContent === ${JSON.stringify(vscode.l10n.t('Summary'))});
                    summary.scrollIntoView({ block:'center' });
                    return true;
                }`);
                await screenshot('efun-documentation');
            }
            results.push({ name, fields:Object.keys(localized), localeBodySha256:sha256(JSON.stringify(localized)),
                signatures:source.signatures.length, receivedRealExternalResult:true, verifiedRenderedBody:true });
            facts.push({ name, signatures:actualSignatures });
        }
    } finally {
        await frame('#function-list', `doc => {
            doc.querySelector('[data-filter-group="scope"][data-filter-value="all"]').click();
            const search = doc.querySelector('#search-input'); search.value = '';
            search.dispatchEvent(new doc.defaultView.Event('input', { bubbles:true }));
            return true;
        }`);
    }
    return { count:results.length, results, facts };
}

async function authoringProof(document) {
    const configuration = vscode.workspace.getConfiguration('lpc', document.uri);
    assert.equal(configuration.inspect('documentation.language').defaultValue, 'zh-cn');
    assert.equal(configuration.get('documentation.language'), 'zh-cn', 'Default output language must be Chinese in both UIs');
    const original = document.getText();
    for (const [name, language] of [['needs_documentation_cn', 'zh-cn'], ['needs_documentation_en', 'en']]) {
        if (language === 'en') {
            await configuration.update('documentation.language', 'en', vscode.ConfigurationTarget.WorkspaceFolder);
            assert.equal(vscode.workspace.getConfiguration('lpc', document.uri).inspect('documentation.language').workspaceFolderValue, 'en');
        }
        await vscode.window.showTextDocument(document, { preview: false });
        await vscode.commands.executeCommand('lpc.showFunctionDoc');
        await waitFor(() => frame('#function-list', `doc => {
            const row = [...doc.querySelectorAll('.function-row')].find(e => e.querySelector('.function-name')?.textContent === ${JSON.stringify(name)});
            if (!row) return false; row.click(); return true;
        }`), `documentation center row ${name}`);
        const state = await waitFor(() => frame('#function-list', `doc => {
            const selected = doc.querySelector('.function-row.is-selected .function-name')?.textContent;
            const button = [...doc.querySelectorAll('.action-button')].find(e => e.textContent === ${JSON.stringify(vscode.l10n.t('Generate documentation skeleton'))});
            return selected === ${JSON.stringify(name)} && button ? { title:doc.title, lang:doc.documentElement.lang,
                searchLabel:doc.querySelector('#search-input').getAttribute('aria-label'),
                csp:doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
                injected:Boolean(doc.defaultView.__lpcInjected || doc.querySelector('img[src="x"]')) } : null;
        }`), `real deterministic documentation action ${name}`);
        assert.equal(state.title, vscode.l10n.t('LPC Function Documentation Center'));
        assert.equal(state.lang.toLowerCase(), config.locale);
        assert.equal(state.searchLabel, vscode.l10n.t('Search function documentation'));
        assert.ok(state.csp.includes("default-src 'none'"));
        assert.equal(state.injected, false);
        await screenshot(`function-documentation-before-${language}`);
        await frame('#function-list', `doc => {
            [...doc.querySelectorAll('.action-button')].find(e => e.textContent === ${JSON.stringify(vscode.l10n.t('Generate documentation skeleton'))}).click(); return true;
        }`);
        const summary = language === 'en' ? `TODO: Briefly describe the purpose of ${name}.` : `TODO: 简要说明 ${name} 的用途。`;
        await waitFor(() => document.getText().includes(`@brief ${summary}`), `native ${language} documentation skeleton insertion`);
        assert.ok(document.getText().includes(`int ${name}(string label) { return ${language === 'en' ? 2 : 1}; }`));
        assert.ok(document.getText().includes(language === 'en' ? '@param string label TODO: Describe label.' : '@param string label TODO: 说明 label。'));
    }
    const existing = original.slice(original.indexOf('/**'), original.indexOf('int documented_value'));
    assert.ok(document.getText().includes(existing), 'Existing user-authored comment must remain byte-for-byte intact');
    await screenshot('generated-comments');
    return { defaultLanguage: 'zh-cn', resourceOverride: 'en', generatedViaRealWebviewButtons: 2, existingCommentPreserved: true };
}

async function run() {
    config = readJson(process.env.LPC_VSCODE_LOCALIZATION_CONFIG);
    assert.equal(vscode.workspace.workspaceFolders?.length, 1);
    assert.equal(path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath).toLowerCase(), path.resolve(config.workspace).toLowerCase());
    const report = { result: 'failed', locale: config.locale, vscodeVersion: vscode.version, syntheticWorkspaceOnly: true };
    const stage = name => {
        report.stage = name;
        fs.writeFileSync(config.reportPath, `${JSON.stringify(report, null, 2)}\n`);
        console.log(`Native localization ${config.locale}: ${name}`);
    };
    try {
        stage('owned-window-viewport');
        report.window = await prepareViewport();
        stage('native-ui');
        report.nativeUi = await nativeUiProof();
        if (config.prewarm) {
            stage('language-pack-registration');
            report.languagePackRegistration = await registeredLanguagePack();
            report.result = 'passed';
            return;
        }
        const extension = vscode.extensions.getExtension('ludexiang.lpc-support');
        assert.ok(extension);
        stage('manifest-and-runtime-bundle');
        report.resources = manifestAndBundle(extension);
        const document = await vscode.workspace.openTextDocument(path.join(config.workspace, 'localization.c'));
        await vscode.window.showTextDocument(document, { preview: false });
        await extension.activate();
        stage('nine-native-snippets');
        report.snippets = await snippetProof(extension);
        await vscode.window.showTextDocument(document, { preview: false });
        stage('native-language-service');
        report.languageService = await languageServiceProof(document);
        stage('analysis-inspector');
        report.inspector = await inspectorProof(document);
        stage('efun-documentation-center');
        report.efunCenter = await efunCenterProof(document);
        stage('documentation-authoring');
        report.authoring = await authoringProof(document);
        stage('language-pack-registration');
        report.languagePackRegistration = await registeredLanguagePack();
        report.facts = { snippets: report.snippets.facts, ...report.languageService.facts, efunCenter:report.efunCenter.facts };
        report.result = 'passed';
        if (config.hold) {
            fs.writeFileSync(config.readyMarker, JSON.stringify({ result: 'passed', locale: config.locale,
                debugPort: config.debugPort, continueMarker: config.continueMarker, workspace: config.workspace }));
            console.log(`Localization window ready: ${config.readyMarker}; create ${config.continueMarker} to continue.`);
            await waitFor(() => fs.existsSync(config.continueMarker), 'visual inspection continue marker', config.holdTimeoutMs);
        }
        // Returning from Extension Host tests exits only this test instance.
        // Do not invoke closeAllEditors: dirty synthetic files would show a save dialog.
        console.log(`Native VS Code localization acceptance passed (${config.locale}, ${vscode.version}).`);
    } catch (error) {
        report.result = 'failed'; report.error = error.message;
        await screenshot('failure').catch(() => {});
        throw error;
    } finally {
        report.screenshots = screenshotSizes;
        fs.writeFileSync(config.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
}

module.exports = { run };
