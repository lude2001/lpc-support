import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import {
    WorkspaceDocumentPathSupport,
    assertDocumentPathSupport
} from '../language/shared/WorkspaceDocumentPathSupport';
import type { MacroManager } from '../macroManager';
import { FunctionDocCompatMaterializer } from './FunctionDocCompatMaterializer';
import { FunctionDocLookupBuilder } from './FunctionDocLookupBuilder';
import type {
    FunctionDocLookup,
    FunctionDocSourceGroup,
    MaterializedFunctionDocLookup,
    RawFunctionDocLookup
} from './FunctionDocLookupTypes';
import type { EfunDoc } from './types';

export type { FunctionDocLookup, FunctionDocSourceGroup } from './FunctionDocLookupTypes';

interface FileFunctionDocTrackerOptions {
    documentationService?: FunctionDocumentationService;
    macroManager?: Pick<MacroManager, 'getMacro'>;
    pathSupport?: WorkspaceDocumentPathSupport;
    compatMaterializer?: FunctionDocCompatMaterializer;
    lookupBuilder?: Pick<FunctionDocLookupBuilder, 'buildLookup'>;
}

interface CachedDocumentDocsEntry extends MaterializedFunctionDocLookup {
    version: number;
    text: string;
}

export class FileFunctionDocTracker {
    private readonly compatMaterializer: FunctionDocCompatMaterializer;
    private readonly lookupBuilder: Pick<FunctionDocLookupBuilder, 'buildLookup'>;
    private readonly documentLookupCache = new Map<string, CachedDocumentDocsEntry>();
    private currentFileDocs: Map<string, EfunDoc> = new Map();
    private inheritedFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    private includeFileDocs: Map<string, Map<string, EfunDoc>> = new Map();
    private currentFilePath = '';
    private inheritedFiles: string[] = [];
    private currentFileUpdatePromise: Promise<void> | undefined;
    private currentDocumentVersion = -1;
    private currentFileUpdateVersion = 0;

    public constructor(options: FileFunctionDocTrackerOptions = {}) {
        const documentationService = assertDocumentationService('FileFunctionDocTracker', options.documentationService);
        const pathSupport = assertDocumentPathSupport('FileFunctionDocTracker', options.pathSupport);
        this.compatMaterializer = options.compatMaterializer ?? new FunctionDocCompatMaterializer();
        this.lookupBuilder = options.lookupBuilder ?? new FunctionDocLookupBuilder({
            documentationService,
            pathSupport
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
        const lookup = await this.getOrBuildDocumentLookup(document, options);
        for (const funcDocs of lookup.includeFileDocs.values()) {
            const doc = funcDocs.get(name);
            if (doc) {
                return doc;
            }
        }

        return undefined;
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
        return lookup.lookup;
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

    public isCurrentDocument(document: vscode.TextDocument): boolean {
        return document.uri.fsPath === this.currentFilePath;
    }

    public async waitForPendingUpdate(): Promise<void> {
        if (this.currentFileUpdatePromise) {
            await this.currentFileUpdatePromise;
        }
    }

    private async performUpdate(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'lpc' && !document.fileName.endsWith('.c')) {
            return;
        }

        const updateVersion = ++this.currentFileUpdateVersion;
        const lookup = this.materializeLookup(await this.lookupBuilder.buildLookup(document));

        if (updateVersion !== this.currentFileUpdateVersion) {
            return;
        }

        this.currentFilePath = document.uri.fsPath;
        this.currentDocumentVersion = document.version;
        this.currentFileDocs = lookup.currentFileDocs;
        this.inheritedFiles = [...lookup.inheritedFiles];
        this.inheritedFileDocs = lookup.inheritedFileDocs;
        this.includeFileDocs = lookup.includeFileDocs;
        this.documentLookupCache.set(document.uri.toString(), {
            version: document.version,
            text: document.getText(),
            ...lookup
        });
    }

    private async getOrBuildDocumentLookup(
        document: vscode.TextDocument,
        options?: { forceFresh?: boolean }
    ): Promise<MaterializedFunctionDocLookup> {
        const uri = document.uri.toString();
        const text = document.getText();
        const cached = this.documentLookupCache.get(uri);
        if (!options?.forceFresh && cached && cached.version === document.version && cached.text === text) {
            return {
                inheritedFiles: [...cached.inheritedFiles],
                currentFileDocs: cached.currentFileDocs,
                inheritedFileDocs: cached.inheritedFileDocs,
                includeFileDocs: cached.includeFileDocs,
                lookup: cached.lookup
            };
        }

        const lookup = this.materializeLookup(await this.lookupBuilder.buildLookup(document, options));
        this.documentLookupCache.set(uri, {
            version: document.version,
            text,
            ...lookup
        });

        return lookup;
    }

    private materializeLookup(rawLookup: RawFunctionDocLookup): MaterializedFunctionDocLookup {
        return this.compatMaterializer.materializeLookup(rawLookup);
    }
}
