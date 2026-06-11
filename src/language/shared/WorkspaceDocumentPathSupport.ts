import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { LpcProjectConfigService } from '../../projectConfig/LpcProjectConfigService';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import type { LanguageWorkspaceProjectConfig } from '../contracts/LanguageWorkspaceContext';

export interface TextDocumentHost {
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    fileExists(filePath: string): boolean;
    getWorkspaceFolder(uri: vscode.Uri): { uri: { fsPath: string } } | undefined;
}

export type OpenTextDocumentHost = Pick<TextDocumentHost, 'openTextDocument'>;

export interface WorkspaceDocumentHost extends TextDocumentHost {
    findFiles(pattern: vscode.GlobPattern, exclude?: vscode.GlobPattern): Promise<readonly vscode.Uri[]>;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
    onDidChangeTextDocument(
        listener: (event: vscode.TextDocumentChangeEvent) => unknown
    ): vscode.Disposable;
}

export interface WorkspaceDocumentPathSupportOptions {
    host?: TextDocumentHost;
    analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
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
        findFiles: async (pattern, exclude) => vscode.workspace.findFiles(pattern, exclude),
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
        return this.host.fileExists(this.normalizeFsPath(filePath));
    }

    public async findWorkspaceSourceFiles(workspaceRoot: string, extension: '.c' | '.h'): Promise<string[]> {
        const normalizedRoot = this.normalizeFsPath(workspaceRoot);
        const findFiles = (this.host as Partial<WorkspaceDocumentHost>).findFiles;
        const pattern = `**/*${extension}`;

        if (findFiles) {
            const uris = await findFiles.call(
                this.host,
                new vscode.RelativePattern(normalizedRoot, pattern),
                WORKSPACE_SEARCH_EXCLUDE_PATTERN
            );
            return uris
                .map((uri) => this.normalizeFsPath(uri.fsPath))
                .filter((filePath) => isPathInsideWorkspace(filePath, normalizedRoot))
                .filter((filePath) => filePath.endsWith(extension));
        }

        return this.findWorkspaceSourceFilesFromFs(normalizedRoot, extension);
    }

    public getWorkspaceFolderRoot(document: vscode.TextDocument): string | undefined {
        const workspaceFolder = this.host.getWorkspaceFolder(document.uri)?.uri.fsPath;
        return workspaceFolder ? this.normalizeFsPath(workspaceFolder) : undefined;
    }

    public getWorkspaceRoot(document: vscode.TextDocument): string {
        return this.getWorkspaceFolderRoot(document) ?? path.dirname(this.normalizeFsPath(document.uri.fsPath));
    }

    public resolveWorkspaceFilePath(
        document: vscode.TextDocument,
        filePath: string,
        workspaceRoot: string | undefined,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string | undefined {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        if (!workspaceRoot) {
            return undefined;
        }

        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return filePath.startsWith('/')
            ? this.resolveProjectPath(workspaceRoot, filePath, projectConfig)
            : path.join(workspaceRoot, relativePath);
    }

    public resolveInheritedFilePath(
        document: vscode.TextDocument,
        inheritValue: string,
        workspaceRoot: string | undefined,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string | undefined {
        let resolvedValue = inheritValue;
        if (/^[A-Z_][A-Z0-9_]*$/.test(resolvedValue)) {
            const macroValue = this.resolveMacroValue(document, resolvedValue);
            if (!macroValue) {
                return undefined;
            }

            resolvedValue = macroValue.replace(/^"(.*)"$/, '$1');
        }

        resolvedValue = this.ensureExtension(resolvedValue, '.c');

        if (!workspaceRoot) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return this.resolveProjectPath(workspaceRoot, resolvedValue, projectConfig);
        }

        return path.resolve(path.dirname(this.normalizeFsPath(document.uri.fsPath)), resolvedValue);
    }

    public resolveObjectFilePath(
        document: vscode.TextDocument,
        pathExpression: string
    ): string | undefined {
        const resolvedValue = this.resolveObjectPathExpression(document, pathExpression);
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
            candidatePath = path.resolve(path.dirname(this.normalizeFsPath(document.uri.fsPath)), normalizedTargetPath);
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

        return [path.resolve(path.dirname(this.normalizeFsPath(document.uri.fsPath)), normalizedPath)];
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

        return path.resolve(path.dirname(this.normalizeFsPath(document.uri.fsPath)), normalizedPath);
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

    private resolveObjectPathExpression(
        document: vscode.TextDocument,
        pathExpression: string
    ): string | undefined {
        if (pathExpression.startsWith('"') && pathExpression.endsWith('"')) {
            return pathExpression.slice(1, -1);
        }

        if (/^[A-Z_][A-Z0-9_]*$/.test(pathExpression)) {
            const macroValue = this.resolveMacroValue(document, pathExpression);
            if (!macroValue) {
                return undefined;
            }

            return macroValue.replace(/^["']|["']$/g, '');
        }

        return undefined;
    }

    private resolveMacroValue(document: vscode.TextDocument | undefined, name: string): string | undefined {
        if (document && this.options.analysisService) {
            try {
                const snapshot = this.options.analysisService.getSemanticSnapshot(document, false);
                if (snapshot.degraded) {
                    return undefined;
                }

                const frontendMacro = snapshot.macroDefinitions
                    ?.find((macro) => macro.name === name);

                if (frontendMacro?.value) {
                    return frontendMacro.value;
                }
            } catch {
                return undefined;
            }
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

    private normalizeFsPath(filePath: string): string {
        return filePath.replace(/^\/([A-Za-z]:[\\/])/, '$1');
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

    private async findWorkspaceSourceFilesFromFs(workspaceRoot: string, extension: '.c' | '.h'): Promise<string[]> {
        const results: string[] = [];
        const visit = async (directory: string): Promise<void> => {
            let entries: fs.Dirent[];
            try {
                entries = await fs.promises.readdir(directory, { withFileTypes: true });
            } catch {
                return;
            }

            await Promise.all(entries.map(async (entry) => {
                const entryPath = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    if (!IGNORED_WORKSPACE_DIRECTORIES.has(entry.name)) {
                        await visit(entryPath);
                    }
                    return;
                }

                if (entry.isFile() && entry.name.endsWith(extension)) {
                    results.push(entryPath);
                }
            }));
        };

        await visit(workspaceRoot);
        return results;
    }
}

function isPathInsideWorkspace(filePath: string, workspaceRoot: string): boolean {
    const relativePath = path.relative(workspaceRoot, filePath);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

const WORKSPACE_SEARCH_EXCLUDE_PATTERN = '{**/.git/**,**/node_modules/**,**/dist/**,**/out/**,**/coverage/**,**/binaries/**,**/log/**,**/logs/**,**/data/**}';

const IGNORED_WORKSPACE_DIRECTORIES = new Set([
    '.git',
    'node_modules',
    'dist',
    'out',
    'coverage',
    'binaries',
    'log',
    'logs',
    'data'
]);
