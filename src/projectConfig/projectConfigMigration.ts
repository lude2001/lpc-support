import * as vscode from 'vscode';
import type { LPCConfigManager } from '../config';
import type { LpcCompileRemoteServer } from './LpcProjectConfig';
import { LpcProjectConfigService } from './LpcProjectConfigService';

export function hasLegacyProjectSettings(config: vscode.WorkspaceConfiguration): boolean {
    return Boolean(
        config.get<string>('includePath')
        || config.get<string>('simulatedEfunsPath')
    );
}

export async function shouldPromptProjectConfigMigration(
    projectConfigService: LpcProjectConfigService,
    workspaceRoot: string,
    config: vscode.WorkspaceConfiguration
): Promise<boolean> {
    const existingConfig = await projectConfigService.readConfigFile(
        projectConfigService.getProjectConfigPath(workspaceRoot)
    );

    return !existingConfig && hasLegacyProjectSettings(config);
}

export async function migrateProjectConfigForWorkspace(
    projectConfigService: LpcProjectConfigService,
    workspaceRoot: string,
    configHellPath = 'config.hell'
) {
    return projectConfigService.ensureConfigForWorkspace(workspaceRoot, configHellPath);
}

export async function migrateLegacyCompilationConfigForWorkspace(
    projectConfigService: LpcProjectConfigService,
    workspaceRoot: string,
    configManager: Pick<LPCConfigManager, 'getServers' | 'getDefaultServerName'>
) {
    const configPath = projectConfigService.getProjectConfigPath(workspaceRoot);
    const existingConfig = await projectConfigService.readConfigFile(configPath);
    if (!existingConfig) {
        return undefined;
    }

    if (existingConfig.compile?.remote?.servers?.length) {
        return existingConfig;
    }

    const servers = configManager.getServers()
        .map<LpcCompileRemoteServer>(({ name, url, description }) => ({ name, url, description }));

    if (servers.length === 0) {
        return existingConfig;
    }

    const nextConfig = {
        ...existingConfig,
        compile: {
            ...existingConfig.compile,
            mode: existingConfig.compile?.mode ?? 'remote',
            remote: {
                activeServer: existingConfig.compile?.remote?.activeServer ?? configManager.getDefaultServerName(),
                servers
            }
        }
    };

    await projectConfigService.writeConfigFile(configPath, nextConfig);
    return nextConfig;
}
