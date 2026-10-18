use super::*;

fn database(source: &str) -> AnalysisDatabase {
    let processed = lpc_preprocessor::Preprocessor::default().process(source);
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .unwrap();
    let tree = parser.parse(&processed.text, None).unwrap();
    let mut database = AnalysisDatabase::default();
    database.update_preprocessed(
        "file:///coverage.c",
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
    database
}

#[test]
fn retains_declarations_and_signatures_for_promises_and_special_forms() {
    let source = concat!(
        "promise<int> *pending;\n",
        "async int produce() { return 1; }\n",
        "promise<int> pass(promise<int> item) { return item; }\n",
        "async mixed demo(mapping data, mixed *values, int ref value) {\n",
        "  mixed elapsed = time_expression(value++, value);\n",
        "  string label = `value=${value}`;\n",
        "  acatch { value = await produce(); };\n",
        "  values = ({ values..., label });\n",
        "  foreach (int &item in values) { item++; }\n",
        "  return ({ data?.key, data?.[\"key\"], data.?[\"key\"], elapsed, pending });\n",
        "}\n",
    );
    let mut analysis = database(source);
    assert!(
        analysis.diagnostics("file:///coverage.c").is_empty(),
        "{:?}",
        analysis.diagnostics("file:///coverage.c")
    );
    assert!(
        analysis
            .document_variables("file:///coverage.c")
            .iter()
            .any(|variable| variable.name == "pending")
    );
    let docs = analysis
        .function_documentation_lookup("file:///coverage.c")
        .unwrap();
    let pass = docs
        .current_file
        .entries
        .iter()
        .find(|entry| entry.name == "pass")
        .unwrap();
    let signature = pass.structured_signature.as_ref().unwrap();
    assert_eq!(signature.return_type.as_deref(), Some("promise<int>"));
    assert_eq!(
        signature.parameters[0].type_name.as_deref(),
        Some("promise<int>")
    );
    let call = source.find("await produce").unwrap() + 7;
    assert_eq!(
        analysis
            .definition("file:///coverage.c", byte_to_lsp_position(source, call))
            .len(),
        1
    );
}

#[test]
fn indexes_all_class_fields_for_dot_and_arrow_navigation() {
    let source =
        "class Pair { int x, y; }\nclass Pair point;\nint demo() { return point->y + point.x; }\n";
    let mut analysis = database(source);
    assert!(analysis.diagnostics("file:///coverage.c").is_empty());
    for marker in ["->y", ".x"] {
        let offset = source.find(marker).unwrap() + marker.len() - 1;
        let definitions =
            analysis.definition("file:///coverage.c", byte_to_lsp_position(source, offset));
        assert_eq!(definitions.len(), 1, "{marker}");
        assert_eq!(definitions[0].range.start.line, 0);
    }
}

#[test]
fn indexes_macro_generated_variables_and_respects_type_alias_lifetimes() {
    let source = concat!(
        "#define INTEGER int\n",
        "#define DECL(name) int name = 1\n",
        "DECL(value);\n",
        "INTEGER demo(INTEGER x) { return x + value; }\n",
        "INTEGER literal() { return 1; }\n",
        "#undef INTEGER\n",
        "#define INTEGER string\n",
        "INTEGER text() { return \"ok\"; }\n",
    );
    let mut analysis = database(source);
    assert!(
        analysis.diagnostics("file:///coverage.c").is_empty(),
        "{:?}",
        analysis.diagnostics("file:///coverage.c")
    );
    assert!(
        analysis
            .document_variables("file:///coverage.c")
            .iter()
            .any(|variable| variable.name == "value")
    );
    let call = byte_to_lsp_position(source, source.find("x + value").unwrap() + 5);
    let definitions = analysis.definition("file:///coverage.c", call);
    assert_eq!(definitions.len(), 1);
    assert_eq!(definitions[0].range.start.line, 2);
}

#[test]
fn rejects_only_proven_invalid_async_contexts() {
    for source in [
        "int demo() { return await 1; }",
        "mixed demo() { return acatch(1); }",
        "async mixed demo() { return catch(await 1); }",
        "async mixed demo() { return time_expression(await 1); }",
        "async mixed demo() { return (: await 1 :); }",
        "async mixed demo() { return function() { return await 1; }; }",
    ] {
        let mut analysis = database(source);
        assert!(
            analysis
                .diagnostics("file:///coverage.c")
                .iter()
                .any(|diagnostic| diagnostic.code == "lpc.asyncContext"),
            "{source}"
        );
    }
    let mut analysis = database("async mixed demo() { return acatch(await 1); }");
    assert!(analysis.diagnostics("file:///coverage.c").is_empty());
}

#[test]
fn rejects_optional_assignment_without_rejecting_optional_index_values() {
    for expression in [
        "data?.key = 1",
        "++data?.key",
        "(data?.key)++",
        "(data?.key) = 1",
    ] {
        let mut analysis = database(&format!("void demo(mapping data) {{ {expression}; }}"));
        assert!(
            analysis
                .diagnostics("file:///coverage.c")
                .iter()
                .any(|diagnostic| diagnostic.code == "lpc.optionalAssignment"),
            "{expression}"
        );
    }
    let mut analysis = database("void demo(mapping data, int *items) { items[data?.key] = 1; }");
    assert!(analysis.diagnostics("file:///coverage.c").is_empty());
}

#[test]
fn distinguishes_void_promises_from_promises_of_arrays() {
    let mut analysis = database("promise<void> invalid;");
    assert!(
        analysis
            .diagnostics("file:///coverage.c")
            .iter()
            .any(|diagnostic| diagnostic.code == "lpc.promiseType")
    );
    let mut analysis = database("promise<void *> values;");
    assert!(analysis.diagnostics("file:///coverage.c").is_empty());
}

#[test]
fn keeps_modified_inheritance_in_the_resolution_graph() {
    let source = "private inherit \"/std/base\"; int demo() { return inherited(); }\n";
    let mut analysis = database(source);
    let base = "int inherited() { return 1; }\n";
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .unwrap();
    analysis.index_source(
        "file:///mud/std/base.c",
        &parser.parse(base, None).unwrap(),
        base,
    );
    let position = byte_to_lsp_position(source, source.rfind("inherited").unwrap());
    let definitions = analysis.definition("file:///coverage.c", position);
    assert_eq!(definitions.len(), 1);
    assert_eq!(definitions[0].uri, "file:///mud/std/base.c");
}
