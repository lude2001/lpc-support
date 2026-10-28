import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import * as vscode from 'vscode';
import { describe, expect, jest, test } from '@jest/globals';
import type { FunctionDocumentationPanelSnapshot } from '../contracts/FunctionDocumentationPanelProtocol';
import { renderFunctionDocPanelHtml } from '../../functionDocPanelTemplate';

type PanelOutboundMessage = {
    type: string;
    protocolVersion?: number;
    requestId?: string;
    query?: string;
    scopes?: string[];
};

function createSnapshot(): FunctionDocumentationPanelSnapshot {
    const sourceUri = 'file:///D:/项目/feature/damage.c';
    return {
        protocolVersion: 2,
        sessionId: 'session',
        revision: 7,
        rootDocument: { uri: sourceUri, workspaceRelativePath: 'feature/damage.c', version: 3, languageId: 'lpc' },
        status: 'ready', diagnostics: [],
        capabilities: { supportsLiveRefresh: true, supportsExternalSearch: false, supportsDocumentationAuthoring: true },
        groups: [{
            id: `local:${sourceUri}`, sourceKind: 'local', sourceUri, displayLabel: '当前文件', depth: 0,
            entryIds: ['die-entry'], diagnostics: []
        }, {
            id: 'include:file:///D:/项目/include/恶意.h', sourceKind: 'include',
            sourceUri: 'file:///D:/项目/include/恶意.h', workspaceRelativePath: 'include/恶意.h',
            displayLabel: '包含自 </script><script>throw new Error("injected")</script>', depth: 1,
            entryIds: ['hostile-entry'], diagnostics: []
        }],
        entries: [{
            id: 'die-entry', declarationKey: 'die-entry', name: 'die', sourceKind: 'local',
            sourceGroupId: `local:${sourceUri}`, declarationKind: 'implementation', sourceUri,
            sourceRange: { start: { line: 8, character: 0 }, end: { line: 11, character: 1 } },
            selectionRange: { start: { line: 8, character: 13 }, end: { line: 8, character: 16 } },
            signatures: [{
                label: 'varargs void die(object killer)', returnType: 'void',
                parameters: [{ name: 'killer', type: 'object', description: '杀死角色的对象', optional: false, variadic: false }],
                isParameterVariadic: false, isFunctionVarargs: true, arity: { min: 0, max: 1 }
            }],
            documentation: {
                hasAttachedComment: true, summary: '处理角色死亡逻辑', details: '处理角色死亡的全部流程。',
                returns: { type: 'void', description: '无返回值。' }
            },
            quality: { status: 'complete', issues: [], action: 'none' },
            relation: { status: 'none', relatedEntryIds: [], relatedSourceUris: [] }, modifiers: ['varargs'],
            capabilities: {
                canGoToDefinition: true, canFindReferences: true, canCopySignature: true,
                canGenerateDocumentation: false, canCompleteDocumentation: false, canUpdateDocumentation: false
            }
        }, {
            id: 'hostile-entry', declarationKey: 'hostile-entry',
            name: '"double" \'single\' <ul class="param-list"> &lt;entities&gt;', sourceKind: 'include',
            sourceGroupId: 'include:file:///D:/项目/include/恶意.h', declarationKind: 'prototype',
            signatures: [{
                label: 'int hostile(string path)', returnType: 'int',
                parameters: [{ name: 'path', type: 'string', description: 'C:\\路径 包含 空格', optional: false, variadic: false }],
                isParameterVariadic: false, isFunctionVarargs: false
            }],
            documentation: { hasAttachedComment: true, summary: '</script><script>throw new Error("injected")</script>' },
            quality: { status: 'complete', issues: [], action: 'none' },
            relation: { status: 'none', relatedEntryIds: [], relatedSourceUris: [] }, modifiers: [],
            capabilities: {
                canGoToDefinition: false, canFindReferences: false, canCopySignature: true,
                canGenerateDocumentation: false, canCompleteDocumentation: false, canUpdateDocumentation: false
            }
        }]
    };
}

function createHarness(
    language = 'zh-cn',
    configure?: (document: Document) => void
): { dom: JSDOM; postMessage: jest.Mock<(message: PanelOutboundMessage) => void> } {
    const localizationEnv = vscode.env as { language: string };
    let html: string;
    try {
        localizationEnv.language = language;
        html = renderFunctionDocPanelHtml(path.join(__dirname, '..', '..'), {
            cspSource: 'vscode-webview://test', asWebviewUri: (uri: vscode.Uri) => uri
        } as unknown as vscode.Webview, vscode.Uri.file('D:/extension'), 'dom-test-nonce');
    } finally {
        localizationEnv.language = 'zh-cn';
    }
    const script = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'functionDocPanel.js'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://webview.invalid/' });
    configure?.(dom.window.document);
    const postMessage = jest.fn<(message: PanelOutboundMessage) => void>();
    (dom.window as any).acquireVsCodeApi = () => ({ postMessage, setState: jest.fn(), getState: jest.fn() });
    dom.window.eval(script);
    return { dom, postMessage };
}

describe('function documentation Webview DOM', () => {
    test.each(['en', 'zh-cn'])('localizes static, dynamic, accessible, search, and error states in %s', (language) => {
        const { dom, postMessage } = createHarness(language);
        const document = dom.window.document;
        const chinese = language === 'zh-cn';
        try {
            expect(document.documentElement.lang).toBe(chinese ? 'zh-CN' : 'en');
            expect(document.querySelector('h1')?.textContent).toBe(chinese ? '函数文档中心' : 'Function Documentation Center');
            expect(document.getElementById('function-list')?.getAttribute('aria-label')).toBe(chinese ? '函数声明列表' : 'Function declaration list');
            expect(document.getElementById('search-input')?.getAttribute('aria-label')).toBe(chinese ? '搜索函数文档' : 'Search function documentation');
            expect(document.getElementById('status-text')?.textContent).toBe(chinese ? '正在连接语言服务' : 'Connecting to the language service');
            expect(document.querySelector('#detail-panel h2')?.textContent).toBe(chinese ? '选择一个函数' : 'Select a function');
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'loading', sessionId: 'session' } }));
            expect(document.getElementById('status-text')?.textContent).toBe(chinese ? '正在刷新' : 'Refreshing');

            const snapshot = createSnapshot();
            snapshot.entries[0].signatures[0].parameters[0].optional = true;
            snapshot.entries[0].signatures[0].parameters[0].variadic = true;
            snapshot.entries[0].signatures[0].parameters[0].defaultValueText = 'literal_中文';
            snapshot.entries[0].signatures.push({
                label: 'void die()', returnType: 'void', parameters: [], isFunctionVarargs: false, isParameterVariadic: false
            });
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'snapshot', payload: snapshot } }));
            expect(document.getElementById('status-text')?.textContent).toBe(chinese ? '2 个声明' : '2 declarations');
            expect(document.querySelector('.source-line')?.textContent).toBe(chinese ? '第 9 行，第 14 列' : 'Line 9, column 14');
            expect(document.querySelector('.signature-tab')?.textContent).toBe(chinese ? '签名 1' : 'Signature 1');
            expect(document.querySelector('.parameter-table')?.textContent).toContain(chinese ? '默认 literal_中文' : 'Default literal_中文');
            expect(document.querySelector('.parameter-table')?.textContent).toContain('杀死角色的对象');
            expect(document.querySelector('.quality-panel')?.textContent).toContain(chinese ? '文档状态：完整' : 'Documentation status: Complete');
            const references = [...document.querySelectorAll('.action-button')].find(button =>
                button.textContent === (chinese ? '查找引用' : 'Find references')) as HTMLButtonElement;
            references.click();
            expect(postMessage).toHaveBeenCalledWith({ type: 'findReferences', entryId: 'die-entry', revision: 7 });

            (document.querySelector('[data-filter-value="include"]') as HTMLButtonElement).click();
            const search = document.getElementById('search-input') as HTMLInputElement;
            search.value = 'HOSTILE';
            search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
            expect(document.querySelectorAll('.function-row')).toHaveLength(1);
            expect(document.querySelector('.function-row')?.getAttribute('data-entry-id')).toBe('hostile-entry');
            search.value = 'no_such_function';
            search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
            expect(document.querySelector('#function-list h2')?.textContent).toBe(chinese ? '没有匹配的声明' : 'No matching declarations');
            document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'K', ctrlKey: true, bubbles: true }));
            expect(document.activeElement).toBe(search);

            const failed = createSnapshot();
            failed.revision = 8;
            failed.status = 'failed';
            failed.groups = [];
            failed.entries = [];
            failed.diagnostics = [{
                code: 'analysis-failed', severity: 'error', stage: 'analysis', recoverable: true,
                message: 'Driver <raw> error {0}'
            }];
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'snapshot', payload: failed } }));
            expect(document.getElementById('status-text')?.textContent).toBe(chinese
                ? '分析失败 · Driver <raw> error {0}' : 'Analysis failed · Driver <raw> error {0}');
            expect(document.getElementById('status-text')?.title).toBe('Driver <raw> error {0}');
            expect(document.getElementById('status-dot')?.classList.contains('is-error')).toBe(true);
            expect(document.querySelector('raw')).toBeNull();
            expect(document.querySelector('#detail-panel h2')?.textContent).toBe(chinese ? '选择一个函数' : 'Select a function');
        } finally {
            dom.window.close();
        }
    });

    test.each(['en', 'zh-cn'])('localizes external loading and empty results while preserving requests in %s', async (language) => {
        const { dom, postMessage } = createHarness(language);
        const document = dom.window.document;
        try {
            const snapshot = createSnapshot();
            snapshot.capabilities.supportsExternalSearch = true;
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'snapshot', payload: snapshot } }));
            (document.querySelector('[data-filter-value="simulEfun"]') as HTMLButtonElement).click();
            expect(document.querySelector('.catalog-loading strong')?.textContent).toBe(language === 'zh-cn'
                ? '正在加载模拟函数' : 'Loading simulated efuns');
            expect(document.querySelector('.catalog-loading')?.getAttribute('aria-live')).toBe('polite');
            expect(document.getElementById('function-list')?.getAttribute('aria-busy')).toBe('true');
            await new Promise<void>(resolve => dom.window.setTimeout(resolve, 220));
            const request = postMessage.mock.calls.find(([message]) => message.type === 'searchExternal')?.[0];
            expect(request).toMatchObject({ type: 'searchExternal', query: '', scopes: ['simulEfun'] });
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
                data: {
                    type: 'externalSearchResult', requestId: request!.requestId, groups: [], entries: [],
                    diagnostics: [{ message: 'Raw external source failure' }]
                }
            }));
            expect(document.getElementById('status-text')?.textContent).toBe('Raw external source failure');
            expect(document.getElementById('status-dot')?.classList.contains('is-warning')).toBe(true);
            expect(document.getElementById('function-list')?.getAttribute('aria-busy')).toBe('false');
            expect(document.querySelector('#function-list h2')?.textContent).toBe(language === 'zh-cn'
                ? '没有匹配的声明' : 'No matching declarations');
        } finally {
            dom.window.close();
        }
    });

    test.each(['missing', 'invalid'])('uses English dynamic messages when bootstrap resources are %s', (resourceState) => {
        const { dom } = createHarness('zh-cn', document => {
            const resource = document.getElementById('function-panel-localization')!;
            if (resourceState === 'missing') resource.remove();
            else resource.textContent = '{invalid json';
        });
        try {
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'snapshot', payload: createSnapshot() } }));
            expect(dom.window.document.getElementById('status-text')?.textContent).toBe('2 declarations');
            expect(dom.window.document.querySelector('.quality-panel')?.textContent).toContain('Documentation status: Complete');
        } finally {
            dom.window.close();
        }
    });

    test('falls back for missing or invalid message values and matches native primitive placeholder formatting', () => {
        const { dom } = createHarness('zh-cn', document => {
            document.getElementById('function-panel-localization')!.textContent = JSON.stringify({
                locale: 'zh-cn', messages: {
                    'Complete': '译文完整',
                    '{0} declarations': 42,
                    'Line {0}, column {1}': '{{0}} {0} {1} {missing}'
                }
            });
        });
        try {
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'snapshot', payload: createSnapshot() } }));
            expect(dom.window.document.getElementById('status-text')?.textContent).toBe('2 declarations');
            expect(dom.window.document.querySelector('.quality-panel')?.textContent).toContain('Documentation status: 译文完整');
            expect(dom.window.document.querySelector('.source-line')?.textContent).toBe('{{0}} 9 14 {missing}');
        } finally {
            dom.window.close();
        }
    });

    test('keeps translated dynamic messages inert when resources contain markup', () => {
        const hostile = '</script><img src=x onerror="alert(1)">';
        const { dom } = createHarness('zh-cn', document => {
            document.getElementById('function-panel-localization')!.textContent = JSON.stringify({
                locale: 'zh-cn', messages: { 'No matching declarations': hostile }
            });
        });
        try {
            const empty = createSnapshot();
            empty.entries = [];
            empty.groups = [];
            dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data: { type: 'snapshot', payload: empty } }));
            expect(dom.window.document.querySelector('#function-list h2')?.textContent).toBe(hostile);
            expect(dom.window.document.querySelectorAll('img')).toHaveLength(0);
            expect(dom.window.document.querySelectorAll('script')).toHaveLength(1);
        } finally {
            dom.window.close();
        }
    });

    test('offers separate skeleton and AI actions for an undocumented local function', () => {
        const snapshot = createSnapshot();
        snapshot.entries[0].documentation = { hasAttachedComment: false };
        snapshot.entries[0].quality = { status: 'incomplete', issues: [], action: 'generate' };
        snapshot.entries[0].capabilities.canGenerateDocumentation = true;
        const { dom, postMessage } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));

        const buttons = [...dom.window.document.querySelectorAll('.action-line button')] as HTMLButtonElement[];
        expect(buttons.map((button) => button.textContent)).toEqual(expect.arrayContaining([
            '生成文档骨架', 'AI 生成注释'
        ]));
        buttons.find((button) => button.textContent === 'AI 生成注释')!.click();
        expect(postMessage).toHaveBeenCalledWith({
            type: 'generateJavadocWithAi', entryId: 'die-entry', revision: 7
        });
    });

    test('renders the real die fixture and keeps hostile workspace content inert', () => {
        const { dom, postMessage } = createHarness();
        expect(postMessage).toHaveBeenCalledWith({ type: 'ready', protocolVersion: 2 });

        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: createSnapshot() }
        }));

        const text = dom.window.document.body.textContent ?? '';
        expect(text).toContain('varargs void die(object killer)');
        expect(text).toContain('killer');
        expect(text).toContain('object');
        expect(text).toContain('杀死角色的对象');
        expect(text).toContain('处理角色死亡的全部流程。');
        expect(text).toContain('函数级 varargs');
        expect(text).toContain('</script><script>throw new Error("injected")</script>');
        expect(dom.window.document.querySelectorAll('script')).toHaveLength(1);
        expect(dom.window.document.querySelectorAll('.param-list')).toHaveLength(0);
    });

    test('combines source filtering and search and supports tree keyboard focus', () => {
        const { dom } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: createSnapshot() }
        }));
        const includeFilter = dom.window.document.querySelector('[data-filter-value="include"]') as HTMLButtonElement;
        includeFilter.click();
        const search = dom.window.document.getElementById('search-input') as HTMLInputElement;
        search.value = 'hostile';
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        expect(dom.window.document.querySelectorAll('.function-row')).toHaveLength(1);

        search.value = '';
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        const allFilter = dom.window.document.querySelector('[data-filter-value="all"][data-filter-group="scope"]') as HTMLButtonElement;
        allFilter.click();
        const rows = [...dom.window.document.querySelectorAll('.function-row')] as HTMLButtonElement[];
        rows[0].focus();
        rows[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(dom.window.document.activeElement).toBe(rows[1]);
    });

    test('switches between multiple structured signatures without parsing labels', () => {
        const snapshot = createSnapshot();
        snapshot.entries[0].signatures.push({
            label: 'void die()', returnType: 'void', parameters: [],
            isParameterVariadic: false, isFunctionVarargs: false
        });
        const { dom } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));

        const tabs = [...dom.window.document.querySelectorAll('.signature-tab')] as HTMLButtonElement[];
        expect(tabs).toHaveLength(2);
        tabs[1].click();
        expect(dom.window.document.querySelector('.signature-card')?.textContent).toContain('void die()');
        expect(dom.window.document.querySelector('.parameter-table')).toBeNull();
    });

    test('uses status-specific quality copy for declarations outside quality assessment', () => {
        const snapshot = createSnapshot();
        snapshot.entries[0].quality = { status: 'notApplicable', issues: [], action: 'none' };
        const { dom } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));

        const qualityText = dom.window.document.querySelector('.quality-panel')?.textContent ?? '';
        expect(qualityText).toContain('文档状态：不适用');
        expect(qualityText).toContain('当前声明不参与文档完整度评估。');
        expect(qualityText).not.toContain('结构化声明与文档字段一致。');
    });

    test('handles clipboard rejection without an unhandled action failure', async () => {
        const { dom } = createHarness();
        Object.defineProperty(dom.window.navigator, 'clipboard', {
            configurable: true,
            value: { writeText: jest.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('denied')) }
        });
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: createSnapshot() }
        }));

        const copyButton = [...dom.window.document.querySelectorAll('.action-button')]
            .find((button) => button.textContent === '复制签名') as HTMLButtonElement;
        copyButton.click();
        await new Promise<void>((resolve) => setImmediate(resolve));

        expect(dom.window.document.getElementById('status-text')?.textContent).toContain('复制签名失败');
        expect(dom.window.document.getElementById('status-dot')?.classList.contains('is-error')).toBe(true);
    });

    test('preserves the selected declaration across revisions and falls back when it is removed', () => {
        const first = createSnapshot();
        const { dom } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: first }
        }));
        (dom.window.document.querySelector('[data-entry-id="hostile-entry"]') as HTMLButtonElement).click();
        expect(dom.window.document.querySelector('.detail-title h2')?.textContent).toContain('double');

        const retained = createSnapshot();
        retained.revision = 8;
        retained.entries[1].documentation.summary = 'refresh retained';
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: retained }
        }));
        expect(dom.window.document.querySelector('.function-row.is-selected')?.getAttribute('data-entry-id')).toBe('hostile-entry');
        expect(dom.window.document.querySelector('.detail-title h2')?.textContent).toContain('double');

        const removed = createSnapshot();
        removed.revision = 9;
        removed.entries = [removed.entries[0]];
        removed.groups = [removed.groups[0]];
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: removed }
        }));
        expect(dom.window.document.querySelector('.function-row.is-selected')?.getAttribute('data-entry-id')).toBe('die-entry');
        expect(dom.window.document.querySelector('.detail-title h2')?.textContent).toBe('die');
    });

    test('renders partial, failed, and empty states as explicit UI states', () => {
        const { dom } = createHarness();
        const partial = createSnapshot();
        partial.status = 'partial';
        partial.diagnostics = [{
            code: 'include-target-unresolved', severity: 'warning', stage: 'include',
            message: '无法解析包含目标', recoverable: true
        }];
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: partial }
        }));
        expect(dom.window.document.getElementById('status-text')?.textContent).toContain('部分结果');

        const failed = createSnapshot();
        failed.revision = 8;
        failed.status = 'failed';
        failed.groups = [];
        failed.entries = [];
        failed.diagnostics = [{
            code: 'analysis-failed', severity: 'error', stage: 'analysis', message: '分析失败详情', recoverable: true
        }];
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: failed }
        }));
        expect(dom.window.document.getElementById('status-text')?.textContent).toContain('分析失败详情');
        expect(dom.window.document.body.textContent).toContain('没有匹配的声明');
    });

    test('shows an external loading state instead of a false empty result', async () => {
        const snapshot = createSnapshot();
        snapshot.capabilities.supportsExternalSearch = true;
        const { dom, postMessage } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));

        (dom.window.document.querySelector('[data-filter-value="simulEfun"]') as HTMLButtonElement).click();
        expect(dom.window.document.body.textContent).toContain('正在加载模拟函数');
        expect(dom.window.document.body.textContent).not.toContain('没有匹配的声明');
        expect(dom.window.document.querySelector('.catalog-spinner')).not.toBeNull();
        expect(dom.window.document.querySelector('.catalog-loading')?.getAttribute('role')).toBe('status');
        expect(dom.window.document.getElementById('function-list')?.getAttribute('aria-busy')).toBe('true');
        expect(dom.window.document.getElementById('result-count')?.textContent).toBe('…');

        (dom.window.document.querySelector('[data-filter-value="efun"]') as HTMLButtonElement).click();
        expect(dom.window.document.body.textContent).toContain('正在加载 Efun');
        await new Promise<void>((resolve) => dom.window.setTimeout(resolve, 220));
        const request = [...postMessage.mock.calls].reverse().find(([message]) => message.type === 'searchExternal')?.[0];
        expect(request.scopes).toEqual(['efun']);
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: {
                type: 'externalSearchResult', requestId: request.requestId,
                groups: [], entries: [], diagnostics: []
            }
        }));

        expect(dom.window.document.querySelector('.catalog-loading')).toBeNull();
        expect(dom.window.document.getElementById('function-list')?.getAttribute('aria-busy')).toBe('false');
        expect(dom.window.document.body.textContent).toContain('没有匹配的声明');
        expect(dom.window.document.getElementById('result-count')?.textContent).toBe('0');
    });

    test('bounds large-list DOM work while retaining full searchability', () => {
        const snapshot = createSnapshot();
        const template = snapshot.entries[0];
        snapshot.groups = [snapshot.groups[0]];
        snapshot.entries = Array.from({ length: 501 }, (_, index) => ({
            ...template,
            id: `entry-${index}`,
            declarationKey: `entry-${index}`,
            name: index === 500 ? 'needle_at_end' : `function_${index}`
        }));
        snapshot.groups[0].entryIds = snapshot.entries.map((entry) => entry.id);
        const { dom } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));

        expect(dom.window.document.querySelectorAll('.function-row')).toHaveLength(250);
        expect(dom.window.document.querySelector('.load-more')).not.toBeNull();
        expect(dom.window.document.getElementById('result-count')?.textContent).toBe('250/501');

        const search = dom.window.document.getElementById('search-input') as HTMLInputElement;
        search.value = 'needle_at_end';
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        expect(dom.window.document.querySelectorAll('.function-row')).toHaveLength(1);
        expect(dom.window.document.body.textContent).toContain('needle_at_end');
    });

    test('does not spend the render budget or show load-more for collapsed groups', () => {
        const snapshot = createSnapshot();
        const template = snapshot.entries[0];
        snapshot.groups = [snapshot.groups[0]];
        snapshot.entries = Array.from({ length: 501 }, (_, index) => ({
            ...template,
            id: `entry-${index}`,
            declarationKey: `entry-${index}`,
            name: `function_${index}`
        }));
        snapshot.groups[0].entryIds = snapshot.entries.map((entry) => entry.id);
        const { dom } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));

        (dom.window.document.querySelector('.group-header') as HTMLButtonElement).click();

        expect(dom.window.document.querySelectorAll('.function-row')).toHaveLength(0);
        expect(dom.window.document.querySelector('.load-more')).toBeNull();
        expect(dom.window.document.getElementById('result-count')?.textContent).toBe('501');
    });

    test('rejects an in-flight external result after accepting a newer snapshot', async () => {
        const snapshot = createSnapshot();
        snapshot.capabilities.supportsExternalSearch = true;
        const { dom, postMessage } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));
        (dom.window.document.querySelector('[data-filter-value="simulEfun"]') as HTMLButtonElement).click();
        await new Promise<void>((resolve) => dom.window.setTimeout(resolve, 220));
        const request = postMessage.mock.calls.find(([message]) => message.type === 'searchExternal')?.[0];
        expect(request).toBeDefined();

        const refreshed = createSnapshot();
        refreshed.revision = 8;
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: refreshed }
        }));
        const staleEntry = {
            ...snapshot.entries[1],
            id: 'stale-external-entry',
            declarationKey: 'stale-external-entry',
            name: 'stale_external_result',
            sourceKind: 'simulEfun' as const,
            sourceGroupId: 'simulEfun:external'
        };
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: {
                type: 'externalSearchResult',
                requestId: request.requestId,
                groups: [{
                    id: 'simulEfun:external', sourceKind: 'simulEfun', displayLabel: '模拟函数',
                    depth: 0, entryIds: [staleEntry.id], diagnostics: []
                }],
                entries: [staleEntry]
            }
        }));

        expect(dom.window.document.body.textContent).not.toContain('stale_external_result');
    });

    test('rejects an in-flight external result immediately after external search is cleared', async () => {
        const snapshot = createSnapshot();
        snapshot.capabilities.supportsExternalSearch = true;
        const { dom, postMessage } = createHarness();
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: { type: 'snapshot', payload: snapshot }
        }));
        const search = dom.window.document.getElementById('search-input') as HTMLInputElement;
        search.value = 'create';
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        await new Promise<void>((resolve) => dom.window.setTimeout(resolve, 220));
        const request = postMessage.mock.calls.find(([message]) => message.type === 'searchExternal')?.[0];
        expect(request).toBeDefined();

        search.value = '';
        search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        const staleEntry = {
            ...snapshot.entries[1],
            id: 'stale-cleared-entry',
            declarationKey: 'stale-cleared-entry',
            name: 'stale_after_clear',
            sourceKind: 'efun' as const,
            sourceGroupId: 'efun:external'
        };
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
            data: {
                type: 'externalSearchResult', requestId: request.requestId,
                groups: [{
                    id: 'efun:external', sourceKind: 'efun', displayLabel: '标准 Efun',
                    depth: 0, entryIds: [staleEntry.id], diagnostics: []
                }],
                entries: [staleEntry]
            }
        }));

        expect(dom.window.document.body.textContent).not.toContain('stale_after_clear');
    });
});
