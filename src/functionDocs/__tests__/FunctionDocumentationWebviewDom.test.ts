import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import { describe, expect, jest, test } from '@jest/globals';
import type { FunctionDocumentationPanelSnapshot } from '../contracts/FunctionDocumentationPanelProtocol';

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

function createHarness(): { dom: JSDOM; postMessage: jest.Mock } {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'functionDocPanel.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'functionDocPanel.js'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://webview.invalid/' });
    const postMessage = jest.fn();
    (dom.window as any).acquireVsCodeApi = () => ({ postMessage, setState: jest.fn(), getState: jest.fn() });
    dom.window.eval(script);
    return { dom, postMessage };
}

describe('function documentation Webview DOM', () => {
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
            value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) }
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
        const request = postMessage.mock.calls.findLast(([message]) => message.type === 'searchExternal')?.[0];
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
