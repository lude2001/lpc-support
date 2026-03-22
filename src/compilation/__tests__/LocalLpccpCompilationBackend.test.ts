import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { LocalLpccpCompilationBackend } from '../LocalLpccpCompilationBackend';

jest.mock('child_process', () => ({
    spawn: jest.fn()
}));

function createSpawnProcess(exitCode: number, stdout = '', stderr = '') {
    const process = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
    };
    process.stdout = new EventEmitter();
    process.stderr = new EventEmitter();

    global.process.nextTick(() => {
        if (stdout) {
            process.stdout.emit('data', Buffer.from(stdout));
        }

        if (stderr) {
            process.stderr.emit('data', Buffer.from(stderr));
        }

        process.emit('close', exitCode);
    });

    return process;
}

describe('LocalLpccpCompilationBackend', () => {
    beforeEach(() => {
        (spawn as jest.Mock).mockReset();
    });

    test('uses lpccp from PATH when system command is enabled', async () => {
        const backend = new LocalLpccpCompilationBackend();
        (spawn as jest.Mock).mockReturnValue(createSpawnProcess(0, JSON.stringify({
            version: 1,
            ok: true,
            kind: 'file',
            target: '/single/master.c',
            diagnostics: [],
            files_total: 0,
            files_ok: 0,
            files_failed: 0,
            results: []
        })));

        await backend.compile({
            workspaceRoot: 'D:/mud',
            targetKind: 'file',
            targetPath: '/single/master.c',
            localConfig: {
                useSystemCommand: true,
                driverConfigPath: 'D:/mud/etc/config.test'
            }
        });

        expect(spawn).toHaveBeenCalledWith(
            'lpccp',
            ['D:/mud/etc/config.test', '/single/master.c'],
            expect.objectContaining({ cwd: 'D:/mud' })
        );
    });

    test('uses explicit lpccp path when system command is disabled', async () => {
        const backend = new LocalLpccpCompilationBackend();
        (spawn as jest.Mock).mockReturnValue(createSpawnProcess(0, JSON.stringify({
            version: 1,
            ok: true,
            kind: 'file',
            target: '/single/master.c',
            diagnostics: [],
            files_total: 0,
            files_ok: 0,
            files_failed: 0,
            results: []
        })));

        await backend.compile({
            workspaceRoot: 'D:/mud',
            targetKind: 'file',
            targetPath: '/single/master.c',
            localConfig: {
                useSystemCommand: false,
                lpccpPath: 'D:/tools/lpccp.exe',
                driverConfigPath: 'D:/mud/etc/config.test'
            }
        });

        expect(spawn).toHaveBeenCalledWith(
            'D:/tools/lpccp.exe',
            ['D:/mud/etc/config.test', '/single/master.c'],
            expect.objectContaining({ cwd: 'D:/mud' })
        );
    });

    test('returns parsed JSON when compile exits with code 1', async () => {
        const backend = new LocalLpccpCompilationBackend();
        (spawn as jest.Mock).mockReturnValue(createSpawnProcess(1, JSON.stringify({
            version: 1,
            ok: false,
            kind: 'file',
            target: '/single/bad.c',
            diagnostics: [
                { severity: 'error', file: '/single/bad.c', line: 12, message: 'syntax error' }
            ],
            files_total: 0,
            files_ok: 0,
            files_failed: 0,
            results: []
        })));

        const result = await backend.compile({
            workspaceRoot: 'D:/mud',
            targetKind: 'file',
            targetPath: '/single/bad.c',
            localConfig: {
                useSystemCommand: true,
                driverConfigPath: 'D:/mud/etc/config.test'
            }
        });

        expect(result.ok).toBe(false);
        expect(result.diagnostics).toHaveLength(1);
    });

    test('throws request-level failure when lpccp exits with code 2', async () => {
        const backend = new LocalLpccpCompilationBackend();
        (spawn as jest.Mock).mockReturnValue(createSpawnProcess(
            2,
            '',
            'Error: cannot connect to compile service pipe'
        ));

        await expect(backend.compile({
            workspaceRoot: 'D:/mud',
            targetKind: 'file',
            targetPath: '/single/master.c',
            localConfig: {
                useSystemCommand: true,
                driverConfigPath: 'D:/mud/etc/config.test'
            }
        })).rejects.toThrow('cannot connect to compile service pipe');
    });

    test('throws clear error when stdout is not valid JSON', async () => {
        const backend = new LocalLpccpCompilationBackend();
        (spawn as jest.Mock).mockReturnValue(createSpawnProcess(0, 'not-json'));

        await expect(backend.compile({
            workspaceRoot: 'D:/mud',
            targetKind: 'file',
            targetPath: '/single/master.c',
            localConfig: {
                useSystemCommand: true,
                driverConfigPath: 'D:/mud/etc/config.test'
            }
        })).rejects.toThrow('lpccp returned invalid JSON');
    });
});
