use tree_sitter::{Node, Tree};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FormatterConfig {
    pub indent_size: usize,
}

impl Default for FormatterConfig {
    fn default() -> Self {
        Self { indent_size: 4 }
    }
}

pub fn format_document(tree: &Tree, source: &str, config: FormatterConfig) -> Option<String> {
    if tree.root_node().has_error() {
        return None;
    }
    let printer = Printer { source, config };
    let directive_prefix = directive_prefix(source)?;
    let body = printer.render_source(tree.root_node());
    let mut rendered = if directive_prefix.is_empty() {
        body
    } else if body.is_empty() {
        directive_prefix
    } else {
        format!("{}\n\n{}", directive_prefix.trim_end(), body)
    };
    if source.ends_with('\n') && !rendered.ends_with('\n') {
        rendered.push('\n');
    }
    if source.contains("\r\n") {
        rendered = rendered.replace("\r\n", "\n").replace('\n', "\r\n");
    }
    Some(rendered)
}

pub fn format_node(node: Node<'_>, source: &str, config: FormatterConfig) -> Option<String> {
    if node.has_error() {
        return None;
    }
    Some(Printer { source, config }.render(node, 0))
}

pub fn format_range(
    tree: &Tree,
    source: &str,
    start_byte: usize,
    end_byte: usize,
    config: FormatterConfig,
) -> Option<(std::ops::Range<usize>, String)> {
    if tree.root_node().has_error() || directive_prefix(source).is_none() {
        return None;
    }
    let mut target = tree.root_node();
    loop {
        let mut cursor = target.walk();
        let next = target.named_children(&mut cursor).find(|child| {
            child.start_byte() <= start_byte
                && child.end_byte() >= end_byte
                && child.kind() != "comment"
        });
        match next {
            Some(child) => target = child,
            None => break,
        }
    }
    if target.kind() == "source_file" {
        return format_document(tree, source, config).map(|text| (0..source.len(), text));
    }
    let range = target.byte_range();
    format_node(target, source, config).map(|text| (range, text))
}

fn directive_prefix(source: &str) -> Option<String> {
    let mut prefix = Vec::new();
    let mut saw_code = false;
    let mut continued_macro = false;
    for line in source.lines() {
        let trimmed = line.trim();
        if continued_macro {
            return None;
        }
        if trimmed.starts_with('#') {
            if saw_code || is_conditional_directive(trimmed) {
                return None;
            }
            continued_macro = trimmed.ends_with('\\');
            prefix.push(trimmed.to_owned());
        } else if trimmed.is_empty() && !saw_code {
            if !prefix.is_empty() {
                prefix.push(String::new());
            }
        } else {
            saw_code = true;
        }
    }
    Some(prefix.join("\n").trim_end().to_owned())
}

fn is_conditional_directive(line: &str) -> bool {
    let directive = line.trim_start_matches('#').trim_start();
    ["if", "ifdef", "ifndef", "elif", "else", "endif"]
        .iter()
        .any(|keyword| {
            directive == *keyword
                || directive
                    .strip_prefix(keyword)
                    .is_some_and(|rest| rest.starts_with(char::is_whitespace))
        })
}

struct Printer<'a> {
    source: &'a str,
    config: FormatterConfig,
}

impl Printer<'_> {
    fn render_source(&self, root: Node<'_>) -> String {
        let mut cursor = root.walk();
        let children: Vec<_> = root
            .named_children(&mut cursor)
            .filter(|child| child.kind() != "preprocessor_directive")
            .collect();
        let mut parts = Vec::new();
        for (index, child) in children.iter().enumerate() {
            if index > 0 {
                let previous = children[index - 1];
                let compact = previous.kind() == "comment"
                    || child.kind() == "comment"
                    || is_function_prototype(previous)
                    || is_function_prototype(*child);
                parts.push(if compact { "\n" } else { "\n\n" }.to_owned());
            }
            parts.push(self.render(*child, 0));
        }
        parts.concat().trim().to_owned()
    }

    fn render(&self, node: Node<'_>, depth: usize) -> String {
        match node.kind() {
            "function_declaration" => self.render_function(node, depth),
            "variable_declaration" | "variable_declaration_without_semicolon" => {
                self.render_variable_declaration(node, depth)
            }
            "struct_declaration" | "class_declaration" => self.render_type(node, depth),
            "field_declaration" => format!("{}{}", self.indent(depth), self.inline(node)),
            "block" => self.render_block(node, depth),
            "if_statement" => self.render_if(node, depth),
            "while_statement" => self.render_loop(node, depth, "while"),
            "do_statement" => self.render_do(node, depth),
            "for_statement" => self.render_for(node, depth),
            "foreach_statement" => self.render_foreach(node, depth),
            "switch_statement" => self.render_switch(node, depth),
            "switch_section" => self.render_switch_section(node, depth),
            "return_statement" => self.render_return(node, depth),
            "expression_statement" => self.render_expression_statement(node, depth),
            "break_statement" | "continue_statement" => {
                format!("{}{}", self.indent(depth), self.inline(node))
            }
            "empty_statement" => format!("{};", self.indent(depth)),
            "comment" => self.render_comment(node, depth),
            _ => format!("{}{}", self.indent(depth), self.inline(node)),
        }
    }

    fn render_function(&self, node: Node<'_>, depth: usize) -> String {
        let body = node.child_by_field_name("body");
        let header_end = body.map_or(node.end_byte(), |body| body.start_byte());
        let header = self
            .inline_range(node.start_byte(), header_end)
            .trim_end_matches(';')
            .trim()
            .to_owned();
        match body {
            Some(body) => format!(
                "{}{}\n{}",
                self.indent(depth),
                header,
                self.render_block(body, depth)
            ),
            None => format!("{}{};", self.indent(depth), header),
        }
    }

    fn render_variable_declaration(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        let declarator_nodes = node
            .named_children(&mut cursor)
            .filter(|child| child.kind() == "variable_declarator")
            .collect::<Vec<_>>();
        let Some(first_declarator) = declarator_nodes.first() else {
            return format!("{}{}", self.indent(depth), self.inline(node));
        };
        let prefix = self.inline_range(node.start_byte(), first_declarator.start_byte());
        let declarators = declarator_nodes
            .into_iter()
            .map(|declarator| self.render_declarator(declarator, depth))
            .collect::<Vec<_>>()
            .join(", ");
        let terminator = if node.kind() == "variable_declaration" {
            ";"
        } else {
            ""
        };
        format!(
            "{}{} {}{}",
            self.indent(depth),
            prefix,
            declarators,
            terminator
        )
    }

    fn render_type(&self, node: Node<'_>, depth: usize) -> String {
        let name = node
            .child_by_field_name("name")
            .map(|name| self.text(name))
            .unwrap_or_default();
        let mut cursor = node.walk();
        let fields: Vec<_> = node
            .named_children(&mut cursor)
            .filter(|child| child.kind() == "field_declaration")
            .collect();
        let header = node
            .child_by_field_name("name")
            .map(|name| self.inline_range(node.start_byte(), name.end_byte()))
            .unwrap_or_else(|| format!("{} {name}", node.kind().trim_end_matches("_declaration")));
        let mut lines = vec![
            format!("{}{header}", self.indent(depth)),
            format!("{}{{", self.indent(depth)),
        ];
        lines.extend(
            fields
                .into_iter()
                .map(|field| self.render(field, depth + 1)),
        );
        lines.push(format!("{}}}", self.indent(depth)));
        lines.join("\n")
    }

    fn render_block(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        let children: Vec<_> = node.named_children(&mut cursor).collect();
        if children.is_empty() {
            return format!("{}{{\n{}}}", self.indent(depth), self.indent(depth));
        }
        let mut lines = vec![format!("{}{{", self.indent(depth))];
        let mut previous_kind = "";
        for child in children {
            if needs_block_separator(previous_kind, child.kind()) {
                lines.push(String::new());
            }
            lines.push(self.render(child, depth + 1));
            previous_kind = child.kind();
        }
        lines.push(format!("{}}}", self.indent(depth)));
        lines.join("\n")
    }

    fn render_if(&self, node: Node<'_>, depth: usize) -> String {
        let condition = node.child_by_field_name("condition");
        let consequence = node.child_by_field_name("consequence");
        let alternative = node.child_by_field_name("alternative");
        let mut parts = vec![format!(
            "{}if ({})",
            self.indent(depth),
            condition
                .map(|value| self.expression(value, depth))
                .unwrap_or_default()
        )];
        if let Some(consequence) = consequence {
            parts.push(self.render_attached(consequence, depth));
        }
        if let Some(alternative) = alternative {
            let comments = self.comments_between(
                consequence.map_or(node.start_byte(), |value| value.end_byte()),
                alternative.start_byte(),
                node,
            );
            if alternative.kind() == "if_statement" {
                let nested = self.render_if(alternative, depth);
                let mut else_line = format!("{}else", self.indent(depth));
                if let Some(comment) = comments.first() {
                    else_line.push(' ');
                    else_line.push_str(self.text(*comment).trim());
                    parts.push(else_line);
                    parts.push(nested);
                } else {
                    parts.push(format!("{else_line} {}", nested.trim_start()));
                }
                parts.extend(
                    comments
                        .into_iter()
                        .skip(1)
                        .map(|comment| self.render_comment(comment, depth)),
                );
            } else {
                let mut else_line = format!("{}else", self.indent(depth));
                if let Some(comment) = comments.first() {
                    else_line.push(' ');
                    else_line.push_str(self.text(*comment).trim());
                }
                parts.push(else_line);
                parts.extend(
                    comments
                        .into_iter()
                        .skip(1)
                        .map(|comment| self.render_comment(comment, depth)),
                );
                parts.push(self.render_attached(alternative, depth));
            }
        }
        parts.join("\n")
    }

    fn render_loop(&self, node: Node<'_>, depth: usize, keyword: &str) -> String {
        let mut cursor = node.walk();
        let children: Vec<_> = node.named_children(&mut cursor).collect();
        let body = children.last().copied();
        let condition = children.first().copied();
        format!(
            "{}{} ({})\n{}",
            self.indent(depth),
            keyword,
            condition
                .map(|value| self.expression(value, depth))
                .unwrap_or_default(),
            body.map(|value| self.render_attached(value, depth))
                .unwrap_or_default()
        )
    }

    fn render_do(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        let children: Vec<_> = node.named_children(&mut cursor).collect();
        let body = children.first().copied();
        let condition = children.get(1).copied();
        format!(
            "{}do\n{}\n{}while ({});",
            self.indent(depth),
            body.map(|value| self.render_attached(value, depth))
                .unwrap_or_default(),
            self.indent(depth),
            condition
                .map(|value| self.expression(value, depth))
                .unwrap_or_default()
        )
    }

    fn render_for(&self, node: Node<'_>, depth: usize) -> String {
        let text = self.text(node);
        let open = text.find('(').unwrap_or(0);
        let close = find_matching(text, open, '(', ')').unwrap_or(open);
        let header = normalize_inline_text(&text[open + 1..close]);
        let mut cursor = node.walk();
        let body = node.named_children(&mut cursor).last();
        format!(
            "{}for ({})\n{}",
            self.indent(depth),
            header,
            body.map(|value| self.render_attached(value, depth))
                .unwrap_or_default()
        )
    }

    fn render_foreach(&self, node: Node<'_>, depth: usize) -> String {
        let text = self.text(node);
        let open = text.find('(').unwrap_or(0);
        let close = find_matching(text, open, '(', ')').unwrap_or(open);
        let header = normalize_inline_text(&text[open + 1..close]);
        let mut cursor = node.walk();
        let body = node.named_children(&mut cursor).last();
        format!(
            "{}foreach ({})\n{}",
            self.indent(depth),
            header,
            body.map(|value| self.render_attached(value, depth))
                .unwrap_or_default()
        )
    }

    fn render_switch(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        let children: Vec<_> = node.named_children(&mut cursor).collect();
        let expression = children.first().copied();
        let sections = children.into_iter().skip(1);
        let mut lines = vec![
            format!(
                "{}switch ({})",
                self.indent(depth),
                expression
                    .map(|value| self.expression(value, depth))
                    .unwrap_or_default()
            ),
            format!("{}{{", self.indent(depth)),
        ];
        lines.extend(sections.map(|section| self.render(section, depth + 1)));
        lines.push(format!("{}}}", self.indent(depth)));
        lines.join("\n")
    }

    fn render_switch_section(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        let children: Vec<_> = node.named_children(&mut cursor).collect();
        let mut lines = Vec::new();
        if let Some(label) = children.first() {
            lines.push(format!("{}{}", self.indent(depth), self.inline(*label)));
        }
        lines.extend(
            children
                .into_iter()
                .skip(1)
                .map(|statement| self.render(statement, depth + 1)),
        );
        lines.join("\n")
    }

    fn render_attached(&self, node: Node<'_>, depth: usize) -> String {
        if node.kind() == "block" {
            self.render_block(node, depth)
        } else {
            self.render(node, depth + 1)
        }
    }

    fn render_return(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        match node.named_children(&mut cursor).next() {
            Some(expression) => format!(
                "{}return {};",
                self.indent(depth),
                self.expression(expression, depth)
            ),
            None => format!("{}return;", self.indent(depth)),
        }
    }

    fn render_expression_statement(&self, node: Node<'_>, depth: usize) -> String {
        let mut cursor = node.walk();
        match node.named_children(&mut cursor).next() {
            Some(expression) => format!(
                "{}{};",
                self.indent(depth),
                self.expression(expression, depth)
            ),
            None => format!("{};", self.indent(depth)),
        }
    }

    fn render_comment(&self, node: Node<'_>, depth: usize) -> String {
        self.text(node)
            .lines()
            .map(|line| format!("{}{}", self.indent(depth), line.trim()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn inline(&self, node: Node<'_>) -> String {
        match node.kind() {
            "array_literal" => self.render_collection(node, "({", "})"),
            "mapping_literal" => self.render_collection(node, "([", "])"),
            "anonymous_function" => {
                let parameters = node
                    .child_by_field_name("parameters")
                    .map(|value| self.inline(value))
                    .unwrap_or_else(|| "()".to_owned());
                let body = node.child_by_field_name("body");
                body.map_or_else(
                    || normalize_inline_text(self.text(node)),
                    |body| format!("function{parameters}\n{}", self.render_block(body, 0)),
                )
            }
            _ => self.inline_range(node.start_byte(), node.end_byte()),
        }
    }

    fn render_declarator(&self, node: Node<'_>, depth: usize) -> String {
        let Some(name) = node.child_by_field_name("name") else {
            return self.inline(node);
        };
        let declaration_name = self.inline_range(node.start_byte(), name.end_byte());
        match node.child_by_field_name("value") {
            Some(value) => format!("{} = {}", declaration_name, self.expression(value, depth)),
            None => declaration_name,
        }
    }

    fn expression(&self, node: Node<'_>, depth: usize) -> String {
        match node.kind() {
            "heredoc_literal" | "template_string" => self.text(node).to_owned(),
            "array_literal" => self.render_collection_at(node, "({", "})", depth),
            "mapping_literal" => self.render_collection_at(node, "([", "])", depth),
            "new_expression" => self.render_collection_at(node, "new(", ")", depth),
            "mapping_pair" => {
                let key = node.child_by_field_name("key");
                let value = node.child_by_field_name("value");
                format!(
                    "{} : {}",
                    key.map(|item| self.expression(item, depth))
                        .unwrap_or_default(),
                    value
                        .map(|item| self.expression(item, depth))
                        .unwrap_or_default()
                )
            }
            "struct_initializer" => {
                let name = node.child_by_field_name("name");
                let value = node.child_by_field_name("value");
                format!(
                    "{} : {}",
                    name.map(|item| self.expression(item, depth))
                        .unwrap_or_default(),
                    value
                        .map(|item| self.expression(item, depth))
                        .unwrap_or_default()
                )
            }
            "assignment_expression" | "binary_expression" => {
                let left = node.child_by_field_name("left");
                let right = node.child_by_field_name("right");
                let operator = node.child_by_field_name("operator");
                match (left, operator, right) {
                    (Some(left), Some(operator), Some(right)) => format!(
                        "{} {} {}",
                        self.expression(left, depth),
                        self.text(operator),
                        self.expression(right, depth)
                    ),
                    _ => self.inline(node),
                }
            }
            "conditional_expression" => {
                let mut cursor = node.walk();
                let values: Vec<_> = node.named_children(&mut cursor).collect();
                if values.len() == 3 {
                    format!(
                        "{} ? {} : {}",
                        self.expression(values[0], depth),
                        self.expression(values[1], depth),
                        self.expression(values[2], depth)
                    )
                } else {
                    self.inline(node)
                }
            }
            "parenthesized_expression" => node
                .named_child(0)
                .map(|value| format!("({})", self.expression(value, depth)))
                .unwrap_or_else(|| "()".to_owned()),
            "argument_list" | "expression_list" => {
                let mut cursor = node.walk();
                node.named_children(&mut cursor)
                    .map(|child| self.expression(child, depth))
                    .collect::<Vec<_>>()
                    .join(", ")
            }
            "closure_expression" => {
                let raw = self.text(node);
                let first = raw.find(':').map_or(0, |offset| offset + 1);
                let last = raw.rfind(':').unwrap_or(raw.len());
                let body = self.inline_range(node.start_byte() + first, node.start_byte() + last);
                format!("(: {body} :)")
            }
            _ => self.inline(node),
        }
    }

    fn render_collection(&self, node: Node<'_>, opener: &str, closer: &str) -> String {
        self.render_collection_at(node, opener, closer, 0)
    }

    fn render_collection_at(
        &self,
        node: Node<'_>,
        opener: &str,
        closer: &str,
        depth: usize,
    ) -> String {
        let mut cursor = node.walk();
        let direct: Vec<_> = node.named_children(&mut cursor).collect();
        let expression_lists: Vec<_> = direct
            .iter()
            .copied()
            .filter(|child| child.kind() == "expression_list")
            .collect();
        let children: Vec<_> = if expression_lists.len() == 1
            && direct
                .iter()
                .all(|child| matches!(child.kind(), "expression_list" | "comment"))
        {
            let expression_list = expression_lists[0];
            let mut list_cursor = expression_list.walk();
            expression_list.named_children(&mut list_cursor).collect()
        } else {
            direct
        };
        if children.is_empty() {
            return format!("{opener}{closer}");
        }
        let mut lines = Vec::new();
        for (index, child) in children.iter().enumerate() {
            if child.kind() == "comment" {
                lines.push(self.render_comment(*child, depth + 1));
                continue;
            }
            let has_following_expression = children[index + 1..]
                .iter()
                .any(|following| following.kind() != "comment");
            lines.push(format!(
                "{}{}{}",
                self.indent(depth + 1),
                self.expression(*child, depth + 1),
                if has_following_expression { "," } else { "" }
            ));
        }
        let lines = lines.join("\n");
        format!("{opener}\n{lines}\n{}{closer}", self.indent(depth))
    }

    fn comments_between<'tree>(
        &self,
        start_byte: usize,
        end_byte: usize,
        parent: Node<'tree>,
    ) -> Vec<Node<'tree>> {
        let mut cursor = parent.walk();
        parent
            .named_children(&mut cursor)
            .filter(|child| {
                child.kind() == "comment"
                    && child.start_byte() >= start_byte
                    && child.end_byte() <= end_byte
            })
            .collect()
    }

    fn inline_range(&self, start: usize, end: usize) -> String {
        normalize_inline_text(self.source.get(start..end).unwrap_or_default())
    }

    fn text(&self, node: Node<'_>) -> &'_ str {
        node.utf8_text(self.source.as_bytes()).unwrap_or_default()
    }

    fn indent(&self, depth: usize) -> String {
        " ".repeat(depth * self.config.indent_size)
    }
}

fn is_function_prototype(node: Node<'_>) -> bool {
    node.kind() == "function_declaration" && node.child_by_field_name("body").is_none()
}

fn needs_block_separator(previous: &str, current: &str) -> bool {
    if previous.is_empty() {
        return false;
    }
    let declaration = |kind: &str| matches!(kind, "variable_declaration" | "function_declaration");
    let control = |kind: &str| kind.ends_with("_statement") && kind != "expression_statement";
    (declaration(previous) && !declaration(current)) || control(previous) || control(current)
}

fn normalize_inline_text(source: &str) -> String {
    let tokens = lex_inline(source);
    let mut output = String::new();
    let mut previous = "";
    for token in &tokens {
        let space = needs_space(previous, token);
        if space && !output.ends_with(char::is_whitespace) {
            output.push(' ');
        }
        output.push_str(token);
        previous = token;
    }
    output.trim().to_owned()
}

fn lex_inline(source: &str) -> Vec<&str> {
    let mut tokens = Vec::new();
    let mut start = 0_usize;
    let bytes = source.as_bytes();
    while start < bytes.len() {
        if bytes[start].is_ascii_whitespace() {
            start += 1;
            continue;
        }
        let end = if bytes[start].is_ascii_digit() {
            number_end(bytes, start)
        } else if bytes[start] == b'`' {
            template_end(bytes, start, 0)
        } else if matches!(bytes[start], b'"' | b'\'') {
            quoted_end(bytes, start)
        } else if bytes[start].is_ascii_alphanumeric()
            || bytes[start] == b'_'
            || bytes[start] >= 0x80
        {
            let mut end = start + 1;
            while end < bytes.len()
                && (bytes[end].is_ascii_alphanumeric() || bytes[end] == b'_' || bytes[end] >= 0x80)
            {
                end += 1;
            }
            end
        } else {
            multi_operator_end(bytes, start)
        };
        tokens.push(&source[start..end]);
        start = end;
    }
    tokens
}

fn number_end(bytes: &[u8], start: usize) -> usize {
    let mut end = start;
    if bytes.get(start) == Some(&b'0')
        && matches!(bytes.get(start + 1), Some(b'x' | b'X' | b'b' | b'B'))
    {
        end += 2;
        while end < bytes.len() && (bytes[end].is_ascii_hexdigit() || bytes[end] == b'_') {
            end += 1;
        }
        return end;
    }
    while end < bytes.len() && (bytes[end].is_ascii_digit() || bytes[end] == b'_') {
        end += 1;
    }
    if bytes.get(end) == Some(&b'.') && bytes.get(end + 1) != Some(&b'.') {
        end += 1;
        while end < bytes.len() && (bytes[end].is_ascii_digit() || bytes[end] == b'_') {
            end += 1;
        }
    }
    if matches!(bytes.get(end), Some(b'e' | b'E')) {
        let mut exponent = end + 1;
        if matches!(bytes.get(exponent), Some(b'+' | b'-')) {
            exponent += 1;
        }
        let digits = exponent;
        while exponent < bytes.len()
            && (bytes[exponent].is_ascii_digit() || bytes[exponent] == b'_')
        {
            exponent += 1;
        }
        if exponent > digits {
            end = exponent;
        }
    }
    end
}

fn quoted_end(bytes: &[u8], start: usize) -> usize {
    let quote = bytes[start];
    let mut index = start + 1;
    while index < bytes.len() {
        if bytes[index] == b'\\' {
            index = (index + 2).min(bytes.len());
        } else if bytes[index] == quote {
            return index + 1;
        } else {
            index += 1;
        }
    }
    bytes.len()
}

fn template_end(bytes: &[u8], start: usize, depth: usize) -> usize {
    if depth >= 128 {
        return bytes.len();
    }
    let mut index = start + 1;
    let mut braces = 0;
    while index < bytes.len() {
        if bytes[index] == b'\\' {
            index = (index + 2).min(bytes.len());
            continue;
        }
        if braces == 0 {
            if bytes[index] == b'`' {
                return index + 1;
            }
            if bytes[index..].starts_with(b"${") {
                braces = 1;
                index += 2;
                continue;
            }
        } else if bytes[index] == b'`' {
            index = template_end(bytes, index, depth + 1);
            continue;
        } else if matches!(bytes[index], b'"' | b'\'') {
            index = quoted_end(bytes, index);
            continue;
        } else if bytes[index..].starts_with(b"//") {
            while index < bytes.len() && bytes[index] != b'\n' {
                index += 1;
            }
            continue;
        } else if bytes[index..].starts_with(b"/*") {
            index += 2;
            while index + 1 < bytes.len() && !bytes[index..].starts_with(b"*/") {
                index += 1;
            }
            index = (index + 2).min(bytes.len());
            continue;
        } else if bytes[index] == b'{' {
            braces += 1;
        } else if bytes[index] == b'}' {
            braces -= 1;
        }
        index += 1;
    }
    bytes.len()
}

fn multi_operator_end(bytes: &[u8], start: usize) -> usize {
    const OPERATORS: &[&str] = &[
        "<<=", ">>=", "??=", "||=", "&&=", "...", "?.", ".?", "->", "::", "(:", ":)", "++", "--",
        "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "==", "!=", ">=", "<=", "&&", "||", "??",
        "<<", ">>", "..",
    ];
    let remaining = std::str::from_utf8(&bytes[start..]).unwrap_or_default();
    OPERATORS
        .iter()
        .find(|operator| remaining.starts_with(**operator))
        .map_or(start + 1, |operator| start + operator.len())
}

fn needs_space(previous: &str, current: &str) -> bool {
    if previous.is_empty() || matches!(current, ")" | "]" | ";" | "," | ":)" | "++" | "--") {
        return false;
    }
    if matches!(
        previous,
        "(" | "[" | "(:" | "$" | "->" | "." | "::" | "?." | ".?"
    ) || matches!(current, "(" | "[" | "->" | "." | "::" | "?." | ".?" | "...")
    {
        return false;
    }
    if current == "*" && is_type_word(previous) {
        return true;
    }
    if matches!(
        current,
        ":" | "="
            | "+="
            | "-="
            | "*="
            | "/="
            | "%="
            | "=="
            | "!="
            | ">="
            | "<="
            | ">"
            | "<"
            | "+"
            | "-"
            | "*"
            | "/"
            | "%"
            | "&&"
            | "||"
            | "??"
            | "?"
            | "|"
    ) || matches!(
        previous,
        ":" | "="
            | "+="
            | "-="
            | "*="
            | "/="
            | "%="
            | "=="
            | "!="
            | ">="
            | "<="
            | ">"
            | "<"
            | "+"
            | "-"
            | "*"
            | "/"
            | "%"
            | "&&"
            | "||"
            | "??"
            | "?"
            | "|"
    ) {
        return true;
    }
    true
}

fn is_type_word(value: &str) -> bool {
    matches!(
        value,
        "int"
            | "float"
            | "string"
            | "object"
            | "mixed"
            | "mapping"
            | "function"
            | "buffer"
            | "void"
            | "array"
            | "closure"
    )
}

fn find_matching(source: &str, start: usize, open: char, close: char) -> Option<usize> {
    let mut depth = 0_u32;
    for (offset, character) in source[start..].char_indices() {
        if character == open {
            depth += 1;
        } else if character == close {
            depth -= 1;
            if depth == 0 {
                return Some(start + offset);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
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
        format_document(&tree, source, FormatterConfig::default())
            .unwrap_or_else(|| panic!("formatter rejected {}", tree.root_node().to_sexp()))
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
        let output =
            format("private async void drain(){await async_yield();return await next()+1;}");
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
        let output = format(
            "mapping data = ([ \"name\":\"sword\", \"actions\":({ \"slash\", \"parry\" }) ]);",
        );
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
        let output = format(
            "void test(){if(x){foo();}else // alternate condition\nif(y){bar();}else{baz();}}",
        );
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
}
