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
    l10n: jest.requireActual<typeof import('vscode')>('vscode').l10n,
    env: jest.requireActual<typeof import('vscode')>('vscode').env,
    languages: { createDiagnosticCollection: () => collection },
    workspace: { onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })) },
    window: {
        activeTextEditor: undefined,
        showOpenDialog: jest.fn(async () => [folder]),
        createOutputChannel: jest.fn(() => output),
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

const vscodeMock = jest.requireMock('vscode') as {
    env: { language: string };
    window: {
        activeTextEditor: { document: { uri: { toString(): string }; languageId: string; version: number } } | undefined;
        createOutputChannel: jest.Mock;
        createWebviewPanel: jest.Mock;
        showInformationMessage: jest.Mock;
        withProgress: jest.Mock;
    };
};

const locales = [
    {
        language: 'en', title: 'LPC Variables', unused: 'Unused variables', globals: 'Global variables', locals: 'Local variables',
        empty: '(None)', openFile: 'Open an LPC source or header file first.', channel: 'LPC Variable Check',
        scanning: 'Scanning folder: D:/fixture', progress: 'Checking LPC files using the Rust index...',
        complete: 'Scan finished: 0 files, 0 diagnostics.'
    },
    {
        language: 'zh-cn', title: 'LPC 变量列表', unused: '未使用的变量', globals: '全局变量', locals: '局部变量',
        empty: '（无）', openFile: '请先打开一个 LPC 源文件或头文件。', channel: 'LPC 变量检查',
        scanning: '开始扫描文件夹：D:/fixture', progress: '正在使用 Rust 索引检查 LPC 文件...',
        complete: '扫描完成：0 个文件，0 条诊断。'
    }
];

describe('RustDiagnosticsCommands live snapshots', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        vscodeMock.env.language = 'zh-cn';
        vscodeMock.window.activeTextEditor = undefined;
        panel.webview.html = '';
    });

    afterEach(() => {
        jest.useRealTimers();
        vscodeMock.env.language = 'zh-cn';
        vscodeMock.window.activeTextEditor = undefined;
    });

    test.each(locales)('refreshes an already scanned folder with localized status in $language', async locale => {
        vscodeMock.env.language = locale.language;
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
        expect(vscodeMock.window.createOutputChannel).toHaveBeenCalledWith(locale.channel);
        expect(vscodeMock.window.withProgress).toHaveBeenCalledWith({
            location: 1, title: locale.progress, cancellable: false
        }, expect.any(Function));
        expect(output.appendLine).toHaveBeenCalledWith(locale.scanning);
        expect(output.appendLine).toHaveBeenCalledWith(locale.complete);
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

    test.each(locales)('renders variable headings in $language and preserves source details', async locale => {
        vscodeMock.env.language = locale.language;
        const document = {
            uri: { toString: () => 'file:///D:/fixture/demo.c' }, languageId: 'lpc', version: 1
        };
        vscodeMock.window.activeTextEditor = { document };
        const sendRequest = jest.fn(async () => [{
            name: 'source_symbol', detail: '<source_symbol> & value', local: true, unused: false,
            range: { start: { line: 4, character: 3 }, end: { line: 4, character: 16 } }
        }]);
        const commands = new RustDiagnosticsCommands(
            { subscriptions: [] } as unknown as vscode.ExtensionContext,
            { sendRequest } as unknown as ConstructorParameters<typeof RustDiagnosticsCommands>[1]
        );

        await commands.showVariables();

        expect(sendRequest).toHaveBeenCalledTimes(1);
        expect(sendRequest).toHaveBeenCalledWith('lpc/documentVariables', {
            textDocument: { uri: 'file:///D:/fixture/demo.c' }
        });
        expect(vscodeMock.window.createWebviewPanel).toHaveBeenCalledWith(
            'lpcVariables', locale.title, 1, { enableScripts: true }
        );
        expect(panel.webview.html).toContain(`<html lang="${locale.language}">`);
        expect(panel.webview.html).toContain(`<h3>${locale.unused}:</h3>`);
        expect(panel.webview.html).toContain(`<h3>${locale.globals}:</h3>`);
        expect(panel.webview.html).toContain(`<h3>${locale.locals}:</h3>`);
        expect(panel.webview.html).toContain(`<div>${locale.empty}</div>`);
        expect(panel.webview.html).toContain('&lt;source_symbol&gt; &amp; value');
        expect(panel.webview.html).not.toContain('<source_symbol>');
        expect(panel.webview.html).toContain('data-line="4" data-character="3"');
        expect(panel.webview.html).toContain("command: 'jumpToVariable'");
        commands.dispose();
    });

    test.each(locales)('shows the localized open-file prompt in $language without requesting source data', async locale => {
        vscodeMock.env.language = locale.language;
        const sendRequest = jest.fn();
        const commands = new RustDiagnosticsCommands(
            { subscriptions: [] } as unknown as vscode.ExtensionContext,
            { sendRequest } as unknown as ConstructorParameters<typeof RustDiagnosticsCommands>[1]
        );

        await commands.showVariables();

        expect(vscodeMock.window.showInformationMessage).toHaveBeenCalledWith(locale.openFile);
        expect(sendRequest).not.toHaveBeenCalled();
        expect(vscodeMock.window.createWebviewPanel).not.toHaveBeenCalled();
        commands.dispose();
    });
});
