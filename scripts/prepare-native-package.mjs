import { existsSync } from 'fs';
import path from 'path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const executableName = process.platform === 'win32'
    ? 'lpc-language-server.exe'
    : 'lpc-language-server';
const nativeServer = path.join(repositoryRoot, 'dist', 'bin', executableName);
if (!existsSync(nativeServer)) {
    throw new Error(`Native LPC language server is missing at ${nativeServer}`);
}
if (!existsSync(`${nativeServer}.sha256`)) {
    throw new Error(`Native LPC language server checksum is missing at ${nativeServer}.sha256`);
}
