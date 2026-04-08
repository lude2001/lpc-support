import { spawnSync } from 'child_process';

const LPCPRJ_COMMAND = 'lpcprj';
export function hasLpcprjCommand(): boolean {
    const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(lookupCommand, [LPCPRJ_COMMAND], { stdio: 'ignore' });
    return result.status === 0;
}

export function getLpcprjStartCommand(configPath: string): string {
    return `${LPCPRJ_COMMAND} "${configPath}"`;
}
