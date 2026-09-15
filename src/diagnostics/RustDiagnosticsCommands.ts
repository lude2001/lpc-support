import * as vscode from 'vscode';
import type { LspClientManager } from '../lsp/client/LspClientManager';

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

    public constructor(
        context: vscode.ExtensionContext,
        private readonly manager: LspClientManager | undefined
    ) {
        context.subscriptions.push(this.diagnosticCollection);
    }

    public async showVariables(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'lpc') {
            vscode.window.showInformationMessage('请先打开一个 LPC 源文件或头文件。');
            return;
        }
        const variables = await this.manager?.sendRequest<RustVariableEntry[]>('lpc/documentVariables', {
            textDocument: { uri: editor.document.uri.toString() }
        });
        if (!variables) {
            vscode.window.showErrorMessage('Rust LPC 语言服务器尚未就绪，无法读取变量。');
            return;
        }
        this.showVariablesPanel(editor.document, variables);
    }

    public async scanFolder(): Promise<void> {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择要扫描的文件夹'
        });
        if (!folders?.[0]) {
            return;
        }
        const folder = folders[0];
        const output = vscode.window.createOutputChannel('LPC 变量检查');
        output.show();
        output.appendLine(`开始扫描文件夹: ${folder.fsPath}`);
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在使用 Rust 索引检查 LPC 文件...',
                cancellable: false
            }, async () => {
                const uriPrefix = `${folder.toString().replace(/\/$/, '')}/`;
                const entries = await this.manager?.sendRequest<WorkspaceDiagnosticsEntry[]>(
                    'lpc/workspaceDiagnostics',
                    { uriPrefix }
                );
                if (!entries) {
                    throw new Error('Rust LPC 语言服务器尚未就绪');
                }
                this.diagnosticCollection.clear();
                let diagnosticCount = 0;
                for (const entry of entries) {
                    const diagnostics = entry.diagnostics.map(toVsCodeDiagnostic);
                    diagnosticCount += diagnostics.length;
                    this.diagnosticCollection.set(vscode.Uri.parse(entry.uri), diagnostics);
                    output.appendLine(`${vscode.Uri.parse(entry.uri).fsPath}: ${diagnostics.length}`);
                }
                output.appendLine(`扫描完成：${entries.length} 个文件，${diagnosticCount} 条诊断。`);
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            output.appendLine(`扫描失败: ${message}`);
            vscode.window.showErrorMessage(`LPC 文件夹扫描失败: ${message}`);
        }
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }

    private showVariablesPanel(document: vscode.TextDocument, variables: RustVariableEntry[]): void {
        const panel = vscode.window.createWebviewPanel(
            'lpcVariables',
            'LPC 变量列表',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );
        const unused = variables.filter((entry) => entry.unused);
        const globals = variables.filter((entry) => !entry.local);
        const locals = variables.filter((entry) => entry.local);
        panel.webview.html = renderVariablesHtml(unused, globals, locals);
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
<html><head><style>
.variable { cursor: pointer; padding: 2px 5px; }
.variable:hover { background-color: var(--vscode-list-hoverBackground); }
.unused { color: var(--vscode-errorForeground); }
.section { margin-bottom: 20px; }
</style></head><body>
${renderVariableSection('未使用的变量', unused, 'unused')}
${renderVariableSection('全局变量', globals)}
${renderVariableSection('局部变量', locals)}
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
    return `<div class="section"><h3>${title}:</h3>${items || '<div>（无）</div>'}</div>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
