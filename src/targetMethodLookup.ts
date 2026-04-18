import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SymbolType } from './ast/symbolTable';
import { MacroManager } from './macroManager';
import type { LpcProjectConfigService } from './projectConfig/LpcProjectConfigService';
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

type TargetMethodAnalysisService = Pick<DocumentAnalysisService, 'getSemanticSnapshot'>;

let configuredTargetMethodLookupAnalysisService: TargetMethodAnalysisService | undefined;

export function configureTargetMethodLookupAnalysisService(service?: TargetMethodAnalysisService): void {
    configuredTargetMethodLookupAnalysisService = service;
}

export class TargetMethodLookup {
    private readonly analysisService: TargetMethodAnalysisService;

    constructor(
        private readonly macroManager?: MacroManager,
        private readonly projectConfigService?: LpcProjectConfigService,
        analysisService?: TargetMethodAnalysisService
    ) {
        this.analysisService = analysisService ?? requireTargetMethodLookupAnalysisService();
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
        const resolvedTargetPath = this.resolveWorkspaceFilePath(currentDocument, targetFilePath);
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
            : await this.tryOpenTextDocument(resolvedTargetPath);
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
                location: new vscode.Location(targetDocument.uri, directRange.start),
                declarationRange: directRange
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
            const inheritedFile = this.resolveInheritedFilePath(targetDocument, inheritStatement.value);
            if (!inheritedFile || !fs.existsSync(inheritedFile) || visitedFiles.has(inheritedFile)) {
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
            const includeFiles = await this.resolveIncludeFilePaths(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude
            );

            for (const includeFile of includeFiles) {
                if (!fs.existsSync(includeFile)) {
                    continue;
                }

                const includeDocument = await this.tryOpenTextDocument(includeFile);
                if (!includeDocument) {
                    continue;
                }

                const declarationRange = this.findFunctionRangeInSemanticSnapshot(
                    includeDocument,
                    methodName,
                    options?.useFreshSnapshots === true ? false : true
                );
                if (declarationRange) {
                    return {
                        path: includeDocument.uri.fsPath,
                        document: includeDocument,
                        location: new vscode.Location(includeDocument.uri, declarationRange.start),
                        declarationRange
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
    ): vscode.Range | undefined {
        const symbol = this.getSemanticSnapshot(document, useCache).symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        if (!symbol) {
            return undefined;
        }

        return symbol.selectionRange ?? symbol.range;
    }

    private getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.analysisService.getSemanticSnapshot(document, useCache);
    }

    private async resolveIncludeFilePaths(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean
    ): Promise<string[]> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return [];
        }

        let normalizedPath = includePath;
        normalizedPath = this.ensureHeaderOrSourceExtension(normalizedPath);

        if (isSystemInclude) {
            const includeDirectories = await this.getIncludeDirectories(workspaceFolder.uri.fsPath);
            return includeDirectories.map((includeDirectory) => path.join(includeDirectory, normalizedPath));
        }

        if (path.isAbsolute(normalizedPath)) {
            const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
            return [path.join(workspaceFolder.uri.fsPath, relativePath)];
        }

        return [path.resolve(path.dirname(document.uri.fsPath), normalizedPath)];
    }

    private async getIncludeDirectories(workspaceRoot: string): Promise<string[]> {
        const configuredDirectories = await this.projectConfigService?.getIncludeDirectoriesForWorkspace(workspaceRoot);
        if (configuredDirectories?.length) {
            return configuredDirectories;
        }

        return [path.join(workspaceRoot, 'include')];
    }

    private resolveInheritedFilePath(document: vscode.TextDocument, inheritValue: string): string | undefined {
        let resolvedValue = inheritValue;
        if (/^[A-Z_][A-Z0-9_]*$/.test(resolvedValue)) {
            const macro = this.macroManager?.getMacro(resolvedValue);
            if (!macro?.value) {
                return undefined;
            }

            resolvedValue = macro.value.replace(/^"(.*)"$/, '$1');
        }

        resolvedValue = this.ensureExtension(resolvedValue, '.c');

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return path.join(workspaceFolder.uri.fsPath, resolvedValue.substring(1));
        }

        return path.resolve(path.dirname(document.uri.fsPath), resolvedValue);
    }
    private resolveWorkspaceFilePath(document: vscode.TextDocument, filePath: string): string | undefined {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return path.join(workspaceFolder.uri.fsPath, relativePath);
    }

    private ensureHeaderOrSourceExtension(filePath: string): string {
        if (filePath.endsWith('.h') || filePath.endsWith('.c')) {
            return filePath;
        }

        return `${filePath}.h`;
    }

    private ensureExtension(filePath: string, extension: '.c' | '.h'): string {
        return filePath.endsWith(extension) ? filePath : `${filePath}${extension}`;
    }

    private async tryOpenTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument | undefined> {
        try {
            if (typeof target === 'string') {
                return await vscode.workspace.openTextDocument(target);
            }

            return await vscode.workspace.openTextDocument(target);
        } catch {
            return undefined;
        }
    }
}

function requireTargetMethodLookupAnalysisService(): TargetMethodAnalysisService {
    if (!configuredTargetMethodLookupAnalysisService) {
        throw new Error('Target method lookup analysis service has not been configured');
    }

    return configuredTargetMethodLookupAnalysisService;
}
