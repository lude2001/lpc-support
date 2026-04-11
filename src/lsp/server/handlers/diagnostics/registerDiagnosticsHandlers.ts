import type { Connection, DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams } from 'vscode-languageserver/node';
import { DiagnosticsSession } from '../../runtime/DiagnosticsSession';
import { DocumentStore } from '../../runtime/DocumentStore';
import { WorkspaceSession } from '../../runtime/WorkspaceSession';

type DiagnosticsConnection = Pick<
    Connection,
    'onDidOpenTextDocument' | 'onDidChangeTextDocument' | 'onDidCloseTextDocument'
>;

export interface DiagnosticsRegistrationContext {
    connection: DiagnosticsConnection;
    documentStore: DocumentStore;
    workspaceSession: WorkspaceSession;
    diagnosticsSession: DiagnosticsSession;
}

export function registerDiagnosticsHandlers(context: DiagnosticsRegistrationContext): void {
    const { connection, diagnosticsSession } = context;

    connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
        void diagnosticsSession.refresh(params.textDocument.uri);
    });

    connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
        void diagnosticsSession.refresh(params.textDocument.uri);
    });

    connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
        diagnosticsSession.clear(params.textDocument.uri);
    });
}
