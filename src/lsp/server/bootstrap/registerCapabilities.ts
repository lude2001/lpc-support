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
import { HealthRequest } from '../../shared/protocol/health';
import {
    WorkspaceConfigSyncNotification,
    type WorkspaceConfigSyncPayload
} from '../../shared/protocol/workspaceConfigSync';
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
import { __bindDocumentStore, __closeTextDocument, __emitTextDocumentChange, __invalidateTextDocument, __syncTextDocument } from '../runtime/vscodeShim';
import { WorkspaceChangeIndex } from '../runtime/WorkspaceChangeIndex';
import { WorkspaceSession } from '../runtime/WorkspaceSession';

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
    | 'languages'
> & {
    onNotification: (
        type: NotificationType<WorkspaceConfigSyncPayload>,
        handler: (params: WorkspaceConfigSyncPayload) => void
    ) => unknown;
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
        onWorkspaceConfigSync
    } = context;
    __bindDocumentStore(documentStore);
    const contextFactory = new ServerLanguageContextFactory(documentStore, workspaceSession);
    const effectiveCodeActionsService = codeActionsService;
    const supportsFormattingHandlers = Boolean(connection.onDocumentFormatting && connection.onDocumentRangeFormatting);
    const formattingConnection = supportsFormattingHandlers
        ? connection as Pick<Connection, 'onDocumentFormatting' | 'onDocumentRangeFormatting'>
        : undefined;
    let workspaceConfigReady = !onWorkspaceConfigSync;
    const pendingDiagnosticRefreshes = new Set<string>();

    const refreshDiagnosticsWhenReady = (uri: string): void => {
        if (!diagnosticsSession) {
            return;
        }

        if (!workspaceConfigReady) {
            pendingDiagnosticRefreshes.add(uri);
            return;
        }

        void diagnosticsSession.refresh(uri);
    };

    const invalidateDocument = (uri: string): void => {
        __invalidateTextDocument(uri);
        try {
            onDocumentInvalidated?.(uri);
        } catch (error) {
            logger.error(`Failed to invalidate ${uri}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const refreshPendingAndOpenDiagnostics = (): void => {
        if (!diagnosticsSession) {
            pendingDiagnosticRefreshes.clear();
            return;
        }

        const uris = new Set([
            ...pendingDiagnosticRefreshes,
            ...documentStore.list().map((document) => document.uri)
        ]);
        pendingDiagnosticRefreshes.clear();

        for (const uri of uris) {
            if (documentStore.get(uri)) {
                void diagnosticsSession.refresh(uri);
            }
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
        invalidateDocument(textDocument.uri);
        refreshDiagnosticsWhenReady(textDocument.uri);
    });

    connection.onDidChangeTextDocument(({ textDocument, contentChanges }: DidChangeTextDocumentParams) => {
        const nextText = contentChanges.length > 0
            ? contentChanges[contentChanges.length - 1].text
            : documentStore.get(textDocument.uri)?.text ?? '';

        changeIndex?.markChanged(textDocument.uri, textDocument.version);
        documentStore.applyFullChange(textDocument.uri, textDocument.version, nextText);
        __syncTextDocument(textDocument.uri, nextText, textDocument.version);
        __emitTextDocumentChange(textDocument.uri);
        invalidateDocument(textDocument.uri);
        refreshDiagnosticsWhenReady(textDocument.uri);
    });

    connection.onDidCloseTextDocument(({ textDocument }: DidCloseTextDocumentParams) => {
        changeIndex?.markClosed(textDocument.uri);
        documentStore.close(textDocument.uri);
        __closeTextDocument(textDocument.uri);
        invalidateDocument(textDocument.uri);
        pendingDiagnosticRefreshes.delete(textDocument.uri);
        diagnosticsSession?.clear(textDocument.uri);
    });

    connection.onNotification(WorkspaceConfigSyncNotification.type, (payload: WorkspaceConfigSyncPayload) => {
        changeIndex?.nextWorkspaceConfigGeneration();
        workspaceConfigReady = false;
        workspaceSession.applyWorkspaceConfigSync(payload);
        void (async () => {
            try {
                await onWorkspaceConfigSync?.();
            } catch (error) {
                logger.error(`Failed to apply workspace configuration sync: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                workspaceConfigReady = true;
                refreshPendingAndOpenDiagnostics();
            }
        })();
    });

    connection.onRequest(
        HealthRequest.type,
        createHealthHandler({
            documentStore,
            serverVersion
        })
    );

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
            structureService
        });
    }
}
