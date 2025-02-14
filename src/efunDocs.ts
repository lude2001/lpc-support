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
    reference?: string[];
    category?: string;
    lastUpdated?: number;  // 添加最后更新时间戳
}

export class EfunDocsManager {
    private static EFUN_LIST_URL = 'https://mud.wiki/Lpc:Efun';
    private static EFUN_DOC_BASE_URL = 'https://mud.wiki/';
    private static CACHE_FILE_NAME = 'efun_docs_cache.json';
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();
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

        // 启动时自动更新文档
        this.updateDocs();
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

    private async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const doc = await this.getEfunDoc(word);
        
        if (!doc) {
            return undefined;
        }

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

    public getCategories(): Map<string, string[]> {
        return this.efunCategories;
    }

    public getAllFunctions(): string[] {
        return Array.from(this.efunDocs.keys());
    }
}
