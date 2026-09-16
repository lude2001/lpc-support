use std::{
    cell::{Ref, RefCell},
    collections::{HashMap, HashSet},
    hash::{DefaultHasher, Hash, Hasher},
    time::Instant,
};

use lpc_preprocessor::{InactiveRegion, IncludeFact, MacroDirectiveFact, MacroDirectiveKind};
use serde::{Deserialize, Serialize};
use tree_sitter::{Node, Parser, Tree};

mod documentation;

pub use documentation::CallableDocumentation;
use documentation::parse_callable_documentation;

type PreprocessedEnvironment<'a> = (
    &'a [MacroDirectiveFact],
    &'a HashMap<String, String>,
    &'a [IncludeFact],
    &'a [InactiveRegion],
);

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
#[serde(rename_all = "camelCase")]
pub struct VariableEntry {
    pub name: String,
    pub detail: String,
    pub range: Range,
    pub local: bool,
    pub unused: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDiagnosticsEntry {
    pub uri: String,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FunctionRange {
    pub name: String,
    pub range: Range,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedDocumentSymbol {
    pub name: String,
    pub kind: u32,
    pub range: Range,
    pub selection_range: Range,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FunctionDocumentationEntry {
    pub name: String,
    pub signature: String,
    pub parameters: Vec<String>,
    pub documentation: Option<String>,
    pub documentation_range: Option<Range>,
    pub structured_documentation: Option<CallableDocumentation>,
    pub return_objects: Vec<String>,
    pub range: Range,
    pub selection_range: Range,
    pub has_body: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FunctionDocumentationGroup {
    pub uri: String,
    pub source_kind: &'static str,
    pub depth: usize,
    pub parent_uri: Option<String>,
    pub entries: Vec<FunctionDocumentationEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FunctionDocumentationLookup {
    pub current_file: FunctionDocumentationGroup,
    pub inherited_groups: Vec<FunctionDocumentationGroup>,
    pub include_groups: Vec<FunctionDocumentationGroup>,
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
    declaration: std::ops::Range<usize>,
    scope: std::ops::Range<usize>,
    detail: String,
    documentation: Option<CallableDocumentation>,
    return_objects: Vec<String>,
    return_expressions: Vec<ExpressionFact>,
    value_expressions: Vec<ExpressionFact>,
    has_body: bool,
    local: bool,
    check_unused: bool,
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
struct MacroDefinition {
    name: String,
    value: String,
    selection: std::ops::Range<usize>,
    function_like: bool,
    parameters: Vec<String>,
    documentation: Option<String>,
    active_until: usize,
}

#[derive(Debug, Clone)]
struct FileAnalysis {
    version: i32,
    revision: u64,
    source: String,
    symbols: Vec<Symbol>,
    type_definitions: Vec<TypeDefinition>,
    identifiers: Vec<std::ops::Range<usize>>,
    value_references: Vec<std::ops::Range<usize>>,
    diagnostics: Vec<Diagnostic>,
    folding_ranges: Vec<FoldingRange>,
    calls: Vec<CallSite>,
    assignments: Vec<AssignmentFact>,
    dependencies: Vec<String>,
    inherits: Vec<String>,
    macros: Vec<MacroDefinition>,
    macro_directives: Vec<MacroDirectiveFact>,
    inactive_regions: Vec<std::ops::Range<usize>>,
    initial_macro_hashes: Vec<u64>,
    macro_tracking_precise: bool,
    macro_generated_symbols: HashSet<String>,
}

#[derive(Debug, Clone)]
struct CallSite {
    name: String,
    range: std::ops::Range<usize>,
    argument_count: usize,
    top_level: bool,
}

#[derive(Debug, Default)]
struct DependencyGraph {
    forward: HashMap<String, HashSet<String>>,
    inherit_forward: HashMap<String, HashSet<String>>,
    reverse: HashMap<String, HashSet<String>>,
    path_targets: HashMap<String, HashSet<String>>,
    string_macros: HashMap<String, String>,
    macro_locations: HashMap<String, Vec<(String, usize)>>,
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

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SemanticTokenFacts {
    pub local_functions: HashSet<String>,
    pub visible_functions: HashSet<String>,
    pub simulated_functions: HashSet<String>,
    pub external_functions: HashSet<String>,
    pub macro_names: HashSet<String>,
    pub macro_declarations: Vec<std::ops::Range<usize>>,
    pub macro_scopes: HashMap<String, Vec<std::ops::Range<usize>>>,
}

#[derive(Debug, Default)]
pub struct AnalysisDatabase {
    files: HashMap<String, FileAnalysis>,
    external_functions: HashMap<String, ExternalFunction>,
    predefined_macros: HashMap<String, String>,
    type_checking_enabled: Option<bool>,
    unused_global_var_check_enabled: bool,
    unused_parameter_check_enabled: bool,
    enforce_local_variable_declaration_at_block_start: bool,
    search_efun_definition_in_inheritance_chain: bool,
    global_includes: Vec<String>,
    include_directories: Vec<String>,
    simulated_efun_files: Vec<String>,
    instance_resolution_functions: HashMap<String, Vec<String>>,
    dependency_graph: RefCell<Option<DependencyGraph>>,
    dependency_resolution_cache: RefCell<HashMap<String, bool>>,
    metrics: AnalysisMetrics,
}

impl AnalysisDatabase {
    pub fn set_external_functions(&mut self, functions: Vec<ExternalFunction>) {
        self.external_functions = functions
            .into_iter()
            .map(|function| (function.name.clone(), function))
            .collect();
    }

    pub fn set_predefined_macros(&mut self, definitions: Vec<(String, String)>) {
        self.predefined_macros = definitions.into_iter().collect();
    }

    pub fn set_type_checking_enabled(&mut self, enabled: bool) {
        self.type_checking_enabled = Some(enabled);
    }

    pub fn set_diagnostic_preferences(
        &mut self,
        unused_global_var_check_enabled: bool,
        unused_parameter_check_enabled: bool,
        enforce_local_variable_declaration_at_block_start: bool,
    ) {
        self.unused_global_var_check_enabled = unused_global_var_check_enabled;
        self.unused_parameter_check_enabled = unused_parameter_check_enabled;
        self.enforce_local_variable_declaration_at_block_start =
            enforce_local_variable_declaration_at_block_start;
    }

    pub fn set_search_efun_definition_in_inheritance_chain(&mut self, enabled: bool) {
        self.search_efun_definition_in_inheritance_chain = enabled;
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

    pub fn set_simulated_efun_files(&mut self, files: Vec<String>) {
        self.simulated_efun_files = files;
        self.dependency_resolution_cache.borrow_mut().clear();
    }

    pub fn semantic_token_facts(&mut self, uri: &str) -> SemanticTokenFacts {
        self.metrics.query_count += 1;
        let local_functions = self
            .files
            .get(uri)
            .into_iter()
            .flat_map(|file| file.symbols.iter())
            .filter(|symbol| symbol.kind == SymbolKind::Function)
            .map(|symbol| symbol.name.clone())
            .collect();
        let visible = self.visible_uris(uri);
        let indexed_files = &self.files;
        let visible_functions = visible
            .iter()
            .filter_map(|candidate_uri| indexed_files.get(candidate_uri))
            .flat_map(|file| file.symbols.iter())
            .filter(|symbol| symbol.kind == SymbolKind::Function)
            .map(|symbol| symbol.name.clone())
            .collect();

        let mut simulated_uris = HashSet::new();
        for path in &self.simulated_efun_files {
            for entry_uri in self.path_target_uris(uri, path) {
                simulated_uris.extend(self.visible_uris(&entry_uri));
            }
        }
        let simulated_functions = simulated_uris
            .iter()
            .filter_map(|candidate_uri| indexed_files.get(candidate_uri))
            .flat_map(|file| file.symbols.iter())
            .filter(|symbol| symbol.kind == SymbolKind::Function && !symbol.local)
            .map(|symbol| symbol.name.clone())
            .collect();

        let macro_names = self.external_macro_names(uri);
        SemanticTokenFacts {
            local_functions,
            visible_functions,
            simulated_functions,
            external_functions: self.external_functions.keys().cloned().collect(),
            macro_scopes: self.local_macro_scopes(uri),
            macro_names,
            macro_declarations: self
                .files
                .get(uri)
                .into_iter()
                .flat_map(|file| file.macros.iter())
                .map(|definition| definition.selection.clone())
                .collect(),
        }
    }

    pub fn update(&mut self, uri: &str, version: i32, revision: u64, tree: &Tree, source: &str) {
        self.update_with_macro_environment(uri, version, revision, tree, source, None);
    }

    pub fn update_preprocessed(
        &mut self,
        uri: &str,
        version: i32,
        revision: u64,
        tree: &Tree,
        source: &str,
        preprocessed_environment: PreprocessedEnvironment<'_>,
    ) {
        self.update_with_macro_environment(
            uri,
            version,
            revision,
            tree,
            source,
            Some(preprocessed_environment),
        );
    }

    fn update_with_macro_environment(
        &mut self,
        uri: &str,
        version: i32,
        revision: u64,
        tree: &Tree,
        source: &str,
        preprocessed_environment: Option<PreprocessedEnvironment<'_>>,
    ) {
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
        let mut value_references = Vec::new();
        collect_value_references(tree.root_node(), source, &mut value_references);
        let diagnostics = collect_diagnostics(tree, source);
        let folding_ranges = collect_folding_ranges(tree, source);
        let mut calls = Vec::new();
        collect_calls(tree.root_node(), source, &mut calls);
        let macro_directives = preprocessed_environment.map(|environment| environment.0);
        let predefined_macros = preprocessed_environment.map(|environment| environment.1);
        let mut initial_macro_hashes = predefined_macros
            .into_iter()
            .flat_map(|definitions| definitions.keys().map(|name| macro_name_hash(name)))
            .collect::<Vec<_>>();
        initial_macro_hashes.sort_unstable();
        initial_macro_hashes.dedup();
        let macros = collect_macro_definitions(source, macro_directives);
        let mut expansion_macros = predefined_macros.map_or_else(Vec::new, |predefined_macros| {
            macro_definitions_from_environment(
                source.len(),
                predefined_macros,
                macro_directives.unwrap_or_default(),
            )
        });
        expansion_macros.extend(macro_definitions_from_directives(
            source.len(),
            macro_directives.unwrap_or_default(),
            &macros,
        ));
        expansion_macros.extend(macros.clone());
        let macro_generated_symbols =
            collect_macro_generated_symbols(source, &calls, &expansion_macros, &mut symbols);
        let mut assignments = Vec::new();
        collect_assignments(tree.root_node(), source, &mut assignments);
        let active_includes = preprocessed_environment.map(|environment| environment.2);
        let inactive_regions = preprocessed_environment
            .map(|environment| environment.3)
            .unwrap_or_default()
            .iter()
            .map(|region| region.range.start_byte..region.range.end_byte)
            .collect();
        let dependencies = collect_dependencies(tree.root_node(), source, active_includes);
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
                value_references,
                diagnostics,
                folding_ranges,
                calls,
                assignments,
                dependencies,
                inherits,
                macros,
                macro_directives: macro_directives
                    .unwrap_or_default()
                    .iter()
                    .cloned()
                    .map(|mut directive| {
                        directive.value = None;
                        directive
                    })
                    .collect(),
                inactive_regions,
                initial_macro_hashes,
                macro_tracking_precise: preprocessed_environment.is_some(),
                macro_generated_symbols,
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

    pub fn index_preprocessed_source(
        &mut self,
        uri: &str,
        tree: &Tree,
        source: &str,
        preprocessed_environment: PreprocessedEnvironment<'_>,
    ) {
        self.update_preprocessed(uri, -1, 0, tree, source, preprocessed_environment);
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

    pub fn dependent_uris(&mut self, uri: &str) -> Vec<String> {
        self.metrics.query_count += 1;
        let graph = self.dependency_graph();
        let mut visited = HashSet::new();
        let mut pending = vec![uri.to_owned()];
        while let Some(target) = pending.pop() {
            if let Some(consumers) = graph.reverse.get(&target) {
                for consumer in consumers {
                    if visited.insert(consumer.clone()) {
                        pending.push(consumer.clone());
                    }
                }
            }
        }
        let mut dependents = visited.into_iter().collect::<Vec<_>>();
        dependents.sort();
        dependents
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
        let mut known_symbol_uris = visible.clone();
        for path in &self.simulated_efun_files {
            for entry_uri in self.path_target_uris(uri, path) {
                known_symbol_uris.extend(self.visible_uris(&entry_uri));
            }
        }
        let suppress_undefined_diagnostics = uri_path_ends_with(uri, ".h")
            || self.is_textually_included_file(uri)
            || !self.dependencies_fully_resolved(uri)
            || file.calls.iter().any(|call| {
                file.macros.iter().any(|definition| {
                    definition.function_like
                        && definition.name == call.name
                        && definition.selection.start <= call.range.start
                        && call.range.start < definition.active_until
                })
            });
        let mut diagnostics = file.diagnostics.clone();
        diagnostics.extend(file_name_diagnostics(uri));
        if self.type_checking_enabled == Some(false) {
            diagnostics.retain(|diagnostic| diagnostic.code != "lpc.typeMismatch");
        }
        if !self.enforce_local_variable_declaration_at_block_start {
            diagnostics.retain(|diagnostic| diagnostic.code != "localVariableDeclarationPosition");
        }
        for symbol in file.symbols.iter().filter(|symbol| {
            symbol.local
                && !symbol.name.starts_with('_')
                && symbol.check_unused
                && (symbol.kind == SymbolKind::Variable
                    || (self.unused_parameter_check_enabled
                        && symbol.kind == SymbolKind::Parameter))
                && (symbol.kind != SymbolKind::Parameter || symbol.has_body)
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
                let (code, message) = if symbol.kind == SymbolKind::Parameter {
                    ("unusedParam", format!("未使用的参数: {}", symbol.name))
                } else {
                    ("unusedVar", format!("局部变量 '{}' 未被使用", symbol.name))
                };
                diagnostics.push(Diagnostic {
                    range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    severity: if symbol.kind == SymbolKind::Parameter {
                        4
                    } else {
                        2
                    },
                    code,
                    source: "lpc-support",
                    message,
                });
            }
        }
        if self.unused_global_var_check_enabled && !uri.to_ascii_lowercase().ends_with(".h") {
            for symbol in file.symbols.iter().filter(|symbol| {
                !symbol.local
                    && !symbol.name.starts_with('_')
                    && symbol.kind == SymbolKind::Variable
            }) {
                let reference_count = file
                    .identifiers
                    .iter()
                    .filter(|range| file.source.get((*range).clone()) == Some(symbol.name.as_str()))
                    .count();
                if reference_count <= 1 {
                    diagnostics.push(Diagnostic {
                        range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                        severity: 4,
                        code: "unusedGlobalVar",
                        source: "lpc-support",
                        message: format!("全局变量 '{}' 未被使用", symbol.name),
                    });
                }
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
            let known_non_callable_symbol = self
                .files
                .iter()
                .filter(|(candidate_uri, _)| known_symbol_uris.contains(candidate_uri.as_str()))
                .flat_map(|(_, candidate)| candidate.symbols.iter())
                .any(|symbol| symbol.name == call.name);
            let known_macro = self
                .resolve_macro_definition(uri, &call.name, call.range.start)
                .is_some()
                || self.predefined_macros.contains_key(&call.name);
            if signatures.is_empty()
                && external_signatures.is_empty()
                && !known_non_callable_symbol
                && !known_macro
                && !is_known_lpc_name(&call.name)
                && !suppress_undefined_diagnostics
            {
                diagnostics.push(Diagnostic {
                    range: byte_range_to_lsp(&file.source, call.range.clone()),
                    severity: 2,
                    code: "lpc.undefinedFunction",
                    source: "lpc-support",
                    message: format!("未定义函数: {}", call.name),
                });
                continue;
            }
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
        if !suppress_undefined_diagnostics {
            let known_nonlocal_names = known_symbol_uris
                .iter()
                .filter_map(|candidate_uri| self.files.get(candidate_uri))
                .flat_map(|candidate| candidate.symbols.iter())
                .filter(|symbol| !symbol.local)
                .map(|symbol| symbol.name.as_str())
                .collect::<HashSet<_>>();
            for reference in &file.value_references {
                if file.calls.iter().any(|call| call.range == *reference) {
                    continue;
                }
                let Some(name) = file.source.get(reference.clone()) else {
                    continue;
                };
                let known_workspace_macro = self
                    .dependency_graph()
                    .macro_locations
                    .get(name)
                    .is_some_and(|locations| {
                        locations
                            .iter()
                            .any(|(macro_uri, _)| uri_path_ends_with(macro_uri, ".h"))
                    });
                if is_known_lpc_name(name)
                    || is_fluffos_predefined_macro(name)
                    || self.external_functions.contains_key(name)
                    || known_nonlocal_names.contains(name)
                    || !resolved_symbols(file, name, reference.start).is_empty()
                    || self
                        .resolve_macro_definition(uri, name, reference.start)
                        .is_some()
                    || self.predefined_macros.contains_key(name)
                    || (known_workspace_macro
                        && !self.macro_is_locally_undefined(uri, name, reference.start))
                {
                    continue;
                }
                diagnostics.push(Diagnostic {
                    range: byte_range_to_lsp(&file.source, reference.clone()),
                    severity: 2,
                    code: "lpc.undefinedSymbol",
                    source: "lpc-support",
                    message: format!("未定义符号: {name}"),
                });
            }
        }
        diagnostics
    }

    fn dependencies_fully_resolved(&self, origin_uri: &str) -> bool {
        let mut roots = vec![origin_uri.to_owned()];
        for path in &self.simulated_efun_files {
            let targets = self.path_target_uris(origin_uri, path);
            if targets.is_empty() {
                return false;
            }
            roots.extend(targets);
        }
        let mut visiting = HashSet::new();
        roots
            .iter()
            .all(|uri| self.file_dependencies_fully_resolved(uri, &mut visiting))
    }

    fn is_textually_included_file(&self, uri: &str) -> bool {
        let graph = self.dependency_graph();
        graph.reverse.get(uri).is_some_and(|consumers| {
            consumers.iter().any(|consumer| {
                !graph
                    .inherit_forward
                    .get(consumer)
                    .is_some_and(|inherited| inherited.contains(uri))
            })
        })
    }

    fn file_dependencies_fully_resolved(&self, uri: &str, visiting: &mut HashSet<String>) -> bool {
        if let Some(resolved) = self.dependency_resolution_cache.borrow().get(uri) {
            return *resolved;
        }
        if !visiting.insert(uri.to_owned()) {
            return true;
        }
        let resolved = self.files.get(uri).is_some_and(|file| {
            file.dependencies
                .iter()
                .chain(&self.global_includes)
                .all(|dependency| {
                    let resolved_path = self
                        .resolve_path_token(dependency)
                        .unwrap_or_else(|| dependency.clone());
                    let targets = self.path_target_uris(uri, &resolved_path);
                    !targets.is_empty()
                        && targets
                            .iter()
                            .all(|target| self.file_dependencies_fully_resolved(target, visiting))
                })
        });
        visiting.remove(uri);
        self.dependency_resolution_cache
            .borrow_mut()
            .insert(uri.to_owned(), resolved);
        resolved
    }

    pub fn document_variables(&mut self, uri: &str) -> Vec<VariableEntry> {
        self.metrics.query_count += 1;
        let Some(file) = self.files.get(uri) else {
            return Vec::new();
        };
        file.symbols
            .iter()
            .filter(|symbol| matches!(symbol.kind, SymbolKind::Variable | SymbolKind::Parameter))
            .filter(|symbol| symbol.kind != SymbolKind::Parameter || symbol.has_body)
            .map(|symbol| {
                let reference_count = file
                    .identifiers
                    .iter()
                    .filter(|range| {
                        symbol.scope.contains(&range.start)
                            && file.source.get((*range).clone()) == Some(symbol.name.as_str())
                    })
                    .count();
                VariableEntry {
                    name: symbol.name.clone(),
                    detail: symbol.detail.clone(),
                    range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    local: symbol.local,
                    unused: symbol.local
                        && symbol.check_unused
                        && symbol.kind == SymbolKind::Variable
                        && !symbol.name.starts_with('_')
                        && reference_count <= 1,
                }
            })
            .collect()
    }

    pub fn macro_generated_document_symbols(&mut self, uri: &str) -> Vec<GeneratedDocumentSymbol> {
        self.metrics.query_count += 1;
        let Some(file) = self.files.get(uri) else {
            return Vec::new();
        };
        file.symbols
            .iter()
            .filter(|symbol| file.macro_generated_symbols.contains(&symbol.name))
            .map(|symbol| GeneratedDocumentSymbol {
                name: symbol.name.clone(),
                kind: match symbol.kind {
                    SymbolKind::Function => 12,
                    SymbolKind::Variable => 13,
                    SymbolKind::Type => 5,
                    SymbolKind::Parameter => 13,
                },
                range: byte_range_to_lsp(&file.source, symbol.declaration.clone()),
                selection_range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
            })
            .collect()
    }

    pub fn enclosing_function(&mut self, uri: &str, position: Position) -> Option<FunctionRange> {
        self.metrics.query_count += 1;
        let file = self.files.get(uri)?;
        let offset = lsp_position_to_byte(&file.source, position)?;
        let symbol = file
            .symbols
            .iter()
            .filter(|symbol| symbol.kind == SymbolKind::Function && symbol.has_body)
            .filter(|symbol| symbol.declaration.contains(&offset))
            .min_by_key(|symbol| {
                symbol
                    .declaration
                    .end
                    .saturating_sub(symbol.declaration.start)
            })?;
        Some(FunctionRange {
            name: symbol.name.clone(),
            range: byte_range_to_lsp(&file.source, symbol.declaration.clone()),
        })
    }

    pub fn function_documentation_lookup(
        &mut self,
        uri: &str,
    ) -> Option<FunctionDocumentationLookup> {
        self.metrics.query_count += 1;
        let current_file = self.function_documentation_group(uri, "local", 0, None)?;
        let (forward, inherit_forward) = {
            let graph = self.dependency_graph();
            (graph.forward.clone(), graph.inherit_forward.clone())
        };
        let inherited_groups = self
            .documentation_dependencies(uri, &forward, &inherit_forward, true)
            .into_iter()
            .filter_map(|(target, depth, parent)| {
                self.function_documentation_group(&target, "inherit", depth, Some(parent))
            })
            .collect();
        let include_groups = self
            .documentation_dependencies(uri, &forward, &inherit_forward, false)
            .into_iter()
            .filter_map(|(target, depth, parent)| {
                self.function_documentation_group(&target, "include", depth, Some(parent))
            })
            .collect();
        Some(FunctionDocumentationLookup {
            current_file,
            inherited_groups,
            include_groups,
        })
    }

    fn function_documentation_group(
        &self,
        uri: &str,
        source_kind: &'static str,
        depth: usize,
        parent_uri: Option<String>,
    ) -> Option<FunctionDocumentationGroup> {
        let file = self.files.get(uri)?;
        let entries = file
            .symbols
            .iter()
            .filter(|symbol| symbol.kind == SymbolKind::Function && !symbol.local)
            .map(|symbol| {
                let (documentation, documentation_range) = symbol
                    .documentation
                    .as_ref()
                    .and_then(|_| {
                        leading_doc_comment_with_range(&file.source, symbol.declaration.start)
                    })
                    .map(|(comment, range)| {
                        (
                            Some(comment.to_owned()),
                            Some(byte_range_to_lsp(&file.source, range)),
                        )
                    })
                    .unwrap_or((None, None));
                FunctionDocumentationEntry {
                    name: symbol.name.clone(),
                    signature: symbol.detail.clone(),
                    parameters: symbol.parameters.clone(),
                    documentation,
                    documentation_range,
                    structured_documentation: symbol.documentation.clone(),
                    return_objects: symbol.return_objects.clone(),
                    range: byte_range_to_lsp(&file.source, symbol.declaration.clone()),
                    selection_range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    has_body: symbol.has_body,
                }
            })
            .collect();
        Some(FunctionDocumentationGroup {
            uri: uri.to_owned(),
            source_kind,
            depth,
            parent_uri,
            entries,
        })
    }

    fn documentation_dependencies(
        &self,
        origin: &str,
        forward: &HashMap<String, HashSet<String>>,
        inherit_forward: &HashMap<String, HashSet<String>>,
        inherits: bool,
    ) -> Vec<(String, usize, String)> {
        let mut visited = HashSet::from([origin.to_owned()]);
        let mut queue = std::collections::VecDeque::from([(origin.to_owned(), 0_usize)]);
        let mut output = Vec::new();
        while let Some((parent, depth)) = queue.pop_front() {
            let mut targets = if inherits {
                inherit_forward.get(&parent).cloned().unwrap_or_default()
            } else {
                let mut includes = forward.get(&parent).cloned().unwrap_or_default();
                if let Some(inherited) = inherit_forward.get(&parent) {
                    includes.retain(|target| !inherited.contains(target));
                }
                includes
            }
            .into_iter()
            .collect::<Vec<_>>();
            targets.sort();
            for target in targets {
                if !visited.insert(target.clone()) {
                    continue;
                }
                output.push((target.clone(), depth + 1, parent.clone()));
                queue.push_back((target, depth + 1));
            }
        }
        output
    }

    pub fn workspace_diagnostics(&mut self, uri_prefix: &str) -> Vec<WorkspaceDiagnosticsEntry> {
        let uris = self
            .files
            .keys()
            .filter(|uri| uri.starts_with(uri_prefix))
            .cloned()
            .collect::<Vec<_>>();
        uris.into_iter()
            .filter_map(|uri| {
                let diagnostics = self.diagnostics(&uri);
                (!diagnostics.is_empty()).then_some(WorkspaceDiagnosticsEntry { uri, diagnostics })
            })
            .collect()
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
            if valid_identifier(&path)
                && let Some(range) = identifier_range(origin, offset)
                && origin.source.get(range.clone()) == Some(path.as_str())
                && let Some((macro_uri, macro_file, definition)) =
                    self.resolve_macro_definition(uri, &path, offset)
            {
                return vec![Location {
                    uri: macro_uri.to_owned(),
                    range: byte_range_to_lsp(&macro_file.source, definition.selection.clone()),
                }];
            }
            if self.macro_is_locally_undefined(uri, &path, offset) {
                return Vec::new();
            }
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
        if let Some((macro_uri, macro_file, definition)) =
            self.resolve_macro_reference_definition(uri, &name, offset)
        {
            return vec![Location {
                uri: macro_uri.to_owned(),
                range: byte_range_to_lsp(&macro_file.source, definition.selection.clone()),
            }];
        }
        if self.macro_is_locally_undefined(uri, &name, offset) {
            return Vec::new();
        }
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

        if self.external_functions.contains_key(&name)
            && !self.search_efun_definition_in_inheritance_chain
        {
            return Vec::new();
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
        if let Some((macro_uri, macro_file, definition)) =
            self.resolve_macro_reference_definition(uri, &name, offset)
        {
            let parameters = if definition.function_like {
                format!("({})", definition.parameters.join(", "))
            } else {
                String::new()
            };
            let documentation = definition.documentation.as_deref().unwrap_or_default();
            let definition_line =
                byte_range_to_lsp(&macro_file.source, definition.selection.clone())
                    .start
                    .line
                    + 1;
            return Some(HoverResult {
                contents: format!(
                    "```lpc\n#define {}{} {}\n```{}\n\nDefined in [source]({macro_uri}#L{definition_line})",
                    definition.name,
                    parameters,
                    definition.value,
                    if documentation.is_empty() {
                        String::new()
                    } else {
                        format!("\n\n{documentation}")
                    }
                ),
                range: byte_range_to_lsp(&file.source, identifier),
            });
        }
        if self.macro_is_available_at(uri, &name, offset)
            && let Some(value) = self.predefined_macros.get(&name)
        {
            return Some(HoverResult {
                contents: format!(
                    "```lpc\n#define {name} {value}\n```\n\nWorkspace predefined macro"
                ),
                range: byte_range_to_lsp(&file.source, identifier),
            });
        }
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
            let documentation = function_documentation(target, symbol);
            return Some(HoverResult {
                contents: match documentation {
                    Some(documentation) => {
                        format!(
                            "```lpc\n{}\n```\n\n{}",
                            symbol.detail,
                            documentation.render_markdown()
                        )
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
            .flat_map(|(_, candidate)| {
                candidate
                    .symbols
                    .iter()
                    .map(move |symbol| (candidate, symbol))
            })
            .filter(|(_, symbol)| symbol.name == name && !symbol.local)
            .collect::<Vec<_>>();
        if workspace_symbols.is_empty() {
            workspace_symbols = self
                .files
                .values()
                .flat_map(|candidate| {
                    candidate
                        .symbols
                        .iter()
                        .map(move |symbol| (candidate, symbol))
                })
                .filter(|(_, symbol)| symbol.name == name && !symbol.local)
                .collect();
        }
        let callable = symbols
            .first()
            .copied()
            .map(|symbol| (file, symbol))
            .or_else(|| (workspace_symbols.len() == 1).then(|| workspace_symbols[0]));
        if let Some((defining_file, symbol)) = callable {
            let documentation = function_documentation(defining_file, symbol);
            return Some(HoverResult {
                contents: match documentation {
                    Some(documentation) => {
                        format!(
                            "```lpc\n{}\n```\n\n{}",
                            symbol.detail,
                            documentation.render_markdown()
                        )
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

        if let Some((target_uri, _, target_definition)) =
            self.resolve_macro_reference_definition(uri, &name, offset)
        {
            let target_uri = target_uri.to_owned();
            let target_selection = target_definition.selection.clone();
            return self.macro_references(
                &name,
                &target_uri,
                &target_selection,
                include_declaration,
            );
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
        if self
            .resolve_macro_reference_definition(uri, name, offset)
            .is_some()
        {
            return Some(byte_range_to_lsp(&file.source, range));
        }
        if self.predefined_macros.contains_key(name) {
            return None;
        }
        let locally_resolved = !resolved_symbols(file, name, offset).is_empty();
        let is_keyword = KEYWORDS.contains(&name);
        let rename_range = byte_range_to_lsp(&file.source, range);
        let uniquely_resolved = locally_resolved || self.definition(uri, position).len() == 1;
        (!is_keyword && uniquely_resolved).then_some(rename_range)
    }

    fn macro_references(
        &self,
        name: &str,
        target_uri: &str,
        target_selection: &std::ops::Range<usize>,
        include_declaration: bool,
    ) -> Vec<Location> {
        let mut references = Vec::new();
        if include_declaration && let Some(target_file) = self.files.get(target_uri) {
            references.push(Location {
                uri: target_uri.to_owned(),
                range: byte_range_to_lsp(&target_file.source, target_selection.clone()),
            });
        }

        for (candidate_uri, file) in &self.files {
            if !file.source.contains(name) {
                continue;
            }
            for range in macro_candidate_ranges(file, name) {
                if candidate_uri == target_uri && range == *target_selection {
                    continue;
                }
                let resolves_to_target = self
                    .resolve_macro_reference_definition(candidate_uri, name, range.start)
                    .is_some_and(|(resolved_uri, _, definition)| {
                        resolved_uri == target_uri && definition.selection == *target_selection
                    });
                if resolves_to_target {
                    references.push(Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, range),
                    });
                }
            }
        }

        references.sort_by(|left, right| {
            left.uri
                .cmp(&right.uri)
                .then(left.range.start.line.cmp(&right.range.start.line))
                .then(left.range.start.character.cmp(&right.range.start.character))
        });
        references.dedup();
        references
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
                signatures: vec![signature_information_from_symbol(target, symbol)],
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
                .flat_map(|(_, target)| {
                    preferred_function_symbols(target, &name)
                        .into_iter()
                        .map(move |symbol| (target, symbol))
                })
                .map(|(target, symbol)| SignatureInformation {
                    label: symbol.detail.clone(),
                    documentation: function_documentation(target, symbol)
                        .map(CallableDocumentation::render_markdown),
                    parameters: symbol
                        .parameters
                        .iter()
                        .map(|label| {
                            parameter_information_from_symbol(
                                symbol,
                                function_documentation(target, symbol),
                                label,
                            )
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
            .find(|symbol| symbol.kind == SymbolKind::Function && symbol.name == name)
            .map(|symbol| (file, symbol));
        let visible = self.visible_uris(uri);
        let mut workspace_symbols = self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(_, candidate)| {
                candidate
                    .symbols
                    .iter()
                    .map(move |symbol| (candidate, symbol))
            })
            .filter(|(_, symbol)| symbol.kind == SymbolKind::Function && symbol.name == name)
            .collect::<Vec<_>>();
        if workspace_symbols.is_empty() {
            workspace_symbols = self
                .files
                .values()
                .flat_map(|candidate| {
                    candidate
                        .symbols
                        .iter()
                        .map(move |symbol| (candidate, symbol))
                })
                .filter(|(_, symbol)| symbol.kind == SymbolKind::Function && symbol.name == name)
                .collect();
        }
        let callable =
            local_symbol.or_else(|| (workspace_symbols.len() == 1).then(|| workspace_symbols[0]));
        let signatures = if let Some((defining_file, symbol)) = callable {
            vec![signature_information_from_symbol(defining_file, symbol)]
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
                            documentation: None,
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
            return self.directive_completion_candidates(
                uri,
                completion_offset.unwrap_or_default(),
                context,
                &prefix,
            );
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
                .flat_map(|(_, file)| file.symbols.iter().map(move |symbol| (file, symbol)))
                .filter(|(_, symbol)| {
                    !symbol.local
                        && symbol.kind == SymbolKind::Function
                        && (normalized_prefix.is_empty()
                            || symbol
                                .name
                                .to_ascii_lowercase()
                                .starts_with(&normalized_prefix))
                })
                .map(|(file, symbol)| completion_from_symbol_in_file(file, symbol))
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
                candidates.insert(
                    symbol.name.clone(),
                    completion_from_symbol_in_file(file, symbol),
                );
            }
        }
        let visible = self.visible_uris(uri);
        for (file, symbol) in self
            .files
            .iter()
            .filter(|(candidate_uri, _)| visible.contains(candidate_uri.as_str()))
            .flat_map(|(_, file)| file.symbols.iter().map(move |symbol| (file, symbol)))
            .filter(|(_, symbol)| !symbol.local)
        {
            candidates
                .entry(symbol.name.clone())
                .or_insert_with(|| completion_from_symbol_in_file(file, symbol));
        }
        for function in self.external_functions.values() {
            candidates
                .entry(function.name.clone())
                .or_insert_with(|| completion_from_external_function(function));
        }
        let macro_offset = completion_offset.unwrap_or_default();
        for definition in self
            .workspace_macro_definitions(uri)
            .into_iter()
            .filter(|definition| self.macro_is_available_at(uri, &definition.name, macro_offset))
        {
            candidates
                .entry(definition.name.clone())
                .or_insert_with(|| completion_from_macro(definition));
        }
        for (name, value) in self
            .predefined_macros
            .iter()
            .filter(|(name, _)| self.macro_is_available_at(uri, name, macro_offset))
        {
            candidates
                .entry(name.clone())
                .or_insert_with(|| completion_from_predefined_macro(name, value));
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

    fn external_macro_names(&self, uri: &str) -> HashSet<String> {
        let visible = self.visible_uris(uri);
        let locations = {
            let graph = self.dependency_graph();
            graph
                .macro_locations
                .values()
                .flatten()
                .filter(|(candidate_uri, _)| {
                    candidate_uri != uri && visible.contains(candidate_uri)
                })
                .cloned()
                .collect::<Vec<_>>()
        };
        let mut names = locations
            .into_iter()
            .filter_map(|(candidate_uri, index)| {
                let file = self.files.get(&candidate_uri)?;
                file.macros
                    .get(index)
                    .filter(|definition| definition.active_until == file.source.len())
                    .map(|definition| definition.name.clone())
            })
            .collect::<HashSet<_>>();
        names.extend(self.predefined_macros.keys().cloned());
        names
    }

    fn local_macro_scopes(&self, uri: &str) -> HashMap<String, Vec<std::ops::Range<usize>>> {
        let Some(file) = self.files.get(uri) else {
            return HashMap::new();
        };
        if file.macro_directives.is_empty() {
            return file.macros.iter().fold(
                HashMap::<String, Vec<std::ops::Range<usize>>>::new(),
                |mut scopes, definition| {
                    scopes
                        .entry(definition.name.clone())
                        .or_default()
                        .push(definition.selection.start..definition.active_until);
                    scopes
                },
            );
        }
        let affected = file
            .macro_directives
            .iter()
            .map(|fact| fact.name.clone())
            .collect::<HashSet<_>>();
        let mut active = affected
            .iter()
            .filter(|name| {
                file.initial_macro_hashes
                    .binary_search(&macro_name_hash(name))
                    .is_ok()
            })
            .map(|name| (name.clone(), 0_usize))
            .collect::<HashMap<_, _>>();
        let mut scopes = HashMap::<String, Vec<std::ops::Range<usize>>>::new();
        for fact in &file.macro_directives {
            if let Some(start) = active.remove(&fact.name) {
                scopes
                    .entry(fact.name.clone())
                    .or_default()
                    .push(start..fact.range.start_byte);
            }
            if fact.kind == MacroDirectiveKind::Define {
                active.insert(fact.name.clone(), fact.range.start_byte);
            }
        }
        for (name, start) in active {
            scopes
                .entry(name)
                .or_default()
                .push(start..file.source.len());
        }
        for name in affected {
            scopes.entry(name).or_default();
        }
        scopes
    }

    fn macro_is_locally_undefined(&self, uri: &str, name: &str, offset: usize) -> bool {
        self.files
            .get(uri)
            .and_then(|file| {
                file.macro_directives
                    .iter()
                    .rfind(|fact| fact.name == name && fact.range.start_byte <= offset)
            })
            .is_some_and(|fact| fact.kind == MacroDirectiveKind::Undef)
    }

    fn macro_is_available_at(&self, uri: &str, name: &str, offset: usize) -> bool {
        let Some(file) = self.files.get(uri) else {
            return false;
        };
        if !file.macro_tracking_precise {
            return !self.macro_is_locally_undefined(uri, name, offset);
        }
        file.macro_directives
            .iter()
            .rfind(|fact| fact.name == name && fact.range.start_byte <= offset)
            .map_or_else(
                || {
                    file.initial_macro_hashes
                        .binary_search(&macro_name_hash(name))
                        .is_ok()
                        || self.predefined_macros.contains_key(name)
                },
                |fact| fact.kind == MacroDirectiveKind::Define,
            )
    }

    fn workspace_macro_definitions(&self, uri: &str) -> Vec<&MacroDefinition> {
        let visible = self.visible_uris(uri);
        let locations = {
            let graph = self.dependency_graph();
            graph
                .macro_locations
                .values()
                .flatten()
                .filter(|(candidate_uri, _)| visible.contains(candidate_uri))
                .cloned()
                .collect::<Vec<_>>()
        };
        locations
            .into_iter()
            .filter_map(|(candidate_uri, index)| {
                let file = self.files.get(&candidate_uri)?;
                file.macros
                    .get(index)
                    .filter(|definition| definition.active_until == file.source.len())
            })
            .collect()
    }

    fn resolve_macro_reference_definition<'a>(
        &'a self,
        uri: &str,
        name: &str,
        offset: usize,
    ) -> Option<(&'a str, &'a FileAnalysis, &'a MacroDefinition)> {
        if let resolved @ Some(_) = self.resolve_macro_definition(uri, name, offset) {
            return resolved;
        }
        let file = self.files.get(uri)?;
        let range = identifier_range(file, offset)?;
        let is_undef = file.macro_directives.iter().any(|fact| {
            fact.kind == MacroDirectiveKind::Undef
                && fact.name == name
                && fact.range.start_byte == range.start
                && fact.range.end_byte == range.end
        });
        is_undef
            .then(|| range.start.saturating_sub(1))
            .and_then(|previous_offset| self.resolve_macro_definition(uri, name, previous_offset))
    }

    fn resolve_macro_definition<'a>(
        &'a self,
        uri: &str,
        name: &str,
        offset: usize,
    ) -> Option<(&'a str, &'a FileAnalysis, &'a MacroDefinition)> {
        let (origin_uri, origin) = self.files.get_key_value(uri)?;
        if let Some(definition) = origin.macros.iter().rfind(|definition| {
            definition.name == name
                && definition.selection.start <= offset
                && offset < definition.active_until
        }) {
            return Some((origin_uri.as_str(), origin, definition));
        }
        if self.macro_is_locally_undefined(uri, name, offset) {
            return None;
        }

        let locations = {
            let graph = self.dependency_graph();
            graph.macro_locations.get(name).cloned().unwrap_or_default()
        };
        let visible = self.visible_uris(uri);
        if !self.macro_is_available_at(uri, name, offset) {
            return None;
        }
        let mut candidates = locations
            .iter()
            .filter(|(candidate_uri, _)| candidate_uri != uri && visible.contains(candidate_uri))
            .filter_map(|(candidate_uri, index)| {
                let (stored_uri, file) = self.files.get_key_value(candidate_uri)?;
                let definition = file
                    .macros
                    .get(*index)
                    .filter(|definition| definition.active_until == file.source.len())?;
                Some((stored_uri.as_str(), file, definition))
            })
            .collect::<Vec<_>>();
        if candidates.len() == 1 {
            return candidates.pop();
        }
        None
    }

    fn invalidate_dependency_graph(&self) {
        *self.dependency_graph.borrow_mut() = None;
        self.dependency_resolution_cache.borrow_mut().clear();
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
            for (candidate_uri, file) in &self.files {
                for (index, definition) in file.macros.iter().enumerate() {
                    graph
                        .macro_locations
                        .entry(definition.name.clone())
                        .or_default()
                        .push((candidate_uri.clone(), index));
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
                return self
                    .resolve_string_candidates(uri, argument, offset, budget.saturating_sub(1))
                    .iter()
                    .flat_map(|path| self.path_target_uris(uri, path))
                    .collect();
            }
        }
        if let Some((receiver, argument)) = model_get_call(expression) {
            let registry_targets =
                self.resolve_object_expression(uri, receiver, offset, budget.saturating_sub(1));
            let keys =
                self.resolve_string_candidates(uri, argument, offset, budget.saturating_sub(1));
            return registry_targets
                .iter()
                .filter_map(|target_uri| self.files.get(target_uri))
                .flat_map(|target| {
                    keys.iter()
                        .filter_map(|key| model_registry_path(&target.source, key))
                })
                .flat_map(|path| self.path_target_uris(uri, &path))
                .collect();
        }
        if let Some((collection, index)) = indexed_expression(expression) {
            return self.resolve_indexed_object_expression(
                uri,
                collection,
                index,
                offset,
                budget.saturating_sub(1),
            );
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
                                &HashSet::new(),
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
            let first_string_arguments = call_first_argument(expression, function_name)
                .map(|argument| {
                    self.resolve_string_candidates(uri, argument, offset, budget.saturating_sub(1))
                })
                .unwrap_or_default();
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
                                &first_string_arguments,
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

    fn resolve_indexed_object_expression(
        &self,
        uri: &str,
        collection: &str,
        index: &str,
        offset: usize,
        budget: usize,
    ) -> HashSet<String> {
        if budget == 0 {
            return HashSet::new();
        }
        let collection = strip_outer_parentheses(collection.trim());
        let resolve_values = |values: Vec<(&str, usize)>| -> HashSet<String> {
            values
                .into_iter()
                .flat_map(|(value, value_offset)| {
                    collection_values_at(value, index)
                        .into_iter()
                        .flat_map(move |selected| {
                            self.resolve_object_expression(
                                uri,
                                selected,
                                value_offset,
                                budget.saturating_sub(1),
                            )
                        })
                })
                .collect()
        };
        let direct = collection_values_at(collection, index);
        if !direct.is_empty() {
            return direct
                .into_iter()
                .flat_map(|selected| {
                    self.resolve_object_expression(uri, selected, offset, budget.saturating_sub(1))
                })
                .collect();
        }
        if valid_identifier(collection)
            && let Some(file) = self.files.get(uri)
            && let Some(symbol) = resolved_symbols(file, collection, offset).first()
        {
            let mut targets = resolve_values(symbol_value_expressions(file, symbol, offset));
            targets.extend(
                indexed_assignment_values(file, symbol, index, offset)
                    .into_iter()
                    .flat_map(|(value, value_offset)| {
                        self.resolve_object_expression(
                            uri,
                            value,
                            value_offset,
                            budget.saturating_sub(1),
                        )
                    }),
            );
            return targets;
        }
        if let Some((parent_collection, parent_index)) = indexed_expression(collection)
            && valid_identifier(parent_collection)
            && let Some(file) = self.files.get(uri)
            && let Some(symbol) = resolved_symbols(file, parent_collection, offset).first()
        {
            let mut values = symbol_value_expressions(file, symbol, offset);
            values.extend(indexed_assignment_values(
                file,
                symbol,
                parent_index,
                offset,
            ));
            return values
                .into_iter()
                .flat_map(|(parent_value, value_offset)| {
                    collection_values_at(parent_value, parent_index)
                        .into_iter()
                        .flat_map(move |nested_collection| {
                            collection_values_at(nested_collection, index)
                                .into_iter()
                                .flat_map(move |selected| {
                                    self.resolve_object_expression(
                                        uri,
                                        selected,
                                        value_offset,
                                        budget.saturating_sub(1),
                                    )
                                })
                        })
                })
                .collect();
        }
        if let Some(function_name) = direct_call_name(collection) {
            let visible = self.visible_uris(uri);
            let mut targets = HashSet::new();
            for (candidate_uri, file) in &self.files {
                if !visible.contains(candidate_uri.as_str()) {
                    continue;
                }
                for symbol in file.symbols.iter().filter(|symbol| {
                    !symbol.local
                        && symbol.kind == SymbolKind::Function
                        && symbol.name == function_name
                }) {
                    let values = symbol
                        .return_expressions
                        .iter()
                        .filter_map(|returned| {
                            file.source
                                .get(returned.range.clone())
                                .map(|value| (value, returned.range.start))
                        })
                        .collect();
                    targets.extend(resolve_values(values));
                }
            }
            return targets;
        }
        HashSet::new()
    }

    fn function_return_targets(
        &self,
        defining_uri: &str,
        symbol: &Symbol,
        budget: usize,
        first_string_arguments: &HashSet<String>,
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
            if let Some(parameter) = first_parameter
                && !first_string_arguments.is_empty()
            {
                for argument in first_string_arguments {
                    targets.extend(self.resolve_bound_return_expression(
                        defining_uri,
                        source,
                        expression.range.start,
                        budget.saturating_sub(1),
                        parameter,
                        argument,
                    ));
                }
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

    fn resolve_string_candidates(
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
        if let Some(value) = quoted_string(expression) {
            return HashSet::from([value.to_owned()]);
        }
        if let Some(elements) = array_literal_elements(expression) {
            return elements
                .into_iter()
                .flat_map(|element| {
                    self.resolve_string_candidates(uri, element, offset, budget.saturating_sub(1))
                })
                .collect();
        }
        if let Some(function_name) = direct_call_name(expression) {
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
                            symbol.return_expressions.iter().flat_map(|returned| {
                                file.source
                                    .get(returned.range.clone())
                                    .into_iter()
                                    .flat_map(|source| {
                                        self.resolve_string_candidates(
                                            candidate_uri,
                                            source,
                                            returned.range.start,
                                            budget.saturating_sub(1),
                                        )
                                    })
                            })
                        })
                })
                .collect();
        }
        if !valid_identifier(expression) {
            return HashSet::new();
        }
        if let Some(value) = self.resolve_path_token(expression) {
            return HashSet::from([value]);
        }
        let Some(file) = self.files.get(uri) else {
            return HashSet::new();
        };
        let Some(symbol) = resolved_symbols(file, expression, offset)
            .into_iter()
            .next()
        else {
            return HashSet::new();
        };
        symbol_value_expressions(file, symbol, offset)
            .into_iter()
            .chain(symbol.value_expressions.iter().filter_map(|value| {
                file.source
                    .get(value.range.clone())
                    .map(|source| (source, value.range.start))
            }))
            .flat_map(|(value, value_offset)| {
                self.resolve_string_candidates(uri, value, value_offset, budget.saturating_sub(1))
            })
            .collect()
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
            .flat_map(|(_, file)| file.symbols.iter().map(move |symbol| (file, symbol)))
            .filter(|(_, symbol)| {
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
            left.1
                .name
                .cmp(&right.1.name)
                .then_with(|| right.1.has_body.cmp(&left.1.has_body))
                .then_with(|| {
                    function_documentation(right.0, right.1)
                        .is_some()
                        .cmp(&function_documentation(left.0, left.1).is_some())
                })
        });
        let mut candidates = symbols
            .into_iter()
            .map(|(file, symbol)| completion_from_symbol_in_file(file, symbol))
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
        render_function_symbol_hover(
            self.files
                .iter()
                .filter(|(candidate_uri, _)| targets.contains(candidate_uri.as_str()))
                .flat_map(|(_, file)| {
                    preferred_function_symbols(file, member_name)
                        .into_iter()
                        .map(move |symbol| (symbol, function_documentation(file, symbol)))
                }),
        )
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
        uri: &str,
        offset: usize,
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
        let macros = if matches!(
            context,
            DirectiveCompletionContext::PreprocessorExpression
                | DirectiveCompletionContext::IncludePath
                | DirectiveCompletionContext::InheritPath
        ) {
            let path_only = matches!(
                context,
                DirectiveCompletionContext::IncludePath | DirectiveCompletionContext::InheritPath
            );
            let mut macros = self
                .workspace_macro_definitions(uri)
                .into_iter()
                .filter(|definition| {
                    self.macro_is_available_at(uri, &definition.name, offset)
                        && (!path_only || definition.value.trim_start().starts_with('"'))
                })
                .map(|definition| (definition.name.clone(), definition.value.clone()))
                .collect::<HashMap<_, _>>();
            macros.extend(
                self.predefined_macros
                    .iter()
                    .filter(|(name, value)| {
                        self.macro_is_available_at(uri, name, offset)
                            && (!path_only || value.trim_start().starts_with('"'))
                    })
                    .map(|(name, value)| (name.clone(), value.clone())),
            );
            macros
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documentation: Option<String>,
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
        documentation: symbol
            .documentation
            .as_ref()
            .map(CallableDocumentation::render_markdown),
        insert_text_format: insert_text.as_ref().map(|_| 2),
        insert_text,
    }
}

fn completion_from_symbol_in_file(file: &FileAnalysis, symbol: &Symbol) -> CompletionCandidate {
    let mut candidate = completion_from_symbol(symbol);
    candidate.documentation =
        function_documentation(file, symbol).map(CallableDocumentation::render_markdown);
    candidate
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

fn completion_from_macro(definition: &MacroDefinition) -> CompletionCandidate {
    let insert_text = definition
        .function_like
        .then(|| function_snippet(&definition.name, &definition.parameters));
    CompletionCandidate {
        label: definition.name.clone(),
        kind: 21,
        detail: Some(format!("#define {}", definition.value)),
        documentation: definition.documentation.clone(),
        insert_text_format: insert_text.as_ref().map(|_| 2),
        insert_text,
    }
}

fn completion_from_predefined_macro(name: &str, value: &str) -> CompletionCandidate {
    CompletionCandidate {
        label: name.to_owned(),
        kind: 21,
        detail: Some(format!("#define {value}")),
        documentation: Some("Workspace predefined macro".to_owned()),
        insert_text_format: None,
        insert_text: None,
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

fn collect_dependencies(
    root: Node<'_>,
    source: &str,
    active_includes: Option<&[IncludeFact]>,
) -> Vec<String> {
    let mut dependencies = Vec::new();
    collect_syntax_dependencies(root, source, &mut dependencies);
    if let Some(active_includes) = active_includes {
        dependencies.extend(active_includes.iter().map(|include| include.path.clone()));
    } else {
        collect_raw_include_dependencies(source, &mut dependencies);
    }
    dependencies.sort();
    dependencies.dedup();
    dependencies
}

fn collect_raw_include_dependencies(source: &str, dependencies: &mut Vec<String>) {
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

fn collect_macro_definitions(
    source: &str,
    macro_directives: Option<&[MacroDirectiveFact]>,
) -> Vec<MacroDefinition> {
    let mut definitions = Vec::new();
    let mut offset = 0_usize;
    let lines = source.split_inclusive('\n').collect::<Vec<_>>();
    let mut index = 0_usize;
    while index < lines.len() {
        let line_offset = offset;
        let line = lines[index];
        let line_without_ending = line.trim_end_matches(['\r', '\n']);
        let leading = line_without_ending.len() - line_without_ending.trim_start().len();
        let trimmed = line_without_ending.trim_start();
        let Some(arguments) = trimmed.strip_prefix("#define").and_then(|rest| {
            rest.chars()
                .next()
                .is_some_and(char::is_whitespace)
                .then(|| rest.trim_start())
        }) else {
            offset += line.len();
            index += 1;
            continue;
        };

        let name_len = arguments
            .char_indices()
            .take_while(|(character_index, character)| {
                if *character_index == 0 {
                    character.is_ascii_alphabetic() || *character == '_'
                } else {
                    character.is_ascii_alphanumeric() || *character == '_'
                }
            })
            .last()
            .map_or(0, |(character_index, character)| {
                character_index + character.len_utf8()
            });
        if name_len == 0 {
            offset += line.len();
            index += 1;
            continue;
        }

        let name = &arguments[..name_len];
        let name_start_in_line = line_without_ending.find(name).unwrap_or(leading);
        let declaration_start = offset + leading;
        let mut logical = trimmed.to_owned();
        while logical.trim_end().ends_with('\\') && index + 1 < lines.len() {
            offset += lines[index].len();
            index += 1;
            let continued = lines[index].trim_end_matches(['\r', '\n']);
            logical.pop();
            logical.push(' ');
            logical.push_str(continued.trim_start());
        }

        let logical_arguments = logical
            .strip_prefix("#define")
            .unwrap_or_default()
            .trim_start();
        let tail = &logical_arguments[name_len.min(logical_arguments.len())..];
        let (function_like, parameters, value) =
            if let Some(parameter_text) = tail.strip_prefix('(') {
                if let Some(close) = parameter_text.find(')') {
                    let parameters = parameter_text[..close]
                        .split(',')
                        .map(str::trim)
                        .filter(|parameter| !parameter.is_empty())
                        .map(str::to_owned)
                        .collect();
                    (
                        true,
                        parameters,
                        parameter_text[close + 1..].trim().to_owned(),
                    )
                } else {
                    (true, Vec::new(), tail.trim().to_owned())
                }
            } else {
                (false, Vec::new(), tail.trim().to_owned())
            };
        definitions.push(MacroDefinition {
            name: name.to_owned(),
            value,
            selection: line_offset + name_start_in_line
                ..line_offset + name_start_in_line + name.len(),
            function_like,
            parameters,
            documentation: leading_macro_documentation(source, declaration_start),
            active_until: source.len(),
        });
        offset += lines[index].len();
        index += 1;
    }
    let Some(macro_directives) = macro_directives else {
        return definitions;
    };
    definitions.retain(|definition| {
        macro_directives.iter().any(|fact| {
            fact.kind == MacroDirectiveKind::Define
                && fact.name == definition.name
                && fact.range.start_byte == definition.selection.start
                && fact.range.end_byte == definition.selection.end
        })
    });
    for fact in macro_directives {
        if let Some(previous) = definitions.iter_mut().rfind(|definition| {
            definition.name == fact.name
                && definition.selection.start < fact.range.start_byte
                && definition.active_until == source.len()
        }) {
            previous.active_until = fact.range.start_byte;
        }
    }
    definitions
}

fn collect_macro_generated_symbols(
    source: &str,
    calls: &[CallSite],
    macros: &[MacroDefinition],
    output: &mut Vec<Symbol>,
) -> HashSet<String> {
    let mut generated_names = HashSet::new();
    let mut parser = None;
    for call in calls.iter().filter(|call| call.top_level) {
        let Some(definition) = macros.iter().rev().find(|definition| {
            definition.function_like
                && definition.name == call.name
                && (definition.selection.is_empty()
                    || definition.selection.start < call.range.start)
                && call.range.start < definition.active_until
        }) else {
            continue;
        };
        let Some((arguments, invocation_range)) = whole_line_macro_arguments(source, call) else {
            continue;
        };
        if arguments.len() != definition.parameters.len() {
            continue;
        }
        let expanded = expand_function_macro(&definition.value, &definition.parameters, &arguments);
        let parser = parser.get_or_insert_with(|| {
            let mut parser = Parser::new();
            parser
                .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
                .expect("generated LPC grammar must load");
            parser
        });
        let Some(tree) = parser.parse(&expanded, None) else {
            continue;
        };
        if tree.root_node().has_error() {
            continue;
        }
        let mut generated = Vec::new();
        collect_symbols(tree.root_node(), &expanded, &mut generated);
        for mut symbol in generated.into_iter().filter(|symbol| !symbol.local) {
            if output
                .iter()
                .any(|existing| existing.kind == symbol.kind && existing.name == symbol.name)
            {
                continue;
            }
            symbol.selection = call.range.clone();
            symbol.declaration = invocation_range.clone();
            symbol.scope = 0..source.len();
            symbol.documentation = None;
            symbol.return_expressions.clear();
            symbol.value_expressions.clear();
            generated_names.insert(symbol.name.clone());
            output.push(symbol);
        }
    }
    generated_names
}

fn macro_definitions_from_environment(
    source_len: usize,
    definitions: &HashMap<String, String>,
    local_directives: &[MacroDirectiveFact],
) -> Vec<MacroDefinition> {
    definitions
        .iter()
        .filter_map(|(name, value)| {
            let parameters_and_body = value.strip_prefix('(')?;
            let close = parameters_and_body.find(')')?;
            let body = parameters_and_body[close + 1..].trim();
            if body.is_empty() {
                return None;
            }
            let parameters = parameters_and_body[..close]
                .split(',')
                .map(str::trim)
                .filter(|parameter| !parameter.is_empty())
                .map(str::to_owned)
                .collect::<Vec<_>>();
            let active_until = local_directives
                .iter()
                .filter(|directive| directive.name == *name)
                .map(|directive| directive.range.start_byte)
                .min()
                .unwrap_or(source_len);
            Some(MacroDefinition {
                name: name.clone(),
                value: body.to_owned(),
                selection: 0..0,
                function_like: true,
                parameters,
                documentation: None,
                active_until,
            })
        })
        .collect()
}

fn macro_definitions_from_directives(
    source_len: usize,
    directives: &[MacroDirectiveFact],
    local_definitions: &[MacroDefinition],
) -> Vec<MacroDefinition> {
    directives
        .iter()
        .enumerate()
        .filter(|(_, directive)| directive.kind == MacroDirectiveKind::Define)
        .filter(|(_, directive)| {
            !local_definitions.iter().any(|definition| {
                definition.name == directive.name
                    && definition.selection.start == directive.range.start_byte
                    && definition.selection.end == directive.range.end_byte
            })
        })
        .filter_map(|(index, directive)| {
            let value = directive.value.as_deref()?;
            let parameters_and_body = value.strip_prefix('(')?;
            let close = parameters_and_body.find(')')?;
            let body = parameters_and_body[close + 1..].trim();
            if body.is_empty() {
                return None;
            }
            let active_until = directives[index + 1..]
                .iter()
                .find(|later| later.name == directive.name)
                .map_or(source_len, |later| later.range.start_byte);
            Some(MacroDefinition {
                name: directive.name.clone(),
                value: body.to_owned(),
                selection: directive.range.start_byte..directive.range.end_byte,
                function_like: true,
                parameters: parameters_and_body[..close]
                    .split(',')
                    .map(str::trim)
                    .filter(|parameter| !parameter.is_empty())
                    .map(str::to_owned)
                    .collect(),
                documentation: None,
                active_until,
            })
        })
        .collect()
}

fn whole_line_macro_arguments(
    source: &str,
    call: &CallSite,
) -> Option<(Vec<String>, std::ops::Range<usize>)> {
    let line_start = source[..call.range.start]
        .rfind('\n')
        .map_or(0, |index| index + 1);
    let line_end = source[call.range.end..]
        .find('\n')
        .map_or(source.len(), |index| call.range.end + index);
    if !source[line_start..call.range.start].trim().is_empty() {
        return None;
    }
    let mut open = call.range.end;
    while source
        .as_bytes()
        .get(open)
        .is_some_and(u8::is_ascii_whitespace)
        && source.as_bytes().get(open) != Some(&b'\n')
    {
        open += 1;
    }
    if source.as_bytes().get(open) != Some(&b'(') {
        return None;
    }
    let close = matching_paren(source, open)?;
    let suffix = source[close + 1..line_end].trim();
    if !suffix.is_empty() && suffix != ";" {
        return None;
    }
    let arguments = split_top_level_commas(&source[open + 1..close])
        .into_iter()
        .map(str::trim)
        .map(str::to_owned)
        .collect();
    Some((arguments, line_start..line_end))
}

fn matching_paren(source: &str, open: usize) -> Option<usize> {
    let mut depth = 0_u32;
    let mut quote = None;
    let mut escaped = false;
    for (relative, character) in source[open..].char_indices() {
        if let Some(active_quote) = quote {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == active_quote {
                quote = None;
            }
            continue;
        }
        match character {
            '"' | '\'' => quote = Some(character),
            '(' => depth += 1,
            ')' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(open + relative);
                }
            }
            _ => {}
        }
    }
    None
}

fn expand_function_macro(body: &str, parameters: &[String], arguments: &[String]) -> String {
    let replacements = parameters
        .iter()
        .zip(arguments)
        .map(|(parameter, argument)| (parameter.as_str(), argument.trim()))
        .collect::<HashMap<_, _>>();
    let mut stringized = String::with_capacity(body.len());
    let bytes = body.as_bytes();
    let mut index = 0_usize;
    while index < bytes.len() {
        if bytes[index] == b'#' && bytes.get(index + 1) == Some(&b'#') {
            stringized.push_str("##");
            index += 2;
            continue;
        }
        if bytes[index] == b'#' {
            let mut cursor = index + 1;
            while bytes.get(cursor).is_some_and(u8::is_ascii_whitespace) {
                cursor += 1;
            }
            let identifier_end = ascii_identifier_end(bytes, cursor);
            if let Some(argument) = body
                .get(cursor..identifier_end)
                .and_then(|parameter| replacements.get(parameter))
            {
                stringized.push('"');
                for character in argument.chars() {
                    if matches!(character, '\\' | '"') {
                        stringized.push('\\');
                    }
                    stringized.push(character);
                }
                stringized.push('"');
                index = identifier_end;
                continue;
            }
        }
        let character = body[index..].chars().next().expect("valid UTF-8 boundary");
        stringized.push(character);
        index += character.len_utf8();
    }

    let bytes = stringized.as_bytes();
    let mut expanded = String::with_capacity(stringized.len());
    let mut index = 0_usize;
    let mut quote = None;
    let mut escaped = false;
    while index < bytes.len() {
        let character = stringized[index..]
            .chars()
            .next()
            .expect("valid UTF-8 boundary");
        if let Some(active_quote) = quote {
            expanded.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == active_quote {
                quote = None;
            }
            index += character.len_utf8();
            continue;
        }
        if matches!(character, '"' | '\'') {
            quote = Some(character);
            expanded.push(character);
            index += character.len_utf8();
            continue;
        }
        if is_ascii_identifier_start(bytes[index]) {
            let end = ascii_identifier_end(bytes, index);
            let identifier = &stringized[index..end];
            expanded.push_str(replacements.get(identifier).copied().unwrap_or(identifier));
            index = end;
            continue;
        }
        expanded.push(character);
        index += character.len_utf8();
    }
    expanded.replace("##", "")
}

fn ascii_identifier_end(bytes: &[u8], start: usize) -> usize {
    if !bytes
        .get(start)
        .is_some_and(|byte| is_ascii_identifier_start(*byte))
    {
        return start;
    }
    let mut end = start + 1;
    while bytes
        .get(end)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        end += 1;
    }
    end
}

fn is_ascii_identifier_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || byte == b'_'
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
                        declaration: node.byte_range(),
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
                        value_expressions: Vec::new(),
                        has_body: false,
                        local: false,
                        check_unused: false,
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
    let parameter_names = node
        .child_by_field_name("parameters")
        .map(|parameters| {
            let mut cursor = parameters.walk();
            parameters
                .named_children(&mut cursor)
                .filter_map(|parameter| parameter.child_by_field_name("name"))
                .map(|name| text(name, source))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let return_expressions = node
        .child_by_field_name("body")
        .map(collect_return_expressions)
        .unwrap_or_default();
    let has_body = node.child_by_field_name("body").is_some();
    let detail = source[node.start_byte()..body_start.min(source.len())]
        .trim()
        .to_owned();
    let return_type = declared_function_return_type(node, source);
    let documentation = leading_callable_documentation(
        source,
        node.start_byte(),
        return_type.as_deref(),
        &parameter_names,
    );
    let return_objects = documentation
        .as_ref()
        .map(|documentation| documentation.return_objects.clone())
        .unwrap_or_default();
    output.push(Symbol {
        name: text(name, source),
        kind: SymbolKind::Function,
        selection: name.byte_range(),
        declaration: node.byte_range(),
        scope: 0..source.len(),
        detail,
        documentation,
        return_objects,
        return_expressions,
        value_expressions: Vec::new(),
        has_body,
        local: false,
        check_unused: false,
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
                    declaration: parameter.byte_range(),
                    scope: scope.clone(),
                    detail: text(parameter, source),
                    documentation: None,
                    return_objects: Vec::new(),
                    return_expressions: Vec::new(),
                    value_expressions: Vec::new(),
                    has_body,
                    local: true,
                    check_unused: true,
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
    if node.kind() == "anonymous_function" {
        collect_anonymous_function_parameters(node, source, output);
        let anonymous_scope = node.byte_range();
        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            collect_local_variables(child, source, anonymous_scope.clone(), output);
        }
        return;
    }
    if node.kind() == "foreach_statement" {
        collect_foreach_variables(node, source, output);
    }
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

fn collect_anonymous_function_parameters(node: Node<'_>, source: &str, output: &mut Vec<Symbol>) {
    let Some(parameters) = node
        .named_child(0)
        .filter(|child| child.kind() == "parameter_list")
    else {
        return;
    };
    let mut cursor = parameters.walk();
    for parameter in parameters.named_children(&mut cursor) {
        let Some(name) = parameter.child_by_field_name("name") else {
            continue;
        };
        output.push(Symbol {
            name: text(name, source),
            kind: SymbolKind::Parameter,
            selection: name.byte_range(),
            declaration: parameter.byte_range(),
            scope: node.byte_range(),
            detail: text(parameter, source),
            documentation: None,
            return_objects: Vec::new(),
            return_expressions: Vec::new(),
            value_expressions: Vec::new(),
            has_body: true,
            local: true,
            check_unused: false,
            parameters: Vec::new(),
        });
    }
}

fn collect_foreach_variables(node: Node<'_>, source: &str, output: &mut Vec<Symbol>) {
    let mut cursor = node.walk();
    let children = node.named_children(&mut cursor).collect::<Vec<_>>();
    let variables = children
        .iter()
        .filter(|child| child.kind() == "foreach_variable")
        .copied()
        .collect::<Vec<_>>();
    if variables.is_empty() {
        return;
    }
    let Some(iterable) = children
        .iter()
        .find(|child| child.kind() != "foreach_variable")
        .copied()
    else {
        return;
    };
    let single_variable = variables.len() == 1;
    for variable in variables {
        let mut variable_cursor = variable.walk();
        let Some(name) = variable
            .named_children(&mut variable_cursor)
            .filter(|child| child.kind() == "identifier")
            .last()
        else {
            continue;
        };
        output.push(Symbol {
            name: text(name, source),
            kind: SymbolKind::Variable,
            selection: name.byte_range(),
            declaration: variable.byte_range(),
            scope: node.byte_range(),
            detail: text(variable, source),
            documentation: None,
            return_objects: Vec::new(),
            return_expressions: Vec::new(),
            value_expressions: single_variable
                .then(|| ExpressionFact {
                    range: iterable.byte_range(),
                })
                .into_iter()
                .collect(),
            has_body: false,
            local: true,
            check_unused: single_variable,
            parameters: Vec::new(),
        });
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
                declaration: declarator.byte_range(),
                scope: scope.clone(),
                detail: format!("{type_text} {}", text(name, source)),
                documentation: None,
                return_objects: Vec::new(),
                return_expressions: Vec::new(),
                value_expressions: Vec::new(),
                has_body: false,
                local: scope.start != 0
                    || node
                        .parent()
                        .is_some_and(|parent| parent.kind() != "source_file"),
                check_unused: true,
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

fn collect_value_references(
    node: Node<'_>,
    source: &str,
    output: &mut Vec<std::ops::Range<usize>>,
) {
    if node.kind() == "identifier" && identifier_is_value_reference(node, source) {
        output.push(node.byte_range());
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_value_references(child, source, output);
    }
}

fn identifier_is_value_reference(identifier: Node<'_>, source: &str) -> bool {
    let Some(parent) = identifier.parent() else {
        return false;
    };
    if parent.is_error() {
        return false;
    }
    if source
        .get(identifier.end_byte()..)
        .is_some_and(|tail| tail.trim_start().starts_with("::"))
    {
        return false;
    }
    !matches!(
        parent.kind(),
        "function_declaration"
            | "variable_declaration"
            | "variable_declarator"
            | "parameter"
            | "struct_declaration"
            | "class_declaration"
            | "field_declaration"
            | "foreach_variable"
            | "member_suffix"
            | "struct_initializer"
            | "inherit_declaration"
            | "include_declaration"
            | "macro_concatenation"
    )
}

fn collect_calls(node: Node<'_>, source: &str, output: &mut Vec<CallSite>) {
    let direct_macro = matches!(node.kind(), "macro_annotation" | "macro_invocation")
        .then(|| {
            let name = node.child_by_field_name("name")?;
            let mut cursor = node.walk();
            let arguments = node
                .named_children(&mut cursor)
                .find(|child| child.kind() == "argument_list")?;
            Some((name, Some(arguments)))
        })
        .flatten();
    let postfix_call = (node.kind() == "postfix_expression")
        .then(|| {
            let value = node.child_by_field_name("value")?;
            if value.kind() != "identifier" {
                return None;
            }
            let mut cursor = node.walk();
            let call = node
                .named_children(&mut cursor)
                .find(|child| child.start_byte() >= value.end_byte())?;
            if call.kind() != "call_suffix" {
                return None;
            }
            let mut call_cursor = call.walk();
            let arguments = call
                .named_children(&mut call_cursor)
                .find(|child| child.kind() == "argument_list");
            Some((value, arguments))
        })
        .flatten();
    if let Some((name, arguments)) = direct_macro.or(postfix_call) {
        let argument_count = arguments.map_or(0, |arguments| {
            let mut argument_cursor = arguments.walk();
            arguments.named_children(&mut argument_cursor).count()
        });
        output.push(CallSite {
            name: text(name, source),
            range: name.byte_range(),
            argument_count,
            top_level: is_top_level_macro_context(node),
        });
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_calls(child, source, output);
    }
}

fn is_top_level_macro_context(node: Node<'_>) -> bool {
    let mut ancestor = node.parent();
    while let Some(current) = ancestor {
        if current.kind() == "source_file" {
            return true;
        }
        if matches!(
            current.kind(),
            "function_declaration" | "block" | "class_declaration" | "struct_declaration"
        ) {
            return false;
        }
        ancestor = current.parent();
    }
    false
}

fn collect_assignments(node: Node<'_>, source: &str, output: &mut Vec<AssignmentFact>) {
    if node.kind() == "anonymous_function" {
        return;
    }
    if node.kind() == "assignment_expression"
        && node
            .child_by_field_name("operator")
            .is_some_and(|operator| text(operator, source) == "=")
        && let (Some(left), Some(right)) = (
            node.child_by_field_name("left"),
            node.child_by_field_name("right"),
        )
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
    let comment = leading_doc_comment(source, declaration_start)?;
    let documentation = parse_callable_documentation(comment, None, &[]);
    (!is_file_documentation(&documentation)).then(|| documentation.render_markdown())
}

fn leading_callable_documentation(
    source: &str,
    declaration_start: usize,
    return_type: Option<&str>,
    parameter_names: &[String],
) -> Option<CallableDocumentation> {
    let comment = leading_doc_comment(source, declaration_start)?;
    let documentation = parse_callable_documentation(comment, return_type, parameter_names);
    (!is_file_documentation(&documentation)).then_some(documentation)
}

fn is_file_documentation(documentation: &CallableDocumentation) -> bool {
    documentation
        .extra_tags
        .iter()
        .any(|tag| tag.name == "file")
}

fn declared_function_return_type(node: Node<'_>, source: &str) -> Option<String> {
    let return_node = node.child_by_field_name("return_type")?;
    let base = text(return_node, source);
    let name = node.child_by_field_name("name")?;
    let pointers = source
        .get(return_node.end_byte()..name.start_byte())?
        .bytes()
        .filter(|byte| *byte == b'*')
        .count();
    Some(format!("{base}{}", "*".repeat(pointers)))
}

fn leading_macro_documentation(source: &str, declaration_start: usize) -> Option<String> {
    if let Some(documentation) = leading_documentation(source, declaration_start) {
        return Some(documentation);
    }
    let prefix = source.get(..declaration_start)?.trim_end();
    if prefix.ends_with("*/") {
        let start = prefix.rfind("/*")?;
        let body = prefix.get(start + 2..prefix.len().saturating_sub(2))?;
        let rendered = body
            .lines()
            .map(|line| line.trim().trim_start_matches('*').trim())
            .filter(|line| !line.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        return (!rendered.is_empty()).then_some(rendered);
    }
    let mut lines = Vec::new();
    for line in prefix.lines().rev() {
        let trimmed = line.trim();
        let Some(comment) = trimmed.strip_prefix("//") else {
            break;
        };
        lines.push(comment.trim());
    }
    lines.reverse();
    let rendered = lines.join("\n");
    (!rendered.is_empty()).then_some(rendered)
}

fn leading_doc_comment(source: &str, declaration_start: usize) -> Option<&str> {
    leading_doc_comment_with_range(source, declaration_start).map(|(comment, _)| comment)
}

fn leading_doc_comment_with_range(
    source: &str,
    declaration_start: usize,
) -> Option<(&str, std::ops::Range<usize>)> {
    let prefix = source.get(..declaration_start)?;
    let comment_start = prefix.rfind("/**")?;
    let comment_end = prefix[comment_start..].find("*/")? + comment_start + 2;
    let intervening = &prefix[comment_end..];
    if !intervening.lines().all(|line| {
        let line = line.trim();
        line.is_empty() || is_preprocessor_branch_directive(line)
    }) {
        return None;
    }
    Some((
        &prefix[comment_start..comment_end],
        comment_start..comment_end,
    ))
}

fn is_preprocessor_branch_directive(line: &str) -> bool {
    let Some(directive) = line.strip_prefix('#').map(str::trim_start) else {
        return false;
    };
    ["if", "ifdef", "ifndef", "elif", "else", "endif"]
        .iter()
        .any(|keyword| {
            directive == *keyword
                || directive
                    .strip_prefix(keyword)
                    .is_some_and(|rest| rest.starts_with(char::is_whitespace))
        })
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

fn is_known_lpc_name(name: &str) -> bool {
    matches!(
        name,
        "array"
            | "buffer"
            | "class"
            | "closure"
            | "float"
            | "function"
            | "int"
            | "lwobject"
            | "mapping"
            | "mixed"
            | "object"
            | "status"
            | "string"
            | "struct"
            | "symbol"
            | "void"
            | "any"
            | "bytes"
            | "unknown"
            | "true"
            | "false"
            | "null"
            | "undefined"
            | "this_object"
            | "this_player"
            | "previous_object"
            | "environment"
            | "call_other"
    )
}

fn is_fluffos_predefined_macro(name: &str) -> bool {
    if name.ends_with("__")
        && ["__CFG_", "__HAVE_", "__PACKAGE_"]
            .iter()
            .any(|prefix| name.starts_with(prefix))
    {
        return true;
    }
    matches!(
        name,
        "FLUFFOS"
            | "HAS_DEBUG_LEVEL"
            | "HAS_ED"
            | "HAS_PRINTF"
            | "HAS_RUSAGE"
            | "MAX_FLOAT"
            | "MAX_INT"
            | "MIN_FLOAT"
            | "MIN_INT"
            | "MUDOS"
            | "MUD_NAME"
            | "SIZEOFINT"
            | "__ARCH__"
            | "__ARGUMENTS_IN_TRACEBACK__"
            | "__ARRAY_STATS__"
            | "__AUTO_SETEUID__"
            | "__CACHE_STATS__"
            | "__CALLOUT_HANDLES__"
            | "__CALL_OTHER_TYPE_CHECK__"
            | "__CALL_OTHER_WARN__"
            | "__CLASS_STATS__"
            | "__COMMAND_BUF_SIZE__"
            | "__COMPILER__"
            | "__CXXFLAGS__"
            | "__DEBUG_MACRO__"
            | "__DEBUG__"
            | "__DEFAULT_DB__"
            | "__DEFAULT_PRAGMAS__"
            | "__DIR__"
            | "__DSLIB__"
            | "__DWLIB__"
            | "__ED_INDENT_SPACES__"
            | "__ED_TAB_WIDTH__"
            | "__FILE__"
            | "__GET_CHAR_IS_BUFFERED__"
            | "__HAS_CONSOLE__"
            | "__INTERACTIVE_CATCH_TELL__"
            | "__LARGEST_PRINTABLE_STRING__"
            | "__LARGE_STRING_SIZE__"
            | "__LAZY_RESETS__"
            | "__LINE__"
            | "__LOCALS_IN_TRACEBACK__"
            | "__MAX_SAVE_SVALUE_DEPTH__"
            | "__MUDLIB_ERROR_HANDLER__"
            | "__NONINTERACTIVE_STDERR_WRITE__"
            | "__NO_RESETS__"
            | "__OLD_ED__"
            | "__OLD_RANGE_BEHAVIOR__"
            | "__OLD_TYPE_BEHAVIOR__"
            | "__PACKAGES_PACKAGES_H__"
            | "__PARSE_DEBUG__"
            | "__PORT__"
            | "__PRIVS__"
            | "__PROJECT_VERSION__"
            | "__RANDOMIZED_RESETS__"
            | "__RECEIVE_SNOOP__"
            | "__REF_RESERVED_WORD__"
            | "__RESTRICTED_ED__"
            | "__REVERSE_DEFER__"
            | "__REVERSIBLE_EXPLODE_STRING__"
            | "__SANE_EXPLODE_STRING__"
            | "__SANE_SORTING__"
            | "__SAVE_EXTENSION__"
            | "__SAVE_GZ_EXTENSION__"
            | "__SENSIBLE_MODIFIERS__"
            | "__SMALL_STRING_SIZE__"
            | "__SNOOP_SHADOWED__"
            | "__STRING_STATS__"
            | "__STRUCT_CLASS__"
            | "__STRUCT_STRUCT__"
            | "__SUPPRESS_ARGUMENT_WARNINGS__"
            | "__THIS_PLAYER_IN_CALL_OUT__"
            | "__TIME_WITH_SYS_TIME__"
            | "__TRACE_CODE__"
            | "__TRACE__"
            | "__TRAP_CRASHES__"
            | "__USE_32BIT_ADDRESSES__"
            | "__USE_MYSQL__"
            | "__USE_POSTGRES__"
            | "__USE_SQLITE3__"
            | "__VERSION__"
            | "__WARN_OLD_RANGE_BEHAVIOR__"
            | "__WOMBLES__"
    )
}

fn uri_path_ends_with(uri: &str, suffix: &str) -> bool {
    uri.split(['?', '#'])
        .next()
        .is_some_and(|path| path.to_ascii_lowercase().ends_with(suffix))
}

fn collect_diagnostics(tree: &Tree, source: &str) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    collect_error_nodes(tree.root_node(), source, &mut diagnostics, false);
    collect_empty_heredoc_diagnostics(tree.root_node(), source, &mut diagnostics);
    collect_type_diagnostics(tree.root_node(), source, None, &mut diagnostics);
    collect_local_declaration_position_diagnostics(tree.root_node(), source, &mut diagnostics);
    diagnostics
}

fn collect_empty_heredoc_diagnostics(node: Node<'_>, source: &str, output: &mut Vec<Diagnostic>) {
    if node.kind() == "heredoc_literal"
        && node
            .utf8_text(source.as_bytes())
            .ok()
            .is_some_and(is_empty_heredoc)
    {
        output.push(Diagnostic {
            range: byte_range_to_lsp(source, node.byte_range()),
            severity: 2,
            code: "emptyMultilineString",
            source: "lpc-support",
            message: "空的多行字符串".to_owned(),
        });
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_empty_heredoc_diagnostics(child, source, output);
    }
}

fn is_empty_heredoc(value: &str) -> bool {
    let Some((opening, remainder)) = value.split_once('\n') else {
        return false;
    };
    let delimiter = opening
        .trim_end_matches('\r')
        .trim()
        .strip_prefix('@')
        .unwrap_or_default()
        .trim();
    if delimiter.is_empty() {
        return false;
    }
    let Some(closing_start) = remainder.rfind(delimiter) else {
        return false;
    };
    remainder[..closing_start].trim().is_empty()
        && remainder[closing_start + delimiter.len()..]
            .trim()
            .is_empty()
}

fn file_name_diagnostics(uri: &str) -> Vec<Diagnostic> {
    let segment = uri.rsplit(['/', '\\']).next().unwrap_or(uri);
    let file_name = percent_decode(segment);
    let (stem, extension) = file_name
        .rsplit_once('.')
        .map_or((file_name.as_str(), ""), |(stem, extension)| {
            (stem, extension)
        });
    let point = Range {
        start: Position {
            line: 0,
            character: 0,
        },
        end: Position {
            line: 0,
            character: 0,
        },
    };
    let mut diagnostics = Vec::new();
    if !matches!(extension, "c" | "h") {
        diagnostics.push(Diagnostic {
            range: point,
            severity: 2,
            code: "fileNaming",
            source: "lpc-support",
            message: format!("文件扩展名应为 .c 或 .h，而不是 .{extension}"),
        });
    }
    if stem.is_empty()
        || !stem.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || matches!(character, '_' | '-')
                || ('\u{4e00}'..='\u{9fa5}').contains(&character)
        })
    {
        diagnostics.push(Diagnostic {
            range: point,
            severity: 2,
            code: "fileNaming",
            source: "lpc-support",
            message: "文件名应由字母（可大写/小写）、数字、下划线、连字符或中文组成".to_owned(),
        });
    }
    if stem.chars().count() > 100 {
        diagnostics.push(Diagnostic {
            range: point,
            severity: 2,
            code: "fileNaming",
            source: "lpc-support",
            message: "文件名过长，建议不超过 100 个字符".to_owned(),
        });
    }
    diagnostics
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%'
            && index + 2 < bytes.len()
            && let (Some(high), Some(low)) =
                (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
        {
            decoded.push((high << 4) | low);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).unwrap_or_else(|_| value.to_owned())
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn collect_local_declaration_position_diagnostics(
    node: Node<'_>,
    source: &str,
    output: &mut Vec<Diagnostic>,
) {
    if node.kind() == "block" {
        let mut has_executable = false;
        let mut last_executable_end = node.start_byte();
        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            if child.kind() == "variable_declaration" {
                let separated_by_branch_directive = has_executable
                    && source
                        .get(last_executable_end..child.start_byte())
                        .is_some_and(contains_preprocessor_branch_directive);
                if has_executable && !separated_by_branch_directive {
                    output.push(Diagnostic {
                        range: byte_range_to_lsp(source, child.byte_range()),
                        severity: 1,
                        code: "localVariableDeclarationPosition",
                        source: "lpc-support",
                        message: "局部变量定义必须在可执行语句或代码块的开头。".to_owned(),
                    });
                }
                if separated_by_branch_directive {
                    has_executable = false;
                }
            } else {
                has_executable = true;
                last_executable_end = child.end_byte();
            }
        }
    }
    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_local_declaration_position_diagnostics(child, source, output);
    }
}

fn contains_preprocessor_branch_directive(source: &str) -> bool {
    source
        .lines()
        .any(|line| is_preprocessor_branch_directive(line.trim_start()))
}

fn collect_type_diagnostics(
    node: Node<'_>,
    source: &str,
    return_type: Option<&str>,
    output: &mut Vec<Diagnostic>,
) {
    if node.kind() == "anonymous_function" {
        return;
    }
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
        } else if !matches!(expected.trim(), "void" | "mixed") {
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
    if actual == "int" && is_zero_integer_literal(value, source) {
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
        .or_else(|| lexical_identifier_range(&file.source, offset))
}

fn lexical_identifier_range(source: &str, offset: usize) -> Option<std::ops::Range<usize>> {
    let bytes = source.as_bytes();
    let mut pivot = offset.min(bytes.len());
    if pivot == bytes.len() || !bytes.get(pivot).is_some_and(u8::is_ascii_alphanumeric) {
        pivot = pivot.checked_sub(1)?;
    }
    if !bytes
        .get(pivot)
        .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
    {
        return None;
    }
    let mut start = pivot;
    while start > 0
        && bytes[start - 1].is_ascii()
        && (bytes[start - 1].is_ascii_alphanumeric() || bytes[start - 1] == b'_')
    {
        start -= 1;
    }
    let mut end = pivot + 1;
    while end < bytes.len()
        && bytes[end].is_ascii()
        && (bytes[end].is_ascii_alphanumeric() || bytes[end] == b'_')
    {
        end += 1;
    }
    (bytes[start].is_ascii_alphabetic() || bytes[start] == b'_').then_some(start..end)
}

fn macro_candidate_ranges(file: &FileAnalysis, name: &str) -> Vec<std::ops::Range<usize>> {
    let mut ranges = file
        .identifiers
        .iter()
        .filter(|range| file.source.get((*range).clone()) == Some(name))
        .cloned()
        .collect::<Vec<_>>();

    let mut line_offset = 0_usize;
    for line in file.source.split_inclusive('\n') {
        let content = line.trim_end_matches(['\r', '\n']);
        if content.trim_start().starts_with('#') {
            let line_end = line_offset + content.len();
            let active_lifecycle = file.macro_directives.iter().any(|fact| {
                line_offset <= fact.range.start_byte && fact.range.end_byte <= line_end
            });
            if !is_macro_lifecycle_directive(content) || active_lifecycle {
                ranges.extend(directive_identifier_ranges(content, line_offset, name));
            }
        }
        line_offset += line.len();
    }
    ranges.retain(|range| {
        !file
            .inactive_regions
            .iter()
            .any(|inactive| inactive.start <= range.start && range.start < inactive.end)
    });
    ranges.sort_by_key(|range| (range.start, range.end));
    ranges.dedup();
    ranges
}

fn is_macro_lifecycle_directive(line: &str) -> bool {
    let directive = line
        .trim_start()
        .strip_prefix('#')
        .unwrap_or_default()
        .trim_start();
    ["define", "undef"].into_iter().any(|keyword| {
        directive
            .strip_prefix(keyword)
            .is_some_and(|tail| tail.chars().next().is_some_and(char::is_whitespace))
    })
}

fn directive_identifier_ranges(
    line: &str,
    line_offset: usize,
    expected: &str,
) -> Vec<std::ops::Range<usize>> {
    let bytes = line.as_bytes();
    let mut ranges = Vec::new();
    let mut index = 0_usize;
    let mut quote = None;
    while index < bytes.len() {
        if quote.is_none() && index + 1 < bytes.len() && bytes[index..].starts_with(b"//") {
            break;
        }
        if quote.is_none() && index + 1 < bytes.len() && bytes[index..].starts_with(b"/*") {
            index += 2;
            while index + 1 < bytes.len() && !bytes[index..].starts_with(b"*/") {
                index += 1;
            }
            index = (index + 2).min(bytes.len());
            continue;
        }
        if matches!(bytes[index], b'"' | b'\'') {
            if index == 0 || bytes[index - 1] != b'\\' {
                quote = if quote == Some(bytes[index]) {
                    None
                } else if quote.is_none() {
                    Some(bytes[index])
                } else {
                    quote
                };
            }
            index += 1;
            continue;
        }
        if quote.is_some() || !(bytes[index].is_ascii_alphabetic() || bytes[index] == b'_') {
            index += 1;
            continue;
        }
        let start = index;
        index += 1;
        while index < bytes.len() && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'_')
        {
            index += 1;
        }
        if &line[start..index] == expected {
            ranges.push(line_offset + start..line_offset + index);
        }
    }
    ranges
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

fn function_documentation<'a>(
    file: &'a FileAnalysis,
    symbol: &'a Symbol,
) -> Option<&'a CallableDocumentation> {
    if symbol.kind != SymbolKind::Function {
        return symbol.documentation.as_ref();
    }
    symbol.documentation.as_ref().or_else(|| {
        file.symbols
            .iter()
            .filter(|candidate| {
                candidate.kind == SymbolKind::Function
                    && candidate.name == symbol.name
                    && parameters_have_matching_shapes(&candidate.parameters, &symbol.parameters)
                    && !candidate.has_body
            })
            .find_map(|candidate| candidate.documentation.as_ref())
    })
}

fn parameters_have_matching_shapes(left: &[String], right: &[String]) -> bool {
    left.len() == right.len()
        && left
            .iter()
            .zip(right)
            .all(|(left, right)| parameter_shape(left) == parameter_shape(right))
}

fn parameter_shape(parameter: &str) -> String {
    let before_default = parameter
        .split_once(':')
        .map_or(parameter, |(head, _)| head);
    let Some(name) = declaration_identifier(before_default) else {
        return before_default.split_whitespace().collect();
    };
    let Some(name_start) = before_default.rfind(name) else {
        return before_default.split_whitespace().collect();
    };
    format!(
        "{}{}",
        before_default[..name_start]
            .split_whitespace()
            .collect::<String>(),
        before_default[name_start + name.len()..]
            .split_whitespace()
            .collect::<String>()
    )
}

fn render_function_symbol_hover<'a>(
    symbols: impl IntoIterator<Item = (&'a Symbol, Option<&'a CallableDocumentation>)>,
) -> Option<String> {
    let mut entries = HashMap::<&str, Vec<String>>::new();
    for (symbol, callable_documentation) in symbols {
        let documentation = entries.entry(symbol.detail.as_str()).or_default();
        if let Some(value) = callable_documentation {
            documentation.push(value.render_markdown());
        }
    }
    if entries.is_empty() {
        return None;
    }

    let mut entries = entries.into_iter().collect::<Vec<_>>();
    entries.sort_by(|left, right| left.0.cmp(right.0));
    Some(
        entries
            .into_iter()
            .map(|(detail, mut documentation)| {
                documentation.sort_unstable();
                documentation.dedup();
                if documentation.is_empty() {
                    format!("```lpc\n{detail}\n```")
                } else {
                    format!("```lpc\n{detail}\n```\n\n{}", documentation.join("\n\n"))
                }
            })
            .collect::<Vec<_>>()
            .join("\n\n---\n\n"),
    )
}

fn valid_identifier(value: &str) -> bool {
    let mut characters = value.chars();
    characters
        .next()
        .is_some_and(|character| character == '_' || character.is_ascii_alphabetic())
        && characters.all(|character| character == '_' || character.is_ascii_alphanumeric())
        && !KEYWORDS.contains(&value)
}

fn macro_name_hash(name: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    name.hash(&mut hasher);
    hasher.finish()
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

fn signature_information_from_symbol(file: &FileAnalysis, symbol: &Symbol) -> SignatureInformation {
    let documentation = function_documentation(file, symbol);
    SignatureInformation {
        label: symbol.detail.clone(),
        documentation: documentation.map(CallableDocumentation::render_markdown),
        parameters: symbol
            .parameters
            .iter()
            .map(|label| parameter_information_from_symbol(symbol, documentation, label))
            .collect(),
    }
}

fn parameter_information_from_symbol(
    _symbol: &Symbol,
    documentation: Option<&CallableDocumentation>,
    label: &str,
) -> ParameterInformation {
    let parameter_name = declaration_identifier(label);
    let documentation = parameter_name.and_then(|name| {
        documentation?
            .parameters
            .iter()
            .find(|parameter| parameter.name == name)?
            .description
            .clone()
    });
    ParameterInformation {
        label: label.to_owned(),
        documentation,
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
                        documentation: None,
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
            b'(' | b'[' if depth == 0 => break,
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

fn array_literal_elements(expression: &str) -> Option<Vec<&str>> {
    let body = expression.strip_prefix('{')?.strip_suffix('}')?;
    Some(split_top_level_commas(body))
}

fn indexed_expression(expression: &str) -> Option<(&str, &str)> {
    let expression = expression.trim();
    if !expression.ends_with(']') {
        return None;
    }
    let mut depth = 0_u32;
    let mut quoted = false;
    let mut escaped = false;
    for (index, character) in expression.char_indices().rev() {
        if quoted {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                quoted = false;
            }
            continue;
        }
        match character {
            '"' => quoted = true,
            ']' => depth += 1,
            '[' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    let collection = expression[..index].trim();
                    return (!collection.is_empty()).then(|| {
                        (
                            collection,
                            expression[index + 1..expression.len() - 1].trim(),
                        )
                    });
                }
            }
            _ => {}
        }
    }
    None
}

fn collection_values_at<'a>(collection: &'a str, index: &str) -> Vec<&'a str> {
    let collection = strip_outer_parentheses(collection.trim());
    if let Some(elements) = array_literal_elements(collection)
        && let Ok(index) = index.trim().parse::<usize>()
    {
        return elements.get(index).copied().into_iter().collect();
    }
    let Some(body) = collection
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
    else {
        return Vec::new();
    };
    let Some(requested_key) = static_collection_key(index) else {
        return Vec::new();
    };
    split_top_level_commas(body)
        .into_iter()
        .filter_map(split_mapping_entry)
        .filter(|(key, _)| static_collection_key(key).as_deref() == Some(requested_key.as_str()))
        .map(|(_, value)| value)
        .collect()
}

fn split_mapping_entry(entry: &str) -> Option<(&str, &str)> {
    let mut nesting = 0_u32;
    let mut quoted = false;
    let mut escaped = false;
    for (index, character) in entry.char_indices() {
        if quoted {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                quoted = false;
            }
            continue;
        }
        match character {
            '"' => quoted = true,
            '(' | '{' | '[' => nesting += 1,
            ')' | '}' | ']' => nesting = nesting.saturating_sub(1),
            ':' if nesting == 0 => {
                return Some((entry[..index].trim(), entry[index + 1..].trim()));
            }
            _ => {}
        }
    }
    None
}

fn static_collection_key(value: &str) -> Option<String> {
    let value = value.trim();
    quoted_string(value)
        .map(|key| format!("string:{key}"))
        .or_else(|| value.parse::<i64>().ok().map(|key| format!("int:{key}")))
}

fn split_top_level_commas(source: &str) -> Vec<&str> {
    let mut output = Vec::new();
    let mut start = 0;
    let mut nesting = 0_u32;
    let mut quoted = false;
    let mut escaped = false;
    for (index, character) in source.char_indices() {
        if quoted {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                quoted = false;
            }
            continue;
        }
        match character {
            '"' => quoted = true,
            '(' | '{' | '[' => nesting += 1,
            ')' | '}' | ']' => nesting = nesting.saturating_sub(1),
            ',' if nesting == 0 => {
                let value = source[start..index].trim();
                if !value.is_empty() {
                    output.push(value);
                }
                start = index + character.len_utf8();
            }
            _ => {}
        }
    }
    let value = source[start..].trim();
    if !value.is_empty() {
        output.push(value);
    }
    output
}

fn call_first_argument<'a>(expression: &'a str, name: &str) -> Option<&'a str> {
    let arguments = expression
        .strip_prefix(name)?
        .strip_prefix('(')?
        .strip_suffix(')')?;
    split_top_level_commas(arguments).into_iter().next()
}

fn model_get_call(expression: &str) -> Option<(&str, &str)> {
    let marker = "->model_get(";
    let index = expression.rfind(marker)?;
    let arguments = expression.get(index + marker.len()..)?.strip_suffix(')')?;
    Some((
        expression[..index].trim(),
        split_top_level_commas(arguments).into_iter().next()?,
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

fn indexed_assignment_values<'a>(
    file: &'a FileAnalysis,
    symbol: &Symbol,
    requested_index: &str,
    offset: usize,
) -> Vec<(&'a str, usize)> {
    let Some(requested_key) = static_collection_key(requested_index) else {
        return Vec::new();
    };
    file.assignments
        .iter()
        .filter_map(|assignment| {
            if assignment.name.start <= symbol.selection.end || assignment.name.start >= offset {
                return None;
            }
            let left = file.source.get(assignment.name.clone())?;
            let (collection, index) = indexed_expression(left)?;
            if collection != symbol.name
                || static_collection_key(index).as_deref() != Some(requested_key.as_str())
                || !resolved_symbols(file, collection, assignment.name.start)
                    .first()
                    .is_some_and(|resolved| resolved.selection == symbol.selection)
            {
                return None;
            }
            file.source
                .get(assignment.value.clone())
                .map(|value| (value, assignment.value.start))
        })
        .collect()
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
    fn reports_empty_dynamic_heredoc_literals() {
        let source = "string help() { return @HELP\n   \nHELP; }\n";
        let mut empty_database = database(source);
        let diagnostics = empty_database.diagnostics("file:///demo.c");
        assert!(diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "emptyMultilineString" && diagnostic.message == "空的多行字符串"
        }));

        let source = "string help() { return @HELP\nbody\nHELP; }\n";
        let mut populated_database = database(source);
        assert!(
            populated_database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "emptyMultilineString")
        );
    }

    #[test]
    fn preserves_file_name_diagnostics_for_percent_encoded_uris() {
        let source = "int value;\n";
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();
        database.update(
            "file:///mud/%E5%90%88%E6%B3%95-%E6%96%87%E4%BB%B6.h",
            1,
            1,
            &tree,
            source,
        );
        assert!(
            database
                .diagnostics("file:///mud/%E5%90%88%E6%B3%95-%E6%96%87%E4%BB%B6.h")
                .iter()
                .all(|diagnostic| diagnostic.code != "fileNaming")
        );

        database.update("file:///mud/bad.name.txt", 1, 1, &tree, source);
        let messages = database
            .diagnostics("file:///mud/bad.name.txt")
            .into_iter()
            .filter(|diagnostic| diagnostic.code == "fileNaming")
            .map(|diagnostic| diagnostic.message)
            .collect::<Vec<_>>();
        assert_eq!(messages.len(), 2);
        assert!(messages.iter().any(|message| message.contains("扩展名")));
        assert!(
            messages
                .iter()
                .any(|message| message.contains("文件名应由"))
        );
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
    fn honors_efun_inheritance_definition_search_preference() {
        let source = "inherit \"/std/base\";\nvoid demo() { write(\"hello\"); }\n";
        let mut database = database(source);
        database.set_external_functions(vec![ExternalFunction {
            name: "write".to_owned(),
            summary: Some("driver output".to_owned()),
            signatures: vec![ExternalSignature {
                label: "void write(mixed value)".to_owned(),
                parameters: vec!["mixed value".to_owned()],
                minimum_arguments: 1,
                maximum_arguments: Some(1),
            }],
        }]);
        let dependency = "void write(mixed value) {}\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(dependency, None).unwrap();
        database.index_source("file:///std/base.c", &tree, dependency);

        let position = byte_to_lsp_position(source, source.rfind("write").unwrap());
        assert!(database.definition("file:///demo.c", position).is_empty());

        database.set_search_efun_definition_in_inheritance_chain(true);
        let definitions = database.definition("file:///demo.c", position);
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///std/base.c");
    }

    #[test]
    fn resolves_local_efun_shadow_regardless_of_inheritance_search_preference() {
        let source = concat!(
            "void write(mixed value) {}\n",
            "void demo() { write(\"hello\"); }\n",
        );
        let mut database = database(source);
        database.set_external_functions(vec![ExternalFunction {
            name: "write".to_owned(),
            summary: None,
            signatures: Vec::new(),
        }]);
        let position = byte_to_lsp_position(source, source.rfind("write").unwrap());
        let definitions = database.definition("file:///demo.c", position);
        assert_eq!(definitions.len(), 1);
        assert_eq!(definitions[0].uri, "file:///demo.c");
        assert_eq!(definitions[0].range.start.line, 0);
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
    fn exposes_semantic_token_facts_for_simulated_and_external_functions() {
        let source =
            "void local_helper() {}\nvoid demo() { local_helper(); simul_call(); sizeof(1); }\n";
        let mut database = database(source);
        database.set_external_functions(vec![ExternalFunction {
            name: "sizeof".to_owned(),
            summary: None,
            signatures: Vec::new(),
        }]);
        database.set_simulated_efun_files(vec!["/adm/single/simul_efun".to_owned()]);

        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let simulated_source = "void simul_call() {}\n";
        let simulated_tree = parser.parse(simulated_source, None).unwrap();
        database.index_source(
            "file:///mud/adm/single/simul_efun.c",
            &simulated_tree,
            simulated_source,
        );

        let facts = database.semantic_token_facts("file:///demo.c");
        assert!(facts.local_functions.contains("local_helper"));
        assert!(facts.simulated_functions.contains("simul_call"));
        assert!(facts.external_functions.contains("sizeof"));
    }

    #[test]
    fn restores_macro_definition_hover_and_completion_from_indexed_headers() {
        let source = "#include <paths.h>\ninherit ROOT_DIR;\nvoid demo() { string path = ROOT_DIR; int value = MAX(1, 2); }\n";
        let mut database = database(source);
        database.set_workspace_resolution(Vec::new(), vec!["include".to_owned()], HashMap::new());
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let header_source = concat!(
            "// Root of generated files.\n",
            "#define ROOT_DIR \"/data\"\n",
            "#define MAX(left, right) ((left) > (right) ? (left) : (right))\n",
        );
        let header_tree = parser.parse(header_source, None).unwrap();
        database.index_source("file:///include/paths.h", &header_tree, header_source);
        assert_eq!(
            database.dependent_uris("file:///include/paths.h"),
            vec!["file:///demo.c"]
        );

        let root_offset = source.find("ROOT_DIR").unwrap();
        let definition = database.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, root_offset + 2),
        );
        assert_eq!(definition.len(), 1);
        assert_eq!(definition[0].uri, "file:///include/paths.h");
        assert_eq!(definition[0].range.start.line, 1);
        let hover = database
            .hover(
                "file:///demo.c",
                byte_to_lsp_position(source, root_offset + 2),
            )
            .unwrap();
        assert!(hover.contents.contains("#define ROOT_DIR \"/data\""));
        assert!(hover.contents.contains("Root of generated files"));
        assert!(hover.contents.contains("file:///include/paths.h#L2"));

        let references = database.references(
            "file:///demo.c",
            byte_to_lsp_position(source, root_offset + 2),
            true,
        );
        assert_eq!(references.len(), 3);
        assert_eq!(
            references
                .iter()
                .filter(|location| location.uri == "file:///demo.c")
                .count(),
            2
        );
        assert_eq!(
            references
                .iter()
                .filter(|location| location.uri == "file:///include/paths.h")
                .count(),
            1
        );
        assert!(
            database
                .prepare_rename(
                    "file:///demo.c",
                    byte_to_lsp_position(source, root_offset + 2),
                )
                .is_some()
        );
        let edits = database.rename_edits(
            "file:///demo.c",
            byte_to_lsp_position(source, root_offset + 2),
            "DATA_ROOT",
        );
        assert_eq!(edits["file:///demo.c"].len(), 2);
        assert_eq!(edits["file:///include/paths.h"].len(), 1);

        let completions = database
            .completion_candidates("file:///demo.c", byte_to_lsp_position(source, source.len()));
        assert!(
            completions
                .iter()
                .any(|candidate| candidate.label == "ROOT_DIR" && candidate.kind == 21)
        );
        assert!(completions.iter().any(|candidate| {
            candidate.label == "MAX"
                && candidate.insert_text.as_deref() == Some("MAX(${1:left}, ${2:right})")
        }));
    }

    #[test]
    fn honors_imported_macro_visibility_from_the_include_position() {
        let source = concat!(
            "int before = HEADER_FLAG;\n",
            "#include <flags.h>\n",
            "int after = HEADER_FLAG;\n",
        );
        let processed = lpc_preprocessor::Preprocessor::default().process_with_include_resolver(
            source,
            |path, _, definitions| {
                assert_eq!(path, "flags.h");
                let mut imported = definitions.clone();
                imported.insert("HEADER_FLAG".to_owned(), "1".to_owned());
                Some(imported)
            },
        );
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.set_workspace_resolution(Vec::new(), vec!["include".to_owned()], HashMap::new());
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );
        let header_source = "#define HEADER_FLAG 1\n";
        let header_tree = parser.parse(header_source, None).unwrap();
        database.index_source("file:///include/flags.h", &header_tree, header_source);

        let before = source.find("HEADER_FLAG").unwrap();
        let after = source.rfind("HEADER_FLAG").unwrap();
        assert!(
            database
                .definition("file:///demo.c", byte_to_lsp_position(source, before + 2),)
                .is_empty()
        );
        assert_eq!(
            database
                .definition("file:///demo.c", byte_to_lsp_position(source, after + 2),)
                .len(),
            1
        );
        let facts = database.semantic_token_facts("file:///demo.c");
        let scopes = facts.macro_scopes.get("HEADER_FLAG").unwrap();
        assert_eq!(scopes.len(), 1);
        assert_eq!(scopes[0].start, source.find("flags.h").unwrap());
        assert_eq!(scopes[0].end, source.len());
    }

    #[test]
    fn macro_references_and_rename_preserve_source_order_and_redefinitions() {
        let source = concat!(
            "#define FLAG 1\n",
            "int first = FLAG;\n",
            "#undef FLAG\n",
            "#define FLAG 2\n",
            "int second = FLAG;\n",
        );
        let processed = lpc_preprocessor::Preprocessor::default().process(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );

        let first_use = source.find("FLAG;").unwrap();
        let references = database.references(
            "file:///demo.c",
            byte_to_lsp_position(source, first_use + 1),
            true,
        );
        assert!(
            references
                .iter()
                .any(|location| location.range.start.line == 0)
        );
        assert!(
            references
                .iter()
                .any(|location| location.range.start.line == 1)
        );
        assert!(
            references
                .iter()
                .any(|location| location.range.start.line == 2)
        );
        assert!(
            references
                .iter()
                .all(|location| location.range.start.line < 3)
        );

        let undef = source.find("#undef FLAG").unwrap() + "#undef ".len();
        let undef_position = byte_to_lsp_position(source, undef + 1);
        assert_eq!(
            database.definition("file:///demo.c", undef_position)[0]
                .range
                .start
                .line,
            0
        );
        assert!(database.hover("file:///demo.c", undef_position).is_some());
        assert!(
            database
                .prepare_rename("file:///demo.c", undef_position)
                .is_some()
        );

        let edits = database.rename_edits(
            "file:///demo.c",
            byte_to_lsp_position(source, first_use + 1),
            "FIRST_FLAG",
        );
        assert!(
            edits["file:///demo.c"]
                .iter()
                .all(|edit| edit.range.start.line < 3)
        );
        assert_eq!(edits["file:///demo.c"].len(), 3);
    }

    #[test]
    fn macro_rename_excludes_inactive_redefinitions() {
        let source = concat!(
            "#define FLAG 1\n",
            "#if 0\n",
            "#define FLAG 2\n",
            "int hidden = FLAG;\n",
            "#endif\n",
            "int value = FLAG;\n",
        );
        let processed = lpc_preprocessor::Preprocessor::default().process(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );

        let use_offset = source.rfind("FLAG").unwrap();
        let references = database.references(
            "file:///demo.c",
            byte_to_lsp_position(source, use_offset + 1),
            true,
        );
        assert_eq!(references.len(), 2);
        assert!(
            references
                .iter()
                .all(|location| !matches!(location.range.start.line, 2 | 3))
        );
        let edits = database.rename_edits(
            "file:///demo.c",
            byte_to_lsp_position(source, use_offset + 1),
            "ACTIVE_FLAG",
        );
        assert_eq!(edits["file:///demo.c"].len(), 2);
        assert!(
            edits["file:///demo.c"]
                .iter()
                .all(|edit| !matches!(edit.range.start.line, 2 | 3))
        );
    }

    #[test]
    fn excludes_inactive_includes_from_the_dependency_graph() {
        let source = concat!(
            "#if 0\n",
            "#include <disabled.h>\n",
            "#endif\n",
            "#include <active.h>\n",
            "void demo() {}\n",
        );
        let processed = lpc_preprocessor::Preprocessor::default().process(source);
        assert_eq!(processed.includes.len(), 1);
        assert_eq!(processed.includes[0].path, "active.h");

        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.set_workspace_resolution(Vec::new(), vec!["include".to_owned()], HashMap::new());
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );

        for header in ["active.h", "disabled.h"] {
            let header_source = "void helper() {}\n";
            let header_tree = parser.parse(header_source, None).unwrap();
            database.index_source(
                &format!("file:///include/{header}"),
                &header_tree,
                header_source,
            );
        }

        assert_eq!(
            database.dependent_uris("file:///include/active.h"),
            vec!["file:///demo.c"]
        );
        assert!(
            database
                .dependent_uris("file:///include/disabled.h")
                .is_empty()
        );
    }

    #[test]
    fn does_not_expose_macros_from_unrelated_headers() {
        let source = "void demo() { int value = PRIVATE_FEATURE; }\n";
        let mut database = database(source);
        database.set_workspace_resolution(Vec::new(), vec!["include".to_owned()], HashMap::new());
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let header_source = "#define PRIVATE_FEATURE 1\n";
        let header_tree = parser.parse(header_source, None).unwrap();
        database.index_source("file:///include/private.h", &header_tree, header_source);

        let offset = source.find("PRIVATE_FEATURE").unwrap();
        let position = byte_to_lsp_position(source, offset + 2);
        assert!(database.definition("file:///demo.c", position).is_empty());
        assert!(database.hover("file:///demo.c", position).is_none());
        assert!(
            !database
                .semantic_token_facts("file:///demo.c")
                .macro_names
                .contains("PRIVATE_FEATURE")
        );
        assert!(
            database
                .completion_candidates(
                    "file:///demo.c",
                    byte_to_lsp_position(source, source.len()),
                )
                .iter()
                .all(|candidate| candidate.label != "PRIVATE_FEATURE")
        );
    }

    #[test]
    fn indexes_declarations_generated_by_whole_line_function_macros() {
        assert_eq!(
            expand_function_macro(
                "int query_##name() { return value; }",
                &["name".to_owned(), "value".to_owned()],
                &["score".to_owned(), "100".to_owned()],
            ),
            "int query_score() { return 100; }"
        );
        assert_eq!(
            expand_function_macro(
                "string name##_label = \"name\"; string title = #name;",
                &["name".to_owned()],
                &["score".to_owned()],
            ),
            "string score_label = \"name\"; string title = \"score\";"
        );
        let source = concat!(
            "#define RequestType(name, method) string name##_request_type = method;\n",
            "#define MAKE_QUERY(name, value) int query_##name() { return value; }\n",
            "RequestType(pay_add, \"POST\")\n",
            "MAKE_QUERY(score, 100)\n",
            "string read_method() { return pay_add_request_type; }\n",
            "int read_score() { return query_score(); }\n",
        );
        let mut database = database(source);

        let variables = database.document_variables("file:///demo.c");
        assert!(variables.iter().any(|variable| {
            variable.name == "pay_add_request_type" && variable.detail.starts_with("string ")
        }));
        let generated = database.macro_generated_document_symbols("file:///demo.c");
        assert_eq!(
            generated
                .iter()
                .map(|symbol| symbol.name.as_str())
                .collect::<HashSet<_>>(),
            HashSet::from(["pay_add_request_type", "query_score"])
        );

        for name in ["pay_add_request_type", "query_score"] {
            let usage = source.rfind(name).unwrap();
            let definitions =
                database.definition("file:///demo.c", byte_to_lsp_position(source, usage + 1));
            assert_eq!(definitions.len(), 1, "missing definition for {name}");
            assert_eq!(
                definitions[0].range.start.line,
                if name == "pay_add_request_type" { 2 } else { 3 }
            );
            let hover = database
                .hover("file:///demo.c", byte_to_lsp_position(source, usage + 1))
                .expect("generated declaration should have hover");
            assert!(hover.contents.contains(name));
        }

        let completions = database
            .completion_candidates("file:///demo.c", byte_to_lsp_position(source, source.len()));
        assert!(
            completions
                .iter()
                .any(|candidate| candidate.label == "pay_add_request_type")
        );
        assert!(
            completions
                .iter()
                .any(|candidate| candidate.label == "query_score")
        );
    }

    #[test]
    fn indexes_declarations_generated_by_imported_function_macros() {
        let source = concat!(
            "#include <request.h>\n",
            "RequestType(pay_add, \"POST\")\n",
            "string read_method() { return pay_add_request_type; }\n",
        );
        let processed = lpc_preprocessor::Preprocessor::default().process_with_include_resolver(
            source,
            |_, _, definitions| {
                let mut imported = definitions.clone();
                imported.insert(
                    "RequestType".to_owned(),
                    "(name, method) string name##_request_type = method;".to_owned(),
                );
                Some(imported)
            },
        );
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );

        assert!(
            database
                .macro_generated_document_symbols("file:///demo.c")
                .iter()
                .any(|symbol| symbol.name == "pay_add_request_type")
        );
    }

    #[test]
    fn exposes_workspace_predefined_macros_without_source_definitions() {
        let source = "void demo() { int enabled = __PACKAGE_DB__; }\n";
        let mut database = database(source);
        database.set_predefined_macros(vec![("__PACKAGE_DB__".to_owned(), "1".to_owned())]);
        let offset = source.find("__PACKAGE_DB__").unwrap();
        let position = byte_to_lsp_position(source, offset + 2);

        let hover = database.hover("file:///demo.c", position).unwrap();
        assert!(hover.contents.contains("#define __PACKAGE_DB__ 1"));
        assert!(database.definition("file:///demo.c", position).is_empty());
        assert!(
            database
                .prepare_rename("file:///demo.c", position)
                .is_none()
        );
        assert!(
            database
                .semantic_token_facts("file:///demo.c")
                .macro_names
                .contains("__PACKAGE_DB__")
        );
        assert!(
            database
                .completion_candidates("file:///demo.c", position)
                .iter()
                .any(|candidate| candidate.label == "__PACKAGE_DB__" && candidate.kind == 21)
        );
    }

    #[test]
    fn honors_inactive_macro_definitions_and_undef_source_order() {
        let source = concat!(
            "#if 0\n",
            "#define DISABLED 1\n",
            "#endif\n",
            "#define ACTIVE 1\n",
            "int before = ACTIVE;\n",
            "#undef ACTIVE\n",
            "int after = ACTIVE;\n",
            "int disabled = DISABLED;\n",
            "int config_before = __PACKAGE_DB__;\n",
            "#undef __PACKAGE_DB__\n",
            "int config_after = __PACKAGE_DB__;\n",
        );
        let processed = lpc_preprocessor::Preprocessor::with_predefined([(
            "__PACKAGE_DB__".to_owned(),
            "1".to_owned(),
        )])
        .process(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.set_predefined_macros(vec![("__PACKAGE_DB__".to_owned(), "1".to_owned())]);
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );

        let before = source.find("ACTIVE;").unwrap();
        let after = source.rfind("ACTIVE;").unwrap();
        let disabled = source.rfind("DISABLED;").unwrap();
        let config_before = source.find("__PACKAGE_DB__;").unwrap();
        let config_after = source.rfind("__PACKAGE_DB__;").unwrap();
        assert!(
            database
                .hover("file:///demo.c", byte_to_lsp_position(source, before + 1))
                .is_some()
        );
        assert!(
            database
                .hover("file:///demo.c", byte_to_lsp_position(source, after + 1))
                .is_none()
        );
        assert!(
            database
                .hover(
                    "file:///demo.c",
                    byte_to_lsp_position(source, config_before + 1)
                )
                .is_some()
        );
        assert!(
            database
                .hover(
                    "file:///demo.c",
                    byte_to_lsp_position(source, config_after + 1)
                )
                .is_none()
        );
        assert!(
            !database
                .completion_candidates(
                    "file:///demo.c",
                    byte_to_lsp_position(source, config_after + "__PACKAGE_DB__".len())
                )
                .iter()
                .any(|candidate| candidate.label == "__PACKAGE_DB__")
        );
        assert!(
            database
                .hover("file:///demo.c", byte_to_lsp_position(source, disabled + 1))
                .is_none()
        );
        let facts = database.semantic_token_facts("file:///demo.c");
        assert!(!facts.macro_names.contains("DISABLED"));
        assert_eq!(facts.macro_scopes["ACTIVE"].len(), 1);
        assert!(facts.macro_scopes["ACTIVE"][0].contains(&before));
        assert!(!facts.macro_scopes["ACTIVE"][0].contains(&after));
        assert!(facts.macro_scopes["__PACKAGE_DB__"][0].contains(&config_before));
        assert!(!facts.macro_scopes["__PACKAGE_DB__"][0].contains(&config_after));
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
    fn preserves_structured_javadoc_for_multiple_cross_file_method_targets() {
        let source = concat!(
            "/** @lpc-return-objects {\"/model/world\", \"/model/fallback\"} */\n",
            "object resolve_model() { return 0; }\n",
            "void demo() { resolve_model()->world_object_button(0); }\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, documentation) in [
            (
                "file:///mud/model/world.c",
                ("生成世界对象按钮协议数据", "主模型按钮数据"),
            ),
            (
                "file:///mud/model/fallback.c",
                ("生成后备世界对象按钮协议数据", "后备模型按钮数据"),
            ),
        ] {
            let target = format!(
                "/**\n * @brief {}\n * @param mixed data {}\n * @return string JSON 协议字符串\n */\nvarargs string world_object_button(mixed data) {{ return \"\"; }}\n",
                documentation.0, documentation.1
            );
            let tree = parser.parse(&target, None).unwrap();
            analysis.index_source(uri, &tree, &target);
        }

        let member_start = source.rfind("world_object_button").unwrap();
        let hover = analysis
            .hover(
                "file:///demo.c",
                byte_to_lsp_position(source, member_start + 2),
            )
            .expect("cross-file method hover should resolve");
        assert!(
            hover
                .contents
                .contains("varargs string world_object_button(mixed data)")
        );
        assert!(hover.contents.contains("生成世界对象按钮协议数据"));
        assert!(hover.contents.contains("生成后备世界对象按钮协议数据"));
        assert!(hover.contents.contains("`data` (`mixed`)"));
        assert!(hover.contents.contains("**返回值**"));
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
    fn propagates_static_function_arrays_through_foreach_bindings() {
        let source = concat!(
            "#define BASE_D \"/std/base\"\n",
            "string *runtime_paths() { return ({ BASE_D, \"/std/other\" }); }\n",
            "object find_runtime_object(string path) { return find_object(path); }\n",
            "void demo() {\n",
            "  foreach (string path in runtime_paths()) {\n",
            "    object runtime;\n",
            "    runtime = find_runtime_object(path);\n",
            "    catch(runtime->shared_method());\n",
            "  }\n",
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
        let completions = analysis.completion_candidates(
            "file:///demo.c",
            byte_to_lsp_position(source, member_start + 6),
        );
        assert_eq!(completions.len(), 1);
        assert_eq!(completions[0].label, "shared_method");
        let hover = analysis
            .hover(
                "file:///demo.c",
                byte_to_lsp_position(source, member_start + 1),
            )
            .unwrap();
        assert!(hover.contents.contains("shared_method"));
    }

    #[test]
    fn propagates_objects_through_static_array_and_mapping_indexes() {
        let source = concat!(
            "void demo() {\n",
            "  object *targets = ({ load_object(\"/std/first\"), load_object(\"/std/second\") });\n",
            "  mapping services = ([ \"main\": load_object(\"/std/first\"), \"backup\": load_object(\"/std/second\") ]);\n",
            "  mapping nested = ([ \"group\": ({ load_object(\"/std/first\"), load_object(\"/std/second\") }) ]);\n",
            "  targets[1]->indexed_method();\n",
            "  services[\"main\"]->indexed_method();\n",
            "  services[\"late\"] = load_object(\"/std/second\");\n",
            "  services[\"late\"]->indexed_method();\n",
            "  nested[\"group\"][1]->indexed_method();\n",
            "}\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for path in ["first", "second"] {
            let target = format!("int indexed_method() {{ return {}; }}\n", path.len());
            let tree = parser.parse(&target, None).unwrap();
            analysis.index_source(&format!("file:///mud/std/{path}.c"), &tree, &target);
        }

        let array_call = source.find("indexed_method").unwrap();
        let array_definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, array_call + 1),
        );
        assert_eq!(array_definitions.len(), 1);
        assert!(array_definitions[0].uri.ends_with("/std/second.c"));

        let mapping_call =
            source.find("services[\"main\"]").unwrap() + "services[\"main\"]->".len();
        let mapping_definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, mapping_call + 1),
        );
        assert_eq!(mapping_definitions.len(), 1);
        assert!(mapping_definitions[0].uri.ends_with("/std/first.c"));

        let assigned_call =
            source.find("services[\"late\"]->").unwrap() + "services[\"late\"]->".len();
        let assigned_definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, assigned_call + 1),
        );
        assert_eq!(assigned_definitions.len(), 1);
        assert!(assigned_definitions[0].uri.ends_with("/std/second.c"));

        let nested_call = source.rfind("indexed_method").unwrap();
        let nested_definitions = analysis.definition(
            "file:///demo.c",
            byte_to_lsp_position(source, nested_call + 1),
        );
        assert_eq!(nested_definitions.len(), 1);
        assert!(nested_definitions[0].uri.ends_with("/std/second.c"));
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
    fn reports_only_genuinely_unknown_direct_function_calls() {
        let source = concat!(
            "void local_helper() {}\n",
            "void demo(object target) {\n",
            "    local_helper();\n",
            "    sizeof(({ 1 }));\n",
            "    target->missing_member();\n",
            "    missing_call();\n",
            "}\n",
        );
        let mut database = database(source);
        database.set_external_functions(vec![ExternalFunction {
            name: "sizeof".to_owned(),
            summary: None,
            signatures: vec![ExternalSignature {
                label: "int sizeof(mixed value)".to_owned(),
                parameters: vec!["mixed value".to_owned()],
                minimum_arguments: 1,
                maximum_arguments: Some(1),
            }],
        }]);

        let undefined = database
            .diagnostics("file:///demo.c")
            .into_iter()
            .filter(|diagnostic| diagnostic.code == "lpc.undefinedFunction")
            .collect::<Vec<_>>();
        assert_eq!(undefined.len(), 1);
        assert_eq!(undefined[0].message, "未定义函数: missing_call");
    }

    #[test]
    fn reports_only_genuinely_unknown_value_symbols() {
        let source = concat!(
            "struct Payload { int value; }\n",
            "int global_value;\n",
            "void demo(object target) {\n",
            "    struct Payload payload;\n",
            "    int local_value = global_value;\n",
            "    local_value;\n",
            "    payload.value;\n",
            "    target->missing_member;\n",
            "    missing_value;\n",
            "    missing_call();\n",
            "}\n",
        );
        let mut database = database(source);
        let diagnostics = database.diagnostics("file:///demo.c");
        let undefined_symbols = diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == "lpc.undefinedSymbol")
            .collect::<Vec<_>>();
        assert_eq!(undefined_symbols.len(), 1);
        assert_eq!(undefined_symbols[0].message, "未定义符号: missing_value");
        assert_eq!(
            diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "lpc.undefinedFunction")
                .count(),
            1
        );
    }

    #[test]
    fn resolves_all_variables_in_mapping_foreach_bindings() {
        let source = concat!(
            "void demo(mapping values) {\n",
            "    foreach (string key, int value in values) {\n",
            "        key;\n",
            "        value;\n",
            "    }\n",
            "}\n",
        );
        let mut database = database(source);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| {
                    diagnostic.code != "lpc.undefinedSymbol" && diagnostic.code != "unusedVar"
                })
        );
    }

    #[test]
    fn resolves_anonymous_function_parameters_and_named_inherit_qualifiers() {
        let source = concat!(
            "inherit char \"/std/char\";\n",
            "void demo(object * items) {\n",
            "    filter_array(items, function(object item, string kind) {\n",
            "        return item && kind;\n",
            "    }, \"weapon\");\n",
            "    char::query(\"name\");\n",
            "}\n",
        );
        let mut database = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let inherited_source = "mixed query(string name) { return 0; }\n";
        let inherited_tree = parser.parse(inherited_source, None).unwrap();
        database.index_source("file:///std/char.c", &inherited_tree, inherited_source);

        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.undefinedSymbol")
        );
    }

    #[test]
    fn honors_macro_source_order_for_undefined_symbols() {
        let source = concat!(
            "#define TEMP_VALUE 1\n",
            "void demo() {\n",
            "    TEMP_VALUE;\n",
            "#undef TEMP_VALUE\n",
            "    TEMP_VALUE;\n",
            "}\n",
        );
        let processed = lpc_preprocessor::Preprocessor::default().process(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.update_preprocessed(
            "file:///demo.c",
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );

        let undefined = database
            .diagnostics("file:///demo.c")
            .into_iter()
            .filter(|diagnostic| diagnostic.code == "lpc.undefinedSymbol")
            .collect::<Vec<_>>();
        assert_eq!(undefined.len(), 1);
        assert_eq!(undefined[0].range.start.line, 4);
    }

    #[test]
    fn recognizes_functions_from_resolved_include_dependencies() {
        let source = "#include <helpers.h>\nvoid demo() { helper(); }\n";
        let mut database = database(source);
        database.set_workspace_resolution(Vec::new(), vec!["include".to_owned()], HashMap::new());
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let header_source = "void helper() {}\n";
        let header_tree = parser.parse(header_source, None).unwrap();
        database.index_source("file:///include/helpers.h", &header_tree, header_source);

        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.undefinedFunction")
        );
    }

    #[test]
    fn suppresses_undefined_calls_while_dependencies_are_unresolved() {
        let source = "inherit MISSING_BASE;\nvoid demo() { missing_call(); }\n";
        let mut database = database(source);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.undefinedFunction")
        );
    }

    #[test]
    fn suppresses_context_dependent_undefined_calls_in_headers() {
        let source = "void configure() { consumer_supplied_helper(); }\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();
        let mut database = AnalysisDatabase::default();
        database.update("file:///include/mixin.h", 1, 1, &tree, source);

        assert!(
            database
                .diagnostics("file:///include/mixin.h")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.undefinedFunction")
        );
    }

    #[test]
    fn suppresses_context_dependent_calls_in_textually_included_c_files() {
        let mixin_source = "void configure() { consumer_supplied_helper(); }\n";
        let consumer_source = "#include <mixin.c>\nvoid consumer_supplied_helper() {}\n";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let mut database = AnalysisDatabase::default();
        database.set_workspace_resolution(Vec::new(), vec!["include".to_owned()], HashMap::new());
        for (uri, source) in [
            ("file:///include/mixin.c", mixin_source),
            ("file:///consumer.c", consumer_source),
        ] {
            let tree = parser.parse(source, None).unwrap();
            database.update(uri, 1, 1, &tree, source);
        }

        assert!(
            database
                .diagnostics("file:///include/mixin.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.undefinedFunction")
        );
    }

    #[test]
    fn suppresses_undefined_calls_around_unexpanded_function_macros() {
        let source = concat!(
            "#define Wrap(value) value\n",
            "void demo() { Wrap(missing_symbol); missing_call(); }\n",
        );
        let mut database = database(source);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.undefinedFunction")
        );
    }

    #[test]
    fn does_not_treat_member_receivers_as_direct_function_calls() {
        let source = concat!(
            "int master() { return 1; }\n",
            "int users() { return 1; }\n",
            "int query() { return 1; }\n",
            "void demo(object master, object *users) {\n",
            "    master->query(\"name\");\n",
            "    users[0]->query(\"name\");\n",
            "    query(\"name\");\n",
            "}\n",
        );
        let mut database = database(source);
        let mismatches = database
            .diagnostics("file:///demo.c")
            .into_iter()
            .filter(|diagnostic| diagnostic.code == "lpc.argumentCountMismatch")
            .collect::<Vec<_>>();
        assert_eq!(mismatches.len(), 1);
        assert!(mismatches[0].message.contains("query"));
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
    fn checks_only_parameters_from_function_implementations() {
        let source = concat!(
            "string skill_level(string type, int level);\n",
            "string skill_level(string type, int level) { return type + level; }\n",
            "private int callback(string unused_value, string _intentionally_unused) { return 1; }\n",
        );
        let mut database = database(source);
        database.set_diagnostic_preferences(false, true, false);
        let diagnostics = database.diagnostics("file:///demo.c");
        let unused_parameters = diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == "unusedParam")
            .collect::<Vec<_>>();
        assert_eq!(unused_parameters.len(), 1);
        assert!(unused_parameters[0].message.contains("unused_value"));
    }

    #[test]
    fn honors_optional_global_and_declaration_position_diagnostics() {
        let source = concat!(
            "int unused_global;\n",
            "void demo(int input) {\n",
            "  int first = input;\n",
            "  first++;\n",
            "  int late;\n",
            "}\n",
        );
        let mut database = database(source);
        let defaults = database.diagnostics("file:///demo.c");
        assert!(defaults.iter().all(|diagnostic| {
            !matches!(
                diagnostic.code,
                "unusedGlobalVar" | "localVariableDeclarationPosition"
            )
        }));

        database.set_diagnostic_preferences(true, false, true);
        let enabled = database.diagnostics("file:///demo.c");
        assert!(
            enabled
                .iter()
                .any(|diagnostic| diagnostic.code == "unusedGlobalVar")
        );
        assert!(
            enabled
                .iter()
                .any(|diagnostic| diagnostic.code == "localVariableDeclarationPosition")
        );
    }

    #[test]
    fn exposes_variable_inspection_and_workspace_diagnostics_from_rust_snapshot() {
        let source =
            "int global_value;\nvoid demo(int input) { int unused; int used = input; used++; }\n";
        let mut analysis = database(source);
        let variables = analysis.document_variables("file:///demo.c");
        assert!(
            variables
                .iter()
                .any(|entry| !entry.local && entry.name == "global_value")
        );
        assert!(
            variables
                .iter()
                .any(|entry| entry.local && entry.name == "input")
        );
        assert!(
            variables
                .iter()
                .any(|entry| entry.unused && entry.name == "unused")
        );
        assert!(
            variables
                .iter()
                .any(|entry| !entry.unused && entry.name == "used")
        );
        let function = analysis
            .enclosing_function(
                "file:///demo.c",
                Position {
                    line: 1,
                    character: 35,
                },
            )
            .unwrap();
        assert_eq!(function.name, "demo");
        assert_eq!(function.range.start.line, 1);

        let diagnostics = analysis.workspace_diagnostics("file:///demo");
        assert_eq!(diagnostics.len(), 1);
        assert!(
            diagnostics[0]
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "unusedVar")
        );
    }

    #[test]
    fn exposes_function_documentation_for_current_inherited_and_included_files() {
        let source = concat!(
            "inherit \"/std/base\";\n",
            "#include \"/include/shared.h\"\n",
            "/**\n",
            " * @brief Local documentation.\n",
            " * @param int value Input value.\n",
            " * @return string Result text.\n",
            " */\n",
            "string local_helper(int value) { return \"ok\"; }\n",
        );
        let mut analysis = database(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        for (uri, dependency_source) in [
            (
                "file:///mud/std/base.c",
                "/** @brief Inherited documentation. */\nint inherited_helper() { return 1; }\n",
            ),
            (
                "file:///mud/include/shared.h",
                "/** @brief Included documentation. */\nstring included_helper(string name);\n",
            ),
        ] {
            let tree = parser.parse(dependency_source, None).unwrap();
            analysis.index_source(uri, &tree, dependency_source);
        }

        let lookup = analysis
            .function_documentation_lookup("file:///demo.c")
            .expect("function documentation lookup should resolve");
        let local = lookup
            .current_file
            .entries
            .iter()
            .find(|entry| entry.name == "local_helper")
            .unwrap();
        assert!(local.has_body);
        assert_eq!(local.parameters, ["int value"]);
        assert!(
            local
                .documentation
                .as_deref()
                .is_some_and(|text| text.contains("Local documentation"))
        );
        assert_eq!(local.range.start.line, 7);
        assert_eq!(lookup.inherited_groups.len(), 1);
        assert_eq!(lookup.inherited_groups[0].source_kind, "inherit");
        assert_eq!(lookup.inherited_groups[0].depth, 1);
        assert_eq!(
            lookup.inherited_groups[0].parent_uri.as_deref(),
            Some("file:///demo.c")
        );
        assert!(
            lookup.inherited_groups[0]
                .entries
                .iter()
                .any(|entry| entry.name == "inherited_helper")
        );
        assert_eq!(lookup.include_groups.len(), 1);
        assert_eq!(lookup.include_groups[0].source_kind, "include");
        assert!(
            lookup.include_groups[0]
                .entries
                .iter()
                .any(|entry| entry.name == "included_helper" && !entry.has_body)
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
        assert!(mismatches.is_empty());
    }

    #[test]
    fn keeps_dynamic_and_nested_closure_returns_conservative() {
        let source = concat!(
            "mixed optional_value(int enabled) { if (enabled) return 1; return; }\n",
            "object *filter_items(object *items) {\n",
            "    return filter_array(items, function(object item) { return 1; });\n",
            "}\n",
        );
        let mut database = database(source);
        assert!(
            database
                .diagnostics("file:///demo.c")
                .iter()
                .all(|diagnostic| diagnostic.code != "lpc.typeMismatch")
        );
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
        assert_eq!(
            signature.signatures[0].parameters[0]
                .documentation
                .as_deref(),
            Some("协议模型")
        );
        assert_eq!(
            signature.signatures[0].parameters[1]
                .documentation
                .as_deref(),
            Some("武学分类")
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
    fn attaches_docs_across_conditional_directives_but_not_file_headers_or_includes() {
        let source = concat!(
            "/** @file This describes the file, not the first function. */\n",
            "int first();\n",
            "/** @brief Conditional implementation. */\n",
            "#ifdef FEATURE_X\n",
            "int conditional() { return 1; }\n",
            "#endif\n",
            "/** @brief Must not cross an include. */\n",
            "#include <other.h>\n",
            "int after_include() { return 2; }\n",
        );
        let database = database(source);
        let file = database.files.get("file:///demo.c").unwrap();
        let function = |name: &str| {
            file.symbols
                .iter()
                .find(|symbol| symbol.kind == SymbolKind::Function && symbol.name == name)
                .unwrap()
        };

        assert!(function("first").documentation.is_none());
        assert_eq!(
            function("conditional")
                .documentation
                .as_ref()
                .and_then(|documentation| documentation.summary.as_deref()),
            Some("Conditional implementation.")
        );
        assert!(function("after_include").documentation.is_none());
    }

    #[test]
    fn uses_matching_prototype_docs_when_the_implementation_has_none() {
        let source = concat!(
            "string look(object who) { return who->query_name(); }\n",
            "/**\n",
            " * @brief Returns the visible name.\n",
            " * @param object who Target object.\n",
            " * @return string Visible name.\n",
            " */\n",
            "string look(object who);\n",
            "void demo(object target) { look(target); }\n",
        );
        let mut database = database(source);
        let call = source.rfind("look(target)").unwrap();
        let position = byte_to_lsp_position(source, call + 1);

        let hover = database.hover("file:///demo.c", position).unwrap();
        assert!(hover.contents.contains("Returns the visible name."));
        assert!(hover.contents.contains("Visible name."));

        let signature = database
            .signature_help(
                "file:///demo.c",
                byte_to_lsp_position(source, call + "look(target".len()),
            )
            .unwrap();
        assert!(
            signature.signatures[0]
                .documentation
                .as_deref()
                .is_some_and(|documentation| documentation.contains("Returns the visible name."))
        );
        assert_eq!(
            signature.signatures[0].parameters[0]
                .documentation
                .as_deref(),
            Some("Target object.")
        );

        let completion = database
            .completion_candidates(
                "file:///demo.c",
                byte_to_lsp_position(source, call + "lo".len()),
            )
            .into_iter()
            .find(|candidate| candidate.label == "look")
            .unwrap();
        assert!(
            completion
                .documentation
                .as_deref()
                .is_some_and(|documentation| documentation.contains("Returns the visible name."))
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
