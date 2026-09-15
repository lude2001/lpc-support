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
    metrics: AnalysisMetrics,
}

impl AnalysisDatabase {
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

    pub fn diagnostics(&mut self, uri: &str) -> Vec<Diagnostic> {
        self.metrics.query_count += 1;
        self.files
            .get(uri)
            .map_or_else(Vec::new, |file| file.diagnostics.clone())
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

        let candidates = resolved_symbols(origin, &name, offset);
        if let Some(symbol) = candidates.first() {
            return vec![Location {
                uri: uri.to_owned(),
                range: byte_range_to_lsp(&origin.source, symbol.selection.clone()),
            }];
        }

        self.files
            .iter()
            .flat_map(|(candidate_uri, file)| {
                file.symbols
                    .iter()
                    .filter(|symbol| {
                        symbol.name == name
                            && matches!(
                                symbol.kind,
                                SymbolKind::Function | SymbolKind::Variable | SymbolKind::Type
                            )
                            && symbol.scope.start == 0
                    })
                    .map(|symbol| Location {
                        uri: candidate_uri.clone(),
                        range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    })
            })
            .collect()
    }

    pub fn hover(&mut self, uri: &str, position: Position) -> Option<HoverResult> {
        self.metrics.query_count += 1;
        let (name, offset) = self.identifier_at(uri, position)?;
        let file = self.files.get(uri)?;
        let symbols = resolved_symbols(file, &name, offset);
        let symbol = symbols.first().copied().or_else(|| {
            self.files
                .values()
                .flat_map(|candidate| candidate.symbols.iter())
                .find(|symbol| symbol.name == name && symbol.scope.start == 0)
        })?;
        let identifier = identifier_range(file, offset)?;
        Some(HoverResult {
            contents: format!("```lpc\n{}\n```", symbol.detail),
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
        let local_scope = resolved
            .filter(|symbol| symbol.local)
            .map(|symbol| symbol.scope.clone());
        let declaration_ranges: HashSet<_> = resolved
            .into_iter()
            .map(|symbol| (symbol.selection.start, symbol.selection.end))
            .collect();
        self.files
            .iter()
            .filter(|(candidate_uri, _)| local_scope.is_none() || candidate_uri.as_str() == uri)
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
        (!KEYWORDS.contains(&name)).then(|| byte_range_to_lsp(&file.source, range))
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
        let symbol = self
            .files
            .values()
            .flat_map(|candidate| candidate.symbols.iter())
            .find(|symbol| symbol.kind == SymbolKind::Function && symbol.name == name)?;
        Some(SignatureHelp {
            signatures: vec![SignatureInformation {
                label: symbol.detail.clone(),
                parameters: symbol
                    .parameters
                    .iter()
                    .map(|label| ParameterInformation {
                        label: label.clone(),
                    })
                    .collect(),
            }],
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
        let mut labels: Vec<_> = labels.into_iter().collect();
        labels.sort();
        labels
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
    pub parameters: Vec<ParameterInformation>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ParameterInformation {
    pub label: String,
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

fn collect_diagnostics(tree: &Tree, source: &str) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    collect_error_nodes(tree.root_node(), source, &mut diagnostics, false);
    diagnostics
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
}
