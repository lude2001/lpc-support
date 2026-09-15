use std::{env, fs, path::PathBuf};

use anyhow::{Context, Result, bail};
use lpc_language_server::{
    document_store::{ContentChange, DocumentStore, Position, Range},
    syntax_store::SyntaxStore,
};
use serde_json::json;

const INCREMENTAL_ITERATIONS: usize = 100;

fn main() -> Result<()> {
    let file_path = env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .context("usage: cargo run --example analysis-benchmark -- <LPC file>")?;
    let source = fs::read_to_string(&file_path)
        .with_context(|| format!("failed to read {}", file_path.display()))?;
    let uri = "file:///benchmark.c";
    let mut documents = DocumentStore::default();
    let mut syntax = SyntaxStore::new()?;

    documents.open(uri.into(), 1, source);
    let full_parse = syntax.open(documents.get(uri).context("missing benchmark document")?)?;
    if full_parse.tree.root_node().has_error() {
        bail!("grammar produced an error node for {}", file_path.display());
    }
    let full_parse_micros = full_parse.parse_time_micros;

    let mut incremental_micros = Vec::with_capacity(INCREMENTAL_ITERATIONS);
    for iteration in 0..INCREMENTAL_ITERATIONS {
        let document = documents.get(uri).context("missing benchmark document")?;
        let end = end_position(&document.text);
        let inserting = iteration % 2 == 0;
        let range = if inserting {
            Range { start: end, end }
        } else {
            Range {
                start: Position {
                    line: end.line,
                    character: end.character.saturating_sub(1),
                },
                end,
            }
        };
        let change = documents.change(
            uri,
            (iteration + 2) as i32,
            &[ContentChange {
                range: Some(range),
                text: if inserting { " " } else { "" }.into(),
            }],
        )?;
        let snapshot = syntax.change(
            documents.get(uri).context("missing changed document")?,
            &change.edits,
            change.contains_full_replacement,
        )?;
        if snapshot.tree.root_node().has_error() {
            bail!("incremental parse produced an error at iteration {iteration}");
        }
        incremental_micros.push(snapshot.parse_time_micros);
    }

    incremental_micros.sort_unstable();
    let sum: u64 = incremental_micros.iter().sum();
    let report = json!({
        "fileBytes": documents.get(uri).map(|document| document.text.len()).unwrap_or_default(),
        "fullParseMicros": full_parse_micros,
        "incremental": {
            "iterations": INCREMENTAL_ITERATIONS,
            "meanMicros": sum as f64 / incremental_micros.len() as f64,
            "p50Micros": percentile(&incremental_micros, 50),
            "p95Micros": percentile(&incremental_micros, 95),
            "maxMicros": incremental_micros.last().copied().unwrap_or_default()
        }
    });
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}

fn end_position(text: &str) -> Position {
    let line = text.bytes().filter(|byte| *byte == b'\n').count() as u32;
    let last_line = text.rsplit('\n').next().unwrap_or_default();
    Position {
        line,
        character: last_line.encode_utf16().count() as u32,
    }
}

fn percentile(sorted: &[u64], percentile: usize) -> u64 {
    if sorted.is_empty() {
        return 0;
    }
    let index = ((sorted.len() - 1) * percentile).div_ceil(100);
    sorted[index]
}
