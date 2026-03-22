import * as vscode from 'vscode';
import { LpcProjectConfigService } from './LpcProjectConfigService';

export function hasLegacyProjectSettings(config: vscode.WorkspaceConfiguration): boolean {
    return Boolean(
        config.get<string>('includePath')
        || config.get<string>('simulatedEfunsPath')
        || config.get<string>('driver.command')
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
