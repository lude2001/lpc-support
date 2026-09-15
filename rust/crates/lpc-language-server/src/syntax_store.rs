use std::{collections::HashMap, time::Instant};

use anyhow::{Context, Result};
use lpc_protocol::SyntaxPerformanceStatus;
use tree_sitter::{InputEdit, Parser, Point, Tree};

use crate::document_store::{AppliedEdit, DocumentSnapshot};

#[derive(Debug)]
pub struct SyntaxSnapshot {
    pub version: i32,
    pub revision: u64,
    pub tree: Tree,
    pub parse_time_micros: u64,
    pub incremental: bool,
}

pub struct SyntaxStore {
    parser: Parser,
    snapshots: HashMap<String, SyntaxSnapshot>,
    metrics: SyntaxPerformanceStatus,
}

impl SyntaxStore {
    pub fn new() -> Result<Self> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .context("failed to load the generated LPC grammar")?;
        Ok(Self {
            parser,
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

        if let Some(tree) = previous_tree.as_mut() {
            for edit in edits {
                tree.edit(&InputEdit {
                    start_byte: edit.start_byte,
                    old_end_byte: edit.old_end_byte,
                    new_end_byte: edit.new_end_byte,
                    start_position: Point::new(edit.start_row, edit.start_column_bytes),
                    old_end_position: Point::new(edit.old_end_row, edit.old_end_column_bytes),
                    new_end_position: Point::new(edit.new_end_row, edit.new_end_column_bytes),
                });
            }
        }

        let started_at = Instant::now();
        let tree = self
            .parser
            .parse(&document.text, previous_tree.as_ref())
            .context("Tree-sitter cancelled LPC parsing")?;
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
            },
        );
        self.snapshots
            .get(&document.uri)
            .context("syntax snapshot disappeared after insertion")
    }
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
}
