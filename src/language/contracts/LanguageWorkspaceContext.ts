import type { LpcResolvedConfig } from '../../projectConfig/LpcProjectConfig';
export interface LanguageWorkspaceProjectConfig {
    projectConfigPath: string;
    configHellPath?: string;
    resolvedConfig?: LpcResolvedConfig;
    lastSyncedAt?: string;
}

export interface LanguageWorkspaceContext {
    workspaceRoot: string;
    projectConfig?: LanguageWorkspaceProjectConfig;
}
