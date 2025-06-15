"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionDocPanel = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const parseCache_1 = require("./parseCache");
const LPCParser_1 = require("./antlr/LPCParser");
/**
 * 函数文档面板类
 * 用于显示当前文件及其继承的函数列表和文档
 */
class FunctionDocPanel {
    /**
     * 创建或显示函数文档面板
     */
    static createOrShow(context, macroManager) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('.c')) {
            vscode.window.showInformationMessage('请先打开一个 LPC 文件');
            return;
        }
        // 如果已经有面板，则显示它
        if (FunctionDocPanel.currentPanel) {
            FunctionDocPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
            FunctionDocPanel.currentPanel.update(activeEditor.document);
            return;
        }
        // 否则，创建一个新面板，并将其放置在编辑器旁边
        const panel = vscode.window.createWebviewPanel('lpcFunctionDoc', 'LPC 函数文档', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(context.extensionPath, 'media'))
            ]
        });
        FunctionDocPanel.currentPanel = new FunctionDocPanel(panel, macroManager);
        FunctionDocPanel.currentPanel.update(activeEditor.document);
    }
    /**
     * 构造函数
     */
    constructor(panel, macroManager) {
        this.disposables = [];
        this.filePathCache = new Map();
        this.functionCache = new Map();
        this.currentFunctions = [];
        this.inheritedFunctions = new Map();
        this.processedFiles = new Set();
        this.panel = panel;
        this.macroManager = macroManager;
        // 当面板关闭时清理资源
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // 处理来自 WebView 的消息
        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'showFunctionDoc':
                    this.showFunctionDoc(message.functionName, message.source);
                    return;
                case 'gotoDefinition':
                    this.gotoDefinition(message.filePath, message.line);
                    return;
            }
        }, null, this.disposables);
        // 当编辑器切换时更新面板
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.fileName.endsWith('.c')) {
                this.update(editor.document);
            }
        }, null, this.disposables);
        // 当文档保存时更新面板
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.fileName.endsWith('.c') &&
                this.currentDocument &&
                document.uri.toString() === this.currentDocument.uri.toString()) {
                this.update(document);
            }
        }, null, this.disposables);
    }
    /**
     * 更新面板内容
     */
    async update(document) {
        this.currentDocument = document;
        this.panel.title = `函数文档: ${path.basename(document.fileName)}`;
        // 清除缓存
        this.currentFunctions = [];
        this.inheritedFunctions.clear();
        this.processedFiles.clear();
        // 解析当前文件的函数
        await this.parseFunctionsInFile(document, '当前文件', document.uri.fsPath);
        // 解析继承的函数
        await this.parseInheritedFunctions(document);
        // 更新 WebView 内容
        this.panel.webview.html = this.getWebviewContent();
    }
    /**
     * 解析文件中的函数
     */
    async parseFunctionsInFile(document, source, filePath) {
        const text = document.getText();
        const lines = text.split('\n');
        const functions = [];
        const { tree, tokens } = (0, parseCache_1.getParsed)(document);
        const visit = (ctx) => {
            if (ctx instanceof LPCParser_1.FunctionDefContext) {
                const nameToken = ctx.Identifier().symbol;
                const name = nameToken.text ?? '';
                // 返回类型文本
                const retTypeCtx = ctx.typeSpec();
                const retType = retTypeCtx ? document.getText(new vscode.Range(document.positionAt(retTypeCtx.start.startIndex), document.positionAt(retTypeCtx.stop?.stopIndex ?? retTypeCtx.start.stopIndex + 1))) : 'void';
                // 参数列表文本
                const paramCtx = ctx.parameterList();
                const paramText = paramCtx ? document.getText(new vscode.Range(document.positionAt(paramCtx.start.startIndex), document.positionAt(paramCtx.stop?.stopIndex ?? paramCtx.start.stopIndex + 1))) : '()';
                const definition = `${retType} ${name}${paramText}`;
                // 行号
                const line = document.positionAt(ctx.start.startIndex).line;
                // 提取紧前注释（简单向上查找最多三行）
                let comment = '';
                for (let l = line - 1; l >= 0 && line - l <= 3; l--) {
                    const lineText = lines[l].trim();
                    if (lineText.startsWith('/*') || lineText.startsWith('*') || lineText.startsWith('//')) {
                        comment = lineText + '\n' + comment;
                    }
                    else if (lineText === '') {
                        continue;
                    }
                    else {
                        break;
                    }
                }
                functions.push({
                    name,
                    definition,
                    comment,
                    source,
                    filePath,
                    line
                });
            }
            for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                const child = ctx.getChild(i);
                if (child && typeof child === 'object' && child.symbol === undefined) {
                    visit(child);
                }
            }
        };
        visit(tree);
        // 如果是当前文件，保存到当前函数列表
        if (source === '当前文件') {
            this.currentFunctions = functions;
        }
        else {
            this.inheritedFunctions.set(source, functions);
        }
        return functions;
    }
    /**
     * 解析继承的函数
     */
    async parseInheritedFunctions(document) {
        const text = document.getText();
        // —— AST 方式收集 inherit ——
        const { tree } = (0, parseCache_1.getParsed)(document);
        const inherits = [];
        const collect = (ctx) => {
            if (ctx instanceof (require('./antlr/LPCParser').InheritStatementContext)) {
                const inheritText = document.getText(new vscode.Range(document.positionAt(ctx.start.startIndex), document.positionAt(ctx.stop.stopIndex + 1)));
                // 提取路径或宏
                let m = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))/i.exec(inheritText);
                if (m) {
                    let inheritedFile = (m[1] || m[2]).trim();
                    let macroSource = '';
                    // 宏解析（无扩展名）
                    if (/^[A-Z_][A-Z0-9_]*$/.test(inheritedFile)) {
                        const macro = this.macroManager.getMacro(inheritedFile);
                        if (macro) {
                            inheritedFile = macro.value.replace(/^"(.*)"$/, '$1');
                            let macroPath = path.basename(macro.file);
                            const includePath = this.macroManager.getIncludePath();
                            if (includePath) {
                                macroPath = path.relative(includePath, macro.file);
                            }
                            macroSource = `(通过宏 ${macro.name} 从 ${macroPath})`;
                        }
                        else {
                            return;
                        }
                    }
                    if (!inheritedFile.endsWith('.c')) {
                        inheritedFile += '.c';
                    }
                    inherits.push({ file: inheritedFile, source: macroSource });
                }
            }
            for (let i = 0; i < (ctx.childCount ?? 0); i++) {
                const child = ctx.getChild(i);
                if (child && typeof child === 'object' && child.symbol === undefined) {
                    collect(child);
                }
            }
        };
        collect(tree);
        // 预处理include -> 扫描宏
        await this.macroManager.scanMacros();
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return;
        const inheritTasks = [];
        const allInheritedFiles = inherits;
        // 并行处理所有继承文件
        if (allInheritedFiles.length > 0) {
            // 创建所有继承文件的处理任务
            for (const { file, source } of allInheritedFiles) {
                inheritTasks.push(this.processInheritedFile(file, source, document, workspaceFolder));
            }
            // 等待所有任务完成
            await Promise.all(inheritTasks);
        }
    }
    /**
     * 处理单个继承文件
     */
    async processInheritedFile(inheritedFile, macroSource, document, workspaceFolder) {
        // 检查文件路径缓存
        const cacheKey = `${document.uri.fsPath}:${inheritedFile}`;
        let resolvedPath = this.filePathCache.get(cacheKey);
        let fileFound = false;
        if (resolvedPath) {
            // 使用缓存的路径
            if (fs.existsSync(resolvedPath) && !this.processedFiles.has(resolvedPath)) {
                fileFound = true;
            }
        }
        else {
            // 构建可能的文件路径
            const possiblePaths = [];
            if (inheritedFile.startsWith('/')) {
                // 绝对路径：移除开头的/，然后从工作区根目录开始查找
                const relativePath = inheritedFile.slice(1);
                possiblePaths.push(path.join(workspaceFolder.uri.fsPath, relativePath), path.join(workspaceFolder.uri.fsPath, relativePath.replace('.c', '')));
            }
            else {
                // 相对路径：先相对于当前文件查找，再从工作区根目录查找
                possiblePaths.push(path.join(path.dirname(document.uri.fsPath), inheritedFile), path.join(path.dirname(document.uri.fsPath), inheritedFile.replace('.c', '')), path.join(workspaceFolder.uri.fsPath, inheritedFile), path.join(workspaceFolder.uri.fsPath, inheritedFile.replace('.c', '')));
            }
            // 去重路径
            const uniquePaths = [...new Set(possiblePaths)];
            for (const filePath of uniquePaths) {
                if (fs.existsSync(filePath) && !this.processedFiles.has(filePath)) {
                    resolvedPath = filePath;
                    // 缓存解析结果
                    this.filePathCache.set(cacheKey, filePath);
                    fileFound = true;
                    break;
                }
            }
        }
        // 同步检查是否有其他线程已经处理过这个文件
        if (this.processedFiles.has(resolvedPath || '')) {
            return;
        }
        if (fileFound && resolvedPath) {
            // 标记为已处理
            this.processedFiles.add(resolvedPath);
            try {
                const inheritedDoc = await vscode.workspace.openTextDocument(resolvedPath);
                const sourceName = `继承自 ${path.basename(resolvedPath)}${macroSource}`;
                // 解析函数
                await this.parseFunctionsInFile(inheritedDoc, sourceName, resolvedPath);
                // 递归处理继承的文件
                await this.parseInheritedFunctions(inheritedDoc);
            }
            catch (error) {
                console.error(`Error reading inherited file: ${resolvedPath}`, error);
            }
        }
    }
    /**
     * 显示函数文档
     */
    showFunctionDoc(functionName, source) {
        let functionInfo;
        if (source === '当前文件') {
            functionInfo = this.currentFunctions.find(f => f.name === functionName);
        }
        else {
            const functions = this.inheritedFunctions.get(source);
            if (functions) {
                functionInfo = functions.find(f => f.name === functionName);
            }
        }
        if (functionInfo) {
            // 发送函数文档到 WebView
            this.panel.webview.postMessage({
                command: 'updateFunctionDoc',
                functionInfo: functionInfo
            });
        }
    }
    /**
     * 获取 WebView 内容
     */
    getWebviewContent() {
        // 准备函数列表数据
        const currentFunctions = this.currentFunctions.map(f => ({
            name: f.name,
            source: f.source,
            filePath: f.filePath,
            line: f.line
        }));
        const inheritedFunctionGroups = [];
        this.inheritedFunctions.forEach((functions, source) => {
            inheritedFunctionGroups.push({
                source: source,
                functions: functions.map(f => ({
                    name: f.name,
                    source: f.source,
                    filePath: f.filePath,
                    line: f.line
                }))
            });
        });
        return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LPC 函数文档</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe WPC', 'Segoe UI', system-ui, 'Ubuntu', 'Droid Sans', sans-serif;
                    padding: 0;
                    margin: 0;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .container {
                    display: flex;
                    height: 100vh;
                    overflow: hidden;
                }
                .function-list {
                    width: 300px;
                    overflow-y: auto;
                    border-right: 1px solid var(--vscode-panel-border);
                    padding: 10px;
                }
                .function-doc {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                h2 {
                    margin-top: 0;
                    padding-bottom: 5px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    color: var(--vscode-editor-foreground);
                }
                .function-group {
                    margin-bottom: 20px;
                }
                .function-item {
                    padding: 5px 10px;
                    cursor: pointer;
                    border-radius: 3px;
                }
                .function-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                .function-item.active {
                    background-color: var(--vscode-list-activeSelectionBackground);
                    color: var(--vscode-list-activeSelectionForeground);
                }
                pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 10px;
                    border-radius: 3px;
                    overflow-x: auto;
                }
                code {
                    font-family: Menlo, Monaco, Consolas, "Andale Mono", "Ubuntu Mono", "Courier New", monospace;
                }
                .doc-section {
                    margin-bottom: 20px;
                }
                .doc-section h3 {
                    margin-top: 0;
                    color: var(--vscode-editor-foreground);
                }
                .param-list {
                    list-style-type: none;
                    padding-left: 0;
                }
                .param-list li {
                    margin-bottom: 5px;
                }
                .param-name {
                    font-weight: bold;
                    color: var(--vscode-symbolIcon-variableForeground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="function-list">
                    <input type="text" id="search" placeholder="搜索函数..." style="width:100%;margin-bottom:6px;" />
                    <h2>当前文件</h2>
                    <div class="function-group">
                        ${currentFunctions.map(f => `
                            <div class="function-item" data-name="${f.name}" data-source="${f.source}" data-file="${f.filePath}" data-line="${f.line}">
                                ${f.name}
                            </div>
                        `).join('')}
                    </div>
                    
                    ${inheritedFunctionGroups.map(group => `
                        <h2>${group.source}</h2>
                        <div class="function-group">
                            ${group.functions.map(f => `
                                <div class="function-item" data-name="${f.name}" data-source="${f.source}" data-file="${f.filePath}" data-line="${f.line}">
                                    ${f.name}
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                <div class="function-doc">
                    <div id="doc-content">
                        <h2>选择一个函数查看文档</h2>
                        <p>在左侧列表中点击函数名称查看详细文档。</p>
                    </div>
                </div>
            </div>
            
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    let currentActive = null;
                    
                    // 处理函数点击事件
                    document.querySelectorAll('.function-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const functionName = item.getAttribute('data-name');
                            const source = item.getAttribute('data-source');
                            
                            // 更新选中状态
                            if (currentActive) {
                                currentActive.classList.remove('active');
                            }
                            item.classList.add('active');
                            currentActive = item;
                            
                            // 发送消息到扩展
                            vscode.postMessage({
                                command: 'showFunctionDoc',
                                functionName: functionName,
                                source: source
                            });
                        });
                    });
                    
                    // 处理来自扩展的消息
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        if (message.command === 'updateFunctionDoc') {
                            const functionInfo = message.functionInfo;
                            updateFunctionDoc(functionInfo);
                        }
                    });
                    
                    // 更新函数文档
                    function updateFunctionDoc(functionInfo) {
                        const docContent = document.getElementById('doc-content');
                        
                        // 处理注释文档
                        let commentHtml = '';
                        if (functionInfo.comment) {
                            commentHtml = processJavaDocComment(functionInfo.comment);
                        }
                        
                        docContent.innerHTML = \`
                            <h2>\${functionInfo.name}</h2>
                            <div class="doc-section">
                                <h3>定义</h3>
                                <pre><code>\${escapeHtml(functionInfo.definition)}</code></pre>
                                <button id="goto-def">跳转到定义</button>
                            </div>
                            <div class="doc-section">
                                <h3>来源</h3>
                                <p>\${functionInfo.source}</p>
                            </div>
                            \${commentHtml ? \`
                                <div class="doc-section">
                                    <h3>文档</h3>
                                    \${commentHtml}
                                </div>
                            \` : ''}
                        \`;
                    }
                    
                    // 处理 JavaDoc 风格的注释
                    function processJavaDocComment(comment) {
                        // 移除注释标记和多余的空格
                        let lines = comment
                            .replace(/\\/\\*\\*|\\*\\/|\\*/g, '')
                            .split('\\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0);

                        let html = '';
                        let currentSection = '';
                        let description = [];
                        let params = [];
                        let returnValue = '';
                        let example = [];

                        for (const line of lines) {
                            if (line.startsWith('@param')) {
                                const paramMatch = line.match(/@param\\s+(\\S+)\\s+(.*)/);
                                if (paramMatch) {
                                    params.push({
                                        name: paramMatch[1],
                                        description: paramMatch[2]
                                    });
                                }
                            } else if (line.startsWith('@return')) {
                                returnValue = line.replace('@return', '').trim();
                            } else if (line.startsWith('@example')) {
                                currentSection = 'example';
                            } else if (currentSection === 'example') {
                                if (line.startsWith('@')) {
                                    currentSection = '';
                                } else {
                                    example.push(line);
                                }
                            } else if (!line.startsWith('@')) {
                                description.push(line);
                            }
                        }

                        // 构建 HTML
                        if (description.length > 0) {
                            html += \`<p>\${description.join(' ')}</p>\`;
                        }

                        if (params.length > 0) {
                            html += \`
                                <h4>参数</h4>
                                <ul class="param-list">
                                    \${params.map(param => \`
                                        <li><span class="param-name">\${param.name}</span>: \${param.description}</li>
                                    \`).join('')}
                                </ul>
                            \`;
                        }

                        if (returnValue) {
                            html += \`
                                <h4>返回值</h4>
                                <p>\${returnValue}</p>
                            \`;
                        }

                        if (example.length > 0) {
                            html += \`
                                <h4>示例</h4>
                                <pre><code>\${escapeHtml(example.join('\\n'))}</code></pre>
                            \`;
                        }

                        return html;
                    }
                    
                    // HTML 转义
                    function escapeHtml(text) {
                        return text
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")
                            .replace(/'/g, "&#039;");
                    }

                    // 搜索过滤
                    const searchInput = document.getElementById('search');
                    searchInput.addEventListener('input', () => {
                        const query = searchInput.value.toLowerCase();
                        document.querySelectorAll('.function-item').forEach(item => {
                            const name = item.getAttribute('data-name').toLowerCase();
                            item.style.display = name.includes(query) ? 'block' : 'none';
                        });
                    });

                    // 跳转按钮事件
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'updateFunctionDoc') {
                            setTimeout(() => {
                                const btn = document.getElementById('goto-def');
                                if (btn) {
                                    btn.addEventListener('click', () => {
                                        vscode.postMessage({
                                            command: 'gotoDefinition',
                                            filePath: message.functionInfo.filePath,
                                            line: message.functionInfo.line
                                        });
                                    });
                                }
                            }, 50);
                        }
                    });
                })();
            </script>
        </body>
        </html>
        `;
    }
    /**
     * 处理 JavaDoc 风格的注释
     */
    processJavaDocComment(comment) {
        // 移除注释标记和多余的空格
        let lines = comment
            .replace(/\/\*\*|\*\/|\*/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        let markdown = '';
        let currentSection = '';
        for (const line of lines) {
            if (line.startsWith('@param')) {
                if (!markdown.includes('### 参数')) {
                    markdown += '\n### 参数\n';
                }
                const paramMatch = line.match(/@param\s+(\S+)\s+(.*)/);
                if (paramMatch) {
                    markdown += `- \`${paramMatch[1]}\`: ${paramMatch[2]}\n`;
                }
            }
            else if (line.startsWith('@return')) {
                markdown += '\n### 返回值\n';
                markdown += line.replace('@return', '').trim() + '\n';
            }
            else if (line.startsWith('@example')) {
                markdown += '\n### 示例\n```lpc\n';
                currentSection = 'example';
            }
            else if (currentSection === 'example') {
                if (line.startsWith('@')) {
                    markdown += '```\n';
                    currentSection = '';
                }
                else {
                    markdown += line + '\n';
                }
            }
            else if (!line.startsWith('@')) {
                if (!currentSection) {
                    markdown += line + '\n';
                }
            }
        }
        if (currentSection === 'example') {
            markdown += '```\n';
        }
        return markdown;
    }
    gotoDefinition(filePath, line) {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc, { preview: false }).then(editor => {
                const pos = new vscode.Position(line, 0);
                editor.selection = new vscode.Selection(pos, pos);
                editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            });
        });
    }
    /**
     * 释放资源
     */
    dispose() {
        FunctionDocPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
exports.FunctionDocPanel = FunctionDocPanel;
//# sourceMappingURL=functionDocPanel.js.map