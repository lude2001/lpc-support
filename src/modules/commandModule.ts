import * as path from 'path';
import * as vscode from 'vscode';
import { registerAnalysisInspector } from '../analysisInspector/AnalysisInspectorPanel';
import { createLpcCodeActionCommandHandlers } from '../codeActions';
import { Services } from '../core/ServiceKeys';
import { ServiceRegistry } from '../core/ServiceRegistry';
import { FunctionDocPanel } from '../functionDocPanel';
import { RustFunctionDocumentationLookupProvider } from '../functionDocs/services/RustFunctionDocumentationLookupProvider';
import type { TextDocumentHost } from '../language/shared/WorkspaceDocumentPathSupport';
import type { LspClientManager } from '../lsp/client/LspClientManager';
import { getLpcprjStartCommand, hasLpcprjCommand } from '../utils/lpcprj';

type CompilationMode = 'local' | 'remote';
type LocalLpccpCompileMode = 'reload-loaded' | 'compile-only' | 'fresh-required';

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
        compileMode?: LocalLpccpCompileMode;
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

interface LocalCompileModeQuickPickItem extends vscode.QuickPickItem {
    value: LocalLpccpCompileMode;
}

export function registerCommands(
    registry: ServiceRegistry,
    context: vscode.ExtensionContext,
    lspClientManager?: LspClientManager
): void {
    const efunDocsManager = registry.get(Services.EfunDocs);
    const diagnostics = registry.get(Services.Diagnostics);
    const compiler = registry.get(Services.Compiler);
    const projectConfigService = registry.get(Services.ProjectConfig) as ProjectConfigServiceLike;
    const projectConfigSnapshotService = registry.get(Services.ProjectConfigSnapshot);
    const projectConfigOnboardingService = registry.get(Services.ProjectConfigOnboarding);
    const errorTreeProvider = registry.get(Services.ErrorTree);
    const textDocumentHost = registry.get(Services.TextDocumentHost) as TextDocumentHost;

    registerAnalysisInspector(context, lspClientManager);

    register(context, 'lpc.scanFolder', () => {
        diagnostics.scanFolder();
    });

    register(context, 'lpc.showVariables', () => diagnostics.showVariables());

    register(context, 'lpc.showFunctionDoc', async () => {
        await efunDocsManager.bundledDocsReady;
        if (!lspClientManager) {
            vscode.window.showErrorMessage(vscode.l10n.t('The Rust language server has not started. The function documentation view is unavailable.'));
            return;
        }
        const lookupProvider = new RustFunctionDocumentationLookupProvider(lspClientManager, efunDocsManager);
        FunctionDocPanel.createOrShow(
            context,
            lookupProvider,
            textDocumentHost,
            projectConfigSnapshotService
        );
    });

    register(context, 'lpc.configureSimulatedEfuns', () => {
        return efunDocsManager.configureSimulatedEfuns();
    });

    register(context, 'lpc.initProjectConfig', async () => {
        const workspaceRoot = await resolveProjectConfigWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        const created = await projectConfigOnboardingService.generateProjectConfig(workspaceRoot);
        if (created) {
            vscode.window.showInformationMessage(vscode.l10n.t('Generated lpc-support.json: {0}', workspaceRoot));
        } else {
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to generate lpc-support.json. Please try again later.'));
        }
    });

    for (const command of createLpcCodeActionCommandHandlers(lspClientManager)) {
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
            vscode.window.showErrorMessage(vscode.l10n.t('Cannot open file: {0}', filePath));
        }
    });

    register(context, 'lpc.errorTree.copyError', async (errorItem: ErrorTreeItem) => {
        if (!errorItem?.fullError) {
            vscode.window.showErrorMessage(vscode.l10n.t('Cannot copy error information: the error item is invalid.'));
            return;
        }

        try {
            const errorType = errorItem.type === 'compile' ? vscode.l10n.t('Compilation error') : vscode.l10n.t('Runtime error');
            const errorInfo = [
                vscode.l10n.t('File: {0}', errorItem.file),
                vscode.l10n.t('Line: {0}', errorItem.line),
                vscode.l10n.t('Error type: {0}', errorType),
                vscode.l10n.t('Error information: {0}', errorItem.fullError)
            ].join('\n');
            await vscode.env.clipboard.writeText(errorInfo);
            vscode.window.showInformationMessage(vscode.l10n.t('Error information copied to the clipboard.'));
        } catch {
            vscode.window.showErrorMessage(vscode.l10n.t('Failed to copy error information.'));
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
                vscode.l10n.t('The `lpcprj` system command was not found. Download and install the development driver environment (preview) from GitHub before using Start MUD Driver.')
            );
            return;
        }

        const projectConfig = await projectConfigService.loadForWorkspace(workspaceRoot);
        if (!projectConfig?.configHellPath) {
            vscode.window.showWarningMessage(
                vscode.l10n.t('The current workspace has no usable `lpc-support.json` or `configHellPath`. The development driver cannot be started.')
            );
            return;
        }

        const resolvedConfigPath = projectConfigService.resolveWorkspacePath(
            workspaceRoot,
            projectConfig.configHellPath
        );
        const terminal = vscode.window.createTerminal({ name: vscode.l10n.t('MUD Driver'), cwd: workspaceRoot });
        terminal.sendText(getLpcprjStartCommand(resolvedConfigPath));
        terminal.show();
    });
}

export function registerWorkspaceIndexRebuildCommand(
    context: vscode.ExtensionContext,
    handler: () => Promise<void>
): vscode.Disposable {
    const disposable = vscode.commands.registerCommand('lpc.rebuildWorkspaceIndex', handler);
    context.subscriptions.push(disposable);
    return disposable;
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
        vscode.window.showErrorMessage(vscode.l10n.t('Open a workspace first.'));
    }

    return workspaceRoot;
}

async function resolveProjectConfigWorkspaceRoot(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
        vscode.window.showErrorMessage(vscode.l10n.t('Open a workspace first.'));
        return undefined;
    }

    if (workspaceFolders.length === 1) {
        return workspaceFolders[0].uri.fsPath;
    }

    const selected = await vscode.window.showQuickPick(
        workspaceFolders.map((folder) => ({
            label: folder.name,
            description: folder.uri.fsPath,
            fsPath: folder.uri.fsPath
        })),
        { placeHolder: vscode.l10n.t('Select the workspace to initialize') }
    );

    return selected?.fsPath;
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
        vscode.window.showErrorMessage(vscode.l10n.t('Open a workspace first.'));
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
            placeHolder: vscode.l10n.t('Select the folder to compile')
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
                label: vscode.l10n.t('Local compilation (lpccp)'),
                value: 'local',
                description: compileConfig?.mode === 'local' ? vscode.l10n.t('Current mode') : ''
            },
            {
                label: vscode.l10n.t('Remote compilation (HTTP)'),
                value: 'remote',
                description: compileConfig?.mode === 'remote' ? vscode.l10n.t('Current mode') : ''
            }
        ],
        { placeHolder: vscode.l10n.t('Select the compilation mode') }
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
            { label: vscode.l10n.t('Toggle use of the system command'), action: 'toggleSystemCommand' },
            { label: vscode.l10n.t('Set the lpccp path'), action: 'setLpccpPath' },
            { label: vscode.l10n.t('Set the lpccp compilation mode'), action: 'setCompileMode' },
            { label: vscode.l10n.t('View the current local compilation configuration'), action: 'showCurrentConfig' }
        ],
        { placeHolder: vscode.l10n.t('Manage local compilation configuration') }
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
            openLabel: vscode.l10n.t('Select the lpccp executable'),
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

    if (selectedAction.action === 'setCompileMode') {
        await setLocalCompileMode(projectConfigService, workspaceRoot, compileConfig?.local?.compileMode);
        return;
    }

    const projectConfig = await projectConfigService.readConfigFile(
        projectConfigService.getProjectConfigPath(workspaceRoot)
    );
    await vscode.window.showInformationMessage(formatLocalCompilationSummary(compileConfig, projectConfig));
}

async function setLocalCompileMode(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string,
    currentMode: LocalLpccpCompileMode | undefined
): Promise<void> {
    const selectedMode = await vscode.window.showQuickPick<LocalCompileModeQuickPickItem>(
        [
            {
                label: vscode.l10n.t('Reload loaded objects'),
                description: currentMode === 'reload-loaded' || !currentMode ? vscode.l10n.t('Current mode') : '',
                detail: vscode.l10n.t('--reload-loaded: Try to destruct and reload the target if it is already loaded.'),
                value: 'reload-loaded'
            },
            {
                label: vscode.l10n.t('Compile only'),
                description: currentMode === 'compile-only' ? vscode.l10n.t('Current mode') : '',
                detail: vscode.l10n.t('--compile-only: Keep loaded objects unchanged and return reload_loaded_object_failed if the target is already loaded.'),
                value: 'compile-only'
            },
            {
                label: vscode.l10n.t('Require an unloaded target'),
                description: currentMode === 'fresh-required' ? vscode.l10n.t('Current mode') : '',
                detail: vscode.l10n.t('--fresh-required: If the target is already loaded, indicate that validation requires a runtime restart.'),
                value: 'fresh-required'
            }
        ],
        { placeHolder: vscode.l10n.t('Select the lpccp compilation mode') }
    );

    if (!selectedMode) {
        return;
    }

    await projectConfigService.updateCompileConfigForWorkspace(workspaceRoot, (currentConfig) => ({
        ...currentConfig,
        mode: 'local',
        local: {
            ...currentConfig.local,
            compileMode: selectedMode.value
        }
    }));
}

async function showRemoteCompilationManager(
    projectConfigService: ProjectConfigServiceLike,
    workspaceRoot: string
): Promise<void> {
    const selectedAction = await vscode.window.showQuickPick<ActionQuickPickItem>(
        [
            { label: vscode.l10n.t('Select the active server'), action: 'selectServer' },
            { label: vscode.l10n.t('Add a server'), action: 'addServer' },
            { label: vscode.l10n.t('Edit a server'), action: 'editServer' },
            { label: vscode.l10n.t('Remove a server'), action: 'removeServer' },
            { label: vscode.l10n.t('View the current remote compilation configuration'), action: 'showCurrentConfig' }
        ],
        { placeHolder: vscode.l10n.t('Manage remote compilation configuration') }
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
    const name = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Enter the server name') });
    if (!name) {
        return;
    }

    const url = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Enter the server URL') });
    if (!url) {
        return;
    }

    const description = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Enter the server description (optional)') });

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
        vscode.window.showInformationMessage(vscode.l10n.t('No servers are available. Add a server first.'));
        return;
    }

    const selected = await vscode.window.showQuickPick<ServerQuickPickItem>(
        createServerQuickPickItems(servers),
        { placeHolder: vscode.l10n.t('Select the active server') }
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
        vscode.window.showInformationMessage(vscode.l10n.t('No servers are configured.'));
        return;
    }

    const selected = await vscode.window.showQuickPick<ServerQuickPickItem>(
        createServerQuickPickItems(servers),
        { placeHolder: vscode.l10n.t('Select the server to remove') }
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
        vscode.window.showInformationMessage(vscode.l10n.t('No servers are configured.'));
        return;
    }

    const selected = await vscode.window.showQuickPick<ServerQuickPickItem>(
        createServerQuickPickItems(servers),
        { placeHolder: vscode.l10n.t('Select the server to edit') }
    );

    if (!selected) {
        return;
    }

    const current = resolveSelectedServer(selected, servers);
    if (!current) {
        return;
    }
    const nextName = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Enter the server name'), value: current.name });
    if (!nextName) {
        return;
    }

    const nextUrl = await vscode.window.showInputBox({ prompt: vscode.l10n.t('Enter the server URL'), value: current.url });
    if (!nextUrl) {
        return;
    }

    const nextDescription = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter the server description (optional)'),
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
        vscode.l10n.t('Current mode: local'),
        `useSystemCommand: ${compileConfig?.local?.useSystemCommand ? 'true' : 'false'}`,
        `lpccpPath: ${compileConfig?.local?.lpccpPath || vscode.l10n.t('(system command)')}`,
        `compileMode: ${compileConfig?.local?.compileMode || 'reload-loaded'}`,
        `configHellPath: ${projectConfig?.configHellPath || vscode.l10n.t('(not set)')}`
    ].join('\n');
}

function formatRemoteCompilationSummary(compileConfig: CompileConfig | undefined): string {
    return [
        vscode.l10n.t('Current mode: remote'),
        vscode.l10n.t('Active server: {0}', compileConfig?.remote?.activeServer || vscode.l10n.t('(not set)')),
        vscode.l10n.t('Server count: {0}', compileConfig?.remote?.servers?.length || 0)
    ].join('\n');
}
