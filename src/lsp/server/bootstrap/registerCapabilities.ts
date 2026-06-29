import {
    CodeActionKind,
    type CodeActionParams,
    type CompletionItem,
    type CompletionList,
    type CompletionParams,
    type DocumentFormattingParams,
    type DocumentRangeFormattingParams,
    type Definition,
    type DefinitionParams,
    type DocumentSymbol,
    type DocumentSymbolParams,
    type Hover,
    type HoverParams,
    NotificationType,
    type Location,
    type PrepareRenameParams,
    type PrepareRenameResult,
    type ReferenceParams,
    type RenameParams,
    TextDocumentSyncKind,
    type Connection,
    type DidChangeTextDocumentParams,
    type DidCloseTextDocumentParams,
    type DidOpenTextDocumentParams,
    type InitializeParams,
    type InitializeResult,
    type WorkspaceEdit
} from 'vscode-languageserver/node';
import type { LanguageCompletionService } from '../../../language/services/completion/LanguageCompletionService';
import type { LanguageCodeActionService } from '../../../language/services/codeActions/LanguageCodeActionService';
import type { LanguageFormattingService } from '../../../language/services/formatting/LanguageFormattingService';
import type { LanguageNavigationService } from '../../../language/services/navigation/LanguageHoverService';
import type { LanguageSignatureHelpService } from '../../../language/services/signatureHelp/LanguageSignatureHelpService';
import type { LanguageStructureService } from '../../../language/services/structure/LanguageFoldingService';
import type {
    LanguageHealthPerformanceProviders,
    LanguageWorkspaceIndexingService
} from '../../../language/contracts/LanguageFeatureServices';
import { HealthRequest } from '../../shared/protocol/health';
import {
    SourceFileChangeNotification,
    type SourceFileChangePayload
} from '../../shared/protocol/sourceFileChange';
import {
    WorkspaceConfigSyncNotification,
    type WorkspaceConfigSyncPayload
} from '../../shared/protocol/workspaceConfigSync';
import {
    WorkspaceIndexProgressNotification,
    WorkspaceIndexRebuildRequest
} from '../../shared/protocol/workspaceIndex';
import { registerCompletionHandler } from '../handlers/completion/registerCompletionHandler';
import { registerCodeActionHandler } from '../handlers/codeActions/registerCodeActionHandler';
import { createHealthHandler } from '../handlers/health/healthHandler';
import { registerFormattingHandlers } from '../handlers/formatting/registerFormattingHandlers';
import { registerDefinitionHandler } from '../handlers/navigation/registerDefinitionHandler';
import { registerDocumentSymbolHandler } from '../handlers/navigation/registerDocumentSymbolHandler';
import { registerHoverHandler } from '../handlers/navigation/registerHoverHandler';
import { registerReferencesHandler } from '../handlers/navigation/registerReferencesHandler';
import { registerRenameHandler } from '../handlers/navigation/registerRenameHandler';
import { registerSignatureHelpHandler } from '../handlers/signatureHelp/registerSignatureHelpHandler';
import { registerFoldingRangeHandler } from '../handlers/structure/registerFoldingRangeHandler';
import { registerSemanticTokensHandler } from '../handlers/structure/registerSemanticTokensHandler';
import { DiagnosticsSession } from '../runtime/DiagnosticsSession';
import { DocumentStore } from '../runtime/DocumentStore';
import { ServerLanguageContextFactory } from '../runtime/ServerLanguageContextFactory';
import {
    SERVER_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS,
    SERVER_LANGUAGE_SEMANTIC_TOKEN_TYPES
} from '../runtime/semanticTokenLegend';
import { ServerLogger } from '../runtime/ServerLogger';
import { DocumentFreshnessService } from '../runtime/DocumentFreshnessService';
import { __bindDocumentStore, __closeTextDocument, __emitTextDocumentChange, __syncTextDocument } from '../runtime/vscodeShim';
import { WorkspaceChangeIndex } from '../runtime/WorkspaceChangeIndex';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

const MAYBE_STALE_DIAGNOSTIC_REFRESH_DELAY_MS = 200;
const OPEN_PREWARM_DELAY_MS = 350;
const OPEN_DIAGNOSTIC_REFRESH_DELAY_MS = 1000;

export type ServerConnection = Pick<
    Connection,
    | 'onInitialize'
    | 'onDidOpenTextDocument'
    | 'onDidChangeTextDocument'
    | 'onDidCloseTextDocument'
    | 'onRequest'
    | 'onCompletion'
    | 'onCompletionResolve'
    | 'onHover'
    | 'onDefinition'
    | 'onReferences'
    | 'onPrepareRename'
    | 'onRenameRequest'
    | 'onCodeAction'
    | 'onDocumentSymbol'
    | 'onFoldingRanges'
    | 'sendNotification'
    | 'languages'
> & {
    onNotification: <T>(type: NotificationType<T>, handler: (params: T) => void) => unknown;
    onSignatureHelp?: Connection['onSignatureHelp'];
    onDocumentFormatting?: Connection['onDocumentFormatting'];
    onDocumentRangeFormatting?: Connection['onDocumentRangeFormatting'];
};

export interface ServerRegistrationContext {
    connection: ServerConnection;
    changeIndex?: WorkspaceChangeIndex;
    documentStore: DocumentStore;
    diagnosticsSession?: DiagnosticsSession;
    logger: ServerLogger;
    serverVersion: string;
    workspaceSession: WorkspaceSession;
    navigationService?: LanguageNavigationService;
    completionService?: LanguageCompletionService;
    codeActionsService?: LanguageCodeActionService;
    formattingService?: LanguageFormattingService;
    onDocumentInvalidated?: (uri: string) => void;
    signatureHelpService?: LanguageSignatureHelpService;
    structureService?: LanguageStructureService;
    onWorkspaceConfigSync?: () => Promise<void>;
    workspaceIndexingService?: LanguageWorkspaceIndexingService;
    healthPerformanceProviders?: LanguageHealthPerformanceProviders;
}

export function registerCapabilities(context: ServerRegistrationContext): void {
    const {
        connection,
        changeIndex,
        documentStore,
        diagnosticsSession,
        logger,
        serverVersion,
        workspaceSession,
        navigationService,
        completionService,
        codeActionsService,
        formattingService,
        signatureHelpService,
        structureService,
        onDocumentInvalidated,
        onWorkspaceConfigSync,
        workspaceIndexingService,
        healthPerformanceProviders
    } = context;
    __bindDocumentStore(documentStore);
    const effectiveCodeActionsService = codeActionsService;
    const supportsFormattingHandlers = Boolean(connection.onDocumentFormatting && connection.onDocumentRangeFormatting);
    const formattingConnection = supportsFormattingHandlers
        ? connection as Pick<Connection, 'onDocumentFormatting' | 'onDocumentRangeFormatting'>
        : undefined;
    const freshnessService = new DocumentFreshnessService({
        changeIndex,
        logger,
        onDocumentInvalidated
    });
    const contextFactory = new ServerLanguageContextFactory(documentStore, workspaceSession, {
        ensureFreshDocument: (uri) => freshnessService.ensureFreshRequestDocument(uri)
    });
    let workspaceConfigReady = !onWorkspaceConfigSync;
    const pendingDiagnosticRefreshes = new Set<string>();
    const pendingMaybeStaleDiagnosticRefreshes = new Set<string>();
    const pendingOpenPrewarms = new Set<string>();
    const pendingOpenPrewarmTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const pendingOpenDiagnosticRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let maybeStaleDiagnosticRefreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshDiagnosticsWhenReady = (uri: string): void => {
        if (!diagnosticsSession) {
            return;
        }

        if (!workspaceConfigReady) {
            pendingDiagnosticRefreshes.add(uri);
            return;
        }

        const freshnessToken = freshnessService.createDiagnosticFreshnessToken(uri);
        void diagnosticsSession.refresh(uri)
            .then(() => freshnessService.markDiagnosticsClean(freshnessToken))
            .catch((error) => {
                logger.error(`Failed to refresh diagnostics for ${uri}: ${error instanceof Error ? error.message : String(error)}`);
            });
    };

    const refreshPendingAndOpenDiagnostics = (): void => {
        if (!diagnosticsSession) {
            pendingDiagnosticRefreshes.clear();
            pendingMaybeStaleDiagnosticRefreshes.clear();
            return;
        }

        const uris = new Set([
            ...pendingDiagnosticRefreshes,
            ...documentStore.list().map((document) => document.uri)
        ]);
        pendingDiagnosticRefreshes.clear();

        for (const uri of uris) {
            if (documentStore.get(uri)) {
                clearPendingOpenDiagnosticRefresh(uri);
                refreshDiagnosticsWhenReady(uri);
            }
        }
    };

    const flushMaybeStaleDiagnosticRefreshes = (): void => {
        maybeStaleDiagnosticRefreshTimer = undefined;
        if (!diagnosticsSession) {
            pendingMaybeStaleDiagnosticRefreshes.clear();
            return;
        }

        const uris = [...pendingMaybeStaleDiagnosticRefreshes];
        pendingMaybeStaleDiagnosticRefreshes.clear();

        for (const uri of uris) {
            if (documentStore.get(uri)) {
                refreshDiagnosticsWhenReady(uri);
            }
        }
    };

    const scheduleMaybeStaleDiagnosticRefreshes = (uris: readonly string[]): void => {
        if (!diagnosticsSession || uris.length === 0) {
            return;
        }

        for (const uri of uris) {
            pendingMaybeStaleDiagnosticRefreshes.add(uri);
        }

        if (maybeStaleDiagnosticRefreshTimer) {
            clearTimeout(maybeStaleDiagnosticRefreshTimer);
        }
        maybeStaleDiagnosticRefreshTimer = setTimeout(
            flushMaybeStaleDiagnosticRefreshes,
            MAYBE_STALE_DIAGNOSTIC_REFRESH_DELAY_MS
        );
    };
    const clearPendingOpenDiagnosticRefresh = (uri: string): void => {
        const timer = pendingOpenDiagnosticRefreshTimers.get(uri);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        pendingOpenDiagnosticRefreshTimers.delete(uri);
    };
    const clearPendingOpenPrewarm = (uri: string): void => {
        pendingOpenPrewarms.delete(uri);
        const timer = pendingOpenPrewarmTimers.get(uri);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        pendingOpenPrewarmTimers.delete(uri);
    };
    const scheduleOpenPrewarm = (uri: string): void => {
        if (!structureService) {
            return;
        }

        if (!workspaceConfigReady) {
            pendingOpenPrewarms.add(uri);
            return;
        }

        clearPendingOpenPrewarm(uri);
        pendingOpenPrewarmTimers.set(uri, setTimeout(() => {
            pendingOpenPrewarmTimers.delete(uri);
            if (!documentStore.get(uri)) {
                return;
            }
            if (!workspaceConfigReady) {
                pendingOpenPrewarms.add(uri);
                return;
            }

            void structureService.provideSemanticTokens({
                context: contextFactory.createCapabilityContext(uri)
            }).catch((error) => {
                logger.error(`Failed to prewarm semantic tokens for ${uri}: ${error instanceof Error ? error.message : String(error)}`);
            });
        }, OPEN_PREWARM_DELAY_MS));
    };
    const schedulePendingOpenPrewarms = (): void => {
        const uris = [...pendingOpenPrewarms];
        pendingOpenPrewarms.clear();

        for (const uri of uris) {
            if (documentStore.get(uri)) {
                scheduleOpenPrewarm(uri);
            }
        }
    };
    const scheduleOpenDiagnosticRefresh = (uri: string): void => {
        clearPendingOpenDiagnosticRefresh(uri);
        pendingOpenDiagnosticRefreshTimers.set(uri, setTimeout(() => {
            pendingOpenDiagnosticRefreshTimers.delete(uri);
            refreshDiagnosticsWhenReady(uri);
        }, OPEN_DIAGNOSTIC_REFRESH_DELAY_MS));
    };
    const applyWorkspaceConfigSync = async (payload: WorkspaceConfigSyncPayload): Promise<void> => {
        changeIndex?.nextWorkspaceConfigGeneration();
        workspaceConfigReady = false;
        workspaceSession.applyWorkspaceConfigSync(payload);
        try {
            await onWorkspaceConfigSync?.();
        } catch (error) {
            logger.error(`Failed to apply workspace configuration sync: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            workspaceConfigReady = true;
            schedulePendingOpenPrewarms();
            refreshPendingAndOpenDiagnostics();
        }
    };

    connection.onInitialize((_params: InitializeParams): InitializeResult => {
        logger.info('Initializing LPC Phase A language server');

        return {
            capabilities: {
                ...(navigationService ? {
                    hoverProvider: true,
                    definitionProvider: true,
                    referencesProvider: true,
                    renameProvider: {
                        prepareProvider: true
                    },
                    documentSymbolProvider: true
                } : {}),
                ...(completionService ? {
                    completionProvider: {
                        resolveProvider: Boolean(completionService.resolveCompletionItem)
                    }
                } : {}),
                ...(effectiveCodeActionsService ? {
                    codeActionProvider: {
                        codeActionKinds: [CodeActionKind.QuickFix]
                    }
                } : {}),
                ...(supportsFormattingHandlers && formattingService ? {
                    documentFormattingProvider: true,
                    documentRangeFormattingProvider: true
                } : {}),
                ...(signatureHelpService && connection.onSignatureHelp ? {
                    signatureHelpProvider: {
                        triggerCharacters: ['(', ','],
                        retriggerCharacters: [',']
                    }
                } : {}),
                ...(structureService ? {
                    foldingRangeProvider: true,
                    semanticTokensProvider: {
                        legend: {
                            tokenTypes: [...SERVER_LANGUAGE_SEMANTIC_TOKEN_TYPES],
                            tokenModifiers: [...SERVER_LANGUAGE_SEMANTIC_TOKEN_MODIFIERS]
                        },
                        full: true
                    }
                } : {}),
                textDocumentSync: TextDocumentSyncKind.Full
            },
            serverInfo: {
                name: 'lpc-support-phase-a',
                version: serverVersion
            }
        };
    });

    connection.onDidOpenTextDocument(({ textDocument }: DidOpenTextDocumentParams) => {
        changeIndex?.markOpened(textDocument.uri, textDocument.version);
        documentStore.open(textDocument.uri, textDocument.version, textDocument.text);
        __syncTextDocument(textDocument.uri, textDocument.text, textDocument.version);
        freshnessService.invalidateDocument(textDocument.uri);
        scheduleOpenPrewarm(textDocument.uri);
        scheduleOpenDiagnosticRefresh(textDocument.uri);
    });

    connection.onDidChangeTextDocument(({ textDocument, contentChanges }: DidChangeTextDocumentParams) => {
        const nextText = contentChanges.length > 0
            ? contentChanges[contentChanges.length - 1].text
            : documentStore.get(textDocument.uri)?.text ?? '';

        changeIndex?.markChanged(textDocument.uri, textDocument.version);
        clearPendingOpenPrewarm(textDocument.uri);
        clearPendingOpenDiagnosticRefresh(textDocument.uri);
        documentStore.applyFullChange(textDocument.uri, textDocument.version, nextText);
        __syncTextDocument(textDocument.uri, nextText, textDocument.version);
        __emitTextDocumentChange(textDocument.uri);
        freshnessService.invalidateDocument(textDocument.uri);
        refreshDiagnosticsWhenReady(textDocument.uri);
    });

    connection.onDidCloseTextDocument(({ textDocument }: DidCloseTextDocumentParams) => {
        changeIndex?.markClosed(textDocument.uri);
        clearPendingOpenPrewarm(textDocument.uri);
        clearPendingOpenDiagnosticRefresh(textDocument.uri);
        documentStore.close(textDocument.uri);
        __closeTextDocument(textDocument.uri);
        freshnessService.invalidateDocument(textDocument.uri);
        pendingDiagnosticRefreshes.delete(textDocument.uri);
        pendingMaybeStaleDiagnosticRefreshes.delete(textDocument.uri);
        diagnosticsSession?.clear(textDocument.uri);
    });

    connection.onNotification(WorkspaceConfigSyncNotification.type, (payload: WorkspaceConfigSyncPayload) => {
        void applyWorkspaceConfigSync(payload);
    });

    connection.onNotification(SourceFileChangeNotification.type, (payload: SourceFileChangePayload) => {
        changeIndex?.markDiskChanged(payload.uri, payload.changeType);
        freshnessService.invalidateDocument(payload.uri);
        scheduleMaybeStaleDiagnosticRefreshes(changeIndex?.getMaybeStaleOpenUris() ?? []);
        if (payload.changeType === 'deleted') {
            diagnosticsSession?.clear(payload.uri);
        }
    });

    connection.onRequest(
        HealthRequest.type,
        createHealthHandler({
            documentStore,
            serverVersion,
            getParserStats: healthPerformanceProviders?.getParserStats,
            getSemanticStats: healthPerformanceProviders?.getSemanticStats
        })
    );

    if (workspaceIndexingService) {
        connection.onRequest(WorkspaceIndexRebuildRequest.type, async (payload) => {
            await applyWorkspaceConfigSync(payload);
            return workspaceIndexingService.rebuild(payload, progress => {
                void connection.sendNotification(WorkspaceIndexProgressNotification.type, progress);
            });
        });
    }

    if (completionService) {
        registerCompletionHandler({
            connection,
            contextFactory,
            completionService
        });
    }

    if (effectiveCodeActionsService) {
        registerCodeActionHandler({
            connection,
            documentStore,
            contextFactory,
            codeActionsService: effectiveCodeActionsService
        });
    }

    if (formattingService && formattingConnection) {
        registerFormattingHandlers({
            connection: formattingConnection,
            documentStore,
            workspaceSession,
            formattingService
        });
    }

    if (navigationService) {
        registerHoverHandler({
            connection,
            contextFactory,
            navigationService
        });
        registerDefinitionHandler({
            connection,
            contextFactory,
            navigationService
        });
        registerReferencesHandler({
            connection,
            contextFactory,
            navigationService
        });
        registerRenameHandler({
            connection,
            contextFactory,
            navigationService
        });
        registerDocumentSymbolHandler({
            connection,
            contextFactory,
            navigationService
        });
    }

    if (signatureHelpService && connection.onSignatureHelp) {
        registerSignatureHelpHandler({
            connection: connection as Pick<Connection, 'onSignatureHelp'>,
            contextFactory,
            signatureHelpService
        });
    }

    if (structureService) {
        registerFoldingRangeHandler({
            connection,
            contextFactory,
            structureService
        });
        registerSemanticTokensHandler({
            connection,
            contextFactory,
            structureService,
            onSemanticTokensRequested: clearPendingOpenPrewarm
        });
    }
}
