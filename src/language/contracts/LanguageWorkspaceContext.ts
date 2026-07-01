import type {
    InstanceResolutionFunctionMap,
    LpcResolvedConfig
} from '../../projectConfig/LpcProjectConfig';
export interface LanguageWorkspaceProjectConfig {
    projectConfigPath: string;
    configHellPath?: string;
    instanceResolutionFunctions?: InstanceResolutionFunctionMap;
    resolvedConfig?: LpcResolvedConfig;
    lastSyncedAt?: string;
    searchEfunDefinitionInInheritanceChain?: boolean;
}

export interface LanguageTypeCheckingOptions {
    enabled?: boolean;
}

export interface LanguageWorkspaceContext {
    workspaceRoot: string;
    projectConfig?: LanguageWorkspaceProjectConfig;
    typeChecking?: LanguageTypeCheckingOptions;
}
