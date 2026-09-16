use std::{
    env, fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use lpc_analysis::{ExternalFunction, ExternalSignature};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct EfunDocument {
    name: String,
    summary: Option<String>,
    availability: Option<EfunAvailability>,
    #[serde(default)]
    signatures: Vec<EfunSignature>,
}

#[derive(Debug, Deserialize)]
struct EfunAvailability {
    condition: String,
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EfunSignature {
    label: String,
    #[serde(default)]
    parameters: Vec<EfunParameter>,
    arity: EfunArity,
}

#[derive(Debug, Deserialize)]
struct EfunParameter {
    name: String,
    #[serde(rename = "type")]
    #[serde(default)]
    parameter_type: String,
    #[serde(default)]
    variadic: bool,
}

#[derive(Debug, Deserialize)]
struct EfunArity {
    min: usize,
    max: Option<usize>,
}

pub fn load_from_environment() -> Result<Vec<ExternalFunction>> {
    let root = locate_extension_root().context("could not locate extension root")?;
    load_bundled_efuns(&root)
}

pub fn load_bundled_efuns(extension_root: &Path) -> Result<Vec<ExternalFunction>> {
    let docs = extension_root.join("config").join("efun-docs").join("docs");
    let mut files = fs::read_dir(&docs)
        .with_context(|| format!("could not read {}", docs.display()))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "json")
        })
        .collect::<Vec<_>>();
    files.sort();

    files
        .into_iter()
        .map(|path| {
            let bytes =
                fs::read(&path).with_context(|| format!("could not read {}", path.display()))?;
            let document: EfunDocument = serde_json::from_slice(&bytes)
                .with_context(|| format!("invalid efun document {}", path.display()))?;
            Ok(ExternalFunction {
                name: document.name,
                summary: materialize_summary(document.summary, document.availability),
                signatures: document
                    .signatures
                    .into_iter()
                    .map(|signature| ExternalSignature {
                        label: signature.label,
                        parameters: signature
                            .parameters
                            .into_iter()
                            .map(|parameter| {
                                let prefix = if parameter.variadic { "..." } else { "" };
                                if parameter.parameter_type.is_empty() {
                                    format!("{prefix}{}", parameter.name)
                                } else {
                                    format!(
                                        "{}{prefix} {}",
                                        parameter.parameter_type, parameter.name
                                    )
                                }
                            })
                            .collect(),
                        minimum_arguments: signature.arity.min,
                        maximum_arguments: signature.arity.max,
                    })
                    .collect(),
            })
        })
        .collect()
}

fn materialize_summary(
    summary: Option<String>,
    availability: Option<EfunAvailability>,
) -> Option<String> {
    let mut parts = summary.into_iter().collect::<Vec<_>>();
    if let Some(availability) = availability {
        parts.push(format!("可用性：{}", availability.condition));
        if let Some(source) = availability.source {
            parts.push(format!("来源：FluffOS {source}"));
        }
    }
    (!parts.is_empty()).then(|| parts.join("\n\n"))
}

fn locate_extension_root() -> Option<PathBuf> {
    if let Some(root) = env::var_os("LPC_EXTENSION_ROOT").map(PathBuf::from)
        && has_docs(&root)
    {
        return Some(root);
    }
    let executable = env::current_exe().ok();
    let current = env::current_dir().ok();
    executable
        .as_deref()
        .into_iter()
        .chain(current.as_deref())
        .flat_map(Path::ancestors)
        .find(|path| has_docs(path))
        .map(Path::to_path_buf)
}

fn has_docs(root: &Path) -> bool {
    root.join("config").join("efun-docs").join("docs").is_dir()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_the_existing_bundled_efun_catalogue() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(3)
            .unwrap();
        let functions = load_bundled_efuns(root).unwrap();
        let write = functions
            .iter()
            .find(|function| function.name == "write")
            .unwrap();
        assert!(
            write
                .summary
                .as_deref()
                .is_some_and(|summary| !summary.is_empty())
        );
        assert!(write.signatures.iter().any(|signature| {
            signature.minimum_arguments == 1 && signature.maximum_arguments == Some(1)
        }));

        assert_eq!(functions.len(), 446);
        assert!(
            !functions
                .iter()
                .any(|function| function.name == "mapping_origin_stats")
        );
        let promise_then = functions
            .iter()
            .find(|function| function.name == "promise_then")
            .unwrap();
        assert_eq!(promise_then.signatures.len(), 3);
        let orphaned = functions
            .iter()
            .find(|function| function.name == "find_orphaned_cycles")
            .unwrap();
        assert_eq!(orphaned.signatures[0].minimum_arguments, 0);
        assert_eq!(orphaned.signatures[0].maximum_arguments, Some(1));
        let ffi = functions
            .iter()
            .find(|function| function.name == "ffi_prepare")
            .unwrap();
        assert!(
            ffi.summary
                .as_deref()
                .is_some_and(|summary| summary.contains("PACKAGE_FFI"))
        );
    }
}
