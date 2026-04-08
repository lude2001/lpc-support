import * as vscode from 'vscode';
import { MacroManager } from './macroManager';
import { EfunDocsManager } from './efunDocs';
import * as path from 'path';
import * as fs from 'fs';
import { ASTManager } from './ast/astManager';
import { Symbol, SymbolType } from './ast/symbolTable';
import { ObjectInferenceService } from './objectInference/ObjectInferenceService';
import { InferredObjectAccess } from './objectInference/types';
import { SemanticSnapshot } from './semantic/semanticSnapshot';
import { resolveVisibleSymbol } from './symbolReferenceResolver';

export class LPCDefinitionProvider implements vscode.DefinitionProvider {
    private macroManager: MacroManager;
    private efunDocsManager: EfunDocsManager;
    private astManager: ASTManager;
    private objectInferenceService: ObjectInferenceService;
    private processedFiles: Set<string> = new Set();
    private functionDefinitions: Map<string, vscode.Location> = new Map();
    private includeFileCache = new Map<string, string[]>(); // 缓存文件的include列表
    private headerFunctionCache = new Map<string, Map<string, vscode.Location>>(); // 缓存头文件中的函数定义

    constructor(
        macroManager: MacroManager,
        efunDocsManager: EfunDocsManager,
        objectInferenceService: ObjectInferenceService = new ObjectInferenceService(macroManager)
    ) {
        this.macroManager = macroManager;
        this.efunDocsManager = efunDocsManager;
        this.astManager = ASTManager.getInstance();
        this.objectInferenceService = objectInferenceService;
        
        // 监听文件变化，清除相关缓存
        vscode.workspace.onDidChangeTextDocument((event) => {
            const filePath = event.document.uri.fsPath;
            if (filePath.endsWith('.h')) {
                this.headerFunctionCache.delete(filePath);
                // 清除依赖此头文件的include缓存
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

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location | vscode.Location[] | undefined> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);
        const inferredObjectAccess = await this.objectInferenceService.inferObjectAccess(document, position);
        if (inferredObjectAccess?.memberName === word) {
            return this.handleInferredObjectMethodCall(document, inferredObjectAccess);
        }

        const directDefinition = await this.resolveDirectDefinition(document, position, word);
        if (directDefinition) {
            return directDefinition;
        }

        return this.findFunctionDefinition(document, word);
    }

    private async resolveDirectDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        word: string
    ): Promise<vscode.Location | undefined> {
        const includeResult = await this.handleIncludeDefinition(document, position);
        if (includeResult) {
            return includeResult;
        }

        const macroDefinition = await this.findMacroDefinition(word);
        if (macroDefinition) {
            return macroDefinition;
        }

        const simulatedEfunDefinition = await this.findSimulatedEfunDefinition(word);
        if (simulatedEfunDefinition) {
            return simulatedEfunDefinition;
        }

        return this.findVariableDefinition(word, document, position);
    }

    private async findMacroDefinition(word: string): Promise<vscode.Location | undefined> {
        const macro = this.macroManager.getMacro(word);
        if (!macro) {
            return undefined;
        }

        const uri = vscode.Uri.file(macro.file);
        const macroDoc = await vscode.workspace.openTextDocument(uri);
        const startPos = new vscode.Position(macro.line - 1, 0);
        const endPos = new vscode.Position(macro.line - 1, macroDoc.lineAt(macro.line - 1).text.length);
        return new vscode.Location(uri, new vscode.Range(startPos, endPos));
    }

    private async findSimulatedEfunDefinition(word: string): Promise<vscode.Location | undefined> {
        if (!this.efunDocsManager.getSimulatedDoc(word)) {
            return undefined;
        }

        return this.findInSimulatedEfuns(word);
    }

    private async findFunctionDefinition(
        document: vscode.TextDocument,
        word: string
    ): Promise<vscode.Location | undefined> {
        this.processedFiles.clear();
        this.functionDefinitions.clear();

        await this.findFunctionDefinitions(document);

        if (!this.functionDefinitions.has(word)) {
            await this.findInheritedFunctionDefinitions(document);
        }

        if (!this.functionDefinitions.has(word)) {
            const includeLocation = await this.findFunctionInCurrentFileIncludes(document, word);
            if (includeLocation) {
                return includeLocation;
            }
        }

        return this.functionDefinitions.get(word);
    }

    /**
     * 处理include语句中的文件跳转
     */
    private async handleIncludeDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location | undefined> {
        const snapshot = this.getSemanticSnapshot(document);
        const includeStatement = snapshot.includeStatements.find((statement) => statement.range.contains(position));

        if (!includeStatement) {
            return undefined;
        }

        return this.resolveIncludePath(document, includeStatement.value, includeStatement.isSystemInclude);
    }

    /**
     * 解析include路径并返回文件位置
     */
    private async resolveIncludePath(
        document: vscode.TextDocument,
        includePath: string,
        isGlobalInclude: boolean
    ): Promise<vscode.Location | undefined> {
        const targetPath = this.resolveIncludeFilePath(document, includePath, isGlobalInclude);
        if (!targetPath || !fs.existsSync(targetPath)) {
            return undefined;
        }

        const fileUri = vscode.Uri.file(targetPath);
        return new vscode.Location(fileUri, new vscode.Position(0, 0));
    }

    /**
     * 解析项目相对路径
     * 支持相对于项目根目录的路径配置
     */
    private resolveProjectPath(workspaceRoot: string, configPath: string): string {
        return path.isAbsolute(configPath) ? configPath : path.join(workspaceRoot, configPath);
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

            const locationPosition = this.getLocationPosition(location);
            const key = `${location.uri.fsPath}:${locationPosition.line}:${locationPosition.character}`;
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

    private getLocationPosition(location: vscode.Location): vscode.Position {
        const rangeOrPosition = location.range;
        return 'start' in rangeOrPosition ? rangeOrPosition.start : rangeOrPosition;
    }

    /**
     * 在指定文件中查找方法定义
     */
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

    /**
     * 在包含文件中查找方法定义
     */
    private async findMethodInIncludedFiles(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        const resolvedFilePath = this.resolveWorkspaceFilePath(currentDocument, targetFilePath);
        if (!resolvedFilePath || !fs.existsSync(resolvedFilePath)) {
            return undefined;
        }

        const includeFiles = await this.getIncludeFiles(resolvedFilePath);

        for (const includeFile of includeFiles) {
            const location = await this.findMethodInFile(currentDocument, includeFile, methodName);
            if (location) {
                return location;
            }
        }

        return undefined;
    }

    /**
     * 获取文件的include列表，并解析为绝对路径
     */
    private async getIncludeFiles(filePath: string): Promise<string[]> {
        if (this.includeFileCache.has(filePath)) {
            return this.includeFileCache.get(filePath)!;
        }

        const document = await this.tryOpenTextDocument(filePath);
        if (!document) {
            return [];
        }

        const includeFiles = this.resolveExistingIncludeFiles(document);

        this.includeFileCache.set(filePath, includeFiles);

        return includeFiles;
    }

    /**
     * 获取头文件中的函数索引
     */
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

    private async findHeaderFunctionLocation(headerPath: string, functionName: string): Promise<vscode.Location | undefined> {
        const functionIndex = await this.getHeaderFunctionIndex(headerPath);
        return functionIndex.get(functionName);
    }

    /**
     * 在当前文件的include文件中查找函数定义
     */
    private async findFunctionInCurrentFileIncludes(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<vscode.Location | undefined> {
        const includeFiles = await this.getIncludeFiles(document.uri.fsPath);

        let functionImplementation: vscode.Location | undefined;
        let functionPrototype: vscode.Location | undefined;

        for (const includeFile of includeFiles) {
            if (includeFile.endsWith('.h')) {
                const location = await this.findHeaderFunctionLocation(includeFile, functionName);
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

    private async findInSimulatedEfuns(word: string): Promise<vscode.Location | undefined> {
        const config = vscode.workspace.getConfiguration();
        const configPath = config.get<string>('lpc.simulatedEfunsPath');
        if (!configPath) return undefined;

        // 支持项目相对路径
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return undefined;

        const simulatedEfunsPath = this.resolveProjectPath(workspaceFolder.uri.fsPath, configPath);

        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(simulatedEfunsPath, '**/*.{c,h}')
        );
        
        for (const file of files) {
            const location = await this.findFunctionInFileByAST(file, word);
            if (location) return location;
        }
        
        return undefined;
    }

    private async findFunctionInFileByAST(fileUri: vscode.Uri, functionName: string): Promise<vscode.Location | undefined> {
        const document = await this.tryOpenTextDocument(fileUri);
        return document ? this.findFunctionInSemanticSnapshot(document, functionName) : undefined;
    }

    private async findVariableDefinition(
        variableName: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location | undefined> {
        const snapshot = this.getSemanticSnapshot(document);
        const visibleSymbol = resolveVisibleSymbol(snapshot.symbolTable, variableName, position);
        if (visibleSymbol && this.isVariableLikeSymbol(visibleSymbol)) {
            return this.toSymbolLocation(document.uri, visibleSymbol);
        }

        const inheritedVarDef = await this.findInheritedVariableDefinition(document, variableName);
        if (inheritedVarDef) {
            return inheritedVarDef;
        }

        return undefined;
    }

    private async findMethodInTargetChain(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        this.processedFiles.clear();
        return this.findMethodInTargetChainRecursive(currentDocument, targetFilePath, methodName);
    }

    private async findMethodInTargetChainRecursive(
        currentDocument: vscode.TextDocument,
        targetFilePath: string,
        methodName: string
    ): Promise<vscode.Location | undefined> {
        const directLocation = await this.findMethodInFile(currentDocument, targetFilePath, methodName);
        if (directLocation) {
            return directLocation;
        }

        const includeLocation = await this.findMethodInIncludedFiles(currentDocument, targetFilePath, methodName);
        if (includeLocation) {
            return includeLocation;
        }

        const targetDocument = path.resolve(targetFilePath) === path.resolve(currentDocument.uri.fsPath)
            ? currentDocument
            : await this.openWorkspaceDocument(currentDocument, targetFilePath);
        if (!targetDocument) {
            return undefined;
        }

        for (const inheritStatement of this.getSemanticSnapshot(targetDocument).inheritStatements) {
            const inheritedDocument = await this.openInheritedDocument(targetDocument, inheritStatement.value);
            if (!inheritedDocument) {
                continue;
            }

            const inheritedLocation = await this.findMethodInTargetChainRecursive(
                inheritedDocument,
                inheritedDocument.uri.fsPath,
                methodName
            );
            if (inheritedLocation) {
                return inheritedLocation;
            }
        }

        return undefined;
    }

    private async findInheritedVariableDefinition(
        document: vscode.TextDocument,
        variableName: string
    ): Promise<vscode.Location | undefined> {
        const snapshot = this.getSemanticSnapshot(document);
        for (const inheritStatement of snapshot.inheritStatements) {
            const inheritedDoc = await this.openInheritedDocument(document, inheritStatement.value);
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

            const nestedInheritedVarDef = await this.findInheritedVariableDefinition(inheritedDoc, variableName);
            if (nestedInheritedVarDef) {
                return nestedInheritedVarDef;
            }
        }

        return undefined;
    }

    private async findFunctionDefinitions(document: vscode.TextDocument): Promise<void> {
        const snapshot = this.getSemanticSnapshot(document);
        for (const functionSummary of snapshot.exportedFunctions) {
            const location = this.findFunctionInSemanticSnapshot(document, functionSummary.name);
            if (location) {
                this.functionDefinitions.set(functionSummary.name, location);
            }
        }
    }

    private async findInheritedFunctionDefinitions(document: vscode.TextDocument): Promise<void> {
        const inherits = this.findInherits(document);

        for (const inh of inherits) {
            const inheritedDocument = await this.openInheritedDocument(document, inh);
            if (!inheritedDocument) {
                continue;
            }

            await this.findFunctionDefinitions(inheritedDocument);
            await this.findInheritedFunctionDefinitions(inheritedDocument);
        }
    }

    private findInherits(document: vscode.TextDocument): Set<string> {
        const result = new Set<string>();
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

    private resolveExistingIncludeFiles(document: vscode.TextDocument): string[] {
        const includeFiles: string[] = [];

        for (const includeStatement of this.getSemanticSnapshot(document).includeStatements) {
            const resolvedPath = this.resolveIncludeFilePath(document, includeStatement.value, includeStatement.isSystemInclude);
            if (resolvedPath && fs.existsSync(resolvedPath)) {
                includeFiles.push(resolvedPath);
            }
        }

        return includeFiles;
    }

    private findFunctionInSemanticSnapshot(document: vscode.TextDocument, functionName: string): vscode.Location | undefined {
        const snapshot = this.getSemanticSnapshot(document);
        const symbol = snapshot.symbolTable
            .getAllSymbols()
            .find((candidate) => candidate.type === SymbolType.FUNCTION && candidate.name === functionName);

        return symbol ? this.toSymbolLocation(document.uri, symbol) : undefined;
    }

    private toSymbolLocation(uri: vscode.Uri, symbol: Symbol): vscode.Location {
        const targetRange = symbol.selectionRange ?? symbol.range;
        return new vscode.Location(uri, targetRange.start);
    }

    private isVariableLikeSymbol(symbol: Symbol): boolean {
        return symbol.type === SymbolType.VARIABLE || symbol.type === SymbolType.PARAMETER;
    }

    private resolveIncludeFilePath(
        document: vscode.TextDocument,
        includePath: string,
        isSystemInclude: boolean
    ): string | undefined {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        let normalizedPath = includePath;
        normalizedPath = this.ensureHeaderOrSourceExtension(normalizedPath);

        if (isSystemInclude) {
            const config = vscode.workspace.getConfiguration('lpc');
            let globalIncludePath = config.get<string>('includePath');
            if (!globalIncludePath) {
                globalIncludePath = path.join(workspaceFolder.uri.fsPath, 'include');
            } else {
                globalIncludePath = this.resolveProjectPath(workspaceFolder.uri.fsPath, globalIncludePath);
            }

            return path.join(globalIncludePath, normalizedPath);
        }

        if (path.isAbsolute(normalizedPath)) {
            const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
            return path.join(workspaceFolder.uri.fsPath, relativePath);
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

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            return undefined;
        }

        if (resolvedValue.startsWith('/')) {
            return path.join(workspaceFolder.uri.fsPath, resolvedValue.substring(1));
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
        inheritValue: string
    ): Promise<vscode.TextDocument | undefined> {
        const inheritedFile = this.resolveInheritedFilePath(document, inheritValue);
        if (!inheritedFile || !fs.existsSync(inheritedFile) || this.processedFiles.has(inheritedFile)) {
            return undefined;
        }

        this.processedFiles.add(inheritedFile);
        return this.tryOpenTextDocument(inheritedFile);
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

    private async openWorkspaceDocument(
        document: vscode.TextDocument,
        filePath: string
    ): Promise<vscode.TextDocument | undefined> {
        const resolvedFilePath = this.resolveWorkspaceFilePath(document, filePath);
        if (!resolvedFilePath || !fs.existsSync(resolvedFilePath)) {
            return undefined;
        }

        return this.tryOpenTextDocument(resolvedFilePath);
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
