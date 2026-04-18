import * as path from 'path';
import * as vscode from 'vscode';
import { LPCLexer } from '../../../antlr/LPCLexer';
import { DocumentSemanticSnapshotService } from '../../../completion/documentSemanticSnapshotService';
import { DocumentSemanticSnapshot } from '../../../completion/types';
import { getGlobalParsedDocumentService } from '../../../parser/ParsedDocumentService';
import {
    WorkspaceSemanticIndexEntry,
    WorkspaceSemanticIndexHost,
    WorkspaceSymbolIndexView
} from './workspaceSymbolTypes';

const INDEXABLE_PATTERNS = ['*.c', '*.h', '**/*.c', '**/*.h'] as const;

const defaultHost: WorkspaceSemanticIndexHost = {
    findFiles: async (pattern) => vscode.workspace.findFiles(pattern),
    openTextDocument: async (target) => typeof target === 'string'
        ? vscode.workspace.openTextDocument(target)
        : vscode.workspace.openTextDocument(target),
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders
};

interface WorkspaceSemanticIndexServiceOptions {
    host?: WorkspaceSemanticIndexHost;
    snapshotService?: DocumentSemanticSnapshotService;
}

interface WorkspaceRootCache {
    rootPath: string;
    discoveredUrisByPath: Map<string, vscode.Uri>;
    entriesByPath: Map<string, WorkspaceSemanticIndexEntry>;
    revalidationCursor: number;
    view?: WorkspaceSymbolIndexView;
    viewSignature?: string;
}

class StaticWorkspaceSymbolIndexView implements WorkspaceSymbolIndexView {
    private readonly functionCandidates: Map<string, string[]>;
    private readonly fileGlobalCandidates: Map<string, string[]>;
    private readonly typeCandidates: Map<string, string[]>;
    private readonly functionDeclarations: Map<string, string[]>;
    private readonly fileGlobalDeclarations: Map<string, string[]>;
    private readonly typeDeclarations: Map<string, string[]>;

    constructor(entries: WorkspaceSemanticIndexEntry[]) {
        this.functionDeclarations = buildCandidateMap(entries, (entry) => entry.functionNames);
        this.fileGlobalDeclarations = buildCandidateMap(entries, (entry) => entry.fileGlobalNames);
        this.typeDeclarations = buildCandidateMap(entries, (entry) => entry.typeNames);
        this.functionCandidates = buildCandidateSupersetMap(entries, (entry) => entry.functionNames);
        this.fileGlobalCandidates = buildCandidateSupersetMap(entries, (entry) => entry.fileGlobalNames);
        this.typeCandidates = buildCandidateSupersetMap(entries, (entry) => entry.typeNames);
    }

    public getFunctionCandidateFiles(name: string): string[] {
        return [...(this.functionCandidates.get(name) || [])];
    }

    public getFileGlobalCandidateFiles(name: string): string[] {
        return [...(this.fileGlobalCandidates.get(name) || [])];
    }

    public getTypeCandidateFiles(name: string): string[] {
        return [...(this.typeCandidates.get(name) || [])];
    }

    public getFunctionDeclarationFiles(name: string): string[] {
        return [...(this.functionDeclarations.get(name) || [])];
    }

    public getFileGlobalDeclarationFiles(name: string): string[] {
        return [...(this.fileGlobalDeclarations.get(name) || [])];
    }

    public getTypeDeclarationFiles(name: string): string[] {
        return [...(this.typeDeclarations.get(name) || [])];
    }
}

export class WorkspaceSemanticIndexService {
    private readonly host: WorkspaceSemanticIndexHost;
    private readonly snapshotService: DocumentSemanticSnapshotService;
    private readonly workspaceCaches = new Map<string, WorkspaceRootCache>();

    constructor(options: WorkspaceSemanticIndexServiceOptions = {}) {
        this.host = options.host ?? defaultHost;
        this.snapshotService = options.snapshotService ?? DocumentSemanticSnapshotService.getInstance();
    }

    public async getIndexView(workspaceRoot: string): Promise<WorkspaceSymbolIndexView> {
        const resolvedWorkspaceRoot = this.resolveWorkspaceRoot(workspaceRoot);
        const workspaceCache = await this.getOrCreateWorkspaceCache(resolvedWorkspaceRoot);
        const openDocuments = this.collectOpenDocuments(resolvedWorkspaceRoot);
        await this.refreshWorkspaceDiscovery(workspaceCache, openDocuments);
        await this.refreshOpenDocumentEntries(workspaceCache, openDocuments);
        const materializedPaths = await this.materializeDiscoveredEntries(workspaceCache, openDocuments);
        await this.revalidateCachedUnopenedEntries(workspaceCache, openDocuments, materializedPaths);

        const entries = this.getSortedEntries(workspaceCache);
        const signature = this.buildViewSignature(entries);
        if (workspaceCache.view && workspaceCache.viewSignature === signature) {
            return workspaceCache.view;
        }

        const view = new StaticWorkspaceSymbolIndexView(entries);
        workspaceCache.view = view;
        workspaceCache.viewSignature = signature;
        return view;
    }

    private resolveWorkspaceRoot(workspaceRoot: string): string {
        const normalizedRoot = this.normalizeComparablePath(workspaceRoot);
        const folders = this.host.getWorkspaceFolders() || [];
        const matchingFolder = folders.find(
            (folder) => this.normalizeComparablePath(folder.uri.fsPath) === normalizedRoot
        );
        return matchingFolder ? matchingFolder.uri.fsPath : workspaceRoot;
    }

    private async getOrCreateWorkspaceCache(workspaceRoot: string): Promise<WorkspaceRootCache> {
        const cacheKey = this.normalizeComparablePath(workspaceRoot);
        const existingCache = this.workspaceCaches.get(cacheKey);
        if (existingCache) {
            return existingCache;
        }

        const createdCache: WorkspaceRootCache = {
            rootPath: workspaceRoot,
            discoveredUrisByPath: new Map<string, vscode.Uri>(),
            entriesByPath: new Map<string, WorkspaceSemanticIndexEntry>(),
            revalidationCursor: 0
        };
        this.workspaceCaches.set(cacheKey, createdCache);
        return createdCache;
    }

    private async discoverWorkspaceUris(workspaceRoot: string): Promise<Map<string, vscode.Uri>> {
        const discoveredUrisByPath = new Map<string, vscode.Uri>();

        for (const pattern of INDEXABLE_PATTERNS) {
            const matches = await this.host.findFiles(new vscode.RelativePattern(workspaceRoot, pattern));
            for (const uri of matches) {
                if (!this.isIndexableUri(uri) || !this.isInWorkspace(uri.fsPath, workspaceRoot)) {
                    continue;
                }

                discoveredUrisByPath.set(this.normalizeComparablePath(uri.fsPath), uri);
            }
        }

        return discoveredUrisByPath;
    }

    private collectOpenDocuments(workspaceRoot: string): Map<string, vscode.TextDocument> {
        const openDocumentByPath = new Map<string, vscode.TextDocument>();

        for (const document of this.getOpenDocuments()) {
            if (!this.isIndexableDocument(document) || !this.isInWorkspace(document.uri.fsPath, workspaceRoot)) {
                continue;
            }

            openDocumentByPath.set(this.normalizeComparablePath(document.uri.fsPath), document);
        }

        return openDocumentByPath;
    }

    private async refreshWorkspaceDiscovery(
        workspaceCache: WorkspaceRootCache,
        openDocuments: Map<string, vscode.TextDocument>
    ): Promise<void> {
        const refreshedUris = await this.discoverWorkspaceUris(workspaceCache.rootPath);
        workspaceCache.discoveredUrisByPath = refreshedUris;

        for (const cachedPath of Array.from(workspaceCache.entriesByPath.keys())) {
            if (openDocuments.has(cachedPath) || refreshedUris.has(cachedPath)) {
                continue;
            }

            workspaceCache.entriesByPath.delete(cachedPath);
        }
    }

    private async refreshOpenDocumentEntries(
        workspaceCache: WorkspaceRootCache,
        openDocuments: Map<string, vscode.TextDocument>
    ): Promise<void> {
        for (const [pathKey, document] of openDocuments.entries()) {
            const snapshot = this.snapshotService.getSnapshot(document, true);
            const existingEntry = workspaceCache.entriesByPath.get(pathKey);
            if (existingEntry && existingEntry.version === snapshot.version && existingEntry.uri === snapshot.uri) {
                continue;
            }

            workspaceCache.entriesByPath.set(pathKey, this.toWorkspaceEntry(document, snapshot));
        }
    }

    private async materializeDiscoveredEntries(
        workspaceCache: WorkspaceRootCache,
        openDocuments: Map<string, vscode.TextDocument>
    ): Promise<Set<string>> {
        const materializedPaths = new Set<string>();
        for (const [pathKey, uri] of workspaceCache.discoveredUrisByPath.entries()) {
            if (openDocuments.has(pathKey) || workspaceCache.entriesByPath.has(pathKey)) {
                continue;
            }

            const document = await this.host.openTextDocument(uri);
            const snapshot = this.getFreshSnapshotForUnopenedDocument(document);
            workspaceCache.entriesByPath.set(pathKey, this.toWorkspaceEntry(document, snapshot));
            materializedPaths.add(pathKey);
        }

        return materializedPaths;
    }

    private async revalidateCachedUnopenedEntries(
        workspaceCache: WorkspaceRootCache,
        openDocuments: Map<string, vscode.TextDocument>,
        materializedPaths: Set<string>
    ): Promise<void> {
        const unopenedPaths = Array.from(workspaceCache.discoveredUrisByPath.keys())
            .filter((pathKey) => !openDocuments.has(pathKey) && !materializedPaths.has(pathKey))
            .sort();

        if (unopenedPaths.length === 0) {
            workspaceCache.revalidationCursor = 0;
            return;
        }

        const revalidationIndex = workspaceCache.revalidationCursor % unopenedPaths.length;
        const pathKey = unopenedPaths[revalidationIndex];
        const uri = workspaceCache.discoveredUrisByPath.get(pathKey);
        workspaceCache.revalidationCursor = (revalidationIndex + 1) % unopenedPaths.length;

        if (!uri) {
            return;
        }

        const document = await this.host.openTextDocument(uri);
        const snapshot = this.getFreshSnapshotForUnopenedDocument(document);
        workspaceCache.entriesByPath.set(pathKey, this.toWorkspaceEntry(document, snapshot));
    }

    private getSortedEntries(workspaceCache: WorkspaceRootCache): WorkspaceSemanticIndexEntry[] {
        return Array.from(workspaceCache.entriesByPath.entries())
            .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
            .map(([, entry]) => entry);
    }

    private buildViewSignature(entries: WorkspaceSemanticIndexEntry[]): string {
        return entries
            .map((entry) => [
                entry.uri,
                entry.version,
                entry.functionNames.join(','),
                entry.fileGlobalNames.join(','),
                entry.typeNames.join(','),
                entry.identifierNames.join(',')
            ].join('@'))
            .join('|');
    }

    private getOpenDocuments(): readonly vscode.TextDocument[] {
        return Array.isArray(vscode.workspace.textDocuments) ? vscode.workspace.textDocuments : [];
    }

    private isIndexableDocument(document: vscode.TextDocument): boolean {
        return this.isIndexablePath(document.uri.fsPath);
    }

    private isIndexableUri(uri: vscode.Uri): boolean {
        return this.isIndexablePath(uri.fsPath);
    }

    private isIndexablePath(fsPath: string): boolean {
        const extension = path.extname(fsPath).toLowerCase();
        return extension === '.c' || extension === '.h';
    }

    private isInWorkspace(fsPath: string, workspaceRoot: string): boolean {
        const normalizedPath = this.normalizeComparablePath(fsPath);
        const normalizedRoot = this.normalizeComparablePath(workspaceRoot);
        const relativePath = path.relative(normalizedRoot, normalizedPath);

        return relativePath === ''
            || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
    }

    private normalizeComparablePath(value: string): string {
        const normalizedPath = path.normalize(value).replace(/^[\\/]+(?=[A-Za-z]:)/, '');
        return process.platform === 'win32'
            ? normalizedPath.toLowerCase()
            : normalizedPath;
    }

    private toWorkspaceEntry(
        document: vscode.TextDocument,
        snapshot: DocumentSemanticSnapshot
    ): WorkspaceSemanticIndexEntry {
        return {
            uri: snapshot.uri,
            version: snapshot.version,
            functionNames: uniqueSorted(snapshot.exportedFunctions.map((summary) => summary.name)),
            fileGlobalNames: uniqueSorted((snapshot.fileGlobals || []).map((summary) => summary.name)),
            typeNames: uniqueSorted(snapshot.typeDefinitions.map((summary) => summary.name)),
            identifierNames: this.collectIdentifierNames(document)
        };
    }

    private getFreshSnapshotForUnopenedDocument(document: vscode.TextDocument): DocumentSemanticSnapshot {
        getGlobalParsedDocumentService().invalidate(document.uri);
        this.snapshotService.invalidate(document.uri);
        return this.snapshotService.getSnapshot(document, false);
    }

    private collectIdentifierNames(document: vscode.TextDocument): string[] {
        const parsed = getGlobalParsedDocumentService().get(document);
        return uniqueSorted(
            parsed.visibleTokens
                .filter((token) => token.type === LPCLexer.Identifier && typeof token.text === 'string' && token.text.length > 0)
                .map((token) => token.text!)
        );
    }
}

function buildCandidateMap(
    entries: WorkspaceSemanticIndexEntry[],
    selector: (entry: WorkspaceSemanticIndexEntry) => string[]
): Map<string, string[]> {
    const candidates = new Map<string, Set<string>>();

    for (const entry of entries) {
        for (const name of selector(entry)) {
            const uris = candidates.get(name) || new Set<string>();
            uris.add(entry.uri);
            candidates.set(name, uris);
        }
    }

    return new Map(
        Array.from(candidates.entries()).map(([name, uris]) => [name, Array.from(uris).sort()])
    );
}

function buildCandidateSupersetMap(
    entries: WorkspaceSemanticIndexEntry[],
    selector: (entry: WorkspaceSemanticIndexEntry) => string[]
): Map<string, string[]> {
    const candidates = new Map<string, Set<string>>();

    for (const entry of entries) {
        const declarationNames = selector(entry);
        const usageNames = entry.identifierNames;
        for (const name of new Set([...declarationNames, ...usageNames])) {
            const uris = candidates.get(name) || new Set<string>();
            uris.add(entry.uri);
            candidates.set(name, uris);
        }
    }

    return new Map(
        Array.from(candidates.entries()).map(([name, uris]) => [name, Array.from(uris).sort()])
    );
}

function uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values)).sort();
}
