//! Read-only corpus audit. Candidates are written to a separate, new directory.
use std::{
    env, fs,
    path::{Path, PathBuf},
    time::Instant,
};

use anyhow::{Context, Result, ensure};
use lpc_formatter::{FormatContext, FormatterConfig, format_document_checked};
use lpc_preprocessor::Preprocessor;
use serde_json::json;
use tree_sitter::Parser;

fn main() -> Result<()> {
    let args = env::args_os().skip(1).collect::<Vec<_>>();
    ensure!(
        args.len() == 2,
        "usage: formatter-audit <source-copy> <new-candidate-directory>"
    );
    let root = fs::canonicalize(PathBuf::from(&args[0]))?;
    let output = PathBuf::from(&args[1]);
    ensure!(!output.exists(), "candidate directory must not exist");
    let parent = output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let output = fs::canonicalize(parent)?.join(
        output
            .file_name()
            .context("candidate directory needs a name")?,
    );
    ensure!(
        !output.starts_with(&root) && !root.starts_with(&output),
        "source and output must be separate directories"
    );
    fs::create_dir(&output)?;
    let mut files = Vec::new();
    source_files(&root, &mut files)?;
    files.sort();
    let mut parser = Parser::new();
    parser.set_language(&tree_sitter_lpc_support::LANGUAGE.into())?;
    let preprocessor = Preprocessor::default();
    let mut results = Vec::new();
    let mut durations = Vec::new();
    let started = Instant::now();
    for file in files {
        let relative = file.strip_prefix(&root)?;
        let name = relative.to_string_lossy().replace('\\', "/");
        let source = fs::read_to_string(&file).context("source is not readable UTF-8")?;
        let processed = preprocessor.process(&source);
        let tree = parser
            .parse(&processed.text, None)
            .context("parse cancelled")?;
        let context = FormatContext {
            macro_names: processed
                .initial_definitions
                .keys()
                .cloned()
                .chain(
                    processed
                        .macro_directives
                        .iter()
                        .map(|directive| directive.name.clone()),
                )
                .collect(),
        };
        let task_started = Instant::now();
        let formatted =
            format_document_checked(&tree, &source, FormatterConfig::default(), &context);
        let micros = task_started.elapsed().as_micros() as u64;
        durations.push(micros);
        match formatted {
            Ok(formatted) => {
                let changed = formatted != source;
                if changed {
                    let target = output.join(relative);
                    fs::create_dir_all(target.parent().unwrap())?;
                    fs::write(target, &formatted)?;
                }
                // This is independent of the raw CST guard: preprocess the
                // accepted candidate again, as the language server will do.
                let after = preprocessor.process(&formatted);
                let tree_after = parser.parse(&after.text, None).context("candidate parse cancelled")?;
                let active_structure_equal = tree.root_node().to_sexp() == tree_after.root_node().to_sexp();
                results.push(json!({"file": name, "status": if changed { "changed" } else { "unchanged" }, "activeStructureEqual": active_structure_equal, "durationMicros": micros}));
            }
            Err(error) => results.push(json!({"file": name, "status": "refused", "reason": error.to_string(), "durationMicros": micros})),
        }
    }
    durations.sort_unstable();
    let count = |status| {
        results
            .iter()
            .filter(|entry| entry["status"] == status)
            .count()
    };
    let report = json!({
        "totalFiles": results.len(), "changedFiles": count("changed"), "unchangedFiles": count("unchanged"), "refusedFiles": count("refused"),
        "activeStructureFailures": results.iter().filter(|entry| entry["activeStructureEqual"] == false).count(),
        "durationMs": started.elapsed().as_millis(),
        "p95Micros": durations.get(durations.len().saturating_sub(1) * 95 / 100), "maxMicros": durations.last(), "files": results
    });
    println!("{}", serde_json::to_string_pretty(&report)?);
    ensure!(
        report["activeStructureFailures"] == 0,
        "candidate changes active structure"
    );
    Ok(())
}

fn source_files(root: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        if kind.is_dir() && !entry.file_name().to_string_lossy().starts_with('.') {
            source_files(&entry.path(), files)?;
        } else if kind.is_file()
            && matches!(
                entry.path().extension().and_then(|value| value.to_str()),
                Some("c" | "h" | "lpc")
            )
        {
            files.push(entry.path());
        }
    }
    Ok(())
}
