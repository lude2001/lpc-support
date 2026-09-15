use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use lpc_preprocessor::{PreprocessedDocument, Preprocessor};

type MacroEnvironment = HashMap<String, String>;
type HeaderCacheKey = Vec<(String, Option<String>)>;

#[derive(Debug, Clone)]
struct HeaderEffect {
    definitions: MacroEnvironment,
    removed: HashSet<String>,
}

#[derive(Debug, Clone, Default)]
struct HeaderRelevance {
    names: HashSet<String>,
    full_environment: bool,
}

type HeaderCache = HashMap<PathBuf, Vec<(HeaderCacheKey, HeaderEffect)>>;

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
    header_cache: HeaderCache,
    header_relevance_cache: HashMap<PathBuf, HeaderRelevance>,
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
        self.header_relevance_cache.clear();
    }

    pub fn clear_cache(&mut self) {
        self.header_cache.clear();
        self.header_relevance_cache.clear();
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
            definitions =
                self.header_definitions(&global_path, &workspace, definitions, &mut visited);
        }
        self.process_source(path, source, &workspace, definitions, &mut visited)
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
        definitions: HashMap<String, String>,
        visited: &mut HashSet<PathBuf>,
    ) -> HashMap<String, String> {
        let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        let relevance = if let Some(cached) = self.header_relevance_cache.get(&canonical) {
            cached.clone()
        } else {
            let computed = header_relevance(&canonical, workspace, &mut HashSet::new());
            self.header_relevance_cache
                .insert(canonical.clone(), computed.clone());
            computed
        };
        let cache_key = header_cache_key(&relevance, &definitions);
        if let Some((_, effect)) = self
            .header_cache
            .get(&canonical)
            .and_then(|entries| entries.iter().find(|(key, _)| key == &cache_key))
        {
            return apply_header_effect(definitions, effect);
        }
        if !visited.insert(canonical.clone()) {
            return definitions;
        }
        let Ok(source) = fs::read_to_string(&canonical) else {
            visited.remove(&canonical);
            return definitions;
        };
        let input = definitions.clone();
        let processed =
            self.process_source(Some(&canonical), &source, workspace, definitions, visited);
        visited.remove(&canonical);
        self.header_cache.entry(canonical).or_default().push((
            cache_key,
            header_effect(&input, &processed.final_definitions),
        ));
        processed.final_definitions
    }

    fn process_source(
        &mut self,
        path: Option<&Path>,
        source: &str,
        workspace: &WorkspacePreprocessorConfig,
        definitions: HashMap<String, String>,
        visited: &mut HashSet<PathBuf>,
    ) -> PreprocessedDocument {
        Preprocessor::with_predefined(definitions).process_with_include_resolver(
            source,
            |include, system, current_definitions| {
                let header_path = resolve_include(path, include, system, workspace)?;
                Some(self.header_definitions(
                    &header_path,
                    workspace,
                    current_definitions.clone(),
                    visited,
                ))
            },
        )
    }
}

fn header_cache_key(relevance: &HeaderRelevance, definitions: &MacroEnvironment) -> HeaderCacheKey {
    let mut relevant = if relevance.full_environment {
        definitions.keys().cloned().collect::<HashSet<_>>()
    } else {
        relevance.names.clone()
    };
    let mut pending = relevant.iter().cloned().collect::<Vec<_>>();
    while let Some(name) = pending.pop() {
        let Some(value) = definitions.get(&name) else {
            continue;
        };
        for nested in identifiers_in(value) {
            if relevant.insert(nested.clone()) {
                pending.push(nested);
            }
        }
    }
    let mut key = relevant
        .into_iter()
        .map(|name| {
            let value = definitions.get(&name).cloned();
            (name, value)
        })
        .collect::<Vec<_>>();
    key.sort_by(|left, right| left.0.cmp(&right.0));
    key
}

fn header_relevance(
    path: &Path,
    workspace: &WorkspacePreprocessorConfig,
    visited: &mut HashSet<PathBuf>,
) -> HeaderRelevance {
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    if !visited.insert(canonical.clone()) {
        return HeaderRelevance::default();
    }
    let Ok(source) = fs::read_to_string(&canonical) else {
        return HeaderRelevance::default();
    };
    let mut relevance = HeaderRelevance::default();
    for directive in logical_directives(&source) {
        let mut fields = directive.splitn(2, char::is_whitespace);
        let name = fields.next().unwrap_or_default();
        let arguments = fields.next().unwrap_or_default().trim();
        if matches!(name, "if" | "elif" | "ifdef" | "ifndef") {
            relevance.names.extend(
                identifiers_in(arguments)
                    .into_iter()
                    .filter(|identifier| identifier != "defined"),
            );
        }
        if matches!(name, "define" | "undef")
            && let Some(macro_name) = identifiers_in(arguments).first()
        {
            relevance.names.insert(macro_name.clone());
        }
        if name != "include" {
            continue;
        }
        let (include, system) = if let Some(parsed) = include_argument(arguments) {
            parsed
        } else {
            let macro_name = arguments
                .split(|character: char| character.is_whitespace() || character == '(')
                .next()
                .unwrap_or_default();
            if macro_name.is_empty() {
                continue;
            }
            relevance.names.insert(macro_name.to_owned());
            relevance.full_environment = true;
            continue;
        };
        if let Some(nested) = resolve_include(Some(&canonical), &include, system, workspace) {
            let nested = header_relevance(&nested, workspace, visited);
            relevance.names.extend(nested.names);
            relevance.full_environment |= nested.full_environment;
        }
    }
    relevance
}

fn logical_directives(source: &str) -> Vec<String> {
    let mut directives = Vec::new();
    let mut current = String::new();
    for line in source.lines() {
        let trimmed = line.trim_start();
        if current.is_empty() {
            let Some(body) = trimmed.strip_prefix('#') else {
                continue;
            };
            current.push_str(body.trim_start());
        } else {
            current.push(' ');
            current.push_str(trimmed);
        }
        if current.trim_end().ends_with('\\') {
            current.truncate(current.trim_end().len().saturating_sub(1));
            continue;
        }
        directives.push(std::mem::take(&mut current));
    }
    if !current.is_empty() {
        directives.push(current);
    }
    directives
}

fn identifiers_in(value: &str) -> Vec<String> {
    let bytes = value.as_bytes();
    let mut identifiers = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        if !(bytes[index].is_ascii_alphabetic() || bytes[index] == b'_') {
            index += 1;
            continue;
        }
        let start = index;
        index += 1;
        while index < bytes.len() && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'_')
        {
            index += 1;
        }
        identifiers.push(value[start..index].to_owned());
    }
    identifiers
}

fn include_argument(arguments: &str) -> Option<(String, bool)> {
    let start = arguments.find(['"', '<'])?;
    let opening = arguments.as_bytes()[start];
    let closing = if opening == b'<' { '>' } else { '"' };
    let content_start = start + 1;
    let end = arguments[content_start..].find(closing)? + content_start;
    Some((arguments[content_start..end].to_owned(), opening == b'<'))
}

fn header_effect(input: &MacroEnvironment, output: &MacroEnvironment) -> HeaderEffect {
    HeaderEffect {
        definitions: output
            .iter()
            .filter(|(name, value)| input.get(*name) != Some(*value))
            .map(|(name, value)| (name.clone(), value.clone()))
            .collect(),
        removed: input
            .keys()
            .filter(|name| !output.contains_key(*name))
            .cloned()
            .collect(),
    }
}

fn apply_header_effect(
    mut definitions: MacroEnvironment,
    effect: &HeaderEffect,
) -> MacroEnvironment {
    for name in &effect.removed {
        definitions.remove(name);
    }
    definitions.extend(effect.definitions.clone());
    definitions
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
        fs::write(
            include.join("feature.h"),
            concat!(
                "#define FEATURE_FLAG 1\n",
                "#define RequestType(name, method) \\\n",
                "    string name##_request_type = method;\n",
            ),
        )
        .unwrap();
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
        let imported_function_macro = processed
            .final_definitions
            .get("RequestType")
            .expect("function macro should use its bare name as the environment key");
        assert!(imported_function_macro.starts_with("(name, method)"));
        assert!(imported_function_macro.ends_with("string name##_request_type = method;"));

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

    #[test]
    fn preserves_define_include_and_undef_order_across_headers() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("lpc-preprocessor-order-{unique}"));
        let include = root.join("include");
        fs::create_dir_all(&include).unwrap();
        fs::write(
            include.join("feature.h"),
            concat!(
                "#if SOURCE_FLAG == 7\n",
                "#define HEADER_RESULT 1\n",
                "#endif\n",
                "#undef SOURCE_FLAG\n",
            ),
        )
        .unwrap();
        let source_path = root.join("demo.c");
        let source = concat!(
            "#define SOURCE_FLAG 7\n",
            "#include <feature.h>\n",
            "#if HEADER_RESULT && !defined(SOURCE_FLAG)\n",
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
                global_include_file: None,
            }],
        );
        let processed = processor.process(Some(&source_path), source);
        assert!(processed.text.contains("int enabled;"));
        assert!(!processed.text.contains("int disabled;"));
        assert!(!processed.final_definitions.contains_key("SOURCE_FLAG"));
        assert_eq!(
            processed
                .final_definitions
                .get("HEADER_RESULT")
                .map(String::as_str),
            Some("1")
        );
        fs::remove_dir_all(root).unwrap();
    }
}
