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

    constructor(options: WorkspaceSemanticIndexServiceOptions = {}) {
        this.host = options.host ?? defaultHost;
        this.snapshotService = options.snapshotService ?? DocumentSemanticSnapshotService.getInstance();
    }

    public async getIndexView(workspaceRoot: string): Promise<WorkspaceSymbolIndexView> {
        const resolvedWorkspaceRoot = this.resolveWorkspaceRoot(workspaceRoot);
        const documents = await this.collectWorkspaceDocuments(resolvedWorkspaceRoot);
        const entries = documents.map((document) => this.toWorkspaceEntry(
            this.snapshotService.getSnapshot(document, false)
        ));
        return new StaticWorkspaceSymbolIndexView(entries);
    }

    private resolveWorkspaceRoot(workspaceRoot: string): string {
        const normalizedRoot = this.normalizeComparablePath(workspaceRoot);
        const folders = this.host.getWorkspaceFolders() || [];
        const matchingFolder = folders.find(
            (folder) => this.normalizeComparablePath(folder.uri.fsPath) === normalizedRoot
        );
        return matchingFolder ? matchingFolder.uri.fsPath : workspaceRoot;
    }

    private async collectWorkspaceDocuments(workspaceRoot: string): Promise<vscode.TextDocument[]> {
        const openDocumentByPath = new Map<string, vscode.TextDocument>();
        const discoveredUriObjects = new Map<string, vscode.Uri>();

        for (const document of this.getOpenDocuments()) {
            if (!this.isIndexableDocument(document) || !this.isInWorkspace(document.uri.fsPath, workspaceRoot)) {
                continue;
            }

            openDocumentByPath.set(this.normalizeComparablePath(document.uri.fsPath), document);
        }

        const discoveredPaths = new Set<string>(openDocumentByPath.keys());
        for (const pattern of INDEXABLE_PATTERNS) {
            const matches = await this.host.findFiles(new vscode.RelativePattern(workspaceRoot, pattern));
            for (const uri of matches) {
                if (!this.isIndexableUri(uri) || !this.isInWorkspace(uri.fsPath, workspaceRoot)) {
                    continue;
                }

                const pathKey = this.normalizeComparablePath(uri.fsPath);
                discoveredPaths.add(pathKey);
                discoveredUriObjects.set(pathKey, uri);
            }
        }

        const paths = Array.from(discoveredPaths).sort();
        const documents: vscode.TextDocument[] = [];
        for (const pathKey of paths) {
            const openDocument = openDocumentByPath.get(pathKey);
            if (openDocument) {
                documents.push(openDocument);
                continue;
            }

            const discoveredUri = discoveredUriObjects.get(pathKey);
            if (!discoveredUri) {
                continue;
            }

            documents.push(await this.host.openTextDocument(discoveredUri));
        }

        return documents;
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
        return path.normalize(value)
            .replace(/^[\\/]+(?=[A-Za-z]:)/, '')
            .toLowerCase();
    }

    private toWorkspaceEntry(snapshot: DocumentSemanticSnapshot): WorkspaceSemanticIndexEntry {
        return {
            uri: this.toStableUriStringFromValue(snapshot.uri),
            version: snapshot.version,
            functionNames: uniqueSorted(snapshot.exportedFunctions.map((summary) => summary.name)),
            fileGlobalNames: uniqueSorted((snapshot.fileGlobals || []).map((summary) => summary.name)),
            typeNames: uniqueSorted(snapshot.typeDefinitions.map((summary) => summary.name))
        };
    }

    private toStableUriString(uri: vscode.Uri): string {
        const normalizedPath = uri.fsPath
            .replace(/\\/g, '/')
            .replace(/^\/+([A-Za-z]:)/, '$1');
        return `file:///${normalizedPath}`;
    }

    private toStableUriStringFromValue(uri: string): string {
        try {
            return this.toStableUriString(vscode.Uri.parse(uri));
        } catch {
            return uri;
        }
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
