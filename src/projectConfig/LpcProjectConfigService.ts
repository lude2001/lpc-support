import * as fs from 'fs';
import * as path from 'path';
import { parseConfigHell } from './configHellParser';
import { LpcProjectConfig, LpcResolvedConfig } from './LpcProjectConfig';

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

    public async ensureConfigForWorkspace(
        workspaceRoot: string,
        configHellPath = 'config.hell'
    ): Promise<LpcProjectConfig> {
        const configPath = this.getProjectConfigPath(workspaceRoot);
        const existing = await this.readConfigFile(configPath);

        if (existing) {
            const synced = await this.syncForWorkspace(workspaceRoot, existing);
            return synced ?? existing;
        }

        const created: LpcProjectConfig = {
            version: 1,
            configHellPath
        };
        await this.writeConfigFile(configPath, created);

        const synced = await this.syncForWorkspace(workspaceRoot, created);
        return synced ?? created;
    }

    public async getResolvedForWorkspace(workspaceRoot: string): Promise<LpcResolvedConfig | undefined> {
        const config = await this.loadForWorkspace(workspaceRoot);
        return config?.resolved;
    }

    public async getIncludeDirectoriesForWorkspace(workspaceRoot: string): Promise<string[] | undefined> {
        const resolved = await this.getResolvedForWorkspace(workspaceRoot);
        if (!resolved?.includeDirectories?.length) {
            return undefined;
        }

        return resolved.includeDirectories.map((entry) => this.resolveMudlibPath(workspaceRoot, resolved, entry));
    }

    public async getPrimaryIncludeDirectoryForWorkspace(workspaceRoot: string): Promise<string | undefined> {
        return (await this.getIncludeDirectoriesForWorkspace(workspaceRoot))?.[0];
    }

    public async getSimulatedEfunFileForWorkspace(workspaceRoot: string): Promise<string | undefined> {
        const resolved = await this.getResolvedForWorkspace(workspaceRoot);
        if (!resolved?.simulatedEfunFile) {
            return undefined;
        }

        return this.resolveMudlibPath(workspaceRoot, resolved, resolved.simulatedEfunFile);
    }

    private resolveMudlibPath(workspaceRoot: string, resolved: LpcResolvedConfig, targetPath: string): string {
        const mudlibDirectory = resolved.mudlibDirectory ?? '.';
        const mudlibRoot = this.resolveWorkspaceRelativePath(workspaceRoot, mudlibDirectory);

        if (/^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\')) {
            return targetPath;
        }

        if (targetPath.startsWith('/')) {
            return path.join(mudlibRoot, targetPath.slice(1));
        }

        return path.resolve(mudlibRoot, targetPath);
    }

    private resolveWorkspaceRelativePath(workspaceRoot: string, targetPath: string): string {
        if (/^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\')) {
            return targetPath;
        }

        return path.resolve(workspaceRoot, targetPath);
    }
}
