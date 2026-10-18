//! CST-driven whitespace edits with a production token/structure safety gate.

use std::{fmt, ops::Range};
use tree_sitter::{Node, Parser, Tree};

mod layout;
mod source;
use layout::{Layout, WhitespaceEdit, apply_edits};
use source::SourceSyntax;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum BraceStyle {
    #[default]
    Allman,
    SameLine,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FormatterConfig {
    pub indent_size: usize,
    /// Zero disables automatic wrapping; existing multiline groups stay multiline.
    pub print_width: usize,
    pub brace_style: BraceStyle,
    pub use_tabs: bool,
}
impl Default for FormatterConfig {
    fn default() -> Self {
        Self {
            indent_size: 4,
            print_width: 100,
            brace_style: BraceStyle::Allman,
            use_tabs: false,
        }
    }
}
impl FormatterConfig {
    fn normalized(self) -> Self {
        Self {
            indent_size: self.indent_size.clamp(1, 16),
            print_width: if self.print_width == 0 {
                0
            } else {
                self.print_width.clamp(20, 400)
            },
            ..self
        }
    }
}

/// Facts from the Rust preprocessor snapshot, including imported headers.
/// Macro calls keep their argument spelling even when a branch uses '#' or '##'.
#[derive(Debug, Clone, Default)]
pub struct FormatContext {
    pub macro_names: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FormatError {
    InvalidInput,
    UnsafeOutput,
    UnstableOutput,
    ResourceLimit,
    InvalidRange,
}
impl fmt::Display for FormatError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidInput => "input cannot be safely formatted",
            Self::UnsafeOutput => "output changes source tokens or syntax structure",
            Self::UnstableOutput => "output is not idempotent",
            Self::ResourceLimit => "formatting resource limit exceeded",
            Self::InvalidRange => "invalid formatting range",
        })
    }
}
impl std::error::Error for FormatError {}

fn parser() -> Result<Parser, FormatError> {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .map_err(|_| FormatError::InvalidInput)?;
    Ok(parser)
}

pub fn format_document(tree: &Tree, source: &str, config: FormatterConfig) -> Option<String> {
    format_document_checked(tree, source, config, &FormatContext::default()).ok()
}

pub fn format_document_checked(
    tree: &Tree,
    source: &str,
    config: FormatterConfig,
    context: &FormatContext,
) -> Result<String, FormatError> {
    if tree.root_node().has_error() {
        return Err(FormatError::InvalidInput);
    }
    if source.len() > 8 * 1024 * 1024 {
        return Err(FormatError::ResourceLimit);
    }
    let config = config.normalized();
    let mut parser = parser()?;
    let before = SourceSyntax::parse(&mut parser, source, context)?;
    let output = apply_edits(source, &Layout::build(&before, source, config)?.edits())?;
    validate_output(&mut parser, &before, source, &output, config, context)?;
    Ok(output)
}

fn validate_output(
    parser: &mut Parser,
    before: &SourceSyntax,
    source: &str,
    output: &str,
    config: FormatterConfig,
    context: &FormatContext,
) -> Result<(), FormatError> {
    let after = SourceSyntax::parse(parser, output, context)?;
    if !before.same_content(source, &after, output) {
        return Err(FormatError::UnsafeOutput);
    }
    let again = apply_edits(output, &Layout::build(&after, output, config)?.edits())?;
    if again != output {
        return Err(FormatError::UnstableOutput);
    }
    Ok(())
}

pub fn format_node(node: Node<'_>, source: &str, config: FormatterConfig) -> Option<String> {
    let mut parser = parser().ok()?;
    let tree = parser.parse(source, None)?;
    format_range(&tree, source, node.start_byte(), node.end_byte(), config)
        .map(|(_, output)| output)
}

pub fn format_range(
    tree: &Tree,
    source: &str,
    start_byte: usize,
    end_byte: usize,
    config: FormatterConfig,
) -> Option<(Range<usize>, String)> {
    format_range_checked(
        tree,
        source,
        start_byte,
        end_byte,
        config,
        &FormatContext::default(),
    )
    .ok()
}

pub fn format_range_checked(
    tree: &Tree,
    source: &str,
    start_byte: usize,
    end_byte: usize,
    config: FormatterConfig,
    context: &FormatContext,
) -> Result<(Range<usize>, String), FormatError> {
    if start_byte > end_byte
        || end_byte > source.len()
        || !source.is_char_boundary(start_byte)
        || !source.is_char_boundary(end_byte)
    {
        return Err(FormatError::InvalidRange);
    }
    format_document_checked(tree, source, config, context)?;
    let config = config.normalized();
    let mut parser = parser()?;
    let (range, output) =
        range_candidate(&mut parser, source, start_byte, end_byte, config, context)?;
    let output_end = output.len() - (source.len() - range.end);
    let (_, repeated) = range_candidate(
        &mut parser,
        &output,
        range.start,
        output_end,
        config,
        context,
    )?;
    if repeated != output {
        return Err(FormatError::UnstableOutput);
    }
    Ok((range.clone(), output[range.start..output_end].to_owned()))
}

fn range_candidate(
    parser: &mut Parser,
    source: &str,
    start_byte: usize,
    end_byte: usize,
    config: FormatterConfig,
    context: &FormatContext,
) -> Result<(Range<usize>, String), FormatError> {
    let before = SourceSyntax::parse(parser, source, context)?;
    let plan = Layout::build(&before, source, config)?;
    let selected = &source[start_byte..end_byte];
    if selected.trim().is_empty() {
        return Ok((start_byte..end_byte, source.to_owned()));
    }
    let lookup_start = start_byte + selected.len() - selected.trim_start().len();
    let lookup_end = start_byte + selected.trim_end().len();
    let mut target = before.tree.root_node();
    loop {
        let mut cursor = target.walk();
        let next = target.named_children(&mut cursor).find(|child| {
            child.start_byte() <= lookup_start
                && child.end_byte() >= lookup_end
                && !matches!(child.kind(), "comment" | "preprocessor_directive")
        });
        match next {
            Some(child) => target = child,
            None => break,
        }
    }
    while target.parent().is_some() && !format_unit(target.kind()) {
        target = target.parent().unwrap();
    }
    if target.kind() == "source_file" {
        let output = apply_edits(source, &plan.edits())?;
        validate_output(parser, &before, source, &output, config, context)?;
        return Ok((0..source.len(), output));
    }
    let mut range = target.byte_range();
    let line_start = source[..range.start]
        .rfind('\n')
        .map_or(0, |offset| offset + 1);
    let starts_line = source[line_start..range.start]
        .chars()
        .all(char::is_whitespace);
    if starts_line {
        range.start = line_start;
    }
    let mut edits = plan
        .edits()
        .into_iter()
        .filter(|edit| edit.range.start >= range.start && edit.range.end <= range.end)
        .collect::<Vec<_>>();
    if starts_line {
        edits.retain(|edit| edit.range.start >= target.start_byte());
        edits.insert(
            0,
            WhitespaceEdit {
                range: range.start..target.start_byte(),
                text: plan.indent_at(target.start_byte()),
            },
        );
    }
    let output = apply_edits(source, &edits)?;
    let after = SourceSyntax::parse(parser, &output, context)?;
    if !before.same_content(source, &after, &output) {
        return Err(FormatError::UnsafeOutput);
    }
    Ok((range, output))
}

fn format_unit(kind: &str) -> bool {
    kind == "source_file"
        || kind == "block"
        || kind.ends_with("_statement")
        || kind.ends_with("_declaration")
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod upgrade_tests;
