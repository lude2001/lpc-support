use anyhow::{Context, Result};
use lpc_language_server::document_store::{ContentChange, DocumentStore};
use lpc_language_server::semantic_tokens::{TOKEN_MODIFIERS, TOKEN_TYPES};
use lpc_language_server::syntax_store::SyntaxStore;
use lpc_protocol::{HEALTH_METHOD, HealthStatusResponse, PerformanceStatus};
use lsp_server::{Connection, Message, Notification, Request, RequestId, Response};
use serde::Deserialize;
use serde_json::{Value, json};

const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DidOpenParams {
    text_document: OpenTextDocument,
}

#[derive(Debug, Deserialize)]
struct OpenTextDocument {
    uri: String,
    version: i32,
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DidChangeParams {
    text_document: VersionedTextDocument,
    content_changes: Vec<ContentChange>,
}

#[derive(Debug, Deserialize)]
struct VersionedTextDocument {
    uri: String,
    version: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DidCloseParams {
    text_document: TextDocumentIdentifier,
}

#[derive(Debug, Deserialize)]
struct TextDocumentIdentifier {
    uri: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SemanticTokensParams {
    text_document: TextDocumentIdentifier,
}

type DocumentSymbolParams = SemanticTokensParams;

fn main() -> Result<()> {
    let (connection, io_threads) = Connection::stdio();
    let initialize_result = json!({
        "capabilities": {
            "textDocumentSync": {
                "openClose": true,
                "change": 2,
                "save": false
            },
            "semanticTokensProvider": {
                "legend": {
                    "tokenTypes": TOKEN_TYPES,
                    "tokenModifiers": TOKEN_MODIFIERS
                },
                "full": true,
                "range": false
            },
            "documentSymbolProvider": true
        },
        "serverInfo": {
            "name": "lpc-language-server",
            "version": SERVER_VERSION
        }
    });

    let (initialize_id, _) = connection
        .initialize_start()
        .context("LSP initialization request failed")?;
    connection
        .initialize_finish(initialize_id, initialize_result)
        .context("LSP initialization response failed")?;
    run(connection)?;
    io_threads.join().context("LSP transport failed")?;
    Ok(())
}

fn run(connection: Connection) -> Result<()> {
    let mut documents = DocumentStore::default();
    let mut syntax = SyntaxStore::new()?;

    for message in &connection.receiver {
        match message {
            Message::Request(request) => {
                if connection.handle_shutdown(&request)? {
                    break;
                }
                handle_request(&connection, request, &documents, &syntax)?;
            }
            Message::Notification(notification) => {
                handle_notification(&connection, notification, &mut documents, &mut syntax)?;
            }
            Message::Response(_) => {}
        }
    }

    Ok(())
}

fn handle_request(
    connection: &Connection,
    request: Request,
    documents: &DocumentStore,
    syntax: &SyntaxStore,
) -> Result<()> {
    if request.method == HEALTH_METHOD {
        let response = HealthStatusResponse {
            status: "ok",
            mode: "rust",
            server_version: SERVER_VERSION,
            document_count: documents.len(),
            performance: PerformanceStatus {
                documents: documents.metrics(),
                syntax: syntax.metrics(),
            },
        };
        return send_ok(connection, request.id, response);
    }

    if request.method == "textDocument/semanticTokens/full" {
        let params: SemanticTokensParams = serde_json::from_value(request.params)?;
        let uri = params.text_document.uri;
        let document = documents
            .get(&uri)
            .with_context(|| format!("semantic tokens requested for unopened document {uri}"))?;
        let snapshot = syntax
            .get(&uri)
            .with_context(|| format!("semantic tokens requested without syntax for {uri}"))?;
        return send_ok(
            connection,
            request.id,
            json!({
                "data": lpc_language_server::semantic_tokens::encode(
                    &snapshot.tree,
                    &document.text
                )
            }),
        );
    }

    if request.method == "textDocument/documentSymbol" {
        let params: DocumentSymbolParams = serde_json::from_value(request.params)?;
        let uri = params.text_document.uri;
        let document = documents
            .get(&uri)
            .with_context(|| format!("document symbols requested for unopened document {uri}"))?;
        let snapshot = syntax
            .get(&uri)
            .with_context(|| format!("document symbols requested without syntax for {uri}"))?;
        return send_ok(
            connection,
            request.id,
            lpc_language_server::document_symbols::collect(&snapshot.tree, &document.text),
        );
    }

    send_error(
        connection,
        request.id,
        lsp_server::ErrorCode::MethodNotFound,
        format!("Rust LPC server does not implement {} yet", request.method),
    )
}

fn handle_notification(
    connection: &Connection,
    notification: Notification,
    documents: &mut DocumentStore,
    syntax: &mut SyntaxStore,
) -> Result<()> {
    match notification.method.as_str() {
        "textDocument/didOpen" => {
            let params: DidOpenParams = serde_json::from_value(notification.params)?;
            let uri = params.text_document.uri;
            documents.open(
                uri.clone(),
                params.text_document.version,
                params.text_document.text,
            );
            syntax.open(
                documents
                    .get(&uri)
                    .context("opened document was not retained")?,
            )?;
            publish_empty_diagnostics(connection, uri, params.text_document.version)?;
        }
        "textDocument/didChange" => {
            let params: DidChangeParams = serde_json::from_value(notification.params)?;
            let uri = params.text_document.uri;
            let version = params.text_document.version;
            let change = documents.change(&uri, version, &params.content_changes)?;
            syntax.change(
                documents
                    .get(&uri)
                    .context("changed document was not retained")?,
                &change.edits,
                change.contains_full_replacement,
            )?;
            publish_empty_diagnostics(connection, uri, version)?;
        }
        "textDocument/didClose" => {
            let params: DidCloseParams = serde_json::from_value(notification.params)?;
            documents.close(&params.text_document.uri);
            syntax.close(&params.text_document.uri);
        }
        _ => {}
    }
    Ok(())
}

fn publish_empty_diagnostics(connection: &Connection, uri: String, version: i32) -> Result<()> {
    let notification = Notification::new(
        "textDocument/publishDiagnostics".into(),
        json!({
            "uri": uri,
            "version": version,
            "diagnostics": []
        }),
    );
    connection
        .sender
        .send(Message::Notification(notification))?;
    Ok(())
}

fn send_ok(connection: &Connection, id: RequestId, value: impl serde::Serialize) -> Result<()> {
    let response = Response {
        id,
        response_result: Ok(serde_json::to_value(value)?),
    };
    connection.sender.send(Message::Response(response))?;
    Ok(())
}

fn send_error(
    connection: &Connection,
    id: RequestId,
    code: lsp_server::ErrorCode,
    message: String,
) -> Result<()> {
    let response = Response {
        id,
        response_result: Err(lsp_server::ResponseError {
            code: code as i32,
            message,
            data: Some(Value::Null),
        }),
    };
    connection.sender.send(Message::Response(response))?;
    Ok(())
}
