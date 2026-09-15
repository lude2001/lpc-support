use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    thread,
    time::Duration,
};

use lpc_analysis::AnalysisDatabase;
use lpc_preprocessor::Preprocessor;
use tree_sitter::Parser;
use url::Url;

const MAX_SOURCE_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Clone, Default)]
pub struct WorkspaceIndexController {
    generation: Arc<AtomicU64>,
    definitions: Arc<Mutex<Vec<(String, String)>>>,
}

impl WorkspaceIndexController {
    pub fn start(
        &self,
        roots: Vec<PathBuf>,
        definitions: Vec<(String, String)>,
        analysis: Arc<Mutex<AnalysisDatabase>>,
    ) {
        if let Ok(mut current) = self.definitions.lock() {
            current.clone_from(&definitions);
        }
        let generation = self.generation.fetch_add(1, Ordering::AcqRel) + 1;
        let generation_counter = Arc::clone(&self.generation);
        thread::Builder::new()
            .name("lpc-workspace-index".to_owned())
            .spawn(move || {
                index_roots(roots, definitions, analysis, generation_counter, generation);
            })
            .expect("failed to start LPC workspace index thread");
    }

    pub fn update_uri(&self, uri: String, analysis: Arc<Mutex<AnalysisDatabase>>) {
        let generation = self.generation.load(Ordering::Acquire);
        let generation_counter = Arc::clone(&self.generation);
        let definitions = self
            .definitions
            .lock()
            .map_or_else(|_| Vec::new(), |current| current.clone());
        thread::Builder::new()
            .name("lpc-workspace-file-update".to_owned())
            .spawn(move || {
                if generation_counter.load(Ordering::Acquire) != generation {
                    return;
                }
                let Ok(url) = Url::parse(&uri) else { return };
                let Ok(path) = url.to_file_path() else { return };
                if !path.exists() {
                    if let Ok(mut database) = analysis.lock() {
                        database.remove_indexed(&uri);
                    }
                    return;
                }
                index_file(
                    &path,
                    &Preprocessor::with_predefined(definitions),
                    &analysis,
                );
            })
            .expect("failed to start LPC workspace file update thread");
    }

    pub fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
    }
}

fn index_roots(
    roots: Vec<PathBuf>,
    definitions: Vec<(String, String)>,
    analysis: Arc<Mutex<AnalysisDatabase>>,
    generation_counter: Arc<AtomicU64>,
    generation: u64,
) {
    let mut parser = Parser::new();
    if parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .is_err()
    {
        return;
    }
    let preprocessor = Preprocessor::with_predefined(definitions);

    for path in source_files(&roots) {
        if generation_counter.load(Ordering::Acquire) != generation {
            return;
        }
        if !index_file_with_parser(&path, &preprocessor, &analysis, &mut parser) {
            return;
        }
        // A single worker plus a short yield keeps background indexing from
        // monopolising a low-end CPU while foreground LSP requests are active.
        thread::sleep(Duration::from_millis(1));
    }
}

fn index_file(path: &Path, preprocessor: &Preprocessor, analysis: &Arc<Mutex<AnalysisDatabase>>) {
    let mut parser = Parser::new();
    if parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .is_ok()
    {
        index_file_with_parser(path, preprocessor, analysis, &mut parser);
    }
}

fn index_file_with_parser(
    path: &Path,
    preprocessor: &Preprocessor,
    analysis: &Arc<Mutex<AnalysisDatabase>>,
    parser: &mut Parser,
) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return true;
    };
    if metadata.len() > MAX_SOURCE_BYTES {
        return true;
    }
    let Ok(source) = fs::read_to_string(path) else {
        return true;
    };
    let processed = preprocessor.process(&source);
    let Some(tree) = parser.parse(&processed.text, None) else {
        return true;
    };
    let Ok(uri) = Url::from_file_path(path) else {
        return true;
    };
    let Ok(mut database) = analysis.lock() else {
        return false;
    };
    database.index_source(uri.as_str(), &tree, &source);
    true
}

fn source_files(roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut pending: Vec<_> = roots.iter().rev().cloned().collect();
    while let Some(directory) = pending.pop() {
        let Ok(entries) = fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if !ignored_directory(&path) {
                    pending.push(path);
                }
            } else if file_type.is_file() && is_lpc_source(&path) {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}

fn ignored_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            matches!(
                name.to_ascii_lowercase().as_str(),
                ".git" | ".tmp" | "node_modules" | "dist" | "out" | "target"
            )
        })
}

fn is_lpc_source(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("c") || extension.eq_ignore_ascii_case("h")
        })
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use lpc_analysis::Position;

    use super::*;

    #[test]
    fn accepts_lpc_sources_and_skips_build_directories() {
        assert!(is_lpc_source(Path::new("daemon.c")));
        assert!(is_lpc_source(Path::new("include.H")));
        assert!(!is_lpc_source(Path::new("package.json")));
        assert!(ignored_directory(Path::new("node_modules")));
        assert!(ignored_directory(Path::new("TARGET")));
    }

    #[test]
    fn indexes_cross_file_definitions_without_query_time_scanning() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("lpc-index-{unique}"));
        fs::create_dir_all(&root).unwrap();
        let definition_path = root.join("helper.c");
        let caller_path = root.join("caller.c");
        fs::write(&definition_path, "int helper() { return 1; }\n").unwrap();
        fs::write(&caller_path, "int caller() { return helper(); }\n").unwrap();

        let analysis = Arc::new(Mutex::new(AnalysisDatabase::default()));
        let generation = Arc::new(AtomicU64::new(1));
        index_roots(
            vec![root.clone()],
            Vec::new(),
            Arc::clone(&analysis),
            generation,
            1,
        );

        let caller_uri = Url::from_file_path(&caller_path).unwrap();
        let definitions = analysis.lock().unwrap().definition(
            caller_uri.as_str(),
            Position {
                line: 0,
                character: 23,
            },
        );
        assert_eq!(definitions.len(), 1);
        assert!(definitions[0].uri.ends_with("helper.c"));
        assert_eq!(analysis.lock().unwrap().metrics().indexed_file_count, 2);

        fs::remove_dir_all(root).unwrap();
    }
}
