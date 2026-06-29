import * as path from 'path';
import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { CallableSourceKind, DocumentCallableDocs } from '../language/documentation/types';
import type { LanguageWorkspaceProjectConfig } from '../language/contracts/LanguageWorkspaceContext';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from '../language/shared/WorkspaceDocumentPathSupport';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import type { IncludeDirective } from '../semantic/documentSemanticTypes';
import type { RawFunctionDocLookup, RawFunctionDocSource } from './FunctionDocLookupTypes';

export interface FunctionDocLookupBuilderOptions {
    documentationService?: FunctionDocumentationService;
    analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
}

export interface FunctionDocLookupBuildOptions {
    forceFresh?: boolean;
    projectConfig?: LanguageWorkspaceProjectConfig;
}

export class FunctionDocLookupBuilder {
    private readonly documentationService: FunctionDocumentationService;
    private readonly analysisService: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    private readonly pathSupport: WorkspaceDocumentPathSupport;

    public constructor(options: FunctionDocLookupBuilderOptions) {
        this.documentationService = assertDocumentationService('FunctionDocLookupBuilder', options.documentationService);
        this.analysisService = assertAnalysisService('FunctionDocLookupBuilder', options.analysisService);
        this.pathSupport = assertDocumentPathSupport('FunctionDocLookupBuilder', options.pathSupport);
    }

    public async buildLookup(
        document: vscode.TextDocument,
        options?: FunctionDocLookupBuildOptions
    ): Promise<RawFunctionDocLookup> {
        const snapshot = this.analysisService.getSemanticSnapshot(document, options?.forceFresh === true ? false : true);
        const inheritedFiles = snapshot.inheritStatements.map((statement) => statement.value);

        return {
            inheritedFiles,
            currentFile: this.buildRawSource(document, '当前文件', 'local', options),
            inheritedGroups: await this.loadInheritedFileDocs(document, inheritedFiles, options),
            includeGroups: await this.loadIncludeFileDocs(document, snapshot.includeStatements, options)
        };
    }

    private buildRawSource(
        document: vscode.TextDocument,
        source: string,
        sourceKind: CallableSourceKind,
        options?: FunctionDocLookupBuildOptions
    ): RawFunctionDocSource {
        if (options?.forceFresh) {
            this.documentationService.invalidate(document.uri.toString());
        }

        return {
            source,
            filePath: document.fileName,
            sourceKind,
            docs: this.documentationService.getDocumentDocs(document)
        };
    }

    private async loadInheritedFileDocs(
        document: vscode.TextDocument,
        inheritedFiles: readonly string[],
        options?: FunctionDocLookupBuildOptions
    ): Promise<RawFunctionDocSource[]> {
        const inheritedSources: RawFunctionDocSource[] = [];
        if (!inheritedFiles.length) {
            return inheritedSources;
        }

        const workspaceRoot = this.pathSupport.getWorkspaceRoot(document);

        for (const inheritPath of inheritedFiles) {
            const resolvedPath = this.pathSupport.resolveInheritedFilePath(
                document,
                inheritPath,
                workspaceRoot,
                options?.projectConfig
            );
            if (!resolvedPath) {
                continue;
            }

            const candidatePaths = path.extname(resolvedPath)
                ? [resolvedPath, resolvedPath.replace(/\.c$/, '')]
                : [resolvedPath];

            for (const candidatePath of candidatePaths) {
                try {
                    if (!this.pathSupport.fileExists(candidatePath)) {
                        continue;
                    }

                    const inheritedDocument = await this.pathSupport.tryOpenTextDocument(candidatePath);
                    if (!inheritedDocument) {
                        continue;
                    }

                    inheritedSources.push(
                        this.buildRawSource(
                            inheritedDocument,
                            `继承自 ${path.basename(candidatePath)}`,
                            'inherit',
                            options
                        )
                    );
                    break;
                } catch (error) {
                    console.error(`加载继承文件失败: ${candidatePath}`, error);
                }
            }
        }

        return inheritedSources;
    }

    private async loadIncludeFileDocs(
        document: vscode.TextDocument,
        includeStatements: readonly IncludeDirective[],
        options?: FunctionDocLookupBuildOptions
    ): Promise<RawFunctionDocSource[]> {
        const includeSources: RawFunctionDocSource[] = [];
        const includeFiles = await this.getIncludeFiles(document, includeStatements, options?.projectConfig);

        for (const includeFile of includeFiles) {
            if (!includeFile.endsWith('.h') && !includeFile.endsWith('.c')) {
                continue;
            }

            const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
            if (!includeDocument) {
                continue;
            }

            includeSources.push(
                this.buildRawSource(
                    includeDocument,
                    `包含自 ${path.basename(includeFile)}`,
                    'include',
                    options
                )
            );
        }

        return includeSources;
    }

    private async getIncludeFiles(
        document: vscode.TextDocument,
        includeStatements: readonly IncludeDirective[],
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string[]> {
        const includeFiles: string[] = [];
        const workspaceRoot = this.pathSupport.getWorkspaceRoot(document);

        for (const includeStatement of includeStatements) {
            const includePath = includeStatement.value;
            const candidatePaths = await this.pathSupport.resolveIncludeFilePaths(
                document,
                includePath,
                includeStatement.isSystemInclude,
                workspaceRoot,
                projectConfig
            );

            const fallbackPaths = !path.extname(includePath)
                ? candidatePaths.map((candidatePath) => candidatePath.replace(/\.h$/, ''))
                : [];

            for (const filePath of [...candidatePaths, ...fallbackPaths]) {
                if (this.pathSupport.fileExists(filePath)) {
                    includeFiles.push(filePath);
                    break;
                }
            }
        }

        return includeFiles;
    }
}
