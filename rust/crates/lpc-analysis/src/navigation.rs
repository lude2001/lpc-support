use super::*;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSymbol {
    pub name: String,
    pub kind: u32,
    pub location: Location,
    pub container_name: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentHighlight {
    pub range: Range,
    pub kind: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionDependency {
    pub path: String,
    pub kind: &'static str,
    pub targets: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectionSymbol {
    pub name: String,
    pub status: &'static str,
    pub definitions: Vec<Location>,
    pub macro_value: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisInspection {
    pub dependencies: Vec<InspectionDependency>,
    pub dependencies_complete: bool,
    pub symbol: Option<InspectionSymbol>,
}

impl AnalysisDatabase {
    /// Search declaration records already held in memory; never read workspace files here.
    pub fn workspace_symbols(&mut self, query: &str) -> Vec<WorkspaceSymbol> {
        self.metrics.query_count += 1;
        let query = query.trim().to_lowercase();
        let mut results = Vec::new();
        for (uri, file) in &self.files {
            for symbol in &file.symbols {
                if symbol.local || symbol.kind == SymbolKind::Parameter {
                    continue;
                }
                if symbol.kind == SymbolKind::Function
                    && !symbol.has_body
                    && file.symbols.iter().any(|other| {
                        other.name == symbol.name && other.kind == symbol.kind && other.has_body
                    })
                {
                    continue;
                }
                results.push(WorkspaceSymbol {
                    name: symbol.name.clone(),
                    kind: match symbol.kind {
                        SymbolKind::Function => 12,
                        SymbolKind::Type => 5,
                        _ => 13,
                    },
                    location: Location {
                        uri: uri.clone(),
                        range: byte_range_to_lsp(&file.source, symbol.selection.clone()),
                    },
                    container_name: uri.rsplit('/').next().unwrap_or(uri).to_owned(),
                });
            }
            for definition in &file.macros {
                results.push(WorkspaceSymbol {
                    name: definition.name.clone(),
                    kind: 14,
                    location: Location {
                        uri: uri.clone(),
                        range: byte_range_to_lsp(&file.source, definition.selection.clone()),
                    },
                    container_name: uri.rsplit('/').next().unwrap_or(uri).to_owned(),
                });
            }
        }
        let mut ranked: Vec<_> = results
            .into_iter()
            .filter_map(|symbol| {
                search_rank(&symbol.name.to_lowercase(), &query).map(|rank| (rank, symbol))
            })
            .collect();
        ranked.sort_by(|(a, left), (b, right)| {
            a.cmp(b)
                .then(left.name.cmp(&right.name))
                .then(left.location.uri.cmp(&right.location.uri))
                .then(
                    left.location
                        .range
                        .start
                        .line
                        .cmp(&right.location.range.start.line),
                )
                .then(
                    left.location
                        .range
                        .start
                        .character
                        .cmp(&right.location.range.start.character),
                )
        });
        ranked.dedup_by(|(_, left), (_, right)| {
            left.location == right.location && left.name == right.name
        });
        ranked
            .into_iter()
            .take(512)
            .map(|(_, symbol)| symbol)
            .collect()
    }

    pub fn document_highlights(&mut self, uri: &str, position: Position) -> Vec<DocumentHighlight> {
        self.metrics.query_count += 1;
        let Some((name, offset)) = self.identifier_at(uri, position) else {
            return Vec::new();
        };
        let file = &self.files[uri];
        let Some(origin_range) = identifier_range(file, offset) else {
            return Vec::new();
        };
        // Macro lifetime is source ordered, including #undef and redefinitions.
        if let Some((target_uri, _, definition)) =
            self.resolve_macro_reference_definition(uri, &name, offset)
        {
            let target_selection = definition.selection.clone();
            let mut ranges: Vec<_> = macro_candidate_ranges(file, &name)
                .into_iter()
                .filter(|range| {
                    (uri == target_uri && *range == target_selection)
                        || self
                            .resolve_macro_reference_definition(uri, &name, range.start)
                            .is_some_and(|(resolved_uri, _, definition)| {
                                resolved_uri == target_uri
                                    && definition.selection == target_selection
                            })
                })
                .collect();
            ranges.sort_by_key(|range| range.start);
            ranges.dedup();
            return ranges
                .into_iter()
                .map(|range| DocumentHighlight {
                    range: byte_range_to_lsp(&file.source, range),
                    kind: 1,
                })
                .collect();
        }
        let ordinary = |range: &std::ops::Range<usize>| {
            !is_member_access(&file.source, range.start)
                && scope_access_qualifier(&file.source, range.start).is_none()
        };
        if ordinary(&origin_range)
            && let Some(local) = resolved_symbols(file, &name, offset)
                .into_iter()
                .find(|symbol| symbol.local)
        {
            return file
                .identifiers
                .iter()
                .filter(|range| {
                    file.source.get((*range).clone()) == Some(name.as_str())
                        && ordinary(range)
                        && resolved_symbols(file, &name, range.start)
                            .first()
                            .is_some_and(|symbol| symbol.selection == local.selection)
                })
                .map(|range| DocumentHighlight {
                    range: byte_range_to_lsp(&file.source, range.clone()),
                    kind: 1,
                })
                .collect();
        }
        // Resolve only occurrences in this document, using the same definition identity as F12.
        // No workspace-wide references query is performed for a cursor movement.
        let targets = self.definition(uri, position);
        if targets.len() != 1 {
            return Vec::new();
        }
        let file = &self.files[uri];
        let visible = self.callable_visible_uris(uri);
        let workspace_definitions = self.workspace_symbol_locations(&name);
        let visible_definitions = workspace_definitions
            .iter()
            .filter(|location| visible.contains(&location.uri))
            .cloned()
            .collect();
        let mut cache = ReferenceResolutionCache {
            workspace_definitions,
            visible: HashMap::from([(uri.to_owned(), visible_definitions)]),
            ..Default::default()
        };
        file.identifiers
            .iter()
            .filter(|range| file.source.get((*range).clone()) == Some(name.as_str()))
            .filter(|range| {
                self.occurrence_resolves_to(
                    uri,
                    range,
                    &name,
                    &targets[0],
                    &HashSet::new(),
                    &mut cache,
                )
            })
            .map(|range| DocumentHighlight {
                range: byte_range_to_lsp(&file.source, range.clone()),
                kind: 1,
            })
            .collect()
    }

    pub fn inspect_analysis(
        &mut self,
        uri: &str,
        position: Position,
    ) -> Option<AnalysisInspection> {
        self.metrics.query_count += 1;
        let file = self.files.get(uri)?;
        let mut dependencies = Vec::new();
        for (kind, paths) in [
            ("include", file.dependencies.as_slice()),
            ("globalInclude", self.global_includes.as_slice()),
            ("simulatedEfun", self.simulated_efun_files.as_slice()),
        ] {
            for path in paths {
                let resolved = self
                    .resolve_path_token(path)
                    .unwrap_or_else(|| path.clone());
                let mut targets: Vec<_> =
                    self.path_target_uris(uri, &resolved).into_iter().collect();
                targets.sort();
                dependencies.push(InspectionDependency {
                    path: path.clone(),
                    kind: if kind == "include" && file.inherits.contains(path) {
                        "inherit"
                    } else {
                        kind
                    },
                    targets,
                });
            }
        }
        let dependencies_complete = dependencies
            .iter()
            .all(|dependency| !dependency.targets.is_empty())
            && self.file_dependencies_fully_resolved(uri, &mut HashSet::new());
        let symbol = if let Some((name, offset)) = self.identifier_at(uri, position) {
            let macro_value = self
                .resolve_macro_reference_definition(uri, &name, offset)
                .map(|(_, _, definition)| definition.value.clone());
            let predefined = (!self.macro_is_locally_undefined(uri, &name, offset))
                .then(|| self.predefined_macros.get(&name).cloned())
                .flatten();
            let unqualified = identifier_range(&self.files[uri], offset).is_some_and(|range| {
                !is_member_access(&self.files[uri].source, range.start)
                    && scope_access_qualifier(&self.files[uri].source, range.start)
                        .is_none_or(|qualifier| qualifier == "efun")
            });
            let definitions = self.definition(uri, position);
            let status = if macro_value.is_some() {
                "macro"
            } else if definitions.len() > 1 {
                "ambiguous"
            } else if definitions.len() == 1 {
                "resolved"
            } else if predefined.is_some() {
                "predefinedMacro"
            } else if unqualified && self.external_functions.contains_key(&name) {
                "efun"
            } else {
                "unresolved"
            };
            Some(InspectionSymbol {
                name,
                status,
                definitions,
                macro_value: macro_value.or(predefined),
            })
        } else {
            None
        };
        Some(AnalysisInspection {
            dependencies,
            dependencies_complete,
            symbol,
        })
    }
}

fn search_rank(name: &str, query: &str) -> Option<u8> {
    if query.is_empty() || name == query {
        return Some(0);
    }
    if name.starts_with(query) {
        return Some(1);
    }
    if name.contains(query) {
        return Some(2);
    }
    let mut chars = name.chars();
    query
        .chars()
        .all(|needle| chars.by_ref().any(|ch| ch == needle))
        .then_some(3)
}

#[cfg(test)]
mod tests {
    use super::*;
    const URI: &str = "file:///mud/demo.c";

    fn put(db: &mut AnalysisDatabase, uri: &str, source: &str) {
        let processed = lpc_preprocessor::Preprocessor::default().process(source);
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(&processed.text, None).unwrap();
        db.update_preprocessed(
            uri,
            1,
            1,
            &tree,
            source,
            (
                &processed.macro_directives,
                &processed.initial_definitions,
                &processed.includes,
                &processed.inactive_regions,
            ),
        );
    }

    fn at(source: &str, needle: &str) -> Position {
        byte_range_to_lsp(
            source,
            source.find(needle).unwrap()..source.find(needle).unwrap(),
        )
        .start
    }

    #[test]
    fn symbols_filter_locals_inactive_branches_and_duplicate_prototypes() {
        let mut db = AnalysisDatabase::default();
        put(
            &mut db,
            URI,
            "#define FEATURE 1\n#if 0\nint hidden;\n#endif\nint total;\nint query();\nint query() { int secret; return total; }\n",
        );
        let before = db.metrics().snapshot_build_count;
        let symbols = db.workspace_symbols("");
        assert_eq!(
            symbols.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(),
            ["FEATURE", "query", "total"]
        );
        assert_eq!(db.workspace_symbols("QR")[0].name, "query");
        assert_eq!(db.workspace_symbols("total")[0].kind, 13);
        assert_eq!(db.metrics().snapshot_build_count, before);
        put(&mut db, URI, "int replaced() { return 0; }\n");
        assert!(db.workspace_symbols("query").is_empty());
        db.remove(URI);
        assert!(db.workspace_symbols("").is_empty());
    }

    #[test]
    fn highlights_respect_shadowing_comments_strings_and_member_names() {
        let mut db = AnalysisDatabase::default();
        let source = "int total;\nint first(int total) { object obj; total++; obj->total(); return total; }\nint second() { return total; }\n// total\nstring text = \"total\";\n";
        put(&mut db, URI, source);
        let highlights = db.document_highlights(URI, at(source, "total++"));
        assert_eq!(highlights.len(), 3);
        assert!(highlights.iter().all(|h| h.range.start.line == 1));
        let globals = db.document_highlights(URI, at(source, "total;"));
        assert_eq!(globals.len(), 2);
        assert_eq!(globals[1].range.start.line, 2);
    }

    #[test]
    fn highlights_isolate_macro_lifetimes_and_inactive_code() {
        let mut db = AnalysisDatabase::default();
        let source = "#define FLAG 1\nint first = FLAG;\n#undef FLAG\n#define FLAG 2\nint second = FLAG;\n#if 0\nint hidden = FLAG;\n#endif\n";
        put(&mut db, URI, source);
        let highlights = db.document_highlights(URI, at(source, "FLAG;"));
        assert_eq!(highlights.len(), 3);
        assert_eq!(
            highlights
                .iter()
                .map(|h| h.range.start.line)
                .collect::<Vec<_>>(),
            [0, 1, 2]
        );
        let second = db.document_highlights(
            URI,
            Position {
                line: 4,
                character: 15,
            },
        );
        assert_eq!(second.len(), 2);
    }

    #[test]
    fn highlights_resolve_inherited_and_simulated_functions_without_other_files() {
        let mut db = AnalysisDatabase::default();
        put(&mut db, "file:///mud/base.c", "int query() { return 1; }\n");
        put(
            &mut db,
            "file:///mud/simul.c",
            "int helper() { return 1; }\n",
        );
        db.set_simulated_efun_files(vec!["/simul".into()]);
        let source =
            "inherit \"/base\";\nint caller() { query(); query(); helper(); return helper(); }\n";
        put(&mut db, URI, source);
        assert_eq!(db.document_highlights(URI, at(source, "query();")).len(), 2);
        assert_eq!(
            db.document_highlights(URI, at(source, "helper();")).len(),
            2
        );
    }

    #[test]
    fn inspection_reports_missing_dependencies_and_macro_origin() {
        let mut db = AnalysisDatabase::default();
        let source = "#include \"missing.h\"\n#define FLAG 7\nint value = FLAG;\n";
        put(&mut db, URI, source);
        let report = db.inspect_analysis(URI, at(source, "FLAG;")).unwrap();
        assert!(!report.dependencies_complete);
        assert!(report.dependencies[0].targets.is_empty());
        let symbol = report.symbol.unwrap();
        assert_eq!(symbol.status, "macro");
        assert_eq!(symbol.macro_value.as_deref(), Some("7"));
        assert_eq!(symbol.definitions[0].uri, URI);
    }

    #[test]
    fn highlights_distinguish_object_targets_and_preserve_utf16_positions() {
        let mut db = AnalysisDatabase::default();
        put(&mut db, "file:///mud/a.c", "int query() { return 1; }\n");
        put(&mut db, "file:///mud/b.c", "int query() { return 2; }\n");
        let source = "int run(object unknown) { string text = \"中文😀\"; load_object(\"/a\")->query(); load_object(\"/a\")->query(); load_object(\"/b\")->query(); unknown->query(); return 0; }\n";
        put(&mut db, URI, source);
        let highlights = db.document_highlights(URI, at(source, "query();"));
        assert_eq!(highlights.len(), 2);
        assert_eq!(highlights[0].range.start, at(source, "query();"));
        assert!(
            db.document_highlights(
                URI,
                Position {
                    line: 0,
                    character: source[..source.find("unknown->query").unwrap()]
                        .encode_utf16()
                        .count() as u32
                        + 10
                }
            )
            .is_empty()
        );
    }

    #[test]
    fn symbol_search_has_a_stable_limit_and_prioritizes_exact_matches() {
        let mut db = AnalysisDatabase::default();
        let mut source: String = (0..600).map(|i| format!("int entry_{i};\n")).collect();
        source.push_str("int entry;\n");
        put(&mut db, URI, &source);
        assert_eq!(db.workspace_symbols("").len(), 512);
        assert_eq!(db.workspace_symbols("entry")[0].name, "entry");
        assert_eq!(db.workspace_symbols("entry_599").len(), 1);
        assert_eq!(db.workspace_symbols("entry_599")[0].name, "entry_599");
    }
}
