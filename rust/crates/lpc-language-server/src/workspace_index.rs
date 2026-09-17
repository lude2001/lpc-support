use std::{
    collections::{BTreeMap, HashSet, hash_map::DefaultHasher},
    env, fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    thread,
    time::{Instant, UNIX_EPOCH},
};

use lpc_analysis::AnalysisDatabase;
use serde::{Deserialize, Serialize};
use tree_sitter::Parser;
use url::Url;

use crate::project_preprocessor::{ProjectPreprocessor, WorkspacePreprocessorConfig};

const MAX_SOURCE_BYTES: u64 = 8 * 1024 * 1024;
const WORKSPACE_INDEX_CACHE_SCHEMA_VERSION: u32 = 1;
const WORKSPACE_INDEX_CACHE_ROOT_ENV: &str = "LPC_INDEX_CACHE_ROOT";
const WORKSPACE_INDEX_CACHE_VERSION_ENV: &str = "LPC_INDEX_CACHE_VERSION";

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexResult {
    pub status: &'static str,
    pub total_files: usize,
    pub indexed_files: usize,
    pub cached_files: usize,
    pub skipped_files: usize,
    pub failed_files: usize,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CachedFileStamp {
    length: u64,
    modified_nanos: u64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceIndexCacheManifest {
    schema_version: u32,
    configuration_fingerprint: String,
    files: BTreeMap<String, CachedFileStamp>,
}

struct WorkspaceIndexCachePaths {
    manifest: PathBuf,
    analysis: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IndexOutcome {
    Indexed,
    Skipped,
    Failed,
}

#[derive(Debug, Clone, Default)]
pub struct WorkspaceIndexController {
    generation: Arc<AtomicU64>,
    definitions: Arc<Mutex<Vec<(String, String)>>>,
    workspaces: Arc<Mutex<Vec<WorkspacePreprocessorConfig>>>,
}

impl WorkspaceIndexController {
    pub fn start<F>(
        &self,
        roots: Vec<PathBuf>,
        definitions: Vec<(String, String)>,
        workspaces: Vec<WorkspacePreprocessorConfig>,
        analysis: Arc<Mutex<AnalysisDatabase>>,
        on_complete: F,
    ) where
        F: FnOnce(WorkspaceIndexResult) + Send + 'static,
    {
        if let Ok(mut current) = self.definitions.lock() {
            current.clone_from(&definitions);
        }
        if let Ok(mut current) = self.workspaces.lock() {
            current.clone_from(&workspaces);
        }
        let generation = self.generation.fetch_add(1, Ordering::AcqRel) + 1;
        if let Ok(mut database) = analysis.lock() {
            database.clear_indexed();
        }
        let generation_counter = Arc::clone(&self.generation);
        thread::Builder::new()
            .name("lpc-workspace-index".to_owned())
            .spawn(move || {
                let result = index_roots(
                    roots,
                    definitions,
                    workspaces,
                    analysis,
                    generation_counter,
                    generation,
                    true,
                );
                on_complete(result);
            })
            .expect("failed to start LPC workspace index thread");
    }

    pub fn rebuild(
        &self,
        roots: Vec<PathBuf>,
        definitions: Vec<(String, String)>,
        workspaces: Vec<WorkspacePreprocessorConfig>,
        analysis: Arc<Mutex<AnalysisDatabase>>,
    ) -> WorkspaceIndexResult {
        if let Ok(mut current) = self.definitions.lock() {
            current.clone_from(&definitions);
        }
        if let Ok(mut current) = self.workspaces.lock() {
            current.clone_from(&workspaces);
        }
        let generation = self.generation.fetch_add(1, Ordering::AcqRel) + 1;
        if let Ok(mut database) = analysis.lock() {
            database.clear_indexed();
        }
        index_roots(
            roots,
            definitions,
            workspaces,
            analysis,
            Arc::clone(&self.generation),
            generation,
            false,
        )
    }

    pub fn update_uri(&self, uri: String, analysis: Arc<Mutex<AnalysisDatabase>>) {
        let generation = self.generation.load(Ordering::Acquire);
        let generation_counter = Arc::clone(&self.generation);
        let definitions = self
            .definitions
            .lock()
            .map_or_else(|_| Vec::new(), |current| current.clone());
        let workspaces = self
            .workspaces
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
                let dependents = analysis
                    .lock()
                    .map_or_else(|_| Vec::new(), |mut database| database.dependent_uris(&uri));
                let mut preprocessor = ProjectPreprocessor::default();
                preprocessor.configure(definitions, workspaces);
                if !path.exists() {
                    if let Ok(mut database) = analysis.lock() {
                        database.remove_indexed(&uri);
                    }
                } else {
                    index_file(&path, &mut preprocessor, &analysis);
                }
                for dependent_uri in dependents {
                    if generation_counter.load(Ordering::Acquire) != generation {
                        return;
                    }
                    let Ok(dependent_url) = Url::parse(&dependent_uri) else {
                        continue;
                    };
                    let Ok(dependent_path) = dependent_url.to_file_path() else {
                        continue;
                    };
                    if dependent_path.is_file() {
                        index_file(&dependent_path, &mut preprocessor, &analysis);
                    }
                }
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
    workspaces: Vec<WorkspacePreprocessorConfig>,
    analysis: Arc<Mutex<AnalysisDatabase>>,
    generation_counter: Arc<AtomicU64>,
    generation: u64,
    use_cache: bool,
) -> WorkspaceIndexResult {
    let started_at = Instant::now();
    let Some(all_files) = source_files_for_generation(&roots, &generation_counter, generation)
    else {
        return WorkspaceIndexResult {
            status: "cancelled",
            duration_ms: started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
            ..WorkspaceIndexResult::default()
        };
    };
    let configuration_fingerprint = configuration_fingerprint(&definitions, &workspaces);
    let cache_paths = workspace_cache_paths(&roots);
    let current_stamps = file_stamps(&all_files);
    let (files, cached_files) = if use_cache {
        restore_workspace_cache(
            &all_files,
            &current_stamps,
            &configuration_fingerprint,
            cache_paths.as_ref(),
            &analysis,
        )
    } else {
        (all_files.clone(), 0)
    };
    let mut result = WorkspaceIndexResult {
        status: "ready",
        total_files: all_files.len(),
        indexed_files: cached_files,
        cached_files,
        ..WorkspaceIndexResult::default()
    };
    let mut parser = Parser::new();
    if parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .is_err()
    {
        result.failed_files = result.total_files;
        return result;
    }
    let mut preprocessor = ProjectPreprocessor::default();
    preprocessor.configure(definitions, workspaces);

    for path in files {
        if generation_counter.load(Ordering::Acquire) != generation {
            result.status = "cancelled";
            result.skipped_files = result
                .total_files
                .saturating_sub(result.indexed_files + result.failed_files);
            break;
        }
        match index_file_with_parser(&path, &mut preprocessor, &analysis, &mut parser) {
            IndexOutcome::Indexed => result.indexed_files += 1,
            IndexOutcome::Skipped => result.skipped_files += 1,
            IndexOutcome::Failed => result.failed_files += 1,
        }
    }
    if result.status == "ready"
        && generation_counter.load(Ordering::Acquire) == generation
        && let Some(cache_paths) = cache_paths.as_ref()
    {
        save_workspace_cache(
            cache_paths,
            &configuration_fingerprint,
            &current_stamps,
            &analysis,
        );
    }
    result.duration_ms = started_at.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
    result
}

fn configuration_fingerprint(
    definitions: &[(String, String)],
    workspaces: &[WorkspacePreprocessorConfig],
) -> String {
    let mut definitions = definitions.to_vec();
    definitions.sort();
    let cache_version = env::var(WORKSPACE_INDEX_CACHE_VERSION_ENV)
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_owned());
    let mut value = format!("server={cache_version};definitions={definitions:?}");
    for workspace in workspaces {
        let mut include_directories = workspace.include_directories.clone();
        include_directories.sort();
        value.push_str(&format!(
            ";root={};includes={include_directories:?};global={:?}",
            workspace.root.to_string_lossy(),
            workspace.global_include_file
        ));
    }
    value
}

fn workspace_cache_paths(roots: &[PathBuf]) -> Option<WorkspaceIndexCachePaths> {
    let cache_root = env::var_os(WORKSPACE_INDEX_CACHE_ROOT_ENV).map(PathBuf::from)?;
    let mut hasher = DefaultHasher::new();
    for root in roots {
        root.to_string_lossy().to_lowercase().hash(&mut hasher);
    }
    let directory = cache_root.join(format!("{:016x}", hasher.finish()));
    Some(WorkspaceIndexCachePaths {
        manifest: directory.join("manifest.json"),
        analysis: directory.join("analysis.json"),
    })
}

fn file_stamps(files: &[PathBuf]) -> BTreeMap<String, CachedFileStamp> {
    files
        .iter()
        .filter_map(|path| {
            let metadata = fs::metadata(path).ok()?;
            let modified = metadata.modified().ok()?;
            let modified_nanos = modified
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_nanos()
                .min(u128::from(u64::MAX)) as u64;
            Some((
                path.to_string_lossy().into_owned(),
                CachedFileStamp {
                    length: metadata.len(),
                    modified_nanos,
                },
            ))
        })
        .collect()
}

fn restore_workspace_cache(
    all_files: &[PathBuf],
    current_stamps: &BTreeMap<String, CachedFileStamp>,
    configuration_fingerprint: &str,
    cache_paths: Option<&WorkspaceIndexCachePaths>,
    analysis: &Arc<Mutex<AnalysisDatabase>>,
) -> (Vec<PathBuf>, usize) {
    let Some(cache_paths) = cache_paths else {
        return (all_files.to_vec(), 0);
    };
    let Ok(manifest_bytes) = fs::read(&cache_paths.manifest) else {
        return (all_files.to_vec(), 0);
    };
    let Ok(manifest) = serde_json::from_slice::<WorkspaceIndexCacheManifest>(&manifest_bytes)
    else {
        return (all_files.to_vec(), 0);
    };
    if manifest.schema_version != WORKSPACE_INDEX_CACHE_SCHEMA_VERSION
        || manifest.configuration_fingerprint != configuration_fingerprint
        || !header_stamps_match(&manifest.files, current_stamps)
        || current_stamps
            .keys()
            .any(|path| !manifest.files.contains_key(path))
    {
        return (all_files.to_vec(), 0);
    }
    let Ok(cache_bytes) = fs::read(&cache_paths.analysis) else {
        return (all_files.to_vec(), 0);
    };
    let Ok(imported_uris) = analysis
        .lock()
        .map_err(|_| ())
        .and_then(|mut database| database.import_indexed_cache(&cache_bytes).map_err(|_| ()))
    else {
        return (all_files.to_vec(), 0);
    };

    let mut dependent_paths = HashSet::new();
    if let Ok(mut database) = analysis.lock() {
        for path in all_files {
            let path_key = path.to_string_lossy();
            if manifest.files.get(path_key.as_ref()) == current_stamps.get(path_key.as_ref()) {
                continue;
            }
            if let Ok(uri) = Url::from_file_path(path) {
                dependent_paths.extend(
                    database
                        .dependent_uris(uri.as_str())
                        .into_iter()
                        .filter_map(|dependent| Url::parse(&dependent).ok()?.to_file_path().ok()),
                );
            }
        }
        for old_path in manifest.files.keys() {
            if current_stamps.contains_key(old_path) {
                continue;
            }
            if let Ok(uri) = Url::from_file_path(old_path) {
                dependent_paths.extend(
                    database
                        .dependent_uris(uri.as_str())
                        .into_iter()
                        .filter_map(|dependent| Url::parse(&dependent).ok()?.to_file_path().ok()),
                );
                database.remove_indexed(uri.as_str());
            }
        }
    }

    let files_to_index = all_files
        .iter()
        .filter(|path| {
            let path_key = path.to_string_lossy();
            let unchanged =
                manifest.files.get(path_key.as_ref()) == current_stamps.get(path_key.as_ref());
            let cached = Url::from_file_path(path)
                .ok()
                .is_some_and(|uri| imported_uris.contains(uri.as_str()));
            !unchanged || !cached || dependent_paths.contains(*path)
        })
        .cloned()
        .collect::<Vec<_>>();
    let cached_files = all_files.len().saturating_sub(files_to_index.len());
    (files_to_index, cached_files)
}

fn header_stamps_match(
    previous: &BTreeMap<String, CachedFileStamp>,
    current: &BTreeMap<String, CachedFileStamp>,
) -> bool {
    let previous_headers = previous
        .iter()
        .filter(|(path, _)| is_header_path(Path::new(path)))
        .collect::<BTreeMap<_, _>>();
    let current_headers = current
        .iter()
        .filter(|(path, _)| is_header_path(Path::new(path)))
        .collect::<BTreeMap<_, _>>();
    previous_headers == current_headers
}

fn save_workspace_cache(
    cache_paths: &WorkspaceIndexCachePaths,
    configuration_fingerprint: &str,
    current_stamps: &BTreeMap<String, CachedFileStamp>,
    analysis: &Arc<Mutex<AnalysisDatabase>>,
) {
    let Some(directory) = cache_paths.manifest.parent() else {
        return;
    };
    let Ok(cache_bytes) = analysis
        .lock()
        .map_err(|_| ())
        .and_then(|database| database.export_indexed_cache().map_err(|_| ()))
    else {
        return;
    };
    let manifest = WorkspaceIndexCacheManifest {
        schema_version: WORKSPACE_INDEX_CACHE_SCHEMA_VERSION,
        configuration_fingerprint: configuration_fingerprint.to_owned(),
        files: current_stamps.clone(),
    };
    let Ok(manifest_bytes) = serde_json::to_vec(&manifest) else {
        return;
    };
    if fs::create_dir_all(directory).is_err() {
        return;
    }
    if fs::write(&cache_paths.analysis, cache_bytes).is_ok() {
        let _ = fs::write(&cache_paths.manifest, manifest_bytes);
    }
}

fn is_header_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("h"))
}

fn index_file(
    path: &Path,
    preprocessor: &mut ProjectPreprocessor,
    analysis: &Arc<Mutex<AnalysisDatabase>>,
) {
    let mut parser = Parser::new();
    if parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .is_ok()
    {
        let _ = index_file_with_parser(path, preprocessor, analysis, &mut parser);
    }
}

fn index_file_with_parser(
    path: &Path,
    preprocessor: &mut ProjectPreprocessor,
    analysis: &Arc<Mutex<AnalysisDatabase>>,
    parser: &mut Parser,
) -> IndexOutcome {
    let Ok(metadata) = fs::metadata(path) else {
        return IndexOutcome::Skipped;
    };
    if metadata.len() > MAX_SOURCE_BYTES {
        return IndexOutcome::Skipped;
    }
    let Ok(source) = fs::read_to_string(path) else {
        return IndexOutcome::Failed;
    };
    let processed = preprocessor.process(Some(path), &source);
    let Some(tree) = parser.parse(&processed.text, None) else {
        return IndexOutcome::Failed;
    };
    let Ok(uri) = Url::from_file_path(path) else {
        return IndexOutcome::Failed;
    };
    let Ok(mut database) = analysis.lock() else {
        return IndexOutcome::Failed;
    };
    database.index_preprocessed_source(
        uri.as_str(),
        &tree,
        &source,
        (
            &processed.macro_directives,
            &processed.initial_definitions,
            &processed.includes,
            &processed.inactive_regions,
        ),
    );
    IndexOutcome::Indexed
}

fn source_files_for_generation(
    roots: &[PathBuf],
    generation_counter: &AtomicU64,
    generation: u64,
) -> Option<Vec<PathBuf>> {
    let mut files = Vec::new();
    let mut pending: Vec<_> = roots.iter().rev().cloned().collect();
    while let Some(directory) = pending.pop() {
        if generation_counter.load(Ordering::Acquire) != generation {
            return None;
        }
        let Ok(entries) = fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            if generation_counter.load(Ordering::Acquire) != generation {
                return None;
            }
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
    Some(files)
}

fn ignored_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            matches!(
                name.to_ascii_lowercase().as_str(),
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
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

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
    fn cancels_workspace_discovery_before_indexing_stale_generations() {
        let analysis = Arc::new(Mutex::new(AnalysisDatabase::default()));
        let generation = Arc::new(AtomicU64::new(2));
        let result = index_roots(
            vec![std::env::temp_dir()],
            Vec::new(),
            Vec::new(),
            analysis,
            generation,
            1,
            false,
        );

        assert_eq!(result.status, "cancelled");
        assert_eq!(result.indexed_files, 0);
    }

    #[test]
    fn controller_cancel_invalidates_the_active_generation() {
        let controller = WorkspaceIndexController::default();
        let before = controller.generation.load(Ordering::Acquire);
        controller.cancel();
        assert_eq!(controller.generation.load(Ordering::Acquire), before + 1);
    }

    #[test]
    fn background_index_reports_completion() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("lpc-index-ready-{unique}"));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("ready.c"), "int ready() { return 1; }\n").unwrap();

        let controller = WorkspaceIndexController::default();
        let analysis = Arc::new(Mutex::new(AnalysisDatabase::default()));
        let (sender, receiver) = std::sync::mpsc::channel();
        controller.start(
            vec![root.clone()],
            Vec::new(),
            vec![WorkspacePreprocessorConfig {
                root: root.clone(),
                ..WorkspacePreprocessorConfig::default()
            }],
            analysis,
            move |result| sender.send(result).unwrap(),
        );

        let result = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_eq!(result.status, "ready");
        assert_eq!(result.indexed_files, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restores_unchanged_files_and_invalidates_conservatively() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("lpc-index-cache-{unique}"));
        fs::create_dir_all(&root).unwrap();
        let header_path = root.join("shared.h");
        let included_path = root.join("included.c");
        let standalone_path = root.join("standalone.c");
        let source_path = root.join("caller.c");
        fs::write(&header_path, "#define VALUE 1\n").unwrap();
        fs::write(&included_path, "int included() { return VALUE; }\n").unwrap();
        fs::write(&standalone_path, "int standalone() { return 1; }\n").unwrap();
        fs::write(
            &source_path,
            "#include \"shared.h\"\n#include \"included.c\"\nint caller() { return VALUE; }\n",
        )
        .unwrap();

        let roots = vec![root.clone()];
        let workspaces = vec![WorkspacePreprocessorConfig {
            root: root.clone(),
            ..WorkspacePreprocessorConfig::default()
        }];
        let files = source_files_for_generation(&roots, &AtomicU64::new(1), 1).unwrap();
        let stamps = file_stamps(&files);
        let fingerprint = configuration_fingerprint(&[], &workspaces);
        let cache_paths = WorkspaceIndexCachePaths {
            manifest: root.join("cache/manifest.json"),
            analysis: root.join("cache/analysis.json"),
        };
        let initial_analysis = Arc::new(Mutex::new(AnalysisDatabase::default()));
        let initial_result = index_roots(
            roots.clone(),
            Vec::new(),
            workspaces.clone(),
            Arc::clone(&initial_analysis),
            Arc::new(AtomicU64::new(1)),
            1,
            false,
        );
        assert_eq!(initial_result.indexed_files, 4);
        save_workspace_cache(&cache_paths, &fingerprint, &stamps, &initial_analysis);

        let restored_analysis = Arc::new(Mutex::new(AnalysisDatabase::default()));
        let (unchanged, cached_files) = restore_workspace_cache(
            &files,
            &stamps,
            &fingerprint,
            Some(&cache_paths),
            &restored_analysis,
        );
        assert!(unchanged.is_empty());
        assert_eq!(cached_files, 4);

        fs::write(&standalone_path, "int standalone() { return 12; }\n").unwrap();
        let changed_source_stamps = file_stamps(&files);
        let (changed_source, cached_files) = restore_workspace_cache(
            &files,
            &changed_source_stamps,
            &fingerprint,
            Some(&cache_paths),
            &Arc::new(Mutex::new(AnalysisDatabase::default())),
        );
        assert_eq!(changed_source, vec![standalone_path.clone()]);
        assert_eq!(cached_files, 3);

        fs::write(&included_path, "int included() { return VALUE + 2; }\n").unwrap();
        let changed_include_stamps = file_stamps(&files);
        let (changed_include, cached_files) = restore_workspace_cache(
            &files,
            &changed_include_stamps,
            &fingerprint,
            Some(&cache_paths),
            &Arc::new(Mutex::new(AnalysisDatabase::default())),
        );
        assert_eq!(
            changed_include.into_iter().collect::<HashSet<_>>(),
            HashSet::from([
                included_path.clone(),
                source_path.clone(),
                standalone_path.clone()
            ])
        );
        assert_eq!(cached_files, 1);

        fs::write(&header_path, "#define VALUE 22\n").unwrap();
        let changed_header_stamps = file_stamps(&files);
        let (changed_header, cached_files) = restore_workspace_cache(
            &files,
            &changed_header_stamps,
            &fingerprint,
            Some(&cache_paths),
            &Arc::new(Mutex::new(AnalysisDatabase::default())),
        );
        assert_eq!(changed_header.len(), 4);
        assert_eq!(cached_files, 0);

        fs::remove_dir_all(root).unwrap();
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
            vec![WorkspacePreprocessorConfig {
                root: root.clone(),
                ..WorkspacePreprocessorConfig::default()
            }],
            Arc::clone(&analysis),
            generation,
            1,
            false,
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
