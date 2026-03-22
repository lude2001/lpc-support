import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ASTManager } from '../ast/astManager';
import type { InheritDirective, IncludeDirective } from '../completion/types';
import { Trivia } from '../parser/types';
import { LpcProjectConfigService } from '../projectConfig/LpcProjectConfigService';
import { parseFunctionDocs } from './docParser';
import type { EfunDoc } from './types';

export class SimulatedEfunScanner {
    private static readonly SIMULATED_EFUNS_PATH_CONFIG = 'lpc.simulatedEfunsPath';
    private docs: Map<string, EfunDoc> = new Map();

    constructor(private readonly projectConfigService?: LpcProjectConfigService) {}

    public get(name: string): EfunDoc | undefined {
        return this.docs.get(name);
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

    public async configureSimulatedEfuns(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: '选择模拟函数库目录'
        };

        const folders = await vscode.window.showOpenDialog(options);
        if (!folders || !folders[0]) {
            return;
        }

        await vscode.workspace.getConfiguration().update(
            SimulatedEfunScanner.SIMULATED_EFUNS_PATH_CONFIG,
            folders[0].fsPath,
            vscode.ConfigurationTarget.Global
        );

        await this.loadSimulatedEfuns();
        vscode.window.showInformationMessage('模拟函数库目录已更新');
    }

    public async loadSimulatedEfuns(): Promise<void> {
        this.docs.clear();

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const projectConfigPath = this.projectConfigService
            ? await this.projectConfigService.getSimulatedEfunFileForWorkspace(workspaceFolder.uri.fsPath)
            : undefined;
        const config = vscode.workspace.getConfiguration();
        const legacyConfigPath = config.get<string>(SimulatedEfunScanner.SIMULATED_EFUNS_PATH_CONFIG);

        if (!projectConfigPath && !legacyConfigPath) {
            return;
        }

        try {
            this.docs.clear();

            if (projectConfigPath) {
                await this.loadFromProjectConfigEntry(workspaceFolder.uri.fsPath, projectConfigPath);
                return;
            }

            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(
                    this.resolveProjectPath(workspaceFolder.uri.fsPath, legacyConfigPath!),
                    '**/*.{c,h}'
                )
            );

            for (const file of files) {
                await this.loadDocFile(file.fsPath);
            }
        } catch (error) {
            console.error('加载模拟函数库文档失败:', error);
        }
    }

    private async loadFromProjectConfigEntry(workspaceRoot: string, entryFilePath: string): Promise<void> {
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
            this.storeParsedDocs(text);

            for (const relationFile of this.extractRelatedSourceFiles(currentFile, text, mudlibRoot)) {
                if (!visited.has(path.normalize(relationFile))) {
                    queue.push(relationFile);
                }
            }
        }
    }

    private async resolveMudlibRoot(workspaceRoot: string): Promise<string> {
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
        const analysis = ASTManager.getInstance().parseDocument(document, false);
        const relatedFiles = [
            ...analysis.snapshot.includeStatements.map((statement) => this.resolveIncludeDirective(statement, currentFilePath, mudlibRoot)),
            ...this.extractDirectiveIncludeFiles(analysis.parsed?.tokenTriviaIndex.getAllTrivia() ?? [], currentFilePath, mudlibRoot),
            ...analysis.snapshot.inheritStatements.map((statement) => this.resolveInheritDirective(statement, currentFilePath, mudlibRoot))
        ];

        return relatedFiles.filter((filePath): filePath is string => Boolean(filePath));
    }

    private async loadDocFile(filePath: string): Promise<void> {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const text = Buffer.from(content).toString('utf8');
        this.storeParsedDocs(text);
    }

    private storeParsedDocs(text: string): void {
        const functionDocs = parseFunctionDocs(text, '模拟函数库', { isSimulated: true });

        for (const [funcName, doc] of functionDocs) {
            this.docs.set(funcName, doc);
        }
    }

    public resolveProjectPath(workspaceRoot: string, configPath: string): string {
        if (path.isAbsolute(configPath)) {
            return configPath;
        }

        return path.join(workspaceRoot, configPath);
    }

    private createSyntheticDocument(filePath: string, content: string): vscode.TextDocument {
        const lineStarts = [0];
        for (let index = 0; index < content.length; index += 1) {
            if (content[index] === '\n') {
                lineStarts.push(index + 1);
            }
        }

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
                text: content.split(/\r?\n/)[line] ?? ''
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

    private extractDirectiveIncludeFiles(
        triviaEntries: Trivia[],
        currentFilePath: string,
        mudlibRoot: string
    ): Array<string | undefined> {
        return triviaEntries
            .filter((entry) => entry.kind === 'directive')
            .map((entry) => this.extractDirectiveIncludePath(entry.text))
            .filter((value): value is string => Boolean(value))
            .map((includePath) => this.resolveRelatedSourcePath(includePath, currentFilePath, mudlibRoot, ['.c', '.h']));
    }

    private extractDirectiveIncludePath(text: string): string | undefined {
        const trimmed = text.trim();
        if (!trimmed.startsWith('#include') && !trimmed.startsWith('include')) {
            return undefined;
        }

        const match = trimmed.match(/^#?include\s+[<"]([^>"]+)[>"]/);
        return match?.[1];
    }
}
