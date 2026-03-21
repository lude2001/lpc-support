import * as vscode from 'vscode';
import { VariableAnalyzer, VariableInfo } from './analyzers/VariableAnalyzer';

export class VariableInspectorPanel {
    constructor(private readonly variableAnalyzer: VariableAnalyzer) {}

    public async show(document: vscode.TextDocument): Promise<void> {
        const globalVars = this.variableAnalyzer.findGlobalVariables(document);
        const localVars = this.variableAnalyzer.findLocalVariables(document);
        const unusedVars = this.variableAnalyzer.findUnusedVariables(document, localVars);

        const panel = vscode.window.createWebviewPanel(
            'lpcVariables',
            'LPC 变量列表',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = this.getVariablesHtml(globalVars, localVars, unusedVars);
        panel.webview.onDidReceiveMessage((message) => {
            if (message.command === 'jumpToVariable') {
                const position = new vscode.Position(message.line, message.character);
                vscode.window.showTextDocument(document, {
                    selection: new vscode.Selection(position, position),
                    preserveFocus: false,
                    preview: false
                });
            }
        });
    }

    private getVariablesHtml(
        globalVars: Set<string>,
        localVars: Map<string, VariableInfo>,
        unusedVars: Set<string>
    ): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .variable { cursor: pointer; padding: 2px 5px; }
                    .variable:hover { background-color: #e8e8e8; }
                    .unused { color: #cc0000; }
                    .section { margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="section">
                    <h3>未使用的变量:</h3>
                    ${Array.from(unusedVars).map(varName => {
                        const info = localVars.get(varName);
                        return `<div class="variable unused" data-line="${info?.range.start.line}" data-char="${info?.range.start.character}">
                            - ${info?.type} ${varName}
                        </div>`;
                    }).join('')}
                </div>
                <div class="section">
                    <h3>全局变量:</h3>
                    ${Array.from(globalVars).map(varName =>
                        `<div class="variable">- ${varName}</div>`
                    ).join('')}
                </div>
                <div class="section">
                    <h3>局部变量:</h3>
                    ${Array.from(localVars.entries()).map(([name, info]) =>
                        `<div class="variable" data-line="${info.range.start.line}" data-char="${info.range.start.character}">
                            - ${info.type} ${name}
                        </div>`
                    ).join('')}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.querySelectorAll('.variable').forEach(el => {
                        el.addEventListener('click', () => {
                            const line = el.getAttribute('data-line');
                            const char = el.getAttribute('data-char');
                            if (line !== null && char !== null) {
                                vscode.postMessage({
                                    command: 'jumpToVariable',
                                    line: parseInt(line),
                                    character: parseInt(char)
                                });
                            }
                        });
                    });
                </script>
            </body>
            </html>
        `;
    }
}
