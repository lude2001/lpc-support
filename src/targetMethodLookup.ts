import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { SymbolType } from './ast/symbolTable';
import { ASTManager } from './ast/astManager';
import { MacroManager } from './macroManager';
import type { LpcProjectConfigService } from './projectConfig/LpcProjectConfigService';
import { SemanticSnapshot } from './semantic/semanticSnapshot';

export interface ResolvedTargetMethod {
    path: string;
    document: vscode.TextDocument;
    location: vscode.Location;
}

export class TargetMethodLookup {
    private readonly astManager = ASTManager.getInstance();

    constructor(
        private readonly macroManager?: MacroManager,
        private readonly projectConfigService?: LpcProjectConfigService
    ) {}

    public async findMethod(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<ResolvedTargetMethod | undefined> {
        return this.findMethodRecursive(currentDocument, targetFilePath, methodName, new Set<string>());
    }

    private async findMethodRecursive(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string,
        visitedFiles: Set<string>
    ): Promise<ResolvedTargetMethod | undefined> {
        const resolvedTargetPath = this.resolveWorkspaceFilePath(currentDocument, targetFilePath);
        if (!resolvedTargetPath || visitedFiles.has(resolvedTargetPath)) {
            return undefined;
        }

        visitedFiles.add(resolvedTargetPath);
        return this.resolveMethodRecursive(currentDocument, resolvedTargetPath, methodName, visitedFiles);
    }

    private async resolveMethodRecursive(
        currentDocument: vscode.TextDocument,
        resolvedTargetPath: string,
        methodName: string,
        visitedFiles: Set<string>
    ): Promise<ResolvedTargetMethod | undefined> {
        const targetDocument = path.resolve(resolvedTargetPath) === path.resolve(currentDocument.uri.fsPath)
            ? currentDocument
            : await this.tryOpenTextDocument(resolvedTargetPath);
        if (!targetDocument) {
            return undefined;
        }

        const directLocation = this.findFunctionInSemanticSnapshot(targetDocument, methodName);
        if (directLocation) {
            return {
                path: targetDocument.uri.fsPath,
                document: targetDocument,
                location: directLocation
            };
        }

        const includeLocation = await this.findMethodInIncludedFiles(targetDocument, methodName);
        if (includeLocation) {
            return includeLocation;
        }

        for (const inheritStatement of this.getSemanticSnapshot(targetDocument).inheritStatements) {
            const inheritedFile = this.resolveInheritedFilePath(targetDocument, inheritStatement.value);
            if (!inheritedFile || !fs.existsSync(inheritedFile) || visitedFiles.has(inheritedFile)) {
                continue;
            }

            const inheritedLocation = await this.findMethodRecursive(
                targetDocument,
                inheritedFile,
                methodName,
                visitedFiles
            );
            if (inheritedLocation) {
                return inheritedLocation;
            }
        }

        return undefined;
    }

    private async findMethodInIncludedFiles(
        document: vscode.TextDocument,
        methodName: string
    ): Promise<ResolvedTargetMethod | undefined> {
        for (const includeStatement of this.getSemanticSnapshot(document).includeStatements) {
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

                const location = this.findFunctionInSemanticSnapshot(includeDocument, methodName);
                if (location) {
                    return {
                        path: includeDocument.uri.fsPath,
                        document: includeDocument,
                        location
                    };
                }
            }
        }

        return undefined;
    }

    private findFunctionInSemanticSnapshot(document: vscode.TextDocument, functionName: string): vscode.Location | undefined {
        const symbol = this.getSemanticSnapshot(document).symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        if (!symbol) {
            return undefined;
        }

        const targetRange = symbol.selectionRange ?? symbol.range;
        return new vscode.Location(document.uri, targetRange.start);
    }

    private getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.astManager.getSemanticSnapshot(document, useCache);
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
