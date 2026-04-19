import {
    createConnection,
    DiagnosticSeverity,
    ProposedFeatures,
    type Connection
} from 'vscode-languageserver/node';
import type { LanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import type { LanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import type { LanguageDiagnostic, LanguageDiagnosticsService } from '../../../language/services/diagnostics/LanguageDiagnosticsService';
import type { LanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import type { LanguageNavigationService } from '../../../language/services/navigation/LanguageHoverService';
import type { LanguageSignatureHelpService } from '../../../language/services/signatureHelp/LanguageSignatureHelpService';
import type { LanguageStructureService } from '../../../language/services/structure/LanguageFoldingService';
import { registerCapabilities } from './registerCapabilities';
import { DiagnosticsSession } from '../runtime/DiagnosticsSession';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLogger } from '../runtime/ServerLogger';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

const PHASE_A_SERVER_VERSION = 'phase-a';

export interface CreateServerOptions {
    codeActionsService?: LanguageCodeActionService;
    completionService?: LanguageCompletionService;
    diagnosticsService?: LanguageDiagnosticsService;
    formattingService?: LanguageFormattingService;
    navigationService?: LanguageNavigationService;
    signatureHelpService?: LanguageSignatureHelpService;
    structureService?: LanguageStructureService;
}

export interface LspServerRuntime {
    readonly connection: Connection;
    readonly documentStore: DocumentStore;
    readonly logger: ServerLogger;
    readonly workspaceSession: WorkspaceSession;
    start(): void;
}

export function createServer(options: CreateServerOptions = {}): LspServerRuntime {
    const connection = createConnection(ProposedFeatures.all);
    const documentStore = new DocumentStore();
    const logger = new ServerLogger(connection.console);
    const workspaceSession = new WorkspaceSession();
    const diagnosticsSession = options.diagnosticsService
        ? new DiagnosticsSession({
            documentStore,
            workspaceSession,
            diagnosticsService: options.diagnosticsService,
            publishDiagnostics: (uri, diagnostics) => {
                connection.sendDiagnostics({
                    uri,
                    diagnostics: toLspDiagnostics(diagnostics)
                });
            }
        })
        : undefined;

    registerCapabilities({
        connection,
        documentStore,
        diagnosticsSession,
        logger,
        serverVersion: PHASE_A_SERVER_VERSION,
        workspaceSession,
        navigationService: options.navigationService,
        codeActionsService: options.codeActionsService,
        completionService: options.completionService,
        formattingService: options.formattingService,
        signatureHelpService: options.signatureHelpService,
        structureService: options.structureService
    });

    return {
        connection,
        documentStore,
        logger,
        workspaceSession,
        start(): void {
            logger.info('Starting LPC Phase A language server');
            connection.listen();
        }
    };
}

function toLspDiagnostics(diagnostics: readonly LanguageDiagnostic[]) {
    return diagnostics.map((diagnostic) => ({
        range: {
            start: {
                line: diagnostic.range.start.line,
                character: diagnostic.range.start.character
            },
            end: {
                line: diagnostic.range.end.line,
                character: diagnostic.range.end.character
            }
        },
        severity: diagnostic.severity === 'error'
            ? DiagnosticSeverity.Error
            : diagnostic.severity === 'warning'
                ? DiagnosticSeverity.Warning
                : diagnostic.severity === 'information'
                    ? DiagnosticSeverity.Information
                    : DiagnosticSeverity.Hint,
        message: diagnostic.message,
        code: diagnostic.code,
        source: diagnostic.source,
        data: diagnostic.data
    }));
}
