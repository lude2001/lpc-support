"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EfunDocsManager = void 0;
const vscode = require("vscode");
const axios_1 = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
class EfunDocsManager {
    constructor(context) {
        this.efunDocs = new Map();
        this.efunCategories = new Map();
        this.simulatedEfunDocs = new Map();
        this.cacheFilePath = path.join(context.globalStoragePath, EfunDocsManager.CACHE_FILE_NAME);
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.statusBarItem.text = "$(sync) 更新 Efun 文档";
        this.statusBarItem.tooltip = "点击更新 LPC Efun 文档";
        this.statusBarItem.command = 'lpc.updateEfunDocs';
        context.subscriptions.push(this.statusBarItem);
        this.statusBarItem.show();
        // 加载缓存的文档
        this.loadCache();
        // 注册更新命令
        context.subscriptions.push(vscode.commands.registerCommand('lpc.updateEfunDocs', () => this.updateDocs()));
        // 注册悬停提供程序
        context.subscriptions.push(vscode.languages.registerHoverProvider('lpc', {
            provideHover: (document, position) => this.provideHover(document, position)
        }));
        // 注册模拟函数库配置命令
        context.subscriptions.push(vscode.commands.registerCommand('lpc.configureSimulatedEfuns', () => this.configureSimulatedEfuns()));
        // 加载模拟函数库文档
        this.loadSimulatedEfuns();
        // 启动时自动更新文档
        this.updateDocs();
    }
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
                this.efunDocs = new Map(Object.entries(cacheData.docs));
                this.efunCategories = new Map(Object.entries(cacheData.categories));
                console.log('已从缓存加载 Efun 文档');
            }
        }
        catch (error) {
            console.error('加载缓存文档失败:', error);
        }
    }
    saveCache() {
        try {
            const cacheDir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            const cacheData = {
                docs: Object.fromEntries(this.efunDocs),
                categories: Object.fromEntries(this.efunCategories)
            };
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
            console.log('已保存 Efun 文档到缓存');
        }
        catch (error) {
            console.error('保存缓存文档失败:', error);
        }
    }
    isCacheExpired(doc) {
        if (!doc.lastUpdated)
            return true;
        const now = Date.now();
        const expiryTime = doc.lastUpdated + (EfunDocsManager.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        return now > expiryTime;
    }
    async updateDocs() {
        try {
            this.statusBarItem.text = "$(sync~spin) 正在更新 Efun 文档...";
            // 获取 efun 列表页面
            const response = await axios_1.default.get(EfunDocsManager.EFUN_LIST_URL);
            const $ = cheerio.load(response.data);
            // 清空现有数据
            this.efunDocs.clear();
            this.efunCategories.clear();
            // 解析分类和函数列表
            const categories = $('h2');
            for (let i = 0; i < categories.length; i++) {
                const category = $(categories[i]);
                const categoryName = category.text().trim();
                if (categoryName.includes('相关函数')) {
                    const functions = category.next('p').text().split('、').map((f) => f.trim());
                    this.efunCategories.set(categoryName, functions);
                    // 为每个函数预设基本信息
                    for (const func of functions) {
                        this.efunDocs.set(func, {
                            name: func,
                            syntax: '',
                            description: '',
                            category: categoryName
                        });
                    }
                }
            }
            this.statusBarItem.text = "$(sync) 更新 Efun 文档";
            vscode.window.showInformationMessage('Efun 文档更新成功');
        }
        catch (error) {
            this.statusBarItem.text = "$(error) Efun 文档更新失败";
            vscode.window.showErrorMessage(`Efun 文档更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }
    async getEfunDoc(funcName) {
        // 检查缓存
        const cachedDoc = this.efunDocs.get(funcName);
        if (cachedDoc?.syntax && !this.isCacheExpired(cachedDoc)) {
            return cachedDoc;
        }
        try {
            // 获取函数文档页面
            const response = await axios_1.default.get(`${EfunDocsManager.EFUN_DOC_BASE_URL}${funcName}`);
            const $ = cheerio.load(response.data);
            const doc = {
                name: funcName,
                syntax: '',
                description: '',
                category: cachedDoc?.category,
                lastUpdated: Date.now() // 添加更新时间戳
            };
            // 解析文档内容
            $('h3').each((_, element) => {
                const section = $(element).text().trim();
                const content = $(element).next().text().trim();
                switch (section) {
                    case '语法':
                        doc.syntax = content;
                        break;
                    case '描述':
                        doc.description = content;
                        break;
                    case '返回值':
                        doc.returnValue = content;
                        break;
                    case '参考':
                        doc.reference = content.split(',').map((ref) => ref.trim());
                        break;
                }
            });
            // 更新文档缓存
            this.efunDocs.set(funcName, doc);
            this.saveCache(); // 保存到本地文件
            return doc;
        }
        catch (error) {
            // 如果请求失败但有缓存，返回缓存的文档
            if (cachedDoc) {
                return cachedDoc;
            }
            return undefined;
        }
    }
    async configureSimulatedEfuns() {
        const options = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择模拟函数库目录'
        };
        const folders = await vscode.window.showOpenDialog(options);
        if (folders && folders[0]) {
            await vscode.workspace.getConfiguration().update(EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG, folders[0].fsPath, vscode.ConfigurationTarget.Global);
            await this.loadSimulatedEfuns();
            vscode.window.showInformationMessage('模拟函数库目录已更新');
        }
    }
    async loadSimulatedEfuns() {
        const config = vscode.workspace.getConfiguration();
        const simulatedEfunsPath = config.get(EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG);
        if (!simulatedEfunsPath) {
            return;
        }
        try {
            const files = await vscode.workspace.findFiles(new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}'));
            this.simulatedEfunDocs.clear();
            for (const file of files) {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                // 解析文件中的函数文档
                const functionDocs = this.parseSimulatedEfunDocs(text);
                for (const [funcName, doc] of functionDocs) {
                    this.simulatedEfunDocs.set(funcName, doc);
                }
            }
        }
        catch (error) {
            console.error('加载模拟函数库文档失败:', error);
        }
    }
    parseSimulatedEfunDocs(content) {
        const docs = new Map();
        const functionPattern = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(?:private\s+|public\s+|protected\s+|static\s+|nomask\s+)*((?:varargs\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\**\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\))/g;
        const paramPattern = /@param\s+(\S+)\s+(\S+)\s+([^\n]+)/g;
        const returnPattern = /@return\s+(\S+)\s+(.*)/;
        const briefPattern = /@brief\s+([^\n]+)/;
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            const [_, docComment, funcDecl] = match;
            const funcName = funcDecl.match(/(?:varargs\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\**\s*([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1];
            if (funcName) {
                const doc = {
                    name: funcName,
                    syntax: funcDecl.trim(),
                    description: '',
                    category: '模拟函数库',
                    isSimulated: true
                };
                // 解析 @brief
                const briefMatch = docComment.match(briefPattern);
                if (briefMatch) {
                    doc.description = briefMatch[1].trim();
                }
                // 解析参数
                const params = [];
                let paramMatch;
                const paramText = docComment.replace(/\r\n/g, '\n'); // 统一换行符
                while ((paramMatch = paramPattern.exec(paramText)) !== null) {
                    const [_, type, name, desc] = paramMatch;
                    // 处理可能跨行的描述
                    let fullDesc = desc.trim();
                    // 如果描述在下一行继续，查找到下一个@标记或结束
                    const nextIndex = paramText.indexOf('@', paramMatch.index + paramMatch[0].length);
                    if (nextIndex !== -1) {
                        const extraDesc = paramText
                            .slice(paramMatch.index + paramMatch[0].length, nextIndex)
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line && !line.startsWith('*'))
                            .join(' ');
                        if (extraDesc) {
                            fullDesc += ' ' + extraDesc;
                        }
                    }
                    params.push(`${type} ${name}: ${fullDesc}`);
                }
                if (params.length > 0) {
                    doc.description += '\n\n参数:\n' + params.join('\n');
                }
                // 解析返回值
                const returnMatch = docComment.match(returnPattern);
                if (returnMatch?.index !== undefined) {
                    const [_, type, desc] = returnMatch;
                    // 处理可能跨行的返回值描述
                    let fullDesc = desc.trim();
                    const nextIndex = docComment.indexOf('@', returnMatch.index + returnMatch[0].length);
                    if (nextIndex !== -1) {
                        const extraDesc = docComment
                            .slice(returnMatch.index + returnMatch[0].length, nextIndex)
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line && !line.startsWith('*'))
                            .join(' ');
                        if (extraDesc) {
                            fullDesc += ' ' + extraDesc;
                        }
                    }
                    doc.returnValue = `${type}: ${fullDesc}`;
                }
                docs.set(funcName, doc);
            }
        }
        return docs;
    }
    async provideHover(document, position) {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange);
        // 先查找模拟函数库文档
        const simulatedDoc = this.simulatedEfunDocs.get(word);
        if (simulatedDoc) {
            return this.createHoverContent(simulatedDoc);
        }
        // 再查找标准efun文档
        const doc = await this.getEfunDoc(word);
        if (!doc) {
            return undefined;
        }
        return this.createHoverContent(doc);
    }
    createHoverContent(doc) {
        const content = new vscode.MarkdownString();
        content.appendMarkdown(`# ${doc.name}\n\n`);
        if (doc.category) {
            content.appendMarkdown(`**分类**: ${doc.category}\n\n`);
        }
        if (doc.syntax) {
            content.appendMarkdown(`**语法**:\n\`\`\`lpc\n${doc.syntax}\n\`\`\`\n\n`);
        }
        if (doc.description) {
            content.appendMarkdown(`**描述**:\n${doc.description}\n\n`);
        }
        if (doc.returnValue) {
            content.appendMarkdown(`**返回值**:\n${doc.returnValue}\n\n`);
        }
        if (doc.reference && doc.reference.length > 0) {
            content.appendMarkdown(`**参考**:\n${doc.reference.join(', ')}\n`);
        }
        return new vscode.Hover(content);
    }
    getCategories() {
        return this.efunCategories;
    }
    getAllFunctions() {
        return Array.from(this.efunDocs.keys());
    }
    getAllSimulatedFunctions() {
        return Array.from(this.simulatedEfunDocs.keys());
    }
    getSimulatedDoc(funcName) {
        return this.simulatedEfunDocs.get(funcName);
    }
}
exports.EfunDocsManager = EfunDocsManager;
EfunDocsManager.EFUN_LIST_URL = 'https://mud.wiki/Lpc:Efun';
EfunDocsManager.EFUN_DOC_BASE_URL = 'https://mud.wiki/';
EfunDocsManager.CACHE_FILE_NAME = 'efun_docs_cache.json';
EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG = 'lpc.simulatedEfunsPath';
EfunDocsManager.CACHE_EXPIRY_DAYS = 7; // 缓存过期时间（天）
//# sourceMappingURL=efunDocs.js.map