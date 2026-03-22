import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LpcProjectConfigService } from '../LpcProjectConfigService';
import {
    hasLegacyProjectSettings,
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
});
