import * as path from 'path';
import * as vscode from 'vscode';
import { SymbolType } from '../../../../ast/symbolTable';
import { getTypeLookupName } from '../../../../ast/typeNormalization';
import { EfunDocsManager } from '../../../../efunDocs';
import { MacroManager } from '../../../../macroManager';
import { TypeDefinitionSummary } from '../../../../semantic/documentSemanticTypes';
import { SyntaxKind, SyntaxNode } from '../../../../syntax/types';
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

        const localMacroDefinition = this.findLocalMacroDefinition(document, word);
        if (localMacroDefinition) {
            return localMacroDefinition;
        }

        const macroDefinition = await this.findMacroDefinition(word);
        if (macroDefinition) {
            return macroDefinition;
        }

        const simulatedEfunDefinition = await this.findSimulatedEfunDefinition(word, workspaceRoot, projectConfig);
        if (simulatedEfunDefinition) {
            return simulatedEfunDefinition;
        }

        const explicitMemberDefinition = await this.findExplicitTypeMemberDefinition(
            document,
            position,
            word,
            projectConfig
        );
        if (explicitMemberDefinition) {
            return explicitMemberDefinition;
        }

        return this.findVariableDefinition(
            word,
            document,
            position,
            this.dependencies.support.createRequestState()
        );
    }

    private findLocalMacroDefinition(document: vscode.TextDocument, word: string): vscode.Location | undefined {
        const snapshot = this.dependencies.support.getSemanticSnapshot(document);
        const macro = snapshot.macroDefinitions?.find((definition) => definition.name === word);
        if (!macro) {
            return undefined;
        }

        return new vscode.Location(document.uri, macro.range);
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

    private toSimulatedDocLocation(simulatedDoc: { sourcePath?: string; sourceRange?: { start: { line: number; character: number }; end: { line: number; character: number } } }): vscode.Location | undefined {
        if (!simulatedDoc.sourcePath || !simulatedDoc.sourceRange) {
            return undefined;
        }

        return new vscode.Location(
            vscode.Uri.file(simulatedDoc.sourcePath),
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

    private async findExplicitTypeMemberDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        memberName: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const snapshot = this.dependencies.support.getSemanticSnapshot(document);
        if (!snapshot.syntax?.nodes) {
            return undefined;
        }

        const memberAccess = snapshot.syntax.nodes.find((node) =>
            node.kind === SyntaxKind.MemberAccessExpression &&
            node.range.contains(position) &&
            this.isMemberIdentifierAtPosition(node, memberName, position)
        );
        if (!memberAccess) {
            return undefined;
        }

        const receiver = memberAccess.children[0];
        const receiverChain = receiver ? this.collectMemberReceiverChain(receiver) : [];
        if (receiverChain.length === 0) {
            return undefined;
        }

        const rootSymbol = resolveVisibleSymbol(snapshot.symbolTable, receiverChain[0], position);
        if (!rootSymbol) {
            return undefined;
        }

        const visibleTypes = await this.collectVisibleTypeDefinitions(document, projectConfig);
        let currentType = getTypeLookupName(rootSymbol.dataType);
        for (const segment of receiverChain.slice(1)) {
            const intermediateDefinition = this.findTypeDefinition(visibleTypes, currentType);
            const intermediateMember = intermediateDefinition?.members.find((candidate) => candidate.name === segment);
            if (!intermediateMember) {
                return undefined;
            }

            currentType = getTypeLookupName(intermediateMember.dataType);
        }

        const definition = this.findTypeDefinition(visibleTypes, currentType);
        const member = definition?.members.find((candidate) => candidate.name === memberName);
        if (!definition || !member) {
            return undefined;
        }

        return new vscode.Location(this.toSourceUri(definition.sourceUri), member.selectionRange ?? member.range);
    }

    private isMemberIdentifierAtPosition(
        memberAccess: SyntaxNode,
        memberName: string,
        position: vscode.Position
    ): boolean {
        const member = memberAccess.children[1];
        return member?.kind === SyntaxKind.Identifier &&
            member.name === memberName &&
            member.range.contains(position);
    }

    private collectMemberReceiverChain(node: SyntaxNode): string[] {
        if (node.kind === SyntaxKind.Identifier && node.name) {
            return [node.name];
        }

        if (node.kind !== SyntaxKind.MemberAccessExpression) {
            return [];
        }

        const receiver = node.children[0];
        const member = node.children[1];
        if (!receiver || member?.kind !== SyntaxKind.Identifier || !member.name) {
            return [];
        }

        const receiverChain = this.collectMemberReceiverChain(receiver);
        return receiverChain.length > 0 ? [...receiverChain, member.name] : [];
    }

    private findTypeDefinition(
        typeDefinitions: readonly TypeDefinitionSummary[],
        typeName: string
    ): TypeDefinitionSummary | undefined {
        const lookupName = getTypeLookupName(typeName);
        return typeDefinitions.find((definition) =>
            definition.name === lookupName ||
            getTypeLookupName(definition.name) === lookupName
        );
    }

    private async collectVisibleTypeDefinitions(
        document: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig,
        visited: Set<string> = new Set()
    ): Promise<TypeDefinitionSummary[]> {
        const documentKey = this.normalizeDocumentKey(document);
        if (visited.has(documentKey)) {
            return [];
        }

        visited.add(documentKey);
        const snapshot = this.dependencies.support.getSemanticSnapshot(document);
        const definitions: TypeDefinitionSummary[] = [...snapshot.typeDefinitions];

        for (const includeDocument of await this.openIncludedDocuments(document, projectConfig)) {
            definitions.push(...await this.collectVisibleTypeDefinitions(includeDocument, projectConfig, visited));
        }

        for (const inheritStatement of snapshot.inheritStatements) {
            const inheritedDocument = await this.dependencies.support.openInheritedDocument(
                document,
                inheritStatement.value,
                this.dependencies.support.createRequestState()
            );
            if (inheritedDocument) {
                definitions.push(...await this.collectVisibleTypeDefinitions(inheritedDocument, projectConfig, visited));
            }
        }

        return definitions;
    }

    private async openIncludedDocuments(
        document: vscode.TextDocument,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.TextDocument[]> {
        const documents: vscode.TextDocument[] = [];
        const snapshot = this.dependencies.support.getSemanticSnapshot(document);

        for (const includeStatement of snapshot.includeStatements) {
            if (!includeStatement.resolvedUri) {
                continue;
            }

            const includeDocument = await this.dependencies.support.tryOpenTextDocument(
                this.toSourceUri(includeStatement.resolvedUri)
            );
            if (includeDocument) {
                documents.push(includeDocument);
            }
        }

        for (const includePath of await this.dependencies.support.resolveExistingIncludeFiles(document, projectConfig)) {
            const includeDocument = await this.dependencies.support.tryOpenTextDocument(includePath);
            if (includeDocument) {
                documents.push(includeDocument);
            }
        }

        return documents;
    }

    private toSourceUri(sourceUri: string): vscode.Uri {
        if (sourceUri.startsWith('file:////')) {
            return vscode.Uri.file(sourceUri.replace(/^file:\/\/\/+/, ''));
        }

        return sourceUri.includes('://') ? vscode.Uri.parse(sourceUri) : vscode.Uri.file(sourceUri);
    }

    private normalizeDocumentKey(document: vscode.TextDocument): string {
        return document.uri.fsPath.replace(/\\/g, '/').toLowerCase();
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
