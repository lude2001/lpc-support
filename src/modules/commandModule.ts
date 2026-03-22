import * as path from 'path';
import * as vscode from 'vscode';
import { LPCCompiler } from '../compiler';
import { LPCConfigManager } from '../config';
import { Services } from '../core/ServiceKeys';
import { ServiceRegistry } from '../core/ServiceRegistry';
import type { ErrorServerConfig } from '../errorTreeDataProvider';
import { FunctionDocPanel } from '../functionDocPanel';
import {
    migrateProjectConfigForWorkspace,
    shouldPromptProjectConfigMigration
} from '../projectConfig/projectConfigMigration';

export function registerCommands(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const macroManager = registry.get(Services.MacroManager);
    const diagnostics = registry.get(Services.Diagnostics);
    const completionProvider = registry.get(Services.Completion);
    const completionInstrumentation = registry.get(Services.CompletionInstrumentation);
    const configManager = registry.get(Services.ConfigManager);
    const compiler = registry.get(Services.Compiler);
    const projectConfigService = registry.get(Services.ProjectConfig);
    const errorTreeProvider = registry.get(Services.ErrorTree);

    register(context, 'lpc.migrateProjectConfig', async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        await migrateProjectConfigForWorkspace(projectConfigService, workspaceRoot);
        vscode.window.showInformationMessage('已创建并同步 lpc-support.json');
    });

    register(context, 'lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });

    register(context, 'lpc.showFunctionDoc', () => {
        FunctionDocPanel.createOrShow(context, macroManager);
    });

    register(context, 'lpc.errorTree.refresh', () => errorTreeProvider.refresh());
    register(context, 'lpc.errorTree.clear', () => errorTreeProvider.clearErrors());

    register(context, 'lpc.errorTree.addServer', async () => {
        const name = await vscode.window.showInputBox({ prompt: '输入服务器名称' });
        if (!name) {
            return;
        }

        const address = await vscode.window.showInputBox({ prompt: '输入服务器地址 (例如 http://127.0.0.1:8092)' });
        if (!address) {
            return;
        }

        const config = vscode.workspace.getConfiguration('lpc.errorViewer');
        const servers = config.get<ErrorServerConfig[]>('servers') || [];
        servers.push({ name, address });
        await config.update('servers', servers, vscode.ConfigurationTarget.Global);
        errorTreeProvider.refresh();
    });

    register(context, 'lpc.errorTree.removeServer', async () => {
        const servers = errorTreeProvider.getServers();
        if (servers.length === 0) {
            vscode.window.showInformationMessage('没有配置的服务器。');
            return;
        }

        const serverToRemove = await vscode.window.showQuickPick(
            servers.map(server => server.name),
            { placeHolder: '选择要移除的服务器' }
        );

        if (serverToRemove) {
            const updatedServers = servers.filter(server => server.name !== serverToRemove);
            await vscode.workspace
                .getConfiguration('lpc.errorViewer')
                .update('servers', updatedServers, vscode.ConfigurationTarget.Global);
            errorTreeProvider.refresh();
        }
    });

    register(context, 'lpc.errorTree.manageServers', async () => {
        const items = [
            { label: '添加新服务器', command: 'lpc.errorTree.addServer' },
            { label: '移除服务器', command: 'lpc.errorTree.removeServer' },
            { label: '手动编辑 settings.json', command: 'openSettings' }
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '管理错误查看器服务器'
        });

        if (!selected) {
            return;
        }

        if (selected.command === 'openSettings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.errorViewer.servers');
            return;
        }

        vscode.commands.executeCommand(selected.command);
    });

    register(context, 'lpc.errorTree.selectServer', async () => {
        const servers = errorTreeProvider.getServers();
        if (servers.length === 0) {
            vscode.window.showInformationMessage('没有可用的服务器，请先添加。', '添加服务器').then(selection => {
                if (selection === '添加服务器') {
                    vscode.commands.executeCommand('lpc.errorTree.addServer');
                }
            });
            return;
        }

        const selected = await vscode.window.showQuickPick(
            servers.map(server => server.name),
            { placeHolder: '选择一个活动的错误服务器' }
        );

        if (!selected) {
            return;
        }

        const server = servers.find(candidate => candidate.name === selected);
        if (server) {
            errorTreeProvider.setActiveServer(server);
        }
    });

    register(context, 'lpc.errorTree.openErrorLocation', async (errorItem: any) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const filePath = path.join(rootPath, errorItem.file);
        const fileUri = vscode.Uri.file(filePath);

        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document);
            const line = errorItem.line - 1;
            const range = new vscode.Range(line, 0, line, 100);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(range.start, range.end);
        } catch {
            vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
        }
    });

    register(context, 'lpc.errorTree.copyError', async (errorItem: any) => {
        if (!errorItem || !errorItem.fullError) {
            vscode.window.showErrorMessage('无法复制错误信息：错误项无效');
            return;
        }

        try {
            const errorInfo = `文件: ${errorItem.file}\n行号: ${errorItem.line}\n错误类型: ${errorItem.type === 'compile' ? '编译错误' : '运行时错误'}\n错误信息: ${errorItem.fullError}`;
            await vscode.env.clipboard.writeText(errorInfo);
            vscode.window.showInformationMessage('错误信息已复制到剪贴板');
        } catch {
            vscode.window.showErrorMessage('复制错误信息失败');
        }
    });

    register(context, 'lpc.compileFolder', async (uri?: vscode.Uri) => {
        let targetFolder: string;
        let workspaceRoot: string | undefined;

        if (uri) {
            targetFolder = uri.fsPath;
            workspaceRoot = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
        } else {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('请先打开一个工作区');
                return;
            }

            const folders = workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                uri: folder.uri
            }));

            if (folders.length === 1) {
                targetFolder = folders[0].uri.fsPath;
                workspaceRoot = folders[0].uri.fsPath;
            } else {
                const selected = await vscode.window.showQuickPick(folders, {
                    placeHolder: '选择要编译的文件夹'
                });

                if (!selected) {
                    return;
                }

                targetFolder = selected.uri.fsPath;
                workspaceRoot = selected.uri.fsPath;
            }
        }

        if (workspaceRoot) {
            await projectConfigService.loadForWorkspace(workspaceRoot);
        }

        await new LPCCompiler(new LPCConfigManager(context)).compileFolder(targetFolder);
    });

    register(context, 'lpc.addServer', () => configManager.addServer());
    register(context, 'lpc.selectServer', () => configManager.selectServer());
    register(context, 'lpc.removeServer', () => configManager.removeServer());
    register(context, 'lpc.manageServers', () => configManager.showServerManager());

    register(context, 'lpc.compileFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'lpc') {
            const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            if (workspaceRoot) {
                await projectConfigService.loadForWorkspace(workspaceRoot);
            }
            await compiler.compileFile(editor.document.fileName);
        }
    });

    register(context, 'lpc.configureMacroPath', () => macroManager.configurePath());

    register(context, 'lpc.startDriver', () => {
        const config = vscode.workspace.getConfiguration('lpc');
        const driverCommand = config.get<string>('driver.command');
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (workspaceRoot) {
            void projectConfigService.loadForWorkspace(workspaceRoot);
        }

        if (!driverCommand) {
            vscode.window.showWarningMessage(
                '未配置驱动启动命令。请在设置中配置 `lpc.driver.command`。',
                '打开设置'
            ).then(selection => {
                if (selection === '打开设置') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'lpc.driver.command');
                }
            });
            return;
        }

        let cwd: string | undefined;
        if (path.isAbsolute(driverCommand)) {
            cwd = path.dirname(driverCommand);
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const terminal = vscode.window.createTerminal({ name: 'MUD Driver', cwd });
        terminal.sendText(driverCommand);
        terminal.show();
    });

    void promptProjectConfigMigrationIfNeeded(projectConfigService);
}

function register(
    context: vscode.ExtensionContext,
    commandId: string,
    handler: (...args: any[]) => any
): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
}

async function promptProjectConfigMigrationIfNeeded(projectConfigService: any): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    const config = vscode.workspace.getConfiguration('lpc');
    const shouldPrompt = await shouldPromptProjectConfigMigration(projectConfigService, workspaceRoot, config);
    if (!shouldPrompt) {
        return;
    }

    const selection = await vscode.window.showInformationMessage(
        '当前项目仍在使用旧版 LPC Support 配置。建议迁移到项目根目录的 lpc-support.json。',
        '立即迁移'
    );

    if (selection === '立即迁移') {
        await vscode.commands.executeCommand('lpc.migrateProjectConfig');
    }
}
