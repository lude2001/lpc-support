import * as path from 'path';
import * as vscode from 'vscode';
import { SymbolType } from './ast/symbolTable';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from './language/shared/WorkspaceDocumentPathSupport';
import type { DocumentAnalysisService } from './semantic/documentAnalysisService';
import { SemanticSnapshot } from './semantic/semanticSnapshot';

export interface ResolvedTargetMethod {
    path: string;
    document: vscode.TextDocument;
    location: vscode.Location;
    declarationRange: vscode.Range;
}

export interface TargetMethodLookupOptions {
    useFreshSnapshots?: boolean;
}

interface ResolvedFunctionRange {
    declarationRange: vscode.Range;
    navigationRange: vscode.Range;
}

type TargetMethodAnalysisService = Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;

export class TargetMethodLookup {
    private readonly analysisService: TargetMethodAnalysisService;
    private readonly pathSupport: WorkspaceDocumentPathSupport;

    constructor(
        analysisService: TargetMethodAnalysisService,
        pathSupport?: WorkspaceDocumentPathSupport
    ) {
        this.analysisService = analysisService;
        this.pathSupport = assertDocumentPathSupport('TargetMethodLookup', pathSupport);
    }

    public async findMethod(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        return this.findMethodRecursive(currentDocument, targetFilePath, methodName, new Set<string>(), options);
    }

    private async findMethodRecursive(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string,
        visitedFiles: Set<string>,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(currentDocument);
        const resolvedTargetPath = this.pathSupport.resolveWorkspaceFilePath(currentDocument, targetFilePath, workspaceRoot);
        if (!resolvedTargetPath || visitedFiles.has(resolvedTargetPath)) {
            return undefined;
        }

        visitedFiles.add(resolvedTargetPath);
        return this.resolveMethodRecursive(currentDocument, resolvedTargetPath, methodName, visitedFiles, options);
    }

    private async resolveMethodRecursive(
        currentDocument: vscode.TextDocument,
        resolvedTargetPath: string,
        methodName: string,
        visitedFiles: Set<string>,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        const targetDocument = path.resolve(resolvedTargetPath) === path.resolve(currentDocument.uri.fsPath)
            ? currentDocument
            : await this.pathSupport.tryOpenTextDocument(resolvedTargetPath);
        if (!targetDocument) {
            return undefined;
        }

        const directRange = this.findFunctionRangeInSemanticSnapshot(
            targetDocument,
            methodName,
            options?.useFreshSnapshots === true ? false : true
        );
        if (directRange) {
            return {
                path: targetDocument.uri.fsPath,
                document: targetDocument,
                location: new vscode.Location(targetDocument.uri, directRange.navigationRange),
                declarationRange: directRange.declarationRange
            };
        }

        const includeLocation = await this.findMethodInIncludedFiles(targetDocument, methodName, options);
        if (includeLocation) {
            return includeLocation;
        }

        for (const inheritStatement of this.getSemanticSnapshot(
            targetDocument,
            options?.useFreshSnapshots === true ? false : true
        ).inheritStatements) {
            const workspaceRoot = this.pathSupport.getWorkspaceFolderRoot(targetDocument);
            const inheritedFile = this.pathSupport.resolveInheritedFilePath(targetDocument, inheritStatement.value, workspaceRoot);
            if (!inheritedFile || !this.pathSupport.fileExists(inheritedFile) || visitedFiles.has(inheritedFile)) {
                continue;
            }

            const inheritedLocation = await this.findMethodRecursive(
                targetDocument,
                inheritedFile,
                methodName,
                visitedFiles,
                options
            );
            if (inheritedLocation) {
                return inheritedLocation;
            }
        }

        return undefined;
    }

    private async findMethodInIncludedFiles(
        document: vscode.TextDocument,
        methodName: string,
        options?: TargetMethodLookupOptions
    ): Promise<ResolvedTargetMethod | undefined> {
        for (const includeStatement of this.getSemanticSnapshot(
            document,
            options?.useFreshSnapshots === true ? false : true
        ).includeStatements) {
            const includeFiles = await this.pathSupport.resolveIncludeFilePaths(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                this.pathSupport.getWorkspaceFolderRoot(document)
            );

            for (const includeFile of includeFiles) {
                if (!this.pathSupport.fileExists(includeFile)) {
                    continue;
                }

                const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
                if (!includeDocument) {
                    continue;
                }

                const functionRange = this.findFunctionRangeInSemanticSnapshot(
                    includeDocument,
                    methodName,
                    options?.useFreshSnapshots === true ? false : true
                );
                if (functionRange) {
                    return {
                        path: includeDocument.uri.fsPath,
                        document: includeDocument,
                        location: new vscode.Location(includeDocument.uri, functionRange.navigationRange),
                        declarationRange: functionRange.declarationRange
                    };
                }
            }
        }

        return undefined;
    }

    private findFunctionRangeInSemanticSnapshot(
        document: vscode.TextDocument,
        functionName: string,
        useCache: boolean = true
    ): ResolvedFunctionRange | undefined {
        const symbol = this.getSemanticSnapshot(document, useCache).symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        if (!symbol) {
            return undefined;
        }

        return {
            declarationRange: symbol.range,
            navigationRange: symbol.selectionRange ?? symbol.range
        };
    }

    private getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.analysisService.getSemanticSnapshot(document, useCache);
    }
}
