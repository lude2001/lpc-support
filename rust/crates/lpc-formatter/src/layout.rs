use std::{
    collections::{HashMap, HashSet},
    ops::Range,
    sync::OnceLock,
};

use tree_sitter::Node;

use crate::{
    BraceStyle, FormatError, FormatterConfig,
    source::{Atom, AtomKind, SourceSyntax},
};

#[derive(Clone, Copy)]
enum Spacing {
    Tight,
    Space,
    Line { depth: usize, minimum: usize },
}

#[derive(Clone, Copy)]
struct Gap {
    spacing: Spacing,
    priority: u8,
}

pub(crate) struct WhitespaceEdit {
    pub range: Range<usize>,
    pub text: String,
}

pub(crate) struct Layout<'a> {
    syntax: &'a SourceSyntax,
    source: &'a str,
    config: FormatterConfig,
    gaps: Vec<Gap>,
    depths: Vec<usize>,
    eol: &'static str,
    wrapped_groups: HashSet<usize>,
}

impl<'a> Layout<'a> {
    pub fn build(
        syntax: &'a SourceSyntax,
        source: &'a str,
        config: FormatterConfig,
    ) -> Result<Self, FormatError> {
        let gaps: Vec<_> = syntax
            .atoms
            .iter()
            .enumerate()
            .map(|(i, right)| Gap {
                spacing: if i > 0 && needs_space(&syntax.atoms[i - 1], right, source) {
                    Spacing::Space
                } else {
                    Spacing::Tight
                },
                priority: 0,
            })
            .collect();
        let mut layout = Self {
            syntax,
            source,
            config,
            gaps: gaps.clone(),
            depths: vec![0; syntax.atoms.len()],
            eol: if source.contains("\r\n") {
                "\r\n"
            } else {
                "\n"
            },
            wrapped_groups: HashSet::new(),
        };
        // Propagate multiline children outward and indentation inward without
        // revisiting each subtree twice recursively. Break decisions only grow;
        // the same bounded-depth CST is used throughout, without re-tokenizing.
        for _ in 0..=64 {
            layout.gaps.clone_from(&gaps);
            layout.depths.fill(0);
            let previous = layout.wrapped_groups.len();
            layout.visit(syntax.tree.root_node(), 0, 0)?;
            if previous == layout.wrapped_groups.len() {
                layout.protect_trivia();
                return Ok(layout);
            }
        }
        Err(FormatError::ResourceLimit)
    }

    pub fn edits(&self) -> Vec<WhitespaceEdit> {
        let mut previous = 0;
        self.syntax
            .atoms
            .iter()
            .enumerate()
            .filter_map(|(i, atom)| {
                let range = previous..atom.range.start;
                previous = atom.range.end;
                let old = &self.source[range.clone()];
                let text = match self.gaps[i].spacing {
                    Spacing::Tight => String::new(),
                    Spacing::Space => " ".to_owned(),
                    Spacing::Line { depth, minimum } => {
                        let count = old
                            .bytes()
                            .filter(|byte| *byte == b'\n')
                            .count()
                            .max(minimum);
                        let count = if i == 0 {
                            old.bytes().filter(|byte| *byte == b'\n').count()
                        } else {
                            count
                        };
                        let mut newlines = String::new();
                        for (offset, _) in old.match_indices('\n') {
                            newlines.push_str(
                                if offset > 0 && old.as_bytes()[offset - 1] == b'\r' {
                                    "\r\n"
                                } else {
                                    "\n"
                                },
                            );
                        }
                        let existing = old.bytes().filter(|byte| *byte == b'\n').count();
                        newlines.push_str(&self.eol.repeat(count.saturating_sub(existing)));
                        format!("{}{}", newlines, self.indent(depth))
                    }
                };
                (text != old).then_some(WhitespaceEdit { range, text })
            })
            .collect()
    }

    pub fn indent_at(&self, byte: usize) -> String {
        self.syntax
            .index_at(byte)
            .map(|i| self.indent(self.depths[i]))
            .unwrap_or_default()
    }

    fn indent(&self, depth: usize) -> String {
        if self.config.use_tabs {
            "\t".repeat(depth)
        } else {
            " ".repeat(depth * self.config.indent_size)
        }
    }

    fn set(&mut self, byte: usize, spacing: Spacing, priority: u8) {
        if let Some(i) = self.syntax.index_at(byte)
            && self.gaps[i].priority <= priority
        {
            self.gaps[i] = Gap { spacing, priority };
        }
    }

    fn line(&mut self, byte: usize, depth: usize, minimum: usize, priority: u8) {
        self.set(byte, Spacing::Line { depth, minimum }, priority);
    }

    fn visit(&mut self, node: Node<'_>, depth: usize, nesting: usize) -> Result<(), FormatError> {
        if depth > 64 || nesting > 256 {
            return Err(FormatError::ResourceLimit);
        }
        let start = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < node.start_byte());
        let end = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < node.end_byte());
        for value in &mut self.depths[start..end] {
            *value = depth;
        }
        if let Some(atom) = self.syntax.atoms.get(start)
            && atom.range.start == node.start_byte()
            && atom.range.end >= node.end_byte()
            && atom.kind != AtomKind::Code
        {
            return Ok(());
        }

        let mut cursor = node.walk();
        let children = node.named_children(&mut cursor).collect::<Vec<_>>();
        match node.kind() {
            "source_file" => {
                let mut previous = None;
                for child in children {
                    let minimum = previous.map_or(0, |previous: Node<'_>| {
                        if previous.kind() == "comment"
                            || child.kind() == "comment"
                            || prototype(previous)
                            || prototype(child)
                        {
                            1
                        } else {
                            2
                        }
                    });
                    self.line(child.start_byte(), depth, minimum, 30);
                    self.visit(child, depth, nesting + 1)?;
                    previous = Some(child);
                }
            }
            "block" | "class_declaration" | "struct_declaration" | "switch_statement" => {
                let mut cursor = node.walk();
                let open = node.children(&mut cursor).find(|child| child.kind() == "{");
                let mut cursor = node.walk();
                let close = node
                    .children(&mut cursor)
                    .filter(|child| child.kind() == "}")
                    .last();
                if let (Some(open), Some(close)) = (open, close) {
                    let brace_spacing = match self.config.brace_style {
                        BraceStyle::Allman => Spacing::Line { depth, minimum: 1 },
                        BraceStyle::SameLine => Spacing::Space,
                    };
                    self.set(open.start_byte(), brace_spacing, 40);
                    self.line(close.start_byte(), depth, 1, 50);
                    let mut previous_kind = "";
                    for child in children {
                        let inside = child.start_byte() > open.start_byte()
                            && child.end_byte() <= close.start_byte();
                        if inside {
                            let minimum = if block_separator(previous_kind, child.kind()) {
                                2
                            } else {
                                1
                            };
                            self.line(child.start_byte(), depth + 1, minimum, 50);
                            self.visit(child, depth + 1, nesting + 1)?;
                            previous_kind = child.kind();
                        } else {
                            self.visit(child, depth, nesting + 1)?;
                        }
                    }
                }
            }
            "if_statement" => {
                let consequence = node.child_by_field_name("consequence");
                let alternative = node.child_by_field_name("alternative");
                for child in children {
                    if consequence.is_some_and(|body| body.id() == child.id()) {
                        self.body(child, depth, nesting)?;
                    } else if alternative.is_some_and(|body| body.id() == child.id()) {
                        if child.kind() == "if_statement" {
                            self.set(child.start_byte(), Spacing::Space, 60);
                            self.visit(child, depth, nesting + 1)?;
                        } else {
                            self.body(child, depth, nesting)?;
                        }
                    } else {
                        self.visit(child, depth, nesting + 1)?;
                    }
                }
                let mut cursor = node.walk();
                if let Some(keyword) = node
                    .children(&mut cursor)
                    .find(|child| child.kind() == "else")
                {
                    if self.config.brace_style == BraceStyle::SameLine
                        && consequence.is_some_and(|body| body.kind() == "block")
                    {
                        self.set(keyword.start_byte(), Spacing::Space, 60);
                    } else {
                        self.line(keyword.start_byte(), depth, 1, 60);
                    }
                }
            }
            "for_statement"
            | "foreach_statement"
            | "while_statement"
            | "do_statement"
            | "macro_control_statement" => {
                let body = children
                    .iter()
                    .copied()
                    .find(|child| statement(child.kind()));
                for child in children {
                    if body.is_some_and(|body| body.id() == child.id()) {
                        self.body(child, depth, nesting)?;
                    } else {
                        self.visit(child, depth, nesting + 1)?;
                    }
                }
                if node.kind() == "do_statement" {
                    let mut cursor = node.walk();
                    if let Some(keyword) = node
                        .children(&mut cursor)
                        .find(|child| child.kind() == "while")
                    {
                        if self.config.brace_style == BraceStyle::SameLine
                            && body.is_some_and(|body| body.kind() == "block")
                        {
                            self.set(keyword.start_byte(), Spacing::Space, 60);
                        } else {
                            self.line(keyword.start_byte(), depth, 1, 60);
                        }
                    }
                }
                if node.kind() == "macro_control_statement" {
                    let mut cursor = node.walk();
                    if let Some(keyword) = node
                        .children(&mut cursor)
                        .find(|child| child.kind() == "else")
                    {
                        if self.config.brace_style == BraceStyle::SameLine {
                            self.set(keyword.start_byte(), Spacing::Space, 60);
                        } else {
                            self.line(keyword.start_byte(), depth, 1, 60);
                        }
                    }
                }
            }
            "switch_section" => {
                for child in children {
                    let child_depth = if child.kind() == "switch_label" {
                        depth
                    } else {
                        depth + 1
                    };
                    self.line(child.start_byte(), child_depth, 1, 60);
                    self.visit(child, child_depth, nesting + 1)?;
                }
            }
            "array_literal" | "mapping_literal" | "new_expression" => {
                self.collection(node, children, depth, nesting)?;
            }
            "call_suffix" | "parameter_list" => {
                let already_wrapped = self.wrapped_groups.contains(&node.id());
                for child in &children {
                    self.visit(*child, depth + usize::from(already_wrapped), nesting + 1)?;
                }
                let wrap = already_wrapped || self.wrap_group(node, depth);
                if wrap {
                    self.wrapped_groups.insert(node.id());
                    let mut cursor = node.walk();
                    let open = node.children(&mut cursor).find(|child| child.kind() == "(");
                    let mut cursor = node.walk();
                    let close = node
                        .children(&mut cursor)
                        .filter(|child| child.kind() == ")")
                        .last();
                    if let (Some(open), Some(close)) = (open, close) {
                        self.delimited(open.end_byte(), close.start_byte(), depth);
                    }
                }
            }
            _ => {
                for child in children {
                    self.visit(child, depth, nesting + 1)?;
                }
            }
        }
        Ok(())
    }

    fn body(&mut self, node: Node<'_>, depth: usize, nesting: usize) -> Result<(), FormatError> {
        let body_depth = depth + usize::from(node.kind() != "block");
        if node.kind() != "block" {
            self.line(node.start_byte(), body_depth, 1, 50);
        }
        self.visit(node, body_depth, nesting + 1)
    }

    fn collection(
        &mut self,
        node: Node<'_>,
        children: Vec<Node<'_>>,
        depth: usize,
        nesting: usize,
    ) -> Result<(), FormatError> {
        let start = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < node.start_byte());
        let end = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < node.end_byte());
        let open = self.syntax.atoms.get(start + 1);
        let close_offset = if node.kind() == "new_expression" {
            1
        } else {
            2
        };
        let close = end
            .checked_sub(close_offset)
            .and_then(|i| self.syntax.atoms.get(i));
        if let (Some(open), Some(close)) = (open, close) {
            let open_end = open.range.end;
            let close_start = close.range.start;
            if open_end < close_start
                && self
                    .syntax
                    .atoms
                    .iter()
                    .any(|atom| atom.range.start >= open_end && atom.range.end <= close_start)
            {
                self.delimited(open_end, close_start, depth);
            }
        }
        for child in children {
            self.visit(child, depth + 1, nesting + 1)?;
        }
        Ok(())
    }

    fn delimited(&mut self, start: usize, end: usize, depth: usize) {
        if let Some(first) = self
            .syntax
            .atoms
            .iter()
            .find(|atom| atom.range.start >= start && atom.range.end <= end)
        {
            self.line(first.range.start, depth + 1, 1, 50);
        }
        self.line(end, depth, 1, 55);
        let mut nesting = 0_i32;
        let mut breaks = Vec::new();
        let from = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < start);
        let to = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < end);
        for i in from..to {
            let atom = &self.syntax.atoms[i];
            if atom.kind != AtomKind::Code {
                continue;
            }
            if atom.syntax_kind == "closure_open" {
                nesting += 1;
                continue;
            }
            if atom.syntax_kind == "closure_close" {
                nesting -= 1;
                continue;
            }
            match atom.text(self.source) {
                "(" | "[" | "{" | "(:" => nesting += 1,
                ")" | "]" | "}" | ":)" => nesting -= 1,
                "," if nesting == 0 => {
                    if let Some(next) = self.syntax.atoms.get(i + 1)
                        && next.range.start < end
                    {
                        breaks.push(next.range.start);
                    }
                }
                _ => {}
            }
        }
        for byte in breaks {
            self.line(byte, depth + 1, 1, 50);
        }
    }

    fn wrap_group(&self, node: Node<'_>, depth: usize) -> bool {
        let start = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < node.start_byte());
        let end = self
            .syntax
            .atoms
            .partition_point(|atom| atom.range.start < node.end_byte());
        if end <= start + 2 {
            return false;
        }
        if self.syntax.atoms[start..end]
            .windows(2)
            .any(|pair| self.source[pair[0].range.end..pair[1].range.start].contains('\n'))
            || self.gaps[start + 1..end]
                .iter()
                .any(|gap| matches!(gap.spacing, Spacing::Line { .. }))
        {
            return true;
        }
        if self.config.print_width == 0 {
            return false;
        }
        let width = self.syntax.atoms[start..end]
            .iter()
            .enumerate()
            .map(|(i, atom)| {
                atom.text(self.source).chars().count()
                    + usize::from(
                        i > 0 && needs_space(&self.syntax.atoms[start + i - 1], atom, self.source),
                    )
            })
            .sum::<usize>();
        let mut prefix = depth * self.config.indent_size;
        for i in (0..start).rev() {
            prefix += self.syntax.atoms[i].text(self.source).chars().count()
                + usize::from(matches!(self.gaps[i].spacing, Spacing::Space));
            if matches!(self.gaps[i].spacing, Spacing::Line { .. }) {
                break;
            }
        }
        prefix + width > self.config.print_width
    }

    fn protect_trivia(&mut self) {
        for i in 0..self.syntax.atoms.len() {
            let atom = &self.syntax.atoms[i];
            if atom.kind == AtomKind::Directive {
                self.gaps[i] = Gap {
                    spacing: Spacing::Line {
                        depth: 0,
                        minimum: usize::from(i > 0),
                    },
                    priority: 250,
                };
                if i + 1 < self.gaps.len() {
                    self.gaps[i + 1] = Gap {
                        spacing: Spacing::Line {
                            depth: self.depths[i + 1],
                            minimum: 1,
                        },
                        priority: 240,
                    };
                }
            } else if atom.kind == AtomKind::Comment {
                if i > 0
                    && !self.source[self.syntax.atoms[i - 1].range.end..atom.range.start]
                        .contains('\n')
                    && self.syntax.atoms[i - 1].kind != AtomKind::Directive
                {
                    self.gaps[i] = Gap {
                        spacing: Spacing::Space,
                        priority: 230,
                    };
                } else {
                    self.gaps[i] = Gap {
                        spacing: Spacing::Line {
                            depth: self.depths[i],
                            minimum: usize::from(i > 0),
                        },
                        priority: 230,
                    };
                }
                if i + 1 < self.gaps.len() {
                    if atom.text(self.source).starts_with("//")
                        || self.source[atom.range.end..self.syntax.atoms[i + 1].range.start]
                            .contains('\n')
                    {
                        self.gaps[i + 1] = Gap {
                            spacing: Spacing::Line {
                                depth: self.depths[i + 1],
                                minimum: 1,
                            },
                            priority: 230,
                        };
                    } else {
                        self.gaps[i + 1] = Gap {
                            spacing: Spacing::Space,
                            priority: 230,
                        };
                    }
                }
            }
        }
    }
}

fn prototype(node: Node<'_>) -> bool {
    node.kind() == "function_declaration" && node.child_by_field_name("body").is_none()
}
fn statement(kind: &str) -> bool {
    kind == "block" || kind.ends_with("_statement")
}
fn block_separator(previous: &str, current: &str) -> bool {
    if previous.is_empty() {
        return false;
    }
    let declaration = |kind: &str| matches!(kind, "variable_declaration" | "function_declaration");
    let control = |kind: &str| kind.ends_with("_statement") && kind != "expression_statement";
    (declaration(previous) && !declaration(current)) || control(previous) || control(current)
}

fn needs_space(left: &Atom, right: &Atom, source: &str) -> bool {
    let a = left.text(source);
    let b = right.text(source);
    if joins_punctuator(a, b) {
        return true;
    }
    if matches!(b, ")" | "]" | "," | ";") || matches!(a, "(" | "[") {
        return false;
    }
    if matches!(a, "::" | "->" | "." | "?." | ".?") || matches!(b, "::" | "->" | "." | "?." | ".?")
    {
        return false;
    }
    if b == "[" {
        return false;
    }
    if (a == "<" && left.parent_kind == "promise_type")
        || (matches!(b, "<" | ">") && right.parent_kind == "promise_type")
    {
        return false;
    }
    if b == "(" {
        if matches!(
            a,
            "=" | ":" | "+" | "-" | "*" | "/" | "%" | "&&" | "||" | "??" | "?" | ","
        ) {
            return true;
        }
        if matches!(
            a,
            "if" | "while" | "for" | "foreach" | "switch" | "return" | "await"
        ) {
            return true;
        }
        // The CST's uppercase macro token is adjacency-sensitive; keep its
        // original classification when an ordinary call used a separating gap.
        if a.bytes().any(|byte| byte.is_ascii_uppercase())
            && a.bytes().all(|byte| !byte.is_ascii_lowercase())
            && !source[left.range.end..right.range.start].is_empty()
        {
            return true;
        }
        return false;
    }
    if (a == "{" && left.parent_kind == "array_literal")
        || (b == "{" && right.parent_kind == "array_literal")
    {
        return false;
    }
    if b == "}" && right.parent_kind == "array_literal" {
        return false;
    }
    if a == "$"
        || b == "..."
        || (b == ":"
            && matches!(
                right.parent_kind.as_str(),
                "switch_label" | "modifier_section"
            ))
    {
        return false;
    }
    if matches!(a, "++" | "--" | "!" | "~" | "+" | "-" | "*" | "&")
        && matches!(
            left.parent_kind.as_str(),
            "unary_expression"
                | "reference_expression"
                | "update_expression"
                | "variable_declarator"
                | "parameter"
                | "foreach_variable"
                | "field_declaration"
        )
    {
        return false;
    }
    if matches!(b, "++" | "--") && right.parent_kind == "postfix_expression" {
        return false;
    }
    if b == "*" && matches!(a, "*" | "(") {
        return false;
    }
    true
}

fn joins_punctuator(left: &str, right: &str) -> bool {
    if !right
        .as_bytes()
        .first()
        .is_some_and(u8::is_ascii_punctuation)
    {
        return false;
    }
    // Use the generated grammar's anonymous token contract. A context-sensitive
    // CST can otherwise still accept ': ::name' after an unsafe join to ':::'.
    static BOUNDARIES: OnceLock<(usize, HashMap<String, Vec<String>>)> = OnceLock::new();
    let (maximum, boundaries) = BOUNDARIES.get_or_init(|| {
        let language: tree_sitter::Language = tree_sitter_lpc_support::LANGUAGE.into();
        let mut tokens = (0..language.node_kind_count() as u16)
            .filter(|id| !language.node_kind_is_named(*id))
            .filter_map(|id| language.node_kind_for_id(id))
            .filter(|token| {
                token.len() > 1 && token.bytes().all(|byte| byte.is_ascii_punctuation())
            })
            .map(str::to_owned)
            .collect::<Vec<_>>();
        tokens.extend(["/*".into(), "//".into(), "(:".into(), ":)".into()]);
        let mut boundaries: HashMap<String, Vec<String>> = HashMap::new();
        let mut maximum = 0;
        for token in tokens {
            for split in 1..token.len() {
                maximum = maximum.max(split);
                boundaries
                    .entry(token[..split].into())
                    .or_default()
                    .push(token[split..].into());
            }
        }
        (maximum, boundaries)
    });
    let suffix = left
        .rsplit(|ch: char| !ch.is_ascii_punctuation())
        .next()
        .unwrap_or_default();
    (1..=suffix.len().min(*maximum)).any(|length| {
        boundaries
            .get(&suffix[suffix.len() - length..])
            .is_some_and(|tails| tails.iter().any(|tail| right.starts_with(tail)))
    })
}

pub(crate) fn apply_edits(source: &str, edits: &[WhitespaceEdit]) -> Result<String, FormatError> {
    let mut output = String::with_capacity(source.len());
    let mut offset = 0;
    for edit in edits {
        if edit.range.start < offset
            || !source[edit.range.clone()].chars().all(char::is_whitespace)
            || !edit.text.chars().all(char::is_whitespace)
        {
            return Err(FormatError::UnsafeOutput);
        }
        output.push_str(&source[offset..edit.range.start]);
        output.push_str(&edit.text);
        offset = edit.range.end;
        if output.len() > source.len().saturating_mul(16).saturating_add(4096) {
            return Err(FormatError::ResourceLimit);
        }
    }
    output.push_str(&source[offset..]);
    Ok(output)
}
