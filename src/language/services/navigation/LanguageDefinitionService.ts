import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { LanguageCapabilityContext } from '../../contracts/LanguageCapabilityContext';
import type { LanguageLocation, LanguagePosition } from '../../contracts/LanguagePosition';
import type { LanguageWorkspaceProjectConfig } from '../../contracts/LanguageWorkspaceContext';
import { MacroManager } from '../../../macroManager';
import { EfunDocsManager } from '../../../efunDocs';
import { ASTManager } from '../../../ast/astManager';
import { Symbol, SymbolType } from '../../../ast/symbolTable';
import { ObjectInferenceService } from '../../../objectInference/ObjectInferenceService';
import { InferredObjectAccess } from '../../../objectInference/types';
import { SemanticSnapshot } from '../../../semantic/semanticSnapshot';
import { resolveVisibleSymbol } from '../../../symbolReferenceResolver';
import { TargetMethodLookup } from '../../../targetMethodLookup';
import type { LpcProjectConfigService } from '../../../projectConfig/LpcProjectConfigService';

export interface LanguageDefinitionRequest {
    context: LanguageCapabilityContext;
    position: LanguagePosition;
}

export interface LanguageDefinitionService {
    provideDefinition(request: LanguageDefinitionRequest): Promise<LanguageLocation[]>;
}

interface DefinitionRequestState {
    processedFiles: Set<string>;
    functionDefinitions: Map<string, vscode.Location>;
}

interface VsCodeLocationWithSourceUri extends vscode.Location {
    __languageSourceUri?: string;
}

interface LanguageDefinitionHost {
    onDidChangeTextDocument(listener: (event: { document: { uri: { fsPath: string } } }) => void): vscode.Disposable;
    openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument>;
    findFiles(pattern: vscode.RelativePattern): Promise<readonly vscode.Uri[]>;
    getWorkspaceFolder(uri: vscode.Uri): { uri: { fsPath: string } } | undefined;
    getWorkspaceFolders(): readonly { uri: { fsPath: string } }[] | undefined;
    fileExists(filePath: string): boolean;
}

interface DefinitionSemanticAdapter {
    getIncludeStatements?(document: vscode.TextDocument): Array<{
        value: string;
        isSystemInclude: boolean;
        range: vscode.Range | { contains(position: vscode.Position): boolean };
    }>;
    getInheritStatements?(document: vscode.TextDocument): string[];
    getExportedFunctionNames?(document: vscode.TextDocument): string[];
    findFunctionLocation?(document: vscode.TextDocument, functionName: string): LanguageLocation | vscode.Location | undefined;
    resolveVisibleVariableLocation?(
        document: vscode.TextDocument,
        variableName: string,
        position: vscode.Position
    ): LanguageLocation | vscode.Location | undefined;
}

interface LanguageDefinitionDependencies {
    host?: LanguageDefinitionHost;
    semanticAdapter?: DefinitionSemanticAdapter;
}

const defaultDefinitionHost: LanguageDefinitionHost = {
    onDidChangeTextDocument: (listener) => vscode.workspace.onDidChangeTextDocument(listener),
    openTextDocument: async (target) => {
        return typeof target === 'string'
            ? vscode.workspace.openTextDocument(target)
            : vscode.workspace.openTextDocument(target);
    },
    findFiles: async (pattern) => vscode.workspace.findFiles(pattern),
    getWorkspaceFolder: (uri) => vscode.workspace.getWorkspaceFolder(uri),
    getWorkspaceFolders: () => vscode.workspace.workspaceFolders,
    fileExists: (filePath: string) => fs.existsSync(filePath)
};

export class AstBackedLanguageDefinitionService implements LanguageDefinitionService {
    private readonly macroManager: MacroManager;
    private readonly efunDocsManager: EfunDocsManager;
    private readonly astManager: ASTManager;
    private readonly objectInferenceService: ObjectInferenceService;
    private readonly projectConfigService?: LpcProjectConfigService;
    private readonly includeFileCache = new Map<string, string[]>();
    private readonly headerFunctionCache = new Map<string, Map<string, vscode.Location>>();
    private readonly targetMethodLookup: TargetMethodLookup;
    private readonly host: LanguageDefinitionHost;
    private readonly semanticAdapter?: DefinitionSemanticAdapter;

    public constructor(
        macroManager: MacroManager,
        efunDocsManager: EfunDocsManager,
        objectInferenceService?: ObjectInferenceService,
        targetMethodLookup?: TargetMethodLookup,
        projectConfigService?: LpcProjectConfigService,
        hostOrDependencies: LanguageDefinitionHost | LanguageDefinitionDependencies = defaultDefinitionHost
    ) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
        this.astManager = ASTManager.getInstance();
        this.projectConfigService = projectConfigService;
        this.objectInferenceService = objectInferenceService ?? new ObjectInferenceService(macroManager, projectConfigService);
        this.targetMethodLookup = targetMethodLookup ?? new TargetMethodLookup(macroManager, projectConfigService);
        const dependencies = this.resolveDependencies(hostOrDependencies);
        this.host = dependencies.host;
        this.semanticAdapter = dependencies.semanticAdapter;

        this.host.onDidChangeTextDocument((event) => {
            const filePath = event.document.uri.fsPath;
            if (filePath.endsWith('.h')) {
                this.headerFunctionCache.delete(filePath);
                for (const [key, includes] of this.includeFileCache.entries()) {
                    if (includes.includes(filePath)) {
                        this.includeFileCache.delete(key);
                    }
                }
            } else {
                this.includeFileCache.delete(filePath);
            }
        });
    }

    private resolveDependencies(
        hostOrDependencies: LanguageDefinitionHost | LanguageDefinitionDependencies
    ): { host: LanguageDefinitionHost; semanticAdapter?: DefinitionSemanticAdapter } {
        if ('onDidChangeTextDocument' in hostOrDependencies) {
            return {
                host: hostOrDependencies
            };
        }

        return {
            host: hostOrDependencies.host ?? defaultDefinitionHost,
            semanticAdapter: hostOrDependencies.semanticAdapter
        };
    }

    public async provideDefinition(request: LanguageDefinitionRequest): Promise<LanguageLocation[]> {
        const document = request.context.document as unknown as vscode.TextDocument;
        const position = new vscode.Position(request.position.line, request.position.character);
        const workspaceRoot = request.context.workspace.workspaceRoot;
        const projectConfig = request.context.workspace.projectConfig;
        const requestState = this.createRequestState();
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return [];
        }

        const word = document.getText(wordRange);
        const inferredObjectAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (inferredObjectAccess?.memberName === word) {
            return this.toLanguageLocations(await this.handleInferredObjectMethodCall(document, inferredObjectAccess));
        }

        const directDefinition = await this.resolveDirectDefinition(
            document,
            position,
            word,
            workspaceRoot,
            projectConfig,
            requestState
        );
        if (directDefinition) {
            return this.toLanguageLocations(directDefinition);
        }

        return this.toLanguageLocations(await this.findFunctionDefinition(document, word, requestState));
    }

    private createRequestState(): DefinitionRequestState {
        return {
            processedFiles: new Set<string>(),
            functionDefinitions: new Map<string, vscode.Location>()
        };
    }

    private toLanguageLocations(
        result: vscode.Location | vscode.Location[] | undefined
    ): LanguageLocation[] {
        if (!result) {
            return [];
        }

        const locations = Array.isArray(result) ? result : [result];
        return locations.map((location) => {
            const originalUri = (location as VsCodeLocationWithSourceUri).__languageSourceUri;
            const rangeOrPosition = location.range;
            const range = 'start' in rangeOrPosition
                ? rangeOrPosition
                : new vscode.Range(rangeOrPosition, rangeOrPosition);

            return {
                uri: originalUri ?? location.uri.toString(),
                range: {
                    start: {
                        line: range.start.line,
                        character: range.start.character
                    },
                    end: {
                        line: range.end.line,
                        character: range.end.character
                    }
                }
            };
        });
    }

    private async resolveDirectDefinition(
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

        return this.findVariableDefinition(word, document, position, requestState ?? this.createRequestState());
    }

    private async findMacroDefinition(word: string): Promise<vscode.Location | undefined> {
        const macro = this.macroManager?.getMacro?.(word);
        if (!macro) {
            return undefined;
        }

        const uri = vscode.Uri.file(macro.file);
        const macroDoc = await this.host.openTextDocument(uri);
        const startPos = new vscode.Position(macro.line - 1, 0);
        const endPos = new vscode.Position(macro.line - 1, macroDoc.lineAt(macro.line - 1).text.length);
        return new vscode.Location(uri, new vscode.Range(startPos, endPos));
    }

    private async findSimulatedEfunDefinition(
        word: string,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        if (!this.efunDocsManager.getSimulatedDoc(word)) {
            return undefined;
        }

        return this.findInSimulatedEfuns(word, workspaceRoot, projectConfig);
    }

    private async findFunctionDefinition(
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

    private async handleIncludeDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const includeStatement = this.getIncludeStatements(document).find((statement) => statement.range.contains(position));

        if (!includeStatement) {
            return undefined;
        }

        return this.resolveIncludePath(document, includeStatement.value, includeStatement.isSystemInclude, workspaceRoot, projectConfig);
    }

    private async resolveIncludePath(
        document: vscode.TextDocument,
        includePath: string,
        isGlobalInclude: boolean,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const targetPath = await this.resolveIncludeFilePath(document, includePath, isGlobalInclude, workspaceRoot, projectConfig);
        if (!targetPath || !this.host.fileExists(targetPath)) {
            return undefined;
        }

        const fileUri = vscode.Uri.file(targetPath);
        return new vscode.Location(fileUri, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)));
    }

    private async handleInferredObjectMethodCall(
        document: vscode.TextDocument,
        objectAccess: InferredObjectAccess
    ): Promise<vscode.Location | vscode.Location[] | undefined> {
        if (objectAccess.inference.status === 'unknown' || objectAccess.inference.status === 'unsupported') {
            return undefined;
        }

        const locations: vscode.Location[] = [];
        const seenLocations = new Set<string>();

        for (const candidate of objectAccess.inference.candidates) {
            const location = await this.findMethodInTargetChain(document, candidate.path, objectAccess.memberName);
            if (!location) {
                continue;
            }

            const normalizedRange = this.toVsCodeRange(location);
            const key = `${location.uri.fsPath}:${normalizedRange.start.line}:${normalizedRange.start.character}:${normalizedRange.end.line}:${normalizedRange.end.character}`;
            if (seenLocations.has(key)) {
                continue;
            }

            seenLocations.add(key);
            locations.push(location);
        }

        if (locations.length === 0) {
            return undefined;
        }

        return locations.length === 1 ? locations[0] : locations;
    }

    private toVsCodeRange(location: vscode.Location): vscode.Range {
        const rangeOrPosition = location.range;
        return 'start' in rangeOrPosition
            ? rangeOrPosition
            : new vscode.Range(rangeOrPosition, rangeOrPosition);
    }

    private async findMethodInFile(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        if (path.resolve(targetFilePath) === path.resolve(currentDocument.uri.fsPath)) {
            return this.findFunctionInSemanticSnapshot(currentDocument, methodName);
        }

        const targetDoc = await this.openWorkspaceDocument(currentDocument, targetFilePath);
        return targetDoc ? this.findFunctionInSemanticSnapshot(targetDoc, methodName) : undefined;
    }

    private async getIncludeFiles(filePath: string): Promise<string[]> {
        if (this.includeFileCache.has(filePath)) {
            return this.includeFileCache.get(filePath)!;
        }

        const document = await this.tryOpenTextDocument(filePath);
        if (!document) {
            return [];
        }

        const includeFiles = await this.resolveExistingIncludeFiles(document);
        this.includeFileCache.set(filePath, includeFiles);
        return includeFiles;
    }

    private async getHeaderFunctionIndex(headerPath: string): Promise<Map<string, vscode.Location>> {
        if (this.headerFunctionCache.has(headerPath)) {
            return this.headerFunctionCache.get(headerPath)!;
        }

        const functionIndex = new Map<string, vscode.Location>();
        const headerDoc = await this.tryOpenTextDocument(vscode.Uri.file(headerPath));
        if (!headerDoc) {
            return functionIndex;
        }

        for (const summary of this.getSemanticSnapshot(headerDoc).exportedFunctions) {
            const location = this.findFunctionInSemanticSnapshot(headerDoc, summary.name);
            if (location) {
                functionIndex.set(summary.name, location);
            }
        }

        this.headerFunctionCache.set(headerPath, functionIndex);
        return functionIndex;
    }

    private async findFunctionInCurrentFileIncludes(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<vscode.Location | undefined> {
        const includeFiles = await this.getIncludeFiles(document.uri.fsPath);
        let functionImplementation: vscode.Location | undefined;
        let functionPrototype: vscode.Location | undefined;

        for (const includeFile of includeFiles) {
            if (includeFile.endsWith('.h')) {
                const location = (await this.getHeaderFunctionIndex(includeFile)).get(functionName);
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

    private async findInSimulatedEfuns(
        word: string,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<vscode.Location | undefined> {
        const configuredFile = await this.getConfiguredSimulatedEfunFile(workspaceRoot, projectConfig);
        return configuredFile
            ? this.findFunctionInFileByAST(configuredFile, word)
            : undefined;
    }

    private async findFunctionInFileByAST(
        fileTarget: string | vscode.Uri,
        functionName: string
    ): Promise<vscode.Location | undefined> {
        const document = await this.tryOpenTextDocument(fileTarget);
        return document ? this.findFunctionInSemanticSnapshot(document, functionName) : undefined;
    }

    private async findVariableDefinition(
        variableName: string,
        document: vscode.TextDocument,
        position: vscode.Position,
        requestState: DefinitionRequestState
    ): Promise<vscode.Location | undefined> {
        const adaptedVisibleLocation = this.semanticAdapter?.resolveVisibleVariableLocation?.(document, variableName, position);
        if (adaptedVisibleLocation) {
            return this.toVsCodeLocation(adaptedVisibleLocation);
        }

        const snapshot = this.getSemanticSnapshot(document);
        const visibleSymbol = resolveVisibleSymbol(snapshot.symbolTable, variableName, position);
        if (visibleSymbol && this.isVariableLikeSymbol(visibleSymbol)) {
            return this.toSymbolLocation(document.uri, visibleSymbol);
        }

        return this.findInheritedVariableDefinition(document, variableName, requestState);
    }

    private async findMethodInTargetChain(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        const resolvedMethod = await this.targetMethodLookup.findMethod(currentDocument, targetFilePath, methodName);
        return resolvedMethod?.location;
    }

    private async findInheritedVariableDefinition(
        document: vscode.TextDocument,
        variableName: string,
        requestState: DefinitionRequestState
    ): Promise<vscode.Location | undefined> {
        const snapshot = this.getSemanticSnapshot(document);
        for (const inheritStatement of snapshot.inheritStatements) {
            const inheritedDoc = await this.openInheritedDocument(document, inheritStatement.value, requestState);
            if (!inheritedDoc) {
                continue;
            }

            const inheritedSnapshot = this.getSemanticSnapshot(inheritedDoc);
            const inheritedSymbol = inheritedSnapshot.symbolTable
                .getAllSymbols()
                .find((symbol) => this.isVariableLikeSymbol(symbol) && symbol.name === variableName && symbol.scope.name === 'global');

            if (inheritedSymbol) {
                return this.toSymbolLocation(inheritedDoc.uri, inheritedSymbol);
            }

            const nestedInheritedVarDef = await this.findInheritedVariableDefinition(inheritedDoc, variableName, requestState);
            if (nestedInheritedVarDef) {
                return nestedInheritedVarDef;
            }
        }

        return undefined;
    }

    private async findFunctionDefinitions(document: vscode.TextDocument, requestState: DefinitionRequestState): Promise<void> {
        const semanticAdapter = this.semanticAdapter;
        const adaptedFunctionNames = semanticAdapter?.getExportedFunctionNames?.(document);
        if (adaptedFunctionNames) {
            for (const functionName of adaptedFunctionNames) {
                const location = semanticAdapter?.findFunctionLocation?.(document, functionName);
                if (location) {
                    requestState.functionDefinitions.set(functionName, this.toVsCodeLocation(location));
                }
            }
            return;
        }

        const snapshot = this.getSemanticSnapshot(document);
        for (const functionSummary of snapshot.exportedFunctions) {
            const location = this.findFunctionInSemanticSnapshot(document, functionSummary.name);
            if (location) {
                requestState.functionDefinitions.set(functionSummary.name, location);
            }
        }
    }

    private async findInheritedFunctionDefinitions(
        document: vscode.TextDocument,
        requestState: DefinitionRequestState
    ): Promise<void> {
        const inherits = this.findInherits(document);

        for (const inh of inherits) {
            const inheritedDocument = await this.openInheritedDocument(document, inh, requestState);
            if (!inheritedDocument) {
                continue;
            }

            await this.findFunctionDefinitions(inheritedDocument, requestState);
            await this.findInheritedFunctionDefinitions(inheritedDocument, requestState);
        }
    }

    private findInherits(document: vscode.TextDocument): Set<string> {
        const result = new Set<string>();
        const adaptedInherits = this.semanticAdapter?.getInheritStatements?.(document);
        if (adaptedInherits) {
            for (const statement of adaptedInherits) {
                if (statement) {
                    result.add(statement);
                }
            }
            return result;
        }

        const snapshot = this.astManager.getBestAvailableSnapshot(document);
        for (const statement of snapshot.inheritStatements) {
            if (statement.value) {
                result.add(statement.value);
            }
        }
        return result;
    }

    private getSemanticSnapshot(document: vscode.TextDocument, useCache: boolean = true): SemanticSnapshot {
        return this.astManager.getSemanticSnapshot(document, useCache);
    }

    private async resolveExistingIncludeFiles(document: vscode.TextDocument): Promise<string[]> {
        const includeFiles: string[] = [];
        const workspaceRoot = this.getWorkspaceRoot(document);

        for (const includeStatement of this.getIncludeStatements(document)) {
            const resolvedPath = await this.resolveIncludeFilePath(
                document,
                includeStatement.value,
                includeStatement.isSystemInclude,
                workspaceRoot
            );
            if (resolvedPath && this.host.fileExists(resolvedPath)) {
                includeFiles.push(resolvedPath);
            }
        }

        return includeFiles;
    }

    private findFunctionInSemanticSnapshot(document: vscode.TextDocument, functionName: string): vscode.Location | undefined {
        const adaptedLocation = this.semanticAdapter?.findFunctionLocation?.(document, functionName);
        if (adaptedLocation) {
            return this.toVsCodeLocation(adaptedLocation);
        }

        const symbol = this.getSemanticSnapshot(document).symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        return symbol ? this.toSymbolLocation(document.uri, symbol) : undefined;
    }

    private getIncludeStatements(document: vscode.TextDocument): Array<{
        value: string;
        isSystemInclude: boolean;
        range: vscode.Range | { contains(position: vscode.Position): boolean };
    }> {
        return this.semanticAdapter?.getIncludeStatements?.(document) ?? this.getSemanticSnapshot(document).includeStatements;
    }

    private toVsCodeLocation(location: LanguageLocation | vscode.Location): vscode.Location {
        if (location instanceof vscode.Location) {
            return location;
        }

        const uri = location.uri.includes('://') || location.uri.startsWith('file:')
            ? vscode.Uri.parse(location.uri)
            : vscode.Uri.file(location.uri);
        const range = new vscode.Range(
            location.range.start.line,
            location.range.start.character,
            location.range.end.line,
            location.range.end.character
        );
        const result = new vscode.Location(uri, range) as VsCodeLocationWithSourceUri;
        result.__languageSourceUri = location.uri;
        return result;
    }

    private toSymbolLocation(uri: vscode.Uri, symbol: Symbol): vscode.Location {
        const targetRange = symbol.selectionRange ?? symbol.range;
        return new vscode.Location(uri, targetRange);
    }

    private isVariableLikeSymbol(symbol: Symbol): boolean {
        return symbol.type === SymbolType.VARIABLE || symbol.type === SymbolType.PARAMETER;
    }

    private resolveIncludeFilePath(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        if (!workspaceRoot) {
            return Promise.resolve(undefined);
        }

        return this.doResolveIncludeFilePath(document, includePath, isSystemInclude, workspaceRoot, projectConfig);
    }

    private async doResolveIncludeFilePath(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean,
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        if (!workspaceRoot) {
            return undefined;
        }

        let normalizedPath = includePath;
        normalizedPath = this.ensureHeaderOrSourceExtension(normalizedPath);

        if (isSystemInclude) {
            const globalIncludePath = await this.getPrimaryIncludeDirectory(workspaceRoot, projectConfig);
            if (!globalIncludePath) {
                return path.join(workspaceRoot, 'include', normalizedPath);
            }

            return path.join(globalIncludePath, normalizedPath);
        }

        if (path.isAbsolute(normalizedPath)) {
            const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
            return path.join(workspaceRoot, relativePath);
        }

        return path.resolve(path.dirname(document.uri.fsPath), normalizedPath);
    }

    private resolveInheritedFilePath(document: vscode.TextDocument, inheritValue: string): string | undefined {
        let resolvedValue = inheritValue;
        if (/^[A-Z_][A-Z0-9_]*$/.test(resolvedValue)) {
            const macro = this.macroManager.getMacro(resolvedValue);
            if (!macro?.value) {
                return undefined;
            }

            resolvedValue = macro.value.replace(/^"(.*)"$/, '$1');
        }

        resolvedValue = this.ensureExtension(resolvedValue, '.c');

        const workspaceRoot = this.getWorkspaceRoot(document);
        if (!workspaceRoot) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return path.join(workspaceRoot, resolvedValue.substring(1));
        }

        return path.resolve(path.dirname(document.uri.fsPath), resolvedValue);
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

    private async openInheritedDocument(
        document: vscode.TextDocument,
        inheritValue: string,
        requestState: DefinitionRequestState
    ): Promise<vscode.TextDocument | undefined> {
        const inheritedFile = this.resolveInheritedFilePath(document, inheritValue);
        if (!inheritedFile || !this.host.fileExists(inheritedFile) || requestState.processedFiles.has(inheritedFile)) {
            return undefined;
        }

        requestState.processedFiles.add(inheritedFile);
        return this.tryOpenTextDocument(inheritedFile);
    }

    private resolveWorkspaceFilePath(document: vscode.TextDocument, filePath: string): string | undefined {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        const workspaceRoot = this.getWorkspaceRoot(document);
        if (!workspaceRoot) {
            return undefined;
        }

        const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        return path.join(workspaceRoot, relativePath);
    }

    private async openWorkspaceDocument(
        document: vscode.TextDocument,
        filePath: string
    ): Promise<vscode.TextDocument | undefined> {
        const resolvedFilePath = this.resolveWorkspaceFilePath(document, filePath);
        if (!resolvedFilePath || !this.host.fileExists(resolvedFilePath)) {
            return undefined;
        }

        return this.tryOpenTextDocument(resolvedFilePath);
    }

    private async tryOpenTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument | undefined> {
        try {
            if (typeof target === 'string') {
                return await this.host.openTextDocument(target);
            }

            return await this.host.openTextDocument(target);
        } catch {
            return undefined;
        }
    }

    private getWorkspaceRoot(document: vscode.TextDocument): string {
        return this.host.getWorkspaceFolder(document.uri)?.uri.fsPath ?? path.dirname(document.uri.fsPath);
    }

    private resolveProjectPath(workspaceRoot: string, configPath: string): string {
        return path.isAbsolute(configPath) ? configPath : path.join(workspaceRoot, configPath);
    }

    private async getPrimaryIncludeDirectory(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        const fromContext = projectConfig?.resolvedConfig?.includeDirectories?.[0];
        if (fromContext) {
            return this.resolveProjectPath(workspaceRoot, fromContext);
        }

        const fromService = await this.projectConfigService?.getPrimaryIncludeDirectoryForWorkspace(workspaceRoot);
        if (fromService) {
            return fromService;
        }
        return undefined;
    }

    private async getConfiguredSimulatedEfunFile(
        workspaceRoot: string,
        projectConfig?: LanguageWorkspaceProjectConfig
    ): Promise<string | undefined> {
        const fromContext = projectConfig?.resolvedConfig?.simulatedEfunFile;
        if (fromContext) {
            return this.resolveExistingCodePath(this.resolveProjectPath(workspaceRoot, fromContext));
        }

        const fromService = await this.projectConfigService?.getSimulatedEfunFileForWorkspace(workspaceRoot);
        if (fromService) {
            return fromService;
        }

        return undefined;
    }

    private resolveExistingCodePath(targetPath: string): string {
        if (this.host.fileExists(targetPath)) {
            return targetPath;
        }

        if (path.extname(targetPath)) {
            return targetPath;
        }

        for (const candidate of [`${targetPath}.c`, `${targetPath}.h`]) {
            if (this.host.fileExists(candidate)) {
                return candidate;
            }
        }

        return targetPath;
    }
}
