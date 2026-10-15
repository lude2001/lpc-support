import type { Location } from 'vscode-languageserver-protocol';
import type { AnalysisInspection } from '../lsp/shared/protocol/analysisInspection';

export interface InspectionView {
    overview: string;
    macros: string;
    dependencies: string;
    preprocessed: string;
    locations: Location[];
}

const statusLabels: Record<string, string> = {
    macro: '宏定义', predefinedMacro: '预定义宏', resolved: '已解析到声明',
    ambiguous: '存在多个候选声明', efun: '内置 Efun', unresolved: '无法静态确定'
};
const dependencyLabels: Record<string, string> = {
    include: 'Include', inherit: '继承', globalInclude: '全局 Include', simulatedEfun: '模拟函数入口'
};

export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

export function renderInspection(model: AnalysisInspection, displayPath: (uri: string) => string): InspectionView {
    const locations: Location[] = [];
    const link = (location: Location, label: string): string => {
        const id = locations.push(location) - 1;
        return `<button class="source-link" data-location="${id}">${escapeHtml(label)}</button>`;
    };
    const localLink = (range: Location['range'], label: string): string => link({ uri: model.uri, range }, label);
    const symbol = model.analysis?.symbol;
    const definitions = symbol?.definitions.map(location => `<li>${link(location, `${displayPath(location.uri)}:${location.range.start.line + 1}`)}</li>`).join('');
    const overview = `<p class="eyebrow">RUST 静态分析 · 文档版本 ${model.version}</p>
        <h1>${escapeHtml(displayPath(model.uri))}</h1>
        <p class="notice">结果包含未保存的编辑。动态对象或无法证明的目标可能没有声明位置。</p>
        <h2>光标所在符号</h2>${symbol ? `<div class="symbol"><code>${escapeHtml(symbol.name)}</code><span>${escapeHtml(statusLabels[symbol.status] ?? symbol.status)}</span></div>
        ${symbol.macroValue !== null ? `<h3>宏替换文本</h3><pre>${escapeHtml(symbol.macroValue)}</pre>` : ''}
        ${definitions ? `<ul class="locations">${definitions}</ul>` : '<p class="muted">没有可跳转的源码声明。</p>'}` : '<p class="muted">将光标放到标识符上，可查看解析结果与声明来源。</p>'}
        <h2>分析范围</h2><dl><dt>依赖</dt><dd>${model.analysis?.dependenciesComplete ? '已解析当前文件的静态依赖' : '存在未解析依赖，请查看依赖页'}</dd><dt>未启用区域</dt><dd>${model.inactiveRanges.length} 处</dd><dt>本文件有效宏指令</dt><dd>${model.macros.length} 条</dd></dl>`;
    const macros = `<h1>宏与条件编译</h1><h2>未启用的源码区域</h2>${model.inactiveRanges.length ? `<ul>${model.inactiveRanges.map(range => `<li>${localLink(range, `第 ${range.start.line + 1}–${range.end.line + 1} 行`)}</li>`).join('')}</ul>` : '<p class="muted">当前文件没有未启用区域。</p>'}
        <h2>本文件有效的 define / undef</h2>${model.macros.length ? `<table><thead><tr><th>指令</th><th>宏名 / 位置</th><th>替换文本</th></tr></thead><tbody>${model.macros.map(macro => `<tr><td>${macro.kind === 'define' ? '#define' : '#undef'}</td><td>${localLink(macro.range, `${macro.name}:${macro.range.start.line + 1}`)}</td><td><code>${escapeHtml(macro.value ?? '—')}</code></td></tr>`).join('')}</tbody></table>` : '<p class="muted">没有有效宏指令。</p>'}
        <h2>进入文件时的宏环境</h2><p class="muted">来自项目预定义及全局头文件；文件内 include 引入的宏可在使用处查看来源。</p><table><thead><tr><th>名称</th><th>替换文本</th></tr></thead><tbody>${Object.entries(model.initialMacros).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `<tr><td><code>${escapeHtml(name)}</code></td><td><code>${escapeHtml(value)}</code></td></tr>`).join('')}</tbody></table>`;
    const dependencies = `<h1>依赖与模拟函数入口</h1><p class="muted">当前文件的直接依赖及配置入口。打开目标文件可继续查看它的依赖。</p>${model.analysis?.dependencies.length ? `<table><thead><tr><th>来源</th><th>配置路径</th><th>索引中的目标</th></tr></thead><tbody>${model.analysis.dependencies.map(dependency => `<tr><td>${escapeHtml(dependencyLabels[dependency.kind] ?? dependency.kind)}</td><td><code>${escapeHtml(dependency.path)}</code></td><td>${dependency.targets.length ? dependency.targets.map(uri => link({ uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } }, displayPath(uri))).join('<br>') : '<span class="unresolved">未解析</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">当前没有可展示的依赖。</p>'}`;
    const maxPreview = 200_000;
    const preprocessed = `<h1>静态预处理视图</h1><p class="notice">此视图保留原始行号，将指令及未启用区域置空。宏调用和 include 不展开；它不是 FluffOS 编译器的完整预处理输出。</p>${model.preprocessedText.length > maxPreview ? '<p class="unresolved">文件较大，仅展示前 200,000 个字符。</p>' : ''}<pre class="source">${escapeHtml(model.preprocessedText.slice(0, maxPreview))}</pre>`;
    return { overview, macros, dependencies, preprocessed, locations };
}

export function inspectionHtml(nonce: string): string {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
    * { box-sizing: border-box; } body { margin: 0; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    header { position: sticky; top: 0; background: var(--vscode-editor-background); border-bottom: 1px solid var(--vscode-panel-border); padding: 12px 18px 0; z-index: 1; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; } .title { font-weight: 600; letter-spacing: .04em; } #status { color: var(--vscode-descriptionForeground); font-size: 12px; }
    nav { display: flex; gap: 16px; overflow-x: auto; margin-top: 12px; } button { font: inherit; cursor: pointer; } nav button { padding: 10px 0; border: 0; border-bottom: 2px solid transparent; color: var(--vscode-descriptionForeground); background: transparent; white-space: nowrap; }
    nav button[aria-selected="true"] { color: var(--vscode-editor-foreground); border-color: var(--vscode-focusBorder); } button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 3px; }
    #refresh { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 0; padding: 5px 12px; }
    main { padding: 22px 24px 40px; max-width: 1200px; } h1 { font-size: 20px; font-weight: 500; overflow-wrap: anywhere; margin: 0 0 18px; } h2 { font-size: 14px; margin: 28px 0 12px; } h3 { font-size: 12px; font-weight: 500; margin-top: 20px; }
    .eyebrow { color: var(--vscode-descriptionForeground); font-size: 11px; letter-spacing: .08em; margin: 0 0 10px; } .notice { border-left: 2px solid var(--vscode-focusBorder); padding: 9px 12px; background: var(--vscode-textBlockQuote-background); line-height: 1.6; }
    .muted { color: var(--vscode-descriptionForeground); line-height: 1.6; } .symbol { display: flex; flex-wrap: wrap; gap: 15px; align-items: center; } .symbol code { font-size: 18px; } .symbol span { color: var(--vscode-descriptionForeground); }
    code, pre { font-family: var(--vscode-editor-font-family); } pre { white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; background: var(--vscode-textCodeBlock-background); line-height: 1.6; } .source { white-space: pre; overflow: auto; tab-size: 4; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; } th { text-align: left; color: var(--vscode-descriptionForeground); font-weight: 500; } th, td { padding: 10px 8px; border-bottom: 1px solid var(--vscode-panel-border); vertical-align: top; overflow-wrap: anywhere; } th:first-child { width: 20%; }
    .source-link { color: var(--vscode-textLink-foreground); background: none; border: none; padding: 0; text-align: left; overflow-wrap: anywhere; } .source-link:hover { text-decoration: underline; } .unresolved { color: var(--vscode-editorWarning-foreground); } li { margin: 9px 0; } dl { display: grid; grid-template-columns: max-content 1fr; gap: 12px 24px; } dt { color: var(--vscode-descriptionForeground); } dd { margin: 0; }
    [hidden] { display: none !important; } @media(max-width: 500px) { main { padding: 18px 12px; } header { padding-left: 12px; padding-right: 12px; } nav { gap: 12px; } th, td { padding: 8px 4px; } }
    </style></head><body><header><div class="toolbar"><span class="title">LPC 分析查看器</span><span id="status" role="status">正在读取…</span><button id="refresh">刷新</button></div>
    <nav aria-label="分析视图" role="tablist">${[['overview', '概要'], ['macros', '宏与条件'], ['dependencies', '依赖'], ['preprocessed', '预处理视图']].map(([id, label], i) => `<button role="tab" id="tab-${id}" aria-controls="${id}" data-tab="${id}" aria-selected="${i === 0}">${label}</button>`).join('')}</nav></header>
    <main>${['overview', 'macros', 'dependencies', 'preprocessed'].map((id, i) => `<section id="${id}" role="tabpanel" aria-labelledby="tab-${id}" ${i ? 'hidden' : ''}></section>`).join('')}</main>
    <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let generation = 0;
    document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
    document.addEventListener('click', event => {
        const link = event.target.closest('[data-location]');
        if (link) vscode.postMessage({ type: 'open', index: Number(link.dataset.location), generation });
        const tab = event.target.closest('[data-tab]');
        if (!tab) return;
        document.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button === tab)));
        document.querySelectorAll('[role="tabpanel"]').forEach(section => { section.hidden = section.id !== tab.dataset.tab; });
    });
    window.addEventListener('message', event => {
        const message = event.data;
        document.getElementById('status').textContent = message.status;
        if (message.type === 'snapshot') {
            generation = message.generation;
            for (const id of ['overview', 'macros', 'dependencies', 'preprocessed']) document.getElementById(id).innerHTML = message.view[id];
        } else if (message.type === 'empty') {
            for (const id of ['overview', 'macros', 'dependencies', 'preprocessed']) document.getElementById(id).textContent = message.status;
        }
    });
    vscode.postMessage({ type: 'ready' });
    </script></body></html>`;
}
