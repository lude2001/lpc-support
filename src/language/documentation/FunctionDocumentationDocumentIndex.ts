import * as vscode from 'vscode';
import { getGlobalParsedDocumentService } from '../../parser/ParsedDocumentService';
import { CallableDocDocumentBuilder } from './CallableDocDocumentBuilder';
import type { DocumentCallableDocs } from './types';

interface CachedDocumentDocsEntry {
    version: number;
    text: string;
    uriObject: vscode.Uri;
    docs: DocumentCallableDocs;
}

export interface FunctionDocumentationDocumentIndexOptions {
    builder?: Pick<CallableDocDocumentBuilder, 'build'>;
    invalidateParsedDocument?: (uri: vscode.Uri) => void;
}

export class FunctionDocumentationDocumentIndex {
    private readonly builder: Pick<CallableDocDocumentBuilder, 'build'>;
    private readonly invalidateParsedDocument: (uri: vscode.Uri) => void;
    private readonly documentCache = new Map<string, CachedDocumentDocsEntry>();

    public constructor(options: FunctionDocumentationDocumentIndexOptions = {}) {
        this.builder = options.builder ?? new CallableDocDocumentBuilder();
        this.invalidateParsedDocument = options.invalidateParsedDocument
            ?? ((uri: vscode.Uri) => getGlobalParsedDocumentService().invalidate(uri));
    }

    public getOrBuild(document: vscode.TextDocument): DocumentCallableDocs {
        const uri = document.uri.toString();
        const text = document.getText();
        const cachedEntry = this.documentCache.get(uri);

        if (cachedEntry && cachedEntry.version === document.version && cachedEntry.text === text) {
            return cachedEntry.docs;
        }

        if (cachedEntry && cachedEntry.text !== text) {
            this.invalidateParsedDocument(document.uri);
        }

        const builtDocs = this.builder.build(document);
        this.documentCache.set(uri, {
            version: document.version,
            text,
            uriObject: document.uri,
            docs: builtDocs
        });
        return builtDocs;
    }

    public invalidate(uri: string): void {
        const cachedEntry = this.documentCache.get(uri);
        this.documentCache.delete(uri);
        this.invalidateParsedDocument(cachedEntry?.uriObject ?? vscode.Uri.parse(uri));
    }

    public clear(): void {
        this.documentCache.clear();
    }
}
