use std::{
    env, fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use lpc_analysis::{ExternalFunction, ExternalSignature, Locale};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct EfunDocument {
    name: String,
    #[serde(default)]
    signatures: Vec<EfunSignature>,
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

/// English-default entry point retained for existing callers.
#[allow(dead_code)]
pub fn load_from_environment() -> Result<Vec<ExternalFunction>> {
    load_from_environment_with_locale(Locale::En)
}

pub fn load_from_environment_with_locale(locale: Locale) -> Result<Vec<ExternalFunction>> {
    let root = locate_extension_root()
        .context(locale.text("could not locate extension root", "无法定位扩展根目录"))?;
    load_bundled_efuns_with_locale(&root, locale)
}

/// English-default entry point retained for existing callers.
#[allow(dead_code)]
pub fn load_bundled_efuns(extension_root: &Path) -> Result<Vec<ExternalFunction>> {
    load_bundled_efuns_with_locale(extension_root, Locale::En)
}

pub fn load_bundled_efuns_with_locale(
    extension_root: &Path,
    locale: Locale,
) -> Result<Vec<ExternalFunction>> {
    let resources = extension_root.join("config").join("efun-docs");
    let docs = resources.join("docs");
    let mut files = fs::read_dir(&docs)
        .with_context(|| match locale {
            Locale::En => format!("could not read {}", docs.display()),
            Locale::ZhCn => format!("无法读取 {}", docs.display()),
        })?
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
            let bytes = fs::read(&path).with_context(|| match locale {
                Locale::En => format!("could not read {}", path.display()),
                Locale::ZhCn => format!("无法读取 {}", path.display()),
            })?;
            let document: EfunDocument =
                serde_json::from_slice(&bytes).with_context(|| match locale {
                    Locale::En => format!("invalid efun document {}", path.display()),
                    Locale::ZhCn => format!("无效的 Efun 文档 {}", path.display()),
                })?;
            let filename = path.file_name().expect("directory entry has a file name");
            let english = read_optional_text(&resources.join("locales").join("en").join(filename));
            let selected = (locale != Locale::En).then(|| {
                read_optional_text(
                    &resources
                        .join("locales")
                        .join(locale.as_str())
                        .join(filename),
                )
            });
            Ok(ExternalFunction {
                name: document.name,
                summary: select_text(selected.as_ref(), &english, "summary"),
                details: select_text(selected.as_ref(), &english, "details"),
                note: select_text(selected.as_ref(), &english, "note"),
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

fn read_optional_text(path: &Path) -> serde_json::Value {
    match fs::read(path)
        .map_err(anyhow::Error::from)
        .and_then(|bytes| {
            serde_json::from_slice::<serde_json::Value>(&bytes).map_err(anyhow::Error::from)
        }) {
        Ok(value) if value.is_object() => value,
        result => {
            eprintln!(
                "Cannot load optional Efun text resource {}: {result:?}",
                path.display()
            );
            serde_json::Value::Null
        }
    }
}

fn select_text(
    selected: Option<&serde_json::Value>,
    english: &serde_json::Value,
    field: &str,
) -> Option<String> {
    // A missing or malformed translation cannot remove signatures or sibling fields.
    // Keep code whitespace verbatim, in agreement with BundledEfunLoader.
    selected
        .and_then(|value| value.get(field))
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            english
                .get(field)
                .and_then(serde_json::Value::as_str)
                .filter(|value| !value.trim().is_empty())
        })
        .map(str::to_owned)
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
    use std::{
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;

    struct TestExtensionRoot(PathBuf);

    impl TestExtensionRoot {
        fn new() -> Self {
            static NEXT_ID: AtomicU64 = AtomicU64::new(0);
            let root = env::temp_dir().join(format!(
                "lpc-efun-locale-{}-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT_ID.fetch_add(1, Ordering::Relaxed),
            ));
            fs::create_dir(&root).unwrap();
            Self(root)
        }

        fn docs(&self) -> PathBuf {
            self.0.join("config").join("efun-docs").join("docs")
        }
    }

    impl Drop for TestExtensionRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

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
        let async_yield = functions
            .iter()
            .find(|function| function.name == "async_yield")
            .unwrap();
        assert!(async_yield.signatures.iter().any(|signature| {
            signature.label == "promise async_yield()"
                && signature.minimum_arguments == 0
                && signature.maximum_arguments == Some(0)
        }));
        for locale in [Locale::En, Locale::ZhCn] {
            let catalogue = load_bundled_efuns_with_locale(root, locale).unwrap();
            assert_eq!(catalogue.len(), 413);
            for function in catalogue {
                let filename = root
                    .join("config/efun-docs/locales")
                    .join(locale.as_str())
                    .join(format!("{}.json", function.name));
                let text: serde_json::Value =
                    serde_json::from_slice(&fs::read(filename).unwrap()).unwrap();
                assert_eq!(
                    function.summary.as_deref(),
                    text.get("summary").and_then(serde_json::Value::as_str),
                    "{locale:?}/{} summary",
                    function.name
                );
                assert_eq!(
                    function.details.as_deref(),
                    text.get("details").and_then(serde_json::Value::as_str),
                    "{locale:?}/{} details",
                    function.name
                );
                assert_eq!(
                    function.note.as_deref(),
                    text.get("note").and_then(serde_json::Value::as_str),
                    "{locale:?}/{} note",
                    function.name
                );
            }
        }
    }

    #[test]
    fn localizes_directory_errors_and_preserves_the_io_cause_and_path() {
        let root = TestExtensionRoot::new();
        let mut causes = Vec::new();
        for locale in [Locale::En, Locale::ZhCn] {
            let error = load_bundled_efuns_with_locale(&root.0, locale).unwrap_err();
            let expected = match locale {
                Locale::En => format!("could not read {}", root.docs().display()),
                Locale::ZhCn => format!("无法读取 {}", root.docs().display()),
            };
            assert_eq!(error.to_string(), expected);
            let cause = error.root_cause().downcast_ref::<std::io::Error>().unwrap();
            assert_eq!(cause.kind(), std::io::ErrorKind::NotFound);
            assert!(format!("{error:#}").contains(&cause.to_string()));
            causes.push(cause.to_string());
        }
        assert_eq!(causes[0], causes[1]);
        assert_eq!(
            load_bundled_efuns(&root.0).unwrap_err().to_string(),
            format!("could not read {}", root.docs().display())
        );
    }

    #[test]
    fn localizes_invalid_document_context_without_translating_serde_errors() {
        let root = TestExtensionRoot::new();
        fs::create_dir_all(root.docs()).unwrap();
        let path = root.docs().join("无效文档.json");
        fs::write(&path, "{ invalid json").unwrap();
        let mut causes = Vec::new();
        for locale in [Locale::En, Locale::ZhCn] {
            let error = load_bundled_efuns_with_locale(&root.0, locale).unwrap_err();
            let expected = match locale {
                Locale::En => format!("invalid efun document {}", path.display()),
                Locale::ZhCn => format!("无效的 Efun 文档 {}", path.display()),
            };
            assert_eq!(error.to_string(), expected);
            assert!(error.root_cause().is::<serde_json::Error>());
            let cause = error.root_cause().to_string();
            assert!(format!("{error:#}").contains(&cause));
            causes.push(cause);
        }
        assert_eq!(causes[0], causes[1]);
    }

    #[test]
    fn overlays_fall_back_per_field_and_never_discard_efun_facts() {
        let root = TestExtensionRoot::new();
        fs::create_dir_all(root.docs()).unwrap();
        fs::write(
            root.docs().join("fixture.json"),
            serde_json::to_vec(&serde_json::json!({
                "name": "fixture",
                "signatures": [{
                    "label": "int fixture(string path, mixed ...args)",
                    "parameters": [
                        { "name": "path", "type": "string" },
                        { "name": "args", "type": "mixed", "variadic": true }
                    ],
                    "arity": { "min": 1, "max": null }
                }]
            }))
            .unwrap(),
        )
        .unwrap();
        let resources = root.0.join("config/efun-docs/locales");
        for locale in ["en", "zh-cn"] {
            fs::create_dir_all(resources.join(locale)).unwrap();
        }
        fs::write(resources.join("en/fixture.json"), serde_json::to_vec(&serde_json::json!({
            "summary": "  English summary.\n", "details": "```lpc\n fixture(\"x\");\n```\n", "note": "English note."
        })).unwrap()).unwrap();
        fs::write(
            resources.join("zh-cn/fixture.json"),
            serde_json::to_vec(&serde_json::json!({
                "summary": "  中文摘要。\n", "details": 5, "note": ""
            }))
            .unwrap(),
        )
        .unwrap();
        let english = load_bundled_efuns_with_locale(&root.0, Locale::En).unwrap();
        let chinese = load_bundled_efuns_with_locale(&root.0, Locale::ZhCn).unwrap();
        assert_eq!(english[0].signatures, chinese[0].signatures);
        assert_eq!(english[0].details, chinese[0].details);
        assert_eq!(english[0].note, chinese[0].note);
        assert_eq!(load_bundled_efuns(&root.0).unwrap(), english);
        assert_eq!(english[0].name, "fixture");
        assert_eq!(english[0].summary.as_deref(), Some("  English summary.\n"));
        assert_eq!(chinese[0].summary.as_deref(), Some("  中文摘要。\n"));
        assert_eq!(
            english[0].signatures[0],
            ExternalSignature {
                label: "int fixture(string path, mixed ...args)".into(),
                parameters: vec!["string path".into(), "mixed... args".into()],
                minimum_arguments: 1,
                maximum_arguments: None,
            }
        );
        fs::write(resources.join("zh-cn/fixture.json"), "{ invalid").unwrap();
        assert_eq!(
            load_bundled_efuns_with_locale(&root.0, Locale::ZhCn).unwrap(),
            english
        );
        fs::remove_file(resources.join("en/fixture.json")).unwrap();
        let absent = load_bundled_efuns_with_locale(&root.0, Locale::ZhCn).unwrap();
        assert_eq!(absent.len(), 1);
        assert_eq!(absent[0].summary, None);
        assert_eq!(absent[0].details, None);
        assert_eq!(absent[0].note, None);
        assert_eq!(absent[0].signatures, english[0].signatures);
    }
}
