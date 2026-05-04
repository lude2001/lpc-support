import * as path from 'path';
import * as vscode from 'vscode';
import { createLpcCodeActionCommandHandlers } from '../codeActions';
import { Services } from '../core/ServiceKeys';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { FunctionDocPanel } from '../functionDocPanel';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import { getLpcprjStartCommand, hasLpcprjCommand } from '../utils/lpcprj';

type CompilationMode = 'local' | 'remote';

interface RemoteCompileServer {
    name: string;
    url: string;
    description?: string;
}

interface CompileConfig {
    mode?: CompilationMode;
    local?: {
        useSystemCommand?: boolean;
        lpccpPath?: string;
    };
    remote?: {
        activeServer?: string;
        servers?: RemoteCompileServer[];
    };
}

interface ProjectConfigFile {
    version?: number;
    configHellPath?: string;
}

interface ProjectConfigServiceLike {
    loadForWorkspace(workspaceRoot: string): Promise<ProjectConfigFile | undefined>;
    ensureConfigForWorkspace(workspaceRoot: string, defaultConfigHellPath: string): Promise<unknown>;
    getCompileConfigForWorkspace(workspaceRoot: string): Promise<CompileConfig | undefined>;
    updateCompileConfigForWorkspace(
        workspaceRoot: string,
        updater: (currentConfig: CompileConfig) => CompileConfig
    ): Promise<unknown>;
    toWorkspaceRelativePath(workspaceRoot: string, targetPath: string): string;
    resolveWorkspacePath(workspaceRoot: string, targetPath: string): string;
    readConfigFile(configPath: string): Promise<ProjectConfigFile | undefined>;
    getProjectConfigPath(workspaceRoot: string): string;
}

interface ErrorTreeItem {
    file: string;
    line: number;
    type?: string;
    fullError?: string;
}

interface ServerQuickPickItem extends vscode.QuickPickItem {
    server: RemoteCompileServer;
}

interface ModeQuickPickItem extends vscode.QuickPickItem {
    value: CompilationMode;
}

interface ActionQuickPickItem extends vscode.QuickPickItem {
    action: string;
}

export function registerCommands(registry: ServiceRegistry, context: vscode.ExtensionContext): void {
    const efunDocsManager = registry.get(Services.EfunDocs);
    const diagnostics = registry.get(Services.Diagnostics);
    const compiler = registry.get(Services.Compiler);
    const projectConfigService = registry.get(Services.ProjectConfig) as ProjectConfigServiceLike;
    const errorTreeProvider = registry.get(Services.ErrorTree);
    const textDocumentHost = registry.get(Services.TextDocumentHost) as TextDocumentHost;

    register(context, 'lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });

    register(context, 'lpc.showVariables', () => diagnostics.showVariables());

    register(context, 'lpc.showFunctionDoc', () => {
        FunctionDocPanel.createOrShow(context, efunDocsManager, textDocumentHost);
    });

    register(context, 'lpc.configureSimulatedEfuns', () => {
        return efunDocsManager.configureSimulatedEfuns();
    });

    for (const command of createLpcCodeActionCommandHandlers(registry.get(Services.Analysis))) {
        register(context, command.id, command.handler);
    }

    register(context, 'lpc.errorTree.refresh', () => errorTreeProvider.refresh());
    register(context, 'lpc.errorTree.clear', () => errorTreeProvider.clearErrors());

    register(context, 'lpc.errorTree.openErrorLocation', async (errorItem: ErrorTreeItem) => {
        const workspaceRoot = requireWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        const filePath = path.join(workspaceRoot, errorItem.file);
        const fileUri = vscode.Uri.file(filePath);

        try {
            const document = await textDocumentHost.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document);
            const line = errorItem.line - 1;
            const range = new vscode.Range(line, 0, line, 100);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(range.start, range.end);
        } catch {
            vscode.window.showErrorMessage(`无法打开文件: ${filePath}`);
        }
    });

    register(context, 'lpc.errorTree.copyError', async (errorItem: ErrorTreeItem) => {
        if (!errorItem?.fullError) {
            vscode.window.showErrorMessage('无法复制错误信息：错误项无效');
            return;
        }

        try {
            const errorType = errorItem.type === 'compile' ? '编译错误' : '运行时错误';
            const errorInfo = [
                `文件: ${errorItem.file}`,
                `行号: ${errorItem.line}`,
                `错误类型: ${errorType}`,
                `错误信息: ${errorItem.fullError}`
            ].join('\n');
            await vscode.env.clipboard.writeText(errorInfo);
            vscode.window.showInformationMessage('错误信息已复制到剪贴板');
        } catch {
            vscode.window.showErrorMessage('复制错误信息失败');
        }
    });

    register(context, 'lpc.compileFolder', async (uri?: vscode.Uri) => {
        const target = await resolveCompileFolderTarget(uri);
        if (!target) {
            return;
        }

        if (target.workspaceRoot) {
            await ensureCompilationConfigForWorkspace(projectConfigService, target.workspaceRoot);
        }

        await compiler.compileFolder(target.targetFolder);
    });

    register(context, 'lpc.manageCompilation', async () => {
        const workspaceRoot = requireWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        await ensureCompilationConfigForWorkspace(projectConfigService, workspaceRoot);
        await showCompilationManager(projectConfigService, workspaceRoot);
        errorTreeProvider.refresh();
    });

    register(context, 'lpc.compileFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'lpc') {
            const workspaceRoot = vscode.workspace.getWorkspaceFolder(editor.document.uri)?.uri.fsPath;
            if (workspaceRoot) {
                await ensureCompilationConfigForWorkspace(projectConfigService, workspaceRoot);
            }

            await compiler.compileFile(editor.document.fileName);
        }
    });

    register(context, 'lpc.startDriver', async () => {
        const workspaceRoot = requireWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        if (!hasLpcprjCommand()) {
            vscode.window.showWarningMessage(
                '未检测到系统命令 `lpcprj`。请前往 GitHub 获取并安装开发驱动环境（预览版）后，再使用“启动驱动”功能。'
            );
            return;
        }

        const projectConfig = await projectConfigService.loadForWorkspace(workspaceRoot);
        if (!projectConfig?.configHellPath) {
            vscode.window.showWarningMessage(
                '当前工作区缺少可用的 `lpc-support.json` 或 `configHellPath`，无法启动开发驱动。'
            );
            return;
        }

        const resolvedConfigPath = projectConfigService.resolveWorkspacePath(
            workspaceRoot,
            projectConfig.configHellPath
        );
        const terminal = vscode.window.createTerminal({ name: 'MUD Driver', cwd: workspaceRoot });
        terminal.sendText(getLpcprjStartCommand(resolvedConfigPath));
        terminal.show();
    });
}

function register(
    context: vscode.ExtensionContext,
    commandId: string,
    handler: (...args: any[]) => any
): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
}

function getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function requireWorkspaceRoot(): string | undefined {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('请先打开一个工作区');
    }

    return workspaceRoot;
}

async function resolveCompileFolderTarget(uri?: vscode.Uri): Promise<{ targetFolder: string; workspaceRoot?: string } | undefined> {
    if (uri) {
        return {
            targetFolder: uri.fsPath,
            workspaceRoot: vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath
        };
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('请先打开一个工作区');
        return undefined;
    }

    if (workspaceFolders.length === 1) {
        return {
            targetFolder: workspaceFolders[0].uri.fsPath,
            workspaceRoot: workspaceFolders[0].uri.fsPath
        };
    }

    const selected = await vscode.window.showQuickPick(
        workspaceFolders.map((folder) => ({
            label: folder.name,
            description: folder.uri.fsPath,
            uri: folder.uri
        })),
        {
            placeHolder: '选择要编译的文件夹'
        }
    );

    if (!selected) {
        return undefined;
    }

    return {
        targetFolder: selected.uri.fsPath,
        workspaceRoot: selected.uri.fsPath
    };
}

async function ensureCompilationConfigForWorkspace(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<CompileConfig | undefined> {
    await projectConfigService.ensureConfigForWorkspace(workspaceRoot, 'config.hell');
    return projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
}

async function showCompilationManager(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const compileConfig = await projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
    const selectedMode = await vscode.window.showQuickPick<ModeQuickPickItem>(
        [
            {
                label: '本地编译 (lpccp)',
                value: 'local',
                description: compileConfig?.mode === 'local' ? '当前模式' : ''
            },
            {
                label: '远程编译 (HTTP)',
                value: 'remote',
                description: compileConfig?.mode === 'remote' ? '当前模式' : ''
            }
        ],
        { placeHolder: '选择编译模式' }
    );

    if (!selectedMode) {
        return;
    }

    await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
        ...currentConfig,
        mode: selectedMode.value
    }));

    if (selectedMode.value === 'local') {
        await showLocalCompilationManager(projectConfigService, workspaceRoot);
        return;
    }

    await showRemoteCompilationManager(projectConfigService, workspaceRoot);
}

async function showLocalCompilationManager(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const compileConfig = await projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
    const selectedAction = await vscode.window.showQuickPick<ActionQuickPickItem>(
        [
            { label: '切换为使用系统命令', action: 'toggleSystemCommand' },
            { label: '设置 lpccp 路径', action: 'setLpccpPath' },
            { label: '查看当前本地编译配置', action: 'showCurrentConfig' }
        ],
        { placeHolder: '管理本地编译配置' }
    );

    if (!selectedAction) {
        return;
    }

    if (selectedAction.action === 'toggleSystemCommand') {
        await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
            ...currentConfig,
            mode: 'local',
            local: {
                ...currentConfig.local,
                useSystemCommand: !currentConfig.local?.useSystemCommand
            }
        }));
        return;
    }

    if (selectedAction.action === 'setLpccpPath') {
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: '选择 lpccp 可执行文件',
            defaultUri: compileConfig?.local?.lpccpPath
                ? vscode.Uri.file(
                    projectConfigService.resolveWorkspacePath(workspaceRoot, compileConfig.local.lpccpPath)
                )
                : undefined
        });

        const lpccpPath = selectedFiles?.[0]?.fsPath;
        if (!lpccpPath) {
            return;
        }

        await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
            ...currentConfig,
            mode: 'local',
            local: {
                ...currentConfig.local,
                lpccpPath: projectConfigService.toWorkspaceRelativePath(workspaceRoot, lpccpPath)
            }
        }));
        return;
    }

    const projectConfig = await projectConfigService.readConfigFile(
        projectConfigService.getProjectConfigPath(workspaceRoot)
    );
    await vscode.window.showInformationMessage(formatLocalCompilationSummary(compileConfig, projectConfig));
}

async function showRemoteCompilationManager(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const selectedAction = await vscode.window.showQuickPick<ActionQuickPickItem>(
        [
            { label: '选择活动服务器', action: 'selectServer' },
            { label: '添加服务器', action: 'addServer' },
            { label: '编辑服务器', action: 'editServer' },
            { label: '删除服务器', action: 'removeServer' },
            { label: '查看当前远程编译配置', action: 'showCurrentConfig' }
        ],
        { placeHolder: '管理远程编译配置' }
    );

    if (!selectedAction) {
        return;
    }

    if (selectedAction.action === 'selectServer') {
        await selectRemoteServer(projectConfigService, workspaceRoot);
        return;
    }

    if (selectedAction.action === 'addServer') {
        await addRemoteServer(projectConfigService, workspaceRoot);
        return;
    }

    if (selectedAction.action === 'editServer') {
        await editRemoteServer(projectConfigService, workspaceRoot);
        return;
    }

    if (selectedAction.action === 'removeServer') {
        await removeRemoteServer(projectConfigService, workspaceRoot);
        return;
    }

    const compileConfig = await projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
    await vscode.window.showInformationMessage(formatRemoteCompilationSummary(compileConfig));
}

async function addRemoteServer(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const name = await vscode.window.showInputBox({ prompt: '输入服务器名称' });
    if (!name) {
        return;
    }

    const url = await vscode.window.showInputBox({ prompt: '输入服务器URL' });
    if (!url) {
        return;
    }

    const description = await vscode.window.showInputBox({ prompt: '输入服务器描述（可选）' });

    await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
        ...currentConfig,
        mode: 'remote',
        remote: {
            ...currentConfig.remote,
            activeServer: currentConfig.remote?.activeServer ?? name,
            servers: [
                ...(currentConfig.remote?.servers ?? []),
                { name, url, description: description || undefined }
            ]
        }
    }));
}

async function selectRemoteServer(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const compileConfig = await projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
    const servers = compileConfig?.remote?.servers ?? [];
    if (servers.length === 0) {
        vscode.window.showInformationMessage('没有可用的服务器，请先添加。');
        return;
    }

    const selected = await vscode.window.showQuickPick<ServerQuickPickItem>(
        createServerQuickPickItems(servers),
        { placeHolder: '选择活动服务器' }
    );

    if (!selected) {
        return;
    }

    const targetServer = resolveSelectedServer(selected, servers);
    if (!targetServer) {
        return;
    }

    await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
        ...currentConfig,
        mode: 'remote',
        remote: {
            ...currentConfig.remote,
            activeServer: targetServer.name,
            servers: currentConfig.remote?.servers ?? []
        }
    }));
}

async function removeRemoteServer(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const compileConfig = await projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
    const servers = compileConfig?.remote?.servers ?? [];
    if (servers.length === 0) {
        vscode.window.showInformationMessage('没有配置的服务器。');
        return;
    }

    const selected = await vscode.window.showQuickPick<ServerQuickPickItem>(
        createServerQuickPickItems(servers),
        { placeHolder: '选择要删除的服务器' }
    );

    if (!selected) {
        return;
    }

    const targetServer = resolveSelectedServer(selected, servers);
    if (!targetServer) {
        return;
    }

    await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => {
        const nextServers = (currentConfig.remote?.servers ?? []).filter(
            (server) => server.name !== targetServer.name
        );

        return {
            ...currentConfig,
            mode: 'remote',
            remote: {
                ...currentConfig.remote,
                activeServer: currentConfig.remote?.activeServer === targetServer.name
                    ? nextServers[0]?.name
                    : currentConfig.remote?.activeServer,
                servers: nextServers
            }
        };
    });
}

async function editRemoteServer(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const compileConfig = await projectConfigService.getCompileConfigForWorkspace(workspaceRoot);
    const servers = compileConfig?.remote?.servers ?? [];
    if (servers.length === 0) {
        vscode.window.showInformationMessage('没有配置的服务器。');
        return;
    }

    const selected = await vscode.window.showQuickPick<ServerQuickPickItem>(
        createServerQuickPickItems(servers),
        { placeHolder: '选择要编辑的服务器' }
    );

    if (!selected) {
        return;
    }

    const current = resolveSelectedServer(selected, servers);
    if (!current) {
        return;
    }
    const nextName = await vscode.window.showInputBox({ prompt: '输入服务器名称', value: current.name });
    if (!nextName) {
        return;
    }

    const nextUrl = await vscode.window.showInputBox({ prompt: '输入服务器URL', value: current.url });
    if (!nextUrl) {
        return;
    }

    const nextDescription = await vscode.window.showInputBox({
        prompt: '输入服务器描述（可选）',
        value: current.description
    });

    await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
        ...currentConfig,
        mode: 'remote',
        remote: {
            ...currentConfig.remote,
            activeServer: currentConfig.remote?.activeServer === current.name
                ? nextName
                : currentConfig.remote?.activeServer,
            servers: (currentConfig.remote?.servers ?? []).map((server) =>
                server.name === current.name
                    ? { name: nextName, url: nextUrl, description: nextDescription || undefined }
                    : server
            )
        }
    }));
}

function createServerQuickPickItems(servers: RemoteCompileServer[]): ServerQuickPickItem[] {
    return servers.map((server) => ({
        label: server.name,
        description: server.description || '',
        detail: server.url,
        server
    }));
}

function resolveSelectedServer(
    selected: Pick<ServerQuickPickItem, 'server' | 'label' | 'detail' | 'description'>,
    servers: RemoteCompileServer[]
): RemoteCompileServer | undefined {
    if (selected.server) {
        return selected.server;
    }

    return servers.find((server) => server.name === selected.label)
        ?? (selected.detail
            ? servers.find((server) => server.url === selected.detail)
            : undefined);
}

function formatLocalCompilationSummary(
    compileConfig: CompileConfig | undefined,
    projectConfig: ProjectConfigFile | undefined
): string {
    return [
        '当前模式: local',
        `useSystemCommand: ${compileConfig?.local?.useSystemCommand ? 'true' : 'false'}`,
        `lpccpPath: ${compileConfig?.local?.lpccpPath || '(系统命令)'}`,
        `configHellPath: ${projectConfig?.configHellPath || '(未设置)'}`
    ].join('\n');
}

function formatRemoteCompilationSummary(compileConfig: CompileConfig | undefined): string {
    return [
        '当前模式: remote',
        `活动服务器: ${compileConfig?.remote?.activeServer || '(未设置)'}`,
        `服务器数量: ${compileConfig?.remote?.servers?.length || 0}`
    ].join('\n');
}
