//! Development-only exporter for verifying the two bundled-resource consumers.
use std::{env, path::Path};

use anyhow::{Context, Result};
use lpc_analysis::Locale;
use lpc_language_server::efun_docs::load_bundled_efuns_with_locale;
use serde_json::json;

fn main() -> Result<()> {
    let mut args = env::args().skip(1);
    let root = args.next().context("expected an extension root")?;
    let language = args.next().context("expected en or zh-cn")?;
    anyhow::ensure!(args.next().is_none(), "unexpected arguments");
    anyhow::ensure!(
        ["en", "zh-cn"].contains(&language.as_str()),
        "unsupported language"
    );
    let functions =
        load_bundled_efuns_with_locale(Path::new(&root), Locale::from_language(Some(&language)))?;
    let records = functions.into_iter().map(|function| json!({
        "name": function.name, "summary": function.summary, "details": function.details, "note": function.note,
        "signatures": function.signatures.into_iter().map(|signature| json!({
            "label": signature.label, "parameters": signature.parameters,
            "min": signature.minimum_arguments, "max": signature.maximum_arguments
        })).collect::<Vec<_>>()
    })).collect::<Vec<_>>();
    println!("{}", serde_json::to_string(&records)?);
    Ok(())
}
