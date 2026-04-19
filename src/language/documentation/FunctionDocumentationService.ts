import * as vscode from 'vscode';
import { CallableDocDocumentBuilder } from './CallableDocDocumentBuilder';
import { cloneCallableDoc, cloneDocumentCallableDocs } from './FunctionDocumentationCloneSupport';
import {
    FunctionDocumentationDocumentIndex,
    type FunctionDocumentationDocumentIndexOptions
} from './FunctionDocumentationDocumentIndex';
import type { CallableDoc, DocumentCallableDocs } from './types';

interface FunctionDocumentationServiceOptions {
    documentIndex?: FunctionDocumentationDocumentIndex;
    documentIndexOptions?: FunctionDocumentationDocumentIndexOptions;
    builder?: CallableDocDocumentBuilder;
}

export class FunctionDocumentationService {
    private readonly documentIndex: FunctionDocumentationDocumentIndex;

    public constructor(options: FunctionDocumentationServiceOptions = {}) {
        this.documentIndex = options.documentIndex
            ?? new FunctionDocumentationDocumentIndex({
                builder: options.builder ?? options.documentIndexOptions?.builder,
                invalidateParsedDocument: options.documentIndexOptions?.invalidateParsedDocument
            });
    }

    public getDocumentDocs(document: vscode.TextDocument): DocumentCallableDocs {
        return cloneDocumentCallableDocs(this.documentIndex.getOrBuild(document));
    }

    public getDocForDeclaration(document: vscode.TextDocument, declarationKey: string): CallableDoc | undefined {
        const cachedDoc = this.documentIndex.getOrBuild(document).byDeclaration.get(declarationKey);
        return cachedDoc ? cloneCallableDoc(cachedDoc) : undefined;
    }

    public getDocsByName(document: vscode.TextDocument, name: string): CallableDoc[] {
        const documentDocs = this.documentIndex.getOrBuild(document);
        const declarationKeys = documentDocs.byName.get(name) ?? [];
        return declarationKeys
            .map((declarationKey) => documentDocs.byDeclaration.get(declarationKey))
            .filter((callableDoc): callableDoc is CallableDoc => Boolean(callableDoc))
            .map((callableDoc) => cloneCallableDoc(callableDoc));
    }

    public invalidate(uri: string): void {
        this.documentIndex.invalidate(uri);
    }

    public clear(): void {
        this.documentIndex.clear();
    }
}
