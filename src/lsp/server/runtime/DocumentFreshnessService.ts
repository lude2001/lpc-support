import { ServerLogger } from './ServerLogger';
import { __invalidateTextDocument } from './vscodeShim';
import type { WorkspaceChangeIndex } from './WorkspaceChangeIndex';

export interface DiagnosticFreshnessToken {
    readonly uri: string;
    readonly expectedLastChangedAt?: number;
}

export interface DocumentFreshnessServiceOptions {
    readonly changeIndex?: Pick<WorkspaceChangeIndex, 'get' | 'getWorkspaceConfigGeneration' | 'markClean'>;
    readonly invalidateRuntimeDocument?: (uri: string) => void;
    readonly logger: ServerLogger;
    readonly onDocumentInvalidated?: (uri: string) => void;
}

export class DocumentFreshnessService {
    private readonly changeIndex?: Pick<WorkspaceChangeIndex, 'get' | 'getWorkspaceConfigGeneration' | 'markClean'>;
    private readonly invalidateRuntimeDocument: (uri: string) => void;
    private readonly logger: ServerLogger;
    private readonly onDocumentInvalidated?: (uri: string) => void;

    public constructor(options: DocumentFreshnessServiceOptions) {
        this.changeIndex = options.changeIndex;
        this.invalidateRuntimeDocument = options.invalidateRuntimeDocument ?? __invalidateTextDocument;
        this.logger = options.logger;
        this.onDocumentInvalidated = options.onDocumentInvalidated;
    }

    public invalidateDocument(uri: string): void {
        this.invalidateRuntimeDocument(uri);
        try {
            this.onDocumentInvalidated?.(uri);
        } catch (error) {
            this.logger.error(`Failed to invalidate ${uri}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public createDiagnosticFreshnessToken(uri: string): DiagnosticFreshnessToken {
        return {
            uri,
            expectedLastChangedAt: this.changeIndex?.get(uri)?.lastChangedAt
        };
    }

    public ensureFreshRequestDocument(uri: string | undefined): void {
        if (!uri || !this.changeIndex) {
            return;
        }

        const state = this.changeIndex.get(uri);
        if (!state) {
            return;
        }

        if (
            (state.dirty && state.openVersion === undefined)
            || state.maybeStale
            || state.workspaceConfigGeneration !== this.changeIndex.getWorkspaceConfigGeneration()
        ) {
            this.invalidateDocument(uri);
            this.changeIndex.markClean(uri, state.lastChangedAt);
        }
    }

    public markDiagnosticsClean(token: DiagnosticFreshnessToken): void {
        this.changeIndex?.markClean(token.uri, token.expectedLastChangedAt);
    }
}
