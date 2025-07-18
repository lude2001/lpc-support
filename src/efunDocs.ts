import * as vscode from 'vscode';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

export interface EfunDoc {
    name: string;
    syntax: string;
    description: string;
    returnValue?: string;
    example?: string;
    details?: string;
    reference?: string[];
    category?: string;
    lastUpdated?: number;  // 添加最后更新时间戳
    isSimulated?: boolean;
}

export class EfunDocsManager {
    private static EFUN_LIST_URL = 'https://mud.wiki/Lpc:Efun';
    private static EFUN_DOC_BASE_URL = 'https://mud.wiki/';
    private static CACHE_FILE_NAME = 'efun_docs_cache.json';
    private static SIMULATED_EFUNS_PATH_CONFIG = 'lpc.simulatedEfunsPath';
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();
    private simulatedEfunDocs: Map<string, EfunDoc> = new Map();
    // 存储当前文件的函数文档
    private currentFileDocs: Map<string, EfunDoc> = new Map();
    // 存储继承文件的函数文档，键为文件路径，值为该文件的函数文档 Map
    private inheritedFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    // 存储当前文件路径
    private currentFilePath: string = '';
    // 当前文件的继承文件路径列表
    private inheritedFiles: string[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private cacheFilePath: string;
    private static CACHE_EXPIRY_DAYS = 7; // 缓存过期时间（天）

    constructor(context: vscode.ExtensionContext) {
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
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.updateEfunDocs', () => this.updateDocs())
        );

        // 注册悬停提供程序
        context.subscriptions.push(
            vscode.languages.registerHoverProvider('lpc', {
                provideHover: (document, position) => this.provideHover(document, position)
            })
        );

        // 注册模拟函数库配置命令
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.configureSimulatedEfuns', () => this.configureSimulatedEfuns())
        );

        // 加载模拟函数库文档
        this.loadSimulatedEfuns();

        // 启动时自动更新文档
        this.updateDocs();
        
        // 添加文件变更事件监听
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.languageId === 'lpc' || e.document.fileName.endsWith('.c')) {
                    this.updateCurrentFileDocs(e.document);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && (editor.document.languageId === 'lpc' || editor.document.fileName.endsWith('.c'))) {
                    this.updateCurrentFileDocs(editor.document);
                }
            })
        );

        // 如果已经有活动编辑器，则立即更新当前文件的文档
        if (vscode.window.activeTextEditor && 
            (vscode.window.activeTextEditor.document.languageId === 'lpc' || 
             vscode.window.activeTextEditor.document.fileName.endsWith('.c'))) {
            this.updateCurrentFileDocs(vscode.window.activeTextEditor.document);
        }
    }

    private loadCache(): void {
        try {
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
                this.efunDocs = new Map(Object.entries(cacheData.docs));
                this.efunCategories = new Map(Object.entries(cacheData.categories));
                console.log('已从缓存加载 Efun 文档');
            }
        } catch (error) {
            console.error('加载缓存文档失败:', error);
        }
    }

    private saveCache(): void {
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
        } catch (error) {
            console.error('保存缓存文档失败:', error);
        }
    }

    private isCacheExpired(doc: EfunDoc): boolean {
        if (!doc.lastUpdated) return true;
        const now = Date.now();
        const expiryTime = doc.lastUpdated + (EfunDocsManager.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        return now > expiryTime;
    }

    private async updateDocs(): Promise<void> {
        try {
            this.statusBarItem.text = "$(sync~spin) 正在更新 Efun 文档...";
            
            // 获取 efun 列表页面
            const response = await axios.get(EfunDocsManager.EFUN_LIST_URL);
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
                    const functions = category.next('p').text().split('、').map((f: string) => f.trim());
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
        } catch (error) {
            this.statusBarItem.text = "$(error) Efun 文档更新失败";
            vscode.window.showErrorMessage(`Efun 文档更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    public async getEfunDoc(funcName: string): Promise<EfunDoc | undefined> {
        // 检查缓存
        const cachedDoc = this.efunDocs.get(funcName);
        if (cachedDoc?.syntax && !this.isCacheExpired(cachedDoc)) {
            return cachedDoc;
        }

        try {
            // 获取函数文档页面
            const response = await axios.get(`${EfunDocsManager.EFUN_DOC_BASE_URL}${funcName}`);
            const $ = cheerio.load(response.data);

            const doc: EfunDoc = {
                name: funcName,
                syntax: '',
                description: '',
                category: cachedDoc?.category,
                lastUpdated: Date.now()  // 添加更新时间戳
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
                        doc.reference = content.split(',').map((ref: string) => ref.trim());
                        break;
                }
            });

            // 更新文档缓存
            this.efunDocs.set(funcName, doc);
            this.saveCache();  // 保存到本地文件
            return doc;
        } catch (error) {
            // 如果请求失败但有缓存，返回缓存的文档
            if (cachedDoc) {
                return cachedDoc;
            }
            return undefined;
        }
    }

    private async configureSimulatedEfuns(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择模拟函数库目录'
        };

        const folders = await vscode.window.showOpenDialog(options);
        if (folders && folders[0]) {
            await vscode.workspace.getConfiguration().update(
                EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG,
                folders[0].fsPath,
                vscode.ConfigurationTarget.Global
            );
            await this.loadSimulatedEfuns();
            vscode.window.showInformationMessage('模拟函数库目录已更新');
        }
    }

    private async loadSimulatedEfuns(): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        const simulatedEfunsPath = config.get<string>(EfunDocsManager.SIMULATED_EFUNS_PATH_CONFIG);
        
        if (!simulatedEfunsPath) {
            return;
        }

        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}')
            );

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
        } catch (error) {
            console.error('加载模拟函数库文档失败:', error);
        }
    }

    private parseSimulatedEfunDocs(content: string): Map<string, EfunDoc> {
        const docs = new Map<string, EfunDoc>();
        const functionPattern = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(?:private\s+|public\s+|protected\s+|static\s+|nomask\s+)*((?:varargs\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\**\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\))/g;
        const paramPattern = /@param\s+(\S+)\s+(\S+)\s+([^\n]+)/g;
        const returnPattern = /@return\s+(\S+)\s+(.*)/;
        const briefPattern = /@brief\s+([^\n]+)/;
        const detailsPattern = /@details\s+([^\n]+)/;

        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            const [_, docComment, funcDecl] = match;
            const funcName = funcDecl.match(/(?:varargs\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\**\s*([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1];
            
            if (funcName) {
                const doc: EfunDoc = {
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

                // 解析 @details
                const detailsMatch = docComment.match(detailsPattern);
                if (detailsMatch) {
                    doc.details = detailsMatch[1].trim();
                }

                // 解析参数
                const params: string[] = [];
                let paramMatch;
                const paramText = docComment.replace(/\r\n/g, '\n');  // 统一换行符
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

    /**
     * 更新当前文件的函数文档
     * @param document 当前活动的文档
     */
    private async updateCurrentFileDocs(document: vscode.TextDocument): Promise<void> {
        // 如果不是 LPC 文件，则不处理
        if (document.languageId !== 'lpc' && !document.fileName.endsWith('.c')) {
            return;
        }

        this.currentFilePath = document.uri.fsPath;
        this.currentFileDocs.clear();
        this.inheritedFileDocs.clear();
        this.inheritedFiles = [];

        // 解析当前文件的函数文档
        const content = document.getText();
        this.currentFileDocs = this.parseFunctionDocs(content, '当前文件');

        // 解析并加载继承文件
        this.inheritedFiles = this.parseInheritStatements(content);
        await this.loadInheritedFileDocs();
    }

    /**
     * 解析文件内容中的函数文档
     * @param content 文件内容
     * @param category 文档分类
     * @returns 函数文档 Map
     */
    private parseFunctionDocs(content: string, category: string): Map<string, EfunDoc> {
        const docs = new Map<string, EfunDoc>();
        // 匹配文档注释后跟着的函数定义
        const functionPattern = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*(?:private\s+|public\s+|protected\s+|static\s+|nomask\s+|varargs\s+)*((?:mixed|void|int|string|object|mapping|array|float|function|buffer|class|[a-zA-Z_][a-zA-Z0-9_]*)\s*\**\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\))/g;
        const paramPattern = /@param\s+(\S+)\s+(\S+)\s+([^\n]+)/g;
        const returnPattern = /@return\s+(\S+)\s+(.*)/;
        const briefPattern = /@brief\s+([^\n]+)/;
        const detailsPattern = /@details\s+([^\n]+)/;

        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            try {
                const [_, docComment, funcDecl, funcName] = match;
                
                if (funcName) {
                    const doc: EfunDoc = {
                        name: funcName,
                        syntax: funcDecl.trim(),
                        description: '',
                        category: category,
                        lastUpdated: Date.now()
                    };

                    // 解析 @brief
                    const briefMatch = docComment.match(briefPattern);
                    if (briefMatch) {
                        doc.description = briefMatch[1].trim();
                    } else {
                        // 没有 @brief 的情况下，使用注释的第一行作为描述
                        const firstLine = docComment.trim().split('\n')[0].replace(/^\*+\s*/, '').trim();
                        if (firstLine) {
                            doc.description = firstLine;
                        }
                    }

                    // 解析 @details
                    const detailsMatch = docComment.match(detailsPattern);
                    if (detailsMatch) {
                        doc.details = detailsMatch[1].trim();
                    }

                    // 解析参数
                    const params: string[] = [];
                    let paramMatch;
                    const paramText = docComment.replace(/\r\n/g, '\n');  // 统一换行符
                    while ((paramMatch = paramPattern.exec(paramText)) !== null) {
                        const [_, type, name, desc] = paramMatch;
                        params.push(`${type} ${name}: ${desc.trim()}`);
                    }
                    if (params.length > 0) {
                        doc.description += '\n\n参数:\n' + params.join('\n');
                    }

                    // 解析返回值
                    const returnMatch = docComment.match(returnPattern);
                    if (returnMatch) {
                        const [_, type, desc] = returnMatch;
                        doc.returnValue = `${type}: ${desc.trim()}`;
                    }

                    docs.set(funcName, doc);
                }
            } catch (error) {
                console.error('解析函数文档失败:', error);
            }
        }

        return docs;
    }

    /**
     * 解析文件内容中的继承语句
     * @param content 文件内容
     * @returns 继承文件路径列表
     */
    private parseInheritStatements(content: string): string[] {
        const inheritFiles: string[] = [];
        const inheritPattern = /inherit\s+["']([^"']+)["']\s*;/g;
        
        let match;
        while ((match = inheritPattern.exec(content)) !== null) {
            const [_, inheritPath] = match;
            inheritFiles.push(inheritPath);
        }
        
        return inheritFiles;
    }

    /**
     * 加载继承文件的函数文档
     */
    private async loadInheritedFileDocs(): Promise<void> {
        if (!this.inheritedFiles.length) {
            return;
        }

        try {
            // 获取当前工作区
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return;
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            
            for (const inheritPath of this.inheritedFiles) {
                // 解析继承文件的绝对路径
                // 在 LPC 中，继承路径可能是相对于游戏根目录的，需要根据项目结构调整
                const possiblePaths = [
                    path.join(workspaceRoot, inheritPath),
                    path.join(workspaceRoot, inheritPath + '.c'),
                    path.join(path.dirname(this.currentFilePath), inheritPath),
                    path.join(path.dirname(this.currentFilePath), inheritPath + '.c')
                ];

                for (const filePath of possiblePaths) {
                    try {
                        if (fs.existsSync(filePath)) {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const fileName = path.basename(filePath);
                            const funcDocs = this.parseFunctionDocs(content, `继承自 ${fileName}`);
                            this.inheritedFileDocs.set(filePath, funcDocs);
                            break; // 找到文件后停止搜索其他可能的路径
                        }
                    } catch (error) {
                        console.error(`加载继承文件失败: ${filePath}`, error);
                    }
                }
            }
        } catch (error) {
            console.error('加载继承文件文档失败:', error);
        }
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        
        // 确保当前文件的文档是最新的
        if (document.uri.fsPath !== this.currentFilePath) {
            await this.updateCurrentFileDocs(document);
        }
        
        // 查找顺序：当前文件 -> 继承文件 -> 模拟函数库 -> 标准 efun
        
        // 1. 先查找当前文件中的函数文档
        const currentDoc = this.currentFileDocs.get(word);
        if (currentDoc) {
            return this.createHoverContent(currentDoc);
        }
        
        // 2. 再查找继承文件中的函数文档
        for (const [filePath, funcDocs] of this.inheritedFileDocs.entries()) {
            const inheritedDoc = funcDocs.get(word);
            if (inheritedDoc) {
                return this.createHoverContent(inheritedDoc);
            }
        }
        
        // 3. 再查找模拟函数库文档
        const simulatedDoc = this.simulatedEfunDocs.get(word);
        if (simulatedDoc) {
            return this.createHoverContent(simulatedDoc);
        }

        // 4. 最后查找标准efun文档
        const efunDoc = await this.getEfunDoc(word);
        if (!efunDoc) {
            return undefined;
        }

        return this.createHoverContent(efunDoc);
    }

    private createHoverContent(doc: EfunDoc): vscode.Hover {
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
        
        if (doc.details) {
            content.appendMarkdown(`**细节**:\n${doc.details}\n\n`);
        }
        
        if (doc.reference && doc.reference.length > 0) {
            content.appendMarkdown(`**参考**:\n${doc.reference.join(', ')}\n`);
        }

        return new vscode.Hover(content);
    }

    public getCategories(): Map<string, string[]> {
        return this.efunCategories;
    }

    public getAllFunctions(): string[] {
        return Array.from(this.efunDocs.keys());
    }

    public getAllSimulatedFunctions(): string[] {
        return Array.from(this.simulatedEfunDocs.keys());
    }

    public getSimulatedDoc(funcName: string): EfunDoc | undefined {
        return this.simulatedEfunDocs.get(funcName);
    }
}
