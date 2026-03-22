import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LpcProjectConfig } from '../LpcProjectConfig';
import { LpcProjectConfigService } from '../LpcProjectConfigService';

describe('LpcProjectConfigService', () => {
    test('project config shape stores configHellPath and resolved fields', () => {
        const config: LpcProjectConfig = {
            version: 1,
            configHellPath: 'config.hell',
            resolved: {
                includeDirectories: ['/include']
            }
        };

        expect(config.version).toBe(1);
        expect(config.configHellPath).toBe('config.hell');
        expect(config.resolved?.includeDirectories).toEqual(['/include']);
    });

    test('loads lpc-support.json, parses config.hell, and rewrites resolved fields', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-'));
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const hellPath = path.join(workspaceRoot, 'config.hell');
        const service = new LpcProjectConfigService();

        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));
        fs.writeFileSync(hellPath, [
            'name : 武侠黎明',
            'include directories : /include',
            'simulated efun file : /adm/single/simul_efun'
        ].join('\n'));

        const result = await service.loadForWorkspace(workspaceRoot);
        const written = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        expect(result?.configHellPath).toBe('config.hell');
        expect(result?.resolved?.includeDirectories).toEqual(['/include']);
        expect(result?.resolved?.simulatedEfunFile).toBe('/adm/single/simul_efun');
        expect(result?.lastSyncedAt).toBeDefined();
        expect(written.resolved.includeDirectories).toEqual(['/include']);
    });

    test('resolves mudlib-relative include and simulated efun paths for consumers', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-resolve-'));
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const hellPath = path.join(workspaceRoot, 'config.hell');
        const service = new LpcProjectConfigService();

        fs.mkdirSync(path.join(workspaceRoot, 'include'));
        fs.mkdirSync(path.join(workspaceRoot, 'adm', 'single'), { recursive: true });
        fs.writeFileSync(path.join(workspaceRoot, 'adm', 'single', 'simul_efun.c'), 'int sim_helper() { return 1; }');
        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell'
        }, null, 2));
        fs.writeFileSync(hellPath, [
            'mudlib directory : ./',
            'include directories : /include',
            'simulated efun file : /adm/single/simul_efun'
        ].join('\n'));

        await service.loadForWorkspace(workspaceRoot);

        await expect(service.getIncludeDirectoriesForWorkspace(workspaceRoot))
            .resolves.toEqual([path.join(workspaceRoot, 'include')]);
        await expect(service.getSimulatedEfunFileForWorkspace(workspaceRoot))
            .resolves.toBe(path.join(workspaceRoot, 'adm', 'single', 'simul_efun.c'));
    });

    test('keeps previous resolved fields when config.hell is missing', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-missing-'));
        const configPath = path.join(workspaceRoot, 'lpc-support.json');
        const service = new LpcProjectConfigService();

        fs.writeFileSync(configPath, JSON.stringify({
            version: 1,
            configHellPath: 'config.hell',
            resolved: {
                includeDirectories: ['/include']
            },
            lastSyncedAt: '2026-03-22T00:00:00.000Z'
        }, null, 2));

        const result = await service.loadForWorkspace(workspaceRoot);

        expect(result?.resolved?.includeDirectories).toEqual(['/include']);
        expect(result?.lastSyncedAt).toBe('2026-03-22T00:00:00.000Z');
    });

    test('returns undefined when project config file does not exist', async () => {
        const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lpc-project-config-none-'));
        const service = new LpcProjectConfigService();

        await expect(service.loadForWorkspace(workspaceRoot)).resolves.toBeUndefined();
    });
});
