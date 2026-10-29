import * as vscode from 'vscode';
import { resolveUiLocale } from '../localization/locale';
import type { LspClientManager } from '../lsp/client/LspClientManager';
import { WORKSPACE_INDEX_CHANGED_NOTIFICATION } from '../lsp/shared/protocol/workspaceIndex';

interface LspRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
}

interface RustVariableEntry {
    name: string;
    detail: string;
    range: LspRange;
    local: boolean;
    unused: boolean;
}

interface RustDiagnostic {
    range: LspRange;
    severity?: number;
    code?: string;
    source?: string;
    message: string;
}

interface WorkspaceDiagnosticsEntry {
    uri: string;
    diagnostics: RustDiagnostic[];
}

export interface DiagnosticsCommands extends vscode.Disposable {
    showVariables(): Promise<void>;
    scanFolder(): Promise<void>;
}

export class RustDiagnosticsCommands implements DiagnosticsCommands {
    private readonly diagnosticCollection = vscode.languages.createDiagnosticCollection('lpc-folder-scan');
    private scannedUriPrefix: string | undefined;
    private scanRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    private scanRevision = 0;
    private readonly variablePanels = new Map<string, { panel: vscode.WebviewPanel; document: vscode.TextDocument }>();
    private variableRefreshTimer: ReturnType<typeof setTimeout> | undefined;
    private variableRefreshGeneration = 0;

    public constructor(
        context: vscode.ExtensionContext,
        private readonly manager: LspClientManager | undefined
    ) {
        context.subscriptions.push(this.diagnosticCollection);
        if (typeof manager?.onNotification === 'function') {
            context.subscriptions.push(manager.onNotification(
                WORKSPACE_INDEX_CHANGED_NOTIFICATION,
                () => this.scheduleSnapshotRefresh()
            ));
        }
        if (typeof vscode.workspace.onDidChangeTextDocument === 'function') {
            context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
                if (this.variablePanels.has(event.document.uri.toString())) {
                    this.scheduleVariableRefresh();
                }
            }));
        }
    }

    public async showVariables(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showInformationMessage(vscode.l10n.t('Open an LPC source or header file first.'));
            return;
        }
        const variables = await this.manager?.sendRequest<RustVariableEntry[]>('lpc/documentVariables', {
            textDocument: { uri: editor.document.uri.toString() }
        });
        if (!variables) {
            vscode.window.showErrorMessage(vscode.l10n.t('The Rust LPC language server is not ready. Variables cannot be loaded.'));
            return;
        }
        this.showVariablesPanel(editor.document, variables);
    }

    public async scanFolder(): Promise<void> {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: vscode.l10n.t('Select a folder to scan')
        });
        if (!folders?.[0]) {
            return;
        }
        const folder = folders[0];
        const output = vscode.window.createOutputChannel(vscode.l10n.t('LPC Variable Check'));
        output.show();
        output.appendLine(vscode.l10n.t('Scanning folder: {0}', folder.fsPath));
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Checking LPC files using the Rust index...'),
                cancellable: false
            }, async () => {
                const uriPrefix = `${folder.toString().replace(/\/$/, '')}/`;
                this.scannedUriPrefix = uriPrefix;
                const revision = ++this.scanRevision;
                const entries = await this.manager?.sendRequest<WorkspaceDiagnosticsEntry[]>(
                    'lpc/workspaceDiagnostics',
                    { uriPrefix }
                );
                if (!entries) {
                    throw new Error(vscode.l10n.t('The Rust LPC language server is not ready.'));
                }
                if (revision !== this.scanRevision || this.scannedUriPrefix !== uriPrefix) return;
                this.diagnosticCollection.clear();
                let diagnosticCount = 0;
                for (const entry of entries) {
                    const diagnostics = entry.diagnostics.map(toVsCodeDiagnostic);
                    diagnosticCount += diagnostics.length;
                    this.diagnosticCollection.set(vscode.Uri.parse(entry.uri), diagnostics);
                    output.appendLine(`${vscode.Uri.parse(entry.uri).fsPath}: ${diagnostics.length}`);
                }
                output.appendLine(vscode.l10n.t('Scan finished: {0} files, {1} diagnostics.', entries.length, diagnosticCount));
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            output.appendLine(vscode.l10n.t('Scan failed: {0}', message));
            vscode.window.showErrorMessage(vscode.l10n.t('LPC folder scan failed: {0}', message));
        }
    }

    public dispose(): void {
        if (this.scanRefreshTimer) clearTimeout(this.scanRefreshTimer);
        if (this.variableRefreshTimer) clearTimeout(this.variableRefreshTimer);
        this.variablePanels.clear();
        this.diagnosticCollection.dispose();
    }

    private scheduleSnapshotRefresh(): void {
        if (this.scannedUriPrefix) {
            this.scanRevision += 1;
            if (this.scanRefreshTimer) clearTimeout(this.scanRefreshTimer);
            this.scanRefreshTimer = setTimeout(() => {
                this.scanRefreshTimer = undefined;
                void this.refreshScannedFolder();
            }, 1000);
        }
        this.scheduleVariableRefresh();
    }

    private async refreshScannedFolder(): Promise<void> {
        const uriPrefix = this.scannedUriPrefix;
        if (!uriPrefix) return;
        const revision = ++this.scanRevision;
        try {
            const entries = await this.manager?.sendRequest<WorkspaceDiagnosticsEntry[]>(
                'lpc/workspaceDiagnostics', { uriPrefix }
            );
            if (!entries || revision !== this.scanRevision || this.scannedUriPrefix !== uriPrefix) return;
            this.diagnosticCollection.clear();
            for (const entry of entries) {
                this.diagnosticCollection.set(
                    vscode.Uri.parse(entry.uri), entry.diagnostics.map(toVsCodeDiagnostic)
                );
            }
        } catch (error) {
            console.error('[lpc] Failed to refresh scanned folder diagnostics', error);
        }
    }

    private scheduleVariableRefresh(): void {
        if (this.variablePanels.size === 0) return;
        this.variableRefreshGeneration += 1;
        if (this.variableRefreshTimer) clearTimeout(this.variableRefreshTimer);
        this.variableRefreshTimer = setTimeout(() => {
            this.variableRefreshTimer = undefined;
            void this.refreshVariablePanels();
        }, 250);
    }

    private async refreshVariablePanels(): Promise<void> {
        const generation = this.variableRefreshGeneration;
        for (const [uri, current] of this.variablePanels) {
            const version = current.document.version;
            try {
                const variables = await this.manager?.sendRequest<RustVariableEntry[]>(
                    'lpc/documentVariables', { textDocument: { uri } }
                );
                if (!variables || this.variablePanels.get(uri) !== current
                    || current.document.version !== version
                    || generation !== this.variableRefreshGeneration) continue;
                current.panel.webview.html = renderVariablesHtml(
                    variables.filter((entry) => entry.unused),
                    variables.filter((entry) => !entry.local),
                    variables.filter((entry) => entry.local)
                );
            } catch (error) {
                console.error('[lpc] Failed to refresh variable list', error);
            }
        }
    }

    private showVariablesPanel(document: vscode.TextDocument, variables: RustVariableEntry[]): void {
        const panel = vscode.window.createWebviewPanel(
            'lpcVariables',
            vscode.l10n.t('LPC Variables'),
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        const unused = variables.filter((entry) => entry.unused);
        const globals = variables.filter((entry) => !entry.local);
        const locals = variables.filter((entry) => entry.local);
        panel.webview.html = renderVariablesHtml(unused, globals, locals);
        const uri = document.uri.toString();
        this.variablePanels.set(uri, { panel, document });
        panel.onDidDispose(() => {
            if (this.variablePanels.get(uri)?.panel === panel) this.variablePanels.delete(uri);
        });
        panel.webview.onDidReceiveMessage((message: { command?: string; line?: number; character?: number }) => {
            if (message.command !== 'jumpToVariable'
                || typeof message.line !== 'number'
                || typeof message.character !== 'number') {
                return;
            }
            const position = new vscode.Position(message.line, message.character);
            void vscode.window.showTextDocument(document, {
                selection: new vscode.Selection(position, position),
                preserveFocus: false,
                preview: false
            });
        });
    }
}

function toVsCodeDiagnostic(diagnostic: RustDiagnostic): vscode.Diagnostic {
    const value = new vscode.Diagnostic(
        toVsCodeRange(diagnostic.range),
        diagnostic.message,
        toDiagnosticSeverity(diagnostic.severity)
    );
    value.code = diagnostic.code;
    value.source = diagnostic.source ?? 'lpc-support';
    return value;
}

function toDiagnosticSeverity(severity: number | undefined): vscode.DiagnosticSeverity {
    switch (severity) {
        case 1: return vscode.DiagnosticSeverity.Error;
        case 3: return vscode.DiagnosticSeverity.Information;
        case 4: return vscode.DiagnosticSeverity.Hint;
        default: return vscode.DiagnosticSeverity.Warning;
    }
}

function toVsCodeRange(range: LspRange): vscode.Range {
    return new vscode.Range(
        range.start.line,
        range.start.character,
        range.end.line,
        range.end.character
    );
}

function renderVariablesHtml(
    unused: RustVariableEntry[],
    globals: RustVariableEntry[],
    locals: RustVariableEntry[]
): string {
    return `<!DOCTYPE html>
<html lang="${resolveUiLocale(vscode.env.language)}"><head><style>
.variable { cursor: pointer; padding: 2px 5px; }
.variable:hover { background-color: var(--vscode-list-hoverBackground); }
.unused { color: var(--vscode-errorForeground); }
.section { margin-bottom: 20px; }
</style></head><body>
${renderVariableSection(vscode.l10n.t('Unused variables'), unused, 'unused')}
${renderVariableSection(vscode.l10n.t('Global variables'), globals)}
${renderVariableSection(vscode.l10n.t('Local variables'), locals)}
<script>
const vscode = acquireVsCodeApi();
document.querySelectorAll('[data-line]').forEach((element) => {
    element.addEventListener('click', () => vscode.postMessage({
        command: 'jumpToVariable',
        line: Number(element.dataset.line),
        character: Number(element.dataset.character)
    }));
});
</script></body></html>`;
}

function renderVariableSection(title: string, entries: RustVariableEntry[], className = ''): string {
    const items = entries.map((entry) =>
        `<div class="variable ${className}" data-line="${entry.range.start.line}" data-character="${entry.range.start.character}">- ${escapeHtml(entry.detail || entry.name)}</div>`
    ).join('');
    return `<div class="section"><h3>${escapeHtml(title)}:</h3>${items || `<div>${escapeHtml(vscode.l10n.t('(None)'))}</div>`}</div>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
