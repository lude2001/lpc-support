import * as path from 'path';
import * as vscode from 'vscode';
import { DocumentSemanticSnapshotService } from '../../../completion/documentSemanticSnapshotService';
import { DocumentSemanticSnapshot } from '../../../completion/types';
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
    view?: WorkspaceSymbolIndexView;
    viewSignature?: string;
}

class StaticWorkspaceSymbolIndexView implements WorkspaceSymbolIndexView {
    private readonly functionCandidates: Map<string, string[]>;
    private readonly fileGlobalCandidates: Map<string, string[]>;
    private readonly typeCandidates: Map<string, string[]>;

    constructor(entries: WorkspaceSemanticIndexEntry[]) {
        this.functionCandidates = buildCandidateMap(entries, (entry) => entry.functionNames);
        this.fileGlobalCandidates = buildCandidateMap(entries, (entry) => entry.fileGlobalNames);
        this.typeCandidates = buildCandidateMap(entries, (entry) => entry.typeNames);
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
        await this.refreshOpenDocumentEntries(workspaceCache, openDocuments);
        await this.materializeDiscoveredEntries(workspaceCache, openDocuments);

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
            discoveredUrisByPath: await this.discoverWorkspaceUris(workspaceRoot),
            entriesByPath: new Map<string, WorkspaceSemanticIndexEntry>()
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

            workspaceCache.entriesByPath.set(pathKey, this.toWorkspaceEntry(snapshot));
        }
    }

    private async materializeDiscoveredEntries(
        workspaceCache: WorkspaceRootCache,
        openDocuments: Map<string, vscode.TextDocument>
    ): Promise<void> {
        for (const [pathKey, uri] of workspaceCache.discoveredUrisByPath.entries()) {
            if (openDocuments.has(pathKey) || workspaceCache.entriesByPath.has(pathKey)) {
                continue;
            }

            const document = await this.host.openTextDocument(uri);
            const snapshot = this.snapshotService.getSnapshot(document, true);
            workspaceCache.entriesByPath.set(pathKey, this.toWorkspaceEntry(snapshot));
        }
    }

    private getSortedEntries(workspaceCache: WorkspaceRootCache): WorkspaceSemanticIndexEntry[] {
        return Array.from(workspaceCache.entriesByPath.entries())
            .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
            .map(([, entry]) => entry);
    }

    private buildViewSignature(entries: WorkspaceSemanticIndexEntry[]): string {
        return entries
            .map((entry) => `${entry.uri}@${entry.version}`)
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

    private toWorkspaceEntry(snapshot: DocumentSemanticSnapshot): WorkspaceSemanticIndexEntry {
        return {
            uri: snapshot.uri,
            version: snapshot.version,
            functionNames: uniqueSorted(snapshot.exportedFunctions.map((summary) => summary.name)),
            fileGlobalNames: uniqueSorted((snapshot.fileGlobals || []).map((summary) => summary.name)),
            typeNames: uniqueSorted(snapshot.typeDefinitions.map((summary) => summary.name))
        };
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

function uniqueSorted(values: string[]): string[] {
    return Array.from(new Set(values)).sort();
}
