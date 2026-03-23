import * as vscode from 'vscode';
import axios from 'axios';
import * as path from 'path';
import type { LpcProjectConfigService } from './projectConfig/LpcProjectConfigService';

// -- Interfaces for API data and configuration --
interface CompileError {
    error: string;
    time: number;
    file: string;
}

interface RuntimeError {
    count: number;
    message: string;
    line: number;
    file: string;
}

export interface ErrorServerConfig {
    name: string;
    address: string;
}

// -- Tree Item Classes --
type ErrorItemType = 'compile' | 'runtime';

// Represents an individual error line in the tree
class ErrorTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly file: string,
        public readonly line: number,
        public readonly type: ErrorItemType,
        public readonly fullError: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${fullError}`;
        this.description = `(line ${line})`;
        this.iconPath = new vscode.ThemeIcon(type === 'compile' ? 'error' : 'bug');
        this.contextValue = 'errorItem'; // 添加contextValue以支持右键菜单
        this.command = {
            command: 'lpc.errorTree.openErrorLocation',
            title: 'Open Error Location',
            arguments: [this]
        };
    }
}

// Represents a file that contains one or more errors
class FileTreeItem extends vscode.TreeItem {
    public children: ErrorTreeItem[] = [];

    constructor(public readonly file: string) {
        super(path.basename(file), vscode.TreeItemCollapsibleState.Collapsed);
        this.description = path.dirname(file);
        this.iconPath = vscode.ThemeIcon.File;
    }

    public addError(error: CompileError | RuntimeError) {
        let label: string;
        let line: number;
        let type: ErrorItemType;
        let fullError: string;

        if ('error' in error) { // CompileError
            const match = error.error.match(/line (\d+): (.*)/);
            line = match ? parseInt(match[1], 10) : 1;
            label = match ? match[2] : error.error;
            type = 'compile';
            fullError = error.error;
        } else { // RuntimeError
            line = error.line;
            label = error.message.trim();
            type = 'runtime';
            fullError = `Count: ${error.count}\n${error.message}`;
        }
        this.children.push(new ErrorTreeItem(label, this.file, line, type, fullError));
    }

    // Update the label to show the error count
    public updateLabel() {
        this.label = `${path.basename(this.file)} (${this.children.length})`;
    }
}

// -- The Tree Data Provider --
export class ErrorTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private _activeServerAddress?: string;
    private _activeServerName?: string;
    private _errorData: [CompileError[], RuntimeError[]] = [[], []];

    constructor(private readonly projectConfigService: Pick<LpcProjectConfigService, 'loadForWorkspace'>) {
        void this.fetchErrors();
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this._activeServerAddress) {
            return Promise.resolve([new vscode.TreeItem("No error server selected.")]);
        }

        if (element instanceof FileTreeItem) {
            return Promise.resolve(element.children);
        }

        if (!element) {
            const groupedErrors = new Map<string, FileTreeItem>();
            const allErrors: (CompileError | RuntimeError)[] = [...(this._errorData[0] || []), ...(this._errorData[1] || [])];

            if (allErrors.length === 0) {
                const item = new vscode.TreeItem("太棒了！没有发现任何错误。", vscode.TreeItemCollapsibleState.None);
                item.iconPath = new vscode.ThemeIcon('check');
                return Promise.resolve([item]);
            }

            allErrors.forEach(error => {
                if (!groupedErrors.has(error.file)) {
                    groupedErrors.set(error.file, new FileTreeItem(error.file));
                }
                groupedErrors.get(error.file)!.addError(error);
            });

            groupedErrors.forEach(fileItem => fileItem.updateLabel());
            return Promise.resolve(Array.from(groupedErrors.values()));
        }

        return Promise.resolve([]);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
        void this.fetchErrors();
    }

    public async fetchErrors() {
        const activeServer = await this.resolveActiveServer();
        this._activeServerAddress = activeServer?.address;
        this._activeServerName = activeServer?.name;

        if (!this._activeServerAddress) {
            this._errorData = [[], []];
            vscode.window.setStatusBarMessage('Error Viewer: No active server.', 5000);
            this._onDidChangeTreeData.fire();
            return;
        }
        vscode.window.setStatusBarMessage(`LPC Error Viewer: ${this._activeServerName}`, 5000);
        vscode.window.setStatusBarMessage('$(sync~spin) Fetching LPC errors...', 2000);
        try {
            const compilePromise = axios.get(`${this._activeServerAddress}/error_info/get_compile_errors`);
            const runtimePromise = axios.get(`${this._activeServerAddress}/error_info/get_runtime_errors`);
            const [compileRes, runtimeRes] = await Promise.all([compilePromise, runtimePromise]);
            this._errorData = [compileRes.data.errors || [], runtimeRes.data.errors || []];
        } catch (error) {
            this._errorData = [[], []];
            let errorMessage = 'Failed to fetch errors.';
            if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
                errorMessage = `Connection to ${this._activeServerAddress} refused.`;
            }
            vscode.window.showErrorMessage(errorMessage);
        }
        this._onDidChangeTreeData.fire();
    }

    public async clearErrors() {
        if (!this._activeServerAddress) return;
        try {
            await axios.get(`${this._activeServerAddress}/error_info/clear_all_errors`);
            vscode.window.showInformationMessage('Errors cleared successfully.');
            this.refresh();
        } catch (error) {
            vscode.window.showErrorMessage('Failed to clear errors.');
        }
    }

    private async resolveActiveServer(): Promise<ErrorServerConfig | undefined> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return undefined;
        }

        const projectConfig = await this.projectConfigService.loadForWorkspace(workspaceRoot);
        const servers = (projectConfig?.compile?.remote?.servers ?? []).map((server) => ({
            name: server.name,
            address: server.url
        }));
        if (servers.length === 0) {
            return undefined;
        }

        return servers.find((server) => server.name === projectConfig?.compile?.remote?.activeServer) ?? servers[0];
    }

    private getWorkspaceRoot(): string | undefined {
        const activeDocument = vscode.window.activeTextEditor?.document;
        if (activeDocument) {
            const folder = vscode.workspace.getWorkspaceFolder(activeDocument.uri);
            if (folder) {
                return folder.uri.fsPath;
            }
        }

        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
}
