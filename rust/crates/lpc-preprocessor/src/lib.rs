use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

mod expression;
mod lexical;
pub use lexical::logical_directive;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceRange {
    pub start_byte: usize,
    pub end_byte: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IncludeFact {
    pub path: String,
    pub system: bool,
    pub range: SourceRange,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InactiveRegion {
    pub range: SourceRange,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MacroDirectiveKind {
    Define,
    Undef,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MacroDirectiveFact {
    pub name: String,
    pub kind: MacroDirectiveKind,
    pub range: SourceRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PreprocessedDocument {
    /// Inactive text and directives are replaced with ASCII spaces. Newlines and
    /// every original byte offset are preserved, so parser ranges map directly
    /// back to the editor document without heuristic line repair.
    pub text: String,
    pub includes: Vec<IncludeFact>,
    pub inactive_regions: Vec<InactiveRegion>,
    pub macro_directives: Vec<MacroDirectiveFact>,
    pub initial_definitions: HashMap<String, String>,
    pub final_definitions: HashMap<String, String>,
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
    efuns: HashSet<String>,
}

impl Preprocessor {
    pub fn with_predefined(predefined: impl IntoIterator<Item = (String, String)>) -> Self {
        Self {
            predefined: predefined.into_iter().collect(),
            efuns: HashSet::new(),
        }
    }

    pub fn with_efuns(mut self, efuns: impl IntoIterator<Item = String>) -> Self {
        self.efuns = efuns.into_iter().collect();
        self
    }

    pub fn process(&self, source: &str) -> PreprocessedDocument {
        self.process_with_include_resolver(source, |_, _, _| None)
    }

    pub fn process_with_include_resolver<F>(
        &self,
        source: &str,
        mut resolve_include: F,
    ) -> PreprocessedDocument
    where
        F: FnMut(&str, bool, &HashMap<String, String>) -> Option<HashMap<String, String>>,
    {
        let mut output = source.as_bytes().to_vec();
        let initial_definitions = self.predefined.clone();
        let mut definitions = initial_definitions.clone();
        let mut frames: Vec<ConditionalFrame> = Vec::new();
        let mut includes = Vec::new();
        let mut inactive_regions = Vec::new();
        let mut macro_directives = Vec::new();
        let mut offset = 0_usize;
        let mut consumed_until = 0;
        let mut lexical = lexical::LexicalState::default();

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

            if offset < consumed_until {
                mask_non_newline(&mut output[offset..offset + line_with_ending.len()]);
                offset += line_with_ending.len();
                continue;
            }
            if (!current_active || lexical.in_code()) && trimmed.starts_with('#') {
                directive = true;
                let (logical, consumed) = lexical::logical_directive(&source[offset..]);
                consumed_until = offset + consumed;
                let body = logical
                    .trim_start()
                    .strip_prefix('#')
                    .unwrap_or_default()
                    .trim_start();
                let (name, arguments) = split_directive(body);
                let arguments_start = offset + logical.len().saturating_sub(arguments.len());
                match name {
                    "if" => {
                        let condition = expression::evaluate(arguments, &definitions, &self.efuns);
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
                            let condition = !frame.branch_taken
                                && expression::evaluate(arguments, &definitions, &self.efuns);
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
                        if let Some((key, value)) = parse_define(arguments) {
                            let start_byte = arguments_start;
                            let value = compact_macro_whitespace(value);
                            macro_directives.push(MacroDirectiveFact {
                                name: key.to_owned(),
                                kind: MacroDirectiveKind::Define,
                                range: SourceRange {
                                    start_byte,
                                    end_byte: start_byte + key.len(),
                                },
                                value: Some(value.clone()),
                            });
                            definitions.insert(key.to_owned(), value);
                        }
                    }
                    "undef" if current_active => {
                        let key = first_word(arguments);
                        if !key.is_empty() {
                            let start_byte = arguments_start;
                            macro_directives.push(MacroDirectiveFact {
                                name: key.to_owned(),
                                kind: MacroDirectiveKind::Undef,
                                range: SourceRange {
                                    start_byte,
                                    end_byte: start_byte + key.len(),
                                },
                                value: None,
                            });
                            definitions.remove(key);
                        }
                    }
                    "include" if current_active => {
                        let parsed = parse_include(arguments).or_else(|| {
                            let macro_name = first_word(arguments);
                            definitions
                                .get(macro_name)
                                .and_then(|value| parse_include(value))
                                .map(|(path, system, _, _)| {
                                    let start = arguments.find(macro_name).unwrap_or(0);
                                    (path, system, start, start + macro_name.len())
                                })
                        });
                        if let Some((path, system, relative_start, relative_end)) = parsed {
                            let include_range = SourceRange {
                                start_byte: arguments_start + relative_start,
                                end_byte: arguments_start + relative_end,
                            };
                            includes.push(IncludeFact {
                                path: path.clone(),
                                system,
                                range: include_range.clone(),
                            });
                            if let Some(imported) = resolve_include(&path, system, &definitions) {
                                let mut changed_names = definitions
                                    .keys()
                                    .chain(imported.keys())
                                    .cloned()
                                    .collect::<Vec<_>>();
                                changed_names.sort();
                                changed_names.dedup();
                                for name in changed_names {
                                    if definitions.get(&name) == imported.get(&name) {
                                        continue;
                                    }
                                    macro_directives.push(MacroDirectiveFact {
                                        name: name.clone(),
                                        kind: if imported.contains_key(&name) {
                                            MacroDirectiveKind::Define
                                        } else {
                                            MacroDirectiveKind::Undef
                                        },
                                        range: include_range.clone(),
                                        value: imported.get(&name).cloned(),
                                    });
                                }
                                definitions = imported;
                            }
                        }
                    }
                    _ => {}
                }
            }

            let line_active = frames.last().is_none_or(|frame| frame.active);
            if directive {
                lexical = lexical::LexicalState::default();
            } else if line_active {
                lexical.scan_line(line);
            }
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
            macro_directives,
            initial_definitions,
            final_definitions: definitions,
        }
    }
}

fn compact_macro_whitespace(value: &str) -> String {
    let mut result = String::new();
    let mut quote = None;
    let mut escaped = false;
    for character in value.chars() {
        if let Some(delimiter) = quote {
            result.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == delimiter {
                quote = None;
            }
        } else if matches!(character, '\"' | '\'') {
            quote = Some(character);
            result.push(character);
        } else if character.is_whitespace() {
            if !result.ends_with(' ') {
                result.push(' ');
            }
        } else {
            result.push(character);
        }
    }
    result.trim().to_owned()
}

fn parse_define(arguments: &str) -> Option<(&str, &str)> {
    let name_end = arguments
        .char_indices()
        .take_while(|(index, character)| {
            if *index == 0 {
                character.is_ascii_alphabetic() || *character == '_'
            } else {
                character.is_ascii_alphanumeric() || *character == '_'
            }
        })
        .last()
        .map(|(index, character)| index + character.len_utf8())?;
    let name = &arguments[..name_end];
    let tail = &arguments[name_end..];
    let value = if tail.starts_with('(') {
        tail.trim_end()
    } else {
        tail.trim()
    };
    Some((name, value))
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
    fn evaluates_driver_integer_precedence_and_function_macros() {
        for (condition, expected) in [
            ("(1 + 1) == 2", true),
            ("2 * 3 == 6", true),
            ("6 & 2", true),
            ("1 << 2 == 4", true),
            ("1 ? 1 : 0", true),
            ("3 > 2 > 1", false),
            ("0b10 == 2", true),
            ("010 == 10", true),
            ("'\\x41' == 65", true),
            ("'\\101' == 65", true),
            ("~0 != 0", true),
            ("1 /* note */", true),
            ("8 - 3 - 2 == 3", true),
            ("1 + 1 * 2 == 3", true),
            ("DOUBLE(2) == 4", true),
            ("VALUE * 2 == 3", true),
            ("DOUBLE(DOUBLE(2)) == 8", true),
            ("CAT(0x1, 0) == 16", true),
            ("CAT(PREFIX, 1) == 42", true),
            ("defined(VALUE) && !defined(MISSING)", true),
            ("efun_defined(sizeof)", true),
            ("efun_defined(missing_efun)", false),
        ] {
            let source = format!(
                "#define DOUBLE(x) ((x) * 2)\n#define CAT(a,b) a ## b\n#define VALUE 1+1\n#define PREFIX 9\n#define PREFIX1 42\n#if {condition}\nint yes;\n#else\nint no;\n#endif\n"
            );
            let result = Preprocessor::default()
                .with_efuns(["sizeof".to_owned()])
                .process(&source);
            assert_eq!(
                result.text.contains("int yes;"),
                expected,
                "{condition}: {}",
                result.text
            );
            assert_eq!(result.text.contains("int no;"), !expected, "{condition}");
            assert_eq!(result.text.len(), source.len());
        }
    }

    #[test]
    fn preserves_directive_text_in_comments_strings_and_text_blocks() {
        for literal in [
            "/*\n#if 0\n*/\n",
            "string s = @END\n#if 0\nEND;\n",
            "string *s = @@END\n#if 0\nEND;\n",
            "string s = `text\n#if 0\n`;\n",
            "string s = `outer ${`inner ${1}`}\n#if 0\n`;\n",
        ] {
            let source = format!("{literal}int visible;\n");
            let result = Preprocessor::default().process(&source);
            assert_eq!(result.text, source);
            assert!(result.inactive_regions.is_empty());
        }
        let source =
            "#define LEVEL 1 /* comment\n continued */ + 2\n#if LEVEL == 3\nint visible;\n#endif\n";
        let result = Preprocessor::default().process(source);
        assert!(result.text.contains("int visible;"));
        assert!(!result.text.contains("continued"));
        assert_eq!(result.text.len(), source.len());
        assert_eq!(
            &source[result.macro_directives[0].range.start_byte
                ..result.macro_directives[0].range.end_byte],
            "LEVEL"
        );
    }

    #[test]
    fn terminates_recursive_and_malformed_conditions_without_panicking() {
        let processor = Preprocessor::with_predefined([
            ("A".to_owned(), "B".to_owned()),
            ("B".to_owned(), "A".to_owned()),
        ]);
        for condition in [
            "A",
            "1 / 0",
            "1 << -1",
            "defined(",
            "1 +",
            "\"中文\"",
            "'中'",
            "'",
        ] {
            let _ = processor.process(&format!("#if {condition}\nint yes;\n#endif\n"));
        }
    }

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
    fn records_only_active_define_and_undef_directives_in_source_order() {
        let source = "#if 0\n#define DISABLED 1\n#endif\n#define ACTIVE 1\n#undef ACTIVE\n";
        let result = Preprocessor::default().process(source);
        assert_eq!(
            result
                .macro_directives
                .iter()
                .map(|fact| (fact.name.as_str(), fact.kind))
                .collect::<Vec<_>>(),
            vec![
                ("ACTIVE", MacroDirectiveKind::Define),
                ("ACTIVE", MacroDirectiveKind::Undef),
            ]
        );
        assert_eq!(
            &source[result.macro_directives[0].range.start_byte
                ..result.macro_directives[0].range.end_byte],
            "ACTIVE"
        );
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
    fn masks_every_physical_line_of_continued_directives() {
        let source = "#define DATA ([ \\\n  \"name\" : 1, \\\n])\nint visible;\n";
        let result = Preprocessor::default().process(source);
        assert!(
            result
                .text
                .lines()
                .take(3)
                .all(|line| line.trim().is_empty())
        );
        assert!(result.text.contains("int visible;"));
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

    #[test]
    fn exposes_the_final_macro_environment_for_include_imports() {
        let result = Preprocessor::with_predefined([("DRIVER".to_owned(), "1".to_owned())])
            .process("#define HEADER_VALUE 7\n#undef DRIVER\n");
        assert_eq!(
            result
                .final_definitions
                .get("HEADER_VALUE")
                .map(String::as_str),
            Some("7")
        );
        assert!(!result.final_definitions.contains_key("DRIVER"));
    }

    #[test]
    fn preserves_the_complete_value_of_multiline_macros() {
        let source = concat!(
            "#define TASK(name, count) ([\\\n",
            "    \"name\": name,\\\n",
            "    \"count\": count\\\n",
            "])\n",
        );
        let result = Preprocessor::default().process(source);
        assert_eq!(
            result.final_definitions.get("TASK").map(String::as_str),
            Some("(name, count) ([ \"name\": name, \"count\": count ])")
        );
        assert_eq!(result.macro_directives[0].name, "TASK");
    }

    #[test]
    fn applies_include_side_effects_at_the_directive_position() {
        let source = concat!(
            "#define BEFORE 1\n",
            "#include <feature.h>\n",
            "#if HEADER_SAW_BEFORE && !defined(REMOVED_BY_HEADER)\n",
            "int enabled;\n",
            "#endif\n",
        );
        let result = Preprocessor::default().process_with_include_resolver(
            source,
            |path, system, definitions| {
                assert_eq!(path, "feature.h");
                assert!(system);
                assert_eq!(definitions.get("BEFORE").map(String::as_str), Some("1"));
                let mut imported = definitions.clone();
                imported.insert("HEADER_SAW_BEFORE".to_owned(), "1".to_owned());
                imported.remove("REMOVED_BY_HEADER");
                Some(imported)
            },
        );
        assert!(result.text.contains("int enabled;"));
        assert_eq!(
            result
                .final_definitions
                .get("HEADER_SAW_BEFORE")
                .map(String::as_str),
            Some("1")
        );
        assert!(result.macro_directives.iter().any(|directive| {
            directive.name == "HEADER_SAW_BEFORE" && directive.kind == MacroDirectiveKind::Define
        }));
    }

    #[test]
    fn resolves_macro_backed_include_arguments() {
        let source = "#define CONFIG <config.h>\n#include CONFIG\n";
        let result = Preprocessor::default().process_with_include_resolver(
            source,
            |path, system, definitions| {
                assert_eq!(path, "config.h");
                assert!(system);
                let mut imported = definitions.clone();
                imported.insert("FROM_CONFIG".to_owned(), "1".to_owned());
                Some(imported)
            },
        );
        assert_eq!(result.includes.len(), 1);
        assert_eq!(result.includes[0].path, "config.h");
        assert_eq!(
            &source[result.includes[0].range.start_byte..result.includes[0].range.end_byte],
            "CONFIG"
        );
        assert_eq!(
            result
                .final_definitions
                .get("FROM_CONFIG")
                .map(String::as_str),
            Some("1")
        );
    }
}
