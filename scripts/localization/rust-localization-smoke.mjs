#!/usr/bin/env node
// Run after rebuilding the Rust sidecar. This script never builds a binary and
// never opens a real Mudlib. Every server PID, source file and cache is its own.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node.js';
import { DiagnosticsInbox } from '../diagnostics-inbox.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const cacheVersion = 'rust-localization-smoke-v1';
const unknownMethod = 'lpc/localizationSmoke/unsupported';
const efunExamples = [
    ['allocate_mapping', '1'], ['sprintf', '"%s", "x"'], ['read_file', '"/fixture"'],
    ['clone_object', '"/fixture"'], ['db_exec', '1, "query"'], ['async_read', '"/fixture"']
];
const body = {
    function: 'FUNCTION_BODY 中文原文 English user text.',
    parameter: 'FUNCTION_PARAM 原文: preserve this.',
    returns: 'FUNCTION_RETURN 不翻译.',
    details: 'FUNCTION_DETAILS 原文 **Parameters**.',
    note: 'FUNCTION_NOTE 原文 @return.',
    macro: 'MACRO_BODY 中文原文 English user text.',
    macroParameter: 'MACRO_PARAM 原文.',
    macroReturns: 'MACRO_RETURN 用户正文.',
    member: 'MEMBER_BODY 中文原文 English user text.',
    memberDetails: 'MEMBER_DETAILS 原文.',
    memberNote: 'MEMBER_NOTE 原文.',
    raw: 'RAW_BODY **参数**：不要翻译 raw-user-text'
};

function optionsFrom(args) {
    const options = { timeoutMs: 15_000 };
    for (let index = 0; index < args.length; index++) {
        const flag = args[index];
        if (!['--timeout-ms', '--report'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
        const value = args[++index];
        if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
        if (flag === '--report') options.reportPath = path.resolve(value);
        else options.timeoutMs = Number(value);
    }
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 60_000) {
        throw new Error('--timeout-ms must be an integer between 1000 and 60000');
    }
    return options;
}

async function bounded(promise, milliseconds, stage) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timed out: ${stage}`)), milliseconds);
        })]);
    } finally {
        clearTimeout(timer);
    }
}

function digest(value) {
    return createHash('sha256').update(value).digest('hex');
}

function same(actual, expected, message) {
    // Failure reports identify the stage without dumping documentation/source.
    assert.ok(isDeepStrictEqual(actual, expected), message);
}

function newestRustInput(directory) {
    let newest = { mtimeMs: 0 };
    for (const item of readdirSync(directory, { withFileTypes: true })) {
        if (item.name === 'target' || item.name === '.git') continue;
        const filename = path.join(directory, item.name);
        const candidate = item.isDirectory() ? newestRustInput(filename)
            : /\.rs$|^Cargo\.(?:toml|lock)$/u.test(item.name) ? statSync(filename) : { mtimeMs: 0 };
        if (candidate.mtimeMs > newest.mtimeMs) newest = candidate;
    }
    return newest;
}

function checkBinary() {
    const executable = process.env.LPC_RUST_SERVER_PATH
        ? path.resolve(process.env.LPC_RUST_SERVER_PATH)
        : path.join(repositoryRoot, 'dist', 'bin', process.platform === 'win32' ? 'lpc-language-server.exe' : 'lpc-language-server');
    if (!existsSync(executable)) throw new Error('Rust sidecar is missing. Build it first; this smoke never builds automatically.');
    const binary = statSync(executable);
    if (binary.mtimeMs < newestRustInput(path.join(repositoryRoot, 'rust')).mtimeMs) {
        throw new Error('Rust sidecar predates a Rust source or Cargo input. Rebuild before running localization smoke.');
    }
    return { executable, sha256: digest(readFileSync(executable)), modifiedAt: binary.mtime.toISOString() };
}

function positionAt(source, token, inside = 1) {
    const offset = source.indexOf(token);
    assert.ok(offset >= 0, `Synthetic fixture lacks token ${token}`);
    const prefix = source.slice(0, offset + inside);
    return { line: prefix.split('\n').length - 1, character: prefix.length - prefix.lastIndexOf('\n') - 1 };
}

function fixtureAt(root) {
    const sources = {
        'docs.h': [
            '/**', ` * @brief ${body.macro}`, ` * @param int value ${body.macroParameter}`,
            ` * @return ${body.macroReturns}`, ' */', '#define DOC_MACRO(value) ((value) + 1)',
            `// ${body.raw}`, '#define RAW_MARKER 9', 'struct Payload {', '/**',
            ` * @brief ${body.member}`, ` * @details ${body.memberDetails}`, ` * @note ${body.memberNote}`,
            ' */', 'string label;', '}', ''
        ].join('\n'),
        'documented.c': [
            '/**', ` * @brief ${body.function}`, ` * @param int value ${body.parameter}`,
            ` * @return int ${body.returns}`, ` * @details ${body.details}`, ` * @note ${body.note}`,
            ' */', 'int documented(int value) { return value; }', ''
        ].join('\n'),
        'dependency.c': 'int dependency_value() { return 1; }\n',
        'probe.c': [
            '#include "docs.h"', 'inherit "documented";', 'inherit "dependency";', 'int unused_global;',
            'int probe(int unused_parameter) {', '    int unused_local = 0;', '    missing_call();',
            '    return documented(1) + DOC_MACRO(1) + RAW_MARKER + dependency_value();', '}',
            'void inspect() { struct Payload payload; payload.label; }',
            `void efun_examples() { ${efunExamples.map(([name, args], index) => `${index % 2 ? 'efun::' : ''}${name}(${args});`).join(' ')} }`, ''
        ].join('\n')
    };
    mkdirSync(root, { recursive: true });
    // Written exactly once. Subsequent locale sessions reuse identical mtimes.
    for (const [filename, source] of Object.entries(sources)) writeFileSync(path.join(root, filename), source);
    const uri = filename => pathToFileURL(path.join(root, filename)).toString();
    const probeSource = sources['probe.c'];
    return {
        root, uri, sources, probeSource,
        changedSource: `${probeSource}int second_probe() { int unused_second = 2; return 1; }\n`,
        fileCount: Object.keys(sources).length,
        configuration: {
            workspaceRoots: [root],
            workspaces: [{ workspaceRoot: root, preprocessorDefines: [],
                enableTypeChecking: true, enableUnusedGlobalVarCheck: true,
                enableUnusedParameterCheck: true, enforceLocalVariableDeclarationAtBlockStart: false,
                resolvedConfig: { includeDirectories: [], globalIncludeFile: null, simulatedEfunFile: null } }]
        }
    };
}

class Session {
    constructor(executable, cacheRoot, timeoutMs) {
        this.timeoutMs = timeoutMs;
        this.events = [];
        this.inbox = new DiagnosticsInbox();
        this.stderrBytes = 0;
        this.child = spawn(executable, [], { cwd: repositoryRoot, windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, LPC_EXTENSION_ROOT: repositoryRoot,
                LPC_INDEX_CACHE_ROOT: cacheRoot, LPC_INDEX_CACHE_VERSION: cacheVersion } });
        this.closed = new Promise(resolve => this.child.once('close', (code, signal) => {
            this.ended = true;
            resolve({ code, signal });
        }));
        this.child.stderr.on('data', bytes => { this.stderrBytes += bytes.length; });
        this.connection = createMessageConnection(new StreamMessageReader(this.child.stdout), new StreamMessageWriter(this.child.stdin));
        this.child.once('error', error => { this.failure = error; this.connection.dispose(); });
        this.connection.onRequest('workspace/semanticTokens/refresh', () => null);
        for (const method of ['lpc/workspaceIndex/ready', 'lpc/workspaceIndex/changed', 'textDocument/publishDiagnostics']) {
            this.connection.onNotification(method, params => {
                this.events.push({ method, params });
                if (method === 'textDocument/publishDiagnostics') this.inbox.accept(params);
            });
        }
        this.connection.listen();
    }

    ensureAlive() {
        if (this.failure) throw new Error(`Owned sidecar failed to start: ${this.failure.message}`);
        if (this.ended) throw new Error('Owned sidecar exited before the smoke completed');
    }

    request(method, params) {
        this.ensureAlive();
        return bounded(this.connection.sendRequest(method, params), this.timeoutMs, method);
    }

    notify(method, params) {
        this.ensureAlive();
        return this.connection.sendNotification(method, params);
    }

    async waitAfter(checkpoint, predicate, stage) {
        const deadline = Date.now() + this.timeoutMs;
        while (Date.now() < deadline) {
            this.ensureAlive();
            const result = predicate(this.events.slice(checkpoint));
            if (result) return result;
            await delay(20);
        }
        throw new Error(`Timed out: ${stage}`);
    }

    async configure(configuration, fixtureCount) {
        const checkpoint = this.events.length;
        await this.notify('lpc/workspaceConfigSync', configuration);
        const event = await this.waitAfter(checkpoint, events => events.find(item => item.method === 'lpc/workspaceIndex/ready'), 'workspace index ready');
        const result = event.params;
        assert.equal(result.status, 'ready', 'Synthetic index must finish');
        assert.equal(result.totalFiles, fixtureCount, 'Index must cover exactly the synthetic fixture');
        assert.equal(result.indexedFiles, fixtureCount, 'All synthetic files must be indexed or restored');
        assert.equal(result.failedFiles, 0, 'Synthetic indexing must not fail');
        assert.equal(result.skippedFiles, 0, 'Synthetic indexing must not skip files');
        assert.ok(Number.isInteger(result.cachedFiles), 'Server must report authoritative cache restoration count');
        // ready is sent after index_roots saves its snapshot; the request also
        // proves the server has returned to the RPC loop before later stages.
        await this.request('lpc/health');
        return result;
    }

    async diagnosticsAfter(checkpoint, uri, version, changedUri, changedCount, stage) {
        return this.waitAfter(checkpoint, events => {
            const changes = events.filter(item => item.method === 'lpc/workspaceIndex/changed' && item.params?.uris?.includes(changedUri));
            const diagnostic = events.find(item => item.method === 'textDocument/publishDiagnostics'
                && item.params.uri === uri && item.params.version === version);
            return changes.length >= changedCount && diagnostic ? diagnostic.params : undefined;
        }, stage);
    }

    killOwned() {
        if (!this.ended) this.child.kill('SIGKILL');
    }

    async stop() {
        let graceful = false;
        let forced = false;
        try {
            if (!this.ended && !this.failure) {
                await bounded(this.connection.sendRequest('shutdown'), 3_000, 'shutdown');
                await this.connection.sendNotification('exit');
                this.child.stdin.end();
                graceful = true;
            }
            await bounded(this.closed, 3_000, 'owned process exit');
        } catch {
            forced = true;
            this.killOwned();
            await bounded(this.closed, 3_000, 'owned process termination');
        } finally {
            this.inbox.dispose();
            this.connection.dispose();
        }
        const exit = await this.closed;
        return { pid: this.child.pid, graceful, forced, exitCode: exit.code, stderrBytes: this.stderrBytes };
    }
}

function facts(diagnostics) {
    return diagnostics.map(({ code, source, range, severity }) => ({ code, source, range, severity }))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function withoutDocumentation(value) {
    if (Array.isArray(value)) return value.map(withoutDocumentation);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
        .filter(([key]) => key !== 'documentation').map(([key, item]) => [key, withoutDocumentation(item)]));
    return value;
}

function verifyUiLanguage(message, locale, stage) {
    assert.ok(typeof message === 'string' && message.length > 0, `${stage} must have display text`);
    assert.equal(/\p{Script=Han}/u.test(message), locale === 'zh-cn', `${stage} must use ${locale}`);
}

function verifyMarkdown(markdown, locale, userText, headings, stage) {
    assert.ok(typeof markdown === 'string' && markdown.length > 0, `${stage} must contain documentation`);
    for (const text of userText) assert.ok(markdown.includes(text), `${stage} must preserve user-authored text`);
    for (const [english, chinese] of headings) {
        const expected = locale === 'zh-cn' ? chinese : english;
        const other = locale === 'zh-cn' ? english : chinese;
        assert.ok(markdown.includes(`**${expected}**`), `${stage} must localize the ${english} heading`);
        assert.ok(!markdown.includes(`\n\n**${other}**\n\n`), `${stage} contains a stale ${other} heading`);
    }
}

async function documentationSnapshot(session, fixture, locale) {
    const uri = fixture.uri('probe.c');
    const positioned = position => ({ textDocument: { uri }, position });
    const tokens = { function: ['documented(1)', 2], macro: ['DOC_MACRO(1)', 3],
        member: ['payload.label', 'payload.'.length + 2], raw: ['RAW_MARKER', 2] };
    const hovers = {};
    for (const [key, [token, inside]] of Object.entries(tokens)) {
        hovers[key] = await session.request('textDocument/hover', positioned(positionAt(fixture.probeSource, token, inside)));
        assert.ok(hovers[key]?.contents?.value, `Closed-index ${key} hover must resolve`);
    }
    verifyMarkdown(hovers.function.contents.value, locale, [body.function, body.parameter, body.returns, body.details, body.note],
        [['Parameters', '参数'], ['Returns', '返回值'], ['Details', '详细说明'], ['Note', '备注']], 'function hover');
    verifyMarkdown(hovers.macro.contents.value, locale, [body.macro, body.macroParameter, body.macroReturns],
        [['Parameters', '参数'], ['Returns', '返回值']], 'cached macro hover');
    verifyMarkdown(hovers.member.contents.value, locale, [body.member, body.memberDetails, body.memberNote],
        [['Details', '详细说明'], ['Note', '备注']], 'cached type-member hover');
    assert.ok(hovers.raw.contents.value.includes(body.raw), 'Raw macro documentation must retain its original Chinese headings');
    const completions = {};
    for (const [key, label] of [['macro', 'DOC_MACRO'], ['member', 'label']]) {
        const [token, inside] = tokens[key];
        const candidates = await session.request('textDocument/completion', positioned(positionAt(fixture.probeSource, token, inside)));
        completions[key] = candidates?.find(item => item.label === label);
        assert.ok(completions[key], `Closed-index ${key} completion must resolve`);
    }
    verifyMarkdown(completions.macro.documentation, locale, [body.macro, body.macroParameter],
        [['Parameters', '参数'], ['Returns', '返回值']], 'cached macro completion');
    verifyMarkdown(completions.member.documentation, locale, [body.member, body.memberNote],
        [['Details', '详细说明'], ['Note', '备注']], 'cached member completion');
    const signature = await session.request('textDocument/signatureHelp', positioned(
        positionAt(fixture.probeSource, 'documented(1)', 'documented('.length)));
    assert.ok(signature?.signatures?.length, 'Function signature help must resolve');
    verifyMarkdown(signature.signatures[0].documentation, locale, [body.function, body.parameter, body.returns],
        [['Parameters', '参数'], ['Returns', '返回值']], 'signature help');
    assert.equal(signature.signatures[0].parameters[0].documentation, body.parameter, 'Parameter description must stay user-authored');
    const efuns = {};
    for (const [name] of efunExamples) {
        const atName = positionAt(fixture.probeSource, `${name}(`, 2);
        const hover = await session.request('textDocument/hover', positioned(atName));
        const candidates = await session.request('textDocument/completion', positioned(atName));
        const completion = candidates?.find(item => item.label === name);
        const help = await session.request('textDocument/signatureHelp', positioned(positionAt(fixture.probeSource, `${name}(`, name.length + 1)));
        const text = JSON.parse(readFileSync(path.join(repositoryRoot, 'config/efun-docs/locales', locale, `${name}.json`), 'utf8'));
        const structure = JSON.parse(readFileSync(path.join(repositoryRoot, 'config/efun-docs/docs', `${name}.json`), 'utf8'));
        assert.ok(hover?.contents?.value && completion && help?.signatures?.length, `${name}: all Efun language routes resolve`);
        same(help.signatures.map(item => item.label), structure.signatures.map(item => item.label), `${name}: unique source signatures`);
        for (const markdown of [hover.contents.value, completion.documentation, ...help.signatures.map(item => item.documentation)]) {
            for (const field of ['summary', 'details', 'note']) {
                if (text[field]) assert.ok(markdown.includes(field === 'note' ? text[field].replaceAll('\n', '\n> ') : text[field]), `${name}/${field}: selected Efun body reaches every language route`);
            }
        }
        efuns[name] = { hover, completion, signature: help };
    }
    return { hovers, completions, signature, efuns };
}

function documentationFacts(snapshot) {
    return {
        hovers: Object.fromEntries(Object.entries(snapshot.hovers).map(([key, hover]) => [key, {
            range: hover.range,
            code: [...hover.contents.value.matchAll(/```lpc\n([\s\S]*?)\n```/gu)].map(match => match[1]),
            links: [...hover.contents.value.matchAll(/\]\(([^)]+)\)/gu)].map(match => match[1])
        }])),
        completions: withoutDocumentation(snapshot.completions),
        signature: withoutDocumentation(snapshot.signature),
        efuns: Object.fromEntries(Object.entries(snapshot.efuns).map(([name, result]) => [name, {
            range: result.hover.range, completion: withoutDocumentation(result.completion),
            signatures: withoutDocumentation(result.signature)
        }]))
    };
}

function quickFixFacts(actions) {
    return actions.map(({ title, diagnostics, ...action }) => ({ ...action,
        diagnostics: diagnostics.map(({ message, ...diagnostic }) => diagnostic) }));
}

function validateDiagnostics(diagnostics, locale, stage) {
    assert.ok(diagnostics.length >= 4, `${stage} must contain known synthetic diagnostics`);
    const codes = new Set(diagnostics.map(item => item.code));
    for (const code of ['unusedGlobalVar', 'unusedParam', 'unusedVar', 'lpc.undefinedFunction']) {
        assert.ok(codes.has(code), `${stage} must include ${code}`);
    }
    for (const diagnostic of diagnostics) verifyUiLanguage(diagnostic.message, locale, `${stage}/${diagnostic.code}`);
}

async function exerciseSession(session, fixture, scenario, first) {
    const locale = scenario.expected;
    const initialize = { processId: process.pid, rootUri: pathToFileURL(fixture.root).toString(),
        capabilities: { workspace: { semanticTokens: { refreshSupport: true } } } };
    if (scenario.locale !== undefined) initialize.locale = scenario.locale;
    const initialized = await session.request('initialize', initialize);
    assert.equal(initialized?.serverInfo?.name, 'lpc-language-server', 'Expected the Rust sidecar');
    await session.notify('initialized', {});
    const initialIndex = await session.configure(fixture.configuration, fixture.fileCount);
    assert.equal(initialIndex.cachedFiles, first ? 0 : fixture.fileCount,
        first ? 'First session must start with an empty private cache' : 'New locale session must restore the entire shared cache');
    // These requests precede didOpen: macro and type-member facts can only come
    // from the closed indexed snapshot, including the warm-cache sessions.
    const beforeQueries = (await session.request('lpc/health')).performance;
    const documentation = await documentationSnapshot(session, fixture, locale);
    const afterQueries = (await session.request('lpc/health')).performance;
    assert.equal(afterQueries.analysisSnapshotBuildCount, beforeQueries.analysisSnapshotBuildCount,
        'Localized documentation queries must reuse the existing indexed snapshots');
    same(afterQueries.syntax, beforeQueries.syntax,
        'Localized documentation queries must not parse source or rebuild syntax');
    const uri = fixture.uri('probe.c');
    await session.notify('textDocument/didOpen', { textDocument: { uri, languageId: 'lpc', version: 1, text: fixture.probeSource } });
    const opened = (await session.inbox.waitFor(uri, 1, session.timeoutMs)).diagnostics;
    validateDiagnostics(opened, locale, 'didOpen');
    await session.notify('textDocument/didChange', { textDocument: { uri, version: 2 }, contentChanges: [{ text: fixture.changedSource }] });
    const changed = (await session.inbox.waitFor(uri, 2, session.timeoutMs)).diagnostics;
    validateDiagnostics(changed, locale, 'didChange');
    assert.ok(changed.length > opened.length, 'didChange must create a genuinely newer diagnostic set');
    const workspace = await session.request('lpc/workspaceDiagnostics', { uriPrefix: uri });
    assert.equal(workspace.length, 1, 'Workspace diagnostics must select the synthetic probe');
    assert.equal(workspace[0].uri, uri, 'Workspace diagnostics must retain the document URI');
    same(workspace[0].diagnostics, changed, 'Workspace and live diagnostics must match, including language');
    const unused = changed.find(item => item.code === 'unusedVar'
        && fixture.changedSource.split('\n')[item.range.start.line].slice(item.range.start.character, item.range.end.character) === 'unused_local');
    assert.ok(unused, 'Quick fix must target the synthetic unused_local declaration');
    const actions = await session.request('textDocument/codeAction', { textDocument: { uri }, range: unused.range,
        context: { diagnostics: [unused] } });
    assert.equal(actions.length, 1, 'Exactly one matching quick fix is expected');
    verifyUiLanguage(actions[0].title, locale, 'quick-fix title');
    assert.ok(actions[0].title.includes('`unused_local`'), 'Quick-fix title must retain symbol identity');
    assert.equal(actions[0].edit?.changes?.[uri]?.[0]?.newText, '_unused_local', 'Quick-fix edit must retain behavior');
    let methodError;
    try { await session.request(unknownMethod, {}); } catch (error) { methodError = error; }
    assert.equal(methodError?.code, -32601, 'Unknown methods must use MethodNotFound');
    assert.ok(methodError.message.includes(unknownMethod), 'MethodNotFound must retain the method identity');
    verifyUiLanguage(methodError.message, locale, 'MethodNotFound');
    await session.request('lpc/health');
    const dependencyUri = fixture.uri('dependency.c');
    let checkpoint = session.events.length;
    // A synthetic watcher event deliberately keeps disk content/mtime fixed.
    // Fresh publication + changed notification prove the asynchronous route;
    // unchanged stamps let every new locale restore the same cached facts.
    await session.notify('lpc/sourceFileChange', { uri: dependencyUri, changeType: 'changed' });
    const watched = (await session.diagnosticsAfter(checkpoint, uri, 2, dependencyUri, 1, 'sourceFileChange background diagnostics')).diagnostics;
    validateDiagnostics(watched, locale, 'sourceFileChange');
    same(watched, changed, 'Watcher refresh must retain the unsaved version and localized diagnostics');
    await session.notify('textDocument/didOpen', { textDocument: { uri: dependencyUri, languageId: 'lpc', version: 1,
        text: 'int dependency_value() { return 3; }\n' } });
    await session.inbox.waitFor(dependencyUri, 1, session.timeoutMs);
    await session.request('lpc/health');
    checkpoint = session.events.length;
    await session.notify('textDocument/didClose', { textDocument: { uri: dependencyUri } });
    const closed = (await session.diagnosticsAfter(checkpoint, uri, 2, dependencyUri, 2, 'didClose background diagnostics')).diagnostics;
    validateDiagnostics(closed, locale, 'didClose');
    same(closed, changed, 'Closing a dependency must preserve the open probe diagnostic language');
    await session.request('lpc/health');
    checkpoint = session.events.length;
    await session.notify('textDocument/didClose', { textDocument: { uri } });
    await session.waitAfter(checkpoint, events => events.filter(item => item.method === 'lpc/workspaceIndex/changed'
        && item.params?.uris?.includes(uri)).length >= 2, 'probe close and disk-index restoration');
    // No editor overlays remain. A final completed configuration index writes
    // the cache snapshot before shutdown; the next session must prove restore.
    const finalIndex = await session.configure(fixture.configuration, fixture.fileCount);
    assert.equal(finalIndex.cachedFiles, fixture.fileCount, 'Unchanged synthetic files must remain cache-restorable');
    return {
        scenario: scenario.name, effectiveLocale: locale,
        serverVersion: initialized.serverInfo.version,
        initialIndex, finalIndex, documentation,
        queryReuse: {
            snapshotBuildsBefore: beforeQueries.analysisSnapshotBuildCount,
            snapshotBuildsAfter: afterQueries.analysisSnapshotBuildCount,
            parsesBefore: beforeQueries.syntax.parseCount,
            parsesAfter: afterQueries.syntax.parseCount
        },
        diagnostics: { didOpen: opened, didChange: changed, workspace: workspace[0].diagnostics,
            sourceFileChange: watched, didClose: closed },
        actions, methodError: { code: methodError.code, message: methodError.message }
    };
}

function compareSessions(baseline, result) {
    for (const stage of Object.keys(baseline.diagnostics)) {
        same(facts(result.diagnostics[stage]), facts(baseline.diagnostics[stage]), `${result.scenario}/${stage} changed diagnostic facts`);
        const actualMessages = result.diagnostics[stage].map(item => item.message);
        const expectedMessages = baseline.diagnostics[stage].map(item => item.message);
        if (result.effectiveLocale === 'en') same(actualMessages, expectedMessages, 'Default and unknown locales must fall back to English');
        else assert.ok(!isDeepStrictEqual(actualMessages, expectedMessages), 'Chinese diagnostics must have a distinct language projection');
    }
    same(quickFixFacts(result.actions), quickFixFacts(baseline.actions), 'Locale must not change quick-fix edits or identity');
    same(documentationFacts(result.documentation), documentationFacts(baseline.documentation), 'Locale must not change documentation source, signature, completion, or navigation facts');
    if (result.effectiveLocale === 'en') {
        same(result.documentation, baseline.documentation, 'English fallback documentation must remain exact after cache restoration');
        assert.equal(result.actions[0].title, baseline.actions[0].title, 'English fallback quick-fix title');
        same(result.methodError, baseline.methodError, 'English fallback MethodNotFound');
    } else {
        assert.notEqual(result.actions[0].title, baseline.actions[0].title, 'Quick-fix titles must be localized');
        assert.notEqual(result.methodError.message, baseline.methodError.message, 'MethodNotFound must be localized');
    }
}

function summary(result) {
    return {
        scenario: result.scenario, effectiveLocale: result.effectiveLocale, serverVersion: result.serverVersion,
        initialIndex: result.initialIndex, finalIndex: result.finalIndex, queryReuse: result.queryReuse,
        diagnosticCounts: Object.fromEntries(Object.entries(result.diagnostics).map(([stage, value]) => [stage, value.length])),
        diagnosticFactFingerprint: digest(JSON.stringify(Object.fromEntries(Object.entries(result.diagnostics).map(([stage, value]) => [stage, facts(value)])))),
        quickFixCount: result.actions.length, checkedHoverKinds: Object.keys(result.documentation.hovers),
        checkedCompletionKinds: Object.keys(result.documentation.completions),
        checkedEfuns: Object.keys(result.documentation.efuns),
        unknownMethodCode: result.methodError.code, lifecycle: result.lifecycle
    };
}

const options = optionsFrom(process.argv.slice(2));
let temporaryRoot;
let activeSession;
let interrupted = false;
const onSignal = () => { interrupted = true; activeSession?.killOwned(); };
process.once('SIGINT', onSignal);
process.once('SIGTERM', onSignal);
const report = { syntheticFixtureOnly: true, passed: false, sessions: [] };
try {
    const binary = checkBinary();
    report.binary = { name: path.basename(binary.executable), sha256: binary.sha256, modifiedAt: binary.modifiedAt };
    temporaryRoot = mkdtempSync(path.join(tmpdir(), 'lpc-rust-localization-'));
    const fixture = fixtureAt(path.join(temporaryRoot, 'workspace'));
    const cacheRoot = path.join(temporaryRoot, 'cache');
    report.fixtureFiles = fixture.fileCount;
    report.cacheVersion = cacheVersion;
    let baseline;
    for (const scenario of [
        { name: 'english-cold', locale: 'en', expected: 'en' },
        { name: 'chinese-warm', locale: 'zh-cn', expected: 'zh-cn' },
        { name: 'missing-locale-warm', expected: 'en' },
        { name: 'unknown-locale-warm', locale: 'fr-FR', expected: 'en' }
    ]) {
        if (interrupted) throw new Error('Interrupted');
        assert.equal(digest(readFileSync(binary.executable)), binary.sha256, 'Sidecar changed between locale sessions');
        console.error(`Rust localization smoke: ${scenario.name}`);
        activeSession = new Session(binary.executable, cacheRoot, options.timeoutMs);
        let result;
        let lifecycle;
        try { result = await exerciseSession(activeSession, fixture, scenario, baseline === undefined); }
        finally { lifecycle = await activeSession.stop(); activeSession = undefined; }
        assert.ok(lifecycle.graceful && !lifecycle.forced && lifecycle.exitCode === 0, 'Owned sidecar must finish shutdown/exit cleanly');
        result.lifecycle = lifecycle;
        if (baseline) compareSessions(baseline, result);
        else baseline = result;
        report.sessions.push(summary(result));
    }
    assert.equal(digest(readFileSync(binary.executable)), binary.sha256, 'Sidecar changed during the smoke');
    report.passed = true;
} catch (error) {
    report.error = String(error.message).replaceAll(temporaryRoot ?? '\0', '<synthetic-fixture>');
    process.exitCode = interrupted ? 130 : 1;
} finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    if (activeSession) await activeSession.stop();
    if (temporaryRoot) {
        const resolved = path.resolve(temporaryRoot);
        assert.ok(path.dirname(resolved) === path.resolve(tmpdir()) && path.basename(resolved).startsWith('lpc-rust-localization-'),
            'Cleanup must remain within the uniquely created temporary root');
        rmSync(resolved, { recursive: true, force: true });
    }
    if (options.reportPath) {
        mkdirSync(path.dirname(options.reportPath), { recursive: true });
        writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));
}
