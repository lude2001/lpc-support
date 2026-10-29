use std::{collections::HashMap, time::Instant};

use anyhow::{Context, Result};
use lpc_analysis::Locale;
use lpc_preprocessor::{InactiveRegion, IncludeFact, MacroDirectiveFact};
use lpc_protocol::SyntaxPerformanceStatus;
use tree_sitter::{InputEdit, Parser, Point, Tree};
use url::Url;

use crate::document_store::{AppliedEdit, DocumentSnapshot};
use crate::project_preprocessor::{ProjectPreprocessor, WorkspacePreprocessorConfig};

#[derive(Debug)]
pub struct SyntaxSnapshot {
    pub version: i32,
    pub revision: u64,
    pub tree: Tree,
    pub parse_time_micros: u64,
    pub incremental: bool,
    pub preprocessed_text: String,
    pub includes: Vec<IncludeFact>,
    pub inactive_regions: Vec<InactiveRegion>,
    pub macro_directives: Vec<MacroDirectiveFact>,
    pub predefined_macros: HashMap<String, String>,
}

pub struct SyntaxStore {
    locale: Locale,
    parser: Parser,
    preprocessor: ProjectPreprocessor,
    snapshots: HashMap<String, SyntaxSnapshot>,
    metrics: SyntaxPerformanceStatus,
}

impl SyntaxStore {
    /// English-default entry point retained for existing callers.
    #[allow(dead_code)]
    pub fn new() -> Result<Self> {
        Self::new_with_locale(Locale::En)
    }

    pub fn new_with_locale(locale: Locale) -> Result<Self> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .context(locale.text(
                "failed to load the generated LPC grammar",
                "加载生成的 LPC 语法失败",
            ))?;
        Ok(Self {
            locale,
            parser,
            preprocessor: ProjectPreprocessor::default(),
            snapshots: HashMap::new(),
            metrics: SyntaxPerformanceStatus::default(),
        })
    }

    pub fn open(&mut self, document: &DocumentSnapshot) -> Result<&SyntaxSnapshot> {
        self.parse(document, &[], true)
    }

    pub fn change(
        &mut self,
        document: &DocumentSnapshot,
        edits: &[AppliedEdit],
        contains_full_replacement: bool,
    ) -> Result<&SyntaxSnapshot> {
        self.parse(document, edits, contains_full_replacement)
    }

    pub fn close(&mut self, uri: &str) {
        self.snapshots.remove(uri);
    }

    pub fn configure_preprocessor(
        &mut self,
        definitions: Vec<(String, String)>,
        workspaces: Vec<WorkspacePreprocessorConfig>,
    ) {
        self.preprocessor.configure(definitions, workspaces);
    }

    pub fn set_efuns(&mut self, names: Vec<String>) {
        self.preprocessor.set_efuns(names);
    }

    pub fn invalidate_preprocessor_cache(&mut self) {
        self.preprocessor.clear_cache();
    }

    pub fn set_open_header(&mut self, uri: &str, source: &str) {
        if let Some(path) = Url::parse(uri).ok().and_then(|uri| uri.to_file_path().ok()) {
            self.preprocessor.set_open_header(&path, source);
        }
    }

    pub fn remove_open_header(&mut self, uri: &str) {
        if let Some(path) = Url::parse(uri).ok().and_then(|uri| uri.to_file_path().ok()) {
            self.preprocessor.remove_open_header(&path);
        }
    }

    pub fn get(&self, uri: &str) -> Option<&SyntaxSnapshot> {
        self.snapshots.get(uri)
    }

    pub fn metrics(&self) -> SyntaxPerformanceStatus {
        self.metrics.clone()
    }

    fn parse(
        &mut self,
        document: &DocumentSnapshot,
        edits: &[AppliedEdit],
        force_full_parse: bool,
    ) -> Result<&SyntaxSnapshot> {
        let path = Url::parse(&document.uri)
            .ok()
            .and_then(|uri| uri.to_file_path().ok());
        let preprocessed = self.preprocessor.process(path.as_deref(), &document.text);
        let can_increment = !force_full_parse
            && !edits.is_empty()
            && self
                .snapshots
                .get(&document.uri)
                .is_some_and(|snapshot| snapshot.version < document.version);
        let mut previous_tree = can_increment
            .then(|| {
                self.snapshots
                    .get(&document.uri)
                    .map(|snapshot| snapshot.tree.clone())
            })
            .flatten();

        if let Some(tree) = previous_tree.as_mut()
            && let Some(previous) = self.snapshots.get(&document.uri)
            && let Some(edit) = diff_input_edit(&previous.preprocessed_text, &preprocessed.text)
        {
            tree.edit(&edit);
        }

        let started_at = Instant::now();
        let tree = self
            .parser
            .parse(&preprocessed.text, previous_tree.as_ref())
            .context(self.locale.text(
                "Tree-sitter cancelled LPC parsing",
                "Tree-sitter 已取消 LPC 解析",
            ))?;
        let elapsed = started_at.elapsed().as_micros().min(u128::from(u64::MAX)) as u64;

        self.metrics.parse_count += 1;
        self.metrics.total_parse_time_micros += elapsed;
        if can_increment {
            self.metrics.incremental_parse_count += 1;
        } else {
            self.metrics.full_parse_count += 1;
        }

        self.snapshots.insert(
            document.uri.clone(),
            SyntaxSnapshot {
                version: document.version,
                revision: document.revision,
                tree,
                parse_time_micros: elapsed,
                incremental: can_increment,
                preprocessed_text: preprocessed.text,
                includes: preprocessed.includes,
                inactive_regions: preprocessed.inactive_regions,
                macro_directives: preprocessed.macro_directives,
                predefined_macros: preprocessed.initial_definitions,
            },
        );
        self.snapshots.get(&document.uri).context(self.locale.text(
            "syntax snapshot disappeared after insertion",
            "插入后语法快照已不存在",
        ))
    }
}

fn diff_input_edit(previous: &str, next: &str) -> Option<InputEdit> {
    if previous == next {
        return None;
    }
    let prefix = common_prefix_boundary(previous, next);
    let suffix = common_suffix_len(previous, next, prefix);
    let old_end = previous.len() - suffix;
    let new_end = next.len() - suffix;
    let (start_row, start_column) = byte_point(previous, prefix);
    let (old_end_row, old_end_column) = byte_point(previous, old_end);
    let (new_end_row, new_end_column) = byte_point(next, new_end);
    Some(InputEdit {
        start_byte: prefix,
        old_end_byte: old_end,
        new_end_byte: new_end,
        start_position: Point::new(start_row, start_column),
        old_end_position: Point::new(old_end_row, old_end_column),
        new_end_position: Point::new(new_end_row, new_end_column),
    })
}

fn common_prefix_boundary(left: &str, right: &str) -> usize {
    let mut prefix = left
        .as_bytes()
        .iter()
        .zip(right.as_bytes())
        .take_while(|(left, right)| left == right)
        .count();
    while prefix > 0 && (!left.is_char_boundary(prefix) || !right.is_char_boundary(prefix)) {
        prefix -= 1;
    }
    prefix
}

fn common_suffix_len(left: &str, right: &str, prefix: usize) -> usize {
    let max_suffix = left.len().min(right.len()).saturating_sub(prefix);
    let mut suffix = left
        .as_bytes()
        .iter()
        .rev()
        .zip(right.as_bytes().iter().rev())
        .take(max_suffix)
        .take_while(|(left, right)| left == right)
        .count();
    while suffix > 0
        && (!left.is_char_boundary(left.len() - suffix)
            || !right.is_char_boundary(right.len() - suffix))
    {
        suffix -= 1;
    }
    suffix
}

fn byte_point(text: &str, offset: usize) -> (usize, usize) {
    let prefix = &text[..offset];
    let row = prefix.bytes().filter(|byte| *byte == b'\n').count();
    let column = prefix
        .rfind('\n')
        .map_or(prefix.len(), |last_newline| prefix.len() - last_newline - 1);
    (row, column)
}

#[cfg(test)]
mod tests {
    use crate::document_store::{ContentChange, DocumentStore, Position, Range};

    use super::*;

    #[test]
    fn reuses_the_previous_tree_for_an_incremental_edit() {
        let uri = "file:///incremental.c";
        let mut documents = DocumentStore::default();
        let mut syntax = SyntaxStore::new().unwrap();
        documents.open(uri.into(), 1, "int query_value() { return 1; }\n".into());
        syntax.open(documents.get(uri).unwrap()).unwrap();

        let result = documents
            .change(
                uri,
                2,
                &[ContentChange {
                    range: Some(Range {
                        start: Position {
                            line: 0,
                            character: 27,
                        },
                        end: Position {
                            line: 0,
                            character: 28,
                        },
                    }),
                    text: "2".into(),
                }],
            )
            .unwrap();
        let snapshot = syntax
            .change(
                documents.get(uri).unwrap(),
                &result.edits,
                result.contains_full_replacement,
            )
            .unwrap();

        assert!(snapshot.incremental);
        assert!(
            !snapshot.tree.root_node().has_error(),
            "{}",
            snapshot.tree.root_node().to_sexp()
        );
        assert_eq!(syntax.metrics().full_parse_count, 1);
        assert_eq!(syntax.metrics().incremental_parse_count, 1);
    }

    #[test]
    fn reparses_changed_conditional_regions_with_identity_source_ranges() {
        let uri = "file:///conditional.c";
        let mut documents = DocumentStore::default();
        let mut syntax = SyntaxStore::new().unwrap();
        documents.open(
            uri.into(),
            1,
            "#if 0\nthis is invalid LPC\n#else\nint enabled;\n#endif\n".into(),
        );
        let initial = syntax.open(documents.get(uri).unwrap()).unwrap();
        assert!(!initial.tree.root_node().has_error());
        assert_eq!(initial.inactive_regions.len(), 1);

        let result = documents
            .change(
                uri,
                2,
                &[ContentChange {
                    range: Some(Range {
                        start: Position {
                            line: 0,
                            character: 4,
                        },
                        end: Position {
                            line: 0,
                            character: 5,
                        },
                    }),
                    text: "1".into(),
                }],
            )
            .unwrap();
        let changed = syntax
            .change(
                documents.get(uri).unwrap(),
                &result.edits,
                result.contains_full_replacement,
            )
            .unwrap();

        assert!(changed.incremental);
        assert!(changed.tree.root_node().has_error());
        assert_eq!(changed.inactive_regions.len(), 1);
    }

    #[test]
    fn exposes_include_facts_from_the_preprocessor() {
        let uri = "file:///include.c";
        let mut documents = DocumentStore::default();
        let mut syntax = SyntaxStore::new().unwrap();
        documents.open(uri.into(), 1, "#include <mudlib.h>\nint value;\n".into());
        let snapshot = syntax.open(documents.get(uri).unwrap()).unwrap();
        assert_eq!(snapshot.includes.len(), 1);
        assert_eq!(snapshot.includes[0].path, "mudlib.h");
    }

    #[test]
    fn localizes_parse_failure_without_creating_a_snapshot_or_counting_a_parse() {
        for (locale, message) in [
            (Locale::En, "Tree-sitter cancelled LPC parsing"),
            (Locale::ZhCn, "Tree-sitter 已取消 LPC 解析"),
        ] {
            let mut syntax = SyntaxStore::new_with_locale(locale).unwrap();
            // A parser without an assigned language returns no tree.
            syntax.parser = Parser::new();
            let document = DocumentSnapshot {
                uri: "file:///fixture/原文.c".into(),
                version: 1,
                revision: 1,
                text: "int value;\n".into(),
            };
            assert_eq!(syntax.open(&document).unwrap_err().to_string(), message);
            assert!(syntax.get(&document.uri).is_none());
            assert_eq!(syntax.metrics().parse_count, 0);
            assert_eq!(syntax.metrics().full_parse_count, 0);
        }
    }

    #[test]
    fn locale_does_not_change_syntax_or_preprocessed_source() {
        let document = DocumentSnapshot {
            uri: "file:///fixture/locale.c".into(),
            version: 1,
            revision: 1,
            text: "#include <mudlib.h>\nstring value = \"原文 😀\";\n".into(),
        };
        let views = [Locale::En, Locale::ZhCn].map(|locale| {
            let mut syntax = SyntaxStore::new_with_locale(locale).unwrap();
            let snapshot = syntax.open(&document).unwrap();
            (
                snapshot.tree.root_node().to_sexp(),
                snapshot.preprocessed_text.clone(),
                snapshot.includes[0].path.clone(),
            )
        });
        assert_eq!(views[0], views[1]);
        assert_eq!(views[0].2, "mudlib.h");
        assert_eq!(SyntaxStore::new().unwrap().locale, Locale::En);
    }
}
