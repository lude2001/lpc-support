import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type {
    FileGlobalSummary,
    FunctionSummary,
    IncludeDirective,
    MacroDefinitionSummary,
    TypeDefinitionSummary
} from '../../semantic/documentSemanticTypes';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import { PreprocessorScanner } from '../../frontend/PreprocessorScanner';
import type { WorkspaceDocumentPathSupport } from './WorkspaceDocumentPathSupport';

export interface HeaderOwnerContext {
    macros: MacroDefinitionSummary[];
    functions: FunctionSummary[];
    fileGlobals: FileGlobalSummary[];
    types: TypeDefinitionSummary[];
    isAmbiguous: boolean;
}

type HeaderOwnerAnalysisService = Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;

export class HeaderOwnerContextService {
    private readonly scanner = new PreprocessorScanner();
    private readonly ownerIndexByWorkspace = new Map<string, Map<string, string[]>>();
    private readonly disposables: vscode.Disposable[] = [];

    public constructor(
        private readonly pathSupport: WorkspaceDocumentPathSupport,
        private readonly analysisService: HeaderOwnerAnalysisService
    ) {
        this.registerInvalidationHooks();
    }

    public async resolveOwnerContext(document: vscode.TextDocument): Promise<HeaderOwnerContext> {
        if (!isHeaderDocument(document)) {
            return emptyHeaderOwnerContext(false);
        }

        const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(document);
        if (!workspaceRoot) {
            return emptyHeaderOwnerContext(true);
        }

        const ownerIndex = await this.getOwnerIndex(workspaceRoot);
        const ownerFiles = ownerIndex.get(normalizePath(document.uri.fsPath)) ?? [];
        if (ownerFiles.length === 0) {
            return emptyHeaderOwnerContext(true);
        }

        if (ownerFiles.length > 1) {
            return emptyHeaderOwnerContext(true);
        }

        return this.collectOwnerContextBeforeInclude(ownerFiles[0], document, workspaceRoot);
    }

    public clear(): void {
        this.ownerIndexByWorkspace.clear();
    }

    public dispose(): void {
        for (const disposable of this.disposables.splice(0)) {
            disposable.dispose();
        }
        this.clear();
    }

    private registerInvalidationHooks(): void {
        const workspace = vscode.workspace as typeof vscode.workspace & {
            onDidSaveTextDocument?: typeof vscode.workspace.onDidSaveTextDocument;
            createFileSystemWatcher?: typeof vscode.workspace.createFileSystemWatcher;
        };

        if (typeof workspace.onDidChangeTextDocument === 'function') {
            this.disposables.push(workspace.onDidChangeTextDocument((event) => {
                this.clearForPath(event.document.uri.fsPath);
            }));
        }

        if (typeof workspace.onDidSaveTextDocument === 'function') {
            this.disposables.push(workspace.onDidSaveTextDocument((document) => {
                this.clearForPath(document.uri.fsPath);
            }));
        }

        if (typeof workspace.createFileSystemWatcher === 'function') {
            const watcher = workspace.createFileSystemWatcher('**/*.{c,h}');
            if (!watcher) {
                return;
            }
            watcher.onDidCreate((uri) => this.clearForPath(uri.fsPath));
            watcher.onDidChange((uri) => this.clearForPath(uri.fsPath));
            watcher.onDidDelete((uri) => this.clearForPath(uri.fsPath));
            this.disposables.push(watcher);
        }
    }

    private clearForPath(filePath: string | undefined): void {
        if (!filePath || !isOwnerRelevantPath(filePath)) {
            return;
        }

        const workspaceRoot = this.findCachedWorkspaceRootForPath(filePath);
        if (workspaceRoot) {
            this.ownerIndexByWorkspace.delete(workspaceRoot);
            return;
        }

        this.clear();
    }

    private findCachedWorkspaceRootForPath(filePath: string): string | undefined {
        const normalizedFile = normalizePath(filePath);
        return Array.from(this.ownerIndexByWorkspace.keys())
            .find((workspaceRoot) => normalizedFile.startsWith(normalizePath(workspaceRoot)));
    }

    private async getOwnerIndex(workspaceRoot: string): Promise<Map<string, string[]>> {
        const cached = this.ownerIndexByWorkspace.get(workspaceRoot);
        if (cached) {
            return cached;
        }

        const index = await this.buildOwnerIndex(workspaceRoot);
        this.ownerIndexByWorkspace.set(workspaceRoot, index);
        return index;
    }

    private async buildOwnerIndex(workspaceRoot: string): Promise<Map<string, string[]>> {
        const index = new Map<string, string[]>();
        for (const ownerFile of listTranslationUnitFiles(workspaceRoot)) {
            const text = safeReadFile(ownerFile);
            if (text === undefined) {
                continue;
            }

            const ownerDocument = createSyntheticDocument(ownerFile, text);
            const scanned = this.scanner.scan(ownerDocument.uri.toString(), 1, text);
            for (const include of scanned.includeReferences) {
                const candidates = await this.pathSupport.resolveIncludeFilePaths(
                    ownerDocument,
                    include.value,
                    include.isSystemInclude,
                    workspaceRoot
                );
                const resolved = candidates.find((candidate) => this.pathSupport.fileExists(candidate));
                if (!resolved || !isHeaderPath(resolved)) {
                    continue;
                }

                const key = normalizePath(resolved);
                const owners = index.get(key) ?? [];
                if (!owners.some((owner) => normalizePath(owner) === normalizePath(ownerFile))) {
                    owners.push(ownerFile);
                }
                index.set(key, owners);
            }
        }

        return index;
    }

    private async collectOwnerContextBeforeInclude(
        ownerFile: string,
        headerDocument: vscode.TextDocument,
        workspaceRoot: string
    ): Promise<HeaderOwnerContext> {
        const text = safeReadFile(ownerFile);
        if (text === undefined) {
            return emptyHeaderOwnerContext(true);
        }

        const ownerDocument = createSyntheticDocument(ownerFile, text);
        const scanned = this.scanner.scan(ownerDocument.uri.toString(), 1, text);
        const include = await this.findIncludeForHeader(ownerDocument, scanned.includeReferences, headerDocument, workspaceRoot);
        if (!include) {
            return emptyHeaderOwnerContext(true);
        }

        const prefixText = text.slice(0, include.startOffset);
        const prefixDocument = createSyntheticDocument(ownerFile, prefixText, 100000 + include.startOffset);
        const prefixSemantic = this.getSemanticSnapshot(prefixDocument);
        if (!prefixSemantic || prefixSemantic.degraded) {
            return emptyHeaderOwnerContext(true);
        }

        const context = {
            macros: [...(prefixSemantic.macroDefinitions ?? [])],
            functions: [...prefixSemantic.exportedFunctions],
            fileGlobals: [...(prefixSemantic.fileGlobals ?? [])],
            types: [...prefixSemantic.typeDefinitions],
            isAmbiguous: false
        };
        const dependencyContext = await this.collectIncludedSemanticContext(
            prefixDocument,
            prefixSemantic.includeStatements,
            workspaceRoot,
            new Set<string>()
        );

        context.macros.push(...dependencyContext.macros);
        context.functions.push(...dependencyContext.functions);
        context.fileGlobals.push(...dependencyContext.fileGlobals);
        context.types.push(...dependencyContext.types);
        context.isAmbiguous = dependencyContext.isAmbiguous;

        return context;
    }

    private async findIncludeForHeader(
        ownerDocument: vscode.TextDocument,
        includes: readonly { value: string; isSystemInclude: boolean; startOffset: number }[],
        headerDocument: vscode.TextDocument,
        workspaceRoot: string
    ): Promise<{ startOffset: number } | undefined> {
        const headerPath = normalizePath(headerDocument.uri.fsPath);
        for (const include of includes) {
            const candidates = await this.pathSupport.resolveIncludeFilePaths(
                ownerDocument,
                include.value,
                include.isSystemInclude,
                workspaceRoot
            );
            const resolved = candidates.find((candidate) => this.pathSupport.fileExists(candidate));
            if (resolved && normalizePath(resolved) === headerPath) {
                return include;
            }
        }

        return undefined;
    }

    private async collectIncludedSemanticContext(
        ownerDocument: vscode.TextDocument,
        includeStatements: readonly IncludeDirective[],
        workspaceRoot: string,
        visited: Set<string>
    ): Promise<HeaderOwnerContext> {
        const context = emptyHeaderOwnerContext(false);

        for (const includeStatement of includeStatements) {
            const candidates = await this.pathSupport.resolveIncludeFilePaths(
                ownerDocument,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot
            );
            const includeFile = candidates.find((candidate) => this.pathSupport.fileExists(candidate));
            if (!includeFile) {
                context.isAmbiguous = true;
                continue;
            }

            const normalized = normalizePath(includeFile);
            if (visited.has(normalized)) {
                continue;
            }
            visited.add(normalized);

            const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
            if (!includeDocument) {
                context.isAmbiguous = true;
                continue;
            }

            const semantic = this.getSemanticSnapshot(includeDocument);
            if (!semantic || semantic.degraded) {
                context.isAmbiguous = true;
                continue;
            }

            context.macros.push(...(semantic.macroDefinitions ?? []));
            context.functions.push(...semantic.exportedFunctions.map((summary) => ({ ...summary, origin: 'include' as const })));
            context.fileGlobals.push(...(semantic.fileGlobals ?? []));
            context.types.push(...semantic.typeDefinitions);

            const nestedContext = await this.collectIncludedSemanticContext(
                includeDocument,
                semantic.includeStatements,
                workspaceRoot,
                visited
            );
            context.macros.push(...nestedContext.macros);
            context.functions.push(...nestedContext.functions);
            context.fileGlobals.push(...nestedContext.fileGlobals);
            context.types.push(...nestedContext.types);
            context.isAmbiguous = context.isAmbiguous || nestedContext.isAmbiguous;
        }

        return context;
    }

    private getSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot | undefined {
        try {
            return this.analysisService.getSemanticSnapshot(document, false);
        } catch {
            return undefined;
        }
    }
}

function emptyHeaderOwnerContext(isAmbiguous: boolean): HeaderOwnerContext {
    return {
        macros: [],
        functions: [],
        fileGlobals: [],
        types: [],
        isAmbiguous
    };
}

function listTranslationUnitFiles(workspaceRoot: string): string[] {
    const results: string[] = [];
    const visit = (directory: string): void => {
        const entries = safeReadDirectory(directory);
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!IGNORED_DIRECTORIES.has(entry.name)) {
                    visit(entryPath);
                }
                continue;
            }

            if (entry.isFile() && entry.name.endsWith('.c')) {
                results.push(entryPath);
            }
        }
    };

    visit(workspaceRoot);
    return results;
}

function safeReadDirectory(directory: string): fs.Dirent[] {
    try {
        return fs.readdirSync(directory, { withFileTypes: true });
    } catch {
        return [];
    }
}

function safeReadFile(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return undefined;
    }
}

function createSyntheticDocument(filePath: string, content: string, version = 1): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    return {
        uri: vscode.Uri.file(filePath),
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: () => content,
        lineAt: (line: number) => ({ text: lines[line] ?? '' })
    } as unknown as vscode.TextDocument;
}

function isHeaderDocument(document: vscode.TextDocument): boolean {
    return isHeaderPath(document.uri.fsPath);
}

function isHeaderPath(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.h');
}

function isOwnerRelevantPath(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.c') || lower.endsWith('.h');
}

function normalizePath(filePath: string): string {
    return path.normalize(filePath)
        .replace(/\\/g, '/')
        .replace(/^\/+([a-z]:\/)/i, '$1')
        .toLowerCase();
}

const IGNORED_DIRECTORIES = new Set([
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
