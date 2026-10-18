use tree_sitter::Parser;

use super::*;

#[test]
fn preserves_syntax_structure_across_the_driver_matrix() {
    let cases: serde_json::Value =
        serde_json::from_str(include_str!("../../../grammar/lpc/test/coverage.json")).unwrap();
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .unwrap();
    for case in cases.as_array().unwrap() {
        let source = case["source"].as_str().unwrap();
        let tree = parser.parse(source, None).unwrap();
        let formatted = format_document(&tree, source, FormatterConfig::default())
            .unwrap_or_else(|| panic!("formatter rejected {}", case["id"]));
        let formatted_tree = parser.parse(&formatted, None).unwrap();
        assert!(
            !formatted_tree.root_node().has_error(),
            "{}: {formatted}",
            case["id"]
        );
        assert_eq!(
            tree.root_node().to_sexp(),
            formatted_tree.root_node().to_sexp(),
            "{}: {formatted}",
            case["id"]
        );
        assert_eq!(
            named_leaf_values(tree.root_node(), source),
            named_leaf_values(formatted_tree.root_node(), &formatted),
            "{} changed a name or literal value",
            case["id"]
        );
        assert_eq!(format(&formatted), formatted, "{}", case["id"]);
    }
}

fn named_leaf_values(node: Node<'_>, source: &str) -> Vec<(String, String)> {
    if matches!(node.kind(), "comment" | "preprocessor_directive") {
        return Vec::new();
    }
    if matches!(
        node.kind(),
        "identifier"
            | "primitive_type"
            | "modifier"
            | "number_literal"
            | "string_literal"
            | "template_text"
            | "heredoc_literal"
            | "character_literal"
            | "parameter_placeholder"
    ) {
        return vec![(node.kind().to_owned(), source[node.byte_range()].to_owned())];
    }
    let mut cursor = node.walk();
    node.named_children(&mut cursor)
        .flat_map(|child| named_leaf_values(child, source))
        .collect()
}

fn format(source: &str) -> String {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .unwrap();
    let tree = parser.parse(source, None).unwrap();
    format_document_checked(
        &tree,
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    )
    .unwrap_or_else(|error| {
        let syntax = SourceSyntax::parse(&mut parser, source, &FormatContext::default()).unwrap();
        let candidate = apply_edits(
            source,
            &Layout::build(&syntax, source, FormatterConfig::default())
                .unwrap()
                .edits(),
        )
        .unwrap();
        panic!("formatter rejected {error}: {candidate}")
    })
}

#[test]
fn formats_functions_and_control_flow_with_allman_braces() {
    assert_eq!(
        format("void test(){if(x){foo();}else{bar();}}"),
        "void test()\n{\n    if (x)\n    {\n        foo();\n    }\n    else\n    {\n        bar();\n    }\n}"
    );
}

#[test]
fn preserves_async_modifier_and_await_expressions() {
    let output = format("private async void drain(){await async_yield();return await next()+1;}");
    assert!(output.contains("private async void drain()"), "{output}");
    assert!(output.contains("await async_yield();"), "{output}");
    assert!(output.contains("return await next() + 1;"), "{output}");
    assert_eq!(format(&output), output);
}

#[test]
fn preserves_complete_class_types_and_nested_closure_layers() {
    for keyword in ["class", "struct"] {
        let source = format!("{keyword} Point {{ int x; }} {keyword} Point p, *points;");
        let output = format(&source);
        assert!(output.contains(&format!("{keyword} Point p,")), "{output}");
        assert!(output.contains("points;"), "{output}");
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        assert_eq!(
            parser.parse(&source, None).unwrap().root_node().to_sexp(),
            parser.parse(&output, None).unwrap().root_node().to_sexp()
        );
        assert_eq!(format(&output), output);
    }
    let output = format("function demo() { return (: (: $1 + 1 :) :); }");
    assert_eq!(output.matches("(:").count(), 2, "{output}");
    assert_eq!(output.matches(":)").count(), 2, "{output}");
    assert_eq!(format(&output), output);
}

#[test]
fn preserves_scientific_literals_as_single_tokens() {
    for literal in ["1e-3", "1e+3", "1.25e-2", "1_2.5E+2"] {
        let output = format(&format!("float demo() {{ return {literal}; }}"));
        assert!(output.contains(&format!("return {literal};")), "{output}");
        assert_eq!(format(&output), output);
    }
    let output = format("mixed demo(int *a) { return a[1..5]; }");
    assert!(output.contains("1 .. 5"), "{output}");
}

#[test]
fn preserves_multi_character_operators() {
    let output = format("void test(){if(a>=b && c==d){value+=1;}}");
    assert!(output.contains("if (a >= b && c == d)"));
    assert!(output.contains("value += 1;"));
}

#[test]
fn expands_nested_mappings_and_arrays_from_cst_nodes() {
    let output =
        format("mapping data = ([ \"name\":\"sword\", \"actions\":({ \"slash\", \"parry\" }) ]);");
    assert!(output.contains("mapping data = ([\n"), "{output}");
    assert!(output.contains("    \"name\" : \"sword\""), "{output}");
    assert!(output.contains("    \"actions\" : ({\n"), "{output}");
    assert!(output.contains("        \"slash\",\n"), "{output}");
    assert!(output.contains("        \"parry\"\n"), "{output}");
}

#[test]
fn preserves_comments_between_collection_entries() {
    let output = format(
        "mapping data = ([ \"first\":({ 1 }), // explanation\n// keep first 25\n\"second\":({ 2 }) ]);",
    );
    assert_eq!(output.matches("// explanation").count(), 1, "{output}");
    assert_eq!(output.matches("// keep first 25").count(), 1, "{output}");
    assert!(output.contains("// explanation\n"), "{output}");
    assert!(output.contains("// keep first 25\n"), "{output}");
}

#[test]
fn preserves_comment_after_else_keyword() {
    let output = format("void test(){if(x){foo();}else // alternate path\n{bar();}}");
    assert_eq!(output.matches("// alternate path").count(), 1, "{output}");
    assert!(output.contains("else // alternate path\n"), "{output}");
}

#[test]
fn preserves_comment_between_else_and_nested_if_without_commenting_out_condition() {
    let output =
        format("void test(){if(x){foo();}else // alternate condition\nif(y){bar();}else{baz();}}");
    assert_eq!(
        output.matches("// alternate condition").count(),
        1,
        "{output}"
    );
    assert!(
        output.contains("else // alternate condition\n    if (y)"),
        "{output}"
    );
}

#[test]
fn preserves_documentation_comments_before_consecutive_functions() {
    let output = format(
        "/** first docs */\nint first(){return 1;}\n/** second docs */\nint second(){return 2;}",
    );
    assert_eq!(output.matches("/** first docs */").count(), 1, "{output}");
    assert_eq!(output.matches("/** second docs */").count(), 1, "{output}");
}

#[test]
fn rejects_syntax_errors_and_directives_instead_of_corrupting_source() {
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .unwrap();
    let source = "#if 0\nnot valid\n#endif\n";
    let tree = parser.parse(source, None).unwrap();
    assert!(format_document(&tree, source, FormatterConfig::default()).is_none());
}

#[test]
fn preserves_leading_include_directives() {
    let source = "#include <mudlib.h>\n#define LIMIT 3\n\nvoid test(){return;}\n";
    let output = format(source);
    assert!(output.starts_with("#include <mudlib.h>\n#define LIMIT 3\n\n"));
    assert!(output.contains("void test()\n{"));
}

#[test]
fn preserves_heredoc_body_and_closing_marker() {
    let source = "string help(){return @TEXT\n第一行\n  second line\nTEXT;}\n";
    let output = format(source);
    assert!(output.contains("return @TEXT\n第一行\n  second line\nTEXT;"));
    let mut parser = Parser::new();
    parser
        .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
        .unwrap();
    assert!(!parser.parse(&output, None).unwrap().root_node().has_error());
    assert_eq!(format(&output), output);
}

#[test]
fn formatting_is_idempotent_for_structured_collections() {
    let source =
        "mapping data = ([ \"name\":\"sword\", \"actions\":({ \"slash\", \"parry\" }) ]);\n";
    let once = format(source);
    assert_eq!(format(&once), once);
}

#[test]
fn keeps_prototypes_adjacent_to_following_definitions() {
    assert_eq!(
        format("string look_gaoshi();\nvoid create(){}"),
        "string look_gaoshi();\nvoid create()\n{\n}"
    );
}

#[test]
fn preserves_crlf_line_endings() {
    assert_eq!(format("void test(){}\r\n"), "void test()\r\n{\r\n}\r\n");
}

#[test]
fn formats_struct_initializers_as_a_structured_new_expression() {
    let output = format("object x = new(Item, name:\"sword\", id:\"changjian\");");
    assert!(output.contains("new(\n"), "{output}");
    assert!(output.contains("    name : \"sword\""), "{output}");
}
