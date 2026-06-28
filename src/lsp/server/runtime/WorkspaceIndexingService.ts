import * as vscode from 'vscode';
import type { ProjectSymbolIndex } from '../../../completion/projectSymbolIndex';
import type { IncludeDirective } from '../../../semantic/documentSemanticTypes';
import type { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import type { DocumentAnalysisService } from '../../../semantic/documentAnalysisService';
import type { LanguageWorkspaceProjectConfig } from '../../../language/contracts/LanguageWorkspaceContext';
import type { WorkspaceDocumentPathSupport } from '../../../language/shared/WorkspaceDocumentPathSupport';
import type {
    WorkspaceIndexProgressPayload,
    WorkspaceIndexRebuildParams,
    WorkspaceIndexRebuildResult
} from '../../shared/protocol/workspaceIndex';

type WorkspaceIndexAnalysisService = Pick<
    DocumentAnalysisService,
    'getSemanticSnapshot'
> & Partial<Pick<DocumentAnalysisService, 'getBestAvailableSemanticSnapshot'>>;

export interface WorkspaceIndexingServiceOptions {
    readonly analysisService: WorkspaceIndexAnalysisService;
    readonly pathSupport: WorkspaceDocumentPathSupport;
    readonly projectSymbolIndex: ProjectSymbolIndex;
}

const INDEXED_EXTENSIONS = ['.c', '.h', '.lpc'] as const;
const PROGRESS_REPORT_INTERVAL = 20;

export class WorkspaceIndexingService {
    public constructor(private readonly options: WorkspaceIndexingServiceOptions) {}

    public async rebuild(
        params: WorkspaceIndexRebuildParams,
        onProgress?: (progress: WorkspaceIndexProgressPayload) => void | Promise<void>
    ): Promise<WorkspaceIndexRebuildResult> {
        const startedAt = Date.now();
        const workspacesByRoot = new Map(params.workspaces.map(workspace => [normalizePath(workspace.workspaceRoot), workspace]));
        const files = await this.collectWorkspaceFiles(params.workspaceRoots);
        this.options.projectSymbolIndex.clear();
        let indexedFiles = 0;
        let skippedFiles = 0;
        let failedFiles = 0;
        let processedFiles = 0;

        await reportProgress(onProgress, {
            status: 'building',
            totalFiles: files.length,
            processedFiles,
            indexedFiles,
            skippedFiles,
            failedFiles
        });

        for (const filePath of files) {
            const document = await this.options.pathSupport.tryOpenTextDocument(filePath);
            if (!document) {
                skippedFiles += 1;
                processedFiles += 1;
                await reportProgressIfNeeded(
                    onProgress,
                    files.length,
                    processedFiles,
                    indexedFiles,
                    skippedFiles,
                    failedFiles
                );
                continue;
            }

            const semantic = this.getSemanticSnapshot(document);
            if (!semantic || semantic.degraded) {
                skippedFiles += 1;
                processedFiles += 1;
                await reportProgressIfNeeded(
                    onProgress,
                    files.length,
                    processedFiles,
                    indexedFiles,
                    skippedFiles,
                    failedFiles
                );
                continue;
            }

            try {
                const workspaceRoot = this.options.pathSupport.getWorkspaceFolderRoot(document);
                const projectConfig = workspaceRoot
                    ? workspacesByRoot.get(normalizePath(workspaceRoot))
                    : undefined;
                const includeStatements = await this.resolveIncludeStatements(
                    document,
                    semantic,
                    workspaceRoot,
                    projectConfig
                );

                this.options.projectSymbolIndex.updateFromSemanticSnapshot({
                    ...semantic,
                    includeStatements
                });
                indexedFiles += 1;
            } catch {
                failedFiles += 1;
            }
            processedFiles += 1;
            await reportProgressIfNeeded(
                onProgress,
                files.length,
                processedFiles,
                indexedFiles,
                skippedFiles,
                failedFiles
            );
        }

        await reportProgress(onProgress, {
            status: 'building',
            totalFiles: files.length,
            processedFiles,
            indexedFiles,
            skippedFiles,
            failedFiles
        });

        return {
            status: 'ready',
            totalFiles: files.length,
            indexedFiles,
            skippedFiles,
            failedFiles,
            durationMs: Date.now() - startedAt
        };
    }

    private async collectWorkspaceFiles(workspaceRoots: readonly string[]): Promise<string[]> {
        const result: string[] = [];
        const seen = new Set<string>();

        for (const workspaceRoot of workspaceRoots) {
            for (const extension of INDEXED_EXTENSIONS) {
                const files = await this.options.pathSupport.findWorkspaceSourceFiles(workspaceRoot, extension);
                for (const filePath of files) {
                    const normalizedPath = normalizePath(filePath);
                    if (seen.has(normalizedPath)) {
                        continue;
                    }

                    seen.add(normalizedPath);
                    result.push(filePath);
                }
            }
        }

        return result;
    }

    private getSemanticSnapshot(document: vscode.TextDocument): SemanticSnapshot | undefined {
        try {
            return this.options.analysisService.getSemanticSnapshot(document, false);
        } catch {
            try {
                return this.options.analysisService.getBestAvailableSemanticSnapshot?.(document);
            } catch {
                return undefined;
            }
        }
    }

    private async resolveIncludeStatements(
        document: vscode.TextDocument,
        semantic: SemanticSnapshot,
        workspaceRoot: string | undefined,
        projectConfig: LanguageWorkspaceProjectConfig | undefined
    ): Promise<IncludeDirective[]> {
        const resolvedStatements: IncludeDirective[] = [];

        for (const includeStatement of semantic.includeStatements) {
            if (includeStatement.resolvedUri) {
                resolvedStatements.push({ ...includeStatement });
                continue;
            }

            const includeFiles = await this.options.pathSupport.resolveIncludeFilePaths(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot,
                projectConfig
            );
            const includeFile = includeFiles.find(filePath => this.options.pathSupport.fileExists(filePath));
            resolvedStatements.push({
                ...includeStatement,
                resolvedUri: includeFile ? vscode.Uri.file(includeFile).toString() : undefined
            });
        }

        return resolvedStatements;
    }
}

function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
}

async function reportProgressIfNeeded(
    onProgress: ((progress: WorkspaceIndexProgressPayload) => void | Promise<void>) | undefined,
    totalFiles: number,
    processedFiles: number,
    indexedFiles: number,
    skippedFiles: number,
    failedFiles: number
): Promise<void> {
    if (
        processedFiles !== totalFiles
        && processedFiles % PROGRESS_REPORT_INTERVAL !== 0
    ) {
        return;
    }

    await reportProgress(onProgress, {
        status: 'building',
        totalFiles,
        processedFiles,
        indexedFiles,
        skippedFiles,
        failedFiles
    });
}

async function reportProgress(
    onProgress: ((progress: WorkspaceIndexProgressPayload) => void | Promise<void>) | undefined,
    progress: WorkspaceIndexProgressPayload
): Promise<void> {
    if (onProgress) {
        await onProgress(progress);
    }
}
