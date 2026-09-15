use std::{
    cell::{Ref, RefCell},
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
    return_objects: Vec<String>,
    return_expressions: Vec<ExpressionFact>,
    has_body: bool,
    local: bool,
    parameters: Vec<String>,
}

#[derive(Debug, Clone)]
struct ExpressionFact {
    range: std::ops::Range<usize>,
}

#[derive(Debug, Clone)]
struct AssignmentFact {
    name: std::ops::Range<usize>,
    value: std::ops::Range<usize>,
}

#[derive(Debug, Clone)]
struct TypeDefinition {
    name: String,
    members: Vec<TypeMember>,
}

#[derive(Debug, Clone)]
struct TypeMember {
    name: String,
    selection: std::ops::Range<usize>,
    detail: String,
    documentation: Option<String>,
}

#[derive(Debug, Clone)]
struct FileAnalysis {
    version: i32,
    revision: u64,
    source: String,
    symbols: Vec<Symbol>,
    type_definitions: Vec<TypeDefinition>,
    identifiers: Vec<std::ops::Range<usize>>,
    diagnostics: Vec<Diagnostic>,
    folding_ranges: Vec<FoldingRange>,
    calls: Vec<CallSite>,
    assignments: Vec<AssignmentFact>,
    dependencies: Vec<String>,
    inherits: Vec<String>,
}

#[derive(Debug, Clone)]
struct CallSite {
    name: String,
    range: std::ops::Range<usize>,
    argument_count: usize,
}

#[derive(Debug, Default)]
struct DependencyGraph {
    forward: HashMap<String, HashSet<String>>,
    inherit_forward: HashMap<String, HashSet<String>>,
    reverse: HashMap<String, HashSet<String>>,
    path_targets: HashMap<String, HashSet<String>>,
    string_macros: HashMap<String, String>,
}

#[derive(Debug, Default)]
struct ReferenceResolutionCache {
    workspace_definitions: Vec<Location>,
    visible: HashMap<String, Vec<Location>>,
    scoped: HashMap<(String, String), Vec<Location>>,
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
    global_includes: Vec<String>,
    include_directories: Vec<String>,
    instance_resolution_functions: HashMap<String, Vec<String>>,
    dependency_graph: RefCell<Option<DependencyGraph>>,
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

    pub fn set_workspace_resolution(
        &mut self,
        global_includes: Vec<String>,
        include_directories: Vec<String>,
        instance_resolution_functions: HashMap<String, Vec<String>>,
    ) {
        self.global_includes = global_includes;
        self.include_directories = include_directories;
        self.instance_resolution_functions = instance_resolution_functions;
        self.invalidate_dependency_graph();
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
        let type_definitions = collect_type_definitions(tree.root_node(), source);
        let mut identifiers = Vec::new();
        collect_identifiers(tree.root_node(), &mut identifiers);
        let diagnostics = collect_diagnostics(tree, source);
        let folding_ranges = collect_folding_ranges(tree, source);
        let mut calls = Vec::new();
        collect_calls(tree.root_node(), source, &mut calls);
        let mut assignments = Vec::new();
        collect_assignments(tree.root_node(), source, &mut assignments);
        let dependencies = collect_dependencies(tree.root_node(), source);
        let inherits = collect_inherits(tree.root_node(), source);
        self.files.insert(
            uri.to_owned(),
            FileAnalysis {
                version,
                revision,
                source: source.to_owned(),
                symbols,
                type_definitions,
                identifiers,
                diagnostics,
                folding_ranges,
                calls,
                assignments,
                dependencies,
                inherits,
            },
        );
        self.invalidate_dependency_graph();
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
        self.invalidate_dependency_graph();
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
        self.invalidate_dependency_graph();
    }

    pub fn clear_indexed(&mut self) {
        self.files.retain(|_, file| file.version >= 0);
        self.invalidate_dependency_graph();
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
            let external_signatures = if signatures.is_empty() {
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
        let Some(origin) = self.files.get(uri) else {
            return Vec::new();
        };
        let Some(offset) = lsp_position_to_byte(&origin.source, position) else {
            return Vec::new();
        };
        if let Some(path) = directive_path_on_line(&origin.source, offset) {
            let resolved_path = self.resolve_path_token(&path).unwrap_or(path);
            return self
                .files
                .iter()
                .filter(|(candidate_uri, _)| {
                    self.dependency_matches(uri, &resolved_path, candidate_uri)
                })
                .map(|(candidate_uri, _)| Location {
                    uri: candidate_uri.clone(),
                    range: Range {
                        start: Position {
                            line: 0,
                            character: 0,
                        },
                        end: Position {
                            line: 0,
                            character: 0,
                        },
                    },
                })
                .collect();
        }
        let Some(range) = identifier_range(origin, offset) else {
            return Vec::new();
        };
        let Some(name) = origin.source.get(range.clone()).map(str::to_owned) else {
            return Vec::new();
        };
        if let Some(qualifier) = scope_access_qualifier(&origin.source, range.start) {
            if qualifier == "efun" {
                return Vec::new();
            }
            return self.scoped_symbol_locations(uri, &qualifier, &name);
        }
        if is_member_access(&origin.source, range.start) {
            if let Some(location) = self.typed_member_definition(uri, range.start, &name) {
                return vec![location];
            }
            return self.object_member_definitions(uri, range.start, &name);
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
        let identifier = identifier_range(file, offset)?;
        if let Some(qualifier) = scope_access_qualifier(&file.source, identifier.start) {
            if qualifier == "efun" {
                let external = self.external_functions.get(&name)?;
                let signatures = external
                    .signatures
                    .iter()
                    .map(|signature| signature.label.as_str())
                    .collect::<Vec<_>>()
                    .join("\n");
                let summary = external.summary.as_deref().unwrap_or_default();
                return Some(HoverResult {
                    contents: format!("```lpc\n{signatures}\n```\n\n{summary}"),
                    range: byte_range_to_lsp(&file.source, identifier),
                });
            }
            let locations = self.scoped_symbol_locations(uri, &qualifier, &name);
            if locations.len() != 1 {
                return None;
            }
            let target = self.files.get(&locations[0].uri)?;
            let symbol = target.symbols.iter().find(|symbol| {
                symbol.name == name
                    && byte_range_to_lsp(&target.source, symbol.selection.clone())
                        == locations[0].range
            })?;
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
        if is_member_access(&file.source, identifier.start) {
            let contents = self
                .typed_member_hover(uri, identifier.start, &name)
                .or_else(|| self.object_member_hover(uri, identifier.start, &name))?;
            return Some(HoverResult {
                contents,
                range: byte_range_to_lsp(&file.source, identifier),
            });
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
        let member_reference = identifier_range(origin, offset)
            .is_some_and(|range| is_member_access(&origin.source, range.start));
        if let Some(local) = resolved_symbols(origin, &name, offset)
            .into_iter()
            .find(|symbol| symbol.local)
        {
            return origin
                .identifiers
                .iter()
                .filter(|range| {
                    origin.source.get((*range).clone()) == Some(name.as_str())
                        && local.scope.contains(&range.start)
                        && (include_declaration
                            || range.start != local.selection.start
                            || range.end != local.selection.end)
                        && resolved_symbols(origin, &name, range.start)
                            .first()
                            .is_some_and(|symbol| symbol.selection == local.selection)
                })
                .map(|range| Location {
                    uri: uri.to_owned(),
                    range: byte_range_to_lsp(&origin.source, range.clone()),
                })
                .collect();
        }

        let configured_receiver = member_reference
            .then(|| {
                let identifier = identifier_range(origin, offset)?;
                let (_, receiver) = member_access_context(&origin.source, identifier.start)?;
                direct_call_name(&receiver).map(str::to_owned)
            })
            .flatten()
            .filter(|function| self.instance_resolution_functions.contains_key(function));
        let definitions = self.definition(uri, position);
        if definitions.len() != 1 {
            return Vec::new();
        }
        let target = &definitions[0];
        let mut references = Vec::new();
        let configured_functions =
            self.configured_functions_reaching_target(&target.uri, configured_receiver.as_deref());
        let configured_consumers =
            self.configured_instance_consumer_uris(&name, &configured_functions);
        let mut resolution_cache = ReferenceResolutionCache {
            workspace_definitions: self.workspace_symbol_locations(&name),
            ..ReferenceResolutionCache::default()
        };
        let mut candidate_uris = if member_reference {
            if configured_consumers.is_empty() {
                self.files
                    .iter()
                    .filter(|(_, file)| file.source.contains(&name))
                    .map(|(uri, _)| uri.clone())
                    .collect()
            } else {
                configured_consumers.clone()
            }
        } else {
            self.related_uris(&target.uri)
        };
        candidate_uris.insert(target.uri.clone());
        candidate_uris.insert(uri.to_owned());
        candidate_uris.extend(configured_consumers);
        for candidate_uri in candidate_uris {
            let Some(file) = self.files.get(&candidate_uri) else {
                continue;
            };
            if !file.source.contains(&name) {
                continue;
            }
            for range in &file.identifiers {
                if file.source.get(range.clone()) != Some(name.as_str()) {
                    continue;
                }
                let location = Location {
                    uri: candidate_uri.clone(),
                    range: byte_range_to_lsp(&file.source, range.clone()),
                };
                if member_reference
                    && location != *target
                    && !is_member_access(&file.source, range.start)
                {
                    continue;
                }
                let resolves = self.occurrence_resolves_to(
                    &candidate_uri,
                    range,
                    &name,
                    target,
                    &configured_functions,
                    &mut resolution_cache,
                );
                if (!include_declaration && location == *target) || !resolves {
                    continue;
                }
                references.push(location);
            }
        }
        references
    }

    pub fn prepare_rename(&mut self, uri: &str, position: Position) -> Option<Range> {
        self.metrics.query_count += 1;
        let file = self.files.get(uri)?;
        let offset = lsp_position_to_byte(&file.source, position)?;
        let range = identifier_range(file, offset)?;
        let name = file.source.get(range.clone())?;
        let locally_resolved = !resolved_symbols(file, name, offset).is_empty();
        let is_keyword = KEYWORDS.contains(&name);
        let rename_range = byte_range_to_lsp(&file.source, range);
        let uniquely_resolved = locally_resolved || self.definition(uri, position).len() == 1;
        (!is_keyword && uniquely_resolved).then_some(rename_range)
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
        let Some((_name, _offset)) = self.identifier_at(uri, position) else {
            return HashMap::new();
        };
        if self.prepare_rename(uri, position).is_none() {
            return HashMap::new();
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
        let name_start = open.saturating_sub(name.len());
        if let Some(qualifier) = scope_access_qualifier(&file.source, name_start) {
            if qualifier == "efun" {
                let external = self.external_functions.get(&name)?;
                return Some(signature_help_from_external(
                    external,
                    &file.source,
                    open,
                    offset,
                ));
            }
            let locations = self.scoped_symbol_locations(uri, &qualifier, &name);
            if locations.len() != 1 {
                return None;
            }
            let target = self.files.get(&locations[0].uri)?;
            let symbol = target.symbols.iter().find(|symbol| {
                symbol.name == name
                    && byte_range_to_lsp(&target.source, symbol.selection.clone())
                        == locations[0].range
            })?;
            return Some(SignatureHelp {
                signatures: vec![signature_information_from_symbol(symbol)],
                active_signature: 0,
                active_parameter: active_parameter(&file.source[open + 1..offset]),
            });
        }
        if is_member_access(&file.source, name_start) {
            let targets = self.object_target_uris(uri, name_start)?;
            let signatures = self
                .files
                .iter()
                .filter(|(candidate_uri, _)| targets.contains(candidate_uri.as_str()))
                .flat_map(|(_, target)| target.symbols.iter())
                .filter(|symbol| {
                    !symbol.local && symbol.kind == SymbolKind::Function && symbol.name == name
                })
                .map(|symbol| SignatureInformation {
                    label: symbol.detail.clone(),
                    documentation: symbol.documentation.clone(),
                    parameters: symbol
                        .parameters
                        .iter()
                        .map(|label| ParameterInformation {
                            label: label.clone(),
                        })
                        .collect(),
                })
                .collect::<Vec<_>>();
            if signatures.is_empty() {
                return None;
            }
            return Some(SignatureHelp {
                signatures,
                active_signature: 0,
                active_parameter: active_parameter(&file.source[open + 1..offset]),
            });
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
        let completion_offset = self
            .files
            .get(uri)
            .and_then(|file| lsp_position_to_byte(&file.source, position));
        let directive_context = self.files.get(uri).and_then(|file| {
            completion_offset.and_then(|offset| directive_completion_context(&file.source, offset))
        });
        if let Some(context) = directive_context {
            return self.directive_completion_candidates(context, &prefix);
        }
        let scoped_qualifier = self.files.get(uri).and_then(|file| {
            let end = completion_offset.unwrap_or(file.source.len());
            scope_access_qualifier(&file.source, end.saturating_sub(prefix.len()))
        });
        if let Some(qualifier) = scoped_qualifier {
            let normalized_prefix = prefix.to_ascii_lowercase();
            if qualifier == "efun" {
                let mut candidates = self
                    .external_functions
                    .values()
                    .filter(|function| {
                        normalized_prefix.is_empty()
                            || function
                                .name
                                .to_ascii_lowercase()
                                .starts_with(&normalized_prefix)
                    })
                    .map(completion_from_external_function)
                    .collect::<Vec<_>>();
                candidates.sort_by(|left, right| left.label.cmp(&right.label));
                return candidates;
            }
            let inherited = self.scoped_target_uris(uri, &qualifier);
            let mut candidates = self
                .files
                .iter()
                .filter(|(candidate_uri, _)| inherited.contains(candidate_uri.as_str()))
                .flat_map(|(_, file)| file.symbols.iter())
                .filter(|symbol| {
                    !symbol.local
                        && symbol.kind == SymbolKind::Function
                        && (normalized_prefix.is_empty()
                            || symbol
                                .name
                                .to_ascii_lowercase()
                                .starts_with(&normalized_prefix))
                })
                .map(completion_from_symbol)
                .collect::<Vec<_>>();
            candidates.sort_by(|left, right| left.label.cmp(&right.label));
            candidates.dedup_by(|left, right| left.label == right.label);
            return candidates;
        }
        let member_access = self.files.get(uri).is_some_and(|file| {
            let end = completion_offset.unwrap_or(file.source.len());
            is_member_access(&file.source, end.saturating_sub(prefix.len()))
        });
        if member_access {
            let member_start = completion_offset
                .unwrap_or_default()
                .saturating_sub(prefix.len());
            if let Some(candidates) = self.typed_member_candidates(uri, member_start, &prefix) {
                return candidates;
            }
            if let Some(candidates) = self.object_member_candidates(uri, member_start, &prefix) {
                return candidates;
            }
            if self.files.get(uri).and_then(|file| {
                member_access_context(&file.source, member_start).map(|(operator, _)| operator)
            }) == Some(MemberOperator::Dot)
            {
                return Vec::new();
            }
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
                    insert_text: Some(common_object_method_snippet(name)),
                    insert_text_format: Some(2),
                })
                .collect();
        }
        if let Some(file) = self.files.get(uri) {
            let offset = lsp_position_to_byte(&file.source, position).unwrap_or(file.source.len());
            for symbol in file.symbols.iter().filter(|symbol| {
                !symbol.local
                    || (symbol.scope.contains(&offset) && symbol.selection.start <= offset)
            }) {
                candidates.insert(symbol.name.clone(), completion_from_symbol(symbol));
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
                .or_insert_with(|| completion_from_symbol(symbol));
        }
        for function in self.external_functions.values() {
            candidates
                .entry(function.name.clone())
                .or_insert_with(|| completion_from_external_function(function));
        }
        for keyword in KEYWORDS {
            candidates
                .entry((*keyword).to_owned())
                .or_insert_with(|| CompletionCandidate {
                    label: (*keyword).to_owned(),
                    kind: 14,
                    detail: None,
                    documentation: None,
                    insert_text: None,
                    insert_text_format: None,
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

    fn invalidate_dependency_graph(&self) {
        *self.dependency_graph.borrow_mut() = None;
    }

    fn dependency_graph(&self) -> Ref<'_, DependencyGraph> {
        if self.dependency_graph.borrow().is_none() {
            let mut graph = DependencyGraph::default();
            let mut path_index = HashMap::<String, HashSet<String>>::new();
            for candidate_uri in self.files.keys() {
                let normalized = candidate_uri.replace('\\', "/");
                path_index
                    .entry(normalized.clone())
                    .or_default()
                    .insert(candidate_uri.clone());
                for (index, _) in normalized.match_indices('/') {
                    path_index
                        .entry(normalized[index..].to_owned())
                        .or_default()
                        .insert(candidate_uri.clone());
                }
            }
            let macro_values = workspace_unique_string_macros(self.files.values());
            for (origin_uri, file) in &self.files {
                for dependency in file.dependencies.iter().chain(&self.global_includes) {
                    let resolved_dependency = if dependency.starts_with('/')
                        || dependency.contains('/')
                        || dependency.starts_with('.')
                    {
                        dependency.clone()
                    } else {
                        macro_values
                            .get(dependency)
                            .cloned()
                            .unwrap_or_else(|| dependency.clone())
                    };
                    let is_inherit = file.inherits.iter().any(|inherit| inherit == dependency);
                    for key in self.dependency_lookup_keys(origin_uri, &resolved_dependency) {
                        for candidate_uri in path_index.get(&key).into_iter().flatten() {
                            if origin_uri == candidate_uri {
                                continue;
                            }
                            graph
                                .forward
                                .entry(origin_uri.clone())
                                .or_default()
                                .insert(candidate_uri.clone());
                            graph
                                .reverse
                                .entry(candidate_uri.clone())
                                .or_default()
                                .insert(origin_uri.clone());
                            if is_inherit {
                                graph
                                    .inherit_forward
                                    .entry(origin_uri.clone())
                                    .or_default()
                                    .insert(candidate_uri.clone());
                            }
                        }
                    }
                }
            }
            graph.path_targets = path_index;
            graph.string_macros = macro_values;
            *self.dependency_graph.borrow_mut() = Some(graph);
        }
        Ref::map(self.dependency_graph.borrow(), |graph| {
            graph.as_ref().expect("dependency graph was initialized")
        })
    }

    fn dependency_lookup_keys(&self, origin_uri: &str, dependency: &str) -> Vec<String> {
        let mut dependency = dependency.replace('\\', "/");
        if !dependency.ends_with(".c") && !dependency.ends_with(".h") {
            dependency.push_str(".c");
        }
        if dependency.starts_with('/') {
            return vec![dependency];
        }
        if !dependency.starts_with('.')
            && !dependency.contains('/')
            && !self.include_directories.is_empty()
        {
            return self
                .include_directories
                .iter()
                .map(|directory| format!("/{}/{}", directory.trim_matches(['/', '\\']), dependency))
                .collect();
        }
        let normalized_origin = origin_uri.replace('\\', "/");
        let mut keys = vec![format!("/{dependency}")];
        if let Some((directory, _)) = normalized_origin.rsplit_once('/') {
            keys.push(format!("{directory}/{dependency}"));
        }
        keys
    }

    fn visible_uris(&self, origin_uri: &str) -> HashSet<String> {
        let graph = self.dependency_graph();
        let mut visible = HashSet::from([origin_uri.to_owned()]);
        let mut pending = vec![origin_uri.to_owned()];
        while let Some(uri) = pending.pop() {
            if let Some(dependencies) = graph.forward.get(&uri) {
                for dependency in dependencies {
                    if visible.insert(dependency.clone()) {
                        pending.push(dependency.clone());
                    }
                }
            }
        }
        visible
    }

    fn related_uris(&self, origin_uri: &str) -> HashSet<String> {
        let graph = self.dependency_graph();
        let mut related = HashSet::from([origin_uri.to_owned()]);
        let mut visible_pending = vec![origin_uri.to_owned()];
        while let Some(uri) = visible_pending.pop() {
            if let Some(dependencies) = graph.forward.get(&uri) {
                for dependency in dependencies {
                    if related.insert(dependency.clone()) {
                        visible_pending.push(dependency.clone());
                    }
                }
            }
        }
        let mut pending = vec![origin_uri.to_owned()];
        while let Some(target_uri) = pending.pop() {
            if let Some(consumers) = graph.reverse.get(&target_uri) {
                for consumer in consumers {
                    if related.insert(consumer.clone()) {
                        pending.push(consumer.clone());
                    }
                }
            }
        }
        related
    }

    fn configured_functions_reaching_target(
        &self,
        target_uri: &str,
        receiver_function: Option<&str>,
    ) -> HashSet<String> {
        let selected_paths = receiver_function
            .and_then(|function| self.instance_resolution_functions.get(function))
            .map(|paths| paths.iter().collect::<HashSet<_>>());
        if let Some(selected_paths) = &selected_paths {
            return self
                .instance_resolution_functions
                .iter()
                .filter(|(_, paths)| paths.iter().any(|path| selected_paths.contains(path)))
                .map(|(name, _)| name.clone())
                .collect();
        }
        let mut path_reaches_target = HashMap::<String, bool>::new();
        for path in self
            .instance_resolution_functions
            .values()
            .flat_map(|paths| paths.iter())
        {
            if selected_paths
                .as_ref()
                .is_some_and(|selected| !selected.contains(path))
            {
                continue;
            }
            if path_reaches_target.contains_key(path) {
                continue;
            }
            let reaches_target =
                self.path_target_uris(target_uri, path)
                    .into_iter()
                    .any(|owner_uri| {
                        owner_uri == target_uri
                            || self.visible_uris(&owner_uri).contains(target_uri)
                    });
            path_reaches_target.insert(path.clone(), reaches_target);
        }
        self.instance_resolution_functions
            .iter()
            .filter(|(_, paths)| {
                paths
                    .iter()
                    .any(|path| path_reaches_target.get(path) == Some(&true))
            })
            .map(|(name, _)| name.clone())
            .collect()
    }

    fn configured_instance_consumer_uris(
        &self,
        member_name: &str,
        functions: &HashSet<String>,
    ) -> HashSet<String> {
        if functions.is_empty() {
            return HashSet::new();
        }
        let call_patterns = functions
            .iter()
            .map(|function| format!("{function}("))
            .collect::<Vec<_>>();
        self.files
            .iter()
            .filter(|(_, file)| {
                file.source.contains(member_name)
                    && call_patterns
                        .iter()
                        .any(|function| file.source.contains(function))
            })
            .map(|(uri, _)| uri.clone())
            .collect()
    }

    fn occurrence_resolves_to(
        &self,
        uri: &str,
        identifier: &std::ops::Range<usize>,
        name: &str,
        target: &Location,
        configured_functions: &HashSet<String>,
        resolution_cache: &mut ReferenceResolutionCache,
    ) -> bool {
        let Some(file) = self.files.get(uri) else {
            return false;
        };
        let location = Location {
            uri: uri.to_owned(),
            range: byte_range_to_lsp(&file.source, identifier.clone()),
        };
        if location == *target {
            return true;
        }
        if let Some(qualifier) = scope_access_qualifier(&file.source, identifier.start) {
            if qualifier == "efun" {
                return false;
            }
            let locations = resolution_cache
                .scoped
                .entry((uri.to_owned(), qualifier.clone()))
                .or_insert_with(|| self.scoped_symbol_locations(uri, &qualifier, name));
            return locations.len() == 1 && locations[0] == *target;
        }
        if is_member_access(&file.source, identifier.start) {
            let Some((operator, receiver)) = member_access_context(&file.source, identifier.start)
            else {
                return false;
            };
            if operator == MemberOperator::Dot {
                return self
                    .typed_member_definition(uri, identifier.start, name)
                    .is_some_and(|location| location == *target);
            }
            if !configured_functions.is_empty()
                && receiver_originates_from_functions(
                    file,
                    &receiver,
                    identifier.start,
                    configured_functions,
                    8,
                )
            {
                return true;
            }
            let Some(targets) = self.object_target_uris(uri, identifier.start) else {
                return false;
            };
            let locations = resolution_cache
                .workspace_definitions
                .iter()
                .filter(|location| targets.contains(&location.uri))
                .collect::<Vec<_>>();
            return locations.len() == 1 && *locations[0] == *target;
        }
        if let Some(symbol) = resolved_symbols(file, name, identifier.start).first() {
            if symbol.local {
                return false;
            }
            return Location {
                uri: uri.to_owned(),
                range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
            } == *target;
        }
        if !resolution_cache.visible.contains_key(uri) {
            let visible = self.visible_uris(uri);
            let locations = resolution_cache
                .workspace_definitions
                .iter()
                .filter(|location| visible.contains(&location.uri))
                .cloned()
                .collect();
            resolution_cache.visible.insert(uri.to_owned(), locations);
        }
        let locations = resolution_cache
            .visible
            .get(uri)
            .expect("visible reference resolution was cached");
        locations.len() == 1 && locations[0] == *target
    }

    fn workspace_symbol_locations(&self, name: &str) -> Vec<Location> {
        self.files
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
            .collect()
    }

    fn inherited_uris(&self, origin_uri: &str) -> HashSet<String> {
        let graph = self.dependency_graph();
        let mut inherited = HashSet::new();
        let mut pending = vec![origin_uri.to_owned()];
        while let Some(uri) = pending.pop() {
            if let Some(dependencies) = graph.inherit_forward.get(&uri) {
                for dependency in dependencies {
                    if dependency != origin_uri && inherited.insert(dependency.clone()) {
                        pending.push(dependency.clone());
                    }
                }
            }
        }
        inherited
    }

    fn scoped_target_uris(&self, origin_uri: &str, qualifier: &str) -> HashSet<String> {
        if qualifier.is_empty() {
            return self.inherited_uris(origin_uri);
        }
        let Some(file) = self.files.get(origin_uri) else {
            return HashSet::new();
        };
        let matching_dependencies = file
            .inherits
            .iter()
            .filter_map(|dependency| {
                let resolved = self
                    .resolve_path_token(dependency)
                    .unwrap_or_else(|| dependency.clone());
                (path_basename(&resolved) == qualifier).then_some(resolved)
            })
            .collect::<Vec<_>>();
        if matching_dependencies.len() != 1 {
            return HashSet::new();
        }
        let direct = self.path_target_uris(origin_uri, &matching_dependencies[0]);
        if direct.len() != 1 {
            return HashSet::new();
        }
        let target = direct.into_iter().next().expect("one direct scope target");
        let mut targets = self.inherited_uris(&target);
        targets.insert(target);
        targets
    }

    fn scoped_symbol_locations(
        &self,
        origin_uri: &str,
        qualifier: &str,
        name: &str,
    ) -> Vec<Location> {
        let targets = self.scoped_target_uris(origin_uri, qualifier);
        let mut direct = Vec::new();
        let mut inherited = Vec::new();
        for (candidate_uri, file) in &self.files {
            if !targets.contains(candidate_uri) {
                continue;
            }
            for symbol in file.symbols.iter().filter(|symbol| {
                !symbol.local && symbol.kind == SymbolKind::Function && symbol.name == name
            }) {
                let location = Location {
                    uri: candidate_uri.clone(),
                    range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                };
                if self.files.get(origin_uri).is_some_and(|origin| {
                    origin.inherits.iter().any(|dependency| {
                        let resolved = self
                            .resolve_path_token(dependency)
                            .unwrap_or_else(|| dependency.clone());
                        (qualifier.is_empty() || path_basename(&resolved) == qualifier)
                            && self.dependency_matches(origin_uri, &resolved, candidate_uri)
                    })
                }) {
                    direct.push(location);
                } else {
                    inherited.push(location);
                }
            }
        }
        if direct.is_empty() { inherited } else { direct }
    }

    fn resolve_path_token(&self, token: &str) -> Option<String> {
        if token.starts_with('/') || token.contains('/') || token.starts_with('.') {
            return Some(token.to_owned());
        }
        self.dependency_graph().string_macros.get(token).cloned()
    }

    fn dependency_matches(&self, origin_uri: &str, dependency: &str, candidate_uri: &str) -> bool {
        if dependency.starts_with('/') || dependency.starts_with('.') || dependency.contains('/') {
            return dependency_matches(origin_uri, dependency, candidate_uri);
        }
        if !self.include_directories.is_empty() {
            return self.include_directories.iter().any(|directory| {
                dependency_matches(
                    origin_uri,
                    &format!("{}/{}", directory.trim_end_matches(['/', '\\']), dependency),
                    candidate_uri,
                )
            });
        }
        dependency_matches(origin_uri, dependency, candidate_uri)
    }

    fn receiver_type_name(&self, uri: &str, member_start: usize) -> Option<String> {
        let file = self.files.get(uri)?;
        let (operator, receiver) = member_access_context(&file.source, member_start)?;
        if operator != MemberOperator::Dot {
            return None;
        }
        let symbol = resolved_symbols(file, &receiver, member_start)
            .into_iter()
            .next()?;
        type_name_from_symbol(symbol)
    }

    fn object_target_uris(&self, uri: &str, member_start: usize) -> Option<HashSet<String>> {
        let file = self.files.get(uri)?;
        let (operator, receiver) = member_access_context(&file.source, member_start)?;
        if operator != MemberOperator::Arrow {
            return None;
        }
        let direct_targets = self.resolve_object_expression(uri, &receiver, member_start, 8);
        let mut targets = direct_targets.clone();
        for target in direct_targets {
            targets.extend(self.visible_uris(&target));
        }
        (!targets.is_empty()).then_some(targets)
    }

    fn resolve_object_expression(
        &self,
        uri: &str,
        expression: &str,
        offset: usize,
        budget: usize,
    ) -> HashSet<String> {
        if budget == 0 {
            return HashSet::new();
        }
        let expression = strip_outer_parentheses(expression.trim());
        if expression == "this_object" || expression == "this_object()" {
            return HashSet::from([uri.to_owned()]);
        }
        if let Some(path) = quoted_string(expression) {
            return self.path_target_uris(uri, path);
        }
        for constructor in ["load_object", "clone_object", "find_object", "new"] {
            if let Some(argument) = call_first_argument(expression, constructor) {
                let path =
                    self.resolve_string_expression(uri, argument, offset, budget.saturating_sub(1));
                return path
                    .map(|path| self.path_target_uris(uri, &path))
                    .unwrap_or_default();
            }
        }
        if let Some((receiver, argument)) = model_get_call(expression) {
            let registry_targets =
                self.resolve_object_expression(uri, receiver, offset, budget.saturating_sub(1));
            let Some(key) =
                self.resolve_string_expression(uri, argument, offset, budget.saturating_sub(1))
            else {
                return HashSet::new();
            };
            return registry_targets
                .iter()
                .filter_map(|target_uri| self.files.get(target_uri))
                .filter_map(|target| model_registry_path(&target.source, &key))
                .flat_map(|path| self.path_target_uris(uri, &path))
                .collect();
        }
        if let Some((receiver, method)) = member_call(expression) {
            let receiver_targets =
                self.resolve_object_expression(uri, receiver, offset, budget.saturating_sub(1));
            return self
                .files
                .iter()
                .filter(|(candidate_uri, _)| receiver_targets.contains(candidate_uri.as_str()))
                .flat_map(|(candidate_uri, file)| {
                    file.symbols
                        .iter()
                        .filter(|symbol| {
                            !symbol.local
                                && symbol.kind == SymbolKind::Function
                                && symbol.name == method
                        })
                        .flat_map(|symbol| {
                            self.function_return_targets(
                                candidate_uri,
                                symbol,
                                budget.saturating_sub(1),
                                None,
                            )
                        })
                })
                .collect();
        }
        if let Some(function_name) = direct_call_name(expression) {
            if let Some(paths) = self.instance_resolution_functions.get(function_name) {
                return paths
                    .iter()
                    .flat_map(|path| self.path_target_uris(uri, path))
                    .collect();
            }
            let first_string_argument =
                call_first_argument(expression, function_name).and_then(|argument| {
                    self.resolve_string_expression(uri, argument, offset, budget.saturating_sub(1))
                });
            let visible = self.visible_uris(uri);
            return self
                .files
                .iter()
                .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
                .flat_map(|(candidate_uri, file)| {
                    file.symbols
                        .iter()
                        .filter(|symbol| {
                            !symbol.local
                                && symbol.kind == SymbolKind::Function
                                && symbol.name == function_name
                        })
                        .flat_map(|symbol| {
                            self.function_return_targets(
                                candidate_uri,
                                symbol,
                                budget.saturating_sub(1),
                                first_string_argument.as_deref(),
                            )
                        })
                })
                .collect();
        }
        if valid_identifier(expression) {
            if let Some(path) = self.resolve_path_token(expression) {
                let targets = self.path_target_uris(uri, &path);
                if !targets.is_empty() {
                    return targets;
                }
            }
            if let Some(file) = self.files.get(uri)
                && let Some(symbol) = resolved_symbols(file, expression, offset).first()
            {
                let mut targets = HashSet::new();
                for (value, value_offset) in symbol_value_expressions(file, symbol, offset) {
                    targets.extend(self.resolve_object_expression(
                        uri,
                        value,
                        value_offset,
                        budget.saturating_sub(1),
                    ));
                }
                if !targets.is_empty() {
                    return targets;
                }
            }
        }
        HashSet::new()
    }

    fn function_return_targets(
        &self,
        defining_uri: &str,
        symbol: &Symbol,
        budget: usize,
        first_string_argument: Option<&str>,
    ) -> HashSet<String> {
        let mut targets =
            self.return_object_targets(defining_uri, defining_uri, &symbol.return_objects);
        if budget == 0 {
            return targets;
        }
        let Some(file) = self.files.get(defining_uri) else {
            return targets;
        };
        for expression in &symbol.return_expressions {
            let Some(source) = file.source.get(expression.range.clone()) else {
                continue;
            };
            let first_parameter = symbol
                .parameters
                .first()
                .and_then(|parameter| declaration_identifier(parameter));
            if let (Some(parameter), Some(argument)) = (first_parameter, first_string_argument) {
                targets.extend(self.resolve_bound_return_expression(
                    defining_uri,
                    source,
                    expression.range.start,
                    budget.saturating_sub(1),
                    parameter,
                    argument,
                ));
            } else {
                targets.extend(self.resolve_object_expression(
                    defining_uri,
                    source,
                    expression.range.start,
                    budget.saturating_sub(1),
                ));
            }
        }
        targets
    }

    fn resolve_bound_return_expression(
        &self,
        defining_uri: &str,
        expression: &str,
        offset: usize,
        budget: usize,
        parameter: &str,
        argument: &str,
    ) -> HashSet<String> {
        let expression = strip_outer_parentheses(expression.trim());
        for constructor in ["load_object", "clone_object", "find_object", "new"] {
            if call_first_argument(expression, constructor).map(str::trim) == Some(parameter) {
                return self.path_target_uris(defining_uri, argument);
            }
        }
        if let Some((receiver, model_argument)) = model_get_call(expression)
            && model_argument.trim() == parameter
        {
            let registry_targets = self.resolve_object_expression(
                defining_uri,
                receiver,
                offset,
                budget.saturating_sub(1),
            );
            return registry_targets
                .iter()
                .filter_map(|target_uri| self.files.get(target_uri))
                .filter_map(|target| model_registry_path(&target.source, argument))
                .flat_map(|path| self.path_target_uris(defining_uri, &path))
                .collect();
        }
        self.resolve_object_expression(defining_uri, expression, offset, budget)
    }

    fn resolve_string_expression(
        &self,
        uri: &str,
        expression: &str,
        offset: usize,
        budget: usize,
    ) -> Option<String> {
        if budget == 0 {
            return None;
        }
        let expression = strip_outer_parentheses(expression.trim());
        if let Some(value) = quoted_string(expression) {
            return Some(value.to_owned());
        }
        if !valid_identifier(expression) {
            return None;
        }
        if let Some(value) = self.resolve_path_token(expression) {
            return Some(value);
        }
        let file = self.files.get(uri)?;
        let symbol = resolved_symbols(file, expression, offset)
            .into_iter()
            .next()?;
        let values = symbol_value_expressions(file, symbol, offset)
            .into_iter()
            .filter_map(|(value, value_offset)| {
                self.resolve_string_expression(uri, value, value_offset, budget.saturating_sub(1))
            })
            .collect::<HashSet<_>>();
        (values.len() == 1)
            .then(|| values.into_iter().next())
            .flatten()
    }

    fn return_object_targets(
        &self,
        origin_uri: &str,
        defining_uri: &str,
        return_objects: &[String],
    ) -> HashSet<String> {
        return_objects
            .iter()
            .flat_map(|target| {
                if target == "this_object()" {
                    HashSet::from([defining_uri.to_owned()])
                } else if target == "*" {
                    HashSet::new()
                } else {
                    self.path_target_uris(origin_uri, target)
                }
            })
            .collect()
    }

    fn path_target_uris(&self, origin_uri: &str, path: &str) -> HashSet<String> {
        let graph = self.dependency_graph();
        self.dependency_lookup_keys(origin_uri, path)
            .into_iter()
            .filter_map(|key| graph.path_targets.get(&key))
            .flatten()
            .cloned()
            .collect()
    }

    fn object_member_candidates(
        &self,
        uri: &str,
        member_start: usize,
        prefix: &str,
    ) -> Option<Vec<CompletionCandidate>> {
        let targets = self.object_target_uris(uri, member_start)?;
        let normalized_prefix = prefix.to_ascii_lowercase();
        let mut symbols = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| targets.contains(candidate_uri.as_str()))
            .flat_map(|(_, file)| file.symbols.iter())
            .filter(|symbol| {
                !symbol.local
                    && symbol.kind == SymbolKind::Function
                    && (normalized_prefix.is_empty()
                        || symbol
                            .name
                            .to_ascii_lowercase()
                            .starts_with(&normalized_prefix))
            })
            .collect::<Vec<_>>();
        symbols.sort_by(|left, right| {
            left.name
                .cmp(&right.name)
                .then_with(|| right.has_body.cmp(&left.has_body))
                .then_with(|| {
                    right
                        .documentation
                        .is_some()
                        .cmp(&left.documentation.is_some())
                })
        });
        let mut candidates = symbols
            .into_iter()
            .map(completion_from_symbol)
            .collect::<Vec<_>>();
        candidates.dedup_by(|left, right| left.label == right.label);
        Some(candidates)
    }

    fn object_member_definitions(
        &self,
        uri: &str,
        member_start: usize,
        member_name: &str,
    ) -> Vec<Location> {
        let Some(targets) = self.object_target_uris(uri, member_start) else {
            return Vec::new();
        };
        self.files
            .iter()
            .filter(|(candidate_uri, _)| targets.contains(candidate_uri.as_str()))
            .flat_map(|(candidate_uri, file)| {
                preferred_function_symbols(file, member_name)
                    .into_iter()
                    .map(|symbol| Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    })
            })
            .collect()
    }

    fn object_member_hover(
        &self,
        uri: &str,
        member_start: usize,
        member_name: &str,
    ) -> Option<String> {
        let targets = self.object_target_uris(uri, member_start)?;
        let mut symbols = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| targets.contains(candidate_uri.as_str()))
            .flat_map(|(_, file)| preferred_function_symbols(file, member_name));
        let symbol = symbols.next()?;
        if symbols.next().is_some() {
            return None;
        }
        Some(match symbol.documentation.as_deref() {
            Some(documentation) => format!("```lpc\n{}\n```\n\n{documentation}", symbol.detail),
            None => format!("```lpc\n{}\n```", symbol.detail),
        })
    }

    fn typed_member_candidates(
        &self,
        uri: &str,
        member_start: usize,
        prefix: &str,
    ) -> Option<Vec<CompletionCandidate>> {
        let type_name = self.receiver_type_name(uri, member_start)?;
        let visible = self.visible_uris(uri);
        let mut definitions = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(_, file)| file.type_definitions.iter())
            .filter(|definition| definition.name == type_name)
            .collect::<Vec<_>>();
        if definitions.is_empty() {
            definitions = self
                .files
                .values()
                .flat_map(|file| file.type_definitions.iter())
                .filter(|definition| definition.name == type_name)
                .collect();
        }
        if definitions.len() != 1 {
            return None;
        }
        let normalized_prefix = prefix.to_ascii_lowercase();
        let mut candidates = definitions[0]
            .members
            .iter()
            .filter(|member| {
                normalized_prefix.is_empty()
                    || member
                        .name
                        .to_ascii_lowercase()
                        .starts_with(&normalized_prefix)
            })
            .map(|member| CompletionCandidate {
                label: member.name.clone(),
                kind: 5,
                detail: Some(member.detail.clone()),
                documentation: member.documentation.clone(),
                insert_text: None,
                insert_text_format: None,
            })
            .collect::<Vec<_>>();
        candidates.sort_by(|left, right| left.label.cmp(&right.label));
        Some(candidates)
    }

    fn typed_member_definition(
        &self,
        uri: &str,
        member_start: usize,
        member_name: &str,
    ) -> Option<Location> {
        let type_name = self.receiver_type_name(uri, member_start)?;
        let visible = self.visible_uris(uri);
        let mut matches = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(candidate_uri, file)| {
                file.type_definitions
                    .iter()
                    .filter(|definition| definition.name == type_name)
                    .flat_map(|definition| definition.members.iter())
                    .filter(|member| member.name == member_name)
                    .map(|member| Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, member.selection.clone()),
                    })
            })
            .collect::<Vec<_>>();
        if matches.is_empty() {
            matches = self
                .files
                .iter()
                .flat_map(|(candidate_uri, file)| {
                    file.type_definitions
                        .iter()
                        .filter(|definition| definition.name == type_name)
                        .flat_map(|definition| definition.members.iter())
                        .filter(|member| member.name == member_name)
                        .map(|member| Location {
                            uri: candidate_uri.clone(),
                            range: byte_range_to_lsp(&file.source, member.selection.clone()),
                        })
                })
                .collect();
        }
        (matches.len() == 1).then(|| matches.remove(0))
    }

    fn typed_member_hover(
        &self,
        uri: &str,
        member_start: usize,
        member_name: &str,
    ) -> Option<String> {
        let location = self.typed_member_definition(uri, member_start, member_name)?;
        let file = self.files.get(&location.uri)?;
        let member = file
            .type_definitions
            .iter()
            .flat_map(|definition| definition.members.iter())
            .find(|member| {
                member.name == member_name
                    && member.selection.start
                        == lsp_position_to_byte(&file.source, location.range.start)
                            .unwrap_or(usize::MAX)
            })?;
        Some(match member.documentation.as_deref() {
            Some(documentation) => format!("```lpc\n{}\n```\n\n{documentation}", member.detail),
            None => format!("```lpc\n{}\n```", member.detail),
        })
    }

    fn directive_completion_candidates(
        &self,
        context: DirectiveCompletionContext,
        prefix: &str,
    ) -> Vec<CompletionCandidate> {
        let mut candidates = HashMap::<String, CompletionCandidate>::new();
        match context {
            DirectiveCompletionContext::PreprocessorDirective
            | DirectiveCompletionContext::PreprocessorExpression => {
                for directive in PREPROCESSOR_DIRECTIVES {
                    candidates.insert(
                        (*directive).to_owned(),
                        CompletionCandidate {
                            label: (*directive).to_owned(),
                            kind: 14,
                            detail: Some(format!("预处理指令: {directive}")),
                            documentation: None,
                            insert_text: None,
                            insert_text_format: None,
                        },
                    );
                }
            }
            DirectiveCompletionContext::IncludePath | DirectiveCompletionContext::InheritPath => {
                let detail = if context == DirectiveCompletionContext::InheritPath {
                    "继承路径"
                } else {
                    "包含路径"
                };
                for uri in self.files.keys() {
                    let normalized = uri_path_without_extension(uri);
                    let basename = normalized.rsplit('/').next().unwrap_or(&normalized);
                    for label in [normalized.as_str(), basename] {
                        candidates
                            .entry(label.to_owned())
                            .or_insert_with(|| CompletionCandidate {
                                label: label.to_owned(),
                                kind: 17,
                                detail: Some(detail.to_owned()),
                                documentation: None,
                                insert_text: None,
                                insert_text_format: None,
                            });
                    }
                }
            }
        }
        let macros = if context == DirectiveCompletionContext::PreprocessorExpression {
            workspace_macros(self.files.values())
        } else if matches!(
            context,
            DirectiveCompletionContext::IncludePath | DirectiveCompletionContext::InheritPath
        ) {
            workspace_string_macros(self.files.values())
        } else {
            HashMap::new()
        };
        for (name, value) in macros {
            candidates
                .entry(name.clone())
                .or_insert(CompletionCandidate {
                    label: name,
                    kind: 21,
                    detail: Some(value),
                    documentation: None,
                    insert_text: None,
                    insert_text_format: None,
                });
        }
        let normalized_prefix = prefix.to_ascii_lowercase();
        let mut candidates = candidates
            .into_values()
            .filter(|candidate| {
                normalized_prefix.is_empty()
                    || candidate
                        .label
                        .to_ascii_lowercase()
                        .starts_with(&normalized_prefix)
            })
            .collect::<Vec<_>>();
        candidates.sort_by(|left, right| left.label.cmp(&right.label));
        candidates
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_text_format: Option<u32>,
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
const PREPROCESSOR_DIRECTIVES: &[&str] = &[
    "include", "define", "undef", "if", "ifdef", "ifndef", "elif", "else", "endif", "pragma",
    "error", "warning", "line",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DirectiveCompletionContext {
    PreprocessorDirective,
    PreprocessorExpression,
    IncludePath,
    InheritPath,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MemberOperator {
    Arrow,
    Dot,
}

fn completion_from_symbol(symbol: &Symbol) -> CompletionCandidate {
    let insert_text = (symbol.kind == SymbolKind::Function)
        .then(|| function_snippet(&symbol.name, &symbol.parameters));
    CompletionCandidate {
        label: symbol.name.clone(),
        kind: match symbol.kind {
            SymbolKind::Function => 3,
            SymbolKind::Variable | SymbolKind::Parameter => 6,
            SymbolKind::Type => 7,
        },
        detail: Some(symbol.detail.clone()),
        documentation: symbol.documentation.clone(),
        insert_text_format: insert_text.as_ref().map(|_| 2),
        insert_text,
    }
}

fn completion_from_external_function(function: &ExternalFunction) -> CompletionCandidate {
    let parameters = function
        .signatures
        .first()
        .map(|signature| signature.parameters.as_slice())
        .unwrap_or_default();
    CompletionCandidate {
        label: function.name.clone(),
        kind: 3,
        detail: function
            .signatures
            .first()
            .map(|signature| signature.label.clone()),
        documentation: function.summary.clone(),
        insert_text: Some(function_snippet(&function.name, parameters)),
        insert_text_format: Some(2),
    }
}

fn function_snippet(name: &str, parameters: &[String]) -> String {
    if parameters.is_empty() {
        return format!("{name}()");
    }
    let placeholders = parameters
        .iter()
        .enumerate()
        .map(|(index, parameter)| {
            let name =
                snippet_parameter_name(parameter).unwrap_or_else(|| format!("arg{}", index + 1));
            format!("${{{}:{name}}}", index + 1)
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!("{name}({placeholders})")
}

fn snippet_parameter_name(parameter: &str) -> Option<String> {
    let before_default = parameter.split('=').next().unwrap_or(parameter);
    before_default
        .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
        .rfind(|part| !part.is_empty())
        .map(str::to_owned)
}

fn common_object_method_snippet(name: &str) -> String {
    match name {
        "query" | "delete" => format!("{name}(${{1:prop}})"),
        "set" | "add" => format!("{name}(${{1:prop}}, ${{2:value}})"),
        _ => format!("{name}()"),
    }
}

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
            .next()
            .and_then(|child| child.utf8_text(source.as_bytes()).ok())
            .map(strip_quoted_path)
        {
            output.push(value.to_owned());
        }
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_syntax_dependencies(child, source, output);
    }
}

fn collect_inherits(root: Node<'_>, source: &str) -> Vec<String> {
    let mut inherits = Vec::new();
    collect_inherit_nodes(root, source, &mut inherits);
    inherits.sort();
    inherits.dedup();
    inherits
}

fn collect_inherit_nodes(node: Node<'_>, source: &str, output: &mut Vec<String>) {
    if node.kind() == "inherit_declaration" {
        let mut cursor = node.walk();
        if let Some(value) = node
            .named_children(&mut cursor)
            .next()
            .and_then(|child| child.utf8_text(source.as_bytes()).ok())
            .map(strip_quoted_path)
        {
            output.push(value.to_owned());
        }
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_inherit_nodes(child, source, output);
    }
}

fn strip_quoted_path(value: &str) -> &str {
    value
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .unwrap_or(value)
}

fn path_basename(path: &str) -> &str {
    let basename = path
        .trim_end_matches(['/', '\\'])
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(path);
    basename
        .strip_suffix(".c")
        .or_else(|| basename.strip_suffix(".h"))
        .unwrap_or(basename)
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

fn parse_string_macro_definition(line: &str) -> Option<(&str, String)> {
    let directive = line.trim_start().strip_prefix("#define")?.trim_start();
    let (name, value) = directive
        .split_once(char::is_whitespace)
        .map(|(name, value)| (name, value.trim()))?;
    if !value.starts_with('"') {
        return None;
    }
    let end = value[1..].find('"')? + 1;
    Some((name, value[1..end].to_owned()))
}

fn workspace_string_macros<'a>(
    files: impl Iterator<Item = &'a FileAnalysis>,
) -> HashMap<String, String> {
    let mut macros = HashMap::new();
    for file in files {
        for line in file.source.lines() {
            let Some((name, value)) = parse_string_macro_definition(line) else {
                continue;
            };
            macros.entry(name.to_owned()).or_insert(value);
        }
    }
    macros
}

fn workspace_unique_string_macros<'a>(
    files: impl Iterator<Item = &'a FileAnalysis>,
) -> HashMap<String, String> {
    let mut values = HashMap::<String, Option<String>>::new();
    for file in files {
        for line in file.source.lines() {
            let Some((name, value)) = parse_string_macro_definition(line) else {
                continue;
            };
            values
                .entry(name.to_owned())
                .and_modify(|current| {
                    if current.as_deref() != Some(value.as_str()) {
                        *current = None;
                    }
                })
                .or_insert(Some(value));
        }
    }
    values
        .into_iter()
        .filter_map(|(name, value)| value.map(|value| (name, value)))
        .collect()
}

fn workspace_macros<'a>(files: impl Iterator<Item = &'a FileAnalysis>) -> HashMap<String, String> {
    let mut macros = HashMap::new();
    for file in files {
        for line in file.source.lines() {
            let Some(directive) = line.trim_start().strip_prefix("#define") else {
                continue;
            };
            let directive = directive.trim_start();
            let split = directive
                .find(char::is_whitespace)
                .unwrap_or(directive.len());
            let raw_name = &directive[..split];
            let name = raw_name.split_once('(').map_or(raw_name, |(name, _)| name);
            if name.is_empty() {
                continue;
            }
            macros
                .entry(name.to_owned())
                .or_insert_with(|| directive[split..].trim().to_owned());
        }
    }
    macros
}

fn uri_path_without_extension(uri: &str) -> String {
    let normalized = uri.replace('\\', "/");
    normalized
        .strip_suffix(".c")
        .or_else(|| normalized.strip_suffix(".h"))
        .unwrap_or(&normalized)
        .to_owned()
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
                        return_objects: Vec::new(),
                        return_expressions: Vec::new(),
                        has_body: false,
                        local: false,
                        parameters: Vec::new(),
                    });
                }
            }
            _ => {}
        }
    }
}

fn collect_type_definitions(root: Node<'_>, source: &str) -> Vec<TypeDefinition> {
    let mut definitions = Vec::new();
    let mut cursor = root.walk();
    for node in root
        .named_children(&mut cursor)
        .filter(|node| matches!(node.kind(), "struct_declaration" | "class_declaration"))
    {
        let Some(name) = node.child_by_field_name("name") else {
            continue;
        };
        let mut members = Vec::new();
        let mut field_cursor = node.walk();
        for field in node
            .named_children(&mut field_cursor)
            .filter(|child| child.kind() == "field_declaration")
        {
            let mut child_cursor = field.walk();
            let children = field.named_children(&mut child_cursor).collect::<Vec<_>>();
            let has_primitive_type = children
                .iter()
                .any(|child| child.kind() == "primitive_type");
            let custom_type = (!has_primitive_type)
                .then(|| children.iter().find(|child| child.kind() == "identifier"))
                .flatten()
                .copied();
            for member in children.iter().filter(|child| child.kind() == "identifier") {
                if custom_type.is_some_and(|type_node| type_node.id() == member.id()) {
                    continue;
                }
                members.push(TypeMember {
                    name: text(*member, source),
                    selection: member.byte_range(),
                    detail: text(field, source).trim_end_matches(';').trim().to_owned(),
                    documentation: leading_documentation(source, field.start_byte()),
                });
            }
        }
        definitions.push(TypeDefinition {
            name: text(name, source),
            members,
        });
    }
    definitions
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
    let return_expressions = node
        .child_by_field_name("body")
        .map(collect_return_expressions)
        .unwrap_or_default();
    let has_body = node.child_by_field_name("body").is_some();
    output.push(Symbol {
        name: text(name, source),
        kind: SymbolKind::Function,
        selection: name.byte_range(),
        scope: 0..source.len(),
        detail: source[node.start_byte()..body_start.min(source.len())]
            .trim()
            .to_owned(),
        documentation: leading_documentation(source, node.start_byte()),
        return_objects: leading_return_objects(source, node.start_byte()),
        return_expressions,
        has_body,
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
                    return_objects: Vec::new(),
                    return_expressions: Vec::new(),
                    has_body: false,
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

fn collect_return_expressions(node: Node<'_>) -> Vec<ExpressionFact> {
    if node.kind() == "anonymous_function" {
        return Vec::new();
    }
    if node.kind() == "return_statement" {
        let mut cursor = node.walk();
        return node
            .named_children(&mut cursor)
            .next()
            .map(|expression| {
                vec![ExpressionFact {
                    range: expression.byte_range(),
                }]
            })
            .unwrap_or_default();
    }
    let mut expressions = Vec::new();
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        expressions.extend(collect_return_expressions(child));
    }
    expressions
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
    let mut declarator_cursor = node.walk();
    let first_declarator_start = node
        .named_children(&mut declarator_cursor)
        .find(|child| child.kind() == "variable_declarator")
        .map(|child| child.start_byte());
    let type_text = first_declarator_start
        .and_then(|start| source.get(node.start_byte()..start))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("mixed")
        .to_owned();
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
                return_objects: Vec::new(),
                return_expressions: Vec::new(),
                has_body: false,
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

fn collect_assignments(node: Node<'_>, source: &str, output: &mut Vec<AssignmentFact>) {
    if node.kind() == "anonymous_function" {
        return;
    }
    if node.kind() == "assignment_expression"
        && node
            .child_by_field_name("operator")
            .is_some_and(|operator| text(operator, source) == "=")
        && let Some(left) = node.child_by_field_name("left")
        && left.kind() == "identifier"
        && let Some(right) = node.child_by_field_name("right")
    {
        output.push(AssignmentFact {
            name: left.byte_range(),
            value: right.byte_range(),
        });
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_assignments(child, source, output);
    }
}

fn leading_documentation(source: &str, declaration_start: usize) -> Option<String> {
    render_doc_comment(leading_doc_comment(source, declaration_start)?)
}

fn leading_doc_comment(source: &str, declaration_start: usize) -> Option<&str> {
    let prefix = source.get(..declaration_start)?.trim_end();
    if !prefix.ends_with("*/") {
        return None;
    }
    let comment_start = prefix.rfind("/**")?;
    Some(&prefix[comment_start..])
}

fn leading_return_objects(source: &str, declaration_start: usize) -> Vec<String> {
    let Some(comment) = leading_doc_comment(source, declaration_start) else {
        return Vec::new();
    };
    let Some(tag_start) = comment.find("@lpc-return-objects") else {
        return Vec::new();
    };
    let tagged = &comment[tag_start + "@lpc-return-objects".len()..];
    let Some(open) = tagged.find('{') else {
        return Vec::new();
    };
    let Some(close) = tagged[open + 1..].find('}').map(|index| index + open + 1) else {
        return Vec::new();
    };
    tagged[open + 1..close]
        .split(',')
        .filter_map(|value| quoted_string(value).map(str::to_owned))
        .collect()
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

fn preferred_function_symbols<'a>(file: &'a FileAnalysis, name: &str) -> Vec<&'a Symbol> {
    let mut symbols = file
        .symbols
        .iter()
        .filter(|symbol| {
            !symbol.local && symbol.kind == SymbolKind::Function && symbol.name == name
        })
        .collect::<Vec<_>>();
    if symbols.iter().any(|symbol| symbol.has_body) {
        symbols.retain(|symbol| symbol.has_body);
    }
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

fn declaration_identifier(declaration: &str) -> Option<&str> {
    declaration
        .split('=')
        .next()
        .unwrap_or(declaration)
        .split(|character: char| character != '_' && !character.is_ascii_alphanumeric())
        .rfind(|token| valid_identifier(token))
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

fn signature_information_from_symbol(symbol: &Symbol) -> SignatureInformation {
    SignatureInformation {
        label: symbol.detail.clone(),
        documentation: symbol.documentation.clone(),
        parameters: symbol
            .parameters
            .iter()
            .map(|label| ParameterInformation {
                label: label.clone(),
            })
            .collect(),
    }
}

fn signature_help_from_external(
    external: &ExternalFunction,
    source: &str,
    open: usize,
    offset: usize,
) -> SignatureHelp {
    SignatureHelp {
        signatures: external
            .signatures
            .iter()
            .map(|signature| SignatureInformation {
                label: signature.label.clone(),
                documentation: external.summary.clone(),
                parameters: signature
                    .parameters
                    .iter()
                    .map(|label| ParameterInformation {
                        label: label.clone(),
                    })
                    .collect(),
            })
            .collect(),
        active_signature: 0,
        active_parameter: active_parameter(&source[open + 1..offset]),
    }
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

fn directive_completion_context(source: &str, offset: usize) -> Option<DirectiveCompletionContext> {
    let line_start = source
        .get(..offset)?
        .rfind('\n')
        .map_or(0, |index| index + 1);
    let line_prefix = source.get(line_start..offset)?.trim_start();
    if let Some(rest) = line_prefix.strip_prefix("#include")
        && !line_prefix.contains(';')
        && rest.chars().next().is_some_and(char::is_whitespace)
        && rest
            .trim_start()
            .chars()
            .next()
            .is_some_and(|character| matches!(character, '"' | '<'))
    {
        return Some(DirectiveCompletionContext::IncludePath);
    }
    if line_prefix.starts_with("inherit")
        && !line_prefix.contains(';')
        && line_prefix["inherit".len()..]
            .chars()
            .next()
            .is_some_and(char::is_whitespace)
    {
        return Some(DirectiveCompletionContext::InheritPath);
    }
    let directive = line_prefix.strip_prefix('#')?;
    if directive.chars().any(char::is_whitespace) {
        Some(DirectiveCompletionContext::PreprocessorExpression)
    } else {
        Some(DirectiveCompletionContext::PreprocessorDirective)
    }
}

fn directive_path_on_line(source: &str, offset: usize) -> Option<String> {
    let line_start = source
        .get(..offset)?
        .rfind('\n')
        .map_or(0, |index| index + 1);
    let line_end = source
        .get(offset..)?
        .find('\n')
        .map_or(source.len(), |index| offset + index);
    let line = source.get(line_start..line_end)?;
    let trimmed = line.trim_start();
    let relative_offset = offset.saturating_sub(line_start);
    let arguments = if let Some(arguments) = trimmed.strip_prefix("#include") {
        arguments
    } else {
        let arguments = trimmed.strip_prefix("inherit")?;
        let leading_whitespace = line.len().saturating_sub(trimmed.len());
        if trimmed
            .find(';')
            .is_some_and(|end| relative_offset > leading_whitespace + end)
        {
            return None;
        }
        arguments
    }
    .trim_start();
    if let Some(path) = arguments
        .strip_prefix('"')
        .and_then(|value| value.split_once('"').map(|(path, _)| path))
        .or_else(|| {
            arguments
                .strip_prefix('<')
                .and_then(|value| value.split_once('>').map(|(path, _)| path))
        })
    {
        return Some(path.to_owned());
    }
    arguments
        .split(|character: char| character.is_whitespace() || character == ';')
        .find(|token| !token.is_empty())
        .map(str::to_owned)
}

fn is_member_access(source: &str, identifier_start: usize) -> bool {
    let prefix = source
        .get(..identifier_start)
        .unwrap_or_default()
        .trim_end();
    prefix.ends_with("->") || prefix.ends_with('.')
}

fn member_access_context(
    source: &str,
    identifier_start: usize,
) -> Option<(MemberOperator, String)> {
    let prefix = source.get(..identifier_start)?.trim_end();
    let (operator, receiver_prefix) = if let Some(receiver) = prefix.strip_suffix("->") {
        (MemberOperator::Arrow, receiver.trim_end())
    } else {
        let receiver = prefix.strip_suffix('.')?;
        (MemberOperator::Dot, receiver.trim_end())
    };
    let bytes = receiver_prefix.as_bytes();
    let mut start = bytes.len();
    let mut depth = 0_i32;
    while start > 0 {
        let character = bytes[start - 1];
        match character {
            b')' | b']' => depth += 1,
            b'(' | b'[' if depth > 0 => depth -= 1,
            b' ' | b'\t' | b'\r' | b'\n' | b',' | b';' | b'{' | b'}' | b'=' | b'?' | b':'
                if depth == 0 =>
            {
                break;
            }
            _ => {}
        }
        start -= 1;
    }
    let receiver = receiver_prefix[start..].trim();
    (!receiver.is_empty()).then(|| (operator, receiver.to_owned()))
}

fn strip_outer_parentheses(mut expression: &str) -> &str {
    loop {
        if !expression.starts_with('(') || !expression.ends_with(')') {
            return expression;
        }
        let mut depth = 0_i32;
        let mut closes_at_end = false;
        for (index, character) in expression.char_indices() {
            match character {
                '(' => depth += 1,
                ')' => {
                    depth -= 1;
                    if depth == 0 {
                        closes_at_end = index + character.len_utf8() == expression.len();
                        break;
                    }
                }
                _ => {}
            }
        }
        if !closes_at_end {
            return expression;
        }
        expression = expression[1..expression.len() - 1].trim();
    }
}

fn quoted_string(value: &str) -> Option<&str> {
    let value = value.trim();
    value.strip_prefix('"')?.strip_suffix('"')
}

fn call_first_argument<'a>(expression: &'a str, name: &str) -> Option<&'a str> {
    let arguments = expression
        .strip_prefix(name)?
        .strip_prefix('(')?
        .strip_suffix(')')?;
    Some(arguments.split(',').next()?.trim())
}

fn model_get_call(expression: &str) -> Option<(&str, &str)> {
    let marker = "->model_get(";
    let index = expression.rfind(marker)?;
    let arguments = expression.get(index + marker.len()..)?.strip_suffix(')')?;
    Some((
        expression[..index].trim(),
        arguments.split(',').next()?.trim(),
    ))
}

fn member_call(expression: &str) -> Option<(&str, &str)> {
    let expression = expression.strip_suffix(')')?;
    let arrow = expression.rfind("->")?;
    let callable = expression.get(arrow + 2..)?;
    let open = callable.find('(')?;
    let method = callable.get(..open)?.trim();
    valid_identifier(method).then(|| (expression[..arrow].trim(), method))
}

fn direct_call_name(expression: &str) -> Option<&str> {
    let expression = expression.strip_suffix(')')?;
    let open = expression.find('(')?;
    let name = expression.get(..open)?.trim();
    valid_identifier(name).then_some(name)
}

fn model_registry_path(source: &str, key: &str) -> Option<String> {
    let key_index = source.find(&format!("\"{key}\""))?;
    let entry = source.get(key_index..key_index.saturating_add(512).min(source.len()))?;
    let path_key = entry.find("\"path\"")?;
    let path_value = entry.get(path_key + "\"path\"".len()..)?;
    let quote = path_value.find('"')?;
    let value = path_value.get(quote + 1..)?;
    let end = value.find('"')?;
    Some(value[..end].to_owned())
}

fn symbol_initializer<'a>(file: &'a FileAnalysis, symbol: &Symbol) -> Option<&'a str> {
    if !matches!(symbol.kind, SymbolKind::Variable) {
        return None;
    }
    let end = symbol.scope.end.min(file.source.len());
    let tail = file.source.get(symbol.selection.end..end)?;
    let semicolon = tail.find(';')?;
    let declaration_tail = tail.get(..semicolon)?;
    let equals = declaration_tail.find('=')?;
    declaration_tail.get(equals + 1..).map(str::trim)
}

fn symbol_value_expressions<'a>(
    file: &'a FileAnalysis,
    symbol: &Symbol,
    offset: usize,
) -> Vec<(&'a str, usize)> {
    let mut values = Vec::new();
    if let Some(initializer) = symbol_initializer(file, symbol) {
        values.push((initializer, symbol.selection.start));
    }
    values.extend(file.assignments.iter().filter_map(|assignment| {
        if assignment.name.start <= symbol.selection.end || assignment.name.start >= offset {
            return None;
        }
        let name = file.source.get(assignment.name.clone())?;
        if name != symbol.name
            || !resolved_symbols(file, name, assignment.name.start)
                .first()
                .is_some_and(|resolved| resolved.selection == symbol.selection)
        {
            return None;
        }
        file.source
            .get(assignment.value.clone())
            .map(|value| (value, assignment.value.start))
    }));
    values
}

fn receiver_originates_from_functions(
    file: &FileAnalysis,
    expression: &str,
    offset: usize,
    functions: &HashSet<String>,
    budget: usize,
) -> bool {
    if budget == 0 || functions.is_empty() {
        return false;
    }
    let expression = strip_outer_parentheses(expression.trim());
    if direct_call_name(expression).is_some_and(|name| functions.contains(name)) {
        return true;
    }
    if valid_identifier(expression)
        && let Some(symbol) = resolved_symbols(file, expression, offset).first()
        && let Some(initializer) = symbol_initializer(file, symbol)
    {
        return receiver_originates_from_functions(
            file,
            initializer,
            symbol.selection.start,
            functions,
            budget.saturating_sub(1),
        );
    }
    false
}

fn type_name_from_symbol(symbol: &Symbol) -> Option<String> {
    let declaration_prefix = symbol.detail.rsplit_once(&symbol.name)?.0;
    declaration_prefix
        .split_whitespace()
        .rev()
        .map(|part| part.trim_matches(['*', '&']))
        .find(|part| {
            !part.is_empty()
                && !matches!(
                    *part,
                    "class"
                        | "struct"
                        | "private"
                        | "protected"
                        | "public"
                        | "static"
                        | "nosave"
                        | "ref"
                )
        })
        .map(str::to_owned)
}

fn scope_access_qualifier(source: &str, identifier_start: usize) -> Option<String> {
    let prefix = source.get(..identifier_start)?.trim_end();
    let qualifier_prefix = prefix.strip_suffix("::")?.trim_end();
    let qualifier_start = qualifier_prefix
        .char_indices()
        .rev()
        .find(|(_, character)| !character.is_ascii_alphanumeric() && *character != '_')
        .map_or(0, |(index, character)| index + character.len_utf8());
    Some(qualifier_prefix[qualifier_start..].to_owned())
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
        assert_eq!(
            completions[0].insert_text.as_deref(),
            Some("query(${1:prop})")
        );
        assert_eq!(completions[0].insert_text_format, Some(2));

        let member_position = byte_to_lsp_position(source, source.find("quer").unwrap());
        assert!(
            database
                .definition("file:///demo.c", member_position)
                .is_empty()
        );
        assert!(database.hover("file:///demo.c", member_position).is_none());
    }

    #[test]
    fn completes_bare_scoped_methods_from_macro_backed_inherits() {
        let source = "inherit BASE; void demo() { ::par }\n";
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            (
                "file:///mud/include/globals.h",
                "#define BASE \"/std/base\"\n",
            ),
            (
                "file:///mud/std/base.c",
                "/** parent docs */\nint parent_method() { return 1; }\n",
            ),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }

        let position = byte_to_lsp_position(source, source.find("par").unwrap() + 3);
        let completions = database.completion_candidates("file:///demo.c", position);
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "parent_method");
        assert_eq!(
            completions[0].insert_text.as_deref(),
            Some("parent_method()")
        );
    }

    #[test]
    fn resolves_named_inherit_scope_across_language_features() {
        let source = concat!(
            "inherit \"/std/room\";\n",
            "inherit \"/std/item\";\n",
            "void demo() { room::init(\"hall\"); room::in }\n",
        );
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            (
                "file:///mud/std/room.c",
                "/** initialize a room */\nvoid init(string name) {}\n",
            ),
            (
                "file:///mud/std/item.c",
                "/** initialize an item */\nvoid init(int count) {}\n",
            ),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }

        let method_start = source.find("init").unwrap();
        let position = byte_to_lsp_position(source, method_start + 1);
        let definitions = database.definition("file:///demo.c", position);
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/room.c");
        assert!(
            database
                .prepare_rename("file:///demo.c", position)
                .is_some()
        );

        let hover = database.hover("file:///demo.c", position).unwrap();
        assert!(hover.contents.contains("void init(string name)"));
        assert!(hover.contents.contains("initialize a room"));
        assert!(!hover.contents.contains("initialize an item"));

        let signature_position = byte_to_lsp_position(source, source.find("hall").unwrap() + 2);
        let signature = database
            .signature_help("file:///demo.c", signature_position)
            .unwrap();
        assert_eq!(signature.signatures.len(), 1);
        assert_eq!(signature.signatures[0].label, "void init(string name)");
        assert_eq!(signature.signatures[0].parameters.len(), 1);

        let completion_end = source.rfind("in").unwrap() + 2;
        let completions = database.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, completion_end),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "init");
        assert_eq!(
            completions[0].documentation.as_deref(),
            Some("initialize a room")
        );

        let references = database.references("file:///demo.c", position, true);
        assert_eq!(references.len(), 2);
        assert!(
            references
                .iter()
                .any(|location| location.uri == "file:///mud/std/room.c")
        );
        assert!(
            references
                .iter()
                .all(|location| location.uri != "file:///mud/std/item.c")
        );
    }

    #[test]
    fn keeps_ambiguous_or_unknown_named_inherit_scopes_conservative() {
        let source = concat!(
            "inherit \"/std/room\";\n",
            "inherit \"/other/room\";\n",
            "void demo() { room::init(1); missing::init(1); room::in }\n",
        );
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            ("file:///mud/std/room.c", "void init(string name) {}\n"),
            ("file:///mud/other/room.c", "void init(int count) {}\n"),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }

        for method_start in [source.find("init").unwrap(), source.rfind("init").unwrap()] {
            let position = byte_to_lsp_position(source, method_start + 1);
            assert!(database.definition("file:///demo.c", position).is_empty());
            assert!(database.hover("file:///demo.c", position).is_none());
            assert!(
                database
                    .signature_help(
                        "file:///demo.c",
                        byte_to_lsp_position(source, method_start + "init(".len()),
                    )
                    .is_none()
            );
            assert!(
                database
                    .prepare_rename("file:///demo.c", position)
                    .is_none()
            );
        }

        let completion_end = source.rfind("in").unwrap() + 2;
        assert!(
            database
                .completion_candidates(
                    "file:///demo.c",
                    byte_to_lsp_position(source, completion_end)
                )
                .is_empty()
        );
    }

    #[test]
    fn completes_efun_scope_only_from_external_functions() {
        let source = "void demo() { efun::write(1); efun::wr }\n";
        let mut database = database(source);
        database.set_external_functions(vec![ExternalFunction {
            name: "write".to_owned(),
            summary: Some("write docs".to_owned()),
            signatures: vec![ExternalSignature {
                label: "void write(mixed value)".to_owned(),
                parameters: vec!["mixed value".to_owned()],
                minimum_arguments: 1,
                maximum_arguments: Some(1),
            }],
        }]);
        let position = byte_to_lsp_position(source, source.rfind("wr").unwrap() + 2);
        let completions = database.completion_candidates("file:///demo.c", position);
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "write");
        assert_eq!(completions[0].documentation.as_deref(), Some("write docs"));

        let call_start = source.find("write").unwrap();
        let call_position = byte_to_lsp_position(source, call_start + 1);
        assert!(
            database
                .definition("file:///demo.c", call_position)
                .is_empty()
        );
        assert!(
            database
                .hover("file:///demo.c", call_position)
                .is_some_and(|hover| hover.contents.contains("write docs"))
        );
        let signature = database
            .signature_help(
                "file:///demo.c",
                byte_to_lsp_position(source, source.find('1').unwrap() + 1),
            )
            .unwrap();
        assert_eq!(signature.signatures.len(), 1);
        assert_eq!(signature.signatures[0].parameters.len(), 1);
    }

    #[test]
    fn completes_preprocessor_directives_without_global_symbols() {
        let source = "#def\n";
        let mut database = database(source);
        let position = byte_to_lsp_position(source, source.find("def").unwrap() + 3);
        let completions = database.completion_candidates("file:///demo.c", position);
        assert_eq!(
            completions
                .iter()
                .map(|candidate| candidate.label.as_str())
                .collect::<Vec<_>>(),
            vec!["define"]
        );
    }

    #[test]
    fn completes_include_and_inherit_paths_from_the_workspace_index() {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for source in ["#include \"/adm/sim", "inherit \"/adm/sim"] {
            let mut database = database(source);
            let dependency = "void helper() {}\n";
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source("file:///mud/adm/simul_efun.c", &tree, dependency);
            let position = byte_to_lsp_position(source, source.len());
            let completions = database.completion_candidates("file:///demo.c", position);
            assert!(
                completions
                    .iter()
                    .any(|candidate| candidate.label == "simul_efun")
            );
            assert!(
                completions
                    .iter()
                    .all(|candidate| candidate.label != "helper")
            );
        }
    }

    #[test]
    fn resolves_include_and_inherit_string_paths_to_indexed_files() {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for source in [
            "#include \"/adm/simul_efun/atoi.c\"\n",
            "inherit \"/adm/simul_efun/atoi\";\n",
        ] {
            let mut database = database(source);
            let dependency = "void helper() {}\n";
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source("file:///mud/adm/simul_efun/atoi.c", &tree, dependency);
            for offset in [source.find("atoi").unwrap() + 2, 2] {
                let locations =
                    database.definition("file:///demo.c", byte_to_lsp_position(source, offset));
                assert_eq!(locations.len(), 1);
                assert_eq!(locations[0].uri, "file:///mud/adm/simul_efun/atoi.c");
            }
        }

        let source = "inherit BASE;\n";
        let mut database = database(source);
        for (uri, dependency) in [
            (
                "file:///mud/include/globals.h",
                "#define BASE \"/std/base\"\n",
            ),
            ("file:///mud/std/base.c", "void helper() {}\n"),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }
        let locations = database.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, source.find("inherit").unwrap() + 2),
        );
        assert_eq!(locations.len(), 1);
        assert_eq!(locations[0].uri, "file:///mud/std/base.c");
    }

    #[test]
    fn invalidates_the_dependency_graph_after_document_changes() {
        let source = "inherit \"/std/first\"; void demo() { helper(); }\n";
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for uri in [
            "file:///mud/std/first.c",
            "file:///mud/std/second.c",
            "file:///mud/other/unrelated.c",
        ] {
            let dependency = "void helper() {}\n";
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }
        let position = byte_to_lsp_position(source, source.find("helper").unwrap());
        let definitions = database.definition("file:///demo.c", position);
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/first.c");

        let updated = "inherit \"/std/second\"; void demo() { helper(); }\n";
        let tree = parser.parse(updated, None).unwrap();
        database.update("file:///demo.c", 2, 2, &tree, updated);
        let updated_position = byte_to_lsp_position(updated, updated.find("helper").unwrap());
        let definitions = database.definition("file:///demo.c", updated_position);
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/second.c");

        database.remove("file:///mud/std/second.c");
        assert!(
            database
                .definition("file:///demo.c", updated_position)
                .is_empty()
        );
    }

    #[test]
    fn completes_and_navigates_typed_struct_members() {
        let source = concat!(
            "struct Payload {\n",
            "  /** display label */\n",
            "  string name;\n",
            "  int level;\n",
            "}\n",
            "void demo() { struct Payload payload; payload.name; }\n",
        );
        let mut database = database(source);
        let member_use = source.rfind("name").unwrap();
        let completions = database.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member_use + 2),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "name");

        let position = byte_to_lsp_position(source, member_use + 1);
        let locations = database.definition("file:///demo.c", position);
        assert_eq!(locations.len(), 1);
        assert_eq!(locations[0].range.start.line, 2);
        let hover = database.hover("file:///demo.c", position).unwrap();
        assert!(hover.contents.contains("string name"));
        assert!(hover.contents.contains("display label"));
    }

    #[test]
    fn resolves_macro_backed_object_methods_across_language_features() {
        let source = "void demo() { PROTOCOL_D->model_get(\"login\"); }\n";
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            (
                "file:///mud/include/globals.h",
                "#define PROTOCOL_D \"/adm/protocol/protocol_server\"\n",
            ),
            (
                "file:///mud/adm/protocol/protocol_server.c",
                "/** resolve protocol models */\nobject model_get(string name) { return 0; }\n",
            ),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }

        let member_start = source.find("model_get").unwrap();
        let completion_position = byte_to_lsp_position(source, member_start + 5);
        let completions = database.completion_candidates("file:///demo.c", completion_position);
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "model_get");

        let member_position = byte_to_lsp_position(source, member_start + 1);
        let definitions = database.definition("file:///demo.c", member_position);
        assert_eq!(definitions.len(), 1);
        assert!(
            definitions[0]
                .uri
                .ends_with("/adm/protocol/protocol_server.c")
        );
        let hover = database.hover("file:///demo.c", member_position).unwrap();
        assert!(hover.contents.contains("resolve protocol models"));

        let signature_position = byte_to_lsp_position(source, source.find("login").unwrap() + 2);
        let signature = database
            .signature_help("file:///demo.c", signature_position)
            .unwrap();
        assert_eq!(signature.signatures.len(), 1);
        assert_eq!(signature.signatures[0].parameters.len(), 1);
        assert!(
            signature.signatures[0]
                .documentation
                .as_deref()
                .is_some_and(|documentation| documentation.contains("protocol models"))
        );
    }

    #[test]
    fn propagates_exact_model_get_results_through_local_variables() {
        let source = concat!(
            "void demo() {\n",
            "  string model_name = \"login\";\n",
            "  object popup = PROTOCOL_D->model_get(model_name);\n",
            "  popup->create_popup();\n",
            "}\n",
        );
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            (
                "file:///mud/include/globals.h",
                "#define PROTOCOL_D \"/adm/protocol/protocol_server\"\n",
            ),
            (
                "file:///mud/adm/protocol/protocol_server.c",
                concat!(
                    "mapping query_model_registry() {\n",
                    "  return ([ \"login\": ([ \"path\": \"/adm/protocol/model/login_model\" ]) ]);\n",
                    "}\n",
                    "object model_get(string name) { return 0; }\n",
                ),
            ),
            (
                "file:///mud/adm/protocol/model/login_model.c",
                "/** create login popup */\nmapping create_popup() { return ([]); }\n",
            ),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }

        let member_start = source.rfind("create_popup").unwrap();
        let completions = database.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 6),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "create_popup");

        let position = byte_to_lsp_position(source, member_start + 1);
        let definitions = database.definition("file:///demo.c", position);
        assert_eq!(definitions.len(), 1);
        assert!(definitions[0].uri.ends_with("/model/login_model.c"));
        let hover = database.hover("file:///demo.c", position).unwrap();
        assert!(hover.contents.contains("create login popup"));
    }

    #[test]
    fn resolves_this_object_and_load_object_method_targets() {
        let source = concat!(
            "inherit \"/std/base\";\n",
            "void demo() { this_object()->parent_method(); }\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let base = "/** inherited method */\nint parent_method() { return 1; }\n";
        let tree = parser.parse(base, None).unwrap();
        analysis.index_source("file:///mud/std/base.c", &tree, base);

        let member_start = source.find("parent_method").unwrap();
        let completions = analysis.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 6),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "parent_method");
        let definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 1),
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");

        let direct_source = "void demo() { load_object(\"/std/base\")->parent_method(); }\n";
        let mut direct_database = database(direct_source);
        let tree = parser.parse(base, None).unwrap();
        direct_database.index_source("file:///mud/std/base.c", &tree, base);
        let member_start = direct_source.find("parent_method").unwrap();
        let definitions = direct_database.definition(
            "file:///demo.c",
            byte_to_lsp_position(direct_source, member_start + 1),
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");

        let alias_source = concat!(
            "void demo() {\n",
            "  string base_path = \"/std/base\";\n",
            "  load_object(base_path)->parent_method();\n",
            "}\n",
        );
        let mut alias_database = database(alias_source);
        let tree = parser.parse(base, None).unwrap();
        alias_database.index_source("file:///mud/std/base.c", &tree, base);
        let member_start = alias_source.find("parent_method").unwrap();
        let definitions = alias_database.definition(
            "file:///demo.c",
            byte_to_lsp_position(alias_source, member_start + 1),
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");
    }

    #[test]
    fn applies_configured_global_include_and_instance_resolution() {
        let source = "void demo() { GLOBAL_HELPER(); this_player()->query_name(); }\n";
        let mut database = database(source);
        database.set_workspace_resolution(
            vec!["globals.h".to_owned()],
            vec!["/include".to_owned()],
            HashMap::from([(
                "this_player".to_owned(),
                vec!["/clone/user/user".to_owned()],
            )]),
        );
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            (
                "file:///mud/include/globals.h",
                "int GLOBAL_HELPER() { return 1; }\n",
            ),
            (
                "file:///mud/clone/user/user.c",
                "string query_name() { return \"user\"; }\n",
            ),
            (
                "file:///mud/other.c",
                "string query_name() { return \"other\"; }\n",
            ),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }

        let global = source.find("GLOBAL_HELPER").unwrap();
        let definitions =
            database.definition("file:///demo.c", byte_to_lsp_position(source, global));
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/include/globals.h");

        let member = source.find("query_name").unwrap();
        let completions = database.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member + "query_na".len()),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "query_name");
        let definitions =
            database.definition("file:///demo.c", byte_to_lsp_position(source, member + 2));
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/clone/user/user.c");
        let references = database.references(
            "file:///demo.c",
            byte_to_lsp_position(source, member + 2),
            true,
        );
        assert_eq!(references.len(), 2);
        assert!(
            references
                .iter()
                .all(|location| location.uri != "file:///mud/other.c")
        );
        let edits = database.rename_edits(
            "file:///demo.c",
            byte_to_lsp_position(source, member + 2),
            "display_name",
        );
        assert_eq!(edits.get("file:///demo.c").map(Vec::len), Some(1));
        assert_eq!(
            edits.get("file:///mud/clone/user/user.c").map(Vec::len),
            Some(1)
        );
        assert!(!edits.contains_key("file:///mud/other.c"));
    }

    #[test]
    fn finds_and_renames_cross_file_inherited_references_without_touching_shadows() {
        let source = "inherit \"/std/base\"; void demo() { shared_name(); }\n";
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency) in [
            (
                "file:///mud/std/base.c",
                "int shared_name() { return 1; }\n",
            ),
            (
                "file:///mud/unrelated.c",
                "int shared_name; int read(mixed shared_name) { return shared_name; }\n",
            ),
        ] {
            let tree = parser.parse(dependency, None).unwrap();
            database.index_source(uri, &tree, dependency);
        }
        let use_offset = source.rfind("shared_name").unwrap() + 2;
        let position = byte_to_lsp_position(source, use_offset);
        let definitions = database.definition("file:///demo.c", position);
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");
        let references = database.references("file:///demo.c", position, true);
        assert_eq!(references.len(), 2);
        assert!(
            references
                .iter()
                .all(|location| location.uri != "file:///mud/unrelated.c")
        );
        let edits = database.rename_edits("file:///demo.c", position, "renamed_shared");
        assert_eq!(edits.get("file:///demo.c").map(Vec::len), Some(1));
        assert_eq!(edits.get("file:///mud/std/base.c").map(Vec::len), Some(1));
        assert!(!edits.contains_key("file:///mud/unrelated.c"));
    }

    #[test]
    fn propagates_documented_return_objects_from_local_calls() {
        let source = concat!(
            "/** @lpc-return-objects {\"/clone/user/user\"} */\n",
            "object make_user() { return 0; }\n",
            "void demo() {\n",
            "  object user = make_user();\n",
            "  user->query_name();\n",
            "}\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let target = "/** player name */\nstring query_name() { return \"demo\"; }\n";
        let tree = parser.parse(target, None).unwrap();
        analysis.index_source("file:///mud/clone/user/user.c", &tree, target);

        let member_start = source.rfind("query_name").unwrap();
        let completions = analysis.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 6),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "query_name");
        let definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 1),
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/clone/user/user.c");
    }

    #[test]
    fn propagates_statically_proven_return_expressions_from_wrapper_functions() {
        let source = concat!(
            "object make_base() {\n",
            "  string path = \"/std/base\";\n",
            "  return load_object(path);\n",
            "}\n",
            "void demo() { make_base()->parent_method(); }\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let target = concat!(
            "int parent_method();\n",
            "/** inherited method */\n",
            "int parent_method() { return 1; }\n",
        );
        let tree = parser.parse(target, None).unwrap();
        analysis.index_source("file:///mud/std/base.c", &tree, target);

        let member_start = source.rfind("parent_method").unwrap();
        let definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 1),
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");
        let hover = analysis
            .hover(
                "file:///demo.c",
                byte_to_lsp_position(source, member_start + 1),
            )
            .unwrap();
        assert!(hover.contents.contains("inherited method"));
        let completions = analysis.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 6),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "parent_method");
    }

    #[test]
    fn binds_static_string_arguments_in_object_wrapper_returns() {
        let source = concat!(
            "#define BASE_D \"/std/base\"\n",
            "object find_runtime_object(string path) {\n",
            "  return find_object(path);\n",
            "}\n",
            "void demo() {\n",
            "  object runtime;\n",
            "  runtime = find_runtime_object(BASE_D);\n",
            "  runtime->parent_method();\n",
            "}\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let target = "/** inherited method */\nint parent_method() { return 1; }\n";
        let tree = parser.parse(target, None).unwrap();
        analysis.index_source("file:///mud/std/base.c", &tree, target);

        let member_start = source.rfind("parent_method").unwrap();
        let definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 1),
        );
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///mud/std/base.c");
        let hover = analysis
            .hover(
                "file:///demo.c",
                byte_to_lsp_position(source, member_start + 1),
            )
            .unwrap();
        assert!(hover.contents.contains("inherited method"));
    }

    #[test]
    fn keeps_multiple_static_assignment_targets_conservative() {
        let source = concat!(
            "void demo(int use_other) {\n",
            "  object runtime;\n",
            "  runtime = load_object(\"/std/base\");\n",
            "  if (use_other) runtime = load_object(\"/std/other\");\n",
            "  runtime->shared_method();\n",
            "}\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for path in ["base", "other"] {
            let target = "int shared_method() { return 1; }\n";
            let tree = parser.parse(target, None).unwrap();
            analysis.index_source(&format!("file:///mud/std/{path}.c"), &tree, target);
        }

        let member_start = source.rfind("shared_method").unwrap();
        let definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 1),
        );
        assert_eq!(definitions.len(), 2);
        assert!(definitions.iter().any(|item| item.uri.ends_with("/base.c")));
        assert!(
            definitions
                .iter()
                .any(|item| item.uri.ends_with("/other.c"))
        );
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
        assert_eq!(
            completion.insert_text.as_deref(),
            Some("battle_choices(${1:popup}, ${2:type})")
        );
        assert_eq!(completion.insert_text_format, Some(2));
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
        assert_eq!(
            write_completion.insert_text.as_deref(),
            Some("write(${1:str})")
        );
        assert_eq!(write_completion.insert_text_format, Some(2));
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

        let unrelated = "void write() {}\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(unrelated, None).unwrap();
        database.index_source("file:///unrelated.c", &tree, unrelated);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .any(|diagnostic| diagnostic.code == "lpc.argumentCountMismatch")
        );
    }
}
