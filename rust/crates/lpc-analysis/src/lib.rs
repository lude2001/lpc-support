use std::{
    collections::{HashMap, HashSet},
    time::Instant,
};

use serde::{Deserialize, Serialize};
use tree_sitter::{Node, Tree};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: u32,
    pub code: &'static str,
    pub source: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FoldingRange {
    pub start_line: u32,
    pub end_line: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<&'static str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SymbolKind {
    Function,
    Variable,
    Parameter,
    Type,
}

#[derive(Debug, Clone)]
struct Symbol {
    name: String,
    kind: SymbolKind,
    selection: std::ops::Range<usize>,
    scope: std::ops::Range<usize>,
    detail: String,
    documentation: Option<String>,
    local: bool,
    parameters: Vec<String>,
}

#[derive(Debug, Clone)]
struct FileAnalysis {
    version: i32,
    revision: u64,
    source: String,
    symbols: Vec<Symbol>,
    identifiers: Vec<std::ops::Range<usize>>,
    diagnostics: Vec<Diagnostic>,
    folding_ranges: Vec<FoldingRange>,
    calls: Vec<CallSite>,
    dependencies: Vec<String>,
}

#[derive(Debug, Clone)]
struct CallSite {
    name: String,
    range: std::ops::Range<usize>,
    argument_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExternalFunction {
    pub name: String,
    pub summary: Option<String>,
    pub signatures: Vec<ExternalSignature>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExternalSignature {
    pub label: String,
    pub parameters: Vec<String>,
    pub minimum_arguments: usize,
    pub maximum_arguments: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisMetrics {
    pub snapshot_build_count: u64,
    pub query_count: u64,
    pub total_build_time_micros: u64,
    pub indexed_file_count: u64,
}

#[derive(Debug, Default)]
pub struct AnalysisDatabase {
    files: HashMap<String, FileAnalysis>,
    external_functions: HashMap<String, ExternalFunction>,
    type_checking_enabled: Option<bool>,
    metrics: AnalysisMetrics,
}

impl AnalysisDatabase {
    pub fn set_external_functions(&mut self, functions: Vec<ExternalFunction>) {
        self.external_functions = functions
            .into_iter()
            .map(|function| (function.name.clone(), function))
            .collect();
    }

    pub fn set_type_checking_enabled(&mut self, enabled: bool) {
        self.type_checking_enabled = Some(enabled);
    }

    pub fn update(&mut self, uri: &str, version: i32, revision: u64, tree: &Tree, source: &str) {
        if version < 0 && self.files.get(uri).is_some_and(|file| file.version >= 0) {
            return;
        }
        if self
            .files
            .get(uri)
            .is_some_and(|file| file.version == version && file.revision == revision)
        {
            return;
        }
        let started_at = Instant::now();
        let mut symbols = Vec::new();
        collect_symbols(tree.root_node(), source, &mut symbols);
        let mut identifiers = Vec::new();
        collect_identifiers(tree.root_node(), &mut identifiers);
        let diagnostics = collect_diagnostics(tree, source);
        let folding_ranges = collect_folding_ranges(tree, source);
        let mut calls = Vec::new();
        collect_calls(tree.root_node(), source, &mut calls);
        let dependencies = collect_dependencies(tree.root_node(), source);
        self.files.insert(
            uri.to_owned(),
            FileAnalysis {
                version,
                revision,
                source: source.to_owned(),
                symbols,
                identifiers,
                diagnostics,
                folding_ranges,
                calls,
                dependencies,
            },
        );
        self.metrics.snapshot_build_count += 1;
        self.metrics.total_build_time_micros +=
            started_at.elapsed().as_micros().min(u128::from(u64::MAX)) as u64;
        self.metrics.indexed_file_count =
            self.files.values().filter(|file| file.version < 0).count() as u64;
    }

    pub fn index_source(&mut self, uri: &str, tree: &Tree, source: &str) {
        self.update(uri, -1, 0, tree, source);
    }

    pub fn remove(&mut self, uri: &str) {
        self.files.remove(uri);
        self.metrics.indexed_file_count =
            self.files.values().filter(|file| file.version < 0).count() as u64;
    }

    pub fn remove_indexed(&mut self, uri: &str) {
        if self.files.get(uri).is_some_and(|file| file.version < 0) {
            self.remove(uri);
        }
    }

    pub fn invalidate(&mut self, uri: &str) {
        self.files.remove(uri);
    }

    pub fn clear_indexed(&mut self) {
        self.files.retain(|_, file| file.version >= 0);
        self.metrics.indexed_file_count = 0;
    }

    pub fn diagnostics(&mut self, uri: &str) -> Vec<Diagnostic> {
        self.metrics.query_count += 1;
        let Some(file) = self.files.get(uri) else {
            return Vec::new();
        };
        let visible = self.visible_uris(uri);
        let mut diagnostics = file.diagnostics.clone();
        if self.type_checking_enabled == Some(false) {
            diagnostics.retain(|diagnostic| diagnostic.code != "lpc.typeMismatch");
        }
        for symbol in file.symbols.iter().filter(|symbol| {
            symbol.local && !symbol.name.starts_with('_') && symbol.kind == SymbolKind::Variable
        }) {
            let reference_count = file
                .identifiers
                .iter()
                .filter(|range| {
                    symbol.scope.contains(&range.start)
                        && file.source.get((*range).clone()) == Some(symbol.name.as_str())
                })
                .count();
            if reference_count <= 1 {
                diagnostics.push(Diagnostic {
                    range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    severity: 2,
                    code: "unusedVar",
                    source: "lpc-support",
                    message: format!("局部变量 '{}' 未被使用", symbol.name),
                });
            }
        }
        for call in &file.calls {
            let signatures: Vec<_> = self
                .files
                .iter()
                .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
                .flat_map(|(_, candidate)| candidate.symbols.iter())
                .filter(|symbol| symbol.kind == SymbolKind::Function && symbol.name == call.name)
                .collect();
            let has_workspace_override = self.files.values().any(|candidate| {
                candidate
                    .symbols
                    .iter()
                    .any(|symbol| symbol.kind == SymbolKind::Function && symbol.name == call.name)
            });
            let external_signatures = if signatures.is_empty() && !has_workspace_override {
                self.external_functions
                    .get(&call.name)
                    .map(|function| function.signatures.as_slice())
                    .unwrap_or_default()
            } else {
                &[]
            };
            let accepts_source_signature = signatures
                .iter()
                .any(|signature| accepts_arguments(signature, call.argument_count));
            let accepts_external_signature = external_signatures.iter().any(|signature| {
                call.argument_count >= signature.minimum_arguments
                    && signature
                        .maximum_arguments
                        .is_none_or(|maximum| call.argument_count <= maximum)
            });
            if (!signatures.is_empty() || !external_signatures.is_empty())
                && !accepts_source_signature
                && !accepts_external_signature
            {
                diagnostics.push(Diagnostic {
                    range: byte_range_to_lsp(&file.source, call.range.clone()),
                    severity: 2,
                    code: "lpc.argumentCountMismatch",
                    source: "lpc-support",
                    message: format!(
                        "函数 {} 参数数量不匹配: 当前 {} 个",
                        call.name, call.argument_count
                    ),
                });
            }
        }
        diagnostics
    }

    pub fn folding_ranges(&mut self, uri: &str) -> Vec<FoldingRange> {
        self.metrics.query_count += 1;
        self.files
            .get(uri)
            .map_or_else(Vec::new, |file| file.folding_ranges.clone())
    }

    pub fn definition(&mut self, uri: &str, position: Position) -> Vec<Location> {
        self.metrics.query_count += 1;
        let Some((name, offset)) = self.identifier_at(uri, position) else {
            return Vec::new();
        };
        let Some(origin) = self.files.get(uri) else {
            return Vec::new();
        };
        if identifier_range(origin, offset)
            .is_some_and(|range| is_member_access(&origin.source, range.start))
        {
            return Vec::new();
        }

        let candidates = resolved_symbols(origin, &name, offset);
        if let Some(symbol) = candidates.first() {
            return vec![Location {
                uri: uri.to_owned(),
                range: byte_range_to_lsp(&origin.source, symbol.selection.clone()),
            }];
        }

        let visible = self.visible_uris(uri);
        let visible_locations = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(candidate_uri, file)| {
                file.symbols
                    .iter()
                    .filter(|symbol| {
                        symbol.name == name
                            && matches!(
                                symbol.kind,
                                SymbolKind::Function | SymbolKind::Variable | SymbolKind::Type
                            )
                            && !symbol.local
                    })
                    .map(|symbol| Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    })
            })
            .collect::<Vec<_>>();
        if !visible_locations.is_empty() {
            return visible_locations;
        }
        let workspace_locations = self
            .files
            .iter()
            .flat_map(|(candidate_uri, file)| {
                file.symbols
                    .iter()
                    .filter(|symbol| {
                        symbol.name == name
                            && !symbol.local
                            && matches!(
                                symbol.kind,
                                SymbolKind::Function | SymbolKind::Variable | SymbolKind::Type
                            )
                    })
                    .map(|symbol| Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    })
            })
            .collect::<Vec<_>>();
        if workspace_locations.len() == 1 {
            workspace_locations
        } else {
            Vec::new()
        }
    }

    pub fn hover(&mut self, uri: &str, position: Position) -> Option<HoverResult> {
        self.metrics.query_count += 1;
        let (name, offset) = self.identifier_at(uri, position)?;
        let file = self.files.get(uri)?;
        if identifier_range(file, offset)
            .is_some_and(|range| is_member_access(&file.source, range.start))
        {
            return None;
        }
        let symbols = resolved_symbols(file, &name, offset);
        let visible = self.visible_uris(uri);
        let mut workspace_symbols = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(_, candidate)| candidate.symbols.iter())
            .filter(|symbol| symbol.name == name && !symbol.local)
            .collect::<Vec<_>>();
        if workspace_symbols.is_empty() {
            workspace_symbols = self
                .files
                .values()
                .flat_map(|candidate| candidate.symbols.iter())
                .filter(|symbol| symbol.name == name && !symbol.local)
                .collect();
        }
        let symbol = symbols
            .first()
            .copied()
            .or_else(|| (workspace_symbols.len() == 1).then(|| workspace_symbols[0]));
        let identifier = identifier_range(file, offset)?;
        if let Some(symbol) = symbol {
            return Some(HoverResult {
                contents: match symbol.documentation.as_deref() {
                    Some(documentation) => {
                        format!("```lpc\n{}\n```\n\n{documentation}", symbol.detail)
                    }
                    None => format!("```lpc\n{}\n```", symbol.detail),
                },
                range: byte_range_to_lsp(&file.source, identifier),
            });
        }
        let external = self.external_functions.get(&name)?;
        let signatures = external
            .signatures
            .iter()
            .map(|signature| signature.label.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        let summary = external.summary.as_deref().unwrap_or_default();
        Some(HoverResult {
            contents: format!("```lpc\n{signatures}\n```\n\n{summary}"),
            range: byte_range_to_lsp(&file.source, identifier),
        })
    }

    pub fn references(
        &mut self,
        uri: &str,
        position: Position,
        include_declaration: bool,
    ) -> Vec<Location> {
        self.metrics.query_count += 1;
        let Some((name, offset)) = self.identifier_at(uri, position) else {
            return Vec::new();
        };
        let Some(origin) = self.files.get(uri) else {
            return Vec::new();
        };
        let resolved = resolved_symbols(origin, &name, offset).first().copied();
        if resolved.is_none() {
            return Vec::new();
        }
        let related = self.related_uris(uri);
        let local_scope = resolved
            .filter(|symbol| symbol.local)
            .map(|symbol| symbol.scope.clone());
        let declaration_ranges: HashSet<_> = resolved
            .into_iter()
            .map(|symbol| (symbol.selection.start, symbol.selection.end))
            .collect();
        self.files
            .iter()
            .filter(|(candidate_uri, _)| {
                if local_scope.is_some() {
                    candidate_uri.as_str() == uri
                } else {
                    related.contains(candidate_uri.as_str())
                }
            })
            .flat_map(|(candidate_uri, file)| {
                let declaration_ranges = &declaration_ranges;
                let local_scope = local_scope.clone();
                let name = name.clone();
                file.identifiers.iter().filter_map(move |range| {
                    let text = file.source.get(range.clone())?;
                    if text != name
                        || (!include_declaration
                            && declaration_ranges.contains(&(range.start, range.end)))
                        || local_scope
                            .as_ref()
                            .is_some_and(|scope| !scope.contains(&range.start))
                    {
                        return None;
                    }
                    Some(Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, range.clone()),
                    })
                })
            })
            .collect()
    }

    pub fn prepare_rename(&mut self, uri: &str, position: Position) -> Option<Range> {
        self.metrics.query_count += 1;
        let file = self.files.get(uri)?;
        let offset = lsp_position_to_byte(&file.source, position)?;
        let range = identifier_range(file, offset)?;
        let name = file.source.get(range.clone())?;
        let resolved = resolved_symbols(file, name, offset);
        (!KEYWORDS.contains(&name) && !resolved.is_empty())
            .then(|| byte_range_to_lsp(&file.source, range))
    }

    pub fn rename_edits(
        &mut self,
        uri: &str,
        position: Position,
        new_name: &str,
    ) -> HashMap<String, Vec<TextEdit>> {
        if !valid_identifier(new_name) {
            return HashMap::new();
        }
        let Some((name, offset)) = self.identifier_at(uri, position) else {
            return HashMap::new();
        };
        let Some(file) = self.files.get(uri) else {
            return HashMap::new();
        };
        let resolved = resolved_symbols(file, &name, offset);
        if resolved.is_empty() {
            return HashMap::new();
        }
        if resolved.iter().all(|symbol| !symbol.local) {
            let edits = file
                .identifiers
                .iter()
                .filter(|range| {
                    file.source.get((*range).clone()) == Some(name.as_str())
                        && resolved_symbols(file, &name, range.start)
                            .first()
                            .is_some_and(|symbol| !symbol.local)
                })
                .map(|range| TextEdit {
                    range: byte_range_to_lsp(&file.source, range.clone()),
                    new_text: new_name.to_owned(),
                })
                .collect::<Vec<_>>();
            return HashMap::from([(uri.to_owned(), edits)]);
        }
        self.references(uri, position, true).into_iter().fold(
            HashMap::new(),
            |mut changes, location| {
                changes
                    .entry(location.uri)
                    .or_insert_with(Vec::new)
                    .push(TextEdit {
                        range: location.range,
                        new_text: new_name.to_owned(),
                    });
                changes
            },
        )
    }

    pub fn signature_help(&mut self, uri: &str, position: Position) -> Option<SignatureHelp> {
        self.metrics.query_count += 1;
        let file = self.files.get(uri)?;
        let offset = lsp_position_to_byte(&file.source, position)?;
        let (open, name) = enclosing_call(&file.source, offset)?;
        if is_member_access(&file.source, open.saturating_sub(name.len())) {
            return None;
        }
        let local_symbol = file
            .symbols
            .iter()
            .find(|symbol| symbol.kind == SymbolKind::Function && symbol.name == name);
        let visible = self.visible_uris(uri);
        let mut workspace_symbols = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(_, candidate)| candidate.symbols.iter())
            .filter(|symbol| symbol.kind == SymbolKind::Function && symbol.name == name)
            .collect::<Vec<_>>();
        if workspace_symbols.is_empty() {
            workspace_symbols = self
                .files
                .values()
                .flat_map(|candidate| candidate.symbols.iter())
                .filter(|symbol| symbol.kind == SymbolKind::Function && symbol.name == name)
                .collect();
        }
        let symbol =
            local_symbol.or_else(|| (workspace_symbols.len() == 1).then(|| workspace_symbols[0]));
        let signatures = if let Some(symbol) = symbol {
            vec![SignatureInformation {
                label: symbol.detail.clone(),
                documentation: symbol.documentation.clone(),
                parameters: symbol
                    .parameters
                    .iter()
                    .map(|label| ParameterInformation {
                        label: label.clone(),
                    })
                    .collect(),
            }]
        } else {
            self.external_functions
                .get(&name)?
                .signatures
                .iter()
                .map(|signature| SignatureInformation {
                    label: signature.label.clone(),
                    documentation: self
                        .external_functions
                        .get(&name)
                        .and_then(|function| function.summary.clone()),
                    parameters: signature
                        .parameters
                        .iter()
                        .map(|label| ParameterInformation {
                            label: label.clone(),
                        })
                        .collect(),
                })
                .collect()
        };
        Some(SignatureHelp {
            signatures,
            active_signature: 0,
            active_parameter: active_parameter(&file.source[open + 1..offset]),
        })
    }

    pub fn completion_labels(&mut self, uri: &str) -> Vec<String> {
        self.metrics.query_count += 1;
        let mut labels: HashSet<String> = self
            .files
            .values()
            .flat_map(|file| file.symbols.iter().map(|symbol| symbol.name.clone()))
            .collect();
        if let Some(file) = self.files.get(uri) {
            labels.extend(file.symbols.iter().map(|symbol| symbol.name.clone()));
        }
        labels.extend(KEYWORDS.iter().map(|keyword| (*keyword).to_owned()));
        labels.extend(self.external_functions.keys().cloned());
        let mut labels: Vec<_> = labels.into_iter().collect();
        labels.sort();
        labels
    }

    pub fn completion_candidates(
        &mut self,
        uri: &str,
        position: Position,
    ) -> Vec<CompletionCandidate> {
        self.metrics.query_count += 1;
        let mut candidates = HashMap::<String, CompletionCandidate>::new();
        let prefix = self
            .files
            .get(uri)
            .and_then(|file| completion_prefix(&file.source, position))
            .unwrap_or_default();
        let member_access = self.files.get(uri).is_some_and(|file| {
            let end = lsp_position_to_byte(&file.source, position).unwrap_or(file.source.len());
            is_member_access(&file.source, end.saturating_sub(prefix.len()))
        });
        if member_access {
            let normalized_prefix = prefix.to_ascii_lowercase();
            return COMMON_OBJECT_METHODS
                .iter()
                .filter(|name| {
                    normalized_prefix.is_empty()
                        || name.to_ascii_lowercase().starts_with(&normalized_prefix)
                })
                .map(|name| CompletionCandidate {
                    label: (*name).to_owned(),
                    kind: 2,
                    detail: Some(format!("object->{name}(...)")),
                    documentation: None,
                })
                .collect();
        }
        if let Some(file) = self.files.get(uri) {
            let offset = lsp_position_to_byte(&file.source, position).unwrap_or(file.source.len());
            for symbol in file.symbols.iter().filter(|symbol| {
                !symbol.local
                    || (symbol.scope.contains(&offset) && symbol.selection.start <= offset)
            }) {
                candidates.insert(
                    symbol.name.clone(),
                    CompletionCandidate {
                        label: symbol.name.clone(),
                        kind: match symbol.kind {
                            SymbolKind::Function => 3,
                            SymbolKind::Variable | SymbolKind::Parameter => 6,
                            SymbolKind::Type => 7,
                        },
                        detail: Some(symbol.detail.clone()),
                        documentation: symbol.documentation.clone(),
                    },
                );
            }
        }
        let visible = self.visible_uris(uri);
        for symbol in self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(_, file)| file.symbols.iter())
            .filter(|symbol| !symbol.local)
        {
            candidates
                .entry(symbol.name.clone())
                .or_insert_with(|| CompletionCandidate {
                    label: symbol.name.clone(),
                    kind: if symbol.kind == SymbolKind::Function {
                        3
                    } else {
                        6
                    },
                    detail: Some(symbol.detail.clone()),
                    documentation: symbol.documentation.clone(),
                });
        }
        for function in self.external_functions.values() {
            candidates
                .entry(function.name.clone())
                .or_insert_with(|| CompletionCandidate {
                    label: function.name.clone(),
                    kind: 3,
                    detail: function
                        .signatures
                        .first()
                        .map(|signature| signature.label.clone()),
                    documentation: function.summary.clone(),
                });
        }
        for keyword in KEYWORDS {
            candidates
                .entry((*keyword).to_owned())
                .or_insert_with(|| CompletionCandidate {
                    label: (*keyword).to_owned(),
                    kind: 14,
                    detail: None,
                    documentation: None,
                });
        }
        let mut candidates = candidates.into_values().collect::<Vec<_>>();
        if !prefix.is_empty() {
            let normalized_prefix = prefix.to_ascii_lowercase();
            candidates.retain(|candidate| {
                candidate
                    .label
                    .to_ascii_lowercase()
                    .starts_with(&normalized_prefix)
            });
        }
        candidates.sort_by(|left, right| left.label.cmp(&right.label));
        candidates
    }

    pub fn metrics(&self) -> AnalysisMetrics {
        self.metrics.clone()
    }

    fn identifier_at(&self, uri: &str, position: Position) -> Option<(String, usize)> {
        let file = self.files.get(uri)?;
        let offset = lsp_position_to_byte(&file.source, position)?;
        let range = identifier_range(file, offset)?;
        Some((file.source.get(range)?.to_owned(), offset))
    }

    fn visible_uris(&self, origin_uri: &str) -> HashSet<String> {
        let mut visible = HashSet::from([origin_uri.to_owned()]);
        let mut pending = vec![origin_uri.to_owned()];
        while let Some(uri) = pending.pop() {
            let Some(file) = self.files.get(&uri) else {
                continue;
            };
            for dependency in &file.dependencies {
                for candidate_uri in self.files.keys() {
                    if !visible.contains(candidate_uri)
                        && dependency_matches(&uri, dependency, candidate_uri)
                    {
                        visible.insert(candidate_uri.clone());
                        pending.push(candidate_uri.clone());
                    }
                }
            }
        }
        visible
    }

    fn related_uris(&self, origin_uri: &str) -> HashSet<String> {
        let mut related = self.visible_uris(origin_uri);
        for candidate_uri in self.files.keys() {
            if self.visible_uris(candidate_uri).contains(origin_uri) {
                related.insert(candidate_uri.clone());
            }
        }
        related
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct HoverResult {
    pub contents: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SignatureHelp {
    pub signatures: Vec<SignatureInformation>,
    pub active_signature: u32,
    pub active_parameter: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SignatureInformation {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,
    pub parameters: Vec<ParameterInformation>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ParameterInformation {
    pub label: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompletionCandidate {
    pub label: String,
    pub kind: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,
}

const KEYWORDS: &[&str] = &[
    "break",
    "case",
    "catch",
    "class",
    "continue",
    "default",
    "do",
    "else",
    "float",
    "for",
    "foreach",
    "function",
    "if",
    "inherit",
    "int",
    "mapping",
    "mixed",
    "new",
    "object",
    "private",
    "protected",
    "public",
    "ref",
    "return",
    "sizeof",
    "static",
    "string",
    "struct",
    "switch",
    "varargs",
    "void",
    "while",
];

const COMMON_OBJECT_METHODS: &[&str] = &["query", "set", "add", "delete"];

fn collect_dependencies(root: Node<'_>, source: &str) -> Vec<String> {
    let mut dependencies = Vec::new();
    collect_syntax_dependencies(root, source, &mut dependencies);
    for line in source.lines() {
        let trimmed = line.trim_start();
        let Some(arguments) = trimmed.strip_prefix("#include") else {
            continue;
        };
        let arguments = arguments.trim();
        if let Some(value) = arguments
            .strip_prefix('"')
            .and_then(|value| value.split_once('"').map(|(path, _)| path))
            .or_else(|| {
                arguments
                    .strip_prefix('<')
                    .and_then(|value| value.split_once('>').map(|(path, _)| path))
            })
        {
            dependencies.push(value.to_owned());
        }
    }
    dependencies.sort();
    dependencies.dedup();
    dependencies
}

fn collect_syntax_dependencies(node: Node<'_>, source: &str, output: &mut Vec<String>) {
    if matches!(node.kind(), "inherit_declaration" | "include_declaration") {
        let mut cursor = node.walk();
        if let Some(value) = node
            .named_children(&mut cursor)
            .find(|child| child.kind() == "string_literal")
            .and_then(|child| child.utf8_text(source.as_bytes()).ok())
            .and_then(|value| value.strip_prefix('"')?.strip_suffix('"'))
        {
            output.push(value.to_owned());
        }
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_syntax_dependencies(child, source, output);
    }
}

fn dependency_matches(origin_uri: &str, dependency: &str, candidate_uri: &str) -> bool {
    let mut dependency = dependency.replace('\\', "/");
    if !dependency.ends_with(".c") && !dependency.ends_with(".h") {
        dependency.push_str(".c");
    }
    let candidate = candidate_uri.replace('\\', "/");
    if dependency.starts_with('/') {
        return candidate.ends_with(&dependency);
    }
    let origin = origin_uri.replace('\\', "/");
    if let Some((directory, _)) = origin.rsplit_once('/')
        && candidate == format!("{directory}/{dependency}")
    {
        return true;
    }
    candidate.ends_with(&format!("/{dependency}"))
}

fn collect_symbols(root: Node<'_>, source: &str, output: &mut Vec<Symbol>) {
    let mut cursor = root.walk();
    for node in root.named_children(&mut cursor) {
        match node.kind() {
            "function_declaration" => collect_function(node, source, output),
            "variable_declaration" => {
                collect_variable_declaration(node, source, 0..source.len(), output)
            }
            "struct_declaration" | "class_declaration" => {
                if let Some(name) = node.child_by_field_name("name") {
                    output.push(Symbol {
                        name: text(name, source),
                        kind: SymbolKind::Type,
                        selection: name.byte_range(),
                        scope: 0..source.len(),
                        detail: source[node.start_byte()..node.end_byte().min(source.len())]
                            .split('{')
                            .next()
                            .unwrap_or_default()
                            .trim()
                            .to_owned(),
                        documentation: None,
                        local: false,
                        parameters: Vec::new(),
                    });
                }
            }
            _ => {}
        }
    }
}

fn collect_function(node: Node<'_>, source: &str, output: &mut Vec<Symbol>) {
    let Some(name) = node.child_by_field_name("name") else {
        return;
    };
    let body_start = node
        .child_by_field_name("body")
        .map_or(node.end_byte(), |body| body.start_byte());
    let parameter_details = node
        .child_by_field_name("parameters")
        .map(|parameters| {
            let mut cursor = parameters.walk();
            parameters
                .named_children(&mut cursor)
                .map(|parameter| text(parameter, source))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    output.push(Symbol {
        name: text(name, source),
        kind: SymbolKind::Function,
        selection: name.byte_range(),
        scope: 0..source.len(),
        detail: source[node.start_byte()..body_start.min(source.len())]
            .trim()
            .to_owned(),
        documentation: leading_documentation(source, node.start_byte()),
        local: false,
        parameters: parameter_details,
    });

    let scope = node.byte_range();
    if let Some(parameters) = node.child_by_field_name("parameters") {
        let mut cursor = parameters.walk();
        for parameter in parameters.named_children(&mut cursor) {
            if let Some(parameter_name) = parameter.child_by_field_name("name") {
                output.push(Symbol {
                    name: text(parameter_name, source),
                    kind: SymbolKind::Parameter,
                    selection: parameter_name.byte_range(),
                    scope: scope.clone(),
                    detail: text(parameter, source),
                    documentation: None,
                    local: true,
                    parameters: Vec::new(),
                });
            }
        }
    }
    if let Some(body) = node.child_by_field_name("body") {
        collect_local_variables(body, source, scope, output);
    }
}

fn collect_local_variables(
    node: Node<'_>,
    source: &str,
    scope: std::ops::Range<usize>,
    output: &mut Vec<Symbol>,
) {
    if node.kind() == "variable_declaration"
        || node.kind() == "variable_declaration_without_semicolon"
    {
        collect_variable_declaration(node, source, scope.clone(), output);
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_local_variables(child, source, scope.clone(), output);
    }
}

fn collect_variable_declaration(
    node: Node<'_>,
    source: &str,
    scope: std::ops::Range<usize>,
    output: &mut Vec<Symbol>,
) {
    let type_text = node
        .child_by_field_name("type")
        .map(|kind| text(kind, source))
        .unwrap_or_else(|| "mixed".to_owned());
    let mut cursor = node.walk();
    for declarator in node
        .named_children(&mut cursor)
        .filter(|child| child.kind() == "variable_declarator")
    {
        if let Some(name) = declarator.child_by_field_name("name") {
            output.push(Symbol {
                name: text(name, source),
                kind: SymbolKind::Variable,
                selection: name.byte_range(),
                scope: scope.clone(),
                detail: format!("{type_text} {}", text(name, source)),
                documentation: None,
                local: scope.start != 0
                    || node
                        .parent()
                        .is_some_and(|parent| parent.kind() != "source_file"),
                parameters: Vec::new(),
            });
        }
    }
}

fn collect_identifiers(node: Node<'_>, output: &mut Vec<std::ops::Range<usize>>) {
    if node.kind() == "identifier" {
        output.push(node.byte_range());
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_identifiers(child, output);
    }
}

fn collect_calls(node: Node<'_>, source: &str, output: &mut Vec<CallSite>) {
    if node.kind() == "postfix_expression"
        && let Some(value) = node.child_by_field_name("value")
        && value.kind() == "identifier"
    {
        let mut cursor = node.walk();
        if let Some(call) = node
            .named_children(&mut cursor)
            .find(|child| child.kind() == "call_suffix")
        {
            let mut call_cursor = call.walk();
            let argument_count = call
                .named_children(&mut call_cursor)
                .find(|child| child.kind() == "argument_list")
                .map_or(0, |arguments| {
                    let mut argument_cursor = arguments.walk();
                    arguments.named_children(&mut argument_cursor).count()
                });
            output.push(CallSite {
                name: text(value, source),
                range: value.byte_range(),
                argument_count,
            });
        }
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_calls(child, source, output);
    }
}

fn leading_documentation(source: &str, declaration_start: usize) -> Option<String> {
    let prefix = source.get(..declaration_start)?.trim_end();
    if !prefix.ends_with("*/") {
        return None;
    }
    let comment_start = prefix.rfind("/**")?;
    render_doc_comment(&prefix[comment_start..])
}

fn render_doc_comment(comment: &str) -> Option<String> {
    let lines = comment
        .lines()
        .map(|line| {
            line.trim()
                .strip_prefix("/**")
                .unwrap_or(line.trim())
                .strip_suffix("*/")
                .unwrap_or_else(|| line.trim().strip_prefix("/**").unwrap_or(line.trim()))
                .trim_start_matches('*')
                .trim()
        })
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let mut summary = Vec::new();
    let mut parameters = Vec::new();
    let mut returns = Vec::new();
    let mut details = Vec::new();
    let mut in_details = false;
    for line in lines {
        if let Some(value) = line.strip_prefix("@brief") {
            summary.push(value.trim().to_owned());
            in_details = false;
        } else if let Some(value) = line.strip_prefix("@param") {
            let mut parts = value.split_whitespace();
            let kind = parts.next().unwrap_or("mixed");
            let name = parts.next().unwrap_or("参数");
            let description = parts.collect::<Vec<_>>().join(" ");
            parameters.push(format!(
                "- `{name}` (`{kind}`){}",
                if description.is_empty() {
                    String::new()
                } else {
                    format!("：{description}")
                }
            ));
            in_details = false;
        } else if let Some(value) = line.strip_prefix("@return") {
            returns.push(value.trim().to_owned());
            in_details = false;
        } else if let Some(value) = line.strip_prefix("@details") {
            details.push(value.trim().to_owned());
            in_details = true;
        } else if line.starts_with('@') {
            in_details = false;
        } else if in_details {
            details.push(line.to_owned());
        } else {
            summary.push(line.to_owned());
        }
    }
    let mut sections = Vec::new();
    if !summary.is_empty() {
        sections.push(summary.join(" "));
    }
    if !parameters.is_empty() {
        sections.push(format!("**参数**\n\n{}", parameters.join("\n")));
    }
    if !returns.is_empty() {
        sections.push(format!("**返回值**\n\n{}", returns.join(" ")));
    }
    if !details.is_empty() {
        sections.push(format!("**详细说明**\n\n{}", details.join(" ")));
    }
    (!sections.is_empty()).then(|| sections.join("\n\n"))
}

fn accepts_arguments(symbol: &Symbol, argument_count: usize) -> bool {
    let has_varargs_modifier = symbol
        .detail
        .split_once('(')
        .map(|(declaration, _)| declaration.split_whitespace().any(|word| word == "varargs"))
        .unwrap_or(false);
    let required = if has_varargs_modifier {
        0
    } else {
        symbol
            .parameters
            .iter()
            .filter(|parameter| !parameter.contains(':') && !parameter.contains("..."))
            .count()
    };
    let variadic = symbol
        .parameters
        .iter()
        .any(|parameter| parameter.contains("..."));
    argument_count >= required && (variadic || argument_count <= symbol.parameters.len())
}

fn collect_diagnostics(tree: &Tree, source: &str) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    collect_error_nodes(tree.root_node(), source, &mut diagnostics, false);
    collect_type_diagnostics(tree.root_node(), source, None, &mut diagnostics);
    diagnostics
}

fn collect_type_diagnostics(
    node: Node<'_>,
    source: &str,
    return_type: Option<&str>,
    output: &mut Vec<Diagnostic>,
) {
    let declared_return_type = (node.kind() == "function_declaration")
        .then(|| {
            let return_node = node.child_by_field_name("return_type")?;
            let base = return_node.utf8_text(source.as_bytes()).ok()?;
            let name = node.child_by_field_name("name")?;
            let pointers = source
                .get(return_node.end_byte()..name.start_byte())?
                .bytes()
                .filter(|byte| *byte == b'*')
                .count();
            Some(format!("{base}{}", "*".repeat(pointers)))
        })
        .flatten();
    let function_return_type = declared_return_type.as_deref().or(return_type);
    if node.kind() == "variable_declaration"
        && let Some(expected) = node
            .child_by_field_name("type")
            .and_then(|value| value.utf8_text(source.as_bytes()).ok())
    {
        let mut cursor = node.walk();
        for declarator in node
            .named_children(&mut cursor)
            .filter(|child| child.kind() == "variable_declarator")
        {
            if let Some(value) = declarator.child_by_field_name("value") {
                let name = declarator.child_by_field_name("name");
                let pointers = name
                    .and_then(|name| source.get(declarator.start_byte()..name.start_byte()))
                    .map_or(0, |prefix| {
                        prefix.bytes().filter(|byte| *byte == b'*').count()
                    });
                let expected = format!("{}{}", expected.trim(), "*".repeat(pointers));
                report_type_mismatch(&expected, value, source, output, "变量初始化");
            }
        }
    }
    if node.kind() == "return_statement"
        && let Some(expected) = function_return_type
    {
        let mut cursor = node.walk();
        if let Some(value) = node.named_children(&mut cursor).next() {
            report_type_mismatch(expected, value, source, output, "返回值");
        } else if expected.trim() != "void" {
            output.push(Diagnostic {
                range: byte_range_to_lsp(source, node.byte_range()),
                severity: 2,
                code: "lpc.typeMismatch",
                source: "lpc-support",
                message: format!("返回值类型不匹配: 期望 {}，实际 void", expected.trim()),
            });
        }
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_type_diagnostics(child, source, function_return_type, output);
    }
}

fn report_type_mismatch(
    expected: &str,
    value: Node<'_>,
    source: &str,
    output: &mut Vec<Diagnostic>,
    context: &str,
) {
    let Some(actual) = literal_type(value, source) else {
        return;
    };
    if expected.trim() != "void" && actual == "int" && is_zero_integer_literal(value, source) {
        return;
    }
    if types_compatible(expected.trim(), actual) {
        return;
    }
    output.push(Diagnostic {
        range: byte_range_to_lsp(source, value.byte_range()),
        severity: 2,
        code: "lpc.typeMismatch",
        source: "lpc-support",
        message: format!(
            "{context}类型不匹配: 期望 {}，实际 {actual}",
            expected.trim()
        ),
    });
}

fn is_zero_integer_literal(node: Node<'_>, source: &str) -> bool {
    if node.kind() != "number_literal" {
        return false;
    }
    let Ok(value) = node.utf8_text(source.as_bytes()) else {
        return false;
    };
    let normalized = value.replace('_', "");
    if let Some(hex) = normalized
        .strip_prefix("0x")
        .or_else(|| normalized.strip_prefix("0X"))
    {
        return u128::from_str_radix(hex, 16).is_ok_and(|value| value == 0);
    }
    if let Some(binary) = normalized
        .strip_prefix("0b")
        .or_else(|| normalized.strip_prefix("0B"))
    {
        return u128::from_str_radix(binary, 2).is_ok_and(|value| value == 0);
    }
    normalized.parse::<u128>().is_ok_and(|value| value == 0)
}

fn literal_type<'a>(node: Node<'_>, source: &'a str) -> Option<&'a str> {
    match node.kind() {
        "string_literal" | "concatenated_string" | "heredoc_literal" => Some("string"),
        "character_literal" => Some("int"),
        "number_literal" => node
            .utf8_text(source.as_bytes())
            .ok()
            .map(|value| if value.contains('.') { "float" } else { "int" }),
        "array_literal" => Some("mixed*"),
        "mapping_literal" => Some("mapping"),
        _ => None,
    }
}

fn types_compatible(expected: &str, actual: &str) -> bool {
    expected == "mixed"
        || expected == actual
        || (matches!(expected, "int" | "float" | "status")
            && matches!(actual, "int" | "float" | "status"))
        || (expected.ends_with('*') && actual == "mixed*")
}

fn collect_error_nodes(
    node: Node<'_>,
    source: &str,
    output: &mut Vec<Diagnostic>,
    parent_error: bool,
) {
    let is_error = node.is_error() || node.is_missing();
    if is_error && !parent_error {
        let range = if node.start_byte() == node.end_byte() {
            let end = (node.end_byte() + 1).min(source.len());
            node.start_byte()..end
        } else {
            node.byte_range()
        };
        output.push(Diagnostic {
            range: byte_range_to_lsp(source, range),
            severity: 1,
            code: "syntax-error",
            source: "lpc-rust",
            message: if node.is_missing() {
                format!("缺少语法元素 `{}`", node.kind())
            } else {
                "无法解析此处的 LPC 语法".to_owned()
            },
        });
    }
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.has_error() || child.is_error() || child.is_missing() {
            collect_error_nodes(child, source, output, parent_error || is_error);
        }
    }
}

fn collect_folding_ranges(tree: &Tree, source: &str) -> Vec<FoldingRange> {
    let mut ranges = Vec::new();
    collect_fold_nodes(tree.root_node(), source, &mut ranges);
    ranges.sort_by_key(|range| (range.start_line, range.end_line));
    ranges.dedup();
    ranges
}

fn collect_fold_nodes(node: Node<'_>, source: &str, output: &mut Vec<FoldingRange>) {
    let start = node.start_position().row as u32;
    let end = node.end_position().row as u32;
    let kind = match node.kind() {
        "comment" => Some("comment"),
        "block" | "class_declaration" | "struct_declaration" | "switch_statement"
        | "array_literal" | "mapping_literal" => None,
        _ => {
            let mut cursor = node.walk();
            for child in node.children(&mut cursor) {
                collect_fold_nodes(child, source, output);
            }
            return;
        }
    };
    if end > start {
        let end_line = if source_line_is_closing_delimiter(source, end as usize) {
            end.saturating_sub(1).max(start)
        } else {
            end
        };
        if end_line > start {
            output.push(FoldingRange {
                start_line: start,
                end_line,
                kind,
            });
        }
    }
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_fold_nodes(child, source, output);
    }
}

fn source_line_is_closing_delimiter(source: &str, row: usize) -> bool {
    source.lines().nth(row).is_some_and(|line| {
        matches!(
            line.trim_start().chars().next(),
            Some('}') | Some(')') | Some(']')
        )
    })
}

fn identifier_range(file: &FileAnalysis, offset: usize) -> Option<std::ops::Range<usize>> {
    file.identifiers
        .iter()
        .find(|range| range.start <= offset && offset <= range.end)
        .cloned()
}

fn resolved_symbols<'a>(file: &'a FileAnalysis, name: &str, offset: usize) -> Vec<&'a Symbol> {
    let mut symbols: Vec<_> = file
        .symbols
        .iter()
        .filter(|symbol| {
            symbol.name == name
                && symbol.scope.contains(&offset)
                && (!symbol.local || symbol.selection.start <= offset)
        })
        .collect();
    symbols.sort_by_key(|symbol| {
        (
            u8::from(!symbol.local),
            symbol.scope.end - symbol.scope.start,
            usize::MAX - symbol.selection.start,
        )
    });
    symbols
}

fn valid_identifier(value: &str) -> bool {
    let mut characters = value.chars();
    characters
        .next()
        .is_some_and(|character| character == '_' || character.is_ascii_alphabetic())
        && characters.all(|character| character == '_' || character.is_ascii_alphanumeric())
        && !KEYWORDS.contains(&value)
}

fn enclosing_call(source: &str, offset: usize) -> Option<(usize, String)> {
    let bytes = source.as_bytes();
    let mut depth = 0_i32;
    for index in (0..offset.min(bytes.len())).rev() {
        match bytes[index] {
            b')' | b']' | b'}' => depth += 1,
            b'(' if depth > 0 => depth -= 1,
            b'(' => {
                let mut end = index;
                while end > 0 && bytes[end - 1].is_ascii_whitespace() {
                    end -= 1;
                }
                let mut start = end;
                while start > 0
                    && (bytes[start - 1].is_ascii_alphanumeric() || bytes[start - 1] == b'_')
                {
                    start -= 1;
                }
                let name = source.get(start..end)?;
                if valid_identifier(name) {
                    return Some((index, name.to_owned()));
                }
            }
            _ => {}
        }
    }
    None
}

fn active_parameter(arguments: &str) -> u32 {
    let mut depth = 0_i32;
    let mut active = 0_u32;
    for byte in arguments.bytes() {
        match byte {
            b'(' | b'[' | b'{' => depth += 1,
            b')' | b']' | b'}' => depth -= 1,
            b',' if depth == 0 => active += 1,
            _ => {}
        }
    }
    active
}

fn completion_prefix(source: &str, position: Position) -> Option<String> {
    let end = lsp_position_to_byte(source, position)?;
    let bytes = source.as_bytes();
    let mut start = end;
    while start > 0 && (bytes[start - 1].is_ascii_alphanumeric() || bytes[start - 1] == b'_') {
        start -= 1;
    }
    source.get(start..end).map(str::to_owned)
}

fn is_member_access(source: &str, identifier_start: usize) -> bool {
    let prefix = source
        .get(..identifier_start)
        .unwrap_or_default()
        .trim_end();
    prefix.ends_with("->") || prefix.ends_with('.')
}

fn text(node: Node<'_>, source: &str) -> String {
    node.utf8_text(source.as_bytes())
        .unwrap_or_default()
        .to_owned()
}

pub fn byte_range_to_lsp(source: &str, range: std::ops::Range<usize>) -> Range {
    Range {
        start: byte_to_lsp_position(source, range.start),
        end: byte_to_lsp_position(source, range.end),
    }
}

fn byte_to_lsp_position(source: &str, byte: usize) -> Position {
    let byte = byte.min(source.len());
    let prefix = &source[..byte];
    let line = prefix.bytes().filter(|value| *value == b'\n').count();
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    Position {
        line: line as u32,
        character: source[line_start..byte].encode_utf16().count() as u32,
    }
}

fn lsp_position_to_byte(source: &str, position: Position) -> Option<usize> {
    let line_start = if position.line == 0 {
        0
    } else {
        source
            .match_indices('\n')
            .nth(position.line as usize - 1)
            .map(|(offset, _)| offset + 1)?
    };
    let line = &source[line_start
        ..source[line_start..]
            .find('\n')
            .map_or(source.len(), |end| line_start + end)];
    let mut utf16 = 0_u32;
    for (offset, character) in line.char_indices() {
        if utf16 == position.character {
            return Some(line_start + offset);
        }
        utf16 += character.len_utf16() as u32;
        if utf16 > position.character {
            return None;
        }
    }
    (utf16 == position.character).then_some(line_start + line.len())
}

pub fn position_to_byte(source: &str, position: Position) -> Option<usize> {
    lsp_position_to_byte(source, position)
}

#[cfg(test)]
mod tests {
    use tree_sitter::Parser;

    use super::*;

    fn database(source: &str) -> AnalysisDatabase {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.update("file:///demo.c", 1, 1, &tree, source);
        database
    }

    #[test]
    fn resolves_local_variables_without_rebuilding_the_snapshot() {
        let source = "int count;\nint query(int amount) { int local = amount; return local; }\n";
        let mut database = database(source);
        let definitions = database.definition(
            "file:///demo.c",
            Position {
                line: 1,
                character: 52,
            },
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].range.start.character, 28);
        assert_eq!(database.metrics().snapshot_build_count, 1);
        let _ = database.hover(
            "file:///demo.c",
            Position {
                line: 1,
                character: 52,
            },
        );
        assert_eq!(database.metrics().snapshot_build_count, 1);
    }

    #[test]
    fn reports_tree_sitter_errors_and_multiline_folds() {
        let source = "int broken( {\n  if (1) {\n    return 1;\n  }\n}\n";
        let mut database = database(source);
        assert!(!database.diagnostics("file:///demo.c").is_empty());
        assert!(!database.folding_ranges("file:///demo.c").is_empty());
    }

    #[test]
    fn finds_references_and_completion_candidates() {
        let source = "int total;\nint query() { total = total + 1; return total; }\n";
        let mut database = database(source);
        let references = database.references(
            "file:///demo.c",
            Position {
                line: 1,
                character: 16,
            },
            true,
        );
        assert_eq!(references.len(), 4);
        assert!(
            database
                .completion_labels("file:///demo.c")
                .contains(&"query".to_owned())
        );
    }

    #[test]
    fn filters_completion_candidates_by_the_identifier_prefix() {
        let source = concat!(
            "int skill_level;\n",
            "int skill_name;\n",
            "int unrelated;\n",
            "void demo() { ski }\n",
        );
        let mut database = database(source);
        let completions = database.completion_candidates(
            "file:///demo.c",
            Position {
                line: 3,
                character: 17,
            },
        );
        assert_eq!(
            completions
                .iter()
                .map(|candidate| candidate.label.as_str())
                .collect::<Vec<_>>(),
            vec!["skill_level", "skill_name"]
        );
    }

    #[test]
    fn excludes_unrelated_workspace_symbols_from_completion() {
        let source = "void demo() { pro }\n";
        let mut database = database(source);
        let unrelated = "int project_internal_helper() { return 1; }\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(unrelated, None).unwrap();
        database.index_source("file:///unrelated.c", &tree, unrelated);

        let completions = database.completion_candidates(
            "file:///demo.c",
            Position {
                line: 0,
                character: 17,
            },
        );
        assert!(
            completions
                .iter()
                .all(|candidate| candidate.label != "project_internal_helper")
        );
    }

    #[test]
    fn excludes_locals_from_other_functions_from_completion() {
        let source = concat!(
            "void first(string private_value) { int private_local = 1; }\n",
            "void second() { pri }\n",
        );
        let mut database = database(source);
        let completions = database.completion_candidates(
            "file:///demo.c",
            Position {
                line: 1,
                character: 19,
            },
        );
        assert!(completions.iter().all(|candidate| {
            candidate.label != "private_value" && candidate.label != "private_local"
        }));
    }

    #[test]
    fn does_not_resolve_workspace_locals_as_global_symbols() {
        let source = "void demo() { return leaked_name; }\n";
        let mut database = database(source);
        let unrelated = "void first(string leaked_name) { }\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(unrelated, None).unwrap();
        database.index_source("file:///unrelated.c", &tree, unrelated);

        let position = byte_to_lsp_position(source, source.find("leaked_name").unwrap());
        assert!(database.definition("file:///demo.c", position).is_empty());
        assert!(database.hover("file:///demo.c", position).is_none());
    }

    #[test]
    fn keeps_unknown_object_member_completion_conservative() {
        let source = "void demo(object target) { target->quer; }\n";
        let mut database = database(source);
        let completion_position = byte_to_lsp_position(source, source.find("quer").unwrap() + 4);
        let completions = database.completion_candidates("file:///demo.c", completion_position);
        assert_eq!(
            completions
                .iter()
                .map(|candidate| candidate.label.as_str())
                .collect::<Vec<_>>(),
            vec!["query"]
        );

        let member_position = byte_to_lsp_position(source, source.find("quer").unwrap());
        assert!(
            database
                .definition("file:///demo.c", member_position)
                .is_empty()
        );
        assert!(database.hover("file:///demo.c", member_position).is_none());
    }

    #[test]
    fn rename_keeps_local_symbols_inside_their_function() {
        let source = concat!(
            "int first() { int value = 1; return value; }\n",
            "int second() { int value = 2; return value; }\n",
        );
        let mut database = database(source);
        let edits = database.rename_edits(
            "file:///demo.c",
            Position {
                line: 0,
                character: 40,
            },
            "result",
        );
        assert_eq!(edits["file:///demo.c"].len(), 2);
        assert!(
            edits["file:///demo.c"]
                .iter()
                .all(|edit| edit.range.start.line == 0)
        );
    }

    #[test]
    fn computes_signature_help_without_parsing_again() {
        let source =
            "int sum(int left, int right) { return left + right; }\nint value = sum(1, 2);\n";
        let mut database = database(source);
        let help = database
            .signature_help(
                "file:///demo.c",
                Position {
                    line: 1,
                    character: 19,
                },
            )
            .unwrap();
        assert_eq!(help.signatures[0].parameters.len(), 2);
        assert_eq!(help.active_parameter, 1);
        assert_eq!(database.metrics().snapshot_build_count, 1);
    }

    #[test]
    fn reports_unused_locals_and_known_argument_count_mismatches() {
        let source = concat!(
            "int sum(int left, int right) { int unused = 1; return left + right; }\n",
            "int demo() { return sum(1); }\n",
        );
        let mut database = database(source);
        let diagnostics = database.diagnostics("file:///demo.c");
        assert!(
            diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "unusedVar")
        );
        assert!(
            diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "lpc.argumentCountMismatch")
        );
    }

    #[test]
    fn accepts_omitted_arguments_for_function_level_varargs() {
        let source = concat!(
            "varargs mixed query(string prop, int raw);\n",
            "void demo() { query(\"name\"); }\n",
        );
        let mut database = database(source);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.argumentCountMismatch")
        );
    }

    #[test]
    fn does_not_introduce_unused_parameter_diagnostics() {
        let source = concat!(
            "string skill_level(string type, int level);\n",
            "private int callback(string intentionally_unused) { return 1; }\n",
        );
        let mut database = database(source);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "unusedParam")
        );
    }

    #[test]
    fn reports_only_statically_proven_literal_type_mismatches() {
        let source = concat!(
            "int count = \"wrong\";\n",
            "string label = unknown_value;\n",
            "int query() { return \"wrong\"; }\n",
        );
        let mut database = database(source);
        let diagnostics = database.diagnostics("file:///demo.c");
        assert_eq!(
            diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "lpc.typeMismatch")
                .count(),
            2
        );
        database.set_type_checking_enabled(false);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.typeMismatch")
        );
    }

    #[test]
    fn accepts_lpc_zero_as_a_null_sentinel_for_declared_types() {
        let source = concat!(
            "string query_name() { return 0; }\n",
            "mapping query_data() { return 0x0; }\n",
            "object query_target() { return 0b0; }\n",
            "void invalid_void_return() { return 0; }\n",
        );
        let mut database = database(source);
        let mismatches = database
            .diagnostics("file:///demo.c")
            .into_iter()
            .filter(|diagnostic| diagnostic.code == "lpc.typeMismatch")
            .collect::<Vec<_>>();
        assert_eq!(mismatches.len(), 1);
        assert!(mismatches[0].message.contains("期望 void，实际 int"));
    }

    #[test]
    fn function_hover_includes_signature_and_structured_javadoc() {
        let source = concat!(
            "/**\n",
            " * @brief 构造战斗武学动作\n",
            " * @param object popup 协议模型\n",
            " * @param string type 武学分类\n",
            " * @return mapping * 动作列表\n",
            " * @details 保留完整的函数说明。\n",
            " */\n",
            "private mapping *battle_choices(object popup, string type) { return ({}); }\n",
            "void demo() { battle_choices(0, \"unarmed\"); }\n",
        );
        let mut database = database(source);
        let hover = database
            .hover(
                "file:///demo.c",
                Position {
                    line: 8,
                    character: 16,
                },
            )
            .expect("function hover should resolve");
        assert!(hover.contents.contains("mapping *battle_choices"));
        assert!(hover.contents.contains("构造战斗武学动作"));
        assert!(hover.contents.contains("`popup` (`object`)"));
        assert!(hover.contents.contains("**返回值**"));
        assert!(hover.contents.contains("保留完整的函数说明"));

        let signature = database
            .signature_help(
                "file:///demo.c",
                Position {
                    line: 8,
                    character: 35,
                },
            )
            .expect("signature help should resolve");
        assert!(
            signature.signatures[0]
                .documentation
                .as_deref()
                .is_some_and(|documentation| documentation.contains("构造战斗武学动作"))
        );

        let completion = database
            .completion_candidates(
                "file:///demo.c",
                Position {
                    line: 8,
                    character: 14,
                },
            )
            .into_iter()
            .find(|candidate| candidate.label == "battle_choices")
            .expect("function completion should resolve");
        assert!(
            completion
                .documentation
                .as_deref()
                .is_some_and(|documentation| documentation.contains("构造战斗武学动作"))
        );
    }

    #[test]
    fn does_not_guess_arity_from_unrelated_workspace_functions() {
        let mut database = database("int demo() { return item(1); }\n");
        let source = "int item(int left, int right) { return left + right; }\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();
        database.index_source("file:///unrelated.c", &tree, source);

        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.argumentCountMismatch")
        );
    }

    #[test]
    fn prefers_inherit_graph_symbols_over_unrelated_workspace_matches() {
        let child_source = "inherit \"/std/base\"; int demo() { return inherited(); }\n";
        let mut database = database(child_source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, source) in [
            ("file:///mud/std/base.c", "int inherited() { return 1; }\n"),
            (
                "file:///mud/other.c",
                "int inherited(int value) { return value; }\n",
            ),
        ] {
            let tree = parser.parse(source, None).unwrap();
            database.index_source(uri, &tree, source);
        }

        let call = child_source.rfind("inherited").unwrap();
        let definitions =
            database.definition("file:///demo.c", byte_to_lsp_position(child_source, call));
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");
        let completion = database.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(child_source, child_source.len() - 1),
        );
        assert!(
            completion
                .iter()
                .any(|candidate| candidate.label == "inherited")
        );
    }

    #[test]
    fn exposes_external_efun_documentation_and_arity() {
        let source = "void demo() { write(); }\n";
        let mut database = database(source);
        database.set_external_functions(vec![ExternalFunction {
            name: "write".to_owned(),
            summary: Some("向当前玩家输出信息。".to_owned()),
            signatures: vec![ExternalSignature {
                label: "void write(mixed str)".to_owned(),
                parameters: vec!["mixed str".to_owned()],
                minimum_arguments: 1,
                maximum_arguments: Some(1),
            }],
        }]);

        assert!(
            database
                .completion_labels("file:///demo.c")
                .contains(&"write".to_owned())
        );
        let completion = database.completion_candidates(
            "file:///demo.c",
            Position {
                line: 0,
                character: 20,
            },
        );
        let write_completion = completion
            .iter()
            .find(|candidate| candidate.label == "write")
            .unwrap();
        assert_eq!(write_completion.kind, 3);
        assert!(
            write_completion
                .documentation
                .as_deref()
                .is_some_and(|documentation| documentation.contains("当前玩家"))
        );
        let hover = database
            .hover(
                "file:///demo.c",
                Position {
                    line: 0,
                    character: 15,
                },
            )
            .unwrap();
        assert!(hover.contents.contains("void write(mixed str)"));
        assert!(hover.contents.contains("向当前玩家输出信息"));
        let help = database
            .signature_help(
                "file:///demo.c",
                Position {
                    line: 0,
                    character: 20,
                },
            )
            .unwrap();
        assert_eq!(help.signatures[0].parameters[0].label, "mixed str");
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .any(|diagnostic| diagnostic.code == "lpc.argumentCountMismatch")
        );
    }
}
