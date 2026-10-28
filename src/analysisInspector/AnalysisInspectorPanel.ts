import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import type { Location } from 'vscode-languageserver-protocol';
import type { LspClientManager } from '../lsp/client/LspClientManager';
import { ANALYSIS_INSPECTION_METHOD, type AnalysisInspection } from '../lsp/shared/protocol/analysisInspection';
import { inspectionHtml, renderInspection } from './renderInspection';

export class AnalysisInspectorPanel implements vscode.Disposable {
    private readonly subscriptions: vscode.Disposable[] = [];
    private editor: vscode.TextEditor | undefined;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private generation = 0;
    private disposed = false;
    private locations: Location[] = [];

    public constructor(private readonly panel: vscode.WebviewPanel, private readonly manager: LspClientManager) {
        this.editor = vscode.window.activeTextEditor;
        panel.webview.html = inspectionHtml(randomBytes(16).toString('hex'));
        this.subscriptions.push(
            panel.onDidDispose(() => this.dispose()),
            panel.onDidChangeViewState(() => { if (panel.visible) this.schedule(); }),
            panel.webview.onDidReceiveMessage(message => { void this.onMessage(message); }),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor?.document.languageId === 'lpc') { this.editor = editor; this.schedule(); }
            }),
            vscode.window.onDidChangeTextEditorSelection(event => {
                if (event.textEditor.document.languageId === 'lpc') { this.editor = event.textEditor; this.schedule(); }
            }),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'lpc') this.schedule();
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                if (document.uri.toString() === this.editor?.document.uri.toString()) {
                    this.editor = undefined;
                    this.schedule();
                }
            }),
            manager.onNotification('lpc/workspaceIndex/changed', () => this.schedule()),
            manager.onNotification('lpc/workspaceIndex/ready', () => this.schedule())
        );
    }

    public reveal(): void { this.panel.reveal(vscode.ViewColumn.Beside, true); this.schedule(); }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.generation++;
        clearTimeout(this.timer);
        this.subscriptions.splice(0).forEach(subscription => subscription.dispose());
        this.panel.dispose();
    }

    private schedule(): void {
        this.generation++;
        this.locations = [];
        clearTimeout(this.timer);
        if (!this.disposed && this.panel.visible) this.timer = setTimeout(() => { void this.refresh(); }, 180);
    }

    private async refresh(): Promise<void> {
        const generation = ++this.generation;
        const editor = this.editor;
        if (!editor || editor.document.languageId !== 'lpc' || editor.document.isClosed) {
            this.locations = [];
            await this.panel.webview.postMessage({ type: 'empty', status: vscode.l10n.t('Open an LPC file and place the cursor at the position to inspect.') });
            return;
        }
        const uri = editor.document.uri.toString();
        const version = editor.document.version;
        const position = editor.selection.active;
        try {
            const model = await this.manager.sendRequest<AnalysisInspection | null>(ANALYSIS_INSPECTION_METHOD, {
                textDocument: { uri }, position: { line: position.line, character: position.character }
            });
            if (this.disposed || generation !== this.generation || editor.document.version !== version) return;
            if (!model || model.uri !== uri || model.version !== version) {
                this.locations = [];
                await this.panel.webview.postMessage({ type: 'empty', status: vscode.l10n.t('The analysis snapshot for this document is not ready. Refresh shortly.') });
                return;
            }
            const view = renderInspection(model, target => vscode.workspace.asRelativePath(vscode.Uri.parse(target), true));
            this.locations = view.locations;
            await this.panel.webview.postMessage({ type: 'snapshot', status: vscode.l10n.t('Version {0} · Updated', version), generation, view });
        } catch (error) {
            if (this.disposed || generation !== this.generation) return;
            this.locations = [];
            await this.panel.webview.postMessage({ type: 'empty', status: vscode.l10n.t('Failed to read analysis: {0}', error instanceof Error ? error.message : String(error)) });
        }
    }

    private async onMessage(message: unknown): Promise<void> {
        if (!message || typeof message !== 'object' || this.disposed) return;
        const payload = message as { type?: string; index?: number; generation?: number };
        if (payload.type === 'ready' || payload.type === 'refresh') { this.schedule(); return; }
        if (payload.type !== 'open' || !Number.isInteger(payload.index) || payload.generation !== this.generation) return;
        const location = this.locations[payload.index!];
        if (!location) return;
        const uri = vscode.Uri.parse(location.uri);
        if (uri.scheme !== 'file') return;
        try {
            const range = new vscode.Range(location.range.start.line, location.range.start.character, location.range.end.line, location.range.end.character);
            await vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.One, selection: range });
        } catch (error) {
            vscode.window.showErrorMessage(vscode.l10n.t('Could not open the analysis source: {0}', error instanceof Error ? error.message : String(error)));
        }
    }
}

export function registerAnalysisInspector(context: vscode.ExtensionContext, manager?: LspClientManager): void {
    let current: AnalysisInspectorPanel | undefined;
    context.subscriptions.push(vscode.commands.registerCommand('lpc.showAnalysisInspector', () => {
        if (!manager) { vscode.window.showErrorMessage(vscode.l10n.t('The Rust language server has not started.')); return; }
        if (current) { current.reveal(); return; }
        const panel = vscode.window.createWebviewPanel('lpcAnalysisInspector', vscode.l10n.t('LPC Analysis Inspector'), { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
            enableScripts: true, localResourceRoots: []
        });
        current = new AnalysisInspectorPanel(panel, manager);
        panel.onDidDispose(() => { current = undefined; });
    }), { dispose: () => current?.dispose() });
}
