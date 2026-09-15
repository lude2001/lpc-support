import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const cargo = resolveCargo();
const result = spawnSync(cargo, process.argv.slice(2), {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: process.env,
    stdio: 'inherit'
});

if (result.error) {
    throw result.error;
}
process.exit(result.status ?? 1);

function resolveCargo() {
    if (process.env.CARGO) {
        return process.env.CARGO;
    }

    const executableName = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
    const userCargo = path.join(homedir(), '.cargo', 'bin', executableName);
    return existsSync(userCargo) ? userCargo : executableName;
}
