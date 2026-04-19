import * as path from 'path';
import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { DocumentCallableDocs } from '../language/documentation/types';
import type { MacroManager } from '../macroManager';
import { WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import type { RawFunctionDocLookup, RawFunctionDocSource } from './FunctionDocLookupTypes';

export interface FunctionDocLookupBuilderOptions {
    documentationService?: FunctionDocumentationService;
    macroManager?: Pick<MacroManager, 'getMacro'>;
    pathSupport?: WorkspaceDocumentPathSupport;
}

export class FunctionDocLookupBuilder {
    private readonly documentationService: FunctionDocumentationService;
    private readonly pathSupport: WorkspaceDocumentPathSupport;

    public constructor(options: FunctionDocLookupBuilderOptions = {}) {
        this.documentationService = assertDocumentationService('FunctionDocLookupBuilder', options.documentationService);
        this.pathSupport = options.pathSupport ?? new WorkspaceDocumentPathSupport({
            macroManager: options.macroManager
        });
    }

    public async buildLookup(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<RawFunctionDocLookup> {
        const inheritedFiles = this.parseInheritStatements(document.getText());

        return {
            inheritedFiles,
            currentFile: this.buildRawSource(document, '当前文件', options),
            inheritedGroups: await this.loadInheritedFileDocs(document, inheritedFiles, options),
            includeGroups: await this.loadIncludeFileDocs(document, options)
        };
    }

    private buildRawSource(
        document: vscode.TextDocument,
        source: string,
        options?: { forceFresh?: boolean }
    ): RawFunctionDocSource {
        if (options?.forceFresh) {
            this.documentationService.invalidate(document.uri.toString());
        }

        return {
            source,
            filePath: document.fileName,
            docs: this.documentationService.getDocumentDocs(document)
        };
    }

    private parseInheritStatements(content: string): string[] {
        const inheritFiles: string[] = [];
        const inheritPattern = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*;/g;

        let match: RegExpExecArray | null;
        while ((match = inheritPattern.exec(content)) !== null) {
            const inheritPath = (match[1] || match[2])?.trim();
            if (inheritPath) {
                inheritFiles.push(inheritPath);
            }
        }

        return inheritFiles;
    }

    private async loadInheritedFileDocs(
        document: vscode.TextDocument,
        inheritedFiles: readonly string[],
        options?: { forceFresh?: boolean }
    ): Promise<RawFunctionDocSource[]> {
        const inheritedSources: RawFunctionDocSource[] = [];
        if (!inheritedFiles.length) {
            return inheritedSources;
        }

        const workspaceRoot = this.pathSupport.getWorkspaceRoot(document);

        for (const inheritPath of inheritedFiles) {
            const resolvedPath = this.pathSupport.resolveInheritedFilePath(document, inheritPath, workspaceRoot);
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
        options?: { forceFresh?: boolean }
    ): Promise<RawFunctionDocSource[]> {
        const includeSources: RawFunctionDocSource[] = [];
        const includeFiles = await this.getIncludeFiles(document);

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
                    options
                )
            );
        }

        return includeSources;
    }

    private async getIncludeFiles(document: vscode.TextDocument): Promise<string[]> {
        const includeFiles: string[] = [];
        const content = document.getText();
        const workspaceRoot = this.pathSupport.getWorkspaceRoot(document);
        const includeRegex = /^\s*#?include\s+([<"])([^\s">]+)[>"](?:\s*\/\/.*)?$/gm;

        let match: RegExpExecArray | null;
        while ((match = includeRegex.exec(content)) !== null) {
            const isSystemInclude = match[1] === '<';
            const includePath = match[2];
            const candidatePaths = await this.pathSupport.resolveIncludeFilePaths(
                document,
                includePath,
                isSystemInclude,
                workspaceRoot
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
