use super::*;

fn active_tree(source: &str) -> Tree {
    parser()
        .unwrap()
        .parse(
            lpc_preprocessor::Preprocessor::default()
                .process(source)
                .text,
            None,
        )
        .unwrap()
}

fn checked(source: &str, config: FormatterConfig, context: &FormatContext) -> String {
    format_document_checked(&active_tree(source), source, config, context)
        .unwrap_or_else(|error| panic!("{error}: {source}"))
}

#[test]
fn rejects_corruption_at_the_production_output_gate() {
    let original =
        "#include <one.h>\ninherit BASE;\nint demo()\n{\n    return 1; // keep this\n}\n";
    let context = FormatContext::default();
    let mut parser = parser().unwrap();
    let before = SourceSyntax::parse(&mut parser, original, &context).unwrap();
    for output in [
        original.replace("return 1", "return 2"),
        original.replace("keep this", "changed"),
        original.replace(
            "#include <one.h>\ninherit BASE;",
            "inherit BASE;\n#include <one.h>",
        ),
    ] {
        assert_eq!(
            validate_output(
                &mut parser,
                &before,
                original,
                &output,
                FormatterConfig::default(),
                &context
            ),
            Err(FormatError::UnsafeOutput)
        );
    }
    let unformatted = "int demo(){return 1;}";
    let before = SourceSyntax::parse(&mut parser, unformatted, &context).unwrap();
    assert_eq!(
        validate_output(
            &mut parser,
            &before,
            unformatted,
            unformatted,
            FormatterConfig::default(),
            &context
        ),
        Err(FormatError::UnstableOutput)
    );
}

#[test]
fn freezes_stringification_pasting_redefinition_and_imported_macro_calls() {
    let source = "#define str(x) #x\n#define CAT(a,b) a ## b\nstring demo(){return str(1+2)+CAT(fo,o);}\n#undef str\n#define str(x) (x)\nint other(){return str(3+4);}\n";
    let output = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    for raw in ["str(1+2)", "CAT(fo,o)", "str(3+4)"] {
        assert!(output.contains(raw), "{output}");
    }
    let source = "string demo(){return from_header(1+2)+ordinary(3+4);}";
    let context = FormatContext {
        macro_names: vec!["from_header".into()],
    };
    let output = checked(source, FormatterConfig::default(), &context);
    assert!(
        output.contains("from_header(1+2) + ordinary(3 + 4)"),
        "{output}"
    );
}

#[test]
fn production_gate_checks_macro_argument_spelling_even_when_the_cst_is_the_same() {
    let source = "#define STR(x) #x\nstring demo(){return STR(1+2);}";
    let context = FormatContext::default();
    let mut parser = parser().unwrap();
    let before = SourceSyntax::parse(&mut parser, source, &context).unwrap();
    let altered = source.replace("STR(1+2)", "STR(1 + 2)");
    assert_eq!(
        validate_output(
            &mut parser,
            &before,
            source,
            &altered,
            FormatterConfig::default(),
            &context
        ),
        Err(FormatError::UnsafeOutput)
    );
}

#[test]
fn formats_both_conditional_branches_and_keeps_directive_order() {
    let source = "#include <one.h>\ninherit BASE;\n#include <two.h>\nint demo(){\n#if FLAG\nreturn one(1,2);\n#else\nreturn two(3,4);\n#endif\n}\n";
    let output = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(output.find("<one.h>").unwrap() < output.find("inherit BASE").unwrap());
    assert!(output.find("inherit BASE").unwrap() < output.find("<two.h>").unwrap());
    assert!(
        output.contains("#if FLAG\n    return one(1, 2);\n#else\n    return two(3, 4);\n#endif"),
        "{output}"
    );
    let split = "int demo(){return\n#if FLAG\n1+\n#else\n2+\n#endif\n3;}";
    let output = checked(split, FormatterConfig::default(), &FormatContext::default());
    assert!(output.contains("#if FLAG") && output.contains("#else") && output.contains("#endif"));
}

#[test]
fn keeps_multiline_directives_and_the_blank_line_that_ends_a_continuation() {
    for directive in [
        "#define BODY(x) \\\n ((x)+1)\n",
        "#define BODY(x) \\\n\n",
        "#define BODY(x) /* 中文\ncomment */ ((x)+1)\n",
    ] {
        let source = format!("{directive}int demo(){{return 1;}}\n");
        let output = checked(
            &source,
            FormatterConfig::default(),
            &FormatContext::default(),
        );
        assert!(output.starts_with(directive), "{output:?}");
        assert!(output.contains("int demo()\n{\n    return 1;\n}"));
    }
}

#[test]
fn keeps_literal_and_comment_bytes_with_mixed_line_endings() {
    let literal = "@END\nbare LF\n  raw\nEND";
    let comment = "/* columns\n  +---+\n  | x |\n  +---+ */";
    let source = format!("string demo(){{\r\n{comment}\r\nreturn {literal};\r\n}}\r\n");
    let output = checked(
        &source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(output.contains(literal));
    assert!(output.contains(comment));
    assert!(output.ends_with("\r\n"));
    let source = "string demo(){return `text\n#if 0\n${1+2}`;}";
    let output = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(output.contains("`text\n#if 0\n${1+2}`"));
}

#[test]
fn formats_a_complete_selected_statement_at_its_original_nesting_depth() {
    let source = "void demo(){\nint value=1;\nuntouched(2,3);\n}\n";
    let start = source.find("int value").unwrap();
    let end = source.find(";\n").unwrap() + 1;
    let (range, output) = format_range_checked(
        &active_tree(source),
        source,
        start,
        end,
        FormatterConfig::default(),
        &FormatContext::default(),
    )
    .unwrap();
    assert_eq!(output, "    int value = 1;");
    let replaced = format!(
        "{}{}{}",
        &source[..range.start],
        output,
        &source[range.end..]
    );
    assert!(replaced.contains("untouched(2,3);"));
    let (_, twice) = format_range_checked(
        &active_tree(&replaced),
        &replaced,
        range.start,
        range.start + output.len(),
        FormatterConfig::default(),
        &FormatContext::default(),
    )
    .unwrap();
    assert_eq!(twice, output);
}

#[test]
fn wraps_call_and_parameter_lists_with_configurable_braces_and_tabs() {
    let source = "void demo(string first_parameter,string second_parameter){target(first_parameter,second_parameter);}";
    let config = FormatterConfig {
        print_width: 40,
        indent_size: 2,
        ..Default::default()
    };
    let output = checked(source, config, &FormatContext::default());
    assert!(
        output.contains("demo(\n  string first_parameter,\n  string second_parameter\n)\n{"),
        "{output}"
    );
    assert!(
        output.contains("target(\n    first_parameter,\n    second_parameter\n  );"),
        "{output}"
    );
    let config = FormatterConfig {
        brace_style: BraceStyle::SameLine,
        use_tabs: true,
        ..Default::default()
    };
    let output = checked(
        "void demo(){if(1){target();}else{other();}}",
        config,
        &FormatContext::default(),
    );
    assert!(output.starts_with("void demo() {\n"), "{output}");
    assert!(
        output.contains("\tif (1) {\n\t\ttarget();\n\t} else {"),
        "{output}"
    );
}

#[test]
fn preserves_trailing_commas_blank_separators_and_a_utf8_bom() {
    let source = "\u{feff}mixed *items=({1,2,});\n\n\nvoid demo(){}\n";
    let output = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(output.starts_with('\u{feff}'));
    assert!(output.contains("2,\n"));
    assert!(output.contains(";\n\n\nvoid demo"), "{output}");
}

#[test]
fn bounds_configuration_and_rejects_invalid_ranges_or_non_whitespace_edits() {
    let source = "int value;";
    let tree = active_tree(source);
    assert_eq!(
        format_range_checked(
            &tree,
            source,
            3,
            2,
            FormatterConfig::default(),
            &FormatContext::default()
        ),
        Err(FormatError::InvalidRange)
    );
    assert_eq!(
        apply_edits(
            source,
            &[WhitespaceEdit {
                range: 0..3,
                text: "".into()
            }]
        ),
        Err(FormatError::UnsafeOutput)
    );
    assert_eq!(
        apply_edits(
            source,
            &[WhitespaceEdit {
                range: 3..4,
                text: ";".into()
            }]
        ),
        Err(FormatError::UnsafeOutput)
    );
    assert!(
        format_document(
            &tree,
            source,
            FormatterConfig {
                indent_size: usize::MAX,
                print_width: usize::MAX,
                ..Default::default()
            }
        )
        .is_some()
    );
}

#[test]
fn wraps_nested_collections_and_calls_in_one_pass() {
    for source in [
        "void demo(){consume(({1,2}),other);}",
        "void demo(){consume((: $1, $2 :), ({1,2}),other);}",
        "void demo(){consume(inside(({1,2})),other);}",
        "void demo(){consume(( [ 1 : 2 ] ));}",
    ] {
        checked(
            source,
            FormatterConfig::default(),
            &FormatContext::default(),
        );
    }
}

#[test]
fn preserves_lexical_separators_between_context_sensitive_operators() {
    let source = "mapping value=([\"key\": ::parent()]);\nint demo(int x){return x + +x - -x;}";
    let output = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(output.contains(": ::parent()"), "{output}");
    assert!(output.contains("x + +x - -x"), "{output}");
    let closure = checked(
        "mixed demo(){return (: ::parent() :);}",
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(closure.contains("(: ::parent()"), "{closure}");
}

#[test]
fn keeps_each_existing_newline_in_mixed_eol_files() {
    let source = "// first\nint a=1;\r\n// second\r\nint b=2;\n";
    let output = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(output.contains("// first\n"));
    assert!(output.contains("// second\r\n"));
    assert!(output.ends_with("int b = 2;\n"));
}

#[test]
fn applies_brace_style_to_control_macros_and_do_while() {
    let source =
        "void demo(){CONTROL( raw +  args ){first();}else{second();} do{third();}while(test());}";
    let allman = checked(
        source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    assert!(allman.contains("}\n    else\n    {"), "{allman}");
    let kr = checked(
        source,
        FormatterConfig {
            brace_style: BraceStyle::SameLine,
            ..Default::default()
        },
        &FormatContext::default(),
    );
    assert!(kr.contains("} else {"), "{kr}");
    assert!(kr.contains("} while (test());"), "{kr}");
}

#[test]
fn nested_wrapping_is_bounded_and_does_not_revisit_subtrees_exponentially() {
    let source = format!(
        "void demo(){{return {}({{1,2}}){};}}",
        "call(".repeat(12),
        ")".repeat(12)
    );
    checked(
        &source,
        FormatterConfig::default(),
        &FormatContext::default(),
    );
    let too_deep = format!(
        "void demo(){{return {}1{};}}",
        "call(".repeat(150),
        ")".repeat(150)
    );
    assert_eq!(
        format_document_checked(
            &active_tree(&too_deep),
            &too_deep,
            FormatterConfig::default(),
            &FormatContext::default()
        ),
        Err(FormatError::ResourceLimit)
    );
}
