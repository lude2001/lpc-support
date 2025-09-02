(function() {
    const vscode = acquireVsCodeApi();
    let currentActive = null;
    let allFunctions = [];
    
    // 初始化
    function init() {
        // 初始化分组状态
        initGroupStates();
        
        // 绑定搜索和过滤事件（不依赖函数列表）
        bindStaticEvents();
    }
    
    function bindStaticEvents() {
        // 过滤按钮事件
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                setActiveFilter(btn);
                applyFilter(btn.getAttribute('data-filter'));
            });
        });
        
        // 搜索事件
        const searchInput = document.getElementById('search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                applySearch(searchInput.value);
            });
        }
    }
    
    function bindDynamicEvents() {
        // 函数点击事件
        document.querySelectorAll('.function-item').forEach(item => {
            item.addEventListener('click', () => {
                selectFunction(item);
            });
        });
        
        // 分组折叠事件
        document.querySelectorAll('.group-header').forEach(header => {
            header.addEventListener('click', () => {
                toggleGroup(header);
            });
        });
    }
    
    function selectFunction(item) {
        const functionName = item.getAttribute('data-name');
        const source = item.getAttribute('data-source');
        const definition = item.getAttribute('data-definition');
        const comment = item.getAttribute('data-comment');
        const filePath = item.getAttribute('data-file');
        const line = parseInt(item.getAttribute('data-line'));
        
        // 更新选中状态
        if (currentActive) {
            currentActive.classList.remove('active');
        }
        item.classList.add('active');
        currentActive = item;
        
        // 直接显示文档，不需要发送消息
        showFunctionDoc({
            name: functionName,
            source: source,
            definition: definition,
            comment: comment,
            filePath: filePath,
            line: line
        });
    }
    
    function toggleGroup(header) {
        const toggleId = header.getAttribute('data-toggle');
        const content = document.getElementById('group-' + toggleId);
        if (content) {
            content.classList.toggle('collapsed');
        }
    }
    
    function initGroupStates() {
        // 默认展开所有分组
        document.querySelectorAll('.group-content').forEach(content => {
            content.classList.remove('collapsed');
        });
    }
    
    function setActiveFilter(activeBtn) {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
    }
    
    function applyFilter(filter) {
        allFunctions.forEach(item => {
            const group = item.getAttribute('data-group');
            const hasComment = item.getAttribute('data-comment') && item.getAttribute('data-comment').trim();
            
            let show = false;
            switch (filter) {
                case 'current':
                    show = item.getAttribute('data-source') === '当前文件';
                    break;
                case 'inherited':
                    show = group === 'inherited';
                    break;
                case 'included':
                    show = group === 'included';
                    break;
                case 'documented':
                    show = !!hasComment;
                    break;
                case 'all':
                default:
                    show = true;
                    break;
            }
            
            item.style.display = show ? 'flex' : 'none';
        });
        
        // 控制分组标题的显示
        document.querySelectorAll('.function-group').forEach(group => {
            if (filter === 'all') {
                // 显示所有分组标题
                group.style.display = 'block';
            } else {
                // 检查该分组是否有可见的函数项
                const visibleItems = group.querySelectorAll('.function-item[style*="flex"], .function-item:not([style*="none"])');
                group.style.display = visibleItems.length > 0 ? 'block' : 'none';
            }
        });
        
        // 更新分组计数
        updateGroupCounts();
    }
    
    function applySearch(query) {
        const lowerQuery = query.toLowerCase();
        const currentFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
        
        allFunctions.forEach(item => {
            const name = item.getAttribute('data-name').toLowerCase();
            const definition = item.getAttribute('data-definition').toLowerCase();
            const comment = item.getAttribute('data-comment').toLowerCase();
            
            const matches = name.includes(lowerQuery) || 
                          definition.includes(lowerQuery) || 
                          comment.includes(lowerQuery);
            
            // 只在当前过滤器显示的基础上进行搜索
            if (item.style.display !== 'none') {
                item.style.display = matches ? 'flex' : 'none';
            }
        });
        
        // 控制分组标题的显示（搜索时也要考虑）
        document.querySelectorAll('.function-group').forEach(group => {
            if (currentFilter === 'all') {
                // 显示有可见函数的分组
                const visibleItems = group.querySelectorAll('.function-item[style*="flex"], .function-item:not([style*="none"])');
                group.style.display = visibleItems.length > 0 ? 'block' : 'none';
            } else {
                // 检查该分组是否有可见的函数项
                const visibleItems = group.querySelectorAll('.function-item[style*="flex"], .function-item:not([style*="none"])');
                group.style.display = visibleItems.length > 0 ? 'block' : 'none';
            }
        });
        
        // 更新分组计数
        updateGroupCounts();
    }
    
    function updateGroupCounts() {
        document.querySelectorAll('.function-group').forEach(group => {
            const groupContent = group.querySelector('.group-content');
            const countElement = group.querySelector('.group-count');
            
            if (groupContent && countElement) {
                const visibleItems = groupContent.querySelectorAll('.function-item[style*="flex"], .function-item:not([style*="none"])');
                countElement.textContent = visibleItems.length;
            }
        });
    }
    
    function showFunctionDoc(functionData) {
        const docArea = document.getElementById('doc-content');
        if (!docArea) return;
        
        const { name, definition, source, comment, filePath, line } = functionData;
        
        let html = `
            <div class="function-header">
                <h3>${FunctionUtils.escapeHtml(name)}</h3>
                <div class="function-meta">
                    <span class="source">来源: ${FunctionUtils.escapeHtml(source)}</span>
                    ${filePath ? `<button class="goto-def-btn" data-file="${FunctionUtils.escapeHtml(filePath)}" data-line="${line}">跳转到定义</button>` : ''}
                </div>
            </div>
            <div class="function-definition">
                <h4>函数定义</h4>
                <pre><code>${FunctionUtils.escapeHtml(definition)}</code></pre>
            </div>
        `;
        
        if (comment && comment.trim()) {
            // 使用统一的JavaDoc注释处理逻辑
            const processedComment = processJavaDocComment(comment);
            html += `
                <div class="function-documentation">
                    <h4>文档</h4>
                    <div class="doc-content">${processedComment}</div>
                </div>
            `;
        } else {
            html += `
                <div class="function-documentation">
                    <h4>文档</h4>
                    <div class="doc-content"><em>暂无文档</em></div>
                </div>
            `;
        }
        
        docArea.innerHTML = html;
        
        // 绑定跳转按钮事件
        const gotoBtn = docArea.querySelector('.goto-def-btn');
        if (gotoBtn) {
            gotoBtn.addEventListener('click', () => {
                const file = gotoBtn.getAttribute('data-file');
                const line = parseInt(gotoBtn.getAttribute('data-line'));
                vscode.postMessage({
                    command: 'gotoDefinition',
                    filePath: file,
                    line: line
                });
            });
        }
    }
    
    // escapeHtml函数已移至JavaDocProcessor类中
    
    function processJavaDocComment(comment) {
        if (!comment) return '';
        
        // 移除开头的 /** 和结尾的 */
        let processed = comment.replace(/^\/\*\*\s*/, '').replace(/\s*\*\/$/, '');
        
        // 移除每行开头的 * 和空格
        processed = processed.replace(/^\s*\*\s?/gm, '');
        
        // 处理 @param 标签
        processed = processed.replace(/@param\s+(\w+)\s+(.+)/g, '<strong>参数 $1:</strong> $2');
        
        // 处理 @return 标签
        processed = processed.replace(/@return\s+(.+)/g, '<strong>返回值:</strong> $1');
        
        // 处理 @see 标签
        processed = processed.replace(/@see\s+(.+)/g, '<strong>参见:</strong> $1');
        
        // 处理 @since 标签
        processed = processed.replace(/@since\s+(.+)/g, '<strong>版本:</strong> $1');
        
        // 处理 @author 标签
        processed = processed.replace(/@author\s+(.+)/g, '<strong>作者:</strong> $1');
        
        // 处理 @deprecated 标签
        processed = processed.replace(/@deprecated\s*(.*)/, '<strong style="color: #ff6b6b;">已废弃:</strong> $1');
        
        // 转换换行为 HTML
        processed = processed.replace(/\n/g, '<br>');
        
        // 处理代码块 (用反引号包围的内容)
        processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        return processed;
    }
    
    // 渲染函数列表
    function renderFunctionList(currentFunctions, inheritedFunctionGroups) {
        const functionList = document.getElementById('function-list');
        if (!functionList) return;
        
        let html = '';
        
        // 渲染当前文件函数
        if (currentFunctions.length > 0) {
            html += `
                <div class="function-group" data-group="current">
                    <div class="group-header" data-toggle="current">
                        <span>当前文件</span>
                        <span class="group-count">${currentFunctions.length}</span>
                    </div>
                    <div class="group-content" id="group-current">
                        ${currentFunctions.map(f => `
                            <div class="function-item" data-name="${f.name}" data-source="${f.source}" data-file="${f.filePath}" data-line="${f.line}" data-definition="${FunctionUtils.escapeHtml(f.definition || '')}" data-comment="${FunctionUtils.escapeHtml(f.comment || '')}" data-group="current">
                                <div>
                                    <div class="function-name">${f.name}</div>
                                    <div class="function-preview">${FunctionUtils.escapeHtml(f.briefDescription || '暂无描述')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // 渲染继承文件函数
        if (inheritedFunctionGroups.length > 0) {
            html += inheritedFunctionGroups.map(group => `
                <div class="function-group" data-group="${getGroupType(group.source)}">
                    <div class="group-header" data-toggle="${sanitizeId(group.source)}">
                        <span>${group.source}</span>
                        <span class="group-count">${group.functions.length}</span>
                    </div>
                    <div class="group-content" id="group-${sanitizeId(group.source)}">
                        ${group.functions.map(f => `
                            <div class="function-item" data-name="${f.name}" data-source="${f.source}" data-file="${f.filePath}" data-line="${f.line}" data-definition="${FunctionUtils.escapeHtml(f.definition || '')}" data-comment="${FunctionUtils.escapeHtml(f.comment || '')}" data-group="${getGroupType(group.source)}">
                                <div>
                                    <div class="function-name">${f.name}</div>
                                    <div class="function-preview">${FunctionUtils.escapeHtml(f.briefDescription || '暂无描述')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        }
        
        // 空状态
        if (currentFunctions.length === 0 && inheritedFunctionGroups.length === 0) {
            html = `
                <div class="empty-state">
                    <h3>未找到函数</h3>
                    <p>当前文件中没有找到函数定义。</p>
                </div>
            `;
        }
        
        functionList.innerHTML = html;
        
        // 重新收集函数项并绑定动态事件
        allFunctions = Array.from(document.querySelectorAll('.function-item'));
        bindDynamicEvents();
    }
    
    // 工具函数类 - 在JavaScript环境中的实现
    class FunctionUtils {
        static getReturnType(definition) {
            if (!definition) return '';
            const match = definition.match(/^\s*(\w+(?:\s*\*)?)/); 
            return match ? match[1] : '';
        }
        
        static getGroupType(source) {
            if (source.includes('包含文件')) return 'included';
            return 'inherited';
        }
        
        static sanitizeId(str) {
            return str.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
        }
        
        static escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }
    
    function getReturnType(definition) {
        return FunctionUtils.getReturnType(definition);
    }
    
    function getGroupType(source) {
        return FunctionUtils.getGroupType(source);
    }
    
    function sanitizeId(str) {
        return FunctionUtils.sanitizeId(str);
    }
    
    function escapeHtml(text) {
        return FunctionUtils.escapeHtml(text);
    }
    

    

    
    // 处理JavaDoc风格的注释，统一的注释处理逻辑
    // JavaDoc处理器类 - 在JavaScript环境中的实现
    class JavaDocProcessor {
        static processToHtml(comment) {
            if (!comment) return '';
            
            // 移除注释标记，保留原始行结构
            let processed = comment
                .replace(/^\/\*\*\s*/, '')  // 移除开头的 /**
                .replace(/\s*\*\/$/, '')    // 移除结尾的 */
                .replace(/^\s*\*\s?/gm, '') // 移除每行开头的 * 和空格
                .trim();
            
            let lines = processed.split('\n').map(line => line.trim());
            
            let html = '';
            let currentSection = '';
            let brief = '';
            let details = [];
            let paramStarted = false;
            let exampleContent = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.startsWith('@brief')) {
                    brief = line.replace('@brief', '').trim();
                    currentSection = '';
                } else if (line.startsWith('@details')) {
                    currentSection = 'details';
                    const detailText = line.replace('@details', '').trim();
                    if (detailText) {
                        details.push(detailText);
                    }
                } else if (line.startsWith('@param')) {
                    // 结束details收集
                    if (currentSection === 'details') {
                        currentSection = '';
                    }
                    // 开始参数部分
                    if (!paramStarted) {
                        html += '<h4>参数</h4><ul class="param-list">';
                        paramStarted = true;
                    }
                    const paramMatch = line.match(/@param\s+(\w+)\s+(\w+)\s+(.*)/);
                    if (paramMatch) {
                        const [, type, name, desc] = paramMatch;
                        html += `<li><strong>${FunctionUtils.escapeHtml(type)}</strong> <code>${FunctionUtils.escapeHtml(name)}</code>: ${FunctionUtils.escapeHtml(desc)}</li>`;
                    } else {
                        // 兼容旧格式 @param name description
                        const simpleMatch = line.match(/@param\s+(\S+)\s+(.*)/);
                        if (simpleMatch) {
                            html += `<li><code>${FunctionUtils.escapeHtml(simpleMatch[1])}</code>: ${FunctionUtils.escapeHtml(simpleMatch[2])}</li>`;
                        }
                    }
                } else if (line.startsWith('@return')) {
                    // 结束参数列表
                    if (paramStarted) {
                        html += '</ul>';
                        paramStarted = false;
                    }
                    currentSection = '';
                    html += '<h4>返回值</h4>';
                    const returnMatch = line.match(/@return\s+(\w+)\s+(.*)/);
                    if (returnMatch) {
                        const [, type, desc] = returnMatch;
                        html += `<p><strong>${FunctionUtils.escapeHtml(type)}</strong> ${FunctionUtils.escapeHtml(desc)}</p>`;
                    } else {
                        html += '<p>' + FunctionUtils.escapeHtml(line.replace('@return', '').trim()) + '</p>';
                    }
                } else if (line.startsWith('@example')) {
                    // 结束参数列表
                    if (paramStarted) {
                        html += '</ul>';
                        paramStarted = false;
                    }
                    currentSection = 'example';
                    html += '<h4>示例</h4><pre><code>';
                    const exampleText = line.replace('@example', '').trim();
                    if (exampleText) {
                        exampleContent.push(exampleText);
                    }
                } else if (currentSection === 'example') {
                    if (line.startsWith('@')) {
                        // 结束示例部分
                        html += exampleContent.join('\n') + '</code></pre>';
                        exampleContent = [];
                        currentSection = '';
                        // 重新处理这一行
                        i--;
                        continue;
                    } else {
                        exampleContent.push(line);
                    }
                } else if (currentSection === 'details') {
                    if (line.startsWith('@')) {
                        currentSection = '';
                        // 重新处理这一行
                        i--;
                        continue;
                    } else if (line.trim()) {
                        details.push(line);
                    }
                } else if (!line.startsWith('@') && line.trim()) {
                    // 普通描述文本
                    if (!currentSection && !brief && !details.length) {
                        html += '<p>' + FunctionUtils.escapeHtml(line) + '</p>';
                    }
                }
            }

            // 处理未结束的部分
            if (currentSection === 'example' && exampleContent.length > 0) {
                html += exampleContent.join('\n') + '</code></pre>';
            }
            if (paramStarted) {
                html += '</ul>';
            }

            // 构建最终结果
            let result = '';
            if (brief) {
                result += `<h4>简要描述</h4><p>${FunctionUtils.escapeHtml(brief)}</p>`;
            }
            if (details.length > 0) {
                result += `<h4>详细描述</h4><p>${FunctionUtils.escapeHtml(details.join(' '))}</p>`;
            }
            result += html;

            return result;
        }

        static escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    function processJavaDocComment(comment) {
        return JavaDocProcessor.processToHtml(comment);
    }
     
     // 跳转到定义
    function gotoDefinition(filePath, line) {
        vscode.postMessage({
            command: 'gotoDefinition',
            filePath: filePath,
            line: line
        });
    }
    
    // 处理来自扩展的消息
    window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.command === 'updateFunctionList') {
            renderFunctionList(message.currentFunctions, message.inheritedFunctionGroups);
        } else if (message.command === 'updateFunctionDoc') {
             showFunctionDoc(message.functionInfo);
         }
     });
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // 暴露全局函数供外部调用
    window.functionDocPanel = {
        renderFunctionList,
        init
    };
})();