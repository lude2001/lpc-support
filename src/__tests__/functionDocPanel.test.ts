import * as vscode from 'vscode';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FunctionDocPanel } from '../functionDocPanel';

function createTextDocument(filePath: string, content: string): vscode.TextDocument {
    const normalized = content.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version: 1,
        lineCount: lines.length,
        getText: () => normalized,
        lineAt: (line: number) => ({ text: lines[line] ?? '' })
    } as unknown as vscode.TextDocument;
}

function createPanel(): { panel: vscode.WebviewPanel; postMessage: jest.Mock } {
    const postMessage = jest.fn().mockResolvedValue(true);
    return {
        postMessage,
        panel: {
            title: '',
            webview: {
                html: '', cspSource: 'vscode-webview://test',
                asWebviewUri: jest.fn((uri: vscode.Uri) => uri), postMessage,
                onDidReceiveMessage: jest.fn()
            },
            onDidDispose: jest.fn(), dispose: jest.fn(), reveal: jest.fn()
        } as unknown as vscode.WebviewPanel
    };
}

function createContext(): vscode.ExtensionContext {
    return {
        extensionUri: vscode.Uri.file('D:/code/lpc-support'),
        extensionPath: 'D:/code/lpc-support'
    } as vscode.ExtensionContext;
}

describe('FunctionDocPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue(undefined);
        (vscode.window.onDidChangeActiveTextEditor as jest.Mock).mockReturnValue({ dispose: jest.fn() });
        (vscode.workspace.onDidChangeTextDocument as jest.Mock).mockReturnValue({ dispose: jest.fn() });
        (vscode.workspace as any).onDidSaveTextDocument = jest.fn().mockReturnValue({ dispose: jest.fn() });
    });

    test('publishes declaration-preserving structured snapshot without embedding source data in HTML', async () => {
        const { panel, postMessage } = createPanel();
        const callable = {
            name: 'query_name',
            declarationKey: 'file:///D:/code/lpc/obj/npc.c#5:0-7:1',
            sourceKind: 'local' as const,
            declarationKind: 'implementation' as const,
            summary: '来自共享文档。',
            details: '面板应该直接读取共享文档数据。',
            signatures: [{
                label: 'string query_name(string style)',
                returnType: 'string',
                parameters: [{ name: 'style', type: 'string', description: '显示风格' }],
                isVariadic: false
            }],
            sourceRange: {
                start: { line: 5, character: 0 },
                end: { line: 7, character: 1 }
            },
            selectionRange: {
                start: { line: 5, character: 7 },
                end: { line: 5, character: 17 }
            }
        };
        const efunDocsManager = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件',
                    sourceKind: 'local' as const,
                    filePath: 'D:/code/lpc/obj/npc.c',
                    entries: [callable],
                    docs: new Map([['query_name', callable]])
                },
                inheritedGroups: [],
                includeGroups: []
            }))
        };
        const document = createTextDocument('D:/code/lpc/obj/npc.c', 'string query_name(string style) { return style; }');
        const textDocumentHost = { openTextDocument: jest.fn(async () => document) };
        const shownEditor = {
            selection: undefined,
            revealRange: jest.fn()
        };
        (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(shownEditor);
        const panelInstance = new (FunctionDocPanel as any)(
            panel,
            createContext(),
            efunDocsManager,
            textDocumentHost
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(document, true);

        expect(efunDocsManager.getFunctionDocLookupForDocument).toHaveBeenCalledWith(document, expect.objectContaining({
            forceFresh: true,
            projectConfig: undefined
        }));
        expect(panel.title).toContain('npc.c');
        expect(panel.webview.html).not.toContain('query_name');
        const snapshotMessage = postMessage.mock.calls.find(([message]) => message.type === 'snapshot')?.[0];
        expect(snapshotMessage.payload.entries[0]).toMatchObject({
            name: 'query_name',
            declarationKey: callable.declarationKey,
            signatures: [{ parameters: [{ name: 'style', type: 'string', description: '显示风格' }] }]
        });

        await panelInstance.handleMessage({
            type: 'goToDefinition', entryId: callable.declarationKey, revision: snapshotMessage.payload.revision
        });
        expect(textDocumentHost.openTextDocument).toHaveBeenCalledWith(vscode.Uri.parse(snapshotMessage.payload.entries[0].sourceUri));
        expect(shownEditor.selection.start).toMatchObject({ line: 5, character: 7 });

        const referenceLocation = { uri: document.uri, range: new vscode.Range(1, 0, 1, 4) };
        (vscode.commands.executeCommand as jest.Mock).mockImplementation(async (command: string) =>
            command === 'vscode.executeReferenceProvider' ? [referenceLocation] : undefined
        );
        await panelInstance.handleMessage({
            type: 'findReferences', entryId: callable.declarationKey, revision: snapshotMessage.payload.revision
        });
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'vscode.executeReferenceProvider',
            vscode.Uri.parse(snapshotMessage.payload.entries[0].sourceUri),
            expect.objectContaining({ line: 5, character: 7 })
        );
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            'editor.action.showReferences',
            expect.anything(),
            expect.objectContaining({ line: 5, character: 7 }),
            [referenceLocation]
        );
    });

    test('accepts the current lazy simulated-function result and jumps to its source definition', async () => {
        const { panel, postMessage } = createPanel();
        const root = createTextDocument('D:/workspace/main.c', 'int main() { return 1; }');
        const simulatedDocument = createTextDocument(
            'D:/workspace/secure/simul_efun.c',
            'int mud_log(string message) { return 1; }'
        );
        const simulated = {
            name: 'mud_log',
            declarationKey: 'simul:mud_log',
            sourceKind: 'simulEfun' as const,
            declarationKind: 'external' as const,
            sourcePath: simulatedDocument.fileName,
            sourceRange: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 42 }
            },
            selectionRange: {
                start: { line: 0, character: 4 },
                end: { line: 0, character: 11 }
            },
            signatures: [{
                label: 'int mud_log(string message)', returnType: 'int',
                parameters: [{ name: 'message', type: 'string' }], isVariadic: false
            }]
        };
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', sourceKind: 'local' as const, filePath: root.fileName,
                    entries: [], docs: new Map()
                },
                inheritedGroups: [], includeGroups: []
            })),
            getAllSimulatedFunctions: () => ['mud_log'],
            getSimulatedDoc: (name: string) => name === 'mud_log' ? simulated : undefined
        };
        const openTextDocument = jest.fn(async () => simulatedDocument);
        const shownEditor = { selection: undefined, revealRange: jest.fn() };
        (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(shownEditor);
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument }
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(root, true);
        const snapshot = postMessage.mock.calls.find(([message]) => message.type === 'snapshot')?.[0].payload;

        await panelInstance.handleMessage({
            type: 'searchExternal', requestId: 'external-1', query: 'mud_log', scopes: ['simulEfun']
        });
        const externalResult = postMessage.mock.calls.find(
            ([message]) => message.type === 'externalSearchResult' && message.requestId === 'external-1'
        )?.[0];
        expect(externalResult.entries[0]).toMatchObject({
            id: 'simul:mud_log',
            sourceUri: vscode.Uri.file(simulatedDocument.fileName).toString(),
            capabilities: { canGoToDefinition: true }
        });

        await panelInstance.handleMessage({
            type: 'goToDefinition', entryId: 'simul:mud_log', revision: snapshot.revision
        });

        expect(openTextDocument).toHaveBeenCalledWith(vscode.Uri.parse(externalResult.entries[0].sourceUri));
        expect(shownEditor.selection!.start).toMatchObject({ line: 0, character: 4 });
    });

    test('does not grant action authority to an older external search that resolves last', async () => {
        const { panel } = createPanel();
        const root = createTextDocument('D:/workspace/main.c', 'int main() { return 1; }');
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: {
                    source: '当前文件', sourceKind: 'local' as const, filePath: root.fileName,
                    entries: [], docs: new Map()
                },
                inheritedGroups: [], includeGroups: []
            }))
        };
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(root, true);
        const revision = panelInstance.acceptedSnapshot.revision;
        let resolveFirst: ((value: any) => void) | undefined;
        let resolveSecond: ((value: any) => void) | undefined;
        panelInstance.snapshotService.searchExternal = jest.fn()
            .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
            .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
        const entry = (id: string) => ({ id, declarationKey: id });

        const firstSearch = panelInstance.handleMessage({
            type: 'searchExternal', requestId: 'external-old', query: 'old', scopes: ['simulEfun']
        });
        await Promise.resolve();
        const secondSearch = panelInstance.handleMessage({
            type: 'searchExternal', requestId: 'external-new', query: 'new', scopes: ['simulEfun']
        });
        await Promise.resolve();
        resolveSecond!({ groups: [], entries: [entry('new-entry')], diagnostics: [] });
        await secondSearch;
        resolveFirst!({ groups: [], entries: [entry('old-entry')], diagnostics: [] });
        await firstSearch;

        expect(panelInstance.resolveActionEntry('new-entry', revision)).toBeDefined();
        expect(panelInstance.resolveActionEntry('old-entry', revision)).toBeUndefined();
    });

    test('publishes a recoverable failed snapshot when analysis throws', async () => {
        const { panel, postMessage } = createPanel();
        const document = createTextDocument('D:/code/lpc/broken.h', 'int broken();');
        const panelInstance = new (FunctionDocPanel as any)(
            panel,
            createContext(),
            { getFunctionDocLookupForDocument: jest.fn(async () => { throw new Error('解析器不可用'); }) },
            { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;

        await panelInstance.update(document, true);

        const snapshot = postMessage.mock.calls.find(([message]) => message.type === 'snapshot')?.[0].payload;
        expect(snapshot).toMatchObject({
            status: 'failed',
            rootDocument: { uri: document.uri.toString() },
            diagnostics: [{ code: 'analysis-failed', recoverable: true }]
        });
    });

    test('drops an older build that resolves after a newer document revision', async () => {
        const { panel, postMessage } = createPanel();
        const resolvers: Array<(lookup: any) => void> = [];
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(() => new Promise((resolve) => resolvers.push(resolve)))
        };
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        const first = createTextDocument('D:/code/lpc/first.c', 'int first() { return 1; }');
        const second = createTextDocument('D:/code/lpc/second.c', 'int second() { return 2; }');
        const firstUpdate = panelInstance.update(first, true);
        await new Promise<void>((resolve) => setImmediate(resolve));
        const secondUpdate = panelInstance.update(second, true);
        await new Promise<void>((resolve) => setImmediate(resolve));
        const lookup = (filePath: string) => ({
            currentFile: { source: '当前文件', sourceKind: 'local', filePath, entries: [], docs: new Map() },
            inheritedGroups: [], includeGroups: []
        });
        resolvers[1](lookup(second.fileName));
        await secondUpdate;
        resolvers[0](lookup(first.fileName));
        await firstUpdate;

        const snapshots = postMessage.mock.calls.filter(([message]) => message.type === 'snapshot');
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0][0].payload.rootDocument.uri).toBe(second.uri.toString());
    });

    test('drops a build when the mutable root document changes version before analysis resolves', async () => {
        const { panel, postMessage } = createPanel();
        let resolveLookup: ((lookup: any) => void) | undefined;
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(() => new Promise((resolve) => { resolveLookup = resolve; }))
        };
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        const document = createTextDocument('D:/code/lpc/main.c', 'int main() { return 1; }');
        const pendingUpdate = panelInstance.update(document, true);
        await new Promise<void>((resolve) => setImmediate(resolve));

        (document as any).version = 2;
        resolveLookup!({
            currentFile: {
                source: '当前文件', sourceKind: 'local', filePath: document.fileName,
                entries: [], docs: new Map()
            },
            inheritedGroups: [], includeGroups: []
        });
        await pendingUpdate;

        expect(postMessage.mock.calls.filter(([message]) => message.type === 'snapshot')).toHaveLength(0);
        expect(panelInstance.acceptedSnapshot).toBeUndefined();
    });

    test('does not publish a failed snapshot after the panel is disposed', async () => {
        const { panel, postMessage } = createPanel();
        let rejectLookup: ((error: Error) => void) | undefined;
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(() => new Promise((_resolve, reject) => { rejectLookup = reject; }))
        };
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        const document = createTextDocument('D:/code/lpc/main.c', 'int main() { return 1; }');
        const pendingUpdate = panelInstance.update(document, true);
        await new Promise<void>((resolve) => setImmediate(resolve));

        panelInstance.dispose();
        rejectLookup!(new Error('late failure'));
        await pendingUpdate;

        expect(postMessage.mock.calls.filter(([message]) => message.type === 'snapshot')).toHaveLength(0);
        expect(panelInstance.acceptedSnapshot).toBeUndefined();
    });

    test('rejects actions from the displayed snapshot as soon as a newer root build starts', async () => {
        const { panel, postMessage } = createPanel();
        let resolveSecond: ((lookup: any) => void) | undefined;
        const callable = {
            name: 'first', declarationKey: 'first-entry', sourceKind: 'local' as const,
            declarationKind: 'implementation' as const,
            sourceRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 20 } },
            selectionRange: { start: { line: 0, character: 4 }, end: { line: 0, character: 9 } },
            signatures: [{ label: 'int first()', returnType: 'int', parameters: [], isVariadic: false }]
        };
        const lookup = (filePath: string, entries: any[] = []) => ({
            currentFile: {
                source: '当前文件', sourceKind: 'local' as const, filePath, entries,
                docs: new Map(entries.map((entry) => [entry.name, entry]))
            },
            inheritedGroups: [], includeGroups: []
        });
        const provider = {
            getFunctionDocLookupForDocument: jest.fn()
                .mockResolvedValueOnce(lookup('D:/code/lpc/first.c', [callable]))
                .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }))
        };
        const openTextDocument = jest.fn();
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument }
        );
        panelInstance.webviewReady = true;
        const first = createTextDocument('D:/code/lpc/first.c', 'int first() { return 1; }');
        const second = createTextDocument('D:/code/lpc/second.c', 'int second() { return 2; }');
        await panelInstance.update(first, true);
        const firstSnapshot = postMessage.mock.calls.find(([message]) => message.type === 'snapshot')?.[0].payload;

        const pendingSecond = panelInstance.update(second, true);
        await Promise.resolve();
        await panelInstance.handleMessage({
            type: 'goToDefinition', entryId: 'first-entry', revision: firstSnapshot.revision
        });

        expect(openTextDocument).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'actionResult', ok: false, message: '面板内容已更新，请重新选择函数。'
        }));
        resolveSecond!(lookup(second.fileName));
        await pendingSecond;
    });

    test('refreshes the root snapshot when a visible dependency is saved', async () => {
        let saveHandler: ((document: vscode.TextDocument) => void) | undefined;
        (vscode.workspace as any).onDidSaveTextDocument = jest.fn((handler) => {
            saveHandler = handler;
            return { dispose: jest.fn() };
        });
        const { panel } = createPanel();
        const root = createTextDocument('D:/code/lpc/main.c', '#include "helper.h"');
        const dependency = createTextDocument('D:/code/lpc/helper.h', 'int helper();');
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: { source: '当前文件', sourceKind: 'local', filePath: root.fileName, entries: [], docs: new Map() },
                inheritedGroups: [],
                includeGroups: [{
                    source: '包含自 helper.h', sourceKind: 'include', filePath: dependency.fileName,
                    entries: [], docs: new Map(), depth: 1, parentFilePath: root.fileName
                }]
            }))
        };
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(root, true);

        saveHandler!(dependency);
        await Promise.resolve();
        await Promise.resolve();

        expect(provider.getFunctionDocLookupForDocument).toHaveBeenCalledTimes(2);
        expect(provider.getFunctionDocLookupForDocument.mock.calls[1][0]).toBe(root);
    });

    test('debounces rapid unsaved root edits into one fresh refresh', async () => {
        jest.useFakeTimers();
        let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
        (vscode.workspace.onDidChangeTextDocument as jest.Mock).mockImplementation((handler) => {
            changeHandler = handler;
            return { dispose: jest.fn() };
        });
        const root = createTextDocument('D:/code/lpc/main.c', 'int main() { return 1; }');
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: { source: '当前文件', sourceKind: 'local', filePath: root.fileName, entries: [], docs: new Map() },
                inheritedGroups: [], includeGroups: []
            }))
        };
        const { panel } = createPanel();
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(root, true);

        changeHandler!({ document: root });
        changeHandler!({ document: root });
        changeHandler!({ document: root });
        await jest.advanceTimersByTimeAsync(249);
        expect(provider.getFunctionDocLookupForDocument).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(provider.getFunctionDocLookupForDocument).toHaveBeenCalledTimes(2);
        expect(provider.getFunctionDocLookupForDocument.mock.calls[1][1]).toEqual(expect.objectContaining({
            forceFresh: false
        }));
        panelInstance.dispose();
        jest.useRealTimers();
    });

    test('cancels a queued typing refresh when save triggers an immediate fresh build', async () => {
        jest.useFakeTimers();
        let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
        let saveHandler: ((document: vscode.TextDocument) => void) | undefined;
        (vscode.workspace.onDidChangeTextDocument as jest.Mock).mockImplementation((handler) => {
            changeHandler = handler;
            return { dispose: jest.fn() };
        });
        (vscode.workspace as any).onDidSaveTextDocument = jest.fn((handler) => {
            saveHandler = handler;
            return { dispose: jest.fn() };
        });
        const root = createTextDocument('D:/code/lpc/main.c', 'int main() { return 1; }');
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: { source: '当前文件', sourceKind: 'local', filePath: root.fileName, entries: [], docs: new Map() },
                inheritedGroups: [], includeGroups: []
            }))
        };
        const { panel } = createPanel();
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(root, true);

        changeHandler!({ document: root });
        saveHandler!(root);
        await jest.advanceTimersByTimeAsync(0);
        expect(provider.getFunctionDocLookupForDocument).toHaveBeenCalledTimes(2);
        await jest.advanceTimersByTimeAsync(250);
        expect(provider.getFunctionDocLookupForDocument).toHaveBeenCalledTimes(2);
        expect(provider.getFunctionDocLookupForDocument.mock.calls[1][1]).toEqual(expect.objectContaining({
            forceFresh: true
        }));
        panelInstance.dispose();
        jest.useRealTimers();
    });

    test('refreshes when the owning project configuration snapshot changes', async () => {
        const root = createTextDocument('D:/code/lpc/main.c', 'int main() { return 1; }');
        (vscode.workspace.getWorkspaceFolder as jest.Mock).mockReturnValue({ uri: { fsPath: '/D:/code/lpc' } });
        let configHandler: ((workspaceRoot: string) => void) | undefined;
        const projectConfigProvider = {
            getWorkspaceProjectConfig: jest.fn(() => ({ projectConfigPath: 'D:/code/lpc/lpc-support.json' })),
            onDidChange: jest.fn((handler) => {
                configHandler = handler;
                return { dispose: jest.fn() };
            })
        };
        const provider = {
            getFunctionDocLookupForDocument: jest.fn(async () => ({
                currentFile: { source: '当前文件', sourceKind: 'local', filePath: root.fileName, entries: [], docs: new Map() },
                inheritedGroups: [], includeGroups: []
            }))
        };
        const { panel } = createPanel();
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), provider, { openTextDocument: jest.fn() }, projectConfigProvider
        );
        panelInstance.webviewReady = true;
        await panelInstance.update(root, true);

        configHandler!('/D:/code/lpc');
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(provider.getFunctionDocLookupForDocument).toHaveBeenCalledTimes(2);
        expect(provider.getFunctionDocLookupForDocument.mock.calls[1][1]).toEqual(expect.objectContaining({
            forceFresh: true,
            projectConfig: { projectConfigPath: 'D:/code/lpc/lpc-support.json' }
        }));
    });

    test('rejects documentation authoring when the root document version is stale', async () => {
        const { panel, postMessage } = createPanel();
        const document = createTextDocument('D:/code/lpc/main.c', 'int main() { return 1; }');
        (document as any).version = 2;
        const openTextDocument = jest.fn();
        const panelInstance = new (FunctionDocPanel as any)(
            panel, createContext(), { getFunctionDocLookupForDocument: jest.fn() }, { openTextDocument }
        );
        panelInstance.webviewReady = true;
        panelInstance.currentDocument = document;
        panelInstance.acceptedSnapshot = {
            protocolVersion: 2, sessionId: 'session', revision: 3,
            rootDocument: { uri: document.uri.toString(), workspaceRelativePath: 'main.c', version: 1, languageId: 'lpc' },
            status: 'ready', groups: [], diagnostics: [],
            capabilities: { supportsLiveRefresh: true, supportsExternalSearch: false, supportsDocumentationAuthoring: true },
            entries: [{
                id: 'main-entry', declarationKey: 'main-entry', name: 'main', sourceKind: 'local', sourceGroupId: 'local',
                declarationKind: 'implementation', sourceUri: document.uri.toString(),
                sourceRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 24 } },
                signatures: [], documentation: { hasAttachedComment: false },
                quality: { status: 'incomplete', issues: [], action: 'generate' },
                relation: { status: 'none', relatedEntryIds: [], relatedSourceUris: [] }, modifiers: [],
                capabilities: {
                    canGoToDefinition: true, canFindReferences: false, canCopySignature: false,
                    canGenerateDocumentation: true, canCompleteDocumentation: false, canUpdateDocumentation: false
                }
            }]
        };

        await panelInstance.handleMessage({
            type: 'authorDocumentation', entryId: 'main-entry', revision: 3, mode: 'generate'
        });

        expect(openTextDocument).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
            type: 'actionResult', ok: false, message: '文档已变化，请刷新后重试。'
        }));
    });
});
