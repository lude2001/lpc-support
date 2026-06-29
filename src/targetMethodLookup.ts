import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { SymbolType } from './ast/symbolTable';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from './language/shared/WorkspaceDocumentPathSupport';
import type { LanguageWorkspaceProjectConfig } from './language/contracts/LanguageWorkspaceContext';
import type { DocumentAnalysisService, SnapshotAccessMode } from './semantic/documentAnalysisService';
import { SemanticSnapshot } from './semantic/semanticSnapshot';

export interface ResolvedTargetMethod {
    path: string;
    document: vscode.TextDocument;
    location: vscode.Location;
    declarationRange: vscode.Range;
}

export interface TargetMethodLookupOptions {
    snapshotMode?: SnapshotAccessMode;
    /** @deprecated Use snapshotMode: 'forceRefresh' for explicit maintenance refreshes. */
    useFreshSnapshots?: boolean;
    projectConfig?: LanguageWorkspaceProjectConfig;
}

export interface TargetDependencyFootprintRecorder {
    addDependencyFootprint(ownerUri: string, dependencies: readonly string[]): void;
    getWorkspaceConfigGeneration?(): number;
}

interface ResolvedFunctionRange {
    declarationRange: vscode.Range;
    navigationRange: vscode.Range;
}

type TargetMethodAnalysisService = Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;

interface CachedTargetMethodLookup {
    result: ResolvedTargetMethod | undefined;
    dependencies: readonly string[];
    dependencyFingerprint: string;
    createdAt: number;
}

export class TargetMethodLookup {
    private readonly analysisService: TargetMethodAnalysisService;
    private readonly pathSupport: WorkspaceDocumentPathSupport;
    private readonly cache = new Map<string, CachedTargetMethodLookup>();
    private readonly maxCacheEntries = 500;

    constructor(
        analysisService: TargetMethodAnalysisService,
        pathSupport?: WorkspaceDocumentPathSupport,
        private readonly dependencyFootprintRecorder?: TargetDependencyFootprintRecorder
    ) {
        this.analysisService = analysisService;
        this.pathSupport = assertDocumentPathSupport('TargetMethodLookup', pathSupport);
    }

    public async findMethod(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(currentDocument);
        const resolvedTargetPath = this.pathSupport.resolveWorkspaceFilePath(
            currentDocument,
            targetFilePath,
            workspaceRoot,
            options?.projectConfig
        );
        if (!resolvedTargetPath) {
            return undefined;
        }

        const ownerUri = currentDocument.uri.toString();
        const snapshotMode = this.resolveSnapshotMode(options);
        const dependencies = new Set<string>();
        const cached = snapshotMode !== 'forceRefresh'
            ? await this.getCachedMethod(currentDocument, resolvedTargetPath, methodName, options)
            : undefined;
        if (cached) {
            this.recordDependencies(ownerUri, cached.dependencies);
            return cached.result;
        }

        const result = await this.findMethodRecursive(
            currentDocument,
            resolvedTargetPath,
            methodName,
            new Set<string>(),
            ownerUri,
            dependencies,
            options
        );
        if (snapshotMode !== 'forceRefresh') {
            await this.cacheMethodResult(currentDocument, resolvedTargetPath, methodName, options, result, dependencies);
        }

        return result;
    }

    private async findMethodRecursive(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string,
        visitedFiles: Set<string>,
        ownerUri: string,
        dependencies: Set<string>,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(currentDocument);
        const resolvedTargetPath = this.pathSupport.resolveWorkspaceFilePath(
            currentDocument,
            targetFilePath,
            workspaceRoot,
            options?.projectConfig
        );
        if (!resolvedTargetPath || visitedFiles.has(resolvedTargetPath)) {
            return undefined;
        }

        visitedFiles.add(resolvedTargetPath);
        return this.resolveMethodRecursive(currentDocument, resolvedTargetPath, methodName, visitedFiles, ownerUri, dependencies, options);
    }

    private async resolveMethodRecursive(
        currentDocument: vscode.TextDocument,
        resolvedTargetPath: string,
        methodName: string,
        visitedFiles: Set<string>,
        ownerUri: string,
        dependencies: Set<string>,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        const targetDocument = path.resolve(resolvedTargetPath) === path.resolve(currentDocument.uri.fsPath)
            ? currentDocument
            : await this.pathSupport.tryOpenTextDocument(resolvedTargetPath);
        if (!targetDocument) {
            return undefined;
        }

        this.recordDependency(ownerUri, targetDocument.uri.fsPath, dependencies);
        const directRange = this.findFunctionRangeInSemanticSnapshot(
            targetDocument,
            methodName,
            this.resolveSnapshotMode(options)
        );
        if (directRange) {
            return {
                path: targetDocument.uri.fsPath,
                document: targetDocument,
                location: new vscode.Location(targetDocument.uri, directRange.navigationRange),
                declarationRange: directRange.declarationRange
            };
        }

        const includeLocation = await this.findMethodInIncludedFiles(targetDocument, methodName, ownerUri, dependencies, options);
        if (includeLocation) {
            return includeLocation;
        }

        for (const inheritStatement of this.getSemanticSnapshot(
            targetDocument,
            this.resolveSnapshotMode(options)
        ).inheritStatements) {
            const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(targetDocument);
            const inheritedFile = this.pathSupport.resolveInheritedFilePath(
                targetDocument,
                inheritStatement.value,
                workspaceRoot,
                options?.projectConfig
            );
            if (!inheritedFile || !this.pathSupport.fileExists(inheritedFile) || visitedFiles.has(inheritedFile)) {
                continue;
            }

            const inheritedLocation = await this.findMethodRecursive(
                targetDocument,
                inheritedFile,
                methodName,
                visitedFiles,
                ownerUri,
                dependencies,
                options
            );
            if (inheritedLocation) {
                return inheritedLocation;
            }
        }

        return undefined;
    }

    private async findMethodInIncludedFiles(
        document: vscode.TextDocument,
        methodName: string,
        ownerUri: string,
        dependencies: Set<string>,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        for (const includeStatement of this.getSemanticSnapshot(
            document,
            this.resolveSnapshotMode(options)
        ).includeStatements) {
            const includeFiles = await this.pathSupport.resolveIncludeFilePaths(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                this.pathSupport.getWorkspaceFolderRoot(document),
                options?.projectConfig
            );

            for (const includeFile of includeFiles) {
                if (!this.pathSupport.fileExists(includeFile)) {
                    continue;
                }

                const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
                if (!includeDocument) {
                    continue;
                }

                this.recordDependency(ownerUri, includeDocument.uri.fsPath, dependencies);
                const functionRange = this.findFunctionRangeInSemanticSnapshot(
                    includeDocument,
                    methodName,
                    this.resolveSnapshotMode(options)
                );
                if (functionRange) {
                    return {
                        path: includeDocument.uri.fsPath,
                        document: includeDocument,
                        location: new vscode.Location(includeDocument.uri, functionRange.navigationRange),
                        declarationRange: functionRange.declarationRange
                    };
                }
            }
        }

        return undefined;
    }

    private findFunctionRangeInSemanticSnapshot(
        document: vscode.TextDocument,
        functionName: string,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): ResolvedFunctionRange | undefined {
        const symbol = this.getSemanticSnapshot(document, mode).symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        if (!symbol) {
            return undefined;
        }

        return {
            declarationRange: symbol.range,
            navigationRange: symbol.selectionRange ?? symbol.range
        };
    }

    private getSemanticSnapshot(
        document: vscode.TextDocument,
        mode: boolean | SnapshotAccessMode = 'cacheFirst'
    ): SemanticSnapshot {
        return this.analysisService.getSemanticSnapshot(document, mode);
    }

    private recordDependency(ownerUri: string, filePath: string, dependencies: Set<string>): void {
        const dependencyUri = vscode.Uri.file(filePath).toString();
        dependencies.add(dependencyUri);
        this.recordDependencies(ownerUri, [dependencyUri]);
    }

    private recordDependencies(ownerUri: string, dependencies: readonly string[]): void {
        if (dependencies.length === 0) {
            return;
        }

        this.dependencyFootprintRecorder?.addDependencyFootprint(ownerUri, dependencies);
    }

    private resolveSnapshotMode(options?: TargetMethodLookupOptions): SnapshotAccessMode {
        if (options?.snapshotMode) {
            return options.snapshotMode;
        }

        return options?.useFreshSnapshots === true ? 'forceRefresh' : 'cacheFirst';
    }

    private async getCachedMethod(
        currentDocument: vscode.TextDocument,
        resolvedTargetPath: string,
        methodName: string,
        options?: TargetMethodLookupOptions
    ): Promise<CachedTargetMethodLookup | undefined> {
        const key = await this.createCacheKey(currentDocument, resolvedTargetPath, methodName, options);
        const cached = key ? this.cache.get(key) : undefined;
        if (!cached) {
            return undefined;
        }

        const currentFingerprint = this.createDependencyFingerprint(cached.dependencies);
        if (currentFingerprint !== cached.dependencyFingerprint) {
            this.cache.delete(key!);
            return undefined;
        }

        return cached;
    }

    private async cacheMethodResult(
        currentDocument: vscode.TextDocument,
        resolvedTargetPath: string,
        methodName: string,
        options: TargetMethodLookupOptions | undefined,
        result: ResolvedTargetMethod | undefined,
        dependencies: ReadonlySet<string>
    ): Promise<void> {
        const key = await this.createCacheKey(currentDocument, resolvedTargetPath, methodName, options);
        if (!key) {
            return;
        }

        const dependencyList = Array.from(dependencies);
        this.cache.set(key, {
            result,
            dependencies: dependencyList,
            dependencyFingerprint: this.createDependencyFingerprint(dependencyList),
            createdAt: Date.now()
        });
        this.pruneCache();
    }

    private async createCacheKey(
        currentDocument: vscode.TextDocument,
        resolvedTargetPath: string,
        methodName: string,
        options?: TargetMethodLookupOptions
    ): Promise<string | undefined> {
        const targetDocument = path.resolve(resolvedTargetPath) === path.resolve(currentDocument.uri.fsPath)
            ? currentDocument
            : await this.pathSupport.tryOpenTextDocument(resolvedTargetPath);
        if (!targetDocument) {
            return undefined;
        }

        const generation = this.dependencyFootprintRecorder?.getWorkspaceConfigGeneration?.() ?? 0;
        return [
            targetDocument.uri.toString(),
            this.createDocumentVersionToken(targetDocument),
            methodName,
            generation,
            options?.projectConfig?.projectConfigPath ?? ''
        ].join('|');
    }

    private createDocumentVersionToken(document: vscode.TextDocument): string {
        const fsPath = document.uri.fsPath;
        if (fsPath) {
            try {
                const stat = fs.statSync(fsPath);
                return `${document.version}:${stat.mtimeMs}:${stat.size}`;
            } catch {
                // In-memory test documents and virtual documents may not exist on disk.
            }
        }

        return `${document.version}:${document.getText().length}`;
    }

    private createDependencyFingerprint(dependencies: readonly string[]): string {
        return dependencies
            .map((dependencyUri) => {
                try {
                    const fsPath = this.dependencyUriToFsPath(dependencyUri);
                    const stat = fs.statSync(fsPath);
                    return `${dependencyUri}:${stat.mtimeMs}:${stat.size}`;
                } catch {
                    return `${dependencyUri}:missing`;
                }
            })
            .join(';');
    }

    private dependencyUriToFsPath(dependencyUri: string): string {
        if (dependencyUri.startsWith('file:///')) {
            return this.normalizeDependencyFsPath(decodeURIComponent(dependencyUri.replace(/^file:\/\//, '')));
        }

        return this.normalizeDependencyFsPath(vscode.Uri.parse(dependencyUri).fsPath);
    }

    private normalizeDependencyFsPath(fsPath: string): string {
        return fsPath
            .replace(/^[/\\]+([A-Za-z]:[\\/])/, '$1')
            .replace(/\//g, path.sep);
    }

    private pruneCache(): void {
        if (this.cache.size <= this.maxCacheEntries) {
            return;
        }

        const entries = Array.from(this.cache.entries())
            .sort((left, right) => left[1].createdAt - right[1].createdAt);
        while (this.cache.size > this.maxCacheEntries && entries.length > 0) {
            const [key] = entries.shift()!;
            this.cache.delete(key);
        }
    }
}
