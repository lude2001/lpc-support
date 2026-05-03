import * as vscode from 'vscode';
import { FunctionDocumentationService } from '../language/documentation/FunctionDocumentationService';
import { assertDocumentationService } from '../language/documentation/assertDocumentationService';
import type { CallableDoc, DocumentCallableDocs } from '../language/documentation/types';
import { FunctionDocLookupBuilder } from './FunctionDocLookupBuilder';
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
    private readonly documentLookupCache = new Map<string, CachedDocumentDocsEntry>();

    public constructor(options: FileFunctionDocTrackerOptions) {
        assertDocumentationService('FileFunctionDocTracker', options.documentationService);
        this.lookupBuilder = options.lookupBuilder
            ?? (() => {
                throw new Error('FileFunctionDocTracker requires an injected FunctionDocLookupBuilder');
            })();
    }

    public async getDocFromIncludes(
        document: vscode.TextDocument,
        name: string,
        options?: { forceFresh?: boolean }
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
        name: string
    ): Promise<CallableDoc | undefined> {
        return (await this.getOrBuildDocumentLookup(document)).currentFileDocs.get(name);
    }

    public async getDocFromInheritedForDocument(
        document: vscode.TextDocument,
        name: string,
        options?: { forceFresh?: boolean }
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
        const currentFile = materializeSourceGroup(rawLookup.currentFile);
        const inheritedGroups = rawLookup.inheritedGroups.map(materializeSourceGroup);
        const includeGroups = rawLookup.includeGroups.map(materializeSourceGroup);

        return {
            inheritedFiles: [...rawLookup.inheritedFiles],
            currentFileDocs: currentFile.docs,
            inheritedFileDocs: materializeGroupedMaps(inheritedGroups),
            includeFileDocs: materializeGroupedMaps(includeGroups),
            lookup: {
                currentFile,
                inheritedGroups,
                includeGroups
            }
        };
    }
}

function materializeSourceGroup(source: RawFunctionDocLookup['currentFile']): FunctionDocSourceGroup {
    return {
        source: source.source,
        filePath: source.filePath,
        docs: materializeDocMap(source.docs, source.sourceKind)
    };
}

function materializeDocMap(
    documentDocs: DocumentCallableDocs,
    sourceKind: RawFunctionDocLookup['currentFile']['sourceKind']
): Map<string, CallableDoc> {
    const docs = new Map<string, CallableDoc>();

    for (const [name, declarationKeys] of documentDocs.byName.entries()) {
        const preferredDeclarationKey = declarationKeys[0];
        if (!preferredDeclarationKey || docs.has(name)) {
            continue;
        }

        const callableDoc = documentDocs.byDeclaration.get(preferredDeclarationKey);
        if (callableDoc) {
            docs.set(name, {
                ...callableDoc,
                sourceKind
            });
        }
    }

    return docs;
}

function materializeGroupedMaps(
    groups: FunctionDocSourceGroup[]
): Map<string, Map<string, CallableDoc>> {
    return new Map(groups.map((group) => [group.filePath, group.docs]));
}
