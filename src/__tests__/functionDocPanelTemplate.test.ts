import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import { renderFunctionDocPanelHtml } from '../functionDocPanelTemplate';

describe('function documentation Webview security boundary', () => {
    test('uses static resources and a restrictive CSP without embedding workspace text', () => {
        const webview = {
            cspSource: 'vscode-webview://secure-source',
            asWebviewUri: jest.fn((uri: vscode.Uri) => uri)
        } as unknown as vscode.Webview;
        const html = renderFunctionDocPanelHtml(
            path.join(__dirname, '..'),
            webview,
            vscode.Uri.file('D:/code/lpc-support'),
            'fixed-nonce'
        );

        expect(html).toContain("default-src 'none'");
        expect(html).toContain("script-src 'nonce-fixed-nonce'");
        expect(html).toContain('functionDocPanel.css');
        expect(html).toContain('functionDocPanel.js');
        expect(html).not.toContain('window.initialData');
        expect(html).not.toContain('</script><script>alert(1)</script>');
    });

    test('renders untrusted values through text nodes only', () => {
        const script = fs.readFileSync(path.join(__dirname, '..', 'templates', 'functionDocPanel.js'), 'utf8');

        expect(script).not.toContain('.innerHTML');
        expect(script).not.toContain('insertAdjacentHTML');
        expect(script).toContain('element.textContent = options.text');
    });

    test('constrains wide and narrow workspace tracks so list and detail panes own scrolling', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'templates', 'functionDocPanel.css'), 'utf8');

        expect(css).toMatch(/\.workspace\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
        expect(css).toMatch(/\.catalog\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
        expect(css).toMatch(/\.function-list,\s*\.detail-panel\s*\{[^}]*overflow:\s*auto;/su);
        expect(css).toMatch(/@media\s*\(max-width:\s*500px\)[\s\S]*grid-template-rows:\s*minmax\(0,\s*42vh\)\s*minmax\(0,\s*1fr\);/su);
    });
});
