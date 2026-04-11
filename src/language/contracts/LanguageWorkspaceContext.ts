import type { LpcResolvedConfig } from '../../projectConfig/LpcProjectConfig';
import type { LanguageFeatureServices } from './LanguageFeatureServices';

export interface LanguageWorkspaceProjectConfig {
    projectConfigPath: string;
    configHellPath?: string;
    resolvedConfig?: LpcResolvedConfig;
    lastSyncedAt?: string;
}

export interface LanguageWorkspaceContext {
    workspaceRoot: string;
    projectConfig?: LanguageWorkspaceProjectConfig;
    services?: LanguageFeatureServices;
}
