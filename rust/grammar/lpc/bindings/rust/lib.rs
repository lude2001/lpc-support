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
    }
}
