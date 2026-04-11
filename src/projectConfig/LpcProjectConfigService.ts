import * as fs from 'fs';
import * as path from 'path';
import { parseConfigHell } from './configHellParser';
import {
    LpcCompileConfig,
    LpcProjectConfig,
    LpcResolvedConfig
} from './LpcProjectConfig';

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

        const configHellPath = this.resolveWorkspacePath(workspaceRoot, loadedConfig.configHellPath);
        if (!fs.existsSync(configHellPath)) {
            return loadedConfig;
        }

        try {
            const source = await fs.promises.readFile(configHellPath, 'utf8');
            const resolved = parseConfigHell(source);
            const hasResolvedChanged = !this.areResolvedConfigsEqual(loadedConfig.resolved, resolved);
            if (!hasResolvedChanged) {
                return loadedConfig;
            }

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

    public async getCompileConfigForWorkspace(workspaceRoot: string): Promise<LpcCompileConfig | undefined> {
        const configPath = this.getProjectConfigPath(workspaceRoot);
        const existing = await this.readConfigFile(configPath);

        if (!existing) {
            return undefined;
        }

        const ensured = this.ensureCompileConfig(existing);
        if (ensured !== existing) {
            await this.writeConfigFile(configPath, ensured);
        }

        return ensured.compile;
    }

    public async updateCompileConfigForWorkspace(
        workspaceRoot: string,
        updater: (compileConfig: LpcCompileConfig) => LpcCompileConfig
    ): Promise<LpcProjectConfig | undefined> {
        const configPath = this.getProjectConfigPath(workspaceRoot);
        const existing = await this.readConfigFile(configPath);

        if (!existing) {
            return undefined;
        }

        const ensured = this.ensureCompileConfig(existing);
        const nextConfig: LpcProjectConfig = {
            ...ensured,
            compile: updater(ensured.compile ?? { remote: { servers: [] } })
        };

        await this.writeConfigFile(configPath, nextConfig);
        return nextConfig;
    }

    public async updateResolvedConfigForWorkspace(
        workspaceRoot: string,
        updater: (resolvedConfig: LpcResolvedConfig) => LpcResolvedConfig
    ): Promise<LpcProjectConfig | undefined> {
        const configPath = this.getProjectConfigPath(workspaceRoot);
        const existing = await this.readConfigFile(configPath);

        if (!existing) {
            return undefined;
        }

        const nextConfig: LpcProjectConfig = {
            ...existing,
            resolved: updater(existing.resolved ?? {})
        };

        await this.writeConfigFile(configPath, nextConfig);
        return nextConfig;
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

        return this.resolveExistingCodePath(
            this.resolveMudlibPath(workspaceRoot, resolved, resolved.simulatedEfunFile)
        );
    }

    private resolveMudlibPath(workspaceRoot: string, resolved: LpcResolvedConfig, targetPath: string): string {
        const mudlibDirectory = resolved.mudlibDirectory ?? '.';
        const mudlibRoot = this.resolveWorkspacePath(workspaceRoot, mudlibDirectory);

        if (/^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\')) {
            return targetPath;
        }

        if (targetPath.startsWith('/')) {
            return path.join(mudlibRoot, targetPath.slice(1));
        }

        return path.resolve(mudlibRoot, targetPath);
    }

    public resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
        if (this.isAbsolutePath(targetPath)) {
            return targetPath;
        }

        return path.resolve(workspaceRoot, targetPath);
    }

    public toWorkspaceRelativePath(workspaceRoot: string, targetPath: string): string {
        if (!targetPath) {
            return targetPath;
        }

        const relativePath = path.relative(workspaceRoot, targetPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return targetPath;
        }

        return relativePath || '.';
    }

    private resolveExistingCodePath(targetPath: string): string {
        if (fs.existsSync(targetPath)) {
            return targetPath;
        }

        if (path.extname(targetPath)) {
            return targetPath;
        }

        const candidates = [`${targetPath}.c`, `${targetPath}.h`];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return targetPath;
    }

    private ensureCompileConfig(config: LpcProjectConfig): LpcProjectConfig {
        if (config.compile?.remote?.servers) {
            return config;
        }

        const nextCompile: LpcCompileConfig = {
            ...config.compile,
            remote: {
                ...config.compile?.remote,
                servers: config.compile?.remote?.servers ?? []
            }
        };

        return {
            ...config,
            compile: nextCompile
        };
    }

    private isAbsolutePath(targetPath: string): boolean {
        return /^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\');
    }

    private areResolvedConfigsEqual(
        left: LpcResolvedConfig | undefined,
        right: LpcResolvedConfig | undefined
    ): boolean {
        return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
    }
}
