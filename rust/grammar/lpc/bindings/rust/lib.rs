//! Incremental Tree-sitter grammar for the FluffOS LPC dialect.

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_lpc() -> *const ();
}

pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_lpc) };
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");

#[cfg(test)]
mod tests {
    #[test]
    fn loads_generated_language() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("generated LPC language should load");

        let tree = parser
            .parse("int query_value() { return 1; }", None)
            .expect("parser should return a tree");
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );
    }

    #[test]
    fn parses_dynamic_heredoc_literals() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("generated LPC language should load");
        let source = "string help() { return @TEXT\nhello\nTEXT; }";
        let tree = parser
            .parse(source, None)
            .expect("parser should return a tree");
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );

        let call_source = "void help() { write(@HELP\nbody\nHELP ); }";
        let call_tree = parser
            .parse(call_source, None)
            .expect("parser should return a tree");
        assert!(
            !call_tree.root_node().has_error(),
            "{}",
            call_tree.root_node().to_sexp()
        );

        let spaced_source = "void help() { write(@LONG \nbody\nLONG \n); }";
        let spaced_tree = parser
            .parse(spaced_source, None)
            .expect("parser should return a tree");
        assert!(
            !spaced_tree.root_node().has_error(),
            "{}",
            spaced_tree.root_node().to_sexp()
        );

        let concatenated_source = "void help() { write(@LONG\nbody\nLONG NOR); }";
        let concatenated_tree = parser
            .parse(concatenated_source, None)
            .expect("parser should return a tree");
        assert!(
            !concatenated_tree.root_node().has_error(),
            "{}",
            concatenated_tree.root_node().to_sexp()
        );
    }

    #[test]
    fn parses_legacy_multiline_quoted_strings() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("generated LPC language should load");
        let source = "void create() { set(\"long\", \"first line\nsecond line\" HIG \"tail\"); }";
        let tree = parser
            .parse(source, None)
            .expect("parser should return a tree");
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );

        let macro_chain =
            "void show() { write(CYN \"first\" NOR HIG + value + NOR CYN \"last\"); }";
        let macro_tree = parser
            .parse(macro_chain, None)
            .expect("parser should return a tree");
        assert!(
            !macro_tree.root_node().has_error(),
            "{}",
            macro_tree.root_node().to_sexp()
        );
    }

    #[test]
    fn parses_top_level_macro_annotations() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("generated LPC language should load");
        let source = "RequestType(remove_player, \"POST\")\npublic mapping remove_player(string id) { return ([]); }";
        let tree = parser
            .parse(source, None)
            .expect("parser should return a tree");
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );
    }

    #[test]
    fn parses_closure_capture_expressions() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("generated LPC language should load");
        let source = "void run() { values = filter(values, (: $1->id() == $(wanted) :)); }";
        let tree = parser
            .parse(source, None)
            .expect("parser should return a tree");
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );
    }

    #[test]
    fn parses_comma_conditions_and_function_like_macro_strings() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE.into())
            .expect("generated LPC language should load");
        let source = r#"
void run() {
    if (budget *= 60, elapsed < budget * 60) {
        write(HIR "first" "second" ZJURL("cmds:open") "open" NOR);
    }
}
"#;
        let tree = parser
            .parse(source, None)
            .expect("parser should return a tree");
        assert!(
            !tree.root_node().has_error(),
            "{}",
            tree.root_node().to_sexp()
        );
    }
}
