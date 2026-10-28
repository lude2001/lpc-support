// Native VS Code acceptance. No implicit runtime download or extension install.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const usage = `Usage: node scripts/run-vscode-localization-test.mjs
  --vscode-executable-path <Code.exe> | --version <explicit-version>
  --extensions-dir <dedicated-directory-with-installed-zh-cn-language-pack>
  [--locale all|en|zh-cn] [--report <json>] [--screenshots-dir <directory>]
  [--timeout-ms <30000..900000>] [--hold] [--hold-timeout-ms <30000..3600000>]
Environment alternatives: VSCODE_EXECUTABLE_PATH, LPC_I18N_EXTENSIONS_DIR.
The runner never installs extensions. --version explicitly permits downloading
that runtime. --hold prints ready/continue marker paths for each owned window;
create the continue file after visual inspection. Default behavior exits itself.`;

function optionsFrom(args) {
    const options = { executable: process.env.VSCODE_EXECUTABLE_PATH,
        extensions: process.env.LPC_I18N_EXTENSIONS_DIR, locale: 'all', timeoutMs: 240_000,
        hold: false, holdTimeoutMs: 900_000 };
    const flags = { '--vscode-executable-path': 'executable', '--version': 'version', '--extensions-dir': 'extensions',
        '--locale': 'locale', '--report': 'report', '--screenshots-dir': 'screenshots',
        '--timeout-ms': 'timeoutMs', '--hold-timeout-ms': 'holdTimeoutMs' };
    for (let index = 0; index < args.length; index++) {
        const flag = args[index];
        if (flag === '--help') { console.log(usage); return undefined; }
        if (flag === '--hold') { options.hold = true; continue; }
        if (!flags[flag]) throw new Error(`Unknown option: ${flag}\n${usage}`);
        const value = args[++index];
        if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
        options[flags[flag]] = value;
    }
    if (options.version && !args.includes('--vscode-executable-path')) options.executable = undefined;
    if (Boolean(options.executable) === Boolean(options.version)) throw new Error('Specify exactly one executable path or explicit version.');
    if (!options.extensions) throw new Error('An explicit dedicated --extensions-dir is required; the normal user extension directory is never used.');
    if (!['all', 'en', 'zh-cn'].includes(options.locale)) throw new Error('--locale must be all, en, or zh-cn');
    for (const [key, max] of [['timeoutMs', 900_000], ['holdTimeoutMs', 3_600_000]]) {
        options[key] = Number(options[key]);
        if (!Number.isInteger(options[key]) || options[key] < 30_000 || options[key] > max) throw new Error(`Invalid ${key}`);
    }
    options.extensions = realpathSync(path.resolve(options.extensions));
    if (options.executable) {
        options.executable = realpathSync(path.resolve(options.executable));
        assert.ok(statSync(options.executable).isFile(), 'VS Code executable must be a file');
    }
    return options;
}

function languagePackIn(directory) {
    const packs = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(directory, entry.name, 'package.json');
        if (!existsSync(manifestPath)) continue;
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const localizations = manifest.contributes?.localizations ?? [];
        assert.ok(localizations.length, `The dedicated directory contains a non-language-pack extension: ${entry.name}`);
        for (const localization of localizations.filter(item => item.languageId?.toLowerCase() === 'zh-cn')) {
            const translation = localization.translations?.find(item => item.id === 'vscode');
            assert.ok(translation?.path, 'Chinese language pack must include the native vscode translation');
            const packRoot = path.dirname(manifestPath);
            const translationPath = path.resolve(packRoot, translation.path);
            assert.ok(isWithin(packRoot, translationPath), 'Language-pack translation must stay inside its own extension');
            const data = JSON.parse(readFileSync(translationPath, 'utf8'));
            const strings = [];
            const collect = value => {
                if (typeof value === 'string' && /\p{Script=Han}/u.test(value)) strings.push(value);
                else if (value && typeof value === 'object') for (const item of Object.values(value)) collect(item);
            };
            collect(data.contents);
            assert.ok(strings.length > 100, 'Chinese native UI translations are missing or incomplete');
            packs.push({ id: `${manifest.publisher}.${manifest.name}`, version: manifest.version,
                manifestPath, nativeStrings: [...new Set(strings)] });
        }
    }
    assert.equal(packs.length, 1, 'Install exactly one compatible zh-cn language pack into the dedicated directory before running');
    return packs[0];
}

function isWithin(parent, child) {
    const relative = path.relative(parent, child);
    return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function freePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(error => error ? reject(error) : resolve(port));
        });
    });
}

function fixtureAt(root) {
    const workspace = path.join(root, 'workspace');
    mkdirSync(path.join(workspace, '.vscode'), { recursive: true });
    writeFileSync(path.join(workspace, 'lpc-support.json'), JSON.stringify({ version: 1, configHellPath: 'config.hell' }));
    writeFileSync(path.join(workspace, 'config.hell'), `name : localization-test\nmudlib directory : ${workspace.replaceAll('\\', '/')}\nsimulated efun file : /simul_efun\n`);
    writeFileSync(path.join(workspace, 'simul_efun.c'), 'int localization_simul() { return 1; }\n');
    const source = [
        '#define HTML_LITERAL "<img src=x onerror=globalThis.__lpcInjected=1>"',
        '/**',
        ' * @brief USER_BODY 中文原文 <img src=x onerror="globalThis.__lpcInjected=1">',
        ' * @param int value USER_PARAM 中文原文.',
        ' * @return USER_RETURN 不翻译.',
        ' */',
        'int documented_value(int value) { return value; }',
        'int needs_documentation_cn(string label) { return 1; }',
        'int needs_documentation_en(string label) { return 2; }',
        'int probe() {',
        '    int unused_locale_probe = 1;',
        '    mixed values = allocate(2);',
        '    string literal = HTML_LITERAL;',
        '    return documented_value(1);',
        '}', ''
    ].join('\n');
    writeFileSync(path.join(workspace, 'localization.c'), source);
    writeFileSync(path.join(workspace, 'snippets.c'), '');
    return workspace;
}

async function killOwned(child, closed) {
    if (closed() || !child.pid) return;
    if (process.platform === 'win32') {
        await new Promise(resolve => {
            const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
            const timer = setTimeout(() => { killer.kill(); child.kill(); resolve(); }, 5000);
            const finish = () => { clearTimeout(timer); resolve(); };
            killer.once('error', finish); killer.once('close', finish);
        });
    } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
}

async function cleanupOwnedRoot(root, reportPath) {
    let cleanup = { status: 'complete' };
    try {
        assert.ok(path.dirname(root) === realpathSync(tmpdir()) || path.dirname(root) === path.resolve(tmpdir()), 'Refuse cleanup outside the temporary directory');
        assert.ok(path.basename(root).startsWith('lpc-localization-vscode-'), 'Refuse cleanup of an unowned root');
        // The owned Electron process has exited, but its children may briefly
        // retain Windows file handles. Wait asynchronously without finding or
        // terminating processes by name, changing ACLs, or expanding the target.
        for (let attempt = 0; ; attempt++) {
            await delay(200 * (attempt + 1));
            try {
                await rm(root, { recursive: true, force: true, maxRetries: 0 });
                break;
            } catch (error) {
                if (attempt >= 5 || !['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES'].includes(error.code)) throw error;
            }
        }
    } catch (error) {
        cleanup = { status: 'incomplete', ownedRoot: root, code: error.code ?? 'CLEANUP_REFUSED', message: error.message };
        console.error(`Owned test directory was not completely removed: ${root} (${cleanup.code}). Original test result is preserved.`);
        process.exitCode = 1;
    }
    // A cleanup warning must never replace the original assertion or its report.
    try {
        if (existsSync(reportPath)) {
            const report = JSON.parse(readFileSync(reportPath, 'utf8'));
            report.cleanup = cleanup;
            writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
        }
    } catch (error) {
        console.error(`Could not append owned-directory cleanup status: ${error.message}`);
    }
}

async function runSession(executable, locale, root, pack, options, prewarm = false) {
    const sessionRoot = path.join(root, prewarm ? 'bootstrap-en' : locale);
    mkdirSync(sessionRoot);
    const workspace = fixtureAt(sessionRoot);
    // The first English launch lets VS Code register the real language pack.
    // A later Chinese launch must read that same owned registry/cache.
    const userData = path.join(root, 'user-data');
    mkdirSync(path.join(userData, 'User'), { recursive: true });
    writeFileSync(path.join(userData, 'User', 'settings.json'), JSON.stringify({
        'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false, 'security.workspace.trust.enabled': false,
        'workbench.startupEditor': 'none', 'window.restoreWindows': 'none',
        'editor.tabCompletion': 'onlySnippets', 'editor.quickSuggestions': false,
        'editor.suggestOnTriggerCharacters': false, 'editor.wordBasedSuggestions': 'off',
        'editor.insertSpaces': true, 'editor.tabSize': 4, 'editor.detectIndentation': false,
        'files.eol': '\n'
    }));
    const debugPort = await freePort();
    const reportPath = path.join(sessionRoot, 'result.json');
    const readyMarker = path.join(sessionRoot, 'ready.json');
    const continueMarker = path.join(sessionRoot, 'continue');
    const configPath = path.join(sessionRoot, 'test-config.json');
    writeFileSync(configPath, JSON.stringify({ locale, workspace, repositoryRoot, debugPort, reportPath, userData,
        extensionsDir: options.extensions, prewarm, pack, hold: options.hold && !prewarm, readyMarker, continueMarker, holdTimeoutMs: options.holdTimeoutMs,
        screenshots: options.screenshots ? path.resolve(options.screenshots, locale) : undefined }));
    if (options.hold && !prewarm) console.log(JSON.stringify({ locale, readyMarker, continueMarker }));
    const env = { ...process.env, LPC_VSCODE_LOCALIZATION_CONFIG: configPath,
        LPC_INDEX_CACHE_ROOT: path.join(sessionRoot, 'cache'), LPC_INDEX_CACHE_VERSION: 'vscode-localization-v1' };
    // Do not borrow another VS Code instance's IPC hooks, locale cache, portable
    // data directory, CLI mode, or automatic debugger preload.
    for (const name of Object.keys(env)) if (name.startsWith('VSCODE_')) delete env[name];
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const child = spawn(executable, [workspace, '--new-window', '--user-data-dir', userData,
        '--extensions-dir', options.extensions, `--locale=${locale}`, '--skip-welcome', '--skip-release-notes',
        '--disable-workspace-trust', '--disable-updates',
        '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`,
        `--extensionDevelopmentPath=${repositoryRoot}`,
        `--extensionTestsPath=${path.join(repositoryRoot, 'tests/vscode-localization/index.cjs')}`],
    { env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: false });
    let ended = false;
    const completed = new Promise((resolve, reject) => {
        child.once('error', error => { ended = true; reject(error); });
        child.once('close', (code, signal) => { ended = true; resolve({ code, signal }); });
    });
    child.stdout.on('data', chunk => process.stdout.write(chunk));
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    const abort = () => { void killOwned(child, () => ended); };
    process.once('SIGINT', abort); process.once('SIGTERM', abort);
    let timer;
    try {
        const result = await Promise.race([completed, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Owned VS Code ${locale} session timed out`)),
                options.timeoutMs + (options.hold && !prewarm ? options.holdTimeoutMs : 0));
        })]);
        if (result.code !== 0) {
            const error = new Error(`Owned VS Code ${locale} failed (${result.signal ?? result.code})`);
            if (existsSync(reportPath)) error.sessionReport = JSON.parse(readFileSync(reportPath, 'utf8'));
            throw error;
        }
        assert.ok(existsSync(reportPath), 'Extension Host did not produce an acceptance report');
        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        assert.equal(report.result, 'passed');
        return report;
    } catch (error) {
        if (!error.sessionReport && existsSync(reportPath)) error.sessionReport = JSON.parse(readFileSync(reportPath, 'utf8'));
        throw error;
    } finally {
        clearTimeout(timer);
        process.removeListener('SIGINT', abort); process.removeListener('SIGTERM', abort);
        await killOwned(child, () => ended);
        await Promise.race([completed.catch(() => {}), new Promise((_, reject) => {
            const cleanupTimer = setTimeout(() => reject(new Error('Owned VS Code did not stop after cleanup')), 10_000);
            completed.finally(() => clearTimeout(cleanupTimer)).catch(() => {});
        })]);
    }
}

async function main() {
    const options = optionsFrom(process.argv.slice(2));
    if (!options) return;
    const pack = languagePackIn(options.extensions);
    for (const resource of ['dist/extension.js', 'dist/templates/functionDocPanel.js', 'l10n/bundle.l10n.zh-cn.json',
        `dist/bin/lpc-language-server${process.platform === 'win32' ? '.exe' : ''}`]) {
        assert.ok(existsSync(path.join(repositoryRoot, resource)), `Build current sources before native acceptance: missing ${resource}`);
    }
    const root = mkdtempSync(path.join(tmpdir(), 'lpc-localization-vscode-'));
    const sessions = [];
    const reportPath = path.resolve(options.report ?? '.tmp/i18n/vscode-localization.json');
    try {
        const executable = options.executable ?? await downloadAndUnzipVSCode({
            version: options.version, cachePath: path.join(root, 'runtime'), extensionDevelopmentPath: repositoryRoot
        });
        const locales = options.locale === 'all' ? ['en', 'zh-cn'] : [options.locale];
        const bootstrap = options.locale === 'zh-cn' ? await runSession(executable, 'en', root, pack, options, true) : undefined;
        for (const locale of locales) sessions.push(await runSession(executable, locale, root, pack, options));
        if (sessions.length === 2) assert.deepEqual(sessions[0].facts, sessions[1].facts, 'UI language changed language-service facts or snippet bodies');
        const result = { result: 'passed', syntheticWorkspaceOnly: true, languagePack: { id: pack.id, version: pack.version }, bootstrap, sessions };
        mkdirSync(path.dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);
        console.log(JSON.stringify({ result: result.result, locales, reportPath }));
    } catch (error) {
        mkdirSync(path.dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, `${JSON.stringify({ result: 'failed', syntheticWorkspaceOnly: true,
            error: error.message, sessions, failedSession: error.sessionReport }, null, 2)}\n`);
        throw error;
    } finally {
        await cleanupOwnedRoot(root, reportPath);
    }
}

await main();
