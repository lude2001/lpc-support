import * as vscode from 'vscode';
import { DefinitionResolverSupport } from './DefinitionResolverSupport';
import type { DefinitionRequestState, DefinitionSemanticAdapter } from './types';

interface FunctionFamilyDefinitionResolverDependencies {
    support: Pick<
        DefinitionResolverSupport,
        | 'findFunctionInSemanticSnapshot'
        | 'getSemanticSnapshot'
        | 'findInherits'
        | 'openInheritedDocument'
        | 'getIncludeFiles'
        | 'getHeaderFunctionIndex'
        | 'openWorkspaceDocument'
        | 'toVsCodeLocation'
    >;
    semanticAdapter?: DefinitionSemanticAdapter;
}

export class FunctionFamilyDefinitionResolver {
    public constructor(private readonly dependencies: FunctionFamilyDefinitionResolverDependencies) {}

    public async resolve(
        document: vscode.TextDocument,
        word: string,
        requestState: DefinitionRequestState
    ): Promise<vscode.Location | undefined> {
        await this.findFunctionDefinitions(document, requestState);

        if (!requestState.functionDefinitions.has(word)) {
            await this.findInheritedFunctionDefinitions(document, requestState);
        }

        if (!requestState.functionDefinitions.has(word)) {
            const includeLocation = await this.findFunctionInCurrentFileIncludes(document, word);
            if (includeLocation) {
                return includeLocation;
            }
        }

        return requestState.functionDefinitions.get(word);
    }

    private async findFunctionDefinitions(
        document: vscode.TextDocument,
        requestState: DefinitionRequestState
    ): Promise<void> {
        const adaptedFunctionNames = this.dependencies.semanticAdapter?.getExportedFunctionNames?.(document);
        if (adaptedFunctionNames) {
            for (const functionName of adaptedFunctionNames) {
                const location = this.dependencies.semanticAdapter?.findFunctionLocation?.(document, functionName);
                if (location) {
                    requestState.functionDefinitions.set(functionName, this.dependencies.support.toVsCodeLocation(location));
                }
            }
            return;
        }

        const snapshot = this.dependencies.support.getSemanticSnapshot(document);
        for (const functionSummary of snapshot.exportedFunctions) {
            const location = this.dependencies.support.findFunctionInSemanticSnapshot(document, functionSummary.name);
            if (location) {
                requestState.functionDefinitions.set(functionSummary.name, location);
            }
        }
    }

    private async findInheritedFunctionDefinitions(
        document: vscode.TextDocument,
        requestState: DefinitionRequestState
    ): Promise<void> {
        const inherits = this.dependencies.support.findInherits(document);

        for (const inheritValue of inherits) {
            const inheritedDocument = await this.dependencies.support.openInheritedDocument(document, inheritValue, requestState);
            if (!inheritedDocument) {
                continue;
            }

            await this.findFunctionDefinitions(inheritedDocument, requestState);
            await this.findInheritedFunctionDefinitions(inheritedDocument, requestState);
        }
    }

    private async findFunctionInCurrentFileIncludes(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<vscode.Location | undefined> {
        const includeFiles = await this.dependencies.support.getIncludeFiles(document.uri.fsPath);
        let functionImplementation: vscode.Location | undefined;
        let functionPrototype: vscode.Location | undefined;

        for (const includeFile of includeFiles) {
            if (includeFile.endsWith('.h')) {
                const location = (await this.dependencies.support.getHeaderFunctionIndex(includeFile)).get(functionName);
                if (location && !functionPrototype) {
                    functionPrototype = location;
                }

                continue;
            }

            const location = await this.findMethodInFile(document, includeFile, functionName);
            if (location) {
                functionImplementation = location;
            }
        }

        return functionImplementation || functionPrototype;
    }

    private async findMethodInFile(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        if (targetFilePath === currentDocument.uri.fsPath) {
            return this.dependencies.support.findFunctionInSemanticSnapshot(currentDocument, methodName);
        }

        const targetDoc = await this.dependencies.support.openWorkspaceDocument(currentDocument, targetFilePath);
        return targetDoc ? this.dependencies.support.findFunctionInSemanticSnapshot(targetDoc, methodName) : undefined;
    }
}
