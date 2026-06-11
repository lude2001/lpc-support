import * as fs from 'fs';
import * as vscode from 'vscode';
import {
    IncludeGraph,
    IncludeReferenceFact,
    PreprocessorDiagnostic
} from './types';
import { resolveIncludePathCandidates } from '../language/shared/includePathResolution';

export interface IncludeResolutionResult {
    includeReferences: IncludeReferenceFact[];
    includeGraph: IncludeGraph;
    diagnostics: PreprocessorDiagnostic[];
}

export interface IncludeResolverOptions {
    includeDirectories?: string[];
    workspaceRoot?: string;
}

export class IncludeResolver {
    private readonly includeDirectories: string[];
    private readonly workspaceRoot: string | undefined;

    constructor(options: IncludeResolverOptions | string[] = {}) {
        if (Array.isArray(options)) {
            this.includeDirectories = options;
            this.workspaceRoot = undefined;
            return;
        }

        this.includeDirectories = options.includeDirectories ?? [];
        this.workspaceRoot = options.workspaceRoot;
    }

    public resolve(
        documentUri: string,
        includeReferences: IncludeReferenceFact[]
    ): IncludeResolutionResult {
        const documentPath = normalizeFsPath(vscode.Uri.parse(documentUri).fsPath);
        const diagnostics: PreprocessorDiagnostic[] = [];
        const resolvedReferences = includeReferences.map((include) => {
            const resolvedPath = this.resolveIncludePath(include, documentPath);
            if (!resolvedPath) {
                diagnostics.push({
                    code: 'preprocessor.includeNotFound',
                    message: `Include file not found: ${include.value}`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    range: include.range
                });
                return { ...include };
            }

            return {
                ...include,
                resolvedUri: vscode.Uri.file(resolvedPath).toString()
            };
        });

        return {
            includeReferences: resolvedReferences,
            includeGraph: {
                rootUri: documentUri,
                edges: resolvedReferences.map((include) => ({
                    fromUri: documentUri,
                    includeValue: include.value,
                    toUri: include.resolvedUri
                }))
            },
            diagnostics
        };
    }

    private resolveIncludePath(include: IncludeReferenceFact, documentPath: string): string | undefined {
        const candidates = resolveIncludePathCandidates({
            documentPath,
            includePath: include.value,
            isSystemInclude: include.isSystemInclude,
            workspaceRoot: this.workspaceRoot,
            includeDirectories: this.includeDirectories,
            allowAncestorFallback: true
        });
        return candidates.find((candidate) => fs.existsSync(candidate));
    }
}

function normalizeFsPath(fsPath: string): string {
    return fsPath.replace(/^\/+([A-Za-z]:\/)/, '$1');
}
