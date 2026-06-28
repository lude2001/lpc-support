import * as vscode from 'vscode';
import {
    SOURCE_FILE_CHANGE_NOTIFICATION,
    type SourceFileChangePayload,
    type SourceFileChangeType
} from '../../shared/protocol/sourceFileChange';

export { SOURCE_FILE_CHANGE_NOTIFICATION };
export type { SourceFileChangePayload, SourceFileChangeType } from '../../shared/protocol/sourceFileChange';

export interface SourceFileChangeBridgeClient {
    sendNotification(method: string, payload: SourceFileChangePayload): void | Promise<void>;
}

export interface SourceFileChangeBridgeOptions {
    client: SourceFileChangeBridgeClient;
    onError?: (error: Error) => void;
}

export function initializeSourceFileChangeBridge(
    options: SourceFileChangeBridgeOptions
): vscode.Disposable {
    const reportError = createErrorReporter(options.onError);
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{c,h,lpc}');
    const disposables: vscode.Disposable[] = [
        watcher.onDidCreate(uri => sendSourceFileChange(options.client, uri, 'created', reportError)),
        watcher.onDidChange(uri => sendSourceFileChange(options.client, uri, 'changed', reportError)),
        watcher.onDidDelete(uri => sendSourceFileChange(options.client, uri, 'deleted', reportError)),
        watcher
    ];

    return {
        dispose(): void {
            for (const disposable of disposables.splice(0).reverse()) {
                disposable.dispose();
            }
        }
    };
}

function sendSourceFileChange(
    client: SourceFileChangeBridgeClient,
    uri: vscode.Uri,
    changeType: SourceFileChangeType,
    reportError: (error: Error) => void
): void {
    void Promise.resolve(client.sendNotification(SOURCE_FILE_CHANGE_NOTIFICATION, {
        uri: uri.toString(),
        changeType
    })).catch(error => reportError(asError(error)));
}

function createErrorReporter(onError?: (error: Error) => void): (error: Error) => void {
    if (onError) {
        return onError;
    }

    return (error: Error) => {
        console.error('[lsp] Failed to notify source file change', error);
    };
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
