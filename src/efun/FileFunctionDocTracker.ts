import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { CallableDoc, DocumentCallableDocs } from '../language/documentation/types';
import { FunctionDocLookupBuilder, type FunctionDocLookupBuildOptions } from './FunctionDocLookupBuilder';
import type {
    FunctionDocLookup,
    FunctionDocSourceGroup,
    MaterializedFunctionDocLookup,
    RawFunctionDocLookup
} from './FunctionDocLookupTypes';

export type { FunctionDocLookup, FunctionDocSourceGroup } from './FunctionDocLookupTypes';

interface FileFunctionDocTrackerOptions {
    documentationService?: FunctionDocumentationService;
    lookupBuilder?: Pick<FunctionDocLookupBuilder, 'buildLookup'>;
}

interface CachedDocumentDocsEntry extends MaterializedFunctionDocLookup {
    version: number;
    text: string;
}

export class FileFunctionDocTracker {
    private readonly lookupBuilder: Pick<FunctionDocLookupBuilder, 'buildLookup'>;
    private readonly documentationService: FunctionDocumentationService;
    private readonly documentLookupCache = new Map<string, CachedDocumentDocsEntry>();

    public constructor(options: FileFunctionDocTrackerOptions) {
        this.documentationService = assertDocumentationService('FileFunctionDocTracker', options.documentationService);
        this.lookupBuilder = options.lookupBuilder
            ?? (() => {
                throw new Error('FileFunctionDocTracker requires an injected FunctionDocLookupBuilder');
            })();
    }

    public async getDocFromIncludes(
        document: vscode.TextDocument,
        name: string,
        options?: FunctionDocLookupBuildOptions
    ): Promise<CallableDoc | undefined> {
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
        name: string,
        options?: FunctionDocLookupBuildOptions
    ): Promise<CallableDoc | undefined> {
        if (options?.forceFresh) {
            this.documentationService.invalidate(document.uri.toString());
        }

        const currentDoc = this.documentationService.getDocsByName(document, name)[0];
        return currentDoc
            ? {
                ...currentDoc,
                sourceKind: 'local'
            }
            : undefined;
    }

    public async getDocFromInheritedForDocument(
        document: vscode.TextDocument,
        name: string,
        options?: FunctionDocLookupBuildOptions
    ): Promise<CallableDoc | undefined> {
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
        options?: FunctionDocLookupBuildOptions
    ): Promise<FunctionDocLookup> {
        const lookup = await this.getOrBuildDocumentLookup(document, options);
        return lookup.lookup;
    }


    private async getOrBuildDocumentLookup(
        document: vscode.TextDocument,
        options?: FunctionDocLookupBuildOptions
    ): Promise<MaterializedFunctionDocLookup> {
        const uri = this.getCacheKey(document, options);
        const version = document.version;
        const text = document.getText();
        const cached = this.documentLookupCache.get(uri);
        if (!options?.forceFresh && cached && cached.version === version && cached.text === text) {
            return {
                inheritedFiles: [...cached.inheritedFiles],
                currentFileDocs: cached.currentFileDocs,
                inheritedFileDocs: cached.inheritedFileDocs,
                includeFileDocs: cached.includeFileDocs,
                diagnostics: cached.diagnostics ? [...cached.diagnostics] : undefined,
                lookup: cached.lookup
            };
        }

        const lookup = this.materializeLookup(await this.lookupBuilder.buildLookup(document, options));
        const wasCancelled = lookup.diagnostics?.some((diagnostic) => diagnostic.code === 'analysis-cancelled') === true;
        if (!wasCancelled && document.version === version && document.getText() === text) {
            this.documentLookupCache.set(uri, {
                version,
                text,
                ...lookup
            });
        }

        return lookup;
    }

    private getCacheKey(document: vscode.TextDocument, options?: FunctionDocLookupBuildOptions): string {
        const projectConfig = options?.projectConfig;
        if (!projectConfig) {
            return `${document.uri.toString()}::default`;
        }

        return `${document.uri.toString()}::${JSON.stringify({
            projectConfigPath: projectConfig.projectConfigPath,
            configHellPath: projectConfig.configHellPath,
            preprocessorDefines: projectConfig.preprocessorDefines ?? [],
            instanceResolutionFunctions: projectConfig.instanceResolutionFunctions ?? {},
            resolvedConfig: projectConfig.resolvedConfig,
            lastSyncedAt: projectConfig.lastSyncedAt,
            searchEfunDefinitionInInheritanceChain: projectConfig.searchEfunDefinitionInInheritanceChain
        })}`;
    }

    private materializeLookup(rawLookup: RawFunctionDocLookup): MaterializedFunctionDocLookup {
        const currentFile = materializeSourceGroup(rawLookup.currentFile);
        const inheritedGroups = rawLookup.inheritedGroups.map(materializeSourceGroup);
        const includeGroups = rawLookup.includeGroups.map(materializeSourceGroup);

        return {
            inheritedFiles: [...rawLookup.inheritedFiles],
            currentFileDocs: currentFile.docs,
            inheritedFileDocs: materializeGroupedMaps(inheritedGroups),
            includeFileDocs: materializeGroupedMaps(includeGroups),
            diagnostics: rawLookup.diagnostics ? [...rawLookup.diagnostics] : undefined,
            lookup: {
                currentFile,
                inheritedGroups,
                includeGroups,
                diagnostics: rawLookup.diagnostics ? [...rawLookup.diagnostics] : undefined
            }
        };
    }
}

function materializeSourceGroup(source: RawFunctionDocLookup['currentFile']): FunctionDocSourceGroup {
    const entries = materializeDocEntries(source.docs, source.sourceKind);
    return {
        source: source.source,
        filePath: source.filePath,
        sourceKind: source.sourceKind,
        entries,
        docs: materializeDocMap(entries),
        depth: source.depth,
        parentFilePath: source.parentFilePath
    };
}

function materializeDocEntries(
    documentDocs: DocumentCallableDocs,
    sourceKind: RawFunctionDocLookup['currentFile']['sourceKind']
): CallableDoc[] {
    return documentDocs.declarationOrder
        .map((declarationKey) => documentDocs.byDeclaration.get(declarationKey))
        .filter((callableDoc): callableDoc is CallableDoc => Boolean(callableDoc))
        .map((callableDoc) => ({
            ...callableDoc,
            sourceKind
        }));
}

function materializeDocMap(entries: CallableDoc[]): Map<string, CallableDoc> {
    const docs = new Map<string, CallableDoc>();

    for (const callableDoc of entries) {
        if (docs.has(callableDoc.name)) {
            continue;
        }
        docs.set(callableDoc.name, callableDoc);
    }

    return docs;
}

function materializeGroupedMaps(
    groups: FunctionDocSourceGroup[]
): Map<string, Map<string, CallableDoc>> {
    return new Map(groups.map((group) => [group.filePath, group.docs]));
}
