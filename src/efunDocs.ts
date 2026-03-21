import * as vscode from 'vscode';
import { BundledEfunLoader } from './efun/BundledEfunLoader';
import { FileFunctionDocTracker } from './efun/FileFunctionDocTracker';
import { RemoteEfunFetcher } from './efun/RemoteEfunFetcher';
import { SimulatedEfunScanner } from './efun/SimulatedEfunScanner';
import type { EfunDoc } from './efun/types';

export type {
    BundledEfunDoc,
    BundledEfunDocBundle,
    EfunDoc,
    LegacyEfunConfig,
    LegacyEfunConfigEntry
} from './efun/types';

export class EfunDocsManager {
    private bundledLoader: BundledEfunLoader;
    private fileFunctionDocTracker: FileFunctionDocTracker;
    private remoteFetcher: RemoteEfunFetcher;
    private simulatedEfunScanner: SimulatedEfunScanner;
    private efunDocs: Map<string, EfunDoc> = new Map();
    private efunCategories: Map<string, string[]> = new Map();
    private remoteDocFetches: Map<string, Promise<EfunDoc | undefined>> = new Map();
    private missingRemoteDocs = new Set<string>();

    constructor(context: vscode.ExtensionContext) {
        this.bundledLoader = new BundledEfunLoader(context);
        this.fileFunctionDocTracker = new FileFunctionDocTracker();
        this.remoteFetcher = new RemoteEfunFetcher();
        this.simulatedEfunScanner = new SimulatedEfunScanner();
        this.efunDocs = new Map(
            this.bundledLoader.getAllNames().map(name => [name, this.bundledLoader.get(name)!])
        );
        this.efunCategories = new Map(
            Array.from(this.bundledLoader.getCategories().entries(), ([category, names]) => [category, [...names]])
        );

        // 注册悬停提供程序
        context.subscriptions.push(
            vscode.languages.registerHoverProvider('lpc', {
                provideHover: (document, position) => this.provideHover(document, position)
            })
        );

        // 注册模拟函数库配置命令
        context.subscriptions.push(
            vscode.commands.registerCommand('lpc.configureSimulatedEfuns', () => this.simulatedEfunScanner.configure())
        );

        // 加载模拟函数库文档
        void this.simulatedEfunScanner.load();
        
        // 添加文件变更事件监听
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.languageId === 'lpc' || e.document.fileName.endsWith('.c')) {
                    this.refreshCurrentFileDocs(e.document);
                }
            }),
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && (editor.document.languageId === 'lpc' || editor.document.fileName.endsWith('.c'))) {
                    this.refreshCurrentFileDocs(editor.document);
                }
            })
        );

        // 如果已经有活动编辑器，则立即更新当前文件的文档
        if (vscode.window.activeTextEditor && 
            (vscode.window.activeTextEditor.document.languageId === 'lpc' || 
             vscode.window.activeTextEditor.document.fileName.endsWith('.c'))) {
            this.refreshCurrentFileDocs(vscode.window.activeTextEditor.document);
        }
    }

    private refreshCurrentFileDocs(document: vscode.TextDocument): void {
        void this.updateCurrentFileDocs(document);
    }

    public getStandardDoc(funcName: string): EfunDoc | undefined {
        return this.efunDocs.get(funcName);
    }

    public async getEfunDoc(funcName: string): Promise<EfunDoc | undefined> {
        const bundledDoc = this.getStandardDoc(funcName);
        if (bundledDoc) {
            return bundledDoc;
        }

        return this.fetchMissingMudWikiDoc(funcName);
    }

    private async fetchMissingMudWikiDoc(funcName: string): Promise<EfunDoc | undefined> {
        if (this.missingRemoteDocs.has(funcName)) {
            return undefined;
        }

        const pendingFetch = this.remoteDocFetches.get(funcName);
        if (pendingFetch) {
            return pendingFetch;
        }

        const request = this.remoteFetcher.fetchDoc(funcName)
            .then(doc => {
                if (doc) {
                    this.efunDocs.set(funcName, doc);
                    this.missingRemoteDocs.delete(funcName);
                } else {
                    this.missingRemoteDocs.add(funcName);
                }
                return doc;
            })
            .catch(() => {
                this.missingRemoteDocs.delete(funcName);
                return undefined;
            })
            .finally(() => {
                this.remoteDocFetches.delete(funcName);
            });

        this.remoteDocFetches.set(funcName, request);
        return request;
    }

    /**
     * 更新当前文件的函数文档
     * @param document 当前活动的文档
     */
    private async updateCurrentFileDocs(document: vscode.TextDocument): Promise<void> {
        await this.fileFunctionDocTracker.update(document);
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
        await this.updateCurrentFileDocs(document);
        
        // 查找顺序：当前文件 -> 继承文件 -> include文件 -> 模拟函数库 -> 标准 efun
        
        // 1. 先查找当前文件中的函数文档
        const currentDoc = this.fileFunctionDocTracker.getDoc(word);
        if (currentDoc) {
            return this.createHoverContent(currentDoc);
        }
        
        // 2. 再查找继承文件中的函数文档
        const inheritedDoc = this.fileFunctionDocTracker.getDocFromInherited(word);
        if (inheritedDoc) {
            return this.createHoverContent(inheritedDoc);
        }
        
        // 3. 查找include文件中的函数文档
        const includeDoc = await this.fileFunctionDocTracker.getDocFromIncludes(document, word);
        if (includeDoc) {
            return this.createHoverContent(includeDoc);
        }
        
        // 4. 再查找模拟函数库文档
        const simulatedDoc = this.simulatedEfunScanner.get(word);
        if (simulatedDoc) {
            return this.createHoverContent(simulatedDoc);
        }

        // 5. 最后查找标准efun文档
        const efunDoc = await this.getEfunDoc(word);
        if (!efunDoc) {
            return undefined;
        }

        return this.createHoverContent(efunDoc);
    }

    private createHoverContent(doc: EfunDoc): vscode.Hover {
        const content = new vscode.MarkdownString();
        content.isTrusted = false;
        content.supportHtml = true;

        // 函数签名
        if (doc.syntax) {
            content.appendMarkdown(`\`\`\`lpc\n${doc.syntax}\n\`\`\`\n\n`);
        }

        if (doc.returnType) {
            content.appendMarkdown(`**Return Type:** \`${doc.returnType}\`\n\n`);
        }

        // 分类标签 - 使用小型标签样式
        if (doc.category) {
            content.appendMarkdown(`<sub>${doc.category}</sub>\n\n`);
        }

        content.appendMarkdown(`---\n\n`);

        // 描述
        if (doc.description) {
            // 移除旧的"参数:"部分标记
            const descLines = doc.description.split('\n');
            const mainDesc: string[] = [];
            const params: string[] = [];
            let inParams = false;

            for (const line of descLines) {
                if (line.trim() === '参数:') {
                    inParams = true;
                    continue;
                }
                if (inParams) {
                    params.push(line);
                } else if (line.trim()) {
                    mainDesc.push(line);
                }
            }

            if (mainDesc.length > 0) {
                content.appendMarkdown(`${mainDesc.join('\n')}\n\n`);
            }

            // 参数表格
            if (params.length > 0) {
                content.appendMarkdown(`#### Parameters\n\n`);
                content.appendMarkdown(`| Name | Type | Description |\n`);
                content.appendMarkdown(`|------|------|-------------|\n`);

                params.forEach(param => {
                    const cleaned = param.trim();
                    if (cleaned) {
                        // 解析参数格式: "type name: description" 或 "name: description"
                        const match = cleaned.match(/^(?:(.+?)\s+)?`?([A-Za-z_][A-Za-z0-9_]*)`?\s*:\s*(.+)$/);
                        if (match) {
                            const [, type, name, desc] = match;
                            const normalizedType = type?.trim();
                            if (normalizedType) {
                                content.appendMarkdown(`| \`${name}\` | \`${normalizedType}\` | ${desc} |\n`);
                            } else {
                                content.appendMarkdown(`| \`${name}\` | | ${desc} |\n`);
                            }
                        } else {
                            content.appendMarkdown(`| ${cleaned} | | |\n`);
                        }
                    }
                });
                content.appendMarkdown(`\n`);
            }
        }

        // 返回值
        if (doc.returnValue) {
            content.appendMarkdown(`#### Returns\n\n${doc.returnValue}\n\n`);
        }

        // 详细说明
        if (doc.details) {
            content.appendMarkdown(`#### Details\n\n${doc.details}\n\n`);
        }

        // 其他说明
        if (doc.note) {
            content.appendMarkdown(`> **Note**  \n> ${doc.note.replace(/\n/g, '\n> ')}\n\n`);
        }

        // 相关函数
        if (doc.reference && doc.reference.length > 0) {
            content.appendMarkdown(`**See also:** ${doc.reference.map(ref => `\`${ref}\``).join(', ')}\n`);
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
        return this.simulatedEfunScanner.getAllNames();
    }

    public getSimulatedDoc(funcName: string): EfunDoc | undefined {
        return this.simulatedEfunScanner.get(funcName);
    }

}
