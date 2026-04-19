import * as vscode from 'vscode';
import { Symbol, SymbolType } from '../../../../ast/symbolTable';
import { WorkspaceDocumentPathSupport } from '../../../shared/WorkspaceDocumentPathSupport';
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
    private readonly pathSupport: WorkspaceDocumentPathSupport;

    public constructor(private readonly context: Pick<
        DefinitionResolverContext,
        'astManager' | 'host' | 'macroManager' | 'projectConfigService' | 'semanticAdapter'
    >) {
        this.pathSupport = new WorkspaceDocumentPathSupport({
            host: context.host,
            macroManager: context.macroManager,
            projectConfigService: context.projectConfigService
        });
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
        return this.pathSupport.resolveIncludeFilePath(document, includePath, isSystemInclude, workspaceRoot, projectConfig);
    }

    public resolveInheritedFilePath(document: vscode.TextDocument, inheritValue: string): string | undefined {
        return this.pathSupport.resolveInheritedFilePath(document, inheritValue, this.getWorkspaceRoot(document));
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
        return this.pathSupport.resolveWorkspaceFilePath(document, filePath, this.getWorkspaceRoot(document));
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
        return this.pathSupport.tryOpenTextDocument(target);
    }

    public fileExists(filePath: string): boolean {
        return this.pathSupport.fileExists(filePath);
    }

    public getWorkspaceRoot(document: vscode.TextDocument): string {
        return this.pathSupport.getWorkspaceRoot(document);
    }

    public resolveProjectPath(
        workspaceRoot: string,
        configPath: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string {
        return this.pathSupport.resolveProjectPath(workspaceRoot, configPath, projectConfig);
    }

    public async getPrimaryIncludeDirectory(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        return this.pathSupport.getPrimaryIncludeDirectory(workspaceRoot, projectConfig);
    }

    public async getConfiguredSimulatedEfunFile(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        return this.pathSupport.getConfiguredSimulatedEfunFile(workspaceRoot, projectConfig);
    }

    public resolveExistingCodePath(targetPath: string): string {
        return this.pathSupport.resolveExistingCodePath(targetPath);
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

    private normalizeCachePath(filePath: string): string {
        return normalizeNavigationFsPath(filePath);
    }
}
