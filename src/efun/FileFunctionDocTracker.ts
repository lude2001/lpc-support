import * as vscode from 'vscode';
import * as path from 'path';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import type { CallableDoc, CallableSignature } from '../language/documentation/types';
import { WorkspaceDocumentPathSupport } from '../language/shared/WorkspaceDocumentPathSupport';
import type { MacroManager } from '../macroManager';
import type { EfunDoc } from './types';

export interface FunctionDocSourceGroup {
    source: string;
    filePath: string;
    docs: Map<string, EfunDoc>;
}

export interface FunctionDocLookup {
    currentFile: FunctionDocSourceGroup;
    inheritedGroups: FunctionDocSourceGroup[];
    includeGroups: FunctionDocSourceGroup[];
}

interface FileFunctionDocTrackerOptions {
    documentationService?: FunctionDocumentationService;
    macroManager?: Pick<MacroManager, 'getMacro'>;
    pathSupport?: WorkspaceDocumentPathSupport;
}

export class FileFunctionDocTracker {
    private readonly documentationService: FunctionDocumentationService;
    private readonly pathSupport: WorkspaceDocumentPathSupport;
    private readonly documentLookupCache = new Map<string, {
        version: number;
        text: string;
        currentFileDocs: Map<string, EfunDoc>;
        inheritedFileDocs: Map<string, Map<string, EfunDoc>>;
        includeFileDocs: Map<string, Map<string, EfunDoc>>;
    }>();
    private currentFileDocs: Map<string, EfunDoc> = new Map();
    private inheritedFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    private includeFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    private currentFilePath = '';
    private inheritedFiles: string[] = [];
    private currentFileUpdatePromise: Promise<void> | undefined;
    private currentDocumentVersion = -1;
    private currentFileUpdateVersion = 0;

    public constructor(options: FileFunctionDocTrackerOptions = {}) {
        this.documentationService = options.documentationService ?? new FunctionDocumentationService();
        this.pathSupport = options.pathSupport ?? new WorkspaceDocumentPathSupport({
            macroManager: options.macroManager
        });
    }

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
        name: string,
        options?: { forceFresh?: boolean }
    ): Promise<EfunDoc | undefined> {
        return this.findFunctionDocInIncludes(document, name, options);
    }

    public async getDocForDocument(
        document: vscode.TextDocument,
        name: string
    ): Promise<EfunDoc | undefined> {
        return (await this.getOrBuildDocumentLookup(document)).currentFileDocs.get(name);
    }

    public async getDocFromInheritedForDocument(
        document: vscode.TextDocument,
        name: string,
        options?: { forceFresh?: boolean }
    ): Promise<EfunDoc | undefined> {
        const lookup = await this.getOrBuildDocumentLookup(document, options);
        for (const funcDocs of lookup.inheritedFileDocs.values()) {
            const inheritedDoc = funcDocs.get(name);
            if (inheritedDoc) {
                return inheritedDoc;
            }
        }

        return undefined;
    }

    public async getFunctionDocLookup(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<FunctionDocLookup> {
        const lookup = await this.getOrBuildDocumentLookup(document, options);

        return {
            currentFile: {
                source: '当前文件',
                filePath: document.uri.fsPath,
                docs: lookup.currentFileDocs
            },
            inheritedGroups: this.materializeSourceGroups(lookup.inheritedFileDocs, '继承自'),
            includeGroups: this.materializeSourceGroups(lookup.includeFileDocs, '包含自')
        };
    }

    public async update(document: vscode.TextDocument): Promise<void> {
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
        const content = document.getText();
        const currentFileDocs = this.buildCompatDocsForDocument(document, '当前文件');
        const inheritedFiles = this.parseInheritStatements(content);
        const inheritedFileDocs = await this.loadInheritedFileDocs(document, inheritedFiles);
        const includeFileDocs = await this.loadIncludeFileDocs(document);

        if (updateVersion !== this.currentFileUpdateVersion) {
            return;
        }

        this.currentFilePath = document.uri.fsPath;
        this.currentDocumentVersion = document.version;
        this.currentFileDocs = currentFileDocs;
        this.inheritedFiles = [...inheritedFiles];
        this.inheritedFileDocs = inheritedFileDocs;
        this.includeFileDocs = includeFileDocs;
        this.documentLookupCache.set(document.uri.toString(), {
            version: document.version,
            text: content,
            currentFileDocs,
            inheritedFileDocs,
            includeFileDocs
        });
    }

    private async getOrBuildDocumentLookup(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<{
        currentFileDocs: Map<string, EfunDoc>;
        inheritedFileDocs: Map<string, Map<string, EfunDoc>>;
        includeFileDocs: Map<string, Map<string, EfunDoc>>;
    }> {
        const uri = document.uri.toString();
        const text = document.getText();
        const cached = this.documentLookupCache.get(uri);
        if (!options?.forceFresh && cached && cached.version === document.version && cached.text === text) {
            return {
                currentFileDocs: cached.currentFileDocs,
                inheritedFileDocs: cached.inheritedFileDocs,
                includeFileDocs: cached.includeFileDocs
            };
        }

        const currentFileDocs = this.buildCompatDocsForDocument(document, '当前文件', { forceFresh: true });
        const inheritedFileDocs = await this.loadInheritedFileDocs(document, this.parseInheritStatements(text), {
            forceFresh: true
        });
        const includeFileDocs = await this.loadIncludeFileDocs(document, { forceFresh: true });
        this.documentLookupCache.set(uri, {
            version: document.version,
            text,
            currentFileDocs,
            inheritedFileDocs,
            includeFileDocs
        });

        return {
            currentFileDocs,
            inheritedFileDocs,
            includeFileDocs
        };
    }

    private parseInheritStatements(content: string): string[] {
        const inheritFiles: string[] = [];
        const inheritPattern = /inherit\s+(?:"([^"]+)"|([A-Z_][A-Z0-9_]*))\s*;/g;

        let match: RegExpExecArray | null;
        while ((match = inheritPattern.exec(content)) !== null) {
            const inheritPath = (match[1] || match[2])?.trim();
            if (inheritPath) {
                inheritFiles.push(inheritPath);
            }
        }

        return inheritFiles;
    }

    private async loadInheritedFileDocs(
        document: vscode.TextDocument,
        inheritedFiles: readonly string[],
        options?: { forceFresh?: boolean }
    ): Promise<Map<string, Map<string, EfunDoc>>> {
        const inheritedFileDocs = new Map<string, Map<string, EfunDoc>>();
        if (!inheritedFiles.length) {
            return inheritedFileDocs;
        }

        const workspaceRoot = this.resolveWorkspaceRoot(document.uri.fsPath);

        for (const inheritPath of inheritedFiles) {
            const resolvedPath = this.pathSupport.resolveInheritedFilePath(
                document,
                inheritPath,
                workspaceRoot
            );
            if (!resolvedPath) {
                continue;
            }

            const candidatePaths = path.extname(resolvedPath)
                ? [resolvedPath, resolvedPath.replace(/\.c$/, '')]
                : [resolvedPath];

            for (const candidatePath of candidatePaths) {
                try {
                    if (!this.pathSupport.fileExists(candidatePath)) {
                        continue;
                    }

                    const inheritedDocument = await this.pathSupport.tryOpenTextDocument(candidatePath);
                    if (!inheritedDocument) {
                        continue;
                    }

                    const fileName = path.basename(candidatePath);
                    const funcDocs = this.buildCompatDocsForDocument(
                        inheritedDocument,
                        `继承自 ${fileName}`,
                        options
                    );
                    inheritedFileDocs.set(candidatePath, funcDocs);
                    break;
                } catch (error) {
                    console.error(`加载继承文件失败: ${candidatePath}`, error);
                }
            }
        }

        return inheritedFileDocs;
    }

    private async loadIncludeFileDocs(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<Map<string, Map<string, EfunDoc>>> {
        const includeFileDocs = new Map<string, Map<string, EfunDoc>>();
        const includeFiles = await this.getIncludeFiles(document);

        for (const includeFile of includeFiles) {
            if (!includeFile.endsWith('.h') && !includeFile.endsWith('.c')) {
                continue;
            }

            const includeDocument = await this.pathSupport.tryOpenTextDocument(includeFile);
            if (!includeDocument) {
                continue;
            }

            const fileName = path.basename(includeFile);
            const funcDocs = this.buildCompatDocsForDocument(
                includeDocument,
                `包含自 ${fileName}`,
                options
            );
            includeFileDocs.set(includeFile, funcDocs);
        }

        return includeFileDocs;
    }

    public async findFunctionDocInIncludes(
        document: vscode.TextDocument,
        functionName: string,
        options?: { forceFresh?: boolean }
    ): Promise<EfunDoc | undefined> {
        try {
            const includeFileDocs = await this.loadIncludeFileDocs(document, options);

            for (const funcDocs of includeFileDocs.values()) {
                const doc = funcDocs.get(functionName);
                if (doc) {
                    return doc;
                }
            }
        } catch {
            // 静默处理错误
        }

        return undefined;
    }

    private async getIncludeFiles(document: vscode.TextDocument): Promise<string[]> {
        const includeFiles: string[] = [];
        const content = document.getText();
        const workspaceRoot = this.resolveWorkspaceRoot(document.uri.fsPath);
        const includeRegex = /^\s*#?include\s+([<"])([^\s">]+)[>"](?:\s*\/\/.*)?$/gm;

        let match: RegExpExecArray | null;
        while ((match = includeRegex.exec(content)) !== null) {
            const isSystemInclude = match[1] === '<';
            const includePath = match[2];
            const candidatePaths = await this.pathSupport.resolveIncludeFilePaths(
                document,
                includePath,
                isSystemInclude,
                workspaceRoot
            );

            const fallbackPaths = !path.extname(includePath)
                ? candidatePaths.map((candidatePath) => candidatePath.replace(/\.h$/, ''))
                : [];

            for (const filePath of [...candidatePaths, ...fallbackPaths]) {
                if (this.pathSupport.fileExists(filePath)) {
                    includeFiles.push(filePath);
                    break;
                }
            }
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

    private buildCompatDocsForDocument(
        document: vscode.TextDocument,
        category: string,
        options?: { forceFresh?: boolean }
    ): Map<string, EfunDoc> {
        if (options?.forceFresh) {
            this.documentationService.invalidate(document.uri.toString());
        }
        const documentDocs = this.documentationService.getDocumentDocs(document);
        const docs = new Map<string, EfunDoc>();

        for (const [name, declarationKeys] of documentDocs.byName.entries()) {
            const preferredDeclarationKey = declarationKeys[0];
            if (!preferredDeclarationKey || docs.has(name)) {
                continue;
            }

            const callableDoc = documentDocs.byDeclaration.get(preferredDeclarationKey);
            if (!callableDoc) {
                continue;
            }

            docs.set(name, this.materializeCompatDoc(callableDoc, category));
        }

        return docs;
    }

    private materializeSourceGroups(
        docsByFilePath: Map<string, Map<string, EfunDoc>>,
        fallbackPrefix: string
    ): FunctionDocSourceGroup[] {
        return Array.from(docsByFilePath.entries())
            .map(([filePath, docs]) => ({
                source: Array.from(docs.values())[0]?.category ?? `${fallbackPrefix} ${path.basename(filePath)}`,
                filePath,
                docs
            }))
            .filter((group) => group.docs.size > 0);
    }

    private materializeCompatDoc(callableDoc: CallableDoc, category: string): EfunDoc {
        return {
            name: callableDoc.name,
            syntax: callableDoc.signatures.map((signature) => signature.label).join('\n'),
            description: callableDoc.summary ?? '',
            sourceFile: callableDoc.sourcePath,
            sourceRange: callableDoc.sourceRange,
            returnType: deriveCompatReturnType(callableDoc.signatures),
            returnValue: callableDoc.returns?.description,
            returnObjects: callableDoc.returnObjects ? [...callableDoc.returnObjects] : undefined,
            details: callableDoc.details,
            note: callableDoc.note,
            category,
            lastUpdated: Date.now(),
            signatures: callableDoc.signatures.map((signature) => ({
                label: signature.label,
                returnType: signature.returnType,
                isVariadic: signature.isVariadic,
                parameters: signature.parameters.map((parameter) => ({
                    name: parameter.name,
                    type: parameter.type,
                    description: parameter.description,
                    optional: parameter.optional,
                    variadic: parameter.variadic
                }))
            }))
        };
    }
}

function deriveCompatReturnType(signatures: CallableSignature[]): string | undefined {
    if (signatures.length === 0) {
        return undefined;
    }

    if (signatures.length === 1) {
        return signatures[0].returnType;
    }

    const returnTypes = signatures.map((signature) => signature.returnType?.trim()).filter(Boolean);
    if (returnTypes.length !== signatures.length) {
        return undefined;
    }

    const [firstReturnType, ...restReturnTypes] = returnTypes;
    return restReturnTypes.every((returnType) => returnType === firstReturnType)
        ? firstReturnType
        : undefined;
}
