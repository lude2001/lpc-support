import type { LanguageDiagnostic, LanguageDiagnosticsService } from '../../../language/services/diagnostics/LanguageDiagnosticsService';
import type { LanguageDocument } from '../../../language/contracts/LanguageDocument';
import type { LanguageDiagnosticsRequest } from '../../../language/services/diagnostics/LanguageDiagnosticsService';
import { DocumentStore } from './DocumentStore';
import { resolveWorkspaceRootFromRoots } from './serverPathUtils';
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
    return resolveWorkspaceRootFromRoots(documentUri, workspaceSession.getWorkspaceRoots());
}
