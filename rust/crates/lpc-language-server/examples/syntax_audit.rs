use std::{
    env, fs,
    path::{Path, PathBuf},
    time::Instant,
};

use anyhow::{Context, Result, bail};
use lpc_preprocessor::{Preprocessor, definitions_from_list};
use serde_json::json;
use tree_sitter::Parser;

fn main() -> Result<()> {
    let root = env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .context("usage: syntax_audit <mudlib-root>")?;
    let details_enabled = env::args_os().any(|argument| argument == "--details");
    let strict = env::args_os().any(|argument| argument == "--strict");
    let definitions = env::args()
        .filter_map(|argument| argument.strip_prefix("--define=").map(str::to_owned))
        .collect::<Vec<_>>();
    let files = source_files(&root);
    let started = Instant::now();
    let mut parser = Parser::new();
    parser.set_language(&tree_sitter_lpc_support::LANGUAGE.into())?;
    let preprocessor = Preprocessor::with_predefined(definitions_from_list(&definitions));
    let mut parsed = 0_usize;
    let mut syntax_errors = 0_usize;
    let mut unreadable = 0_usize;
    let mut error_files = Vec::new();
    for path in &files {
        let Ok(source) = fs::read_to_string(path) else {
            unreadable += 1;
            continue;
        };
        let processed = preprocessor.process(&source);
        let Some(tree) = parser.parse(&processed.text, None) else {
            unreadable += 1;
            continue;
        };
        parsed += 1;
        if tree.root_node().has_error() {
            syntax_errors += 1;
            if details_enabled {
                let error = first_error(tree.root_node()).unwrap_or_else(|| tree.root_node());
                error_files.push(json!({
                    "file": path.strip_prefix(&root)
                        .unwrap_or(path)
                        .to_string_lossy()
                        .replace('\\', "/"),
                    "line": error.start_position().row + 1,
                    "column": error.start_position().column + 1,
                    "kind": error.kind()
                }));
            }
        }
    }
    let report = serde_json::to_string_pretty(&json!({
        "totalFiles": files.len(),
        "parsedFiles": parsed,
        "filesWithSyntaxErrors": syntax_errors,
        "unreadableFiles": unreadable,
        "durationMs": started.elapsed().as_millis(),
        "errorFiles": details_enabled.then_some(error_files)
    }))?;
    println!("{}", report);
    if strict && (syntax_errors > 0 || unreadable > 0) {
        bail!("syntax audit failed: {syntax_errors} syntax errors, {unreadable} unreadable files");
    }
    Ok(())
}

fn first_error(node: tree_sitter::Node<'_>) -> Option<tree_sitter::Node<'_>> {
    if node.is_error() || node.is_missing() {
        return Some(node);
    }
    let mut cursor = node.walk();
    node.children(&mut cursor).find_map(first_error)
}

fn source_files(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let Ok(entries) = fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if !matches!(
                    path.file_name().and_then(|name| name.to_str()),
                    Some(
                        ".git"
                            | ".tmp"
                            | ".venv"
                            | "venv"
                            | "temp"
                            | "node_modules"
                            | "coverage"
                            | "dist"
                            | "out"
                            | "target"
                    )
                ) {
                    pending.push(path);
                }
            } else if path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| {
                    value.eq_ignore_ascii_case("c") || value.eq_ignore_ascii_case("h")
                })
            {
                files.push(path);
            }
        }
    }
    files
}
