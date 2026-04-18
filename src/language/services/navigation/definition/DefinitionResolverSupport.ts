import * as path from 'path';
import * as vscode from 'vscode';
import { Symbol, SymbolType } from '../../../../ast/symbolTable';
import { SemanticSnapshot } from '../../../../semantic/semanticSnapshot';
import type { LanguageLocation } from '../../../contracts/LanguagePosition';
import type { LanguageWorkspaceProjectConfig } from '../../../contracts/LanguageWorkspaceContext';
import { normalizeNavigationFsPath } from '../navigationPathUtils';
import {
    DefinitionRequestState,
    DefinitionResolverContext,
    IncludeStatementLike,
    VsCodeLocationWithSourceUri
} from './types';

export class DefinitionResolverSupport {
    private readonly includeFileCache = new Map<string, string[]>();
    private readonly headerFunctionCache = new Map<string, Map<string, vscode.Location>>();

    public constructor(private readonly context: Pick<
        DefinitionResolverContext,
        'astManager' | 'host' | 'macroManager' | 'projectConfigService' | 'semanticAdapter'
    >) {
        this.context.host.onDidChangeTextDocument((event) => {
            const filePath = this.normalizeCachePath(event.document.uri.fsPath);
            if (filePath.endsWith('.h')) {
                this.headerFunctionCache.delete(filePath);
                for (const [key, includes] of this.includeFileCache.entries()) {
                    if (includes.some((includeFile) => this.normalizeCachePath(includeFile) === filePath)) {
                        this.includeFileCache.delete(key);
                    }
                }
            } else {
                this.includeFileCache.delete(filePath);
            }
        });
    }

    public createRequestState(): DefinitionRequestState {
        return {
            processedFiles: new Set<string>(),
            functionDefinitions: new Map<string, vscode.Location>()
        };
    }

    public toLanguageLocations(result: vscode.Location | vscode.Location[] | undefined): LanguageLocation[] {
        if (!result) {
            return [];
        }

        const locations = Array.isArray(result) ? result : [result];
        return locations.map((location) => {
            const originalUri = (location as VsCodeLocationWithSourceUri).__languageSourceUri;
            const range = this.toVsCodeRange(location);

            return {
                uri: originalUri ?? location.uri.toString(),
                range: {
                    start: {
                        line: range.start.line,
                        character: range.start.character
                    },
                    end: {
                        line: range.end.line,
                        character: range.end.character
                    }
                }
            };
        });
    }

    public toVsCodeRange(location: vscode.Location): vscode.Range {
        const rangeOrPosition = location.range;
        return 'start' in rangeOrPosition
            ? rangeOrPosition
            : new vscode.Range(rangeOrPosition, rangeOrPosition);
    }

    public toVsCodeLocation(location: LanguageLocation | vscode.Location): vscode.Location {
        if (location instanceof vscode.Location) {
            return location;
        }

        const uri = location.uri.includes('://') || location.uri.startsWith('file:')
            ? vscode.Uri.parse(location.uri)
            : vscode.Uri.file(location.uri);
        const range = new vscode.Range(
            location.range.start.line,
            location.range.start.character,
            location.range.end.line,
            location.range.end.character
        );
        const result = new vscode.Location(uri, range) as VsCodeLocationWithSourceUri;
        result.__languageSourceUri = location.uri;
        return result;
    }

    public toSymbolLocation(uri: vscode.Uri, symbol: Symbol): vscode.Location {
        const targetRange = symbol.selectionRange ?? symbol.range;
        return new vscode.Location(uri, targetRange);
    }

    public getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.context.astManager.getSemanticSnapshot(document, useCache);
    }

    public getIncludeStatements(document: vscode.TextDocument): IncludeStatementLike[] {
        return this.context.semanticAdapter?.getIncludeStatements?.(document)
            ?? this.getSemanticSnapshot(document).includeStatements;
    }

    public findInherits(document: vscode.TextDocument): Set<string> {
        const result = new Set<string>();
        const adaptedInherits = this.context.semanticAdapter?.getInheritStatements?.(document);
        if (adaptedInherits) {
            for (const statement of adaptedInherits) {
                if (statement) {
                    result.add(statement);
                }
            }
            return result;
        }

        const snapshot = this.context.astManager.getBestAvailableSnapshot(document);
        for (const statement of snapshot.inheritStatements) {
            if (statement.value) {
                result.add(statement.value);
            }
        }
        return result;
    }

    public async resolveExistingIncludeFiles(
        document: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string[]> {
        const includeFiles: string[] = [];
        const workspaceRoot = this.getWorkspaceRoot(document);

        for (const includeStatement of this.getIncludeStatements(document)) {
            const resolvedPath = await this.resolveIncludeFilePath(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot,
                projectConfig
            );
            if (resolvedPath && this.context.host.fileExists(resolvedPath)) {
                includeFiles.push(resolvedPath);
            }
        }

        return includeFiles;
    }

    public async resolveIncludeFilePath(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        if (!workspaceRoot) {
            return undefined;
        }

        return this.doResolveIncludeFilePath(document, includePath, isSystemInclude, workspaceRoot, projectConfig);
    }

    public resolveInheritedFilePath(document: vscode.TextDocument, inheritValue: string): string | undefined {
        let resolvedValue = inheritValue;
        if (/^[A-Z_][A-Z0-9_]*$/.test(resolvedValue)) {
            const macro = this.context.macroManager.getMacro(resolvedValue);
            if (!macro?.value) {
                return undefined;
            }

            resolvedValue = macro.value.replace(/^\"(.*)\"$/, '$1');
        }

        resolvedValue = this.ensureExtension(resolvedValue, '.c');

        const workspaceRoot = this.getWorkspaceRoot(document);
        if (!workspaceRoot) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return path.join(workspaceRoot, resolvedValue.substring(1));
        }

        return path.resolve(path.dirname(document.uri.fsPath), resolvedValue);
    }

    public async openInheritedDocument(
        document: vscode.TextDocument,
        inheritValue: string,
        requestState: DefinitionRequestState
    ): Promise<vscode.TextDocument | undefined> {
        const inheritedFile = this.resolveInheritedFilePath(document, inheritValue);
        if (!inheritedFile || !this.context.host.fileExists(inheritedFile) || requestState.processedFiles.has(inheritedFile)) {
            return undefined;
        }

        requestState.processedFiles.add(inheritedFile);
        return this.tryOpenTextDocument(inheritedFile);
    }

    public resolveWorkspaceFilePath(document: vscode.TextDocument, filePath: string): string | undefined {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        const workspaceRoot = this.getWorkspaceRoot(document);
        if (!workspaceRoot) {
            return undefined;
        }

        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return path.join(workspaceRoot, relativePath);
    }

    public async openWorkspaceDocument(
        document: vscode.TextDocument,
        filePath: string
    ): Promise<vscode.TextDocument | undefined> {
        const resolvedFilePath = this.resolveWorkspaceFilePath(document, filePath);
        if (!resolvedFilePath || !this.context.host.fileExists(resolvedFilePath)) {
            return undefined;
        }

        return this.tryOpenTextDocument(resolvedFilePath);
    }

    public async tryOpenTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument | undefined> {
        try {
            return await this.context.host.openTextDocument(target);
        } catch {
            return undefined;
        }
    }

    public fileExists(filePath: string): boolean {
        return this.context.host.fileExists(filePath);
    }

    public getWorkspaceRoot(document: vscode.TextDocument): string {
        return this.context.host.getWorkspaceFolder(document.uri)?.uri.fsPath ?? path.dirname(document.uri.fsPath);
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
            ? this.resolveWorkspacePath(workspaceRoot, mudlibDirectory)
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

        const fromService = await this.context.projectConfigService?.getPrimaryIncludeDirectoryForWorkspace(workspaceRoot);
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

        const fromService = await this.context.projectConfigService?.getSimulatedEfunFileForWorkspace(workspaceRoot);
        if (fromService) {
            return fromService;
        }

        return undefined;
    }

    public resolveExistingCodePath(targetPath: string): string {
        if (this.context.host.fileExists(targetPath)) {
            return targetPath;
        }

        if (path.extname(targetPath)) {
            return targetPath;
        }

        for (const candidate of [`${targetPath}.c`, `${targetPath}.h`]) {
            if (this.context.host.fileExists(candidate)) {
                return candidate;
            }
        }

        return targetPath;
    }

    public async getIncludeFiles(
        filePath: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string[]> {
        const cacheKey = this.normalizeCachePath(filePath);
        if (this.includeFileCache.has(cacheKey)) {
            return this.includeFileCache.get(cacheKey)!;
        }

        const document = await this.tryOpenTextDocument(filePath);
        if (!document) {
            return [];
        }

        const includeFiles = await this.resolveExistingIncludeFiles(document, projectConfig);
        this.includeFileCache.set(cacheKey, includeFiles);
        return includeFiles;
    }

    public async getHeaderFunctionIndex(headerPath: string): Promise<Map<string, vscode.Location>> {
        const cacheKey = this.normalizeCachePath(headerPath);
        if (this.headerFunctionCache.has(cacheKey)) {
            return this.headerFunctionCache.get(cacheKey)!;
        }

        const functionIndex = new Map<string, vscode.Location>();
        const headerDoc = await this.tryOpenTextDocument(vscode.Uri.file(headerPath));
        if (!headerDoc) {
            return functionIndex;
        }

        for (const summary of this.getSemanticSnapshot(headerDoc).exportedFunctions) {
            const location = this.findFunctionInSemanticSnapshot(headerDoc, summary.name);
            if (location) {
                functionIndex.set(summary.name, location);
            }
        }

        this.headerFunctionCache.set(cacheKey, functionIndex);
        return functionIndex;
    }

    public findFunctionInSemanticSnapshot(document: vscode.TextDocument, functionName: string): vscode.Location | undefined {
        const adaptedLocation = this.context.semanticAdapter?.findFunctionLocation?.(document, functionName);
        if (adaptedLocation) {
            return this.toVsCodeLocation(adaptedLocation);
        }

        const symbol = this.getSemanticSnapshot(document).symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        return symbol ? this.toSymbolLocation(document.uri, symbol) : undefined;
    }

    private async doResolveIncludeFilePath(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        let normalizedPath = this.ensureHeaderOrSourceExtension(includePath);

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

    private ensureHeaderOrSourceExtension(filePath: string): string {
        if (filePath.endsWith('.h') || filePath.endsWith('.c')) {
            return filePath;
        }

        return `${filePath}.h`;
    }

    private ensureExtension(filePath: string, extension: '.c' | '.h'): string {
        return filePath.endsWith(extension) ? filePath : `${filePath}${extension}`;
    }

    private isWorkspaceAbsolutePath(targetPath: string): boolean {
        return /^[A-Za-z]:[\\/]/.test(targetPath) || targetPath.startsWith('\\\\');
    }

    private resolveWorkspacePath(workspaceRoot: string, targetPath: string): string {
        return this.isWorkspaceAbsolutePath(targetPath)
            ? targetPath
            : path.resolve(workspaceRoot, targetPath);
    }

    private normalizeCachePath(filePath: string): string {
        return normalizeNavigationFsPath(filePath);
    }
}
