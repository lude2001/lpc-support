import { NotificationType } from 'vscode-languageserver/node';

export const SOURCE_FILE_CHANGE_NOTIFICATION = 'lpc/sourceFileChange';

export type SourceFileChangeType = 'created' | 'changed' | 'deleted';

export interface SourceFileChangePayload {
    uri: string;
    changeType: SourceFileChangeType;
}

export const SourceFileChangeNotification = {
    method: SOURCE_FILE_CHANGE_NOTIFICATION,
    type: new NotificationType<SourceFileChangePayload>(SOURCE_FILE_CHANGE_NOTIFICATION)
} as const;
