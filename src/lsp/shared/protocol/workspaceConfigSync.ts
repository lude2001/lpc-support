import { NotificationType } from 'vscode-languageserver/node';
import type {
    InstanceResolutionFunctionMap,
    LpcResolvedConfig,
    PreprocessorDefineList
} from '../../../projectConfig/LpcProjectConfig';

export const WORKSPACE_CONFIG_SYNC_NOTIFICATION = 'lpc/workspaceConfigSync';

export interface WorkspaceConfigSyncSnapshot {
    workspaceRoot: string;
    projectConfigPath: string;
    configHellPath?: string;
    preprocessorDefines?: PreprocessorDefineList;
    instanceResolutionFunctions?: InstanceResolutionFunctionMap;
    resolvedConfig?: LpcResolvedConfig;
    lastSyncedAt?: string;
    searchEfunDefinitionInInheritanceChain?: boolean;
    enableTypeChecking?: boolean;
}

export interface WorkspaceConfigSyncPayload {
    workspaceRoots: string[];
    workspaces: WorkspaceConfigSyncSnapshot[];
}

export const WorkspaceConfigSyncNotification = {
    method: WORKSPACE_CONFIG_SYNC_NOTIFICATION,
    type: new NotificationType<WorkspaceConfigSyncPayload>(WORKSPACE_CONFIG_SYNC_NOTIFICATION)
} as const;
