import * as path from 'path';
import * as vscode from 'vscode';
import type { ProjectSymbolIndex } from '../../completion/projectSymbolIndex';
import type {
    FileSymbolRecord,
    FileGlobalSummary,
    FunctionSummary,
    IncludeDirective,
    MacroDefinitionSummary,
    TypeDefinitionSummary
} from '../../semantic/documentSemanticTypes';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import { getDocumentWorkspaceProjectConfig } from './documentWorkspaceConfig';
import { HeaderOwnerIndexService } from './HeaderOwnerIndexService';
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
    private readonly disposables: vscode.Disposable[] = [];
    private readonly ownerIndexService: HeaderOwnerIndexService;

    public constructor(
        private readonly pathSupport: WorkspaceDocumentPathSupport,
        private readonly analysisService: HeaderOwnerAnalysisService,
        private readonly projectSymbolIndex: ProjectSymbolIndex,
        ownerIndexService?: HeaderOwnerIndexService
    ) {
        this.ownerIndexService = ownerIndexService
            ?? new HeaderOwnerIndexService(pathSupport, analysisService, projectSymbolIndex);
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

        const projectConfig = getDocumentWorkspaceProjectConfig(document);
        await this.ownerIndexService.warmOwnersForHeader(document, projectConfig);
        const ownerRecords = this.projectSymbolIndex.getOwnersIncluding(document.uri.toString());
        if (ownerRecords.length === 0) {
            return emptyHeaderOwnerContext(true);
        }

        if (ownerRecords.length > 1) {
            return emptyHeaderOwnerContext(true);
        }

        return this.collectOwnerContextBeforeInclude(ownerRecords[0], document, workspaceRoot);
    }

    public clear(): void {
        this.ownerIndexService.clear();
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

        this.clear();
    }

    private async collectOwnerContextBeforeInclude(
        ownerRecord: FileSymbolRecord,
        headerDocument: vscode.TextDocument,
        workspaceRoot: string
    ): Promise<HeaderOwnerContext> {
        const ownerDocument = await this.pathSupport.tryOpenTextDocument(vscode.Uri.parse(ownerRecord.uri));
        if (!ownerDocument) {
            return emptyHeaderOwnerContext(true);
        }

        const include = this.findIncludeForHeader(ownerRecord, headerDocument);
        if (!include) {
            return emptyHeaderOwnerContext(true);
        }

        const ownerText = ownerDocument.getText();
        const includeStartOffset = offsetAt(ownerDocument, include.range.start, ownerText);
        const prefixText = ownerText.slice(0, includeStartOffset);
        const prefixDocument = createSyntheticDocument(
            ownerDocument.uri.fsPath,
            prefixText,
            ownerDocument.version,
            createOwnerPrefixCacheKey(ownerDocument.uri.fsPath, includeStartOffset)
        );
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
            getDocumentWorkspaceProjectConfig(headerDocument),
            new Set<string>()
        );

        context.macros.push(...dependencyContext.macros);
        context.functions.push(...dependencyContext.functions);
        context.fileGlobals.push(...dependencyContext.fileGlobals);
        context.types.push(...dependencyContext.types);
        context.isAmbiguous = dependencyContext.isAmbiguous;

        return context;
    }

    private findIncludeForHeader(
        ownerRecord: FileSymbolRecord,
        headerDocument: vscode.TextDocument
    ): IncludeDirective | undefined {
        const headerUri = normalizeUri(headerDocument.uri.toString());
        return ownerRecord.includeStatements.find((includeStatement) =>
            includeStatement.resolvedUri && normalizeUri(includeStatement.resolvedUri) === headerUri
        );
    }

    private async collectIncludedSemanticContext(
        ownerDocument: vscode.TextDocument,
        includeStatements: readonly IncludeDirective[],
        workspaceRoot: string,
        projectConfig: ReturnType<typeof getDocumentWorkspaceProjectConfig>,
        visited: Set<string>
    ): Promise<HeaderOwnerContext> {
        const context = emptyHeaderOwnerContext(false);

        for (const includeStatement of includeStatements) {
            const candidates = await this.pathSupport.resolveIncludeFilePaths(
                ownerDocument,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot,
                projectConfig
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
                projectConfig,
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
            return this.analysisService.getSemanticSnapshot(document, 'cacheFirst');
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

function createSyntheticDocument(
    filePath: string,
    content: string,
    version = 1,
    uriCacheKey?: string
): vscode.TextDocument {
    const lines = content.split(/\r?\n/);
    return {
        uri: createSyntheticUri(filePath, uriCacheKey),
        fileName: filePath,
        languageId: 'lpc',
        version,
        lineCount: lines.length,
        getText: () => content,
        lineAt: (line: number) => ({ text: lines[line] ?? '' })
    } as unknown as vscode.TextDocument;
}

function createSyntheticUri(filePath: string, cacheKey?: string): vscode.Uri {
    const uri = vscode.Uri.file(filePath);
    if (!cacheKey) {
        return uri;
    }

    return {
        scheme: uri.scheme,
        authority: uri.authority,
        path: uri.path,
        query: uri.query,
        fragment: uri.fragment,
        fsPath: uri.fsPath,
        with: (change: Parameters<vscode.Uri['with']>[0]) => uri.with(change),
        toJSON: () => uri.toJSON(),
        toString: () => cacheKey
    } as unknown as vscode.Uri;
}

function createOwnerPrefixCacheKey(ownerFile: string, includeOffset: number): string {
    return `${vscode.Uri.file(ownerFile).toString()}#header-owner-prefix:${includeOffset}`;
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

function normalizeUri(uri: string): string {
    return uri.toLowerCase();
}

function offsetAt(document: vscode.TextDocument, position: vscode.Position, text: string): number {
    const documentWithOffsetAt = document as vscode.TextDocument & {
        offsetAt?: (position: vscode.Position) => number;
    };
    if (typeof documentWithOffsetAt.offsetAt === 'function') {
        return documentWithOffsetAt.offsetAt(position);
    }

    let offset = 0;
    const lines = text.split(/\r?\n/);
    for (let line = 0; line < position.line && line < lines.length; line += 1) {
        offset += lines[line].length + 1;
    }

    return Math.min(offset + position.character, text.length);
}
