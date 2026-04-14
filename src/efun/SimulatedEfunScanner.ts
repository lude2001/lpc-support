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
        this.docs.clear();

        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        const simulatedEfunEntryFile = this.projectConfigService
            ? await this.projectConfigService.getSimulatedEfunFileForWorkspace(workspaceRoot)
            : undefined;
        if (!simulatedEfunEntryFile) {
            return;
        }

        try {
            await this.loadFromProjectConfigEntry(workspaceRoot, simulatedEfunEntryFile);
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
            this.storeParsedDocs(currentFile, text);

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
            ...analysis.snapshot.includeStatements.map((statement) =>
                this.resolveIncludeDirective(statement, currentFilePath, mudlibRoot)
            ),
            ...this.extractDirectiveIncludeFiles(
                analysis.parsed?.tokenTriviaIndex.getAllTrivia() ?? [],
                currentFilePath,
                mudlibRoot
            ),
            ...analysis.snapshot.inheritStatements.map((statement) =>
                this.resolveInheritDirective(statement, currentFilePath, mudlibRoot)
            )
        ];

        return relatedFiles.filter((filePath): filePath is string => Boolean(filePath));
    }

    private storeParsedDocs(filePath: string, text: string): void {
        const functionDocs = parseFunctionDocs(text, '模拟函数库', {
            isSimulated: true,
            sourceFile: filePath
        });

        for (const [funcName, doc] of functionDocs) {
            this.docs.set(funcName, doc);
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
