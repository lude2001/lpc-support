import * as vscode from 'vscode';
import type { Location } from 'vscode-languageserver-protocol';
import { resolveUiLocale } from '../localization/locale';
import type { AnalysisInspection } from '../lsp/shared/protocol/analysisInspection';

export interface InspectionView {
    overview: string;
    macros: string;
    dependencies: string;
    preprocessed: string;
    locations: Location[];
}

function statusLabel(status: string): string {
    const labels: Record<string, string> = {
        macro: vscode.l10n.t('Macro definition'),
        predefinedMacro: vscode.l10n.t('Predefined macro'),
        resolved: vscode.l10n.t('Resolved to a declaration'),
        ambiguous: vscode.l10n.t('Multiple candidate declarations'),
        efun: vscode.l10n.t('Builtin efun'),
        unresolved: vscode.l10n.t('Cannot be determined statically')
    };
    return Object.prototype.hasOwnProperty.call(labels, status) ? labels[status] : status;
}

function dependencyLabel(kind: string): string {
    const labels: Record<string, string> = {
        include: vscode.l10n.t('Include'),
        inherit: vscode.l10n.t('Inheritance'),
        globalInclude: vscode.l10n.t('Global include'),
        simulatedEfun: vscode.l10n.t('Simulated efun entry')
    };
    return Object.prototype.hasOwnProperty.call(labels, kind) ? labels[kind] : kind;
}

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"'\r]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\r': '&#13;' }[char]!));
}

export function renderInspection(model: AnalysisInspection, displayPath: (uri: string) => string): InspectionView {
    const locations: Location[] = [];
    const link = (location: Location, label: string): string => {
        const id = locations.push(location) - 1;
        const title = escapeHtml(vscode.l10n.t('Open source: {0}', label));
        return `<button type="button" class="source-link" data-location="${id}" title="${title}" aria-label="${title}">${escapeHtml(label)}</button>`;
    };
    const localLink = (range: Location['range'], label: string): string => link({ uri: model.uri, range }, label);
    const symbol = model.analysis?.symbol;
    const definitions = symbol?.definitions.map(location => `<li>${link(location, `${displayPath(location.uri)}:${location.range.start.line + 1}`)}</li>`).join('');
    const overview = `<p class="eyebrow">${escapeHtml(vscode.l10n.t('Rust static analysis · Document version {0}', model.version))}</p>
        <h1>${escapeHtml(displayPath(model.uri))}</h1>
        <p class="notice">${escapeHtml(vscode.l10n.t('Results include unsaved edits. Dynamic objects and targets that cannot be proven may have no declaration location.'))}</p>
        <h2>${escapeHtml(vscode.l10n.t('Symbol at the cursor'))}</h2>${symbol ? `<div class="symbol"><code>${escapeHtml(symbol.name)}</code><span>${escapeHtml(statusLabel(symbol.status))}</span></div>
        ${symbol.macroValue !== null ? `<h3>${escapeHtml(vscode.l10n.t('Macro replacement text'))}</h3><pre><code>${escapeHtml(symbol.macroValue)}</code></pre>` : ''}
        ${definitions ? `<ul class="locations">${definitions}</ul>` : `<p class="muted">${escapeHtml(vscode.l10n.t('No navigable source declaration.'))}</p>`}` : `<p class="muted">${escapeHtml(vscode.l10n.t('Place the cursor on an identifier to see its resolution and declaration sources.'))}</p>`}
        <h2>${escapeHtml(vscode.l10n.t('Analysis scope'))}</h2><dl><dt>${escapeHtml(vscode.l10n.t('Dependencies'))}</dt><dd>${escapeHtml(model.analysis?.dependenciesComplete
            ? vscode.l10n.t('Static dependencies of the current file have been resolved.')
            : vscode.l10n.t('Some dependencies are unresolved. See the Dependencies tab.'))}</dd>
        <dt>${escapeHtml(vscode.l10n.t('Inactive regions'))}</dt><dd>${model.inactiveRanges.length}</dd>
        <dt>${escapeHtml(vscode.l10n.t('Effective macro directives in this file'))}</dt><dd>${model.macros.length}</dd></dl>`;
    const macros = `<h1>${escapeHtml(vscode.l10n.t('Macros and conditional compilation'))}</h1>
        <h2>${escapeHtml(vscode.l10n.t('Inactive source regions'))}</h2>${model.inactiveRanges.length ? `<ul>${model.inactiveRanges.map(range => `<li>${localLink(range, vscode.l10n.t('Lines {0}–{1}', range.start.line + 1, range.end.line + 1))}</li>`).join('')}</ul>` : `<p class="muted">${escapeHtml(vscode.l10n.t('This file has no inactive regions.'))}</p>`}
        <h2>${escapeHtml(vscode.l10n.t('Effective define / undef directives in this file'))}</h2>${model.macros.length ? `<table><thead><tr><th scope="col">${escapeHtml(vscode.l10n.t('Directive'))}</th><th scope="col">${escapeHtml(vscode.l10n.t('Macro name / location'))}</th><th scope="col">${escapeHtml(vscode.l10n.t('Replacement text'))}</th></tr></thead><tbody>${model.macros.map(macro => `<tr><td>${macro.kind === 'define' ? '#define' : '#undef'}</td><td>${localLink(macro.range, `${macro.name}:${macro.range.start.line + 1}`)}</td><td><code>${escapeHtml(macro.value ?? '—')}</code></td></tr>`).join('')}</tbody></table>` : `<p class="muted">${escapeHtml(vscode.l10n.t('No effective macro directives.'))}</p>`}
        <h2>${escapeHtml(vscode.l10n.t('Macro environment on entry to the file'))}</h2>
        <p class="muted">${escapeHtml(vscode.l10n.t('These macros come from project predefines and global headers. For macros introduced by includes inside this file, inspect their source at the usage site.'))}</p>
        ${Object.keys(model.initialMacros).length ? `<table><thead><tr><th scope="col">${escapeHtml(vscode.l10n.t('Name'))}</th><th scope="col">${escapeHtml(vscode.l10n.t('Replacement text'))}</th></tr></thead><tbody>${Object.entries(model.initialMacros).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `<tr><td><code>${escapeHtml(name)}</code></td><td><code>${escapeHtml(value)}</code></td></tr>`).join('')}</tbody></table>` : `<p class="muted">${escapeHtml(vscode.l10n.t('No macros were defined on entry to this file.'))}</p>`}`;
    const dependencies = `<h1>${escapeHtml(vscode.l10n.t('Dependencies and simulated efun entry'))}</h1>
        <p class="muted">${escapeHtml(vscode.l10n.t('Direct dependencies and configured entries for this file. Open a target file to inspect its dependencies.'))}</p>
        ${model.analysis?.dependencies.length ? `<table><thead><tr><th scope="col">${escapeHtml(vscode.l10n.t('Source'))}</th><th scope="col">${escapeHtml(vscode.l10n.t('Configured path'))}</th><th scope="col">${escapeHtml(vscode.l10n.t('Indexed target'))}</th></tr></thead><tbody>${model.analysis.dependencies.map(dependency => `<tr><td>${escapeHtml(dependencyLabel(dependency.kind))}</td><td><code>${escapeHtml(dependency.path)}</code></td><td>${dependency.targets.length ? dependency.targets.map(uri => link({ uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }, displayPath(uri))).join('<br>') : `<span class="unresolved">${escapeHtml(vscode.l10n.t('Unresolved'))}</span>`}</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${escapeHtml(vscode.l10n.t('No dependencies to display.'))}</p>`}`;
    const maxPreview = 200_000;
    const preprocessed = `<h1>${escapeHtml(vscode.l10n.t('Static preprocessing view'))}</h1>
        <p class="notice">${escapeHtml(vscode.l10n.t('This view preserves original line numbers and blanks out directives and inactive regions. Macro calls and includes are not expanded; this is not the full preprocessing output of the FluffOS compiler.'))}</p>
        ${model.preprocessedText.length > maxPreview ? `<p class="unresolved">${escapeHtml(vscode.l10n.t('This file is large. Only the first 200,000 characters are shown.'))}</p>` : ''}<pre class="source"><code>${escapeHtml(model.preprocessedText.slice(0, maxPreview))}</code></pre>`;
    return { overview, macros, dependencies, preprocessed, locations };
}

export function inspectionHtml(nonce: string): string {
    const safeNonce = escapeHtml(nonce);
    const title = escapeHtml(vscode.l10n.t('LPC Analysis Inspector'));
    const loading = escapeHtml(vscode.l10n.t('Reading analysis…'));
    const refresh = escapeHtml(vscode.l10n.t('Refresh analysis'));
    const tabs = [
        ['overview', vscode.l10n.t('Overview')],
        ['macros', vscode.l10n.t('Macros and conditions')],
        ['dependencies', vscode.l10n.t('Dependencies')],
        ['preprocessed', vscode.l10n.t('Preprocessing view')]
    ];
    return `<!DOCTYPE html><html lang="${resolveUiLocale(vscode.env.language)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${safeNonce}'; script-src 'nonce-${safeNonce}';">
    <style nonce="${safeNonce}">
    * { box-sizing: border-box; } body { margin: 0; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    header { position: sticky; top: 0; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-panel-border); padding: 12px 18px 0; z-index: 1; }
    .toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; } .title { flex: 1 1 180px; min-width: 0; overflow-wrap: anywhere; font-weight: 600; letter-spacing: .04em; } #status { flex: 1 1 160px; min-width: 0; overflow-wrap: anywhere; color: var(--vscode-descriptionForeground); font-size: 12px; }
    nav { display: flex; gap: 16px; overflow-x: auto; margin-top: 12px; } button { font: inherit; cursor: pointer; } nav button { padding: 10px 0; border: 0; border-bottom: 2px solid transparent; color: var(--vscode-descriptionForeground); background: transparent; white-space: nowrap; }
    nav button[aria-selected="true"] { color: var(--vscode-editor-foreground); border-color: var(--vscode-focusBorder); } button:focus-visible, [role="tabpanel"]:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 3px; }
    #refresh { flex: 0 0 auto; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 0; padding: 5px 12px; }
    main { padding: 22px 24px 40px; max-width: 1200px; } h1 { font-size: 20px; font-weight: 500; overflow-wrap: anywhere; margin: 0 0 18px; } h2 { font-size: 14px; margin: 28px 0 12px; } h3 { font-size: 12px; font-weight: 500; margin-top: 20px; }
    .eyebrow { color: var(--vscode-descriptionForeground); font-size: 11px; letter-spacing: .08em; margin: 0 0 10px; } .notice { border-left: 2px solid var(--vscode-focusBorder); padding: 9px 12px; background: var(--vscode-textBlockQuote-background); line-height: 1.6; }
    .muted { color: var(--vscode-descriptionForeground); line-height: 1.6; } .symbol { display: flex; flex-wrap: wrap; gap: 15px; align-items: center; } .symbol code { font-size: 18px; overflow-wrap: anywhere; } .symbol span { color: var(--vscode-descriptionForeground); }
    code, pre { font-family: var(--vscode-editor-font-family); } pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; background: var(--vscode-textCodeBlock-background); line-height: 1.6; } .source { white-space: pre; overflow: auto; tab-size: 4; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; } th { text-align: left; color: var(--vscode-descriptionForeground); font-weight: 500; } th, td { padding: 10px 8px; border-bottom: 1px solid var(--vscode-panel-border); vertical-align: top; overflow-wrap: anywhere; } th:first-child { width: 20%; }
    .source-link { color: var(--vscode-textLink-foreground); background: none; border: none; padding: 0; text-align: left; overflow-wrap: anywhere; } .source-link:hover { text-decoration: underline; } .unresolved { color: var(--vscode-editorWarning-foreground); } li { margin: 9px 0; } dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 12px 24px; } dt { color: var(--vscode-descriptionForeground); } dt, dd { min-width: 0; overflow-wrap: anywhere; } dd { margin: 0; }
    [hidden] { display: none !important; } @media(max-width: 500px) { main { padding: 18px 12px; } header { padding-left: 12px; padding-right: 12px; } nav { gap: 12px; } th, td { padding: 8px 4px; } dl { grid-template-columns: minmax(0, 1fr); gap: 4px; } dd { margin-bottom: 10px; } }
    </style></head><body><header><div class="toolbar"><span class="title">${title}</span><span id="status" role="status" aria-live="polite" aria-atomic="true" data-loading-label="${loading}">${loading}</span><button type="button" id="refresh" title="${refresh}" aria-label="${refresh}">${escapeHtml(vscode.l10n.t('Refresh'))}</button></div>
    <nav aria-label="${escapeHtml(vscode.l10n.t('Analysis views'))}" role="tablist" aria-orientation="horizontal">${tabs.map(([id, label], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="${id}" data-tab="${id}" tabindex="${i === 0 ? 0 : -1}" aria-selected="${i === 0}">${escapeHtml(label)}</button>`).join('')}</nav></header>
    <main id="inspection-content" aria-busy="true">${tabs.map(([id], i) => `<section id="${id}" role="tabpanel" aria-labelledby="tab-${id}" tabindex="0" ${i ? 'hidden' : ''}><p class="muted">${loading}</p></section>`).join('')}</main>
    <script nonce="${safeNonce}">
    const vscode = acquireVsCodeApi();
    let generation = 0;
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    const status = document.getElementById('status');
    const content = document.getElementById('inspection-content');
    const selectTab = (tab, focus) => {
        tabs.forEach(button => {
            button.setAttribute('aria-selected', String(button === tab));
            button.tabIndex = button === tab ? 0 : -1;
        });
        panels.forEach(section => { section.hidden = section.id !== tab.dataset.tab; });
        if (focus) tab.focus();
    };
    document.getElementById('refresh').addEventListener('click', () => {
        status.textContent = status.dataset.loadingLabel;
        content.setAttribute('aria-busy', 'true');
        vscode.postMessage({ type: 'refresh' });
    });
    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const link = event.target.closest('[data-location]');
        if (link) vscode.postMessage({ type: 'open', index: Number(link.dataset.location), generation });
        const tab = event.target.closest('[role="tab"]');
        if (tabs.includes(tab)) selectTab(tab, false);
    });
    document.addEventListener('keydown', event => {
        if (!(event.target instanceof Element)) return;
        const current = event.target.closest('[role="tab"]');
        const index = tabs.indexOf(current);
        if (index < 0) return;
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
        if (next < 0) return;
        event.preventDefault();
        selectTab(tabs[next], true);
    });
    window.addEventListener('message', event => {
        const message = event.data;
        if (!message || (message.type !== 'snapshot' && message.type !== 'empty')) return;
        status.textContent = message.status;
        content.setAttribute('aria-busy', 'false');
        if (message.type === 'snapshot') {
            generation = message.generation;
            for (const id of ['overview', 'macros', 'dependencies', 'preprocessed']) document.getElementById(id).innerHTML = message.view[id];
        } else {
            for (const id of ['overview', 'macros', 'dependencies', 'preprocessed']) document.getElementById(id).textContent = message.status;
        }
    });
    vscode.postMessage({ type: 'ready' });
    </script></body></html>`;
}
