import * as vscode from 'vscode';
import * as path from 'path';
import type { TextDocumentHost } from './language/shared/WorkspaceDocumentPathSupport';
import { FunctionInfo } from './types/functionInfo';
import type { FunctionDocLookup } from './efun/FileFunctionDocTracker';
import {
    buildFunctionDocPanelInitialData,
    buildFunctionInfosFromDocGroup
} from './functionDocPanelViewModel';
import { renderFunctionDocPanelHtml } from './functionDocPanelTemplate';

type FunctionDocLookupProvider = {
    getFunctionDocLookupForDocument(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<FunctionDocLookup>;
};

/**
 * 函数文档面板类
 * 用于显示当前文件及其继承的函数列表和文档
 */
export class FunctionDocPanel {
    private static currentPanel: FunctionDocPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private currentDocument: vscode.TextDocument | undefined;
    private currentFunctions: FunctionInfo[] = [];
    private inheritedFunctions: Map<string, FunctionInfo[]> = new Map();

    /**
     * 创建或显示函数文档面板
     */
    public static createOrShow(
        context: vscode.ExtensionContext,
        functionDocLookupProvider: FunctionDocLookupProvider,
        textDocumentHost: TextDocumentHost
    ) {
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

        FunctionDocPanel.currentPanel = new FunctionDocPanel(panel, functionDocLookupProvider, textDocumentHost);
        void FunctionDocPanel.currentPanel.update(activeEditor.document);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        private readonly functionDocLookupProvider: FunctionDocLookupProvider,
        private readonly textDocumentHost: TextDocumentHost
    ) {
        this.panel = panel;

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

    private async update(document: vscode.TextDocument) {
        this.currentDocument = document;
        this.panel.title = `函数文档: ${path.basename(document.fileName)}`;

        const lookup = await this.functionDocLookupProvider.getFunctionDocLookupForDocument(document, {
            forceFresh: true
        });

        this.currentFunctions = buildFunctionInfosFromDocGroup(lookup.currentFile);
        this.inheritedFunctions.clear();

        for (const group of [...lookup.inheritedGroups, ...lookup.includeGroups]) {
            const functions = buildFunctionInfosFromDocGroup(group);
            if (functions.length > 0) {
                this.inheritedFunctions.set(group.source, functions);
            }
        }

        this.panel.webview.html = this.getWebviewContent();
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
        return renderFunctionDocPanelHtml(
            __dirname,
            buildFunctionDocPanelInitialData(this.currentFunctions, this.inheritedFunctions)
        );
    }

    private async gotoDefinition(filePath: string, line: number) {
        const document = await this.textDocumentHost.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document, { preview: false });
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }

    private async generateJavadocForFunction(filePath: string, line: number, _functionName: string) {
        try {
            const document = await this.textDocumentHost.openTextDocument(filePath);
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
}
