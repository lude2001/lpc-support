import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import type * as vscode from 'vscode';
import { RustDiagnosticsCommands } from '../RustDiagnosticsCommands';
import { WORKSPACE_INDEX_CHANGED_NOTIFICATION } from '../../lsp/shared/protocol/workspaceIndex';

const collection = { clear: jest.fn(), set: jest.fn(), dispose: jest.fn() };
const output = { show: jest.fn(), appendLine: jest.fn() };
const folder = { fsPath: 'D:/fixture', toString: () => 'file:///D:/fixture' };
const panel = {
    webview: { html: '', onDidReceiveMessage: jest.fn() },
    onDidDispose: jest.fn()
};

jest.mock('vscode', () => ({
    languages: { createDiagnosticCollection: () => collection },
    workspace: { onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })) },
    window: {
        activeTextEditor: undefined,
        showOpenDialog: jest.fn(async () => [folder]),
        createOutputChannel: () => output,
        withProgress: jest.fn(async (_options: unknown, action: () => Promise<void>) => action()),
        createWebviewPanel: jest.fn(() => panel),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    Uri: { parse: (value: string) => ({ fsPath: value, toString: () => value }) },
    ProgressLocation: { Notification: 1 },
    ViewColumn: { One: 1 },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    Diagnostic: class { constructor(public range: unknown, public message: string, public severity: unknown) {} },
    Range: class { constructor(public startLine: number, public startCharacter: number,
        public endLine: number, public endCharacter: number) {} }
}), { virtual: true });

describe('RustDiagnosticsCommands live snapshots', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => jest.useRealTimers());

    test('refreshes an already scanned folder after index changes', async () => {
        let onIndexChanged: (() => void) | undefined;
        const sendRequest = jest.fn(async () => []);
        const manager = {
            sendRequest,
            onNotification: jest.fn((_method: string, handler: () => void) => {
                onIndexChanged = handler;
                return { dispose: jest.fn() };
            })
        };
        const commands = new RustDiagnosticsCommands(
            { subscriptions: [] } as unknown as vscode.ExtensionContext,
            manager as unknown as ConstructorParameters<typeof RustDiagnosticsCommands>[1]
        );
        await commands.scanFolder();
        expect(manager.onNotification).toHaveBeenCalledWith(
            WORKSPACE_INDEX_CHANGED_NOTIFICATION, expect.any(Function)
        );
        onIndexChanged?.();
        await jest.advanceTimersByTimeAsync(1000);
        expect(sendRequest).toHaveBeenCalledTimes(2);
        expect(sendRequest).toHaveBeenLastCalledWith('lpc/workspaceDiagnostics', {
            uriPrefix: 'file:///D:/fixture/'
        });
        expect(collection.clear).toHaveBeenCalledTimes(2);
        commands.dispose();
    });

    test('refreshes an open variable list after the index changes', async () => {
        let onIndexChanged: (() => void) | undefined;
        const document = {
            uri: { toString: () => 'file:///D:/fixture/demo.c' },
            languageId: 'lpc', version: 1
        };
        const vscodeMock = jest.requireMock('vscode') as {
            window: { activeTextEditor: { document: typeof document } | undefined };
        };
        vscodeMock.window.activeTextEditor = { document };
        const variable = (name: string) => ({
            name, detail: name, local: true, unused: false,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }
        });
        const sendRequest = jest.fn(async () => [variable('updated_name')]);
        sendRequest.mockResolvedValueOnce([variable('old_name')]);
        const manager = {
            sendRequest,
            onNotification: jest.fn((_method: string, handler: () => void) => {
                onIndexChanged = handler;
                return { dispose: jest.fn() };
            })
        };
        const commands = new RustDiagnosticsCommands(
            { subscriptions: [] } as unknown as vscode.ExtensionContext,
            manager as unknown as ConstructorParameters<typeof RustDiagnosticsCommands>[1]
        );
        await commands.showVariables();
        expect(panel.webview.html).toContain('old_name');
        onIndexChanged?.();
        await jest.advanceTimersByTimeAsync(250);
        expect(panel.webview.html).toContain('updated_name');
        commands.dispose();
        vscodeMock.window.activeTextEditor = undefined;
    });
});
