import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTests } from '@vscode/test-electron';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspacePath = mkdtempSync(path.join(tmpdir(), 'lpc-vscode-lifecycle-'));
const executableName = process.platform === 'win32'
    ? 'lpc-language-server.exe'
    : 'lpc-language-server';
const bundledServerPath = path.join(repositoryRoot, 'dist', 'bin', executableName);
const replacementServerPath = path.join(workspacePath, executableName);

writeFileSync(
    path.join(workspacePath, 'lifecycle.c'),
    '/** Returns the value unchanged. */\nint lifecycle_value(int value) { return value; }\nint probe() { return lifecycle_value(42); }\n',
    'utf8'
);

try {
    await runLifecyclePhase('before-replacement');

    copyFileSync(bundledServerPath, replacementServerPath);
    copyFileSync(replacementServerPath, bundledServerPath);
    console.log(`Replaced bundled sidecar after Extension Host shutdown: ${executableName}`);

    await runLifecyclePhase('after-replacement');
} finally {
    rmSync(workspacePath, { recursive: true, force: true });
}

async function runLifecyclePhase(phase) {
    await runTests({
        extensionDevelopmentPath: repositoryRoot,
        extensionTestsPath: path.join(repositoryRoot, 'tests', 'vscode-lifecycle', 'index.cjs'),
        launchArgs: [
            workspacePath,
            '--disable-extensions',
            '--disable-workspace-trust',
            '--skip-welcome',
            '--skip-release-notes'
        ],
        extensionTestsEnv: {
            ...process.env,
            LPC_LIFECYCLE_WORKSPACE: workspacePath,
            LPC_LIFECYCLE_PHASE: phase
        }
    });
}
