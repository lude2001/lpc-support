import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createServer } from 'net';
import { runTests } from '@vscode/test-electron';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const testRoot = mkdtempSync(path.join(tmpdir(), 'lpc-navigation-vscode-'));
const workspace = path.join(testRoot, 'workspace');
const debugPort = await new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        server.close(() => resolve(port));
    });
});
mkdirSync(workspace);
writeFileSync(path.join(workspace, 'lpc-support.json'), JSON.stringify({ version: 1, configHellPath: 'config.hell' }));
writeFileSync(path.join(workspace, 'config.hell'), `name : navigation-test\nmudlib directory : ${workspace.replaceAll('\\', '/')}\nsimulated efun file : /simul_efun\n`);
writeFileSync(path.join(workspace, 'macros.h'), '#define FEATURE 1\n');
writeFileSync(path.join(workspace, 'simul_efun.c'), 'int navigation_simul() { return 1; }\n');
writeFileSync(path.join(workspace, 'closed.c'), 'int navigation_closed() { return 1; }\n');
writeFileSync(path.join(workspace, 'navigation.c'), '#include "macros.h"\n#if FEATURE\nint navigation_enabled;\n#else\nint navigation_disabled;\n#endif\nint navigation_probe(int value) { value++; return value; }\nint other_probe(int value) { return value; }\n');

try {
    await runTests({
        ...(process.env.VSCODE_EXECUTABLE_PATH ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH } : {}),
        extensionDevelopmentPath: repositoryRoot,
        extensionTestsPath: path.join(repositoryRoot, 'tests', 'vscode-navigation', 'index.cjs'),
        launchArgs: [workspace, '--new-window', '--user-data-dir', path.join(testRoot, 'user-data'),
            '--extensions-dir', path.join(testRoot, 'extensions'), '--disable-extensions',
            `--remote-debugging-port=${debugPort}`,
            '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--disable-updates'],
        extensionTestsEnv: { ...process.env, LPC_NAVIGATION_WORKSPACE: workspace, LPC_NAVIGATION_DEBUG_PORT: String(debugPort) }
    });
} finally {
    // All paths are descendants of this runner's freshly allocated temporary root.
    rmSync(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
