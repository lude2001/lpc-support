import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { LpcProjectConfigService } from './LpcProjectConfigService';
import type { LpcProjectConfigSnapshotService } from './LpcProjectConfigSnapshotService';

export const ONBOARDING_ACTIONS = {
    generate: '一键生成配置',
    viewDocs: '查看文档',
    neverRemind: '不再提示'
} as const;

export interface LpcProjectDetectionResult {
    isLpcProject: boolean;
    configHellPath?: string;
    matchedSignals: string[];
}

const WELL_KNOWN_MUDLIB_FILES = [
    'adm/single/simul_efun.c',
    'adm/single/master.c',
    'adm/obj/master.c',
    'simul_efun.c'
];
const MUD_DIRECTORY_SIGNALS = ['adm', 'include', 'clone', 'obj', 'std', 'cmds', 'daemon', 'u', 'd'];
const MUD_DIRECTORY_SIGNAL_THRESHOLD = 3;

export function detectLpcProject(workspaceRoot: string): LpcProjectDetectionResult {
    const strongSignals: string[] = [];
    const directorySignals: string[] = [];

    const configHellPath = findConfigHellPath(workspaceRoot);
    if (configHellPath) {
        strongSignals.push(configHellPath);
    }

    for (const candidate of WELL_KNOWN_MUDLIB_FILES) {
        if (isExistingFile(joinRelativePath(workspaceRoot, candidate))) {
            strongSignals.push(candidate);
        }
    }

    for (const directory of MUD_DIRECTORY_SIGNALS) {
        if (isExistingDirectory(path.join(workspaceRoot, directory))) {
            directorySignals.push(directory);
        }
    }

    return {
        isLpcProject: strongSignals.length > 0 || directorySignals.length >= MUD_DIRECTORY_SIGNAL_THRESHOLD,
        configHellPath,
        matchedSignals: [...strongSignals, ...directorySignals]
    };
}

export interface ProjectConfigOnboardingDeps {
    projectConfigService: Pick<LpcProjectConfigService, 'getProjectConfigPath' | 'ensureConfigForWorkspace'>;
    snapshotService?: Pick<LpcProjectConfigSnapshotService, 'refreshWorkspaceSnapshot'>;
    memento: Pick<vscode.Memento, 'get' | 'update'>;
    documentationUri?: string;
}

export class ProjectConfigOnboardingService implements vscode.Disposable {
    public static readonly DISMISSED_STATE_KEY = 'lpc.onboarding.dismissed';
    private static readonly DEFAULT_DOCUMENTATION_URI = 'https://github.com/lude2001/lpc-support#readme';

    private readonly disposables: vscode.Disposable[] = [];
    private readonly promptedWorkspaceRoots = new Set<string>();
    private isPrompting = false;

    constructor(private readonly deps: ProjectConfigOnboardingDeps) {}

    public start(): void {
        void this.promptForCurrentWorkspaceFolders();

        const workspaceFoldersSubscription = vscode.workspace.onDidChangeWorkspaceFolders?.(() => {
            void this.promptForCurrentWorkspaceFolders();
        });
        if (workspaceFoldersSubscription) {
            this.disposables.push(workspaceFoldersSubscription);
        }
    }

    public async checkAndPromptWorkspace(workspaceRoot: string): Promise<void> {
        const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot);
        if (this.promptedWorkspaceRoots.has(normalizedRoot)) {
            return;
        }

        const projectConfigPath = this.deps.projectConfigService.getProjectConfigPath(workspaceRoot);
        if (isExistingFile(projectConfigPath)) {
            return;
        }

        if (this.deps.memento.get<boolean>(ProjectConfigOnboardingService.DISMISSED_STATE_KEY)) {
            return;
        }

        const detection = detectLpcProject(workspaceRoot);
        if (!detection.isLpcProject) {
            return;
        }

        this.promptedWorkspaceRoots.add(normalizedRoot);
        const selection = await vscode.window.showInformationMessage(
            '检测到当前工作区可能是 LPC (MUD) 项目，但尚未创建 lpc-support.json 配置文件。',
            ONBOARDING_ACTIONS.generate,
            ONBOARDING_ACTIONS.viewDocs,
            ONBOARDING_ACTIONS.neverRemind
        );

        if (selection === ONBOARDING_ACTIONS.generate) {
            const created = await this.generateProjectConfig(workspaceRoot);
            if (created) {
                void vscode.window.showInformationMessage('已生成 lpc-support.json，LPC 项目配置已就绪。');
            } else {
                void vscode.window.showErrorMessage('生成 lpc-support.json 失败，请稍后重试。');
            }
            return;
        }

        if (selection === ONBOARDING_ACTIONS.viewDocs) {
            void vscode.env.openExternal(vscode.Uri.parse(this.getDocumentationUri()));
            return;
        }

        if (selection === ONBOARDING_ACTIONS.neverRemind) {
            await this.deps.memento.update(ProjectConfigOnboardingService.DISMISSED_STATE_KEY, true);
        }
    }

    public async generateProjectConfig(workspaceRoot: string): Promise<boolean> {
        const detection = detectLpcProject(workspaceRoot);

        try {
            await this.deps.projectConfigService.ensureConfigForWorkspace(
                workspaceRoot,
                detection.configHellPath ?? 'config.hell'
            );
        } catch {
            return false;
        }

        await this.deps.snapshotService?.refreshWorkspaceSnapshot(workspaceRoot);
        return true;
    }

    public dispose(): void {
        for (const disposable of this.disposables.splice(0)) {
            disposable.dispose();
        }
        this.promptedWorkspaceRoots.clear();
    }

    private async promptForCurrentWorkspaceFolders(): Promise<void> {
        if (this.isPrompting) {
            return;
        }

        this.isPrompting = true;
        try {
            for (const folder of vscode.workspace.workspaceFolders ?? []) {
                await this.checkAndPromptWorkspace(folder.uri.fsPath);
            }
        } finally {
            this.isPrompting = false;
        }
    }

    private getDocumentationUri(): string {
        return this.deps.documentationUri ?? ProjectConfigOnboardingService.DEFAULT_DOCUMENTATION_URI;
    }
}

function findConfigHellPath(workspaceRoot: string): string | undefined {
    if (isExistingFile(path.join(workspaceRoot, 'config.hell'))) {
        return 'config.hell';
    }

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
    } catch {
        return undefined;
    }

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }

        if (isExistingFile(path.join(workspaceRoot, entry.name, 'config.hell'))) {
            return `${entry.name}/config.hell`;
        }
    }

    return undefined;
}

function joinRelativePath(workspaceRoot: string, relativePath: string): string {
    return path.join(workspaceRoot, ...relativePath.split('/'));
}

function isExistingFile(targetPath: string): boolean {
    try {
        return fs.statSync(targetPath).isFile();
    } catch {
        return false;
    }
}

function isExistingDirectory(targetPath: string): boolean {
    try {
        return fs.statSync(targetPath).isDirectory();
    } catch {
        return false;
    }
}

function normalizeWorkspaceRoot(workspaceRoot: string): string {
    return workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
}
