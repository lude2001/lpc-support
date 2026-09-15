import { createHash } from 'crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const rustRoot = path.join(repositoryRoot, 'rust');
const executableName = process.platform === 'win32'
    ? 'lpc-language-server.exe'
    : 'lpc-language-server';
const cargo = resolveCargo();

const build = spawnSync(cargo, [
    'build',
    '--manifest-path',
    path.join(rustRoot, 'Cargo.toml'),
    '--package',
    'lpc-language-server',
    '--release'
], {
    cwd: repositoryRoot,
    env: process.env,
    stdio: 'inherit'
});

if (build.error) {
    throw build.error;
}
if (build.status !== 0) {
    process.exit(build.status ?? 1);
}

const source = path.join(rustRoot, 'target', 'release', executableName);
const destination = path.join(repositoryRoot, 'dist', 'bin', executableName);
if (!existsSync(source)) {
    throw new Error(`Cargo succeeded but did not create ${source}`);
}

mkdirSync(path.dirname(destination), { recursive: true });
copyFileSync(source, destination);
if (process.platform !== 'win32') {
    chmodSync(destination, 0o755);
}
const sha256 = createHash('sha256').update(readFileSync(destination)).digest('hex');
writeFileSync(`${destination}.sha256`, `${sha256}  ${executableName}\n`, 'utf8');
console.log(`Rust LSP: ${destination}`);
console.log(`SHA-256: ${sha256}`);

function resolveCargo() {
    if (process.env.CARGO) {
        return process.env.CARGO;
    }

    const userCargo = path.join(homedir(), '.cargo', 'bin', process.platform === 'win32' ? 'cargo.exe' : 'cargo');
    return existsSync(userCargo) ? userCargo : 'cargo';
}
