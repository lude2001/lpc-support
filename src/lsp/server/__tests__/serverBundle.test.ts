import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const repositoryRoot = path.resolve(__dirname, '..', '..', '..', '..');
const serverBundlePath = path.join(repositoryRoot, 'dist', 'lsp', 'server.js');

describe('production LSP server bundle', () => {
    test('does not leave a runtime require("vscode") in the built server bundle', () => {
        const build = spawnSync(process.execPath, ['esbuild.mjs'], {
            cwd: repositoryRoot,
            env: {
                ...process.env,
                NODE_ENV: 'development'
            },
            encoding: 'utf8'
        });
        if (build.status !== 0) {
            throw new Error(build.stderr || build.stdout || 'esbuild.mjs failed');
        }

        const bundle = fs.readFileSync(serverBundlePath, 'utf8');

        expect(bundle).not.toContain('require("vscode")');
        expect(bundle).not.toContain("require('vscode')");
        expect(bundle).not.toMatch(/\brequire\s*\(\s*["']vscode["']\s*\)/);
        expect(bundle).not.toMatch(/\bmodule\.require\s*\(\s*["']vscode["']\s*\)/);
        expect(build.stderr).not.toContain('Import "ViewColumn" will always be undefined');
    }, 60_000);
});
