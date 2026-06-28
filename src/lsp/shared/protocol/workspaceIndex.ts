import { NotificationType, RequestType } from 'vscode-languageserver/node';
import type { WorkspaceConfigSyncPayload } from './workspaceConfigSync';

export const WORKSPACE_INDEX_REBUILD_REQUEST = 'lpc/workspaceIndex/rebuild';
export const WORKSPACE_INDEX_PROGRESS_NOTIFICATION = 'lpc/workspaceIndex/progress';

export interface WorkspaceIndexRebuildParams extends WorkspaceConfigSyncPayload {
}

export interface WorkspaceIndexRebuildResult {
    status: 'ready';
    totalFiles: number;
    indexedFiles: number;
    skippedFiles: number;
    failedFiles: number;
    durationMs: number;
}

export interface WorkspaceIndexProgressPayload {
    status: 'building';
    totalFiles: number;
    processedFiles: number;
    indexedFiles: number;
    skippedFiles: number;
    failedFiles: number;
}

export const WorkspaceIndexRebuildRequest = {
    method: WORKSPACE_INDEX_REBUILD_REQUEST,
    type: new RequestType<WorkspaceIndexRebuildParams, WorkspaceIndexRebuildResult, void>(
        WORKSPACE_INDEX_REBUILD_REQUEST
    )
} as const;

export const WorkspaceIndexProgressNotification = {
    method: WORKSPACE_INDEX_PROGRESS_NOTIFICATION,
    type: new NotificationType<WorkspaceIndexProgressPayload>(
        WORKSPACE_INDEX_PROGRESS_NOTIFICATION
    )
} as const;
