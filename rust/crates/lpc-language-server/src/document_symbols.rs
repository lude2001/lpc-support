use serde::Serialize;
use tree_sitter::{Node, Point, Tree};

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct Position {
    line: u32,
    character: u32,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct Range {
    start: Position,
    end: Position,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSymbol {
    name: String,
    kind: u32,
    range: Range,
    selection_range: Range,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<DocumentSymbol>>,
}

pub fn collect(tree: &Tree, source: &str) -> Vec<DocumentSymbol> {
    let root = tree.root_node();
    let mut cursor = root.walk();
    root.named_children(&mut cursor)
        .flat_map(|node| symbols_for_top_level(node, source))
        .collect()
}

fn symbols_for_top_level(node: Node<'_>, source: &str) -> Vec<DocumentSymbol> {
    match node.kind() {
        "function_declaration" => symbol_from_name_field(node, source, 12)
            .into_iter()
            .collect(),
        "variable_declaration" => variable_symbols(node, source, 13),
        "struct_declaration" => type_symbol(node, source, 23),
        "class_declaration" => type_symbol(node, source, 5),
        _ => Vec::new(),
    }
}

fn variable_symbols(declaration: Node<'_>, source: &str, kind: u32) -> Vec<DocumentSymbol> {
    let mut cursor = declaration.walk();
    declaration
        .named_children(&mut cursor)
        .filter(|child| child.kind() == "variable_declarator")
        .filter_map(|declarator| {
            let name = declarator.child_by_field_name("name")?;
            Some(create_symbol(name, declaration, source, kind, None))
        })
        .collect()
}

fn type_symbol(node: Node<'_>, source: &str, kind: u32) -> Vec<DocumentSymbol> {
    let Some(name) = node.child_by_field_name("name") else {
        return Vec::new();
    };
    let mut cursor = node.walk();
    let children: Vec<_> = node
        .named_children(&mut cursor)
        .filter(|child| child.kind() == "field_declaration")
        .filter_map(|field| {
            let mut field_cursor = field.walk();
            let field_name = field
                .named_children(&mut field_cursor)
                .find(|child| child.kind() == "identifier")?;
            Some(create_symbol(field_name, field, source, 8, None))
        })
        .collect();
    vec![create_symbol(name, node, source, kind, Some(children))]
}

fn symbol_from_name_field(node: Node<'_>, source: &str, kind: u32) -> Option<DocumentSymbol> {
    let name = node.child_by_field_name("name")?;
    Some(create_symbol(name, node, source, kind, None))
}

fn create_symbol(
    name_node: Node<'_>,
    range_node: Node<'_>,
    source: &str,
    kind: u32,
    children: Option<Vec<DocumentSymbol>>,
) -> DocumentSymbol {
    DocumentSymbol {
        name: name_node
            .utf8_text(source.as_bytes())
            .unwrap_or("<invalid identifier>")
            .to_owned(),
        kind,
        range: node_range(range_node, source),
        selection_range: node_range(name_node, source),
        children: children.filter(|items| !items.is_empty()),
    }
}

fn node_range(node: Node<'_>, source: &str) -> Range {
    Range {
        start: lsp_position(source, node.start_position()),
        end: lsp_position(source, node.end_position()),
    }
}

fn lsp_position(source: &str, point: Point) -> Position {
    let line_start = if point.row == 0 {
        0
    } else {
        source
            .match_indices('\n')
            .nth(point.row - 1)
            .map_or(0, |(offset, _)| offset + 1)
    };
    let byte_end = (line_start + point.column).min(source.len());
    Position {
        line: point.row as u32,
        character: source[line_start..byte_end].encode_utf16().count() as u32,
    }
}

#[cfg(test)]
mod tests {
    use tree_sitter::Parser;

    use super::*;

    #[test]
    fn collects_top_level_declarations_and_nested_fields() {
        let source = concat!(
            "private int counter = 1;\n",
            "class Payload { string title; int count; }\n",
            "int query_value(int amount) { return amount; }\n",
        );
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();

        let symbols = collect(&tree, source);

        assert_eq!(
            symbols
                .iter()
                .map(|symbol| symbol.name.as_str())
                .collect::<Vec<_>>(),
            ["counter", "Payload", "query_value"]
        );
        assert_eq!(
            symbols[1]
                .children
                .as_ref()
                .unwrap()
                .iter()
                .map(|symbol| symbol.name.as_str())
                .collect::<Vec<_>>(),
            ["title", "count"]
        );
    }

    #[test]
    fn converts_selection_ranges_to_utf16() {
        let source = "string label = \"😀\"; int count = 1;";
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_lpc_support::LANGUAGE.into())
            .unwrap();
        let tree = parser.parse(source, None).unwrap();

        let symbols = collect(&tree, source);

        assert_eq!(symbols[1].selection_range.start.character, 25);
    }
}
