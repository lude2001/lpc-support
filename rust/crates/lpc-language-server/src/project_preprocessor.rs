use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use lpc_preprocessor::{PreprocessedDocument, Preprocessor};

#[derive(Debug, Clone, Default)]
pub struct WorkspacePreprocessorConfig {
    pub root: PathBuf,
    pub include_directories: Vec<PathBuf>,
    pub global_include_file: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ProjectPreprocessor {
    base_definitions: Vec<(String, String)>,
    workspaces: Vec<WorkspacePreprocessorConfig>,
    header_cache: HashMap<PathBuf, HashMap<String, String>>,
}

impl ProjectPreprocessor {
    pub fn configure(
        &mut self,
        base_definitions: Vec<(String, String)>,
        workspaces: Vec<WorkspacePreprocessorConfig>,
    ) {
        self.base_definitions = base_definitions;
        self.workspaces = workspaces;
        self.header_cache.clear();
    }

    pub fn clear_cache(&mut self) {
        self.header_cache.clear();
    }

    pub fn process(&mut self, path: Option<&Path>, source: &str) -> PreprocessedDocument {
        let mut definitions = self.base_map();
        let workspace = path
            .and_then(|path| self.workspace_for(path))
            .cloned()
            .or_else(|| self.workspaces.first().cloned());
        let Some(workspace) = workspace else {
            return Preprocessor::with_predefined(definitions).process(source);
        };

        let mut visited = HashSet::new();
        if !path.is_some_and(is_header_path)
            && let Some(global_include) = workspace.global_include_file.as_deref()
            && let Some(global_path) = resolve_include(path, global_include, true, &workspace)
        {
            definitions.extend(self.header_definitions(&global_path, &workspace, &mut visited));
        }

        let preliminary = Preprocessor::with_predefined(definitions.clone()).process(source);
        let mut imports_changed = false;
        for include in &preliminary.includes {
            if let Some(header_path) =
                resolve_include(path, &include.path, include.system, &workspace)
            {
                for (name, value) in self.header_definitions(&header_path, &workspace, &mut visited)
                {
                    imports_changed |= definitions.get(&name) != Some(&value);
                    definitions.insert(name, value);
                }
            }
        }
        if imports_changed {
            Preprocessor::with_predefined(definitions).process(source)
        } else {
            preliminary
        }
    }

    fn workspace_for(&self, path: &Path) -> Option<&WorkspacePreprocessorConfig> {
        self.workspaces
            .iter()
            .filter(|workspace| path.starts_with(&workspace.root))
            .max_by_key(|workspace| workspace.root.components().count())
    }

    fn base_map(&self) -> HashMap<String, String> {
        self.base_definitions.iter().cloned().collect()
    }

    fn header_definitions(
        &mut self,
        path: &Path,
        workspace: &WorkspacePreprocessorConfig,
        visited: &mut HashSet<PathBuf>,
    ) -> HashMap<String, String> {
        let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        if let Some(cached) = self.header_cache.get(&canonical) {
            return cached.clone();
        }
        if !visited.insert(canonical.clone()) {
            return HashMap::new();
        }
        let Ok(source) = fs::read_to_string(&canonical) else {
            visited.remove(&canonical);
            return HashMap::new();
        };

        let mut definitions = self.base_map();
        let preliminary = Preprocessor::with_predefined(definitions.clone()).process(&source);
        for include in &preliminary.includes {
            if let Some(nested_path) =
                resolve_include(Some(&canonical), &include.path, include.system, workspace)
            {
                definitions.extend(self.header_definitions(&nested_path, workspace, visited));
            }
        }
        let processed = Preprocessor::with_predefined(definitions).process(&source);
        visited.remove(&canonical);
        self.header_cache
            .insert(canonical, processed.final_definitions.clone());
        processed.final_definitions
    }
}

fn is_header_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("h"))
}

fn resolve_include(
    source_path: Option<&Path>,
    include: &str,
    system: bool,
    workspace: &WorkspacePreprocessorConfig,
) -> Option<PathBuf> {
    let include = include
        .trim_matches(['<', '>', '"'])
        .trim_start_matches(['/', '\\']);
    let mut candidates = Vec::new();
    if !system && let Some(parent) = source_path.and_then(Path::parent) {
        candidates.push(parent.join(include));
    }
    for directory in &workspace.include_directories {
        let relative = directory
            .to_string_lossy()
            .trim_start_matches(['/', '\\'])
            .to_owned();
        let directory = workspace.root.join(relative);
        candidates.push(directory.join(include));
    }
    candidates.push(workspace.root.join(include));
    candidates.push(workspace.root.join("include").join(include));
    candidates.into_iter().find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;

    #[test]
    fn imports_direct_nested_and_global_header_macros_before_condition_evaluation() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("lpc-preprocessor-env-{unique}"));
        let include = root.join("include");
        fs::create_dir_all(&include).unwrap();
        fs::write(include.join("nested.h"), "#define NESTED_FLAG 1\n").unwrap();
        fs::write(
            include.join("global.h"),
            "#ifndef GLOBAL_H\n#define GLOBAL_H 1\n#include <nested.h>\n#define GLOBAL_FLAG 1\n#endif\n",
        )
        .unwrap();
        fs::write(include.join("feature.h"), "#define FEATURE_FLAG 1\n").unwrap();
        let source_path = root.join("demo.c");
        let source = concat!(
            "#include <feature.h>\n",
            "#if FEATURE_FLAG && GLOBAL_FLAG && NESTED_FLAG\n",
            "int enabled;\n",
            "#else\n",
            "int disabled;\n",
            "#endif\n",
        );

        let mut processor = ProjectPreprocessor::default();
        processor.configure(
            Vec::new(),
            vec![WorkspacePreprocessorConfig {
                root: root.clone(),
                include_directories: vec![PathBuf::from("include")],
                global_include_file: Some("global.h".to_owned()),
            }],
        );
        let processed = processor.process(Some(&source_path), source);
        assert!(processed.text.contains("int enabled;"));
        assert!(!processed.text.contains("int disabled;"));

        let global_source = fs::read_to_string(include.join("global.h")).unwrap();
        let global_processed = processor.process(Some(&include.join("global.h")), &global_source);
        assert_eq!(
            global_processed
                .final_definitions
                .get("GLOBAL_FLAG")
                .map(String::as_str),
            Some("1")
        );

        fs::remove_dir_all(root).unwrap();
    }
}
