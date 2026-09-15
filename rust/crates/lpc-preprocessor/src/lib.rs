use std::collections::{HashMap, HashSet};

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceRange {
    pub start_byte: usize,
    pub end_byte: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IncludeFact {
    pub path: String,
    pub system: bool,
    pub range: SourceRange,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InactiveRegion {
    pub range: SourceRange,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PreprocessedDocument {
    /// Inactive text and directives are replaced with ASCII spaces. Newlines and
    /// every original byte offset are preserved, so parser ranges map directly
    /// back to the editor document without heuristic line repair.
    pub text: String,
    pub includes: Vec<IncludeFact>,
    pub inactive_regions: Vec<InactiveRegion>,
}

#[derive(Debug, Clone)]
struct ConditionalFrame {
    parent_active: bool,
    branch_taken: bool,
    active: bool,
}

#[derive(Debug, Clone, Default)]
pub struct Preprocessor {
    predefined: HashMap<String, String>,
}

impl Preprocessor {
    pub fn with_predefined(predefined: impl IntoIterator<Item = (String, String)>) -> Self {
        Self {
            predefined: predefined.into_iter().collect(),
        }
    }

    pub fn process(&self, source: &str) -> PreprocessedDocument {
        let mut output = source.as_bytes().to_vec();
        let mut definitions = self.predefined.clone();
        let mut frames: Vec<ConditionalFrame> = Vec::new();
        let mut includes = Vec::new();
        let mut inactive_regions = Vec::new();
        let mut offset = 0_usize;

        for line_with_ending in source.split_inclusive('\n') {
            let line = line_with_ending
                .strip_suffix('\n')
                .unwrap_or(line_with_ending)
                .strip_suffix('\r')
                .unwrap_or_else(|| {
                    line_with_ending
                        .strip_suffix('\n')
                        .unwrap_or(line_with_ending)
                });
            let trimmed = line.trim_start();
            let current_active = frames.last().is_none_or(|frame| frame.active);
            let mut directive = false;

            if let Some(body) = trimmed.strip_prefix('#') {
                directive = true;
                let body = body.trim_start();
                let (name, arguments) = split_directive(body);
                match name {
                    "if" => {
                        let condition = evaluate_condition(arguments, &definitions);
                        frames.push(ConditionalFrame {
                            parent_active: current_active,
                            branch_taken: condition,
                            active: current_active && condition,
                        });
                    }
                    "ifdef" => {
                        let condition = definitions.contains_key(first_word(arguments));
                        frames.push(ConditionalFrame {
                            parent_active: current_active,
                            branch_taken: condition,
                            active: current_active && condition,
                        });
                    }
                    "ifndef" => {
                        let condition = !definitions.contains_key(first_word(arguments));
                        frames.push(ConditionalFrame {
                            parent_active: current_active,
                            branch_taken: condition,
                            active: current_active && condition,
                        });
                    }
                    "elif" => {
                        if let Some(frame) = frames.last_mut() {
                            let condition =
                                !frame.branch_taken && evaluate_condition(arguments, &definitions);
                            frame.active = frame.parent_active && condition;
                            frame.branch_taken |= condition;
                        }
                    }
                    "else" => {
                        if let Some(frame) = frames.last_mut() {
                            frame.active = frame.parent_active && !frame.branch_taken;
                            frame.branch_taken = true;
                        }
                    }
                    "endif" => {
                        frames.pop();
                    }
                    "define" if current_active => {
                        let key = first_word(arguments);
                        if !key.is_empty() {
                            let value = arguments[key.len()..].trim();
                            definitions.insert(key.to_owned(), value.to_owned());
                        }
                    }
                    "undef" if current_active => {
                        definitions.remove(first_word(arguments));
                    }
                    "include" if current_active => {
                        if let Some((path, system, relative_start, relative_end)) =
                            parse_include(arguments)
                        {
                            let body_offset = line.len() - trimmed.len() + 1;
                            includes.push(IncludeFact {
                                path,
                                system,
                                range: SourceRange {
                                    start_byte: offset + body_offset + relative_start,
                                    end_byte: offset + body_offset + relative_end,
                                },
                            });
                        }
                    }
                    _ => {}
                }
            }

            let line_active = frames.last().is_none_or(|frame| frame.active);
            if directive || !line_active {
                mask_non_newline(&mut output[offset..offset + line_with_ending.len()]);
                if !directive && !line_active && !line.is_empty() {
                    inactive_regions.push(InactiveRegion {
                        range: SourceRange {
                            start_byte: offset,
                            end_byte: offset + line.len(),
                        },
                    });
                }
            }
            offset += line_with_ending.len();
        }

        if offset < source.len() {
            let active = frames.last().is_none_or(|frame| frame.active);
            if !active {
                mask_non_newline(&mut output[offset..]);
            }
        }

        PreprocessedDocument {
            text: String::from_utf8(output).expect("masking preserves valid UTF-8 bytes"),
            includes,
            inactive_regions: merge_regions(inactive_regions),
        }
    }
}

pub fn definitions_from_list(values: &[String]) -> Vec<(String, String)> {
    values
        .iter()
        .filter_map(|value| {
            let value = value.trim();
            if value.is_empty() {
                return None;
            }
            let (name, definition) = value
                .split_once('=')
                .map_or((value, "1"), |(name, definition)| {
                    (name.trim(), definition.trim())
                });
            (!name.is_empty()).then(|| (name.to_owned(), definition.to_owned()))
        })
        .collect()
}

fn split_directive(body: &str) -> (&str, &str) {
    let boundary = body.find(char::is_whitespace).unwrap_or(body.len());
    (&body[..boundary], body[boundary..].trim_start())
}

fn first_word(value: &str) -> &str {
    let boundary = value
        .find(|character: char| character.is_whitespace() || character == '(')
        .unwrap_or(value.len());
    &value[..boundary]
}

fn evaluate_condition(expression: &str, definitions: &HashMap<String, String>) -> bool {
    evaluate_value(expression, definitions, 0) != 0
}

fn evaluate_value(expression: &str, definitions: &HashMap<String, String>, depth: usize) -> i64 {
    if depth > 32 {
        return 0;
    }
    let expression = trim_balanced_parentheses(expression.trim());
    for operator in ["||", "&&", "==", "!=", ">=", "<=", ">", "<"] {
        if let Some(index) = find_top_level_operator(expression, operator) {
            let left = evaluate_value(&expression[..index], definitions, depth + 1);
            let right = evaluate_value(
                &expression[index + operator.len()..],
                definitions,
                depth + 1,
            );
            return match operator {
                "||" => i64::from(left != 0 || right != 0),
                "&&" => i64::from(left != 0 && right != 0),
                "==" => i64::from(left == right),
                "!=" => i64::from(left != right),
                ">=" => i64::from(left >= right),
                "<=" => i64::from(left <= right),
                ">" => i64::from(left > right),
                "<" => i64::from(left < right),
                _ => 0,
            };
        }
    }
    if let Some(rest) = expression.strip_prefix('!') {
        return i64::from(evaluate_value(rest, definitions, depth + 1) == 0);
    }
    if let Some(rest) = expression.strip_prefix("defined") {
        let name = rest
            .trim()
            .trim_start_matches('(')
            .trim_end_matches(')')
            .trim();
        return i64::from(definitions.contains_key(name));
    }
    if let Some(hex) = expression
        .strip_prefix("0x")
        .or_else(|| expression.strip_prefix("0X"))
    {
        return i64::from_str_radix(hex, 16).unwrap_or(0);
    }
    if let Ok(value) = expression.parse::<i64>() {
        return value;
    }
    definitions.get(first_word(expression)).map_or(0, |value| {
        let value = value.trim();
        if value.is_empty() {
            1
        } else {
            evaluate_value(value, definitions, depth + 1)
        }
    })
}

fn trim_balanced_parentheses(mut expression: &str) -> &str {
    loop {
        if !expression.starts_with('(') || !expression.ends_with(')') {
            return expression;
        }
        let mut depth = 0_i32;
        let mut closes_at_end = false;
        for (index, character) in expression.char_indices() {
            match character {
                '(' => depth += 1,
                ')' => {
                    depth -= 1;
                    if depth == 0 {
                        closes_at_end = index + character.len_utf8() == expression.len();
                        break;
                    }
                }
                _ => {}
            }
        }
        if !closes_at_end {
            return expression;
        }
        expression = expression[1..expression.len() - 1].trim();
    }
}

fn find_top_level_operator(expression: &str, operator: &str) -> Option<usize> {
    let bytes = expression.as_bytes();
    let operator = operator.as_bytes();
    let mut depth = 0_i32;
    let mut index = 0_usize;
    while index + operator.len() <= bytes.len() {
        match bytes[index] {
            b'(' => depth += 1,
            b')' => depth -= 1,
            _ if depth == 0 && bytes[index..].starts_with(operator) => return Some(index),
            _ => {}
        }
        index += 1;
    }
    None
}

fn parse_include(arguments: &str) -> Option<(String, bool, usize, usize)> {
    let start = arguments.find(['"', '<'])?;
    let opening = arguments.as_bytes()[start];
    let closing = if opening == b'<' { '>' } else { '"' };
    let content_start = start + 1;
    let relative_end = arguments[content_start..].find(closing)? + content_start;
    Some((
        arguments[content_start..relative_end].to_owned(),
        opening == b'<',
        content_start,
        relative_end,
    ))
}

fn mask_non_newline(bytes: &mut [u8]) {
    for byte in bytes {
        if *byte != b'\n' && *byte != b'\r' {
            *byte = b' ';
        }
    }
}

fn merge_regions(regions: Vec<InactiveRegion>) -> Vec<InactiveRegion> {
    let mut merged: Vec<InactiveRegion> = Vec::new();
    for region in regions {
        if let Some(previous) = merged.last_mut()
            && previous.range.end_byte.saturating_add(2) >= region.range.start_byte
        {
            previous.range.end_byte = region.range.end_byte;
            continue;
        }
        merged.push(region);
    }
    merged
}

pub fn referenced_macros(source: &str) -> HashSet<String> {
    source
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix('#'))
        .filter_map(|body| {
            let (name, arguments) = split_directive(body.trim_start());
            matches!(name, "if" | "ifdef" | "ifndef" | "elif")
                .then(|| first_word(arguments.trim_start_matches('!')).to_owned())
        })
        .filter(|name| !name.is_empty())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_inactive_branches_without_changing_offsets() {
        let source = "#if 0\nthis is not LPC 中文\n#else\nint value;\n#endif\n";
        let result = Preprocessor::default().process(source);
        assert_eq!(result.text.len(), source.len());
        assert_eq!(
            result.text.match_indices('\n').count(),
            source.match_indices('\n').count()
        );
        assert!(!result.text.contains("this is not LPC"));
        assert!(result.text.contains("int value;"));
        assert_eq!(result.inactive_regions.len(), 1);
    }

    #[test]
    fn follows_defines_and_collects_active_includes() {
        let source = "#define FEATURE 1\n#ifdef FEATURE\n#include <mudlib.h>\n#else\n#include \"disabled.h\"\n#endif\n";
        let result = Preprocessor::default().process(source);
        assert_eq!(result.includes.len(), 1);
        assert_eq!(result.includes[0].path, "mudlib.h");
        assert!(result.includes[0].system);
    }

    #[test]
    fn evaluates_nested_boolean_and_numeric_macro_conditions() {
        let source = concat!(
            "#define LEVEL 3\n",
            "#if defined(LEVEL) && (LEVEL >= 2)\n",
            "int enabled;\n",
            "#else\n",
            "int disabled;\n",
            "#endif\n",
        );
        let result = Preprocessor::default().process(source);
        assert!(result.text.contains("int enabled;"));
        assert!(!result.text.contains("int disabled;"));
    }

    #[test]
    fn predefined_macros_select_the_expected_branch() {
        let processor = Preprocessor::with_predefined([("FLUFFOS".to_owned(), "1".to_owned())]);
        let result = processor.process("#if defined(FLUFFOS)\nint enabled;\n#endif\n");
        assert!(result.text.contains("int enabled;"));
    }

    #[test]
    fn converts_configuration_defines_to_macro_values() {
        assert_eq!(
            definitions_from_list(&["FLUFFOS".to_owned(), "LIMIT=32".to_owned()]),
            vec![
                ("FLUFFOS".to_owned(), "1".to_owned()),
                ("LIMIT".to_owned(), "32".to_owned())
            ]
        );
    }
}
