import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function renderFunctionDocPanelHtml(
    baseDir: string,
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    nonce: string
): string {
    const template = loadTemplate(baseDir);
    if (!template) {
        return getFallbackContent();
    }

    const templateRoot = vscode.Uri.joinPath(extensionUri, 'dist', 'templates');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(templateRoot, 'functionDocPanel.js')).toString();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(templateRoot, 'functionDocPanel.css')).toString();

    return template
        .replace(/\{\{cspSource\}\}/g, webview.cspSource)
        .replace(/\{\{nonce\}\}/g, nonce)
        .replace(/\{\{scriptUri\}\}/g, scriptUri)
        .replace(/\{\{styleUri\}\}/g, styleUri);
}

function loadTemplate(baseDir: string): string | undefined {
    const candidates = [
        path.join(baseDir, 'templates', 'functionDocPanel.html'),
        path.join(baseDir, '..', 'src', 'templates', 'functionDocPanel.html')
    ];

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return fs.readFileSync(candidate, 'utf8');
            }
        } catch (error) {
            console.error('Failed to read function documentation template:', error);
        }
    }
    return undefined;
}

function getFallbackContent(): string {
    return `<!DOCTYPE html><html lang="zh-CN"><body><h3>无法加载函数文档中心</h3><p>模板资源不可用。</p></body></html>`;
}
