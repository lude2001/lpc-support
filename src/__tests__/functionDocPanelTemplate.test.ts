import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { JSDOM } from 'jsdom';
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

    test.each([
        { language: 'en', lang: 'en', heading: 'Function Documentation Center', refresh: 'Refresh function documentation' },
        { language: 'zh-cn', lang: 'zh-CN', heading: '函数文档中心', refresh: '刷新函数文档' },
        { language: 'de', lang: 'en', heading: 'Function Documentation Center', refresh: 'Refresh function documentation' }
    ])('renders localized static text and attributes for $language', ({ language, lang, heading, refresh }) => {
        const localizationEnv = vscode.env as { language: string };
        localizationEnv.language = language;
        const webview = {
            cspSource: 'vscode-webview://secure-source', asWebviewUri: jest.fn((uri: vscode.Uri) => uri)
        } as unknown as vscode.Webview;
        let dom: JSDOM | undefined;
        try {
            const html = renderFunctionDocPanelHtml(path.join(__dirname, '..'), webview, vscode.Uri.file('D:/extension'), 'locale-nonce');
            dom = new JSDOM(html);
            expect(dom.window.document.documentElement.lang).toBe(lang);
            expect(dom.window.document.querySelector('h1')?.textContent).toBe(heading);
            expect(dom.window.document.getElementById('refresh-button')?.getAttribute('aria-label')).toBe(refresh);
            expect(dom.window.document.getElementById('search-input')?.getAttribute('aria-label')).toBe(
                language === 'zh-cn' ? '搜索函数文档' : 'Search function documentation'
            );
            const resource = dom.window.document.getElementById('function-panel-localization');
            expect(resource?.getAttribute('type')).toBe('application/json');
            expect(resource?.getAttribute('nonce')).toBe('locale-nonce');
            expect(JSON.parse(resource!.textContent!).locale).toBe(language === 'zh-cn' ? 'zh-cn' : 'en');
            expect(html).not.toMatch(/\{\{\w+\}\}/);
        } finally {
            dom?.window.close();
            localizationEnv.language = 'zh-cn';
        }
    });

    test('escapes static translations and the JSON bootstrap without permitting script termination', () => {
        const localizationEnv = vscode.env as { language: string };
        localizationEnv.language = 'zh-cn';
        const hostile = '</script><script>throw new Error("injected")</script><img src=x onerror="alert(1)"> & \'quoted\'';
        const translate = jest.spyOn(vscode.l10n, 't').mockReturnValue(hostile);
        const bundle = jest.spyOn(vscode.l10n, 'bundle', 'get').mockReturnValue({ 'No matching declarations': hostile });
        let dom: JSDOM | undefined;
        try {
            const html = renderFunctionDocPanelHtml(path.join(__dirname, '..'), {
                cspSource: 'vscode-webview://secure-source', asWebviewUri: (uri: vscode.Uri) => uri
            } as unknown as vscode.Webview, vscode.Uri.file('D:/extension'), 'safe-nonce');
            dom = new JSDOM(html);
            expect(html).not.toContain(hostile);
            expect(html).toContain('\\u003c/script\\u003e');
            expect(dom.window.document.querySelectorAll('script')).toHaveLength(2);
            expect(dom.window.document.querySelectorAll('img')).toHaveLength(0);
            expect(dom.window.document.querySelector('h1')?.textContent).toBe(hostile);
            expect(dom.window.document.getElementById('refresh-button')?.getAttribute('aria-label')).toBe(hostile);
            const resource = JSON.parse(dom.window.document.getElementById('function-panel-localization')!.textContent!);
            expect(resource.messages['No matching declarations']).toBe(hostile);
            expect(resource).not.toHaveProperty('entries');
            expect(resource).not.toHaveProperty('source');
        } finally {
            dom?.window.close();
            bundle.mockRestore();
            translate.mockRestore();
            localizationEnv.language = 'zh-cn';
        }
    });

    test.each(['en', 'zh-cn'])('localizes the missing-template fallback in %s', (language) => {
        const localizationEnv = vscode.env as { language: string };
        localizationEnv.language = language;
        let dom: JSDOM | undefined;
        try {
            dom = new JSDOM(renderFunctionDocPanelHtml(
                path.join(__dirname, 'missing-function-panel-template'),
                {} as vscode.Webview, vscode.Uri.file('D:/extension'), 'fallback-nonce'
            ));
            expect(dom.window.document.documentElement.lang).toBe(language === 'zh-cn' ? 'zh-CN' : 'en');
            expect(dom.window.document.querySelector('h3')?.textContent).toBe(language === 'zh-cn'
                ? '无法加载函数文档中心' : 'Could not load the Function Documentation Center');
            expect(dom.window.document.querySelector('p')?.textContent).toBe(language === 'zh-cn'
                ? '模板资源不可用。' : 'Template resources are unavailable.');
            expect(dom.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toBe("default-src 'none';");
        } finally {
            dom?.window.close();
            localizationEnv.language = 'zh-cn';
        }
    });

    test('constrains wide and narrow workspace tracks so list and detail panes own scrolling', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'templates', 'functionDocPanel.css'), 'utf8');

        expect(css).toMatch(/\.workspace\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
        expect(css).toMatch(/\.catalog\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/su);
        expect(css).toMatch(/\.function-list,\s*\.detail-panel\s*\{[^}]*overflow:\s*auto;/su);
        expect(css).toMatch(/@media\s*\(max-width:\s*500px\)[\s\S]*grid-template-rows:\s*minmax\(0,\s*42vh\)\s*minmax\(0,\s*1fr\);/su);
    });
});
