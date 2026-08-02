(function () {
    'use strict';

    const vscode = acquireVsCodeApi();
    const state = {
        sessionId: undefined,
        revision: -1,
        snapshot: undefined,
        externalGroups: [],
        externalEntries: [],
        externalRequestId: undefined,
        externalLoading: false,
        externalScopes: [],
        selectedEntryId: undefined,
        query: '',
        scope: 'all',
        quality: 'all',
        kind: 'all',
        collapsedGroups: new Set(),
        selectedSignatureByEntry: new Map(),
        visibleLimit: 250,
        searchTextCache: new Map()
    };
    let externalSearchTimer;

    const elements = {
        documentPath: document.getElementById('document-path'),
        statusDot: document.getElementById('status-dot'),
        statusText: document.getElementById('status-text'),
        refreshButton: document.getElementById('refresh-button'),
        searchInput: document.getElementById('search-input'),
        resultCount: document.getElementById('result-count'),
        functionList: document.getElementById('function-list'),
        detailPanel: document.getElementById('detail-panel')
    };

    function createElement(tagName, options) {
        const element = document.createElement(tagName);
        if (!options) return element;
        if (options.className) element.className = options.className;
        if (options.text !== undefined) element.textContent = options.text;
        if (options.title) element.title = options.title;
        return element;
    }

    function setStatus(text, kind) {
        elements.statusText.textContent = text;
        elements.statusDot.className = 'status-dot';
        if (kind) elements.statusDot.classList.add(`is-${kind}`);
    }

    function setSnapshotStatus(snapshot) {
        setStatus(
            snapshot.status === 'ready'
                ? `${snapshot.entries.length} 个声明`
                : snapshot.status === 'partial'
                    ? `部分结果 · ${snapshot.diagnostics.length} 个诊断`
                    : `分析失败${snapshot.diagnostics.length ? ` · ${snapshot.diagnostics[0].message}` : ''}`,
            snapshot.status === 'ready' ? undefined : snapshot.status === 'partial' ? 'warning' : 'error'
        );
    }

    function normalize(value) {
        return (value || '').toLocaleLowerCase('zh-CN');
    }

    function entrySearchText(entry, group) {
        const cacheKey = `${entry.id}\u0000${group.id}`;
        const cached = state.searchTextCache.get(cacheKey);
        if (cached !== undefined) return cached;
        const values = [entry.name, group.displayLabel, group.workspaceRelativePath];
        for (const signature of entry.signatures) {
            values.push(signature.label, signature.returnType);
            for (const parameter of signature.parameters) {
                values.push(parameter.name, parameter.type, parameter.description, parameter.defaultValueText);
            }
        }
        values.push(
            entry.documentation.summary,
            entry.documentation.details,
            entry.documentation.note,
            entry.documentation.returns && entry.documentation.returns.description
        );
        const searchText = normalize(values.filter(Boolean).join('\n'));
        state.searchTextCache.set(cacheKey, searchText);
        return searchText;
    }

    function getEntryMap() {
        return new Map([
            ...(state.snapshot && state.snapshot.entries || []),
            ...state.externalEntries
        ].map(entry => [entry.id, entry]));
    }

    function getGroupMap() {
        return new Map([
            ...(state.snapshot && state.snapshot.groups || []),
            ...state.externalGroups
        ].map(group => [group.id, group]));
    }

    function matchesEntry(entry, group) {
        if (state.scope !== 'all' && entry.sourceKind !== state.scope) return false;
        if (state.quality !== 'all' && entry.quality.status !== state.quality) return false;
        if (state.kind !== 'all' && entry.declarationKind !== state.kind) return false;
        const query = normalize(state.query.trim());
        return !query || entrySearchText(entry, group).includes(query);
    }

    function badge(text, className) {
        return createElement('span', { className: `badge ${className || ''}`.trim(), text });
    }

    function sourceLabel(sourceKind) {
        return {
            local: '当前文件',
            inherit: '继承',
            include: '包含',
            simulEfun: '模拟函数',
            efun: 'Efun'
        }[sourceKind] || sourceKind;
    }

    function declarationLabel(kind) {
        return kind === 'prototype' ? '原型' : kind === 'external' ? '外部' : '实现';
    }

    function qualityLabel(status) {
        return {
            complete: '完整',
            incomplete: '待补充',
            inconsistent: '不一致',
            notApplicable: '不适用'
        }[status] || status;
    }

    function relationLabel(status) {
        return {
            overrides: '覆盖继承实现',
            overridden: '已被当前文件覆盖',
            ambiguous: '继承冲突',
            unresolved: '关系未完整解析'
        }[status];
    }

    function externalLoadingLabel() {
        if (state.externalScopes.length === 1) {
            return state.externalScopes[0] === 'simulEfun' ? '正在加载模拟函数' : '正在加载 Efun';
        }
        return '正在加载外部函数';
    }

    function createExternalLoadingState(compact = false) {
        const loading = createElement('div', {
            className: `catalog-loading${compact ? ' is-compact' : ''}`
        });
        loading.setAttribute('role', 'status');
        loading.setAttribute('aria-live', 'polite');
        const spinner = createElement('span', { className: 'catalog-spinner' });
        spinner.setAttribute('aria-hidden', 'true');
        const copy = createElement('span', { className: 'catalog-loading-copy' });
        copy.append(
            createElement('strong', { text: externalLoadingLabel() }),
            createElement('span', { text: compact ? '…' : '正在读取结构化签名与文档，请稍候。' })
        );
        loading.append(spinner, copy);
        return loading;
    }

    function renderList() {
        elements.functionList.replaceChildren();
        elements.functionList.setAttribute('aria-busy', String(state.externalLoading));
        if (!state.snapshot) {
            elements.resultCount.textContent = '0';
            return;
        }

        const entryMap = getEntryMap();
        let totalMatchingCount = 0;
        let totalExpandedMatchingCount = 0;
        let renderedCount = 0;

        for (const group of [...state.snapshot.groups, ...state.externalGroups]) {
            const matchingEntries = group.entryIds
                .map(id => entryMap.get(id))
                .filter(Boolean)
                .filter(entry => matchesEntry(entry, group));
            if (matchingEntries.length === 0) continue;

            totalMatchingCount += matchingEntries.length;
            const isCollapsed = state.collapsedGroups.has(group.id);
            if (!isCollapsed) totalExpandedMatchingCount += matchingEntries.length;
            const availableSlots = Math.max(0, state.visibleLimit - renderedCount);
            const visibleEntries = isCollapsed ? [] : matchingEntries.slice(0, availableSlots);
            if (!isCollapsed && visibleEntries.length === 0) continue;

            renderedCount += visibleEntries.length;
            const groupElement = createElement('section', { className: 'group' });
            groupElement.setAttribute('role', 'group');
            if (isCollapsed) groupElement.classList.add('is-collapsed');

            const header = createElement('button', { className: 'group-header' });
            header.type = 'button';
            header.setAttribute('aria-expanded', String(!isCollapsed));
            header.append(
                createElement('span', { className: 'group-chevron', text: '▾' }),
                createElement('span', { className: 'group-label', text: group.displayLabel }),
                badge(String(matchingEntries.length))
            );
            header.addEventListener('click', () => {
                if (state.collapsedGroups.has(group.id)) state.collapsedGroups.delete(group.id);
                else state.collapsedGroups.add(group.id);
                renderList();
            });
            groupElement.append(header);
            if (group.workspaceRelativePath && group.sourceKind !== 'local') {
                groupElement.append(createElement('span', {
                    className: 'group-path',
                    text: group.workspaceRelativePath,
                    title: group.workspaceRelativePath
                }));
            }

            const entriesElement = createElement('div', { className: 'group-entries' });
            for (const entry of visibleEntries) {
                const row = createElement('button', { className: 'function-row' });
                row.type = 'button';
                row.dataset.entryId = entry.id;
                row.setAttribute('role', 'treeitem');
                row.setAttribute('aria-selected', String(state.selectedEntryId === entry.id));
                if (state.selectedEntryId === entry.id) row.classList.add('is-selected');

                const head = createElement('div', { className: 'row-head' });
                head.append(createElement('span', { className: 'function-name', text: entry.name }));
                head.append(badge(declarationLabel(entry.declarationKind), `kind-${entry.declarationKind}`));
                if (entry.quality.status !== 'complete' && entry.quality.status !== 'notApplicable') {
                    head.append(badge(qualityLabel(entry.quality.status), `quality-${entry.quality.status}`));
                }
                if (relationLabel(entry.relation.status)) head.append(badge(relationLabel(entry.relation.status)));
                row.append(head);
                row.append(createElement('div', {
                    className: 'function-signature',
                    text: entry.signatures[0] ? entry.signatures[0].label : entry.name,
                    title: entry.signatures[0] ? entry.signatures[0].label : entry.name
                }));
                row.append(createElement('div', {
                    className: 'function-summary',
                    text: entry.documentation.summary || '暂无简要说明'
                }));
                row.addEventListener('click', () => selectEntry(entry.id));
                entriesElement.append(row);
            }
            groupElement.append(entriesElement);
            elements.functionList.append(groupElement);
        }

        elements.resultCount.textContent = state.externalLoading && totalMatchingCount === 0
            ? '…'
            : renderedCount < totalExpandedMatchingCount
            ? `${renderedCount}/${totalMatchingCount}`
            : String(totalMatchingCount);
        if (totalMatchingCount === 0) {
            if (state.externalLoading) {
                elements.functionList.append(createExternalLoadingState());
            } else {
                const empty = createElement('div', { className: 'empty-state' });
                empty.append(
                    createElement('div', { className: 'empty-glyph', text: '∅' }),
                    createElement('h2', { text: '没有匹配的声明' }),
                    createElement('p', { text: '调整搜索内容或筛选条件后重试。' })
                );
                elements.functionList.append(empty);
            }
        } else if (renderedCount < totalExpandedMatchingCount) {
            const loadMore = createElement('button', {
                className: 'load-more',
                text: `继续加载（剩余 ${totalExpandedMatchingCount - renderedCount}）`
            });
            loadMore.type = 'button';
            loadMore.addEventListener('click', () => {
                state.visibleLimit += 250;
                renderList();
            });
            elements.functionList.append(loadMore);
        }
        if (state.externalLoading && totalMatchingCount > 0) {
            elements.functionList.append(createExternalLoadingState(true));
        }
    }

    function selectEntry(entryId) {
        state.selectedEntryId = entryId;
        renderList();
        renderDetail();
    }

    function appendSection(root, title, content) {
        const section = createElement('section', { className: 'detail-section' });
        section.append(createElement('h3', { className: 'section-kicker', text: title }));
        section.append(content);
        root.append(section);
    }

    function renderDetail() {
        elements.detailPanel.replaceChildren();
        const entry = getEntryMap().get(state.selectedEntryId);
        if (!entry) {
            const empty = createElement('div', { className: 'empty-state' });
            empty.append(
                createElement('div', { className: 'empty-glyph', text: '{ }' }),
                createElement('h2', { text: '选择一个函数' }),
                createElement('p', { text: '从左侧目录查看结构化签名、来源关系与文档质量。' })
            );
            elements.detailPanel.append(empty);
            return;
        }

        const group = getGroupMap().get(entry.sourceGroupId);
        const header = createElement('header', { className: 'detail-header' });
        const title = createElement('div', { className: 'detail-title' });
        title.append(createElement('h2', { text: entry.name }));
        const badgeLine = createElement('div', { className: 'badge-line' });
        badgeLine.append(
            badge(sourceLabel(entry.sourceKind)),
            badge(declarationLabel(entry.declarationKind), `kind-${entry.declarationKind}`),
            badge(qualityLabel(entry.quality.status), `quality-${entry.quality.status}`)
        );
        for (const modifier of entry.modifiers) badgeLine.append(badge(modifier));
        if (relationLabel(entry.relation.status)) badgeLine.append(badge(relationLabel(entry.relation.status)));
        title.append(badgeLine);
        const position = entry.selectionRange && entry.selectionRange.start || entry.sourceRange && entry.sourceRange.start;
        const sourceText = [
            group && group.workspaceRelativePath,
            position ? `第 ${position.line + 1} 行，第 ${position.character + 1} 列` : undefined
        ].filter(Boolean).join(' · ');
        title.append(createElement('div', { className: 'source-line', text: sourceText }));

        const actions = createElement('div', { className: 'action-line' });
        if (entry.capabilities.canGoToDefinition) actions.append(actionButton('跳转到定义', 'goToDefinition', entry));
        if (entry.capabilities.canFindReferences) actions.append(actionButton('查找引用', 'findReferences', entry));
        if (entry.capabilities.canCopySignature) {
            const copy = createElement('button', { className: 'action-button', text: '复制签名' });
            copy.type = 'button';
            copy.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(entry.signatures.map(signature => signature.label).join('\n'));
                    setStatus('签名已复制', undefined);
                } catch {
                    setStatus('复制签名失败，请检查剪贴板权限。', 'error');
                }
            });
            actions.append(copy);
        }
        const authorMode = entry.quality.action;
        const canAuthor = authorMode === 'generate'
            ? entry.capabilities.canGenerateDocumentation
            : authorMode === 'complete'
                ? entry.capabilities.canCompleteDocumentation
                : authorMode === 'update' && entry.capabilities.canUpdateDocumentation;
        if (canAuthor) {
            const label = authorMode === 'generate' ? '生成文档' : authorMode === 'update' ? '更新文档' : '补全文档';
            actions.append(actionButton(label, 'authorDocumentation', entry, authorMode, true));
        }
        header.append(title, actions);
        elements.detailPanel.append(header);

        const signatures = createElement('div');
        const selectedSignatureIndex = Math.min(
            state.selectedSignatureByEntry.get(entry.id) || 0,
            Math.max(0, entry.signatures.length - 1)
        );
        if (entry.signatures.length > 1) {
            const tabs = createElement('div', { className: 'signature-tabs' });
            tabs.setAttribute('role', 'tablist');
            entry.signatures.forEach((signature, index) => {
                const tab = createElement('button', {
                    className: `signature-tab ${index === selectedSignatureIndex ? 'is-active' : ''}`.trim(),
                    text: `签名 ${index + 1}`,
                    title: signature.label
                });
                tab.type = 'button';
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', String(index === selectedSignatureIndex));
                tab.addEventListener('click', () => {
                    state.selectedSignatureByEntry.set(entry.id, index);
                    renderDetail();
                });
                tabs.append(tab);
            });
            signatures.append(tabs);
        }
        const visibleSignatures = entry.signatures.length > 0
            ? [entry.signatures[selectedSignatureIndex]]
            : [];
        for (const signature of visibleSignatures) {
            const card = createElement('article', { className: 'signature-card' });
            const pre = createElement('pre');
            pre.append(createElement('code', { text: signature.label }));
            card.append(pre);
            const meta = createElement('div', { className: 'signature-meta' });
            if (signature.returnType) meta.append(badge(`返回 ${signature.returnType}`));
            if (signature.isFunctionVarargs) meta.append(badge('函数级 varargs'));
            if (signature.isParameterVariadic) meta.append(badge('变长参数'));
            if (signature.arity) {
                const max = signature.arity.max === null || signature.arity.max === undefined ? '∞' : signature.arity.max;
                meta.append(badge(`参数 ${signature.arity.min}–${max}`));
            }
            card.append(meta);
            signatures.append(card);
        }
        appendSection(elements.detailPanel, '函数签名', signatures);

        const parameters = visibleSignatures.flatMap(signature => signature.parameters);
        if (parameters.length > 0) {
            const table = createElement('table', { className: 'parameter-table' });
            const thead = createElement('thead');
            const headerRow = createElement('tr');
            for (const label of ['参数', '类型', '属性', '说明']) headerRow.append(createElement('th', { text: label }));
            thead.append(headerRow);
            const tbody = createElement('tbody');
            for (const parameter of parameters) {
                const row = createElement('tr');
                const nameCell = createElement('td');
                nameCell.append(createElement('code', { text: parameter.name }));
                const typeCell = createElement('td');
                typeCell.append(createElement('code', { text: parameter.type || '未指定' }));
                const flags = [parameter.optional ? '可选' : '', parameter.variadic ? '变长' : '', parameter.defaultValueText ? `默认 ${parameter.defaultValueText}` : ''].filter(Boolean).join(' · ');
                row.append(
                    nameCell,
                    typeCell,
                    createElement('td', { className: flags ? '' : 'muted', text: flags || '—' }),
                    createElement('td', { className: parameter.description ? '' : 'muted', text: parameter.description || '暂无说明' })
                );
                tbody.append(row);
            }
            table.append(thead, tbody);
            appendSection(elements.detailPanel, '参数', table);
        }

        const returnTypes = [...new Set(entry.signatures.map(signature => signature.returnType).filter(Boolean))];
        if (returnTypes.length > 0 || entry.documentation.returns) {
            const returns = createElement('div', { className: 'doc-copy' });
            returns.append(createElement('p', { text: `类型：${returnTypes.join(' / ') || entry.documentation.returns.type || '未指定'}` }));
            returns.append(createElement('p', {
                className: entry.documentation.returns && entry.documentation.returns.description ? '' : 'muted',
                text: entry.documentation.returns && entry.documentation.returns.description || '暂无返回值说明'
            }));
            appendSection(elements.detailPanel, '返回值', returns);
        }

        if (entry.documentation.summary) appendSection(elements.detailPanel, '简要说明', createElement('div', { className: 'doc-copy', text: entry.documentation.summary }));
        if (entry.documentation.details) appendSection(elements.detailPanel, '详细说明', createElement('div', { className: 'doc-copy', text: entry.documentation.details }));
        if (entry.documentation.note) appendSection(elements.detailPanel, '注意事项', createElement('div', { className: 'doc-copy', text: entry.documentation.note }));
        if (entry.documentation.returnObjects && entry.documentation.returnObjects.length > 0) {
            appendSection(elements.detailPanel, '返回对象提示', createElement('div', { className: 'doc-copy', text: entry.documentation.returnObjects.join('\n') }));
        }

        const quality = createElement('div', { className: `quality-panel ${entry.quality.status === 'complete' ? 'is-complete' : ''}` });
        quality.append(createElement('strong', { text: `文档状态：${qualityLabel(entry.quality.status)}` }));
        if (entry.quality.issues.length > 0) {
            const list = createElement('ul');
            for (const issue of entry.quality.issues) list.append(createElement('li', { text: issue.message }));
            quality.append(list);
        } else if (entry.quality.status === 'notApplicable') {
            quality.append(createElement('p', { text: '当前声明不参与文档完整度评估。' }));
        } else {
            quality.append(createElement('p', { text: '结构化声明与文档字段一致。' }));
        }
        appendSection(elements.detailPanel, '文档质量', quality);
    }

    function actionButton(label, type, entry, mode, primary) {
        const button = createElement('button', { className: `action-button ${primary ? 'primary' : ''}`.trim(), text: label });
        button.type = 'button';
        button.addEventListener('click', () => {
            const message = { type, entryId: entry.id, revision: state.revision };
            if (mode) message.mode = mode;
            vscode.postMessage(message);
        });
        return button;
    }

    function acceptSnapshot(snapshot) {
        if (!snapshot || snapshot.protocolVersion !== 2) return;
        if (state.sessionId && snapshot.sessionId !== state.sessionId) return;
        if (snapshot.revision < state.revision) return;
        state.sessionId = snapshot.sessionId;
        state.revision = snapshot.revision;
        state.snapshot = snapshot;
        state.externalGroups = [];
        state.externalEntries = [];
        state.externalRequestId = undefined;
        state.externalLoading = false;
        state.externalScopes = [];
        if (externalSearchTimer) {
            clearTimeout(externalSearchTimer);
            externalSearchTimer = undefined;
        }
        state.searchTextCache.clear();
        state.visibleLimit = 250;
        elements.documentPath.textContent = snapshot.rootDocument.workspaceRelativePath;
        const diagnosticSummary = (snapshot.diagnostics || []).map(item => item.message).join('\n');
        elements.statusText.title = diagnosticSummary;
        setSnapshotStatus(snapshot);
        const ids = new Set(snapshot.entries.map(entry => entry.id));
        if (!ids.has(state.selectedEntryId)) state.selectedEntryId = snapshot.entries[0] && snapshot.entries[0].id;
        const selectedIndex = snapshot.entries.findIndex(entry => entry.id === state.selectedEntryId);
        if (selectedIndex >= 0) state.visibleLimit = Math.max(state.visibleLimit, selectedIndex + 1);
        renderList();
        renderDetail();
        scheduleExternalSearch();
    }

    elements.searchInput.addEventListener('input', event => {
        state.query = event.target.value;
        state.visibleLimit = 250;
        scheduleExternalSearch();
    });
    elements.refreshButton.addEventListener('click', () => vscode.postMessage({ type: 'refresh', sessionId: state.sessionId || '' }));
    elements.functionList.addEventListener('keydown', event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const rows = [...elements.functionList.querySelectorAll('.function-row')];
        if (rows.length === 0) return;
        const currentIndex = rows.indexOf(document.activeElement);
        let nextIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = rows.length - 1;
        else if (event.key === 'ArrowDown') nextIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + 1));
        else nextIndex = Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1);
        event.preventDefault();
        rows[nextIndex].focus();
    });
    document.querySelectorAll('[data-filter-group]').forEach(button => {
        button.addEventListener('click', () => {
            const group = button.dataset.filterGroup;
            document.querySelectorAll(`[data-filter-group="${group}"]`).forEach(candidate => candidate.classList.remove('is-active'));
            button.classList.add('is-active');
            state[group] = button.dataset.filterValue;
            state.visibleLimit = 250;
            if (group === 'scope') scheduleExternalSearch();
            else renderList();
        });
    });
    document.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
            event.preventDefault();
            elements.searchInput.focus();
        }
    });
    window.addEventListener('message', event => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'loading') {
            if (!state.sessionId || message.sessionId === state.sessionId) setStatus(message.stage || '正在刷新', 'loading');
        } else if (message.type === 'snapshot') {
            acceptSnapshot(message.payload);
        } else if (message.type === 'actionResult' && message.message) {
            setStatus(message.message, message.ok ? undefined : 'error');
        } else if (message.type === 'externalSearchResult' && message.requestId === state.externalRequestId) {
            state.externalGroups = message.groups || [];
            state.externalEntries = message.entries || [];
            state.externalLoading = false;
            state.searchTextCache.clear();
            if (message.diagnostics && message.diagnostics.length > 0) {
                setStatus(message.diagnostics.map(item => item.message).join('；'), 'warning');
            } else if (state.snapshot) {
                setSnapshotStatus(state.snapshot);
            }
            renderList();
        }
    });

    function scheduleExternalSearch() {
        if (externalSearchTimer) {
            clearTimeout(externalSearchTimer);
            externalSearchTimer = undefined;
        }
        state.externalRequestId = undefined;
        state.externalLoading = false;
        state.externalScopes = [];
        if (!state.snapshot || !state.snapshot.capabilities.supportsExternalSearch) {
            renderList();
            return;
        }
        const scopes = state.scope === 'simulEfun' || state.scope === 'efun'
            ? [state.scope]
            : state.scope === 'all' && state.query.trim().length >= 2
                ? ['simulEfun', 'efun']
                : [];
        if (scopes.length === 0) {
            state.externalGroups = [];
            state.externalEntries = [];
            renderList();
            return;
        }
        state.externalGroups = [];
        state.externalEntries = [];
        state.externalLoading = true;
        state.externalScopes = scopes;
        state.searchTextCache.clear();
        renderList();
        externalSearchTimer = setTimeout(() => {
            externalSearchTimer = undefined;
            const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            state.externalRequestId = requestId;
            vscode.postMessage({
                type: 'searchExternal',
                requestId,
                query: state.query,
                scopes
            });
        }, 180);
    }

    vscode.postMessage({ type: 'ready', protocolVersion: 2 });
})();
