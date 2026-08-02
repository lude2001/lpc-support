import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import type { FunctionDocLookup } from './efun/FileFunctionDocTracker';
import type {
    FunctionDocumentationPanelEntry,
    FunctionDocumentationPanelSnapshot,
    FunctionDocsToExtensionMessage
} from './functionDocs/contracts/FunctionDocumentationPanelProtocol';
import { isFunctionDocsToExtensionMessage } from './functionDocs/contracts/FunctionDocumentationPanelProtocol';
import { FunctionDocumentationAuthoringService } from './functionDocs/services/FunctionDocumentationAuthoringService';
import {
    FunctionDocumentationSnapshotService,
    type FunctionDocumentationLookupProvider
} from './functionDocs/services/FunctionDocumentationSnapshotService';
import { renderFunctionDocPanelHtml } from './functionDocPanelTemplate';
import type { LanguageWorkspaceProjectConfig } from './language/contracts/LanguageWorkspaceContext';
import type { TextDocumentHost } from './language/shared/WorkspaceDocumentPathSupport';

type FunctionDocLookupProvider = FunctionDocumentationLookupProvider & {
    getFunctionDocLookupForDocument(
        document: vscode.TextDocument,
        options?: {
            forceFresh?: boolean;
            projectConfig?: LanguageWorkspaceProjectConfig;
            cancellationToken?: Pick<vscode.CancellationToken, 'isCancellationRequested'>;
        }
    ): Promise<FunctionDocLookup>;
};

export interface FunctionDocumentationProjectConfigProvider {
    getWorkspaceProjectConfig(workspaceRoot: string): LanguageWorkspaceProjectConfig | undefined;
    onDidChange?(listener: (workspaceRoot: string) => void): vscode.Disposable;
}

export class FunctionDocPanel {
    private static currentPanel: FunctionDocPanel | undefined;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly sessionId = crypto.randomUUID();
    private readonly snapshotService: FunctionDocumentationSnapshotService;
    private readonly authoringService = new FunctionDocumentationAuthoringService();
    private currentDocument: vscode.TextDocument | undefined;
    private acceptedSnapshot: FunctionDocumentationPanelSnapshot | undefined;
    private readonly externalActionEntries = new Map<string, FunctionDocumentationPanelEntry>();
    private latestExternalRequestId: string | undefined;
    private nextRevision = 0;
    private latestRequestedRevision = 0;
    private webviewReady = false;
    private refreshTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingBuild: vscode.CancellationTokenSource | undefined;
    private disposed = false;

    public static createOrShow(
        context: vscode.ExtensionContext,
        functionDocLookupProvider: FunctionDocLookupProvider,
        textDocumentHost: TextDocumentHost,
        projectConfigProvider?: FunctionDocumentationProjectConfigProvider
    ): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !isLpcSourceDocument(activeEditor.document)) {
            vscode.window.showInformationMessage('请先打开一个 LPC 源文件或头文件。');
            return;
        }

        if (FunctionDocPanel.currentPanel) {
            FunctionDocPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
            void FunctionDocPanel.currentPanel.update(activeEditor.document, true);
            return;
        }

        const templateRoot = vscode.Uri.joinPath(context.extensionUri, 'dist', 'templates');
        const panel = vscode.window.createWebviewPanel(
            'lpcFunctionDoc',
            'LPC 函数文档中心',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [templateRoot]
            }
        );
        const instance = new FunctionDocPanel(
            panel,
            context,
            functionDocLookupProvider,
            textDocumentHost,
            projectConfigProvider
        );
        FunctionDocPanel.currentPanel = instance;
        void instance.update(activeEditor.document, true);
    }

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        context: vscode.ExtensionContext,
        functionDocLookupProvider: FunctionDocLookupProvider,
        private readonly textDocumentHost: TextDocumentHost,
        private readonly projectConfigProvider?: FunctionDocumentationProjectConfigProvider
    ) {
        this.snapshotService = new FunctionDocumentationSnapshotService(functionDocLookupProvider);
        this.panel.webview.html = renderFunctionDocPanelHtml(
            __dirname,
            this.panel.webview,
            context.extensionUri,
            crypto.randomBytes(16).toString('base64')
        );

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message: unknown) => {
            if (isFunctionDocsToExtensionMessage(message)) {
                void this.handleMessage(message);
            }
        }, null, this.disposables);

        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && isLpcSourceDocument(editor.document)) {
                void this.update(editor.document, true);
            }
        }));
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            if (this.currentDocument && this.isTrackedDocument(event.document.uri)) {
                const isRoot = event.document.uri.toString() === this.currentDocument.uri.toString();
                this.scheduleRefresh(this.currentDocument, !isRoot);
            }
        }));
        this.disposables.push(vscode.workspace.onDidSaveTextDocument((document) => {
            if (this.currentDocument && this.isTrackedDocument(document.uri)) {
                void this.update(this.currentDocument, true);
            }
        }));
        if (typeof vscode.workspace.onDidCloseTextDocument === 'function') {
            this.disposables.push(vscode.workspace.onDidCloseTextDocument((document) => {
                if (this.currentDocument && this.isTrackedDocument(document.uri)) {
                    void this.update(this.currentDocument, true);
                }
            }));
        }
        if (typeof vscode.workspace.onDidDeleteFiles === 'function') {
            this.disposables.push(vscode.workspace.onDidDeleteFiles((event) => {
                if (this.currentDocument && event.files.some((uri) => this.isTrackedDocument(uri))) {
                    void this.update(this.currentDocument, true);
                }
            }));
        }
        const projectConfigChange = this.projectConfigProvider?.onDidChange?.((workspaceRoot) => {
            if (!this.currentDocument) {
                return;
            }
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.currentDocument.uri);
            if (workspaceFolder && normalizePath(workspaceFolder.uri.fsPath) === normalizePath(workspaceRoot)) {
                void this.update(this.currentDocument, true);
            }
        });
        if (projectConfigChange) {
            this.disposables.push(projectConfigChange);
        }
    }

    private async handleMessage(message: FunctionDocsToExtensionMessage): Promise<void> {
        if (message.type === 'ready') {
            this.webviewReady = true;
            if (this.acceptedSnapshot) {
                await this.panel.webview.postMessage({ type: 'snapshot', payload: this.acceptedSnapshot });
            }
            return;
        }
        if (message.type === 'refresh') {
            if (message.sessionId === this.sessionId && this.currentDocument) {
                await this.update(this.currentDocument, true);
            }
            return;
        }
        if (message.type === 'searchExternal') {
            await this.searchExternal(message.requestId, message.query, message.scopes);
            return;
        }

        const entry = this.resolveActionEntry(message.entryId, message.revision);
        if (!entry) {
            const rootDocumentChanged = Boolean(
                this.acceptedSnapshot
                && this.currentDocument
                && message.revision === this.acceptedSnapshot.revision
                && this.acceptedSnapshot.rootDocument.uri === this.currentDocument.uri.toString()
                && this.acceptedSnapshot.rootDocument.version !== this.currentDocument.version
            );
            await this.postActionResult(
                false,
                rootDocumentChanged
                    ? '文档已变化，请刷新后重试。'
                    : '面板内容已更新，请重新选择函数。'
            );
            return;
        }

        try {
            if (message.type === 'goToDefinition' && entry.capabilities.canGoToDefinition) {
                await this.goToDefinition(entry);
            } else if (message.type === 'findReferences' && entry.capabilities.canFindReferences) {
                await this.findReferences(entry);
            } else if (message.type === 'authorDocumentation') {
                const allowed = message.mode === 'generate'
                    ? entry.capabilities.canGenerateDocumentation
                    : message.mode === 'complete'
                        ? entry.capabilities.canCompleteDocumentation
                        : entry.capabilities.canUpdateDocumentation;
                if (allowed) {
                    await this.authorDocumentation(entry, message.mode);
                } else {
                    await this.postActionResult(false, '当前声明不允许执行该文档操作。');
                }
            } else {
                await this.postActionResult(false, '当前声明不支持该操作。');
            }
        } catch (error) {
            const actionError = error instanceof Error ? error.message : '未知错误';
            await this.postActionResult(false, `操作失败：${actionError}`);
        }
    }

    private async searchExternal(
        requestId: string,
        query: string,
        scopes: Array<'simulEfun' | 'efun'>
    ): Promise<void> {
        this.latestExternalRequestId = requestId;
        this.externalActionEntries.clear();
        if (!this.currentDocument || !this.isAcceptedSnapshotCurrent()) {
            await this.postMessage({
                type: 'externalSearchResult',
                requestId,
                groups: [],
                entries: [],
                diagnostics: [{
                    code: 'snapshot-stale',
                    severity: 'info',
                    stage: 'analysis',
                    message: '当前文档正在刷新，请稍后重试外部函数搜索。',
                    recoverable: true
                }]
            });
            return;
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(this.currentDocument.uri);
        const projectConfig = workspaceFolder
            ? this.projectConfigProvider?.getWorkspaceProjectConfig(workspaceFolder.uri.fsPath)
            : undefined;
        try {
            const result = await this.snapshotService.searchExternal(this.currentDocument, {
                query,
                scopes,
                projectConfig
            });
            if (requestId !== this.latestExternalRequestId || !this.isAcceptedSnapshotCurrent()) {
                return;
            }
            for (const entry of result.entries) {
                this.externalActionEntries.set(entry.id, entry);
            }
            await this.postMessage({
                type: 'externalSearchResult',
                requestId,
                groups: result.groups,
                entries: result.entries,
                diagnostics: result.diagnostics
            });
        } catch (error) {
            if (requestId !== this.latestExternalRequestId || !this.isAcceptedSnapshotCurrent()) {
                return;
            }
            this.externalActionEntries.clear();
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            await this.postMessage({
                type: 'externalSearchResult',
                requestId,
                groups: [],
                entries: [],
                diagnostics: [{
                    code: 'external-source-unavailable',
                    severity: 'warning',
                    stage: 'external',
                    message: errorMessage,
                    recoverable: true
                }]
            });
            await this.postActionResult(false, `外部函数加载失败：${errorMessage}`);
        }
    }

    private resolveActionEntry(entryId: string, revision: number): FunctionDocumentationPanelEntry | undefined {
        if (
            !this.acceptedSnapshot
            || !this.isAcceptedSnapshotCurrent()
            || revision !== this.acceptedSnapshot.revision
        ) {
            return undefined;
        }
        return this.acceptedSnapshot.entries.find((entry) => entry.id === entryId)
            ?? this.externalActionEntries.get(entryId);
    }

    private isAcceptedSnapshotCurrent(): boolean {
        return Boolean(
            this.acceptedSnapshot
            && this.currentDocument
            && this.acceptedSnapshot.revision === this.latestRequestedRevision
            && this.acceptedSnapshot.rootDocument.uri === this.currentDocument.uri.toString()
            && this.acceptedSnapshot.rootDocument.version === this.currentDocument.version
        );
    }

    private scheduleRefresh(document: vscode.TextDocument, forceFresh = false): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            void this.update(document, forceFresh);
        }, 250);
    }

    private async update(document: vscode.TextDocument, forceFresh: boolean): Promise<void> {
        if (this.disposed) {
            return;
        }
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        this.currentDocument = document;
        this.panel.title = `函数文档: ${getDisplayPath(document)}`;
        const requestedDocumentUri = document.uri.toString();
        const requestedDocumentVersion = document.version;
        const revision = ++this.nextRevision;
        this.latestRequestedRevision = revision;
        this.latestExternalRequestId = undefined;
        this.externalActionEntries.clear();
        this.pendingBuild?.cancel();
        this.pendingBuild?.dispose();
        const cancellationSource = new vscode.CancellationTokenSource();
        this.pendingBuild = cancellationSource;
        await this.postMessage({
            type: 'loading',
            sessionId: this.sessionId,
            revision,
            stage: '正在分析函数与依赖来源'
        });

        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            const projectConfig = workspaceFolder
                ? this.projectConfigProvider?.getWorkspaceProjectConfig(workspaceFolder.uri.fsPath)
                : undefined;
            const snapshot = await this.snapshotService.build(document, {
                sessionId: this.sessionId,
                revision,
                projectConfig,
                forceFresh,
                cancellationToken: cancellationSource.token
            });
            if (
                this.disposed
                || revision !== this.latestRequestedRevision
                || this.currentDocument?.uri.toString() !== requestedDocumentUri
                || this.currentDocument.version !== requestedDocumentVersion
                || snapshot.rootDocument.uri !== requestedDocumentUri
                || snapshot.rootDocument.version !== requestedDocumentVersion
            ) {
                return;
            }
            this.acceptedSnapshot = snapshot;
            await this.postMessage({ type: 'snapshot', payload: snapshot });
        } catch (error) {
            if (
                this.disposed
                || revision !== this.latestRequestedRevision
                || this.currentDocument?.uri.toString() !== requestedDocumentUri
                || this.currentDocument.version !== requestedDocumentVersion
            ) {
                return;
            }
            const message = error instanceof Error ? error.message : '未知错误';
            const failedSnapshot: FunctionDocumentationPanelSnapshot = {
                protocolVersion: 2,
                sessionId: this.sessionId,
                revision,
                rootDocument: {
                    uri: requestedDocumentUri,
                    workspaceRelativePath: getDisplayPath(document),
                    version: requestedDocumentVersion,
                    languageId: 'lpc'
                },
                status: 'failed',
                groups: [],
                entries: [],
                diagnostics: [{
                    code: 'analysis-failed',
                    severity: 'error',
                    stage: 'analysis',
                    message,
                    recoverable: true
                }],
                capabilities: {
                    supportsLiveRefresh: true,
                    supportsExternalSearch: false,
                    supportsDocumentationAuthoring: false
                }
            };
            this.acceptedSnapshot = failedSnapshot;
            await this.postMessage({ type: 'snapshot', payload: failedSnapshot });
        } finally {
            if (this.pendingBuild === cancellationSource) {
                this.pendingBuild.dispose();
                this.pendingBuild = undefined;
            }
        }
    }

    private isTrackedDocument(uri: vscode.Uri): boolean {
        const target = uri.toString();
        return this.currentDocument?.uri.toString() === target
            || this.acceptedSnapshot?.groups.some((group) => group.sourceUri === target) === true;
    }

    private async goToDefinition(entry: FunctionDocumentationPanelEntry): Promise<void> {
        if (!entry.sourceUri || !entry.sourceRange) {
            await this.postActionResult(false, '该函数没有可跳转的源码位置。');
            return;
        }
        const document = await this.textDocumentHost.openTextDocument(vscode.Uri.parse(entry.sourceUri));
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        const range = toVsCodeRange(entry.selectionRange ?? entry.sourceRange);
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }

    private async findReferences(entry: FunctionDocumentationPanelEntry): Promise<void> {
        if (!entry.sourceUri || !(entry.selectionRange ?? entry.sourceRange)) {
            await this.postActionResult(false, '该函数没有可用于查找引用的位置。');
            return;
        }
        const targetRange = toVsCodeRange(entry.selectionRange ?? entry.sourceRange!);
        const uri = vscode.Uri.parse(entry.sourceUri);
        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeReferenceProvider',
            uri,
            targetRange.start
        ) ?? [];
        if (locations.length === 0) {
            await this.postActionResult(true, '未找到引用。');
            return;
        }
        await vscode.commands.executeCommand('editor.action.showReferences', uri, targetRange.start, locations);
    }

    private async authorDocumentation(
        entry: FunctionDocumentationPanelEntry,
        mode: 'generate' | 'complete' | 'update'
    ): Promise<void> {
        if (!entry.sourceUri || !this.acceptedSnapshot || !this.currentDocument) {
            await this.postActionResult(false, '当前声明不可编辑。');
            return;
        }
        if (this.currentDocument.version !== this.acceptedSnapshot.rootDocument.version) {
            await this.postActionResult(false, '文档已变化，请刷新后重试。');
            return;
        }
        const document = await this.textDocumentHost.openTextDocument(vscode.Uri.parse(entry.sourceUri));
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        let removeDuplicateTags = false;
        let removeStaleParamTags = false;
        let removeOrphanParamTags = false;
        const duplicateIssues = entry.quality.issues.filter((issue) =>
            issue.code === 'duplicate-param-tag' || issue.code === 'duplicate-return-tag'
        );
        const staleParameterNames = [...new Set(entry.quality.issues
            .filter((issue) => issue.code === 'stale-parameter-name' && issue.parameterName)
            .map((issue) => issue.parameterName!))];
        const orphanParameterCount = entry.quality.issues
            .filter((issue) => issue.code === 'orphan-param-tag').length;
        if (
            mode === 'update'
            && (duplicateIssues.length > 0 || staleParameterNames.length > 0 || orphanParameterCount > 0)
        ) {
            const detailLines = [
                duplicateIssues.length > 0 ? '• 重复标签：保留首个，移除后续重复块。' : undefined,
                staleParameterNames.length > 0
                    ? `• 过时参数标签：移除 ${staleParameterNames.map((name) => `@param ${name}`).join('、')}。`
                    : undefined,
                orphanParameterCount > 0
                    ? `• 无法识别的参数标签：移除 ${orphanParameterCount} 个孤立 @param 标签块。`
                    : undefined,
                '• 当前签名缺失的参数标签将以 TODO 补充。'
            ].filter((line): line is string => Boolean(line));
            const choice = await vscode.window.showWarningMessage(
                '即将对不一致的文档标签应用安全修复。',
                { modal: true, detail: detailLines.join('\n') },
                '应用安全修复'
            );
            if (choice !== '应用安全修复') {
                await this.postActionResult(false, '已取消文档更新。');
                return;
            }
            removeDuplicateTags = duplicateIssues.length > 0;
            removeStaleParamTags = staleParameterNames.length > 0;
            removeOrphanParamTags = orphanParameterCount > 0;
        }
        const changed = await this.authoringService.apply(editor, entry, mode, {
            removeDuplicateTags,
            removeStaleParamTags,
            removeOrphanParamTags
        });
        if (!changed) {
            await this.postActionResult(true, '当前文档无需补充。');
            return;
        }
        await this.update(document, true);
        await this.postActionResult(true, mode === 'generate' ? '文档骨架已生成。' : '文档缺失项已补全。');
    }

    private async postActionResult(ok: boolean, message: string): Promise<void> {
        await this.postMessage({ type: 'actionResult', ok, message });
    }

    private async postMessage(message: unknown): Promise<void> {
        if (this.webviewReady && !this.disposed) {
            await this.panel.webview.postMessage(message);
        }
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        FunctionDocPanel.currentPanel = undefined;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        this.pendingBuild?.cancel();
        this.pendingBuild?.dispose();
        this.pendingBuild = undefined;
        this.latestExternalRequestId = undefined;
        this.externalActionEntries.clear();
        while (this.disposables.length > 0) {
            this.disposables.pop()?.dispose();
        }
    }
}

function normalizePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+$/u, '').toLocaleLowerCase('en-US');
}

function isLpcSourceDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'lpc' || /\.(?:c|h)$/i.test(document.fileName);
}

function getDisplayPath(document: vscode.TextDocument): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    return workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, document.fileName).replace(/\\/g, '/')
        : path.basename(document.fileName);
}

function toVsCodeRange(range: { start: { line: number; character: number }; end: { line: number; character: number } }): vscode.Range {
    return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}
