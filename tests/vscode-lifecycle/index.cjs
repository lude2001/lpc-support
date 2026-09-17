const assert = require('assert');
const { execFile } = require('child_process');
const path = require('path');
const vscode = require('vscode');

const SERVER_PROCESS_NAME = process.platform === 'win32'
    ? 'lpc-language-server.exe'
    : 'lpc-language-server';
const TEST_TIMEOUT_MS = 45_000;
const STRESS_ITERATIONS = Number(process.env.LPC_LIFECYCLE_STRESS_ITERATIONS ?? 400);
const MAX_RESIDENT_GROWTH_BYTES = 64 * 1024 * 1024;

async function run() {
    const workspacePath = process.env.LPC_LIFECYCLE_WORKSPACE;
    assert.ok(workspacePath, 'LPC_LIFECYCLE_WORKSPACE must be set by the test runner.');

    const pidsBeforeActivation = await listServerPids();
    const document = await vscode.workspace.openTextDocument(path.join(workspacePath, 'lifecycle.c'));
    await vscode.window.showTextDocument(document);

    const extension = vscode.extensions.getExtension('ludexiang.lpc-support');
    assert.ok(extension, 'The LPC Support development extension was not loaded.');
    await extension.activate();

    const callPosition = new vscode.Position(2, 23);
    const firstHover = await waitForHover(document.uri, callPosition);
    assert.match(markdownText(firstHover.contents), /lifecycle_value/);

    const activatedPids = await waitFor(async () => {
        const current = await listServerPids();
        const created = current.filter(pid => !pidsBeforeActivation.includes(pid));
        return created.length === 1 ? created : undefined;
    }, TEST_TIMEOUT_MS, 'one isolated Rust sidecar process to start');

    const crashedPid = activatedPids[0];
    process.kill(crashedPid);

    const restartedPid = await waitFor(async () => {
        const current = await listServerPids();
        const restarted = current.filter(pid => pid !== crashedPid && !pidsBeforeActivation.includes(pid));
        return restarted.length === 1 ? restarted[0] : undefined;
    }, TEST_TIMEOUT_MS, 'the LanguageClient to restart the Rust sidecar');

    const recoveredHover = await waitForHover(document.uri, callPosition);
    assert.match(markdownText(recoveredHover.contents), /lifecycle_value/);

    const stressStartedAt = Date.now();
    const processSamples = [];
    for (let iteration = 0; iteration < STRESS_ITERATIONS; iteration += 1) {
        const edit = new vscode.WorkspaceEdit();
        const lastLine = document.lineAt(document.lineCount - 1);
        if (iteration % 2 === 0) {
            edit.insert(document.uri, lastLine.range.end, ' ');
        } else {
            edit.delete(document.uri, new vscode.Range(
                lastLine.range.end.translate(0, -1),
                lastLine.range.end
            ));
        }
        assert.strictEqual(await vscode.workspace.applyEdit(edit), true);

        if ((iteration + 1) % 25 === 0) {
            const hover = await waitForHover(document.uri, callPosition);
            assert.match(markdownText(hover.contents), /lifecycle_value/);
            const sample = await readProcessSample(restartedPid);
            if (sample) {
                processSamples.push(sample);
            }
        }
    }

    const residentGrowth = processSamples.length > 1
        ? processSamples.at(-1).residentBytes - processSamples[0].residentBytes
        : 0;
    assert.ok(
        residentGrowth <= MAX_RESIDENT_GROWTH_BYTES,
        `Rust sidecar resident memory grew by ${residentGrowth} bytes during VS Code edit stress.`
    );
    const cpuSeconds = processSamples.length > 1
        ? processSamples.at(-1).cpuSeconds - processSamples[0].cpuSeconds
        : 0;
    console.log([
        `VS Code lifecycle phase ${process.env.LPC_LIFECYCLE_PHASE ?? 'default'} passed`,
        `(sidecar ${crashedPid} -> ${restartedPid}).`,
        `${STRESS_ITERATIONS} edits stayed responsive in ${Date.now() - stressStartedAt}ms.`,
        `Resident growth ${residentGrowth} bytes; sampled CPU ${cpuSeconds.toFixed(3)}s.`
    ].join(' '));
}

async function waitForHover(uri, position) {
    return waitFor(async () => {
        try {
            const hovers = await vscode.commands.executeCommand(
                'vscode.executeHoverProvider',
                uri,
                position
            );
            return Array.isArray(hovers) && hovers.length > 0 ? hovers[0] : undefined;
        } catch {
            return undefined;
        }
    }, TEST_TIMEOUT_MS, 'LPC hover to become available');
}

async function waitFor(probe, timeoutMs, description) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = await probe();
        if (result !== undefined) {
            return result;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for ${description}.`);
}

async function listServerPids() {
    if (process.platform === 'win32') {
        const script = [
            `$ErrorActionPreference = 'Stop';`,
            `@(Get-Process -Name '${SERVER_PROCESS_NAME.replace(/\.exe$/i, '')}' -ErrorAction SilentlyContinue)`,
            `| ForEach-Object { $_.Id }`
        ].join(' ');
        const output = await execFileText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
        return output.split(/\r?\n/).map(value => Number(value.trim())).filter(Number.isInteger);
    }

    const output = await execFileText('pgrep', ['-x', SERVER_PROCESS_NAME], true);
    return output.split(/\r?\n/).map(value => Number(value.trim())).filter(Number.isInteger);
}

function execFileText(command, args, allowFailure = false) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { encoding: 'utf8' }, (error, stdout) => {
            if (error && !allowFailure) {
                reject(error);
                return;
            }
            resolve(stdout ?? '');
        });
    });
}

async function readProcessSample(pid) {
    if (process.platform === 'win32') {
        const script = [
            `$process = Get-Process -Id ${pid} -ErrorAction Stop;`,
            `[Console]::WriteLine(('{0},{1}' -f $process.WorkingSet64, $process.CPU))`
        ].join(' ');
        const output = await execFileText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
        const [residentBytes, cpuSeconds] = output.trim().split(',').map(Number);
        return Number.isFinite(residentBytes) && Number.isFinite(cpuSeconds)
            ? { residentBytes, cpuSeconds }
            : undefined;
    }

    const output = await execFileText('ps', ['-o', 'rss=', '-p', String(pid)], true);
    const residentKilobytes = Number(output.trim());
    return Number.isFinite(residentKilobytes)
        ? { residentBytes: residentKilobytes * 1024, cpuSeconds: 0 }
        : undefined;
}

function markdownText(contents) {
    return contents.map(content => typeof content === 'string' ? content : content.value).join('\n');
}

module.exports = { run };
