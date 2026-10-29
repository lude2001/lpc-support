import { afterEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { JSDOM } from 'jsdom';
import type { AnalysisInspection } from '../../lsp/shared/protocol/analysisInspection';
import { inspectionHtml, renderInspection, type InspectionView } from '../renderInspection';

const nonce = 'a'.repeat(32);
const initialLanguage = vscode.env.language;
const tabIds = ['overview', 'macros', 'dependencies', 'preprocessed'];

function useLocale(language: string): void {
    (vscode.env as { language: string }).language = language;
}

function inspection(): AnalysisInspection {
    const range = { start: { line: 2, character: 4 }, end: { line: 4, character: 8 } };
    return {
        uri: 'file:///demo.c', version: 7, revision: 12,
        preprocessedText: '\n\nint value = FLAG;\r\nstring title = "原始源码";\n',
        inactiveRanges: [range],
        macros: [
            { name: 'FLAG', kind: 'define', value: '(7 + 1)', range },
            { name: 'OLD_FLAG', kind: 'undef', value: null, range }
        ],
        initialMacros: { PREDEFINED: '项目原文', ANOTHER: '1' },
        analysis: {
            dependenciesComplete: false,
            dependencies: [
                { kind: 'include', path: '/include/demo.h', targets: ['file:///include/demo.h'] },
                { kind: 'inherit', path: '/std/object', targets: ['file:///std/object.c'] },
                { kind: 'globalInclude', path: '/include/global.h', targets: [] },
                { kind: 'simulatedEfun', path: '/simul_efun', targets: [] }
            ],
            symbol: {
                name: 'FLAG', status: 'macro', macroValue: '\n(7 + 1)\r\n',
                definitions: [{ uri: 'file:///include/flags.h', range }]
            }
        }
    };
}

function openShell() {
    const postMessage = jest.fn();
    const dom = new JSDOM(inspectionHtml(nonce), {
        runScripts: 'dangerously',
        beforeParse(window) { (window as any).acquireVsCodeApi = () => ({ postMessage }); }
    });
    const deliver = (data: unknown) => dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data }));
    return { dom, postMessage, deliver };
}

function viewFacts(view: InspectionView) {
    const dom = new JSDOM(`<body>${tabIds.map(id => `<section id="${id}">${view[id as keyof Omit<InspectionView, 'locations'>]}</section>`).join('')}</body>`);
    const document = dom.window.document;
    const result = {
        locations: view.locations,
        source: document.querySelector('#preprocessed .source')?.textContent,
        replacement: document.querySelector('#overview pre')?.textContent,
        code: [...document.querySelectorAll('code')].map(element => element.textContent),
        linkIds: [...document.querySelectorAll('[data-location]')].map(element => element.getAttribute('data-location')),
        counts: [...document.querySelectorAll('#overview dd')].slice(1).map(element => element.textContent)
    };
    dom.window.close();
    return result;
}

afterEach(() => {
    useLocale(initialLanguage);
    jest.restoreAllMocks();
});

describe('analysis inspection localization', () => {
    test('English and Chinese render the same facts, source, and ordered navigation locations', () => {
        const data = inspection();
        const original = structuredClone(data);
        useLocale('en');
        const english = renderInspection(data, uri => uri.replace('file://', ''));
        useLocale('zh-cn');
        const chinese = renderInspection(data, uri => uri.replace('file://', ''));
        expect(viewFacts(chinese)).toEqual(viewFacts(english));
        expect(viewFacts(english).source).toBe(data.preprocessedText);
        expect(viewFacts(english).replacement).toBe(data.analysis!.symbol!.macroValue);
        expect(english.overview).toContain('Macro definition');
        expect(chinese.overview).toContain('宏定义');
        expect(english.macros).toContain('Lines 3–5');
        expect(chinese.macros).toContain('第 3–5 行');
        expect(data).toEqual(original);
        expect(english.locations).toHaveLength(6);
        expect(english.locations[0]).toEqual(data.analysis!.symbol!.definitions[0]);
        expect(english.locations[1]).toEqual({ uri: data.uri, range: data.inactiveRanges[0] });
        expect(english.locations.slice(-2).map(location => location.uri))
            .toEqual(['file:///include/demo.h', 'file:///std/object.c']);
    });

    test.each([
        ['en', 'en', 'LPC Analysis Inspector', 'Overview', 'Refresh analysis', 'Reading analysis…'],
        ['zh-cn', 'zh-cn', 'LPC 分析查看器', '概要', '刷新分析', '正在读取…'],
        ['ZH-CN', 'zh-cn', 'LPC 分析查看器', '概要', '刷新分析', '正在读取…'],
        ['fr', 'en', 'LPC Analysis Inspector', 'Overview', 'Refresh analysis', 'Reading analysis…']
    ])('shell locale %s localizes the initial state, title and accessibility labels',
        (locale, effective, title, overview, refresh, loading) => {
            useLocale(locale);
            const { dom, postMessage } = openShell();
            const document = dom.window.document;
            expect(document.documentElement.lang).toBe(effective);
            expect(document.title).toBe(title);
            expect(document.querySelector('#tab-overview')?.textContent).toBe(overview);
            expect(document.querySelector('#refresh')?.getAttribute('title')).toBe(refresh);
            expect(document.querySelector('#refresh')?.getAttribute('aria-label')).toBe(refresh);
            expect(document.querySelector('#status')?.textContent).toBe(loading);
            expect(document.querySelector('#status')?.getAttribute('aria-live')).toBe('polite');
            expect(document.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
            expect(document.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBeTruthy();
            expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
            const policy = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content');
            expect(policy).toBe(`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`);
            expect(document.querySelector('style')?.nonce).toBe(nonce);
            expect(document.querySelector('script')?.nonce).toBe(nonce);
            const css = document.querySelector('style')?.textContent ?? '';
            expect(css).toContain('flex-wrap: wrap');
            expect(css).toContain('overflow-x: auto');
            expect(css).toContain('@media(max-width: 500px)');
            expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
            dom.window.close();
        });

    test.each(['en', 'zh-cn'])('all empty and truncation states are localized in %s', locale => {
        useLocale(locale);
        const data = inspection();
        data.inactiveRanges = [];
        data.macros = [];
        data.initialMacros = {};
        data.analysis = null;
        data.preprocessedText = 'x'.repeat(200_001);
        const view = renderInspection(data, uri => uri);
        const dom = new JSDOM(`<body>${view.overview}${view.macros}${view.dependencies}${view.preprocessed}</body>`);
        const text = dom.window.document.body.textContent;
        for (const message of [
            'Place the cursor on an identifier to see its resolution and declaration sources.',
            'This file has no inactive regions.',
            'No effective macro directives.',
            'No macros were defined on entry to this file.',
            'No dependencies to display.',
            'This file is large. Only the first 200,000 characters are shown.'
        ]) expect(text).toContain(vscode.l10n.t(message));
        expect(dom.window.document.querySelector('pre.source')?.textContent).toBe('x'.repeat(200_000));
        expect(view.locations).toEqual([]);
        dom.window.close();
    });

    test.each(['en', 'zh-cn'])('symbol and dependency labels use the current locale in %s', locale => {
        useLocale(locale);
        const data = inspection();
        data.analysis!.dependenciesComplete = true;
        data.analysis!.symbol!.definitions = [];
        data.analysis!.symbol!.macroValue = null;
        for (const [status, message] of [
            ['macro', 'Macro definition'], ['predefinedMacro', 'Predefined macro'],
            ['resolved', 'Resolved to a declaration'], ['ambiguous', 'Multiple candidate declarations'],
            ['efun', 'Builtin efun'], ['unresolved', 'Cannot be determined statically']
        ]) {
            data.analysis!.symbol!.status = status;
            const view = renderInspection(data, uri => uri);
            const dom = new JSDOM(`<section id="overview">${view.overview}</section><section id="dependencies">${view.dependencies}</section>`);
            const document = dom.window.document;
            expect(document.querySelector('.symbol span')?.textContent).toBe(vscode.l10n.t(message));
            expect(document.querySelector('#overview')?.textContent).toContain(vscode.l10n.t('No navigable source declaration.'));
            expect(document.querySelector('#overview dd')?.textContent)
                .toBe(vscode.l10n.t('Static dependencies of the current file have been resolved.'));
            expect([...document.querySelectorAll('#dependencies tbody tr')].map(row => row.children[0].textContent))
                .toEqual(['Include', 'Inheritance', 'Global include', 'Simulated efun entry'].map(label => vscode.l10n.t(label)));
            expect(document.querySelector('#overview pre')).toBeNull();
            dom.window.close();
        }
    });

    test.each(['en', 'zh-cn'])('source values and unknown labels remain escaped text in %s', locale => {
        useLocale(locale);
        const attack = '<img src=x onerror="window.compromised=true"> & "quoted"';
        const data = inspection();
        data.preprocessedText = attack;
        data.initialMacros = { [attack]: attack };
        data.macros[0].name = attack;
        data.macros[0].value = attack;
        data.analysis!.symbol!.name = attack;
        data.analysis!.symbol!.status = attack;
        data.analysis!.symbol!.macroValue = attack;
        data.analysis!.dependencies[0].kind = attack;
        data.analysis!.dependencies[0].path = attack;
        const view = renderInspection(data, () => attack);
        const { dom, deliver } = openShell();
        deliver({ type: 'snapshot', view, status: attack, generation: 11 });
        const document = dom.window.document;
        expect(document.querySelector('img, iframe, svg')).toBeNull();
        expect(document.querySelector('#preprocessed .source')?.textContent).toBe(attack);
        expect(document.querySelector('#status')?.textContent).toBe(attack);
        expect(document.querySelector('.symbol code')?.textContent).toBe(attack);
        expect(document.querySelector('.symbol span')?.textContent).toBe(attack);
        expect(document.querySelector('[data-location]')?.getAttribute('aria-label'))
            .toBe(vscode.l10n.t('Open source: {0}', `${attack}:3`));
        expect(document.querySelector('[data-location]')?.getAttribute('onerror')).toBeNull();
        expect((dom.window as any).compromised).toBeUndefined();
        dom.window.close();
        data.analysis!.symbol!.status = 'toString';
        data.analysis!.dependencies[0].kind = 'constructor';
        expect(() => renderInspection(data, uri => uri)).not.toThrow();
    });

    test('translated text never acquires HTML or JavaScript authority', () => {
        useLocale('zh-cn');
        const attack = '</script><img src=x onerror="window.compromised=true">';
        jest.spyOn(vscode.l10n, 't').mockReturnValue(attack);
        const view = renderInspection(inspection(), uri => uri);
        const { dom, postMessage, deliver } = openShell();
        deliver({ type: 'snapshot', view, status: attack, generation: 4 });
        const document = dom.window.document;
        expect(document.querySelectorAll('script')).toHaveLength(1);
        expect(document.querySelector('img')).toBeNull();
        expect(document.title).toBe(attack);
        expect(document.querySelector('#refresh')?.getAttribute('title')).toBe(attack);
        expect(document.querySelector('#refresh')?.getAttribute('aria-label')).toBe(attack);
        expect(document.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(attack);
        expect(document.querySelector('h2')?.textContent).toBe(attack);
        expect((dom.window as any).compromised).toBeUndefined();
        (document.querySelector('[data-location="0"]') as HTMLElement).click();
        expect(postMessage).toHaveBeenLastCalledWith({ type: 'open', index: 0, generation: 4 });
        dom.window.close();
    });

    test.each(['en', 'zh-cn'])('keyboard tabs, refresh, loading, empty and error states retain protocol IDs in %s', locale => {
        useLocale(locale);
        const { dom, postMessage, deliver } = openShell();
        const document = dom.window.document;
        const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
        expect(tabs.map(tab => tab.dataset.tab)).toEqual(tabIds);
        expect(tabs.map(tab => tab.tabIndex)).toEqual([0, -1, -1, -1]);
        tabs[0].focus();
        const press = (key: string) => document.activeElement?.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
            key, bubbles: true, cancelable: true
        }));
        press('ArrowLeft');
        expect(document.activeElement).toBe(tabs[3]);
        press('Home');
        expect(document.activeElement).toBe(tabs[0]);
        press('ArrowRight');
        expect(document.activeElement).toBe(tabs[1]);
        press('End');
        expect(document.activeElement).toBe(tabs[3]);
        expect(tabs.map(tab => tab.tabIndex)).toEqual([-1, -1, -1, 0]);
        expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'true']);
        const view = renderInspection(inspection(), uri => uri);
        deliver({ type: 'snapshot', view, status: vscode.l10n.t('Version {0} · Updated', 7), generation: 23 });
        expect((document.getElementById('preprocessed') as HTMLElement).hidden).toBe(false);
        expect(document.querySelector('main')?.getAttribute('aria-busy')).toBe('false');
        (document.querySelector('[data-location="5"]') as HTMLElement).click();
        expect(postMessage).toHaveBeenLastCalledWith({ type: 'open', index: 5, generation: 23 });
        (document.getElementById('refresh') as HTMLButtonElement).click();
        expect(postMessage).toHaveBeenLastCalledWith({ type: 'refresh' });
        expect(document.querySelector('#status')?.textContent).toBe(vscode.l10n.t('Reading analysis…'));
        expect(document.querySelector('main')?.getAttribute('aria-busy')).toBe('true');
        for (const status of [
            vscode.l10n.t('Open an LPC file and place the cursor at the position to inspect.'),
            vscode.l10n.t('The analysis snapshot for this document is not ready. Refresh shortly.'),
            vscode.l10n.t('Failed to read analysis: {0}', '<script>offline</script>')
        ]) {
            deliver({ type: 'empty', status });
            expect(document.querySelector('#status')?.textContent).toBe(status);
            expect(document.querySelector('main')?.getAttribute('aria-busy')).toBe('false');
            for (const id of tabIds) expect(document.getElementById(id)?.textContent).toBe(status);
            expect(document.querySelectorAll('[data-location]')).toHaveLength(0);
        }
        expect(document.querySelectorAll('script')).toHaveLength(1);
        dom.window.close();
    });
});
