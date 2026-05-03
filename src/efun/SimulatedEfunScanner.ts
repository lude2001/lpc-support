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
    private docs: Map<string, CallableDoc> = new Map();
    private readonly analysisService: SimulatedEfunAnalysisService;
    private readonly documentationService: FunctionDocumentationService;
    private hasLoadedWorkspaceState = false;
    private loadedWorkspaceRoot: string | undefined;
    private loadVersion = 0;

    constructor(
        private readonly projectConfigService: LpcProjectConfigService | undefined,
        analysisService: SimulatedEfunAnalysisService,
        documentationService?: FunctionDocumentationService
    ) {
        this.analysisService = assertAnalysisService('SimulatedEfunScanner', analysisService);
        this.documentationService = assertDocumentationService('SimulatedEfunScanner', documentationService);
    }

    public get(name: string): CallableDoc | undefined {
        return this.docs.get(name);
    }

    public async getAsync(name: string): Promise<CallableDoc | undefined> {
        await this.ensureWorkspaceStateCurrent();
        if (!this.hasLoadedWorkspaceState) {
            await this.refreshWorkspaceState(true);
        }

        return this.get(name);
    }

    public getAllNames(): string[] {
        return Array.from(this.docs.keys());
    }

    public async configure(): Promise<void> {
        return this.configureSimulatedEfuns();
    }

    public async load(): Promise<void> {
        return this.loadSimulatedEfuns();
    }

    public async refreshWorkspaceState(force: boolean = false): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!force && this.hasLoadedWorkspaceState && workspaceRoot === this.loadedWorkspaceRoot) {
            return;
        }

        if (force) {
            this.hasLoadedWorkspaceState = false;
        }

        const loadVersion = ++this.loadVersion;
        const nextDocs = await this.collectSimulatedEfuns();
        if (loadVersion !== this.loadVersion) {
            return;
        }

        this.docs = nextDocs;
        this.hasLoadedWorkspaceState = true;
        this.loadedWorkspaceRoot = workspaceRoot;
    }

    public async configureSimulatedEfuns(): Promise<void> {
        vscode.window.showInformationMessage('模拟函数入口文件来自 config.hell 的 simulated efun file，请修改 lpc-support.json 的 configHellPath 或对应 driver 配置文件。');
    }

    public async loadSimulatedEfuns(): Promise<void> {
        const loadVersion = ++this.loadVersion;
        const nextDocs = await this.collectSimulatedEfuns();
        if (loadVersion === this.loadVersion) {
            this.docs = nextDocs;
        }
    }

    private async collectSimulatedEfuns(): Promise<Map<string, CallableDoc>> {
        const docs = new Map<string, CallableDoc>();

        const workspaceRoot = this.getWorkspaceRoot();
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

    private async ensureWorkspaceStateCurrent(): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!this.hasLoadedWorkspaceState || workspaceRoot !== this.loadedWorkspaceRoot) {
            await this.refreshWorkspaceState(true);
        }
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

    private getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
