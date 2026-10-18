use std::{collections::HashSet, ops::Range};

use tree_sitter::{Node, Parser, Tree};

use crate::{FormatContext, FormatError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AtomKind {
    Code,
    Comment,
    Literal,
    Directive,
    Macro,
    Error,
}

#[derive(Debug, Clone)]
pub(crate) struct Atom {
    pub range: Range<usize>,
    pub kind: AtomKind,
    pub syntax_kind: String,
    pub parent_kind: String,
}

impl Atom {
    pub fn text<'a>(&self, source: &'a str) -> &'a str {
        &source[self.range.clone()]
    }
}

pub(crate) struct SourceSyntax {
    pub tree: Tree,
    pub atoms: Vec<Atom>,
}

impl SourceSyntax {
    pub fn parse(
        parser: &mut Parser,
        source: &str,
        context: &FormatContext,
    ) -> Result<Self, FormatError> {
        let directives = lpc_preprocessor::source_directive_ranges(source);
        let mut masked = source.as_bytes().to_vec();
        let mut macros = context.macro_names.iter().cloned().collect::<HashSet<_>>();
        let mut protected = Vec::new();
        for directive in directives {
            let range = directive.start_byte..directive.end_byte;
            let (logical, _) = lpc_preprocessor::logical_directive(&source[range.start..range.end]);
            let body = logical.trim_start().trim_start_matches('#').trim_start();
            if let Some(arguments) = body
                .strip_prefix("define")
                .filter(|rest| rest.starts_with(char::is_whitespace))
            {
                let name = arguments
                    .trim_start()
                    .split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                    .next()
                    .unwrap_or_default();
                if !name.is_empty() {
                    macros.insert(name.to_owned());
                }
            }
            for byte in &mut masked[range.clone()] {
                if !matches!(*byte, b'\r' | b'\n') {
                    *byte = b' ';
                }
            }
            let mut end = range.end;
            if source[..end].ends_with('\n') {
                end -= 1;
                if source[..end].ends_with('\r') {
                    end -= 1;
                }
            }
            protected.push(Atom {
                range: range.start..end,
                kind: AtomKind::Directive,
                syntax_kind: "directive".into(),
                parent_kind: String::new(),
            });
        }
        let masked = String::from_utf8(masked).map_err(|_| FormatError::InvalidInput)?;
        let tree = parser
            .parse(masked, None)
            .ok_or(FormatError::InvalidInput)?;
        if source.starts_with('\u{feff}') {
            protected.push(Atom {
                range: 0..'\u{feff}'.len_utf8(),
                kind: AtomKind::Code,
                syntax_kind: "bom".into(),
                parent_kind: String::new(),
            });
        }
        collect_atoms(tree.root_node(), source, &macros, &mut protected, 0)?;
        // Outer verbatim spans own their contents (e.g. directives inside macro
        // arguments or a syntax-error region in an inactive branch).
        protected.sort_by_key(|atom| (atom.range.start, std::cmp::Reverse(atom.range.end)));
        let mut atoms: Vec<Atom> = Vec::new();
        for atom in protected {
            if atom.range.is_empty() {
                continue;
            }
            if let Some(previous) = atoms.last() {
                if previous.range.end >= atom.range.end {
                    continue;
                }
                if previous.range.end > atom.range.start {
                    return Err(FormatError::InvalidInput);
                }
            }
            atoms.push(atom);
        }
        let mut end = 0;
        for atom in &atoms {
            if !source[end..atom.range.start]
                .chars()
                .all(char::is_whitespace)
            {
                return Err(FormatError::InvalidInput);
            }
            end = atom.range.end;
        }
        if !source[end..].chars().all(char::is_whitespace) {
            return Err(FormatError::InvalidInput);
        }
        Ok(Self { tree, atoms })
    }

    pub fn index_at(&self, byte: usize) -> Option<usize> {
        self.atoms
            .binary_search_by_key(&byte, |atom| atom.range.start)
            .ok()
    }

    pub fn same_content(&self, source: &str, other: &Self, output: &str) -> bool {
        self.atoms.len() == other.atoms.len()
            && self.atoms.iter().zip(&other.atoms).all(|(left, right)| {
                left.kind == right.kind
                    && left.syntax_kind == right.syntax_kind
                    && left.text(source) == right.text(output)
            })
            && self.tree.root_node().to_sexp() == other.tree.root_node().to_sexp()
    }
}

fn collect_atoms(
    node: Node<'_>,
    source: &str,
    macros: &HashSet<String>,
    output: &mut Vec<Atom>,
    nesting: usize,
) -> Result<(), FormatError> {
    if nesting > 256 {
        return Err(FormatError::ResourceLimit);
    }
    if node.kind() == "closure_expression" {
        let text = &source[node.byte_range()];
        if let (Some(first), Some(last)) = (text.find(':'), text.rfind(':')) {
            output.push(Atom {
                range: node.start_byte()..node.start_byte() + first + 1,
                kind: AtomKind::Code,
                syntax_kind: "closure_open".into(),
                parent_kind: node.kind().into(),
            });
            output.push(Atom {
                range: node.start_byte() + last..node.end_byte(),
                kind: AtomKind::Code,
                syntax_kind: "closure_close".into(),
                parent_kind: node.kind().into(),
            });
        }
    }
    if node.kind() == "macro_control_statement" {
        let mut cursor = node.walk();
        if let Some(close) = node.children(&mut cursor).find(|child| child.kind() == ")") {
            output.push(Atom {
                range: node.start_byte()..close.end_byte(),
                kind: AtomKind::Macro,
                syntax_kind: "macro_control_header".into(),
                parent_kind: node.kind().into(),
            });
        }
    }
    let kind = match node.kind() {
        "comment" => Some(AtomKind::Comment),
        "string_literal" | "character_literal" | "heredoc_literal" | "template_string" => {
            Some(AtomKind::Literal)
        }
        "macro_invocation" | "macro_annotation" => Some(AtomKind::Macro),
        "ERROR" => Some(AtomKind::Error),
        _ => None,
    };
    if let Some(kind) = kind {
        output.push(atom(node, kind));
        return Ok(());
    }
    if node.kind() == "postfix_expression"
        && let Some(value) = node.child_by_field_name("value")
        && value.kind() == "identifier"
        && macros.contains(&source[value.byte_range()])
    {
        let mut cursor = node.walk();
        if let Some(call) = node
            .named_children(&mut cursor)
            .find(|child| child.kind() == "call_suffix")
        {
            output.push(Atom {
                range: value.start_byte()..call.end_byte(),
                kind: AtomKind::Macro,
                syntax_kind: "macro_call".into(),
                parent_kind: node.kind().into(),
            });
        }
    }
    if node.child_count() == 0 && !node.is_missing() {
        output.push(atom(node, AtomKind::Code));
    }
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_atoms(child, source, macros, output, nesting + 1)?;
    }
    Ok(())
}

fn atom(node: Node<'_>, kind: AtomKind) -> Atom {
    Atom {
        range: node.byte_range(),
        kind,
        syntax_kind: node.kind().into(),
        parent_kind: node
            .parent()
            .map_or_else(String::new, |parent| parent.kind().into()),
    }
}
