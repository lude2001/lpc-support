import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    IncludeGraph,
    IncludeReferenceFact,
    PreprocessorDiagnostic
} from './types';

export interface IncludeResolutionResult {
    includeReferences: IncludeReferenceFact[];
    includeGraph: IncludeGraph;
    diagnostics: PreprocessorDiagnostic[];
}

export class IncludeResolver {
    constructor(private readonly includeDirectories: string[] = []) {}

    public resolve(
        documentUri: string,
        includeReferences: IncludeReferenceFact[]
    ): IncludeResolutionResult {
        const documentPath = normalizeFsPath(vscode.Uri.parse(documentUri).fsPath);
        const documentDirectory = path.dirname(documentPath);
        const diagnostics: PreprocessorDiagnostic[] = [];
        const resolvedReferences = includeReferences.map((include) => {
            const resolvedPath = this.resolveIncludePath(include, documentDirectory);
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

    private resolveIncludePath(include: IncludeReferenceFact, documentDirectory: string): string | undefined {
        const candidates = include.isSystemInclude
            ? this.includeDirectories.map((directory) => path.join(directory, include.value))
            : [
                path.resolve(documentDirectory, include.value),
                ...this.includeDirectories.map((directory) => path.join(directory, include.value))
            ];

        return candidates.find((candidate) => fs.existsSync(candidate));
    }
}

function normalizeFsPath(fsPath: string): string {
    return fsPath.replace(/^\/+([A-Za-z]:\/)/, '$1');
}
