use lpc_analysis::SemanticTokenFacts;
use tree_sitter::{Node, Tree};

pub const TOKEN_TYPES: &[&str] = &[
    "keyword",
    "lpcType",
    "type",
    "variable",
    "parameter",
    "function",
    "method",
    "property",
    "macro",
    "builtin",
    "number",
    "string",
    "comment",
    "operator",
    "inactive",
];

pub const TOKEN_MODIFIERS: &[&str] = &[
    "declaration",
    "local",
    "defaultLibrary",
    "readonly",
    "static",
];

const DECLARATION_MODIFIER: u32 = 1;
const DEFAULT_LIBRARY_MODIFIER: u32 = 1 << 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct Token {
    line: u32,
    start_character: u32,
    length: u32,
    token_type: u32,
    modifiers: u32,
}

pub fn encode(tree: &Tree, source: &str, facts: &SemanticTokenFacts) -> Vec<u32> {
    let line_index = LineIndex::new(source);
    let mut tokens = Vec::new();
    collect_tokens(tree.root_node(), source, facts, &line_index, &mut tokens);
    tokens.sort_unstable();
    tokens.dedup();

    let mut encoded = Vec::with_capacity(tokens.len() * 5);
    let mut previous_line = 0_u32;
    let mut previous_character = 0_u32;
    for token in tokens {
        let delta_line = token.line - previous_line;
        let delta_character = if delta_line == 0 {
            token.start_character - previous_character
        } else {
            token.start_character
        };
        encoded.extend([
            delta_line,
            delta_character,
            token.length,
            token.token_type,
            token.modifiers,
        ]);
        previous_line = token.line;
        previous_character = token.start_character;
    }
    encoded
}

fn collect_tokens(
    node: Node<'_>,
    source: &str,
    facts: &SemanticTokenFacts,
    line_index: &LineIndex,
    tokens: &mut Vec<Token>,
) {
    if let Some((token_type, modifiers)) = classify(node, source, facts) {
        push_node_tokens(node, source, line_index, token_type, modifiers, tokens);
        return;
    }

    let mut cursor = node.walk();
    for child in node.named_children(&mut cursor) {
        collect_tokens(child, source, facts, line_index, tokens);
    }
}

fn classify(node: Node<'_>, source: &str, facts: &SemanticTokenFacts) -> Option<(u32, u32)> {
    match node.kind() {
        "primitive_type" => Some((1, 0)),
        "number_literal" => Some((10, 0)),
        "string_literal" | "character_literal" => Some((11, 0)),
        "comment" => Some((12, 0)),
        "preprocessor_directive" => Some((8, 0)),
        "modifier" => Some((0, 0)),
        "identifier" => classify_identifier(node, source, facts),
        _ => None,
    }
}

fn classify_identifier(
    node: Node<'_>,
    source: &str,
    facts: &SemanticTokenFacts,
) -> Option<(u32, u32)> {
    let parent = node.parent()?;
    match parent.kind() {
        "function_declaration" if is_field(parent, "name", node) => Some((5, DECLARATION_MODIFIER)),
        "variable_declarator" if is_field(parent, "name", node) => Some((3, DECLARATION_MODIFIER)),
        "parameter" if is_field(parent, "name", node) => Some((4, DECLARATION_MODIFIER)),
        "struct_declaration" | "class_declaration" if is_field(parent, "name", node) => {
            Some((2, DECLARATION_MODIFIER))
        }
        "field_declaration" => Some((7, DECLARATION_MODIFIER)),
        "member_suffix" => Some((member_token_type(parent), 0)),
        "postfix_expression" if is_direct_call(parent, node) => {
            Some(classify_call(node, parent, source, facts))
        }
        _ => Some((3, 0)),
    }
}

fn classify_call(
    node: Node<'_>,
    call: Node<'_>,
    source: &str,
    facts: &SemanticTokenFacts,
) -> (u32, u32) {
    let name = &source[node.byte_range()];
    let prefix = &source[call.start_byte()..node.start_byte()];
    if prefix.trim_end().ends_with("efun::") {
        return (9, DEFAULT_LIBRARY_MODIFIER);
    }
    if facts.local_functions.contains(name) {
        return (5, 0);
    }
    if facts.simulated_functions.contains(name) {
        return (5, DEFAULT_LIBRARY_MODIFIER);
    }
    if facts.visible_functions.contains(name) {
        return (5, 0);
    }
    if facts.external_functions.contains(name) {
        return (9, DEFAULT_LIBRARY_MODIFIER);
    }
    (5, 0)
}

fn is_direct_call(parent: Node<'_>, identifier: Node<'_>) -> bool {
    if !is_field(parent, "value", identifier) {
        return false;
    }
    let mut cursor = parent.walk();
    parent
        .named_children(&mut cursor)
        .any(|child| child.kind() == "call_suffix")
}

fn is_field(parent: Node<'_>, field_name: &str, child: Node<'_>) -> bool {
    parent
        .child_by_field_name(field_name)
        .is_some_and(|field| field.id() == child.id())
}

fn member_token_type(member: Node<'_>) -> u32 {
    let Some(parent) = member.parent() else {
        return 7;
    };
    let mut cursor = parent.walk();
    let children: Vec<_> = parent.named_children(&mut cursor).collect();
    let Some(index) = children.iter().position(|child| child.id() == member.id()) else {
        return 7;
    };
    if children
        .get(index + 1)
        .is_some_and(|child| child.kind() == "call_suffix")
    {
        6
    } else {
        7
    }
}

fn push_node_tokens(
    node: Node<'_>,
    source: &str,
    line_index: &LineIndex,
    token_type: u32,
    modifiers: u32,
    tokens: &mut Vec<Token>,
) {
    let start = node.start_byte();
    let end = node.end_byte();
    for (line, segment_start, segment_end) in line_index.segments(start, end) {
        let start_character = line_index.utf16_column(source, line, segment_start);
        let end_character = line_index.utf16_column(source, line, segment_end);
        if end_character > start_character {
            tokens.push(Token {
                line: line as u32,
                start_character,
                length: end_character - start_character,
                token_type,
                modifiers,
            });
        }
    }
}

struct LineIndex {
    starts: Vec<usize>,
}

impl LineIndex {
    fn new(source: &str) -> Self {
        let mut starts = vec![0];
        for (index, byte) in source.bytes().enumerate() {
            if byte == b'\n' {
                starts.push(index + 1);
            }
        }
        Self { starts }
    }

    fn line_at(&self, byte: usize) -> usize {
        self.starts
            .partition_point(|start| *start <= byte)
            .saturating_sub(1)
    }

    fn segments(&self, start: usize, end: usize) -> Vec<(usize, usize, usize)> {
        if start >= end {
            return Vec::new();
        }
        let first_line = self.line_at(start);
        let last_line = self.line_at(end.saturating_sub(1));
        (first_line..=last_line)
            .filter_map(|line| {
                let line_start = self.starts[line];
                let segment_limit = self
                    .starts
                    .get(line + 1)
                    .map_or(end, |next_line_start| next_line_start.saturating_sub(1));
                let segment_start = start.max(line_start);
                let segment_end = end.min(segment_limit.max(line_start));
                (segment_end > segment_start).then_some((line, segment_start, segment_end))
            })
            .collect()
    }

    fn utf16_column(&self, source: &str, line: usize, byte: usize) -> u32 {
        source[self.starts[line]..byte].encode_utf16().count() as u32
    }
}

#[cfg(test)]
mod tests {
    use tree_sitter::Parser;

    use super::*;

    #[test]
    fn emits_legend_compatible_delta_encoded_tokens() {
        let source = "private int query_value(int amount) { return amount + 1; }";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();

        let encoded = encode(&tree, source, &SemanticTokenFacts::default());
        assert!(!encoded.is_empty());
        assert_eq!(encoded.len() % 5, 0);
        let chunks = encoded.as_chunks::<5>().0;
        assert!(chunks.iter().any(|token| token[3] == 5));
        assert!(chunks.iter().any(|token| token[3] == 1));
        assert!(chunks.iter().any(|token| token[3] == 10));
    }

    #[test]
    fn reports_utf16_columns_after_non_ascii_text() {
        let source = "string value = \"😀\"; int count = 1;";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();

        let encoded = encode(&tree, source, &SemanticTokenFacts::default());
        let absolute = decode(&encoded);
        assert!(absolute.iter().any(|token| token.1 == 21 && token.3 == 1));
    }

    #[test]
    fn distinguishes_efuns_simulated_efuns_and_local_calls() {
        let source = concat!(
            "void local_call() {}\n",
            "void demo(mixed value) { sizeof(value); simul_call(); local_call(); other(); }",
        );
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();
        let facts = SemanticTokenFacts {
            local_functions: ["local_call".to_owned(), "demo".to_owned()].into(),
            visible_functions: ["local_call".to_owned(), "demo".to_owned()].into(),
            simulated_functions: ["simul_call".to_owned()].into(),
            external_functions: ["sizeof".to_owned()].into(),
        };

        let tokens = decode_with_modifiers(&encode(&tree, source, &facts));
        assert!(
            tokens
                .iter()
                .any(|token| token.3 == 9 && token.4 == DEFAULT_LIBRARY_MODIFIER)
        );
        assert!(
            tokens
                .iter()
                .any(|token| token.3 == 5 && token.4 == DEFAULT_LIBRARY_MODIFIER)
        );
        assert!(tokens.iter().any(|token| token.3 == 5 && token.4 == 0));
    }

    fn decode(encoded: &[u32]) -> Vec<(u32, u32, u32, u32)> {
        let mut line = 0;
        let mut character = 0;
        encoded
            .as_chunks::<5>()
            .0
            .iter()
            .map(|token| {
                line += token[0];
                character = if token[0] == 0 {
                    character + token[1]
                } else {
                    token[1]
                };
                (line, character, token[2], token[3])
            })
            .collect()
    }

    fn decode_with_modifiers(encoded: &[u32]) -> Vec<(u32, u32, u32, u32, u32)> {
        let mut line = 0;
        let mut character = 0;
        encoded
            .as_chunks::<5>()
            .0
            .iter()
            .map(|token| {
                line += token[0];
                character = if token[0] == 0 {
                    character + token[1]
                } else {
                    token[1]
                };
                (line, character, token[2], token[3], token[4])
            })
            .collect()
    }
}
