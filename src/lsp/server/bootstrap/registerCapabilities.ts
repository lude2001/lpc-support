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
import { __closeTextDocument, __emitTextDocumentChange, __syncTextDocument } from '../runtime/vscodeShim';
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
    documentStore: DocumentStore;
    diagnosticsSession?: DiagnosticsSession;
    logger: ServerLogger;
    serverVersion: string;
    workspaceSession: WorkspaceSession;
    completionService?: LanguageCompletionService;
    codeActionsService?: LanguageCodeActionService;
    formattingService?: LanguageFormattingService;
}

export function registerCapabilities(context: ServerRegistrationContext): void {
    const { connection, documentStore, diagnosticsSession, logger, serverVersion, workspaceSession, completionService, codeActionsService } = context;
    const contextFactory = new ServerLanguageContextFactory(documentStore, workspaceSession);
    const navigationService: LanguageNavigationService | undefined =
        workspaceSession.toLanguageWorkspaceContext('').services?.navigationService;
    const effectiveCodeActionsService = codeActionsService
        ?? workspaceSession.toLanguageWorkspaceContext('').services?.codeActionsService;
    const signatureHelpService: LanguageSignatureHelpService | undefined =
        workspaceSession.toLanguageWorkspaceContext('').services?.signatureHelpService;
    const structureService = workspaceSession.toLanguageWorkspaceContext('').services?.structureService;
    const formattingService = context.formattingService
        ?? workspaceSession.toLanguageWorkspaceContext('').services?.formattingService;
    const supportsFormattingHandlers = Boolean(connection.onDocumentFormatting && connection.onDocumentRangeFormatting);
    const formattingConnection = supportsFormattingHandlers
        ? connection as Pick<Connection, 'onDocumentFormatting' | 'onDocumentRangeFormatting'>
        : undefined;

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
        documentStore.open(textDocument.uri, textDocument.version, textDocument.text);
        __syncTextDocument(textDocument.uri, textDocument.text, textDocument.version);
        void diagnosticsSession?.refresh(textDocument.uri);
    });

    connection.onDidChangeTextDocument(({ textDocument, contentChanges }: DidChangeTextDocumentParams) => {
        const nextText = contentChanges.length > 0
            ? contentChanges[contentChanges.length - 1].text
            : documentStore.get(textDocument.uri)?.text ?? '';

        documentStore.applyFullChange(textDocument.uri, textDocument.version, nextText);
        __syncTextDocument(textDocument.uri, nextText, textDocument.version);
        __emitTextDocumentChange(textDocument.uri);
        void diagnosticsSession?.refresh(textDocument.uri);
    });

    connection.onDidCloseTextDocument(({ textDocument }: DidCloseTextDocumentParams) => {
        documentStore.close(textDocument.uri);
        __closeTextDocument(textDocument.uri);
        diagnosticsSession?.clear(textDocument.uri);
    });

    connection.onNotification(WorkspaceConfigSyncNotification.type, (payload: WorkspaceConfigSyncPayload) => {
        workspaceSession.applyWorkspaceConfigSync(payload);
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
