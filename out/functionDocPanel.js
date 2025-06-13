"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunctionDocPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
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
        // 匹配函数定义，支持各种修饰符和返回类型
        const functionRegex = /(?:(?:private|public|protected|static|nomask|varargs)\s+)*(?:void|int|string|object|mapping|mixed|float|buffer)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
        let match;
        while ((match = functionRegex.exec(text)) !== null) {
            const functionName = match[1];
            const functionDefinition = match[0];
            // 获取函数前的注释
            let comment = '';
            let lineIndex = lines.findIndex(line => line.includes(functionDefinition));
            if (lineIndex > 0) {
                // 向上查找注释
                let commentLines = [];
                let i = lineIndex - 1;
                while (i >= 0 && (lines[i].trim().startsWith('*') || lines[i].trim().startsWith('/*'))) {
                    commentLines.unshift(lines[i]);
                    i--;
                }
                if (commentLines.length > 0) {
                    comment = commentLines.join('\n');
                }
            }
            functions.push({
                name: functionName,
                definition: functionDefinition,
                comment: comment,
                source: source,
                filePath: filePath
            });
        }
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
        // 支持两种继承语法：字符串形式和宏定义形式
        const inheritRegexes = [
            /inherit\s+"([^"]+)"/g,
            /inherit\s+([A-Z_][A-Z0-9_]*)\s*;/g
        ];
        // 先处理include文件以解析宏
        const includeRegex = /#include\s+["<]([^">]+)[">]/g;
        let includeMatch;
        const processedIncludes = new Set();
        // 批量处理所有include
        const includeMatches = [];
        while ((includeMatch = includeRegex.exec(text)) !== null) {
            const includePath = includeMatch[1];
            if (!processedIncludes.has(includePath)) {
                processedIncludes.add(includePath);
                includeMatches.push(includePath);
            }
        }
        // 批量处理所有宏定义
        if (includeMatches.length > 0) {
            await this.macroManager.scanMacros();
        }
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return;
        // 收集所有继承条目，准备并行处理
        const inheritTasks = [];
        const allInheritedFiles = [];
        // 从两种regex中收集所有inherit语句
        for (const inheritRegex of inheritRegexes) {
            let match;
            while ((match = inheritRegex.exec(text)) !== null) {
                let inheritedFile = match[1];
                let macroSource = '';
                // 如果是宏定义形式，尝试解析宏
                if (inheritedFile.match(/^[A-Z_][A-Z0-9_]*$/)) {
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
                        continue; // 如果找不到宏定义，跳过这个继承
                    }
                }
                // 处理文件路径
                if (!inheritedFile.endsWith('.c')) {
                    inheritedFile = inheritedFile + '.c';
                }
                allInheritedFiles.push({ file: inheritedFile, source: macroSource });
            }
        }
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
            source: f.source
        }));
        const inheritedFunctionGroups = [];
        this.inheritedFunctions.forEach((functions, source) => {
            inheritedFunctionGroups.push({
                source: source,
                functions: functions.map(f => ({
                    name: f.name,
                    source: f.source
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
                    <h2>当前文件</h2>
                    <div class="function-group">
                        ${currentFunctions.map(f => `
                            <div class="function-item" data-name="${f.name}" data-source="${f.source}">
                                ${f.name}
                            </div>
                        `).join('')}
                    </div>
                    
                    ${inheritedFunctionGroups.map(group => `
                        <h2>${group.source}</h2>
                        <div class="function-group">
                            ${group.functions.map(f => `
                                <div class="function-item" data-name="${f.name}" data-source="${f.source}">
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