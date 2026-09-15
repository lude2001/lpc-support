import { spawnSync } from 'child_process';
import path from 'path';

const target = platformTarget(process.platform, process.arch);
const vsce = path.resolve(import.meta.dirname, '..', 'node_modules', '@vscode', 'vsce', 'vsce');
const result = spawnSync(process.execPath, [vsce, 'package', '--target', target], {
    env: process.env,
    stdio: 'inherit'
});

if (result.error) {
    throw result.error;
}
process.exit(result.status ?? 1);

function platformTarget(platform, architecture) {
    const platformName = {
        win32: 'win32',
        linux: 'linux',
        darwin: 'darwin'
    }[platform];
    const architectureName = {
        x64: 'x64',
        arm64: 'arm64'
    }[architecture];
    if (!platformName || !architectureName) {
        throw new Error(`Unsupported VSIX platform: ${platform}-${architecture}`);
    }
    return `${platformName}-${architectureName}`;
}
