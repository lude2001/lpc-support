import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseFunctionDocs } from './docParser';
import type { EfunDoc } from './types';

export class FileFunctionDocTracker {
    private currentFileDocs: Map<string, EfunDoc> = new Map();
    private inheritedFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    private currentFilePath = '';
    private inheritedFiles: string[] = [];
    private currentFileUpdatePromise: Promise<void> | undefined;
    private currentDocumentVersion = -1;

    private currentFileUpdateVersion = 0;

    public getDoc(name: string): EfunDoc | undefined {
        return this.currentFileDocs.get(name);
    }

    public getDocFromInherited(name: string): EfunDoc | undefined {
        for (const funcDocs of this.inheritedFileDocs.values()) {
            const inheritedDoc = funcDocs.get(name);
            if (inheritedDoc) {
                return inheritedDoc;
            }
        }

        return undefined;
    }

    public async getDocFromIncludes(
        document: vscode.TextDocument,
        name: string
    ): Promise<EfunDoc | undefined> {
        return this.findFunctionDocInIncludes(document, name);
    }

    public async update(
        document: vscode.TextDocument
    ): Promise<void> {
        if (document.uri.fsPath === this.currentFilePath && document.version === this.currentDocumentVersion) {
            if (this.currentFileUpdatePromise) {
                await this.currentFileUpdatePromise;
            }
            return;
        }

        const updatePromise = this.performUpdate(document);
        this.currentFileUpdatePromise = updatePromise;

        try {
            await updatePromise;
        } finally {
            if (this.currentFileUpdatePromise === updatePromise) {
                this.currentFileUpdatePromise = undefined;
            }
        }
    }

    private async performUpdate(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'lpc' && !document.fileName.endsWith('.c')) {
            return;
        }

        const updateVersion = ++this.currentFileUpdateVersion;
        const currentFilePath = document.uri.fsPath;
        const content = document.getText();
        const currentFileDocs = parseFunctionDocs(content, '当前文件');
        const inheritedFiles = this.parseInheritStatements(content);
        const inheritedFileDocs = await this.loadInheritedFileDocs(currentFilePath, inheritedFiles);

        if (updateVersion !== this.currentFileUpdateVersion) {
            return;
        }

        this.currentFilePath = currentFilePath;
        this.currentDocumentVersion = document.version;
        this.currentFileDocs = currentFileDocs;
        this.inheritedFiles = [...inheritedFiles];
        this.inheritedFileDocs = inheritedFileDocs;
    }

    private parseInheritStatements(content: string): string[] {
        const inheritFiles: string[] = [];
        const inheritPattern = /inherit\s+["']([^"']+)["']\s*;/g;

        let match: RegExpExecArray | null;
        while ((match = inheritPattern.exec(content)) !== null) {
            const [, inheritPath] = match;
            inheritFiles.push(inheritPath);
        }

        return inheritFiles;
    }

    private async loadInheritedFileDocs(
        currentFilePath: string,
        inheritedFiles: readonly string[]
    ): Promise<Map<string, Map<string, EfunDoc>>> {
        const inheritedFileDocs = new Map<string, Map<string, EfunDoc>>();
        if (!inheritedFiles.length) {
            return inheritedFileDocs;
        }

        try {
            const workspaceRoot = this.resolveWorkspaceRoot(currentFilePath);

            for (const inheritPath of inheritedFiles) {
                const possiblePaths = [
                    ...(workspaceRoot ? [
                        path.join(workspaceRoot, inheritPath),
                        path.join(workspaceRoot, inheritPath + '.c')
                    ] : []),
                    path.join(path.dirname(currentFilePath), inheritPath),
                    path.join(path.dirname(currentFilePath), inheritPath + '.c')
                ];

                for (const filePath of possiblePaths) {
                    try {
                        if (fs.existsSync(filePath)) {
                            const content = fs.readFileSync(filePath, 'utf8');
                            const fileName = path.basename(filePath);
                            const funcDocs = parseFunctionDocs(content, `继承自 ${fileName}`);
                            inheritedFileDocs.set(filePath, funcDocs);
                            break;
                        }
                    } catch (error) {
                        console.error(`加载继承文件失败: ${filePath}`, error);
                    }
                }
            }
        } catch (error) {
            console.error('加载继承文件文档失败:', error);
        }

        return inheritedFileDocs;
    }

    public async findFunctionDocInIncludes(
        document: vscode.TextDocument,
        functionName: string
    ): Promise<EfunDoc | undefined> {
        try {
            const includeFiles = await this.getIncludeFiles(document);

            for (const includeFile of includeFiles) {
                if (!includeFile.endsWith('.h') && !includeFile.endsWith('.c')) {
                    continue;
                }

                try {
                    const content = await fs.promises.readFile(includeFile, 'utf-8');
                    const fileName = path.basename(includeFile);
                    const funcDocs = parseFunctionDocs(content, `包含自 ${fileName}`);
                    const doc = funcDocs.get(functionName);
                    if (doc) {
                        return doc;
                    }
                } catch {
                    // 静默处理错误，继续处理下一个文件
                }
            }
        } catch {
            // 静默处理错误
        }

        return undefined;
    }

    private async getIncludeFiles(document: vscode.TextDocument): Promise<string[]> {
        const includeFiles: string[] = [];

        try {
            const content = document.getText();
            const lines = content.split('\n');
            const currentDir = path.dirname(document.uri.fsPath);
            const workspaceRoot = this.resolveWorkspaceRoot(document.uri.fsPath);

            for (const line of lines) {
                const trimmedLine = line.trim();
                const includeMatch = trimmedLine.match(/^#?include\s+[<"]([^>"]+)[>"](?:\s*\/\/.*)?$/);
                if (!includeMatch) {
                    continue;
                }

                let includePath = includeMatch[1];
                if (!includePath.endsWith('.h') && !includePath.endsWith('.c')) {
                    includePath += '.h';
                }

                let resolvedPath: string;
                if (/^(?:[\\/]|[A-Za-z]:[\\/])/.test(includePath)) {
                    if (workspaceRoot && !/^[A-Za-z]:[\\/]/.test(includePath)) {
                        resolvedPath = path.join(workspaceRoot, includePath.replace(/^[/\\]+/, ''));
                    } else {
                        resolvedPath = includePath;
                    }
                } else {
                    resolvedPath = path.resolve(currentDir, includePath);
                }

                try {
                    await fs.promises.access(resolvedPath);
                    includeFiles.push(resolvedPath);
                } catch {
                    // 文件不存在，跳过
                }
            }
        } catch {
            // 静默处理错误
        }

        return includeFiles;
    }

    public isCurrentDocument(document: vscode.TextDocument): boolean {
        return document.uri.fsPath === this.currentFilePath;
    }

    public async waitForPendingUpdate(): Promise<void> {
        if (this.currentFileUpdatePromise) {
            await this.currentFileUpdatePromise;
        }
    }

    private resolveWorkspaceRoot(filePath: string): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }

        const normalizedPath = path.resolve(filePath);
        const matchingFolders = workspaceFolders
            .map(folder => folder.uri.fsPath)
            .filter(root => normalizedPath.startsWith(path.resolve(root)))
            .sort((left, right) => right.length - left.length);

        return matchingFolders[0] ?? workspaceFolders[0].uri.fsPath;
    }
}
