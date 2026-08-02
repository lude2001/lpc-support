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
import type {
    FunctionDocLookupDiagnostic,
    RawFunctionDocLookup,
    RawFunctionDocSource
} from './FunctionDocLookupTypes';

export interface FunctionDocLookupBuilderOptions {
    documentationService?: FunctionDocumentationService;
    analysisService?: Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;
    pathSupport?: WorkspaceDocumentPathSupport;
}

export interface FunctionDocLookupBuildOptions {
    forceFresh?: boolean;
    projectConfig?: LanguageWorkspaceProjectConfig;
    cancellationToken?: Pick<vscode.CancellationToken, 'isCancellationRequested'>;
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
        const diagnostics: FunctionDocLookupDiagnostic[] = [];

        return {
            inheritedFiles,
            currentFile: this.buildRawSource(document, '当前文件', 'local', options),
            inheritedGroups: await this.loadInheritedFileDocs(document, inheritedFiles, options, diagnostics),
            includeGroups: await this.loadIncludeFileDocs(document, snapshot.includeStatements, options, diagnostics),
            diagnostics
        };
    }

    private buildRawSource(
        document: vscode.TextDocument,
        source: string,
        sourceKind: CallableSourceKind,
        options?: FunctionDocLookupBuildOptions,
        relation?: { depth: number; parentFilePath: string }
    ): RawFunctionDocSource {
        if (options?.forceFresh) {
            this.documentationService.invalidate(document.uri.toString());
        }

        return {
            source,
            filePath: document.fileName,
            sourceKind,
            docs: this.documentationService.getDocumentDocs(document),
            depth: relation?.depth,
            parentFilePath: relation?.parentFilePath
        };
    }

    private async loadInheritedFileDocs(
        document: vscode.TextDocument,
        inheritedFiles: readonly string[],
        options?: FunctionDocLookupBuildOptions,
        diagnostics: FunctionDocLookupDiagnostic[] = []
    ): Promise<RawFunctionDocSource[]> {
        const inheritedSources: RawFunctionDocSource[] = [];
        const workspaceRoot = this.pathSupport.getWorkspaceRoot(document);
        const visited = new Set<string>([normalizeFileIdentity(document.fileName)]);
        const queue = inheritedFiles.map((inheritPath) => ({
            document,
            inheritPath,
            depth: 1,
            ancestors: new Set([normalizeFileIdentity(document.fileName)])
        }));

        while (queue.length > 0) {
            if (recordCancellation(options, document.fileName, diagnostics)) {
                break;
            }
            const item = queue.shift()!;
            const resolvedPath = this.pathSupport.resolveInheritedFilePath(
                item.document,
                item.inheritPath,
                workspaceRoot,
                options?.projectConfig
            );
            if (!resolvedPath) {
                diagnostics.push({
                    stage: 'inheritance',
                    code: 'inherit-target-unresolved',
                    sourceFilePath: item.document.fileName,
                    target: item.inheritPath,
                    message: `无法解析继承目标: ${item.inheritPath}`
                });
                continue;
            }

            const candidatePaths = path.extname(resolvedPath)
                ? [resolvedPath, resolvedPath.replace(/\.c$/, '')]
                : [resolvedPath];

            let loaded = false;
            for (const candidatePath of candidatePaths) {
                try {
                    if (!this.pathSupport.fileExists(candidatePath)) {
                        continue;
                    }
                    const identity = normalizeFileIdentity(candidatePath);
                    if (visited.has(identity)) {
                        if (item.ancestors.has(identity)) {
                            diagnostics.push({
                                stage: 'inheritance',
                                code: 'inherit-cycle',
                                sourceFilePath: item.document.fileName,
                                target: item.inheritPath,
                                message: `检测到继承循环: ${item.inheritPath}`
                            });
                        }
                        loaded = true;
                        break;
                    }

                    const inheritedDocument = await this.pathSupport.tryOpenTextDocument(candidatePath);
                    if (!inheritedDocument) {
                        continue;
                    }
                    visited.add(identity);
                    loaded = true;

                    inheritedSources.push(
                        this.buildRawSource(
                            inheritedDocument,
                            `继承自 ${path.basename(candidatePath)}`,
                            'inherit',
                            options,
                            { depth: item.depth, parentFilePath: item.document.fileName }
                        )
                    );
                    const inheritedSnapshot = this.analysisService.getSemanticSnapshot(
                        inheritedDocument,
                        options?.forceFresh === true ? false : true
                    );
                    for (const nested of inheritedSnapshot.inheritStatements) {
                        queue.push({
                            document: inheritedDocument,
                            inheritPath: nested.value,
                            depth: item.depth + 1,
                            ancestors: new Set([...item.ancestors, identity])
                        });
                    }
                    break;
                } catch (error) {
                    console.error(`加载继承文件失败: ${candidatePath}`, error);
                    diagnostics.push({
                        stage: 'inheritance',
                        code: 'dependency-analysis-failed',
                        sourceFilePath: item.document.fileName,
                        target: item.inheritPath,
                        message: `无法完整分析继承依赖: ${item.inheritPath}`
                    });
                    loaded = true;
                    break;
                }
            }
            if (!loaded) {
                diagnostics.push({
                    stage: 'inheritance',
                    code: 'dependency-open-failed',
                    sourceFilePath: item.document.fileName,
                    target: item.inheritPath,
                    message: `无法打开继承文件: ${item.inheritPath}`
                });
            }
        }

        return inheritedSources;
    }

    private async loadIncludeFileDocs(
        document: vscode.TextDocument,
        includeStatements: readonly IncludeDirective[],
        options?: FunctionDocLookupBuildOptions,
        diagnostics: FunctionDocLookupDiagnostic[] = []
    ): Promise<RawFunctionDocSource[]> {
        const includeSources: RawFunctionDocSource[] = [];
        const visited = new Set<string>([normalizeFileIdentity(document.fileName)]);
        const queue = includeStatements.map((includeStatement) => ({
            document,
            includeStatement,
            depth: 1,
            ancestors: new Set([normalizeFileIdentity(document.fileName)])
        }));

        while (queue.length > 0) {
            if (recordCancellation(options, document.fileName, diagnostics)) {
                break;
            }
            const item = queue.shift()!;
            const includeFile = await this.resolveIncludeFile(
                item.document,
                item.includeStatement,
                options?.projectConfig
            );
            if (!includeFile) {
                diagnostics.push({
                    stage: 'include',
                    code: 'include-target-unresolved',
                    sourceFilePath: item.document.fileName,
                    target: item.includeStatement.value,
                    message: `无法解析包含目标: ${item.includeStatement.value}`
                });
                continue;
            }
            if (!includeFile.endsWith('.h') && !includeFile.endsWith('.c')) {
                continue;
            }
            const identity = normalizeFileIdentity(includeFile);
            if (visited.has(identity)) {
                if (item.ancestors.has(identity)) {
                    diagnostics.push({
                        stage: 'include',
                        code: 'include-cycle',
                        sourceFilePath: item.document.fileName,
                        target: item.includeStatement.value,
                        message: `检测到包含循环: ${item.includeStatement.value}`
                    });
                }
                continue;
            }

            try {
                const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
                if (!includeDocument) {
                    diagnostics.push({
                        stage: 'include',
                        code: 'dependency-open-failed',
                        sourceFilePath: item.document.fileName,
                        target: includeFile,
                        message: `无法打开包含文件: ${item.includeStatement.value}`
                    });
                    continue;
                }
                visited.add(identity);

                includeSources.push(
                    this.buildRawSource(
                        includeDocument,
                        `包含自 ${path.basename(includeFile)}`,
                        'include',
                        options,
                        { depth: item.depth, parentFilePath: item.document.fileName }
                    )
                );
                const includeSnapshot = this.analysisService.getSemanticSnapshot(
                    includeDocument,
                    options?.forceFresh === true ? false : true
                );
                for (const nested of includeSnapshot.includeStatements) {
                    queue.push({
                        document: includeDocument,
                        includeStatement: nested,
                        depth: item.depth + 1,
                        ancestors: new Set([...item.ancestors, identity])
                    });
                }
            } catch (error) {
                console.error(`加载包含文件失败: ${includeFile}`, error);
                diagnostics.push({
                    stage: 'include',
                    code: 'dependency-analysis-failed',
                    sourceFilePath: item.document.fileName,
                    target: item.includeStatement.value,
                    message: `无法完整分析包含依赖: ${item.includeStatement.value}`
                });
            }
        }

        return includeSources;
    }

    private async resolveIncludeFile(
        document: vscode.TextDocument,
        includeStatement: IncludeDirective,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        const workspaceRoot = this.pathSupport.getWorkspaceRoot(document);
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
                return filePath;
            }
        }
        return undefined;
    }
}

function recordCancellation(
    options: FunctionDocLookupBuildOptions | undefined,
    sourceFilePath: string,
    diagnostics: FunctionDocLookupDiagnostic[]
): boolean {
    if (options?.cancellationToken?.isCancellationRequested !== true) {
        return false;
    }
    if (!diagnostics.some((diagnostic) => diagnostic.code === 'analysis-cancelled')) {
        diagnostics.push({
            stage: 'analysis',
            code: 'analysis-cancelled',
            sourceFilePath,
            target: '',
            message: '函数文档依赖分析已取消。'
        });
    }
    return true;
}

function normalizeFileIdentity(filePath: string): string {
    const normalized = path.resolve(filePath).replace(/\\/g, '/');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}
