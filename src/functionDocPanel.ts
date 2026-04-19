import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EfunDocsManager } from './efunDocs';
import type { EfunDoc } from './efun/types';
import { defaultTextDocumentHost } from './language/shared/WorkspaceDocumentPathSupport';
import { FunctionInfo } from './types/functionInfo';

type FunctionDocSourceGroup = {
    source: string;
    filePath: string;
    docs: Map<string, EfunDoc>;
};

/**
 * 函数文档面板类
 * 用于显示当前文件及其继承的函数列表和文档
 */
export class FunctionDocPanel {
    private static currentPanel: FunctionDocPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly efunDocsManager: EfunDocsManager;
    private disposables: vscode.Disposable[] = [];
    private currentDocument: vscode.TextDocument | undefined;
    private currentFunctions: FunctionInfo[] = [];
    private inheritedFunctions: Map<string, FunctionInfo[]> = new Map();

    /**
     * 创建或显示函数文档面板
     */
    public static createOrShow(context: vscode.ExtensionContext, efunDocsManager: EfunDocsManager) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.fileName.endsWith('.c')) {
            vscode.window.showInformationMessage('请先打开一个 LPC 文件');
            return;
        }

        if (FunctionDocPanel.currentPanel) {
            FunctionDocPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
            void FunctionDocPanel.currentPanel.update(activeEditor.document);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'lpcFunctionDoc',
            'LPC 函数文档',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'media'))
                ]
            }
        );

        FunctionDocPanel.currentPanel = new FunctionDocPanel(panel, efunDocsManager);
        void FunctionDocPanel.currentPanel.update(activeEditor.document);
    }

    private constructor(panel: vscode.WebviewPanel, efunDocsManager: EfunDocsManager) {
        this.panel = panel;
        this.efunDocsManager = efunDocsManager;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'showFunctionDoc':
                        this.showFunctionDoc(message.functionName, message.source);
                        return;
                    case 'gotoDefinition':
                        void this.gotoDefinition(message.filePath, message.line);
                        return;
                    case 'generateJavadoc':
                        void this.generateJavadocForFunction(message.filePath, message.line, message.functionName);
                        return;
                }
            },
            null,
            this.disposables
        );

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.fileName.endsWith('.c')) {
                void this.update(editor.document);
            }
        }, null, this.disposables);

        vscode.workspace.onDidSaveTextDocument(document => {
            if (
                document.fileName.endsWith('.c')
                && this.currentDocument
                && document.uri.toString() === this.currentDocument.uri.toString()
            ) {
                void this.update(document);
            }
        }, null, this.disposables);
    }

    public async update(document: vscode.TextDocument) {
        this.currentDocument = document;
        this.panel.title = `函数文档: ${path.basename(document.fileName)}`;

        const lookup = await this.efunDocsManager.getFunctionDocLookupForDocument(document, {
            forceFresh: true
        });

        this.currentFunctions = this.buildFunctionInfosFromDocGroup(lookup.currentFile);
        this.inheritedFunctions.clear();

        for (const group of [...lookup.inheritedGroups, ...lookup.includeGroups]) {
            const functions = this.buildFunctionInfosFromDocGroup(group);
            if (functions.length > 0) {
                this.inheritedFunctions.set(group.source, functions);
            }
        }

        this.panel.webview.html = this.getWebviewContent();
    }

    private buildFunctionInfosFromDocGroup(group: FunctionDocSourceGroup): FunctionInfo[] {
        return Array.from(group.docs.values())
            .map((doc) => ({
                name: doc.name,
                definition: doc.syntax,
                returnType: doc.returnType,
                comment: this.renderDocComment(doc),
                briefDescription: doc.description ?? '',
                source: group.source,
                filePath: group.filePath,
                line: doc.sourceRange?.start.line ?? 0
            }))
            .sort((left, right) => (left.line ?? 0) - (right.line ?? 0) || left.name.localeCompare(right.name));
    }

    private showFunctionDoc(functionName: string, source: string) {
        let functionInfo: FunctionInfo | undefined;

        if (source === '当前文件') {
            functionInfo = this.currentFunctions.find(f => f.name === functionName);
        } else {
            const functions = this.inheritedFunctions.get(source);
            if (functions) {
                functionInfo = functions.find(f => f.name === functionName);
            }
        }

        if (functionInfo) {
            this.panel.webview.postMessage({
                command: 'updateFunctionDoc',
                functionInfo
            });
        }
    }

    private getWebviewContent() {
        const currentFunctions = this.currentFunctions.map(f => ({
            name: f.name,
            source: f.source,
            filePath: f.filePath,
            line: f.line,
            definition: f.definition,
            comment: f.comment,
            briefDescription: f.briefDescription
        }));

        const inheritedFunctionGroups: Array<{
            source: string;
            functions: Array<{
                name: string;
                source: string;
                filePath: string;
                line: number;
                definition: string;
                comment: string;
                briefDescription: string;
            }>;
        }> = [];
        this.inheritedFunctions.forEach((functions, source) => {
            inheritedFunctionGroups.push({
                source,
                functions: functions.map(f => ({
                    name: f.name,
                    source: f.source || '',
                    filePath: f.filePath || '',
                    line: f.line || 0,
                    definition: f.definition || '',
                    comment: f.comment || '',
                    briefDescription: f.briefDescription || '暂无描述'
                }))
            });
        });

        let finalHtmlPath = path.join(__dirname, 'templates', 'functionDocPanel.html');
        let finalJsPath = path.join(__dirname, 'templates', 'functionDocPanel.js');

        if (!fs.existsSync(finalHtmlPath)) {
            finalHtmlPath = path.join(__dirname, '..', 'src', 'templates', 'functionDocPanel.html');
        }
        if (!fs.existsSync(finalJsPath)) {
            finalJsPath = path.join(__dirname, '..', 'src', 'templates', 'functionDocPanel.js');
        }

        let htmlContent = '';
        let jsContent = '';

        try {
            htmlContent = fs.readFileSync(finalHtmlPath, 'utf8');
            jsContent = fs.readFileSync(finalJsPath, 'utf8');
        } catch (error) {
            console.error('Failed to read template files:', error);
            return this.getFallbackContent();
        }

        const scriptTag = `
            <script>
                window.initialData = {
                    currentFunctions: ${JSON.stringify(currentFunctions)},
                    inheritedFunctionGroups: ${JSON.stringify(inheritedFunctionGroups)}
                };

                ${jsContent}

                (function() {
                    function tryRender() {
                        if (window.functionDocPanel && window.initialData) {
                            window.functionDocPanel.renderFunctionList(
                                window.initialData.currentFunctions,
                                window.initialData.inheritedFunctionGroups
                            );
                        } else {
                            setTimeout(tryRender, 10);
                        }
                    }

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', tryRender);
                    } else {
                        tryRender();
                    }
                })();
            </script>
        `;

        return htmlContent.replace('</body>', `${scriptTag}</body>`);
    }

    private getFallbackContent(): string {
        return `<!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LPC 函数文档</title>
        </head>
        <body>
            <div style="padding: 20px; text-align: center;">
                <h3>模板文件加载失败</h3>
                <p>无法加载函数文档面板模板文件。</p>
            </div>
        </body>
        </html>`;
    }

    private async gotoDefinition(filePath: string, line: number) {
        const document = await defaultTextDocumentHost.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }

    private async generateJavadocForFunction(filePath: string, line: number, _functionName: string) {
        try {
            const document = await defaultTextDocumentHost.openTextDocument(filePath);
            const editor = await vscode.window.showTextDocument(document, { preview: false });
            const position = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            await vscode.commands.executeCommand('lpc.generateJavadoc');
            setTimeout(async () => {
                await this.update(document);
            }, 1000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            vscode.window.showErrorMessage(`生成注释失败: ${errorMessage}`);
        }
    }

    public dispose() {
        FunctionDocPanel.currentPanel = undefined;
        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            disposable?.dispose();
        }
    }

    private renderDocComment(doc: EfunDoc): string {
        const hasDocumentation = Boolean(
            doc.description
            || doc.details
            || doc.note
            || doc.returnValue
            || doc.signatures?.some((signature) => signature.parameters.some((parameter) => parameter.description))
        );
        if (!hasDocumentation) {
            return '';
        }

        const lines: string[] = ['/**'];

        if (doc.description) {
            lines.push(` * @brief ${doc.description}`);
        }

        for (const signature of doc.signatures ?? []) {
            for (const parameter of signature.parameters) {
                const parts = [' * @param'];
                if (parameter.type) {
                    parts.push(parameter.type);
                }
                parts.push(parameter.name);
                if (parameter.description) {
                    parts.push(parameter.description);
                }
                lines.push(parts.join(' '));
            }
        }

        if (doc.returnValue) {
            lines.push(` * @return ${doc.returnValue}`);
        }

        if (doc.details) {
            for (const [index, line] of doc.details.split('\n').entries()) {
                lines.push(` * ${index === 0 ? '@details ' : ''}${line}`.trimEnd());
            }
        }

        if (doc.note) {
            for (const [index, line] of doc.note.split('\n').entries()) {
                lines.push(` * ${index === 0 ? '@note ' : ''}${line}`.trimEnd());
            }
        }

        lines.push(' */');
        return lines.join('\n');
    }
}
