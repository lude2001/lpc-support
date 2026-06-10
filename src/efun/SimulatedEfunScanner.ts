import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { InheritDirective, IncludeDirective } from '../semantic/documentSemanticTypes';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { CallableDoc, DocumentCallableDocs } from '../language/documentation/types';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';

type SimulatedEfunAnalysisService = Pick<DocumentAnalysisService, 'parseDocument'>;

export class SimulatedEfunScanner {
    private readonly workspaceStates = new Map<string, SimulatedEfunWorkspaceState>();
    private readonly analysisService: SimulatedEfunAnalysisService;
    private readonly documentationService: FunctionDocumentationService;
    private activeWorkspaceStateKey: string | undefined;

    constructor(
        private readonly projectConfigService: LpcProjectConfigService | undefined,
        analysisService: SimulatedEfunAnalysisService,
        documentationService?: FunctionDocumentationService
    ) {
        this.analysisService = assertAnalysisService('SimulatedEfunScanner', analysisService);
        this.documentationService = assertDocumentationService('SimulatedEfunScanner', documentationService);
    }

    public get(name: string): CallableDoc | undefined {
        return this.getForDocument(name);
    }

    public async getAsync(name: string, document?: vscode.TextDocument): Promise<CallableDoc | undefined> {
        await this.ensureWorkspaceStateCurrent(document);
        return this.getForDocument(name, document);
    }

    public getForDocument(name: string, document?: vscode.TextDocument): CallableDoc | undefined {
        return this.getWorkspaceState(document).docs.get(name);
    }

    public getAllNames(document?: vscode.TextDocument): string[] {
        return Array.from(this.getWorkspaceState(document).docs.keys());
    }

    public async configure(): Promise<void> {
        return this.configureSimulatedEfuns();
    }

    public async load(): Promise<void> {
        return this.loadSimulatedEfuns();
    }

    public invalidateWorkspaceState(): void {
        for (const state of this.workspaceStates.values()) {
            state.loadVersion += 1;
        }
        this.workspaceStates.clear();
    }

    public async refreshWorkspaceState(force: boolean = false, document?: vscode.TextDocument): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot(document);
        const state = this.getWorkspaceStateForRoot(workspaceRoot);
        if (!force && state.hasLoaded) {
            return;
        }

        if (force) {
            state.hasLoaded = false;
        }

        const loadVersion = ++state.loadVersion;
        const nextDocs = await this.collectSimulatedEfuns(workspaceRoot);
        if (loadVersion !== state.loadVersion) {
            return;
        }

        state.docs = nextDocs;
        state.hasLoaded = true;
    }

    public async configureSimulatedEfuns(): Promise<void> {
        vscode.window.showInformationMessage('模拟函数入口文件来自 config.hell 的 simulated efun file，请修改 lpc-support.json 的 configHellPath 或对应 driver 配置文件。');
    }

    public async loadSimulatedEfuns(): Promise<void> {
        await this.refreshWorkspaceState(false);
    }

    private async collectSimulatedEfuns(resolvedWorkspaceRoot?: string): Promise<Map<string, CallableDoc>> {
        const docs = new Map<string, CallableDoc>();

        const workspaceRoot = resolvedWorkspaceRoot ?? this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return docs;
        }

        const simulatedEfunEntryFile = this.projectConfigService
            ? await this.projectConfigService.getSimulatedEfunFileForWorkspace(workspaceRoot)
            : undefined;
        if (!simulatedEfunEntryFile) {
            return docs;
        }

        try {
            await this.loadFromProjectConfigEntry(workspaceRoot, simulatedEfunEntryFile, docs);
        } catch (error) {
            console.error('加载模拟函数库文档失败:', error);
        }

        return docs;
    }

    public async ensureWorkspaceStateCurrent(document?: vscode.TextDocument): Promise<void> {
        const state = this.getWorkspaceState(document);
        if (!state.hasLoaded) {
            await this.refreshWorkspaceState(true, document);
        }
    }

    private getWorkspaceState(document?: vscode.TextDocument): SimulatedEfunWorkspaceState {
        return this.getWorkspaceStateByKey(this.getWorkspaceStateKey(document));
    }

    private getWorkspaceStateForRoot(workspaceRoot: string | undefined): SimulatedEfunWorkspaceState {
        return this.getWorkspaceStateByKey(workspaceRoot ?? '<no-workspace>');
    }

    private getWorkspaceStateByKey(key: string): SimulatedEfunWorkspaceState {
        this.activeWorkspaceStateKey = key;
        const existing = this.workspaceStates.get(key);
        if (existing) {
            return existing;
        }

        const created: SimulatedEfunWorkspaceState = {
            docs: new Map(),
            hasLoaded: false,
            loadVersion: 0
        };
        this.workspaceStates.set(key, created);
        return created;
    }

    private getWorkspaceStateKey(document?: vscode.TextDocument): string {
        if (!document && this.activeWorkspaceStateKey) {
            return this.activeWorkspaceStateKey;
        }

        return this.getWorkspaceRoot(document) ?? '<no-workspace>';
    }

    private async loadFromProjectConfigEntry(
        workspaceRoot: string,
        entryFilePath: string,
        docs: Map<string, CallableDoc>
    ): Promise<void> {
        const mudlibRoot = await this.resolveMudlibRoot(workspaceRoot);
        const queue = [entryFilePath];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const currentFile = queue.shift()!;
            const normalized = path.normalize(currentFile);
            if (visited.has(normalized)) {
                continue;
            }

            visited.add(normalized);

            const text = await fs.promises.readFile(currentFile, 'utf8');
            this.storeParsedDocs(currentFile, text, docs);

            const relatedFiles = this.extractRelatedSourceFiles(currentFile, text, mudlibRoot);
            for (const relationFile of relatedFiles) {
                if (!visited.has(path.normalize(relationFile))) {
                    queue.push(relationFile);
                }
            }
        }
    }

    private async resolveMudlibRoot(workspaceRoot: string): Promise<string> {
        if (this.projectConfigService && typeof this.projectConfigService.getMudlibRootForWorkspace === 'function') {
            const configuredMudlibRoot = await this.projectConfigService.getMudlibRootForWorkspace(workspaceRoot);
            if (configuredMudlibRoot) {
                return configuredMudlibRoot;
            }
        }

        const resolved = this.projectConfigService && typeof this.projectConfigService.getResolvedForWorkspace === 'function'
            ? await this.projectConfigService.getResolvedForWorkspace(workspaceRoot)
            : undefined;
        const mudlibDirectory = resolved?.mudlibDirectory ?? '.';

        if (path.isAbsolute(mudlibDirectory)) {
            return mudlibDirectory;
        }

        return path.resolve(workspaceRoot, mudlibDirectory);
    }

    private extractRelatedSourceFiles(currentFilePath: string, content: string, mudlibRoot: string): string[] {
        const document = this.createSyntheticDocument(currentFilePath, content);
        const analysis = this.analysisService.parseDocument(document, false);
        const relatedFiles = [
            ...analysis.snapshot.includeStatements.map((statement) =>
                this.resolveIncludeDirective(statement, currentFilePath, mudlibRoot)
            ),
            ...analysis.snapshot.inheritStatements.map((statement) =>
                this.resolveInheritDirective(statement, currentFilePath, mudlibRoot)
            )
        ];

        return relatedFiles.filter((filePath): filePath is string => Boolean(filePath));
    }

    private storeParsedDocs(filePath: string, text: string, docs: Map<string, CallableDoc>): void {
        const document = this.createSyntheticDocument(filePath, text);
        this.documentationService.invalidate(document.uri.toString());
        const documentDocs = this.documentationService.getDocumentDocs(document);

        for (const [funcName, doc] of materializeDocMap(documentDocs)) {
            docs.set(funcName, {
                ...doc,
                sourceKind: 'simulEfun'
            });
        }
    }

    private createSyntheticDocument(filePath: string, content: string): vscode.TextDocument {
        const lineStarts = this.buildLineStarts(content);
        const lines = content.split(/\r?\n/);

        const offsetAt = (position: vscode.Position): number => {
            const lineStart = lineStarts[position.line] ?? content.length;
            return Math.min(lineStart + position.character, content.length);
        };

        const positionAt = (offset: number): vscode.Position => {
            let line = 0;
            for (let index = 0; index < lineStarts.length; index += 1) {
                if (lineStarts[index] <= offset) {
                    line = index;
                } else {
                    break;
                }
            }

            return new vscode.Position(line, offset - lineStarts[line]);
        };

        return {
            uri: vscode.Uri.file(filePath),
            fileName: filePath,
            languageId: 'lpc',
            version: 1,
            lineCount: lineStarts.length,
            isDirty: false,
            isClosed: false,
            isUntitled: false,
            eol: vscode.EndOfLine.LF,
            getText: (range?: vscode.Range) => {
                if (!range) {
                    return content;
                }

                return content.slice(offsetAt(range.start), offsetAt(range.end));
            },
            lineAt: (line: number) => ({
                text: lines[line] ?? ''
            }),
            positionAt,
            offsetAt,
            save: async () => true,
            validateRange: (range: vscode.Range) => range,
            validatePosition: (position: vscode.Position) => position
        } as unknown as vscode.TextDocument;
    }

    private resolveIncludeDirective(
        statement: IncludeDirective,
        currentFilePath: string,
        mudlibRoot: string
    ): string | undefined {
        return this.resolveRelatedSourcePath(statement.value, currentFilePath, mudlibRoot, ['.c', '.h']);
    }

    private resolveInheritDirective(
        statement: InheritDirective,
        currentFilePath: string,
        mudlibRoot: string
    ): string | undefined {
        return this.resolveRelatedSourcePath(statement.value, currentFilePath, mudlibRoot, ['.c']);
    }

    private resolveRelatedSourcePath(
        targetPath: string,
        currentFilePath: string,
        mudlibRoot: string,
        extensions: string[]
    ): string | undefined {
        const resolvedBase = targetPath.startsWith('/')
            ? path.join(mudlibRoot, targetPath.slice(1))
            : path.resolve(path.dirname(currentFilePath), targetPath);

        const candidates = path.extname(resolvedBase)
            ? [resolvedBase]
            : [resolvedBase, ...extensions.map((extension) => `${resolvedBase}${extension}`)];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        return undefined;
    }

    private getWorkspaceRoot(document?: vscode.TextDocument): string | undefined {
        if (document) {
            return vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath
                ?? this.findWorkspaceRootContainingDocument(document);
        }

        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    private findWorkspaceRootContainingDocument(document: vscode.TextDocument): string | undefined {
        const documentPath = path.normalize(document.uri.fsPath).toLowerCase();
        return vscode.workspace.workspaceFolders
            ?.map((folder) => folder.uri.fsPath)
            .find((workspaceRoot) => {
                const normalizedRoot = path.normalize(workspaceRoot).toLowerCase();
                return documentPath === normalizedRoot || documentPath.startsWith(`${normalizedRoot}${path.sep}`);
            });
    }

    private buildLineStarts(content: string): number[] {
        const lineStarts = [0];
        for (let index = 0; index < content.length; index += 1) {
            if (content[index] === '\n') {
                lineStarts.push(index + 1);
            }
        }

        return lineStarts;
    }
}

function materializeDocMap(documentDocs: DocumentCallableDocs): Map<string, CallableDoc> {
    const docs = new Map<string, CallableDoc>();

    for (const [name, declarationKeys] of documentDocs.byName.entries()) {
        const preferredDeclarationKey = declarationKeys[0];
        if (!preferredDeclarationKey || docs.has(name)) {
            continue;
        }

        const callableDoc = documentDocs.byDeclaration.get(preferredDeclarationKey);
        if (callableDoc) {
            docs.set(name, callableDoc);
        }
    }

    return docs;
}

interface SimulatedEfunWorkspaceState {
    docs: Map<string, CallableDoc>;
    hasLoaded: boolean;
    loadVersion: number;
}
