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

    public constructor(options: FileFunctionDocTrackerOptions) {
        assertDocumentationService('FileFunctionDocTracker', options.documentationService);
        this.compatMaterializer = options.compatMaterializer
            ?? (() => {
                throw new Error('FileFunctionDocTracker requires an injected FunctionDocCompatMaterializer');
            })();
        this.lookupBuilder = options.lookupBuilder
            ?? (() => {
                throw new Error('FileFunctionDocTracker requires an injected FunctionDocLookupBuilder');
            })();
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
