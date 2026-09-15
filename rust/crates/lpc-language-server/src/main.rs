use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

use anyhow::{Context, Result};
use lpc_analysis::{AnalysisDatabase, Position, Range, byte_range_to_lsp, position_to_byte};
use lpc_formatter::FormatterConfig;
use lpc_language_server::document_store::{ContentChange, DocumentStore};
use lpc_language_server::efun_docs;
use lpc_language_server::semantic_tokens::{TOKEN_MODIFIERS, TOKEN_TYPES};
use lpc_language_server::syntax_store::SyntaxStore;
use lpc_language_server::workspace_index::WorkspaceIndexController;
use lpc_preprocessor::definitions_from_list;
use lpc_protocol::{HEALTH_METHOD, HealthStatusResponse, PerformanceStatus, ProcessMemoryStatus};
use lsp_server::{Connection, Message, Notification, Request, RequestId, Response};
use serde::Deserialize;
use serde_json::{Value, json};
use url::Url;

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PositionedDocumentParams {
    text_document: TextDocumentIdentifier,
    position: Position,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReferenceParams {
    text_document: TextDocumentIdentifier,
    position: Position,
    context: ReferenceContext,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReferenceContext {
    include_declaration: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameParams {
    text_document: TextDocumentIdentifier,
    position: Position,
    new_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitializeParams {
    root_uri: Option<String>,
    #[serde(default)]
    workspace_folders: Vec<WorkspaceFolder>,
}

#[derive(Debug, Deserialize)]
struct WorkspaceFolder {
    uri: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceConfigSyncParams {
    workspace_roots: Vec<String>,
    #[serde(default)]
    workspaces: Vec<WorkspaceConfigSnapshot>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceConfigSnapshot {
    #[serde(default)]
    preprocessor_defines: Vec<String>,
    #[serde(default)]
    instance_resolution_functions: HashMap<String, Vec<String>>,
    resolved_config: Option<ResolvedConfigSnapshot>,
    enable_type_checking: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResolvedConfigSnapshot {
    #[serde(default)]
    include_directories: Vec<String>,
    global_include_file: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceFileChangeParams {
    uri: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentVariablesParams {
    text_document: TextDocumentIdentifier,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceDiagnosticsParams {
    uri_prefix: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FormattingParams {
    text_document: TextDocumentIdentifier,
    options: FormattingOptions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RangeFormattingParams {
    text_document: TextDocumentIdentifier,
    range: Range,
    options: FormattingOptions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FormattingOptions {
    tab_size: usize,
    insert_spaces: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodeActionParams {
    text_document: TextDocumentIdentifier,
    context: CodeActionContext,
}

#[derive(Debug, Deserialize)]
struct CodeActionContext {
    diagnostics: Vec<InputDiagnostic>,
}

#[derive(Debug, Deserialize)]
struct InputDiagnostic {
    range: Range,
    code: Option<Value>,
    message: String,
}

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
            "documentSymbolProvider": true,
            "foldingRangeProvider": true,
            "definitionProvider": true,
            "hoverProvider": true,
            "referencesProvider": true,
            "renameProvider": { "prepareProvider": true },
            "signatureHelpProvider": {
                "triggerCharacters": ["(", ","]
            },
            "completionProvider": {
                "resolveProvider": false,
                "triggerCharacters": [".", ">", ":"]
            },
            "documentFormattingProvider": true,
            "documentRangeFormattingProvider": true
            ,"codeActionProvider": { "codeActionKinds": ["quickfix"] }
        },
        "serverInfo": {
            "name": "lpc-language-server",
            "version": SERVER_VERSION
        }
    });

    let (initialize_id, initialize_params) = connection
        .initialize_start()
        .context("LSP initialization request failed")?;
    connection
        .initialize_finish(initialize_id, initialize_result)
        .context("LSP initialization response failed")?;
    let efuns = efun_docs::load_from_environment().unwrap_or_else(|error| {
        eprintln!("lpc-language-server: efun documentation unavailable: {error:#}");
        Vec::new()
    });
    run(connection, workspace_roots(initialize_params), efuns)?;
    io_threads.join().context("LSP transport failed")?;
    Ok(())
}

fn run(
    connection: Connection,
    workspace_roots: Vec<PathBuf>,
    efuns: Vec<lpc_analysis::ExternalFunction>,
) -> Result<()> {
    let mut documents = DocumentStore::default();
    let mut syntax = SyntaxStore::new()?;
    let analysis = Arc::new(Mutex::new(AnalysisDatabase::default()));
    analysis
        .lock()
        .expect("analysis lock poisoned")
        .set_external_functions(efuns);
    let workspace_index = WorkspaceIndexController::default();
    if !workspace_roots.is_empty() {
        workspace_index.start(workspace_roots, Vec::new(), Arc::clone(&analysis));
    }

    for message in &connection.receiver {
        match message {
            Message::Request(request) => {
                if connection.handle_shutdown(&request)? {
                    break;
                }
                if request.method == "lpc/workspaceIndex/rebuild" {
                    let params: WorkspaceConfigSyncParams = serde_json::from_value(request.params)?;
                    let type_checking_enabled = params
                        .workspaces
                        .iter()
                        .all(|workspace| workspace.enable_type_checking.unwrap_or(true));
                    let definitions = definitions_from_list(
                        &params
                            .workspaces
                            .iter()
                            .flat_map(|workspace| workspace.preprocessor_defines.iter().cloned())
                            .collect::<Vec<_>>(),
                    );
                    let roots: Vec<_> = params
                        .workspace_roots
                        .into_iter()
                        .map(PathBuf::from)
                        .collect();
                    {
                        let mut database = analysis
                            .lock()
                            .map_err(|_| anyhow::anyhow!("analysis database lock was poisoned"))?;
                        database.set_type_checking_enabled(type_checking_enabled);
                        apply_workspace_resolution(&mut database, &params.workspaces);
                    }
                    connection
                        .sender
                        .send(Message::Notification(Notification::new(
                            "lpc/workspaceIndex/progress".to_owned(),
                            json!({
                                "status": "building",
                                "totalFiles": 0,
                                "processedFiles": 0,
                                "indexedFiles": 0,
                                "skippedFiles": 0,
                                "failedFiles": 0
                            }),
                        )))?;
                    let result = workspace_index.rebuild(roots, definitions, Arc::clone(&analysis));
                    connection
                        .sender
                        .send(Message::Notification(Notification::new(
                            "lpc/workspaceIndex/progress".to_owned(),
                            json!({
                                "status": "building",
                                "totalFiles": result.total_files,
                                "processedFiles": result.total_files,
                                "indexedFiles": result.indexed_files,
                                "skippedFiles": result.skipped_files,
                                "failedFiles": result.failed_files
                            }),
                        )))?;
                    send_ok(&connection, request.id, result)?;
                    continue;
                }
                let mut database = analysis
                    .lock()
                    .map_err(|_| anyhow::anyhow!("analysis database lock was poisoned"))?;
                handle_request(&connection, request, &documents, &syntax, &mut database)?;
            }
            Message::Notification(notification) => {
                if notification.method == "lpc/workspaceConfigSync" {
                    let params: WorkspaceConfigSyncParams =
                        serde_json::from_value(notification.params)?;
                    let type_checking_enabled = params
                        .workspaces
                        .iter()
                        .all(|workspace| workspace.enable_type_checking.unwrap_or(true));
                    let definitions = definitions_from_list(
                        &params
                            .workspaces
                            .iter()
                            .flat_map(|workspace| workspace.preprocessor_defines.iter().cloned())
                            .collect::<Vec<_>>(),
                    );
                    syntax.set_predefined(&definitions);
                    {
                        let mut database = analysis
                            .lock()
                            .map_err(|_| anyhow::anyhow!("analysis database lock was poisoned"))?;
                        database.set_type_checking_enabled(type_checking_enabled);
                        apply_workspace_resolution(&mut database, &params.workspaces);
                        for document in documents.iter() {
                            let snapshot = syntax.open(document)?;
                            database.invalidate(&document.uri);
                            database.update(
                                &document.uri,
                                document.version,
                                document.revision,
                                &snapshot.tree,
                                &document.text,
                            );
                            publish_diagnostics(
                                &connection,
                                document.uri.clone(),
                                document.version,
                                database.diagnostics(&document.uri),
                            )?;
                        }
                    }
                    workspace_index.start(
                        params
                            .workspace_roots
                            .into_iter()
                            .map(PathBuf::from)
                            .collect(),
                        definitions,
                        Arc::clone(&analysis),
                    );
                    continue;
                }
                if notification.method == "lpc/sourceFileChange" {
                    let params: SourceFileChangeParams =
                        serde_json::from_value(notification.params)?;
                    workspace_index.update_uri(params.uri, Arc::clone(&analysis));
                    continue;
                }
                let mut database = analysis
                    .lock()
                    .map_err(|_| anyhow::anyhow!("analysis database lock was poisoned"))?;
                handle_notification(
                    &connection,
                    notification,
                    &mut documents,
                    &mut syntax,
                    &mut database,
                )?;
            }
            Message::Response(_) => {}
        }
    }

    workspace_index.cancel();
    Ok(())
}

fn apply_workspace_resolution(
    database: &mut AnalysisDatabase,
    workspaces: &[WorkspaceConfigSnapshot],
) {
    let global_includes = workspaces
        .iter()
        .filter_map(|workspace| workspace.resolved_config.as_ref())
        .filter_map(|config| config.global_include_file.clone())
        .map(|path| path.trim_matches(['<', '>', '"']).to_owned())
        .collect();
    let include_directories = workspaces
        .iter()
        .filter_map(|workspace| workspace.resolved_config.as_ref())
        .flat_map(|config| config.include_directories.iter().cloned())
        .collect();
    let mut instance_resolution_functions = HashMap::<String, Vec<String>>::new();
    for workspace in workspaces {
        for (name, paths) in &workspace.instance_resolution_functions {
            let targets = instance_resolution_functions
                .entry(name.clone())
                .or_default();
            for path in paths {
                if !targets.contains(path) {
                    targets.push(path.clone());
                }
            }
        }
    }
    database.set_workspace_resolution(
        global_includes,
        include_directories,
        instance_resolution_functions,
    );
}

fn workspace_roots(value: Value) -> Vec<PathBuf> {
    let Ok(params) = serde_json::from_value::<InitializeParams>(value) else {
        return Vec::new();
    };
    let uris: Vec<_> = if params.workspace_folders.is_empty() {
        params.root_uri.into_iter().collect()
    } else {
        params
            .workspace_folders
            .into_iter()
            .map(|folder| folder.uri)
            .collect()
    };
    uris.into_iter()
        .filter_map(|uri| Url::parse(&uri).ok()?.to_file_path().ok())
        .collect()
}

fn handle_request(
    connection: &Connection,
    request: Request,
    documents: &DocumentStore,
    syntax: &SyntaxStore,
    analysis: &mut AnalysisDatabase,
) -> Result<()> {
    if request.method == HEALTH_METHOD {
        let analysis_metrics = analysis.metrics();
        let response = HealthStatusResponse {
            status: "ok",
            mode: "rust",
            server_version: SERVER_VERSION,
            document_count: documents.len(),
            performance: PerformanceStatus {
                documents: documents.metrics(),
                syntax: syntax.metrics(),
                process_memory: process_memory_status(),
                analysis_snapshot_build_count: analysis_metrics.snapshot_build_count,
                analysis_query_count: analysis_metrics.query_count,
                analysis_total_build_time_micros: analysis_metrics.total_build_time_micros,
                indexed_file_count: analysis_metrics.indexed_file_count,
            },
        };
        return send_ok(connection, request.id, response);
    }

    if request.method == "lpc/documentVariables" {
        let params: DocumentVariablesParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.document_variables(&params.text_document.uri),
        );
    }

    if request.method == "lpc/enclosingFunction" {
        let params: PositionedDocumentParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.enclosing_function(&params.text_document.uri, params.position),
        );
    }

    if request.method == "lpc/functionDocumentation" {
        let params: DocumentVariablesParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.function_documentation_lookup(&params.text_document.uri),
        );
    }

    if request.method == "lpc/workspaceDiagnostics" {
        let params: WorkspaceDiagnosticsParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.workspace_diagnostics(&params.uri_prefix),
        );
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

    if request.method == "textDocument/foldingRange" {
        let params: SemanticTokensParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.folding_ranges(&params.text_document.uri),
        );
    }

    if request.method == "textDocument/definition" {
        let params: PositionedDocumentParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.definition(&params.text_document.uri, params.position),
        );
    }

    if request.method == "textDocument/hover" {
        let params: PositionedDocumentParams = serde_json::from_value(request.params)?;
        let result = analysis.hover(&params.text_document.uri, params.position);
        return send_ok(
            connection,
            request.id,
            result.map(|hover| {
                json!({
                    "contents": { "kind": "markdown", "value": hover.contents },
                    "range": hover.range
                })
            }),
        );
    }

    if request.method == "textDocument/references" {
        let params: ReferenceParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.references(
                &params.text_document.uri,
                params.position,
                params.context.include_declaration,
            ),
        );
    }

    if request.method == "textDocument/completion" {
        let params: PositionedDocumentParams = serde_json::from_value(request.params)?;
        let items = analysis.completion_candidates(&params.text_document.uri, params.position);
        return send_ok(connection, request.id, items);
    }

    if request.method == "textDocument/prepareRename" {
        let params: PositionedDocumentParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.prepare_rename(&params.text_document.uri, params.position),
        );
    }

    if request.method == "textDocument/rename" {
        let params: RenameParams = serde_json::from_value(request.params)?;
        let changes =
            analysis.rename_edits(&params.text_document.uri, params.position, &params.new_name);
        return send_ok(connection, request.id, json!({ "changes": changes }));
    }

    if request.method == "textDocument/signatureHelp" {
        let params: PositionedDocumentParams = serde_json::from_value(request.params)?;
        return send_ok(
            connection,
            request.id,
            analysis.signature_help(&params.text_document.uri, params.position),
        );
    }

    if request.method == "textDocument/formatting" {
        let params: FormattingParams = serde_json::from_value(request.params)?;
        let uri = params.text_document.uri;
        let document = documents
            .get(&uri)
            .with_context(|| format!("formatting requested for unopened document {uri}"))?;
        let snapshot = syntax
            .get(&uri)
            .with_context(|| format!("formatting requested without syntax for {uri}"))?;
        let config = formatting_config(&params.options);
        let edits = lpc_formatter::format_document(&snapshot.tree, &document.text, config)
            .map(|new_text| {
                vec![json!({
                    "range": byte_range_to_lsp(&document.text, 0..document.text.len()),
                    "newText": new_text
                })]
            })
            .unwrap_or_default();
        return send_ok(connection, request.id, edits);
    }

    if request.method == "textDocument/rangeFormatting" {
        let params: RangeFormattingParams = serde_json::from_value(request.params)?;
        let uri = params.text_document.uri;
        let document = documents
            .get(&uri)
            .with_context(|| format!("range formatting requested for unopened document {uri}"))?;
        let snapshot = syntax
            .get(&uri)
            .with_context(|| format!("range formatting requested without syntax for {uri}"))?;
        let start = position_to_byte(&document.text, params.range.start)
            .context("range formatting start is outside the document")?;
        let end = position_to_byte(&document.text, params.range.end)
            .context("range formatting end is outside the document")?;
        let edits = lpc_formatter::format_range(
            &snapshot.tree,
            &document.text,
            start,
            end,
            formatting_config(&params.options),
        )
        .map(|(range, new_text)| {
            vec![json!({
                "range": byte_range_to_lsp(&document.text, range),
                "newText": new_text
            })]
        })
        .unwrap_or_default();
        return send_ok(connection, request.id, edits);
    }

    if request.method == "textDocument/codeAction" {
        let params: CodeActionParams = serde_json::from_value(request.params)?;
        let Some(document) = documents.get(&params.text_document.uri) else {
            return send_ok(connection, request.id, Vec::<Value>::new());
        };
        let actions: Vec<_> = params
            .context
            .diagnostics
            .into_iter()
            .filter_map(|diagnostic| {
                let code = diagnostic.code.as_ref().and_then(|code| code.as_str())?;
                if !matches!(code, "unusedVar" | "unusedParam" | "unusedGlobalVar") {
                    return None;
                }
                let start = position_to_byte(&document.text, diagnostic.range.start)?;
                let end = position_to_byte(&document.text, diagnostic.range.end)?;
                let name = document.text.get(start..end)?;
                Some(json!({
                    "title": format!("将未使用的 `{name}` 标记为有意保留"),
                    "kind": "quickfix",
                    "diagnostics": [{
                        "range": diagnostic.range,
                        "code": code,
                        "message": diagnostic.message
                    }],
                    "isPreferred": true,
                    "edit": {
                        "changes": {
                            params.text_document.uri.clone(): [{
                                "range": diagnostic.range,
                                "newText": format!("_{name}")
                            }]
                        }
                    }
                }))
            })
            .collect();
        return send_ok(connection, request.id, actions);
    }

    send_error(
        connection,
        request.id,
        lsp_server::ErrorCode::MethodNotFound,
        format!("Rust LPC server does not implement {} yet", request.method),
    )
}

fn formatting_config(options: &FormattingOptions) -> FormatterConfig {
    FormatterConfig {
        indent_size: if options.insert_spaces {
            options.tab_size.clamp(1, 16)
        } else {
            4
        },
    }
}

fn handle_notification(
    connection: &Connection,
    notification: Notification,
    documents: &mut DocumentStore,
    syntax: &mut SyntaxStore,
    analysis: &mut AnalysisDatabase,
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
            let document = documents
                .get(&uri)
                .context("opened document was not retained")?;
            let snapshot = syntax.open(document)?;
            analysis.update(
                &uri,
                document.version,
                document.revision,
                &snapshot.tree,
                &document.text,
            );
            publish_diagnostics(
                connection,
                uri.clone(),
                params.text_document.version,
                analysis.diagnostics(&uri),
            )?;
        }
        "textDocument/didChange" => {
            let params: DidChangeParams = serde_json::from_value(notification.params)?;
            let uri = params.text_document.uri;
            let version = params.text_document.version;
            let change = documents.change(&uri, version, &params.content_changes)?;
            let document = documents
                .get(&uri)
                .context("changed document was not retained")?;
            let snapshot =
                syntax.change(document, &change.edits, change.contains_full_replacement)?;
            analysis.update(
                &uri,
                document.version,
                document.revision,
                &snapshot.tree,
                &document.text,
            );
            publish_diagnostics(connection, uri.clone(), version, analysis.diagnostics(&uri))?;
        }
        "textDocument/didClose" => {
            let params: DidCloseParams = serde_json::from_value(notification.params)?;
            documents.close(&params.text_document.uri);
            syntax.close(&params.text_document.uri);
            analysis.remove(&params.text_document.uri);
        }
        _ => {}
    }
    Ok(())
}

fn publish_diagnostics(
    connection: &Connection,
    uri: String,
    version: i32,
    diagnostics: Vec<lpc_analysis::Diagnostic>,
) -> Result<()> {
    let notification = Notification::new(
        "textDocument/publishDiagnostics".into(),
        json!({
            "uri": uri,
            "version": version,
            "diagnostics": diagnostics
        }),
    );
    connection
        .sender
        .send(Message::Notification(notification))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn process_memory_status() -> ProcessMemoryStatus {
    let status = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
    ProcessMemoryStatus {
        resident_bytes: linux_memory_bytes(&status, "VmRSS:"),
        peak_resident_bytes: linux_memory_bytes(&status, "VmHWM:"),
    }
}

#[cfg(target_os = "linux")]
fn linux_memory_bytes(status: &str, field: &str) -> u64 {
    status
        .lines()
        .find_map(|line| {
            line.strip_prefix(field)?
                .split_whitespace()
                .next()?
                .parse::<u64>()
                .ok()
        })
        .unwrap_or_default()
        .saturating_mul(1024)
}

#[cfg(target_os = "macos")]
fn process_memory_status() -> ProcessMemoryStatus {
    let resident_bytes = std::process::Command::new("ps")
        .args(["-o", "rss=", "-p", &std::process::id().to_string()])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .unwrap_or_default()
        .saturating_mul(1024);
    ProcessMemoryStatus {
        resident_bytes,
        peak_resident_bytes: resident_bytes,
    }
}

#[cfg(windows)]
fn process_memory_status() -> ProcessMemoryStatus {
    #[repr(C)]
    struct ProcessMemoryCounters {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        #[link_name = "GetCurrentProcess"]
        fn get_current_process() -> isize;
        #[link_name = "K32GetProcessMemoryInfo"]
        fn get_process_memory_info(
            process: isize,
            counters: *mut ProcessMemoryCounters,
            size: u32,
        ) -> i32;
    }

    let mut counters = ProcessMemoryCounters {
        cb: std::mem::size_of::<ProcessMemoryCounters>() as u32,
        page_fault_count: 0,
        peak_working_set_size: 0,
        working_set_size: 0,
        quota_peak_paged_pool_usage: 0,
        quota_paged_pool_usage: 0,
        quota_peak_non_paged_pool_usage: 0,
        quota_non_paged_pool_usage: 0,
        pagefile_usage: 0,
        peak_pagefile_usage: 0,
    };
    let succeeded = unsafe {
        get_process_memory_info(
            get_current_process(),
            &mut counters,
            std::mem::size_of::<ProcessMemoryCounters>() as u32,
        )
    };
    if succeeded == 0 {
        return ProcessMemoryStatus::default();
    }
    ProcessMemoryStatus {
        resident_bytes: counters.working_set_size as u64,
        peak_resident_bytes: counters.peak_working_set_size as u64,
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
fn process_memory_status() -> ProcessMemoryStatus {
    ProcessMemoryStatus::default()
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
