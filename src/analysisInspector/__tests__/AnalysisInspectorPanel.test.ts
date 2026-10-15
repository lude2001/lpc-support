import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { JSDOM } from 'jsdom';
import { AnalysisInspectorPanel } from '../AnalysisInspectorPanel';
import { inspectionHtml, renderInspection } from '../renderInspection';
import type { AnalysisInspection } from '../../lsp/shared/protocol/analysisInspection';

function model(uri = 'file:///demo.c', version = 1): AnalysisInspection {
    const range = { start: { line: 1, character: 4 }, end: { line: 1, character: 8 } };
    return {
        uri, version, revision: version, preprocessedText: 'int value = FLAG;',
        inactiveRanges: [range], macros: [{ name: 'FLAG', kind: 'define', value: '7', range }], initialMacros: { PREDEFINED: '1' },
        analysis: {
            dependenciesComplete: false,
            dependencies: [{ path: '/missing.h', kind: 'include', targets: [] }],
            symbol: { name: 'FLAG', status: 'macro', macroValue: '7', definitions: [{ uri, range }] }
        }
    };
}

describe('analysis inspector', () => {
    let panel: any;
    let manager: any;
    let received: (message: unknown) => void;
    let selectionChanged: (event: unknown) => void;
    let textChanged: (event: unknown) => void;
    let indexChanged: () => void;
    let viewStateChanged: () => void;
    let editor: any;
    let inspector: AnalysisInspectorPanel;
    const disposable = () => ({ dispose: jest.fn() });

    beforeEach(() => {
        jest.useFakeTimers();
        editor = { document: { uri: vscode.Uri.parse('file:///demo.c'), languageId: 'lpc', version: 1 }, selection: { active: new vscode.Position(1, 5) } };
        (vscode.window as any).activeTextEditor = editor;
        Object.assign(vscode.window, {
            onDidChangeTextEditorSelection: jest.fn((callback: (event: unknown) => void) => { selectionChanged = callback; return disposable(); })
        });
        Object.assign(vscode.workspace, { asRelativePath: (uri: vscode.Uri) => uri.path });
        (vscode.workspace.onDidChangeTextDocument as jest.Mock).mockImplementation((callback: (event: unknown) => void) => { textChanged = callback; return disposable(); });
        panel = {
            visible: true, dispose: jest.fn(), reveal: jest.fn(),
            onDidDispose: jest.fn(disposable),
            onDidChangeViewState: jest.fn((callback: () => void) => { viewStateChanged = callback; return disposable(); }),
            webview: { html: '', postMessage: jest.fn<() => Promise<boolean>>().mockResolvedValue(true), onDidReceiveMessage: jest.fn((callback: (message: unknown) => void) => { received = callback; return disposable(); }) }
        };
        manager = {
            sendRequest: jest.fn<() => Promise<AnalysisInspection>>().mockResolvedValue(model(editor.document.uri.toString())),
            onNotification: jest.fn((method: string, callback: () => void) => { if (method.endsWith('/changed')) indexChanged = callback; return disposable(); })
        };
        inspector = new AnalysisInspectorPanel(panel, manager);
    });

    afterEach(() => { inspector.dispose(); jest.useRealTimers(); });

    async function flush(): Promise<void> { await jest.advanceTimersByTimeAsync(200); }

    test('renders on readiness and refreshes after cursor, buffer and dependency changes', async () => {
        received({ type: 'ready' });
        await flush();
        expect(manager.sendRequest).toHaveBeenLastCalledWith('lpc/analysisInspection', { textDocument: { uri: editor.document.uri.toString() }, position: { line: 1, character: 5 } });
        expect(panel.webview.postMessage.mock.calls.at(-1)[0].view.overview).toContain('宏定义');
        selectionChanged({ textEditor: editor });
        textChanged({ document: { languageId: 'lpc' } });
        indexChanged();
        await flush();
        expect(manager.sendRequest).toHaveBeenCalledTimes(2);
        panel.visible = false;
        indexChanged();
        await flush();
        expect(manager.sendRequest).toHaveBeenCalledTimes(2);
        panel.visible = true;
        viewStateChanged();
        await flush();
        expect(manager.sendRequest).toHaveBeenCalledTimes(3);
    });

    test('discards responses invalidated by a later edit and rejects version mismatches', async () => {
        let resolve: (value: AnalysisInspection) => void;
        manager.sendRequest.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
        received({ type: 'ready' });
        await flush();
        editor.document.version = 2;
        textChanged({ document: editor.document });
        resolve!(model(editor.document.uri.toString(), 1));
        await Promise.resolve();
        expect(panel.webview.postMessage).not.toHaveBeenCalled();
        await flush();
        expect(panel.webview.postMessage.mock.calls.at(-1)[0].type).toBe('empty');
        manager.sendRequest.mockResolvedValue(model(editor.document.uri.toString(), 2));
        indexChanged();
        await flush();
        expect(panel.webview.postMessage.mock.calls.at(-1)[0].type).toBe('snapshot');
    });

    test('allows only current snapshot locations and disposes timers and listeners', async () => {
        received({ type: 'ready' });
        await flush();
        const generation = panel.webview.postMessage.mock.calls.at(-1)[0].generation;
        (vscode.window.showTextDocument as jest.Mock).mockClear();
        received({ type: 'open', index: 999, generation });
        received({ type: 'open', index: 0, generation: generation - 1 });
        expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        received({ type: 'open', index: 0, generation });
        expect(vscode.window.showTextDocument).toHaveBeenCalledTimes(1);
        indexChanged();
        received({ type: 'open', index: 0, generation });
        expect(vscode.window.showTextDocument).toHaveBeenCalledTimes(1);
        inspector.dispose();
        await flush();
        expect(manager.sendRequest).toHaveBeenCalledTimes(1);
        expect(manager.onNotification.mock.results.every(result => result.value.dispose.mock.calls.length === 1)).toBe(true);
    });

    test('reports request errors and clears previous results', async () => {
        manager.sendRequest.mockRejectedValue(new Error('offline'));
        received({ type: 'ready' });
        await flush();
        expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'empty', status: '读取分析失败：offline' });
    });
});

test('webview escapes source data, switches tabs, and keeps the selected tab after refresh', () => {
    const data = model();
    const attack = '<img src=x onerror="window.compromised=true">';
    data.preprocessedText = attack;
    data.initialMacros[attack] = attack;
    data.analysis!.symbol!.macroValue = attack;
    data.analysis!.dependencies[0].path = attack;
    const view = renderInspection(data, uri => uri);
    expect(view.preprocessed).toContain('&lt;img');
    const postMessage = jest.fn();
    const dom = new JSDOM(inspectionHtml('a'.repeat(32)), {
        runScripts: 'dangerously', beforeParse(window) { (window as any).acquireVsCodeApi = () => ({ postMessage }); }
    });
    const win = dom.window;
    const deliver = () => win.dispatchEvent(new win.MessageEvent('message', { data: { type: 'snapshot', view, status: '已更新', generation: 4 } }));
    deliver();
    expect(win.document.querySelector('img')).toBeNull();
    expect(win.document.querySelector('#preprocessed pre')?.textContent).toBe(attack);
    (win.document.querySelector('[data-tab="dependencies"]') as HTMLElement).click();
    expect((win.document.getElementById('overview') as HTMLElement).hidden).toBe(true);
    deliver();
    expect((win.document.getElementById('dependencies') as HTMLElement).hidden).toBe(false);
    (win.document.querySelector('[data-location="0"]') as HTMLElement).click();
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'open', index: 0, generation: 4 });
    win.close();
});
