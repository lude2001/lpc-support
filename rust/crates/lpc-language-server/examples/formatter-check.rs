use std::{env, fs, path::Path};

use anyhow::{Context, Result};
use lpc_formatter::{FormatterConfig, format_document};
use lpc_preprocessor::Preprocessor;
use tree_sitter::Parser;

fn main() -> Result<()> {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .context("failed to load LPC grammar")?;
    let preprocessor = Preprocessor::default();
    let paths: Vec<_> = env::args().skip(1).collect();
    anyhow::ensure!(!paths.is_empty(), "pass one or more LPC fixture paths");

    let mut failed = false;
    for path in paths {
        let source = fs::read_to_string(&path).with_context(|| format!("failed to read {path}"))?;
        let processed = preprocessor.process(&source);
        let tree = parser
            .parse(&processed.text, None)
            .context("parse cancelled")?;
        let name = Path::new(&path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("<fixture>");
        let Some(formatted) = format_document(&tree, &source, FormatterConfig::default()) else {
            println!("{name}: skipped (syntax error or unsupported directive layout)");
            failed = true;
            continue;
        };
        let formatted_processed = preprocessor.process(&formatted);
        let formatted_tree = parser
            .parse(&formatted_processed.text, None)
            .context("formatted parse cancelled")?;
        let idempotent = format_document(&formatted_tree, &formatted, FormatterConfig::default())
            .is_some_and(|twice| twice == formatted);
        let syntax_ok = !formatted_tree.root_node().has_error();
        println!(
            "{name}: syntax_ok={syntax_ok} idempotent={idempotent} bytes={}=>{}",
            source.len(),
            formatted.len()
        );
        failed |= !syntax_ok || !idempotent;
    }

    anyhow::ensure!(!failed, "one or more formatter fixtures failed");
    Ok(())
}
