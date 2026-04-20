import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { MacroManager } from '../../macroManager';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import type { LanguageWorkspaceProjectConfig } from '../contracts/LanguageWorkspaceContext';

export interface TextDocumentHost {
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    fileExists(filePath: string): boolean;
    getWorkspaceFolder(uri: vscode.Uri): { uri: { fsPath: string } } | undefined;
}

export type OpenTextDocumentHost = Pick<TextDocumentHost, 'openTextDocument'>;

export interface WorkspaceDocumentHost extends TextDocumentHost {
    findFiles(pattern: vscode.GlobPattern): Promise<readonly vscode.Uri[]>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
    onDidChangeTextDocument(
        listener: (event: vscode.TextDocumentChangeEvent) => unknown
    ): vscode.Disposable;
}

export interface WorkspaceDocumentPathSupportOptions {
    host?: TextDocumentHost;
    macroManager?: Pick<MacroManager, 'getMacro'>;
    projectConfigService?: Pick<
        LpcProjectConfigService,
        'getIncludeDirectoriesForWorkspace' | 'getPrimaryIncludeDirectoryForWorkspace' | 'getSimulatedEfunFileForWorkspace'
    >;
}

export function createVsCodeTextDocumentHost(): TextDocumentHost {
    return {
        openTextDocument: async (target) => typeof target === 'string'
            ? vscode.workspace.openTextDocument(target)
            : vscode.workspace.openTextDocument(target),
        fileExists: (filePath) => fs.existsSync(filePath),
        getWorkspaceFolder: (uri) => vscode.workspace.getWorkspaceFolder(uri)
    };
}

export function createVsCodeWorkspaceDocumentHost(): WorkspaceDocumentHost {
    const textDocumentHost = createVsCodeTextDocumentHost();
    return {
        ...textDocumentHost,
        findFiles: async (pattern) => vscode.workspace.findFiles(pattern),
        getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
        onDidChangeTextDocument: (listener) => vscode.workspace.onDidChangeTextDocument(listener)
    };
}

export function assertTextDocumentHost(owner: string, host: TextDocumentHost | undefined): TextDocumentHost {
    if (!host) {
        throw new Error(`${owner} requires an injected TextDocumentHost`);
    }

    return host;
}

export function assertOpenTextDocumentHost(
    owner: string,
    host: OpenTextDocumentHost | undefined
): OpenTextDocumentHost {
    if (!host) {
        throw new Error(`${owner} requires an injected openTextDocument host`);
    }

    return host;
}

export function assertWorkspaceDocumentHost(
    owner: string,
    host: WorkspaceDocumentHost | undefined
): WorkspaceDocumentHost {
    if (!host) {
        throw new Error(`${owner} requires an injected WorkspaceDocumentHost`);
    }

    return host;
}

export function assertDocumentPathSupport(
    owner: string,
    pathSupport: WorkspaceDocumentPathSupport | undefined
): WorkspaceDocumentPathSupport {
    if (!pathSupport) {
        throw new Error(`${owner} requires an injected WorkspaceDocumentPathSupport`);
    }

    return pathSupport;
}

export class WorkspaceDocumentPathSupport {
    private readonly host: TextDocumentHost;

    public constructor(private readonly options: WorkspaceDocumentPathSupportOptions) {
        this.host = assertTextDocumentHost('WorkspaceDocumentPathSupport', options.host);
    }

    public async tryOpenTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument | undefined> {
        try {
            return await this.host.openTextDocument(target);
        } catch {
            return undefined;
        }
    }

    public fileExists(filePath: string): boolean {
        return this.host.fileExists(filePath);
    }

    public getWorkspaceFolderRoot(document: vscode.TextDocument): string | undefined {
        return this.host.getWorkspaceFolder(document.uri)?.uri.fsPath;
    }

    public getWorkspaceRoot(document: vscode.TextDocument): string {
        return this.getWorkspaceFolderRoot(document) ?? path.dirname(document.uri.fsPath);
    }

    public resolveWorkspaceFilePath(
        document: vscode.TextDocument,
        filePath: string,
        workspaceRoot: string | undefined
    ): string | undefined {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        if (!workspaceRoot) {
            return undefined;
        }

        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return path.join(workspaceRoot, relativePath);
    }

    public resolveInheritedFilePath(
        document: vscode.TextDocument,
        inheritValue: string,
        workspaceRoot: string | undefined
    ): string | undefined {
        let resolvedValue = inheritValue;
        if (/^[A-Z_][A-Z0-9_]*$/.test(resolvedValue)) {
            const macro = this.options.macroManager?.getMacro(resolvedValue);
            if (!macro?.value) {
                return undefined;
            }

            resolvedValue = macro.value.replace(/^"(.*)"$/, '$1');
        }

        resolvedValue = this.ensureExtension(resolvedValue, '.c');

        if (!workspaceRoot) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return path.join(workspaceRoot, resolvedValue.substring(1));
        }

        return path.resolve(path.dirname(document.uri.fsPath), resolvedValue);
    }

    public resolveObjectFilePath(
        document: vscode.TextDocument,
        pathExpression: string
    ): string | undefined {
        const resolvedValue = this.resolveObjectPathExpression(pathExpression);
        if (!resolvedValue) {
            return undefined;
        }

        const normalizedTargetPath = this.ensureExtension(resolvedValue, '.c');
        let candidatePath: string;

        if (this.isWorkspaceAbsolutePath(normalizedTargetPath)) {
            candidatePath = normalizedTargetPath;
        } else if (normalizedTargetPath.startsWith('/')) {
            const workspaceRoot = this.getWorkspaceFolderRoot(document);
            if (!workspaceRoot) {
                return undefined;
            }

            candidatePath = path.join(workspaceRoot, normalizedTargetPath.substring(1));
        } else {
            candidatePath = path.resolve(path.dirname(document.uri.fsPath), normalizedTargetPath);
        }

        return this.fileExists(candidatePath) ? candidatePath : undefined;
    }

    public async resolveIncludeFilePaths(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean,
        workspaceRoot: string | undefined,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string[]> {
        if (!workspaceRoot) {
            return [];
        }

        const normalizedPath = this.ensureHeaderOrSourceExtension(includePath);
        if (isSystemInclude) {
            const includeDirectories = await this.getIncludeDirectories(workspaceRoot, projectConfig);
            return includeDirectories.map((includeDirectory) => path.join(includeDirectory, normalizedPath));
        }

        if (path.isAbsolute(normalizedPath)) {
            const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
            return [path.join(workspaceRoot, relativePath)];
        }

        return [path.resolve(path.dirname(document.uri.fsPath), normalizedPath)];
    }

    public async resolveIncludeFilePath(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean,
        workspaceRoot: string | undefined,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        if (!workspaceRoot) {
            return undefined;
        }

        const normalizedPath = this.ensureHeaderOrSourceExtension(includePath);
        if (isSystemInclude) {
            const globalIncludePath = await this.getPrimaryIncludeDirectory(workspaceRoot, projectConfig);
            if (!globalIncludePath) {
                return path.join(workspaceRoot, 'include', normalizedPath);
            }

            return path.join(globalIncludePath, normalizedPath);
        }

        if (path.isAbsolute(normalizedPath)) {
            const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
            return path.join(workspaceRoot, relativePath);
        }

        return path.resolve(path.dirname(document.uri.fsPath), normalizedPath);
    }

    public resolveProjectPath(
        workspaceRoot: string,
        configPath: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string {
        if (this.isWorkspaceAbsolutePath(configPath)) {
            return configPath;
        }

        const mudlibDirectory = projectConfig?.resolvedConfig?.mudlibDirectory;
        const mudlibRoot = mudlibDirectory
            ? this.resolveMudlibRoot(workspaceRoot, mudlibDirectory, projectConfig?.configHellPath)
            : workspaceRoot;
        const normalizedPath = configPath.startsWith('/') ? configPath.substring(1) : configPath;
        return path.join(mudlibRoot, normalizedPath);
    }

    public async getPrimaryIncludeDirectory(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        const fromContext = projectConfig?.resolvedConfig?.includeDirectories?.[0];
        if (fromContext) {
            return this.resolveProjectPath(workspaceRoot, fromContext, projectConfig);
        }

        const fromService = await this.options.projectConfigService?.getPrimaryIncludeDirectoryForWorkspace(workspaceRoot);
        if (fromService) {
            return fromService;
        }

        return undefined;
    }

    public async getConfiguredSimulatedEfunFile(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        const fromContext = projectConfig?.resolvedConfig?.simulatedEfunFile;
        if (fromContext) {
            return this.resolveExistingCodePath(
                this.resolveProjectPath(workspaceRoot, fromContext, projectConfig)
            );
        }

        const fromService = await this.options.projectConfigService?.getSimulatedEfunFileForWorkspace(workspaceRoot);
        if (fromService) {
            return fromService;
        }

        return undefined;
    }

    public resolveExistingCodePath(targetPath: string): string {
        if (this.fileExists(targetPath)) {
            return targetPath;
        }

        if (path.extname(targetPath)) {
            return targetPath;
        }

        for (const candidate of [`${targetPath}.c`, `${targetPath}.h`]) {
            if (this.fileExists(candidate)) {
                return candidate;
            }
        }

        return targetPath;
    }

    private async getIncludeDirectories(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string[]> {
        const fromContext = projectConfig?.resolvedConfig?.includeDirectories;
        if (fromContext?.length) {
            return fromContext.map((includeDirectory) =>
                this.resolveProjectPath(workspaceRoot, includeDirectory, projectConfig)
            );
        }

        const configuredDirectories = await this.options.projectConfigService?.getIncludeDirectoriesForWorkspace(workspaceRoot);
        if (configuredDirectories?.length) {
            return configuredDirectories;
        }

        return [path.join(workspaceRoot, 'include')];
    }

    private ensureHeaderOrSourceExtension(filePath: string): string {
        if (filePath.endsWith('.h') || filePath.endsWith('.c')) {
            return filePath;
        }

        return `${filePath}.h`;
    }

    private ensureExtension(filePath: string, extension: '.c' | '.h'): string {
        return filePath.endsWith(extension) ? filePath : `${filePath}${extension}`;
    }

    private resolveObjectPathExpression(pathExpression: string): string | undefined {
        if (pathExpression.startsWith('"') && pathExpression.endsWith('"')) {
            return pathExpression.slice(1, -1);
        }

        if (/^[A-Z_][A-Z0-9_]*$/.test(pathExpression)) {
            const macroValue = this.options.macroManager?.getMacro(pathExpression)?.value;
            if (!macroValue) {
                return undefined;
            }

            return macroValue.replace(/^["']|["']$/g, '');
        }

        return undefined;
    }

    private isWorkspaceAbsolutePath(targetPath: string): boolean {
        return /^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\');
    }

    private resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
        return this.isWorkspaceAbsolutePath(targetPath)
            ? targetPath
            : path.resolve(workspaceRoot, targetPath);
    }

    private resolveMudlibRoot(workspaceRoot: string, mudlibDirectory: string, configHellPath?: string): string {
        if (this.isWorkspaceAbsolutePath(mudlibDirectory)) {
            return mudlibDirectory;
        }

        if (configHellPath) {
            const configHellAbsolutePath = this.resolveWorkspacePath(workspaceRoot, configHellPath);
            return path.resolve(path.dirname(configHellAbsolutePath), mudlibDirectory);
        }

        return this.resolveWorkspacePath(workspaceRoot, mudlibDirectory);
    }
}
