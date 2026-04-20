import * as path from 'path';
import * as vscode from 'vscode';
import { SymbolType } from '../../../../ast/symbolTable';
import { EfunDocsManager } from '../../../../efunDocs';
import { MacroManager } from '../../../../macroManager';
import { resolveVisibleSymbol } from '../../../../symbolReferenceResolver';
import type { LanguageWorkspaceProjectConfig } from '../../../contracts/LanguageWorkspaceContext';
import { DefinitionResolverSupport } from './DefinitionResolverSupport';
import type { DefinitionRequestState, DefinitionSemanticAdapter } from './types';

interface DirectSymbolDefinitionResolverDependencies {
    support: DefinitionResolverSupport;
    macroManager: MacroManager;
    efunDocsManager: Pick<EfunDocsManager, 'getSimulatedDoc'>;
    semanticAdapter?: DefinitionSemanticAdapter;
}

export class DirectSymbolDefinitionResolver {
    public constructor(private readonly dependencies: DirectSymbolDefinitionResolverDependencies) {}

    public async resolve(
        document: vscode.TextDocument,
        position: vscode.Position,
        word: string,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig,
        requestState?: DefinitionRequestState
    ): Promise<vscode.Location | undefined> {
        const includeResult = await this.handleIncludeDefinition(document, position, workspaceRoot, projectConfig);
        if (includeResult) {
            return includeResult;
        }

        const macroDefinition = await this.findMacroDefinition(word);
        if (macroDefinition) {
            return macroDefinition;
        }

        const simulatedEfunDefinition = await this.findSimulatedEfunDefinition(word, workspaceRoot, projectConfig);
        if (simulatedEfunDefinition) {
            return simulatedEfunDefinition;
        }

        return this.findVariableDefinition(word, document, position, requestState ?? this.dependencies.support.createRequestState());
    }

    private async handleIncludeDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const includeStatement = this.dependencies.support.getIncludeStatements(document)
            .find((statement) => statement.range.contains(position));

        if (!includeStatement) {
            return undefined;
        }

        const targetPath = await this.dependencies.support.resolveIncludeFilePath(
            document,
            includeStatement.value,
            includeStatement.isSystemInclude,
            workspaceRoot,
            projectConfig
        );
        if (!targetPath || !this.dependencies.support.fileExists(targetPath)) {
            return undefined;
        }

        return new vscode.Location(
            vscode.Uri.file(targetPath),
            new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
        );
    }

    private async findMacroDefinition(word: string): Promise<vscode.Location | undefined> {
        const macro = this.dependencies.macroManager.getMacroAsync
            ? await this.dependencies.macroManager.getMacroAsync(word)
            : this.dependencies.macroManager.getMacro?.(word);
        if (!macro) {
            return undefined;
        }

        const macroDoc = await this.dependencies.support.tryOpenTextDocument(vscode.Uri.file(macro.file));
        if (!macroDoc) {
            return undefined;
        }

        const startPos = new vscode.Position(macro.line - 1, 0);
        const endPos = new vscode.Position(macro.line - 1, macroDoc.lineAt(macro.line - 1).text.length);
        return new vscode.Location(vscode.Uri.file(macro.file), new vscode.Range(startPos, endPos));
    }

    private async findSimulatedEfunDefinition(
        word: string,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const simulatedDoc = 'getSimulatedDocAsync' in this.dependencies.efunDocsManager
            ? await (this.dependencies.efunDocsManager as EfunDocsManager & {
                getSimulatedDocAsync(funcName: string): Promise<ReturnType<EfunDocsManager['getSimulatedDoc']>>;
            }).getSimulatedDocAsync(word)
            : this.dependencies.efunDocsManager.getSimulatedDoc(word);
        if (!simulatedDoc) {
            return undefined;
        }

        const simulatedDocLocation = this.toSimulatedDocLocation(simulatedDoc);
        if (simulatedDocLocation) {
            return simulatedDocLocation;
        }

        const configuredFile = await this.dependencies.support.getConfiguredSimulatedEfunFile(workspaceRoot, projectConfig);
        return configuredFile
            ? this.findFunctionInSimulatedEfunGraph(configuredFile, word, projectConfig)
            : undefined;
    }

    private toSimulatedDocLocation(simulatedDoc: { sourceFile?: string; sourceRange?: { start: { line: number; character: number }; end: { line: number; character: number } } }): vscode.Location | undefined {
        if (!simulatedDoc.sourceFile || !simulatedDoc.sourceRange) {
            return undefined;
        }

        return new vscode.Location(
            vscode.Uri.file(simulatedDoc.sourceFile),
            new vscode.Range(
                simulatedDoc.sourceRange.start.line,
                simulatedDoc.sourceRange.start.character,
                simulatedDoc.sourceRange.end.line,
                simulatedDoc.sourceRange.end.character
            )
        );
    }

    private async findFunctionInSimulatedEfunGraph(
        entryFile: string,
        functionName: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const queue = [entryFile];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentFile = queue.shift()!;
            const normalizedFile = path.normalize(currentFile);
            if (visited.has(normalizedFile)) {
                continue;
            }

            visited.add(normalizedFile);

            const document = await this.dependencies.support.tryOpenTextDocument(currentFile);
            if (!document) {
                continue;
            }

            const location = this.dependencies.support.findFunctionInSemanticSnapshot(document, functionName);
            if (location) {
                return location;
            }

            for (const includeFile of await this.dependencies.support.resolveExistingIncludeFiles(document, projectConfig)) {
                const normalizedInclude = path.normalize(includeFile);
                if (!visited.has(normalizedInclude)) {
                    queue.push(includeFile);
                }
            }

            for (const inheritStatement of this.dependencies.support.findInherits(document)) {
                const inheritedFile = this.dependencies.support.resolveInheritedFilePath(document, inheritStatement);
                if (!inheritedFile || !this.dependencies.support.fileExists(inheritedFile)) {
                    continue;
                }

                const normalizedInherited = path.normalize(inheritedFile);
                if (!visited.has(normalizedInherited)) {
                    queue.push(inheritedFile);
                }
            }
        }

        return undefined;
    }

    private async findVariableDefinition(
        variableName: string,
        document: vscode.TextDocument,
        position: vscode.Position,
        requestState: DefinitionRequestState
    ): Promise<vscode.Location | undefined> {
        const adaptedVisibleLocation = this.dependencies.semanticAdapter?.resolveVisibleVariableLocation?.(document, variableName, position);
        if (adaptedVisibleLocation) {
            return this.dependencies.support.toVsCodeLocation(adaptedVisibleLocation);
        }

        const snapshot = this.dependencies.support.getSemanticSnapshot(document);
        const visibleSymbol = resolveVisibleSymbol(snapshot.symbolTable, variableName, position);
        if (visibleSymbol && this.isVariableLikeSymbol(visibleSymbol.type)) {
            return this.dependencies.support.toSymbolLocation(document.uri, visibleSymbol);
        }

        return this.findInheritedVariableDefinition(document, variableName, requestState);
    }

    private async findInheritedVariableDefinition(
        document: vscode.TextDocument,
        variableName: string,
        requestState: DefinitionRequestState
    ): Promise<vscode.Location | undefined> {
        const snapshot = this.dependencies.support.getSemanticSnapshot(document);
        for (const inheritStatement of snapshot.inheritStatements) {
            const inheritedDoc = await this.dependencies.support.openInheritedDocument(document, inheritStatement.value, requestState);
            if (!inheritedDoc) {
                continue;
            }

            const inheritedSnapshot = this.dependencies.support.getSemanticSnapshot(inheritedDoc);
            const inheritedSymbol = inheritedSnapshot.symbolTable
                .getAllSymbols()
                .find((symbol) => this.isVariableLikeSymbol(symbol.type) && symbol.name === variableName && symbol.scope.name === 'global');

            if (inheritedSymbol) {
                return this.dependencies.support.toSymbolLocation(inheritedDoc.uri, inheritedSymbol);
            }

            const nestedInheritedVarDef = await this.findInheritedVariableDefinition(inheritedDoc, variableName, requestState);
            if (nestedInheritedVarDef) {
                return nestedInheritedVarDef;
            }
        }

        return undefined;
    }

    private isVariableLikeSymbol(type: SymbolType): boolean {
        return type === SymbolType.VARIABLE || type === SymbolType.PARAMETER;
    }
}
