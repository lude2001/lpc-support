import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { InheritDirective, IncludeDirective } from '../semantic/documentSemanticTypes';
import { assertAnalysisService } from '../semantic/assertAnalysisService';
import type { DocumentAnalysisService } from '../semantic/documentAnalysisService';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { FunctionDocCompatMaterializer } from './FunctionDocCompatMaterializer';
import type { EfunDoc } from './types';

type SimulatedEfunAnalysisService = Pick<DocumentAnalysisService, 'parseDocument'>;

export class SimulatedEfunScanner {
    private docs: Map<string, EfunDoc> = new Map();
    private readonly analysisService: SimulatedEfunAnalysisService;
    private readonly documentationService: FunctionDocumentationService;
    private readonly compatMaterializer: FunctionDocCompatMaterializer;
    private hasLoadedWorkspaceState = false;
    private loadedWorkspaceRoot: string | undefined;
    private loadVersion = 0;

    constructor(
        private readonly projectConfigService: LpcProjectConfigService | undefined,
        analysisService: SimulatedEfunAnalysisService,
        documentationService?: FunctionDocumentationService,
        compatMaterializer?: FunctionDocCompatMaterializer
    ) {
        this.analysisService = assertAnalysisService('SimulatedEfunScanner', analysisService);
        this.documentationService = assertDocumentationService('SimulatedEfunScanner', documentationService);
        this.compatMaterializer = compatMaterializer
            ?? (() => {
                throw new Error('SimulatedEfunScanner requires an injected FunctionDocCompatMaterializer');
            })();
    }

    public get(name: string): EfunDoc | undefined {
        return this.docs.get(name);
    }

    public async getAsync(name: string): Promise<EfunDoc | undefined> {
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
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot || !this.projectConfigService) {
            vscode.window.showErrorMessage('当前工作区缺少可写入的 lpc-support.json，无法配置模拟函数入口文件。');
            return;
        }

        const selectedFile = await this.selectSimulatedEfunEntryFile();
        if (!selectedFile) {
            return;
        }

        const workspaceRelativePath = this.projectConfigService.toWorkspaceRelativePath(workspaceRoot, selectedFile.fsPath);
        await this.projectConfigService.updateResolvedConfigForWorkspace(workspaceRoot, (resolvedConfig) => ({
            ...resolvedConfig,
            simulatedEfunFile: workspaceRelativePath
        }));

        await this.loadSimulatedEfuns();
        vscode.window.showInformationMessage('模拟函数入口文件已更新');
    }

    public async loadSimulatedEfuns(): Promise<void> {
        const loadVersion = ++this.loadVersion;
        const nextDocs = await this.collectSimulatedEfuns();
        if (loadVersion === this.loadVersion) {
            this.docs = nextDocs;
        }
    }

    private async collectSimulatedEfuns(): Promise<Map<string, EfunDoc>> {
        const docs = new Map<string, EfunDoc>();

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
        docs: Map<string, EfunDoc>
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

    private storeParsedDocs(filePath: string, text: string, docs: Map<string, EfunDoc>): void {
        const document = this.createSyntheticDocument(
            filePath,
            normalizeLegacySimulatedDeclarations(text)
        );
        this.documentationService.invalidate(document.uri.toString());
        const documentDocs = this.documentationService.getDocumentDocs(document);
        const compatDocs = this.compatMaterializer.materializeDocMap(documentDocs, '模拟函数库');

        for (const [funcName, doc] of compatDocs) {
            docs.set(funcName, {
                ...doc,
                isSimulated: true
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

    private async selectSimulatedEfunEntryFile(): Promise<vscode.Uri | undefined> {
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: '选择模拟函数入口文件',
            filters: {
                'LPC Files': ['c', 'h']
            }
        });

        return files?.[0];
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

function normalizeLegacySimulatedDeclarations(content: string): string {
    const lines = content.split(/\r?\n/);
    const normalizedLines = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const trimmed = line.trim();
        if (!looksLikeCallablePrototype(trimmed) || trimmed.endsWith(';')) {
            continue;
        }

        const nextSignificantLine = findNextSignificantLine(lines, index + 1);
        if (nextSignificantLine?.trim().startsWith('{')) {
            continue;
        }

        normalizedLines[index] = `${line};`;
    }

    return normalizedLines.join('\n');
}

function looksLikeCallablePrototype(line: string): boolean {
    if (/^(?:if|else|for|foreach|while|do|switch|catch)\b/.test(line)) {
        return false;
    }

    return /^(?:private\s+|public\s+|protected\s+|static\s+|nomask\s+)*(?:varargs\s+)?(?:mixed|void|int|string|object|mapping|array|float|function|buffer|class|[A-Za-z_][A-Za-z0-9_]*)(?:\s+\**\s*|\*+\s*)[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*$/.test(line);
}

function findNextSignificantLine(lines: string[], startIndex: number): string | undefined {
    for (let index = startIndex; index < lines.length; index += 1) {
        const trimmed = lines[index].trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    return undefined;
}
