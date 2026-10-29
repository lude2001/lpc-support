use std::collections::HashMap;

use anyhow::{Result, anyhow, bail};
use lpc_analysis::Locale;
use lpc_protocol::DocumentPerformanceStatus;
use serde::Deserialize;

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct ContentChange {
    pub range: Option<Range>,
    pub text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppliedEdit {
    pub start_byte: usize,
    pub old_end_byte: usize,
    pub new_end_byte: usize,
    pub start_row: usize,
    pub start_column_bytes: usize,
    pub old_end_row: usize,
    pub old_end_column_bytes: usize,
    pub new_end_row: usize,
    pub new_end_column_bytes: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ChangeResult {
    pub edits: Vec<AppliedEdit>,
    pub contains_full_replacement: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentSnapshot {
    pub uri: String,
    pub version: i32,
    pub text: String,
    pub revision: u64,
}

#[derive(Debug, Default)]
pub struct DocumentStore {
    locale: Locale,
    documents: HashMap<String, DocumentSnapshot>,
    next_revision: u64,
    metrics: DocumentPerformanceStatus,
}

impl DocumentStore {
    pub fn with_locale(locale: Locale) -> Self {
        Self {
            locale,
            ..Self::default()
        }
    }

    pub fn open(&mut self, uri: String, version: i32, text: String) {
        let revision = self.allocate_revision();
        self.documents.insert(
            uri.clone(),
            DocumentSnapshot {
                uri,
                version,
                text,
                revision,
            },
        );
        self.metrics.open_count += 1;
    }

    pub fn change(
        &mut self,
        uri: &str,
        version: i32,
        changes: &[ContentChange],
    ) -> Result<ChangeResult> {
        let locale = self.locale;
        let Some(current) = self.documents.get(uri) else {
            self.metrics.rejected_change_count += 1;
            bail!(match locale {
                Locale::En => format!("received a change for unopened document {uri}"),
                Locale::ZhCn => format!("收到未打开文档 {uri} 的更改"),
            });
        };
        if version <= current.version {
            self.metrics.rejected_change_count += 1;
            bail!(match locale {
                Locale::En => format!(
                    "received stale document version {version} for {uri}; current version is {}",
                    current.version
                ),
                Locale::ZhCn => format!(
                    "收到文档 {uri} 的过时版本 {version}；当前版本为 {}",
                    current.version
                ),
            });
        }

        let mut next_text = current.text.clone();
        let mut full_replacements = 0_u64;
        let mut incremental_edits = 0_u64;
        let mut result = ChangeResult::default();
        for change in changes {
            match change.range {
                Some(range) => {
                    result.edits.push(apply_incremental_change(
                        &mut next_text,
                        range,
                        &change.text,
                        locale,
                    )?);
                    incremental_edits += 1;
                }
                None => {
                    next_text = change.text.clone();
                    full_replacements += 1;
                    result.edits.clear();
                    result.contains_full_replacement = true;
                }
            }
        }

        let revision = self.allocate_revision();
        let document = self.documents.get_mut(uri).ok_or_else(|| {
            anyhow!(locale.text(
                "document disappeared while applying changes",
                "应用更改时文档已不存在"
            ))
        })?;
        document.text = next_text;
        document.version = version;
        document.revision = revision;
        self.metrics.full_replacement_count += full_replacements;
        self.metrics.incremental_edit_count += incremental_edits;
        Ok(result)
    }

    pub fn close(&mut self, uri: &str) -> Option<DocumentSnapshot> {
        let removed = self.documents.remove(uri);
        if removed.is_some() {
            self.metrics.close_count += 1;
        }
        removed
    }

    pub fn get(&self, uri: &str) -> Option<&DocumentSnapshot> {
        self.documents.get(uri)
    }

    pub fn len(&self) -> usize {
        self.documents.len()
    }

    pub fn is_empty(&self) -> bool {
        self.documents.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = &DocumentSnapshot> {
        self.documents.values()
    }

    pub fn metrics(&self) -> DocumentPerformanceStatus {
        self.metrics.clone()
    }

    fn allocate_revision(&mut self) -> u64 {
        self.next_revision += 1;
        self.next_revision
    }
}

fn apply_incremental_change(
    text: &mut String,
    range: Range,
    replacement: &str,
    locale: Locale,
) -> Result<AppliedEdit> {
    let start = position_to_offset(text, range.start, locale)?;
    let end = position_to_offset(text, range.end, locale)?;
    if start > end {
        bail!(locale.text(
            "incremental edit start is after its end",
            "增量编辑起点位于终点之后"
        ));
    }
    let (start_row, start_column_bytes) = byte_point_at(text, start);
    let (old_end_row, old_end_column_bytes) = byte_point_at(text, end);
    let (new_end_row, new_end_column_bytes) =
        replacement_end_point(start_row, start_column_bytes, replacement, locale);
    let new_end_byte = start + replacement.len();
    text.replace_range(start..end, replacement);
    Ok(AppliedEdit {
        start_byte: start,
        old_end_byte: end,
        new_end_byte,
        start_row,
        start_column_bytes,
        old_end_row,
        old_end_column_bytes,
        new_end_row,
        new_end_column_bytes,
    })
}

fn byte_point_at(text: &str, offset: usize) -> (usize, usize) {
    let prefix = &text[..offset];
    let row = prefix.bytes().filter(|byte| *byte == b'\n').count();
    let column = prefix
        .rfind('\n')
        .map_or(prefix.len(), |last_newline| prefix.len() - last_newline - 1);
    (row, column)
}

fn replacement_end_point(
    start_row: usize,
    start_column_bytes: usize,
    replacement: &str,
    locale: Locale,
) -> (usize, usize) {
    let newline_count = replacement.bytes().filter(|byte| *byte == b'\n').count();
    if newline_count == 0 {
        return (start_row, start_column_bytes + replacement.len());
    }

    let last_newline = replacement.rfind('\n').unwrap_or_else(|| {
        panic!(
            "{}",
            locale.text("newline count was positive", "换行计数为正时应存在换行符")
        )
    });
    (
        start_row + newline_count,
        replacement.len() - last_newline - 1,
    )
}

fn position_to_offset(text: &str, position: Position, locale: Locale) -> Result<usize> {
    let mut line_start = 0_usize;
    let mut current_line = 0_u32;

    while current_line < position.line {
        let Some(relative_newline) = text[line_start..].find('\n') else {
            bail!(match locale {
                Locale::En => format!("line {} is outside the document", position.line),
                Locale::ZhCn => format!("行 {} 超出文档范围", position.line),
            });
        };
        line_start += relative_newline + 1;
        current_line += 1;
    }

    let remaining = &text[line_start..];
    let line_end = remaining.find('\n').unwrap_or(remaining.len());
    let line = remaining[..line_end]
        .strip_suffix('\r')
        .unwrap_or(&remaining[..line_end]);
    let target_utf16 = position.character as usize;
    let mut consumed_utf16 = 0_usize;

    for (byte_offset, character) in line.char_indices() {
        if consumed_utf16 == target_utf16 {
            return Ok(line_start + byte_offset);
        }
        consumed_utf16 += character.len_utf16();
        if consumed_utf16 > target_utf16 {
            bail!(locale.text(
                "position splits a UTF-16 surrogate pair",
                "位置位于 UTF-16 代理项对内部"
            ));
        }
    }

    if consumed_utf16 == target_utf16 {
        return Ok(line_start + line.len());
    }

    bail!(match locale {
        Locale::En => format!(
            "character {} is outside line {}",
            position.character, position.line
        ),
        Locale::ZhCn => format!(
            "字符 {} 超出行 {} 的范围",
            position.character, position.line
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn position(line: u32, character: u32) -> Position {
        Position { line, character }
    }

    #[test]
    fn applies_multiple_incremental_changes_in_lsp_order() {
        let mut store = DocumentStore::default();
        store.open("file:///demo.c".into(), 1, "void demo() {}\n".into());

        store
            .change(
                "file:///demo.c",
                2,
                &[
                    ContentChange {
                        range: Some(Range {
                            start: position(0, 5),
                            end: position(0, 9),
                        }),
                        text: "query".into(),
                    },
                    ContentChange {
                        range: Some(Range {
                            start: position(0, 14),
                            end: position(0, 14),
                        }),
                        text: "return 1; ".into(),
                    },
                ],
            )
            .unwrap();

        let snapshot = store.get("file:///demo.c").unwrap();
        assert_eq!(snapshot.text, "void query() {return 1; }\n");
        assert_eq!(snapshot.version, 2);
        assert_eq!(store.metrics().incremental_edit_count, 2);
    }

    #[test]
    fn interprets_lsp_characters_as_utf16_code_units() {
        let mut store = DocumentStore::default();
        store.open(
            "file:///unicode.c".into(),
            1,
            "string value = \"a😀b\";\n".into(),
        );

        store
            .change(
                "file:///unicode.c",
                2,
                &[ContentChange {
                    range: Some(Range {
                        start: position(0, 19),
                        end: position(0, 20),
                    }),
                    text: "c".into(),
                }],
            )
            .unwrap();

        assert_eq!(
            store.get("file:///unicode.c").unwrap().text,
            "string value = \"a😀c\";\n"
        );
    }

    #[test]
    fn rejects_stale_versions_without_mutating_the_document() {
        let mut store = DocumentStore::default();
        store.open("file:///demo.c".into(), 4, "before".into());

        let result = store.change(
            "file:///demo.c",
            4,
            &[ContentChange {
                range: None,
                text: "after".into(),
            }],
        );

        assert!(result.is_err());
        assert_eq!(store.get("file:///demo.c").unwrap().text, "before");
        assert_eq!(store.metrics().rejected_change_count, 1);
    }

    #[test]
    fn localizes_document_state_errors_and_preserves_uri_and_rejected_state() {
        let uri = "file:///fixture/函数.c";
        for (locale, unopened, stale) in [
            (
                Locale::En,
                format!("received a change for unopened document {uri}"),
                format!("received stale document version 4 for {uri}; current version is 4"),
            ),
            (
                Locale::ZhCn,
                format!("收到未打开文档 {uri} 的更改"),
                format!("收到文档 {uri} 的过时版本 4；当前版本为 4"),
            ),
        ] {
            let mut store = DocumentStore::with_locale(locale);
            assert_eq!(store.change(uri, 1, &[]).unwrap_err().to_string(), unopened);
            assert!(store.is_empty());
            store.open(uri.into(), 4, "original text 原文".into());
            let before = store.get(uri).unwrap().clone();
            let error = store
                .change(
                    uri,
                    4,
                    &[ContentChange {
                        range: None,
                        text: "replacement".into(),
                    }],
                )
                .unwrap_err();
            assert_eq!(error.to_string(), stale);
            assert_eq!(store.get(uri), Some(&before));
            assert_eq!(store.metrics().rejected_change_count, 2);
            assert_eq!(store.metrics().full_replacement_count, 0);
        }
        assert_eq!(DocumentStore::default().locale, Locale::En);
    }

    #[test]
    fn localizes_incremental_range_errors_without_changing_utf16_or_atomicity_rules() {
        let cases = [
            (
                Range {
                    start: position(2, 0),
                    end: position(2, 0),
                },
                "line 2 is outside the document",
                "行 2 超出文档范围",
            ),
            (
                Range {
                    start: position(0, 5),
                    end: position(0, 5),
                },
                "character 5 is outside line 0",
                "字符 5 超出行 0 的范围",
            ),
            (
                Range {
                    start: position(0, 2),
                    end: position(0, 2),
                },
                "position splits a UTF-16 surrogate pair",
                "位置位于 UTF-16 代理项对内部",
            ),
            (
                Range {
                    start: position(1, 1),
                    end: position(0, 0),
                },
                "incremental edit start is after its end",
                "增量编辑起点位于终点之后",
            ),
        ];
        for locale in [Locale::En, Locale::ZhCn] {
            for (range, english, chinese) in cases {
                let mut store = DocumentStore::with_locale(locale);
                let uri = "file:///fixture/unicode.c";
                store.open(uri.into(), 1, "a😀b\nnext".into());
                let before = store.get(uri).unwrap().clone();
                let error = store
                    .change(
                        uri,
                        2,
                        &[
                            ContentChange {
                                range: Some(Range {
                                    start: position(0, 0),
                                    end: position(0, 1),
                                }),
                                text: "z".into(),
                            },
                            ContentChange {
                                range: Some(range),
                                text: "replacement".into(),
                            },
                        ],
                    )
                    .unwrap_err();
                assert_eq!(error.to_string(), locale.text(english, chinese));
                assert_eq!(store.get(uri), Some(&before));
                assert_eq!(store.metrics().incremental_edit_count, 0);
                assert_eq!(store.metrics().full_replacement_count, 0);
                assert_eq!(store.metrics().rejected_change_count, 0);
            }
        }
    }
}
