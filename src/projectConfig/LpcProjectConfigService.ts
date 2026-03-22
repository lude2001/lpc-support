import * as fs from 'fs';
import * as path from 'path';
import { parseConfigHell } from './configHellParser';
import { LpcProjectConfig } from './LpcProjectConfig';

export class LpcProjectConfigService {
    public getProjectConfigPath(workspaceRoot: string): string {
        return path.join(workspaceRoot, 'lpc-support.json');
    }

    public async loadForWorkspace(workspaceRoot: string): Promise<LpcProjectConfig | undefined> {
        const configPath = this.getProjectConfigPath(workspaceRoot);
        const config = await this.readConfigFile(configPath);

        if (!config) {
            return undefined;
        }

        return this.syncForWorkspace(workspaceRoot, config);
    }

    public async syncForWorkspace(
        workspaceRoot: string,
        config?: LpcProjectConfig
    ): Promise<LpcProjectConfig | undefined> {
        const configPath = this.getProjectConfigPath(workspaceRoot);
        const loadedConfig = config ?? await this.readConfigFile(configPath);

        if (!loadedConfig) {
            return undefined;
        }

        const configHellPath = path.join(workspaceRoot, loadedConfig.configHellPath);
        if (!fs.existsSync(configHellPath)) {
            return loadedConfig;
        }

        try {
            const source = await fs.promises.readFile(configHellPath, 'utf8');
            const resolved = parseConfigHell(source);
            const nextConfig: LpcProjectConfig = {
                ...loadedConfig,
                resolved,
                lastSyncedAt: new Date().toISOString()
            };

            await this.writeConfigFile(configPath, nextConfig);
            return nextConfig;
        } catch {
            return loadedConfig;
        }
    }

    public async readConfigFile(configPath: string): Promise<LpcProjectConfig | undefined> {
        if (!fs.existsSync(configPath)) {
            return undefined;
        }

        try {
            const raw = await fs.promises.readFile(configPath, 'utf8');
            return JSON.parse(raw) as LpcProjectConfig;
        } catch {
            return undefined;
        }
    }

    public async writeConfigFile(configPath: string, config: LpcProjectConfig): Promise<void> {
        await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    }
}
