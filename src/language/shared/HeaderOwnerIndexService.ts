import * as path from 'path';
import * as vscode from 'vscode';
import type { ProjectSymbolIndex } from '../../completion/projectSymbolIndex';
import type { IncludeDirective } from '../../semantic/documentSemanticTypes';
import type { DocumentAnalysisService } from '../../semantic/documentAnalysisService';
import type { SemanticSnapshot } from '../../semantic/semanticSnapshot';
import type { LanguageWorkspaceProjectConfig } from '../contracts/LanguageWorkspaceContext';
import { getDocumentWorkspaceProjectConfig } from './documentWorkspaceConfig';
import type { WorkspaceDocumentPathSupport } from './WorkspaceDocumentPathSupport';

type HeaderOwnerIndexAnalysisService = Pick<
    DocumentAnalysisService,
    'getSemanticSnapshot'
> & Partial<Pick<DocumentAnalysisService, 'getBestAvailableSemanticSnapshot'>>;

export class HeaderOwnerIndexService {
    private readonly warmedHeaders = new Set<string>();

    public constructor(
        private readonly pathSupport: WorkspaceDocumentPathSupport,
        private readonly analysisService: HeaderOwnerIndexAnalysisService,
        private readonly projectSymbolIndex: ProjectSymbolIndex
    ) {}

    public async warmOwnersForHeader(
        headerDocument: vscode.TextDocument,
        projectConfig: LanguageWorkspaceProjectConfig | undefined = getDocumentWorkspaceProjectConfig(headerDocument)
    ): Promise<void> {
        const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(headerDocument)
            ?? this.resolveWorkspaceRootFromProjectConfig(projectConfig);
        if (!workspaceRoot) {
            return;
        }

        const headerKey = `${normalizeFsPath(workspaceRoot)}:${normalizeFsPath(headerDocument.uri.fsPath)}`;
        if (this.warmedHeaders.has(headerKey) && this.projectSymbolIndex.getOwnersIncluding(headerDocument.uri.toString()).length > 0) {
            return;
        }

        for (const ownerFile of await this.pathSupport.findWorkspaceSourceFiles(workspaceRoot, '.c')) {
            const ownerDocument = await this.pathSupport.tryOpenTextDocument(ownerFile);
            if (!ownerDocument) {
                continue;
            }

            const analysisDocument = createContentVersionedDocument(ownerDocument);
            this.projectSymbolIndex.removeFile(analysisDocument.uri.toString());
            const ownerSemantic = this.getSemanticSnapshot(analysisDocument);
            if (!ownerSemantic || ownerSemantic.degraded) {
                continue;
            }

            const resolvedIncludes = await this.resolveIncludeStatements(
                analysisDocument,
                ownerSemantic.includeStatements,
                workspaceRoot,
                projectConfig
            );

            this.projectSymbolIndex.updateFromSemanticSnapshot({
                ...ownerSemantic,
                includeStatements: resolvedIncludes
            });
        }

        this.warmedHeaders.add(headerKey);
    }

    public clear(): void {
        this.warmedHeaders.clear();
    }

    private async resolveIncludeStatements(
        ownerDocument: vscode.TextDocument,
        includeStatements: readonly IncludeDirective[],
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<IncludeDirective[]> {
        const resolvedStatements: IncludeDirective[] = [];

        for (const includeStatement of includeStatements) {
            if (includeStatement.resolvedUri) {
                resolvedStatements.push({ ...includeStatement });
                continue;
            }

            const candidates = await this.pathSupport.resolveIncludeFilePaths(
                ownerDocument,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot,
                projectConfig
            );
            const includeFile = candidates.find((candidate) => this.pathSupport.fileExists(candidate));
            resolvedStatements.push({
                ...includeStatement,
                resolvedUri: includeFile ? vscode.Uri.file(includeFile).toString() : undefined
            });
        }

        return resolvedStatements;
    }

    private getSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot | undefined {
        try {
            return this.analysisService.getSemanticSnapshot(document, 'cacheFirst');
        } catch {
            try {
                return this.analysisService.getBestAvailableSemanticSnapshot?.(document);
            } catch {
                return undefined;
            }
        }
    }

    private resolveWorkspaceRootFromProjectConfig(
        projectConfig?: LanguageWorkspaceProjectConfig
    ): string | undefined {
        return projectConfig?.projectConfigPath
            ? path.dirname(projectConfig.projectConfigPath)
            : undefined;
    }
}

function normalizeFsPath(filePath: string): string {
    return path.normalize(filePath)
        .replace(/\\/g, '/')
        .toLowerCase();
}

function createContentVersionedDocument(document: vscode.TextDocument): vscode.TextDocument {
    const text = document.getText();
    const lineStarts = buildLineStarts(text);
    return {
        uri: document.uri,
        fileName: document.fileName,
        languageId: document.languageId,
        version: hashTextVersion(text),
        lineCount: document.lineCount,
        isDirty: document.isDirty ?? false,
        isClosed: document.isClosed ?? false,
        isUntitled: document.isUntitled ?? false,
        eol: document.eol ?? vscode.EndOfLine.LF,
        getText: (range?: vscode.Range) => document.getText(range),
        lineAt: (line: number | vscode.Position) => document.lineAt(line as never),
        offsetAt: (position: vscode.Position) => typeof document.offsetAt === 'function'
            ? document.offsetAt(position)
            : offsetAt(lineStarts, position),
        positionAt: (offset: number) => typeof document.positionAt === 'function'
            ? document.positionAt(offset)
            : positionAt(lineStarts, offset),
        save: () => typeof document.save === 'function' ? document.save() : Promise.resolve(true),
        validateRange: (range: vscode.Range) => typeof document.validateRange === 'function'
            ? document.validateRange(range)
            : range,
        validatePosition: (position: vscode.Position) => typeof document.validatePosition === 'function'
            ? document.validatePosition(position)
            : position
    } as vscode.TextDocument;
}

function hashTextVersion(text: string): number {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function buildLineStarts(text: string): number[] {
    const lineStarts = [0];
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === '\n') {
            lineStarts.push(index + 1);
        }
    }

    return lineStarts;
}

function offsetAt(lineStarts: readonly number[], position: vscode.Position): number {
    const lineStart = lineStarts[position.line] ?? lineStarts[lineStarts.length - 1] ?? 0;
    return lineStart + position.character;
}

function positionAt(lineStarts: readonly number[], offset: number): vscode.Position {
    let line = 0;
    for (let index = 0; index < lineStarts.length; index += 1) {
        if (lineStarts[index] <= offset) {
            line = index;
        } else {
            break;
        }
    }

    return new vscode.Position(line, offset - lineStarts[line]);
}
