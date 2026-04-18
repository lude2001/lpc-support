import * as vscode from 'vscode';
import {
    normalizeWorkspaceUri,
    sameWorkspaceSymbolOwner,
    WorkspaceOwnerResolution,
    WorkspaceSymbolOwner,
    WorkspaceSymbolOwnerResolver
} from './WorkspaceSymbolOwnerResolver';
import {
    WorkspaceReferenceCandidateEnumerator
} from './WorkspaceReferenceCandidateEnumerator';

export interface WorkspaceReferenceCollectorOptions {
    host: { openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument> };
    ownerResolver: Pick<WorkspaceSymbolOwnerResolver, 'resolveOwner'>;
    candidateEnumerator: Pick<WorkspaceReferenceCandidateEnumerator, 'enumerate'>;
}

export interface WorkspaceReferenceMatch {
    uri: string;
    range: vscode.Range;
}

export class WorkspaceReferenceCollector {
    private readonly host: { openTextDocument(target: string | vscode.Uri): Promise<vscode.TextDocument> };
    private readonly ownerResolver: Pick<WorkspaceSymbolOwnerResolver, 'resolveOwner'>;
    private readonly candidateEnumerator: Pick<WorkspaceReferenceCandidateEnumerator, 'enumerate'>;

    public constructor(options: WorkspaceReferenceCollectorOptions) {
        this.host = options.host;
        this.ownerResolver = options.ownerResolver;
        this.candidateEnumerator = options.candidateEnumerator;
    }

    public async collect(
        owner: WorkspaceSymbolOwner,
        candidateFiles: string[],
        options: { includeDeclaration: boolean }
    ): Promise<WorkspaceReferenceMatch[]> {
        const matches: WorkspaceReferenceMatch[] = [];
        const seen = new Set<string>();

        for (const candidateFile of Array.from(new Set(candidateFiles))) {
            const document = await this.getPreferredDocument(candidateFile);
            const candidates = this.candidateEnumerator.enumerate(document, owner);
            for (const candidate of candidates) {
                if (!options.includeDeclaration && candidate.isDeclaration) {
                    continue;
                }

                const resolution = await this.ownerResolver.resolveOwner(document, candidate.range.start);
                if (!isExactWorkspaceOwnerMatch(resolution, owner)) {
                    continue;
                }

                const normalizedUri = normalizeWorkspaceUri(document.uri);
                const key = `${normalizedUri}#${candidate.range.start.line}:${candidate.range.start.character}-${candidate.range.end.line}:${candidate.range.end.character}`;
                if (seen.has(key)) {
                    continue;
                }

                seen.add(key);
                matches.push({
                    uri: normalizedUri,
                    range: candidate.range
                });
            }
        }

        return matches;
    }

    private async getPreferredDocument(uri: string): Promise<vscode.TextDocument> {
        const normalizedTargetUri = normalizeWorkspaceUri(uri);
        const openDocuments = Array.isArray(vscode.workspace.textDocuments) ? vscode.workspace.textDocuments : [];
        const openDocument = openDocuments.find(
            (document) => normalizeWorkspaceUri(document.uri) === normalizedTargetUri
        );
        if (openDocument) {
            return createNormalizedDocumentView(openDocument, normalizedTargetUri);
        }

        const openedDocument = await this.host.openTextDocument(uri);
        return createNormalizedDocumentView(openedDocument, normalizedTargetUri);
    }
}

function isExactWorkspaceOwnerMatch(
    resolution: WorkspaceOwnerResolution,
    targetOwner: WorkspaceSymbolOwner
): boolean {
    return resolution.kind === 'workspace-visible'
        && sameWorkspaceSymbolOwner(resolution.owner, targetOwner);
}

function createNormalizedDocumentView(
    document: vscode.TextDocument,
    normalizedUri: string
): vscode.TextDocument {
    if (document.uri.toString() === normalizedUri) {
        return document;
    }

    const normalizedUriView = Object.assign(
        Object.create(Object.getPrototypeOf(document.uri)),
        document.uri,
        {
            toString: () => normalizedUri
        }
    ) as vscode.Uri;

    return Object.assign(
        Object.create(Object.getPrototypeOf(document)),
        document,
        { uri: normalizedUriView }
    ) as vscode.TextDocument;
}
