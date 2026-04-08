import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LpcProjectConfigService } from '../LpcProjectConfigService';
import {
    hasLegacyProjectSettings,
    migrateLegacyCompilationConfigForWorkspace,
    migrateProjectConfigForWorkspace,
    shouldPromptProjectConfigMigration
} from '../projectConfigMigration';

describe('projectConfigMigration', () => {
    test('detects legacy lpc settings used by current project', () => {
        const config = {
            get: jest.fn((key: string) => {
                if (key === 'includePath') {
                    return 'include';
                }

                return undefined;
            })
        } as any;

        expect(hasLegacyProjectSettings(config)).toBe(true);
    });

    test('prompts for migration when legacy settings exist and lpc-support.json is missing', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-migration-'));
        const service = new LpcProjectConfigService();
        const config = {
            get: jest.fn((key: string) => key === 'simulatedEfunsPath' ? 'adm/single/simul_efun' : undefined)
        } as any;

        await expect(shouldPromptProjectConfigMigration(service, workspaceRoot, config)).resolves.toBe(true);
    });

    test('does not treat legacy driver startup setting as a migration source anymore', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-driver-startup-'));
        const service = new LpcProjectConfigService();
        const config = {
            get: jest.fn((key: string) => key === 'driver.command' ? 'driver.exe --boot' : undefined)
        } as any;

        expect(hasLegacyProjectSettings(config)).toBe(false);
        await expect(shouldPromptProjectConfigMigration(service, workspaceRoot, config)).resolves.toBe(false);
    });

    test('creates lpc-support.json and syncs resolved fields during migration', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-migrate-run-'));
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const hellPath = path.join(workspaceRoot, 'config.hell');
        const service = new LpcProjectConfigService();

        fs.writeFileSync(hellPath, [
            'include directories : /include',
            'simulated efun file : /adm/single/simul_efun'
        ].join('\n'));

        const result = await migrateProjectConfigForWorkspace(service, workspaceRoot);
        const written = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        expect(result.configHellPath).toBe('config.hell');
        expect(result.resolved?.includeDirectories).toEqual(['/include']);
        expect(written.resolved.includeDirectories).toEqual(['/include']);
    });

    test('migrates legacy remote compilation servers into project config', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-compile-migrate-'));
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const service = new LpcProjectConfigService();
        const legacyConfigManager = {
            getServers: jest.fn().mockReturnValue([
                { name: 'Alpha', url: 'http://127.0.0.1:8080', description: 'local', active: true },
                { name: 'Beta', url: 'http://127.0.0.1:8081', description: 'backup', active: false }
            ]),
            getDefaultServerName: jest.fn().mockReturnValue('Alpha')
        };

        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));

        const result = await migrateLegacyCompilationConfigForWorkspace(
            service,
            workspaceRoot,
            legacyConfigManager as any
        );
        const written = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        expect(result?.compile?.mode).toBe('remote');
        expect(result?.compile?.remote?.activeServer).toBe('Alpha');
        expect(result?.compile?.remote?.servers).toEqual([
            { name: 'Alpha', url: 'http://127.0.0.1:8080', description: 'local' },
            { name: 'Beta', url: 'http://127.0.0.1:8081', description: 'backup' }
        ]);
        expect(written.compile.remote.servers).toHaveLength(2);
    });
});
