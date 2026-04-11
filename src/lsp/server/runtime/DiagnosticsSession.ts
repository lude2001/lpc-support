import type { LanguageDiagnostic, LanguageDiagnosticsService } from '../../../language/services/diagnostics/LanguageDiagnosticsService';
import type { LanguageDocument } from '../../../language/contracts/LanguageDocument';
import type { LanguageDiagnosticsRequest } from '../../../language/services/diagnostics/LanguageDiagnosticsService';
import { DocumentStore } from './DocumentStore';
import { WorkspaceSession } from './WorkspaceSession';

export interface DiagnosticsSessionOptions {
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    diagnosticsService: LanguageDiagnosticsService;
    publishDiagnostics: (uri: string, diagnostics: LanguageDiagnostic[]) => void;
}

export class DiagnosticsSession {
    private readonly latestDiagnostics = new Map<string, LanguageDiagnostic[]>();

    public constructor(private readonly options: DiagnosticsSessionOptions) {}

    public async refresh(uri: string): Promise<LanguageDiagnostic[]> {
        const storedDocument = this.options.documentStore.get(uri);
        if (!storedDocument) {
            return this.clear(uri);
        }

        const diagnostics = await this.options.diagnosticsService.collectDiagnostics(
            this.createRequest(storedDocument)
        );

        this.latestDiagnostics.set(uri, diagnostics);
        this.options.publishDiagnostics(uri, diagnostics);
        return diagnostics;
    }

    public clear(uri: string): LanguageDiagnostic[] {
        this.latestDiagnostics.delete(uri);
        this.options.publishDiagnostics(uri, []);
        return [];
    }

    public getLatest(uri: string): readonly LanguageDiagnostic[] | undefined {
        return this.latestDiagnostics.get(uri);
    }

    private createRequest(storedDocument: Readonly<{ uri: string; version: number; text: string }>): LanguageDiagnosticsRequest {
        const workspaceRoot = resolveWorkspaceRoot(storedDocument.uri, this.options.workspaceSession);
        const document = createLanguageDocument(storedDocument);

        return {
            context: {
                document,
                workspace: {
                    workspaceRoot
                },
                mode: 'lsp'
            }
        };
    }
}

function createLanguageDocument(storedDocument: Readonly<{ uri: string; version: number; text: string }>): LanguageDocument {
    return {
        uri: storedDocument.uri,
        version: storedDocument.version,
        getText: () => storedDocument.text
    };
}

function resolveWorkspaceRoot(documentUri: string, workspaceSession: WorkspaceSession): string {
    const workspaceRoots = workspaceSession.getWorkspaceRoots();
    if (workspaceRoots.length === 0) {
        return '';
    }

    const normalizedDocumentPath = normalizeComparablePath(fromFileUri(documentUri));
    const matchedWorkspaceRoot = workspaceRoots.reduce<string | undefined>((bestMatch, root) => {
        const normalizedRoot = normalizeComparablePath(root);
        if (!isPathPrefix(normalizedRoot, normalizedDocumentPath)) {
            return bestMatch;
        }

        if (!bestMatch) {
            return root;
        }

        return normalizedRoot.length > normalizeComparablePath(bestMatch).length ? root : bestMatch;
    }, undefined);

    return matchedWorkspaceRoot ?? workspaceRoots[0];
}

function fromFileUri(uri: string): string {
    if (!uri.startsWith('file://')) {
        return uri;
    }

    const decoded = decodeURIComponent(uri.replace(/^file:\/\/+/, '/'));
    return decoded.replace(/^\/([A-Za-z]:\/)/, '$1');
}

function normalizeComparablePath(path: string): string {
    const normalizedPath = path
        .replace(/\\/g, '/')
        .replace(/\/+$/, '');

    return isWindowsDrivePath(normalizedPath)
        ? normalizedPath.toLowerCase()
        : normalizedPath;
}

function isPathPrefix(root: string, candidate: string): boolean {
    return candidate === root || candidate.startsWith(`${root}/`);
}

function isWindowsDrivePath(path: string): boolean {
    return /^[A-Za-z]:\//.test(path);
}
