use std::collections::HashSet;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CallableDocumentation {
    pub raw_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub parameters: Vec<ParameterDocumentation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub returns: Option<ReturnDocumentation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub return_objects: Vec<String>,
    pub extra_tags: Vec<DocumentationTag>,
    pub issues: Vec<DocumentationIssue>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ParameterDocumentation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_name: Option<String>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReturnDocumentation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub type_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentationTag {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentationIssue {
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameter_name: Option<String>,
}

#[derive(Debug)]
struct PendingTag {
    name: String,
    lines: Vec<String>,
}

pub fn parse_callable_documentation(
    comment: &str,
    return_type: Option<&str>,
    declared_parameter_names: &[String],
) -> CallableDocumentation {
    let lines = normalize_doc_comment_lines(comment);
    let declared_names = declared_parameter_names
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    let mut documentation = CallableDocumentation {
        raw_text: comment.to_owned(),
        summary: None,
        parameters: Vec::new(),
        returns: None,
        details: None,
        note: None,
        return_objects: Vec::new(),
        extra_tags: Vec::new(),
        issues: Vec::new(),
    };
    let mut plain_summary = Vec::new();
    let mut pending = None;
    let mut seen_parameter_names = HashSet::new();
    let mut seen_return = false;

    let finalize = |pending: &mut Option<PendingTag>,
                    documentation: &mut CallableDocumentation,
                    seen_parameter_names: &mut HashSet<String>,
                    seen_return: &mut bool| {
        let Some(tag) = pending.take() else {
            return;
        };
        let value = normalize_tag_text(&tag.lines);
        match tag.name.as_str() {
            "brief" => {
                if documentation.summary.is_none() {
                    documentation.summary = value;
                }
            }
            "details" => append_block(&mut documentation.details, value),
            "note" => append_block(&mut documentation.note, value),
            "param" => {
                let Some((parameter_type, name, description)) =
                    parse_parameter_tag(value.as_deref().unwrap_or_default(), &declared_names)
                else {
                    documentation.issues.push(DocumentationIssue {
                        code: "orphan-param-tag".to_owned(),
                        parameter_name: None,
                    });
                    return;
                };
                if !seen_parameter_names.insert(name.clone()) {
                    documentation.issues.push(DocumentationIssue {
                        code: "duplicate-param-tag".to_owned(),
                        parameter_name: Some(name.clone()),
                    });
                }
                if !declared_names.is_empty() && !declared_names.contains(name.as_str()) {
                    documentation.issues.push(DocumentationIssue {
                        code: "stale-parameter-name".to_owned(),
                        parameter_name: Some(name.clone()),
                    });
                }
                documentation.parameters.push(ParameterDocumentation {
                    type_name: parameter_type,
                    name,
                    description,
                });
            }
            "return" => {
                if *seen_return {
                    documentation.issues.push(DocumentationIssue {
                        code: "duplicate-return-tag".to_owned(),
                        parameter_name: None,
                    });
                } else {
                    *seen_return = true;
                    documentation.returns = Some(ReturnDocumentation {
                        type_name: return_type.map(str::to_owned),
                        description: strip_documented_return_type(value, return_type),
                    });
                }
            }
            "lpc-return-objects" => {
                documentation.return_objects = value
                    .as_deref()
                    .and_then(parse_return_objects)
                    .unwrap_or_default();
            }
            _ => documentation.extra_tags.push(DocumentationTag {
                name: tag.name,
                value,
            }),
        }
    };

    for raw_line in lines {
        let trimmed = raw_line.trim().to_owned();
        if let Some((name, remainder)) = parse_tag_header(&trimmed) {
            finalize(
                &mut pending,
                &mut documentation,
                &mut seen_parameter_names,
                &mut seen_return,
            );
            pending = Some(PendingTag {
                name,
                lines: remainder.into_iter().collect(),
            });
        } else if let Some(tag) = pending.as_mut() {
            tag.lines.push(trimmed);
        } else {
            plain_summary.push(trimmed);
        }
    }
    finalize(
        &mut pending,
        &mut documentation,
        &mut seen_parameter_names,
        &mut seen_return,
    );
    if documentation.summary.is_none() {
        documentation.summary = normalize_tag_text(&plain_summary);
    }
    documentation
}

impl CallableDocumentation {
    pub fn render_markdown(&self) -> String {
        let mut sections = Vec::new();
        if let Some(summary) = self.summary.as_deref() {
            sections.push(summary.to_owned());
        }
        if !self.parameters.is_empty() {
            let parameters = self
                .parameters
                .iter()
                .map(|parameter| {
                    let type_label = parameter
                        .type_name
                        .as_deref()
                        .map(|value| format!(" (`{value}`)"))
                        .unwrap_or_default();
                    let description = parameter
                        .description
                        .as_deref()
                        .map(|value| format!("：{}", indent_continuation(value)))
                        .unwrap_or_default();
                    format!("- `{}`{type_label}{description}", parameter.name)
                })
                .collect::<Vec<_>>()
                .join("\n");
            sections.push(format!("**参数**\n\n{parameters}"));
        }
        if let Some(returns) = self.returns.as_ref() {
            let mut value = returns
                .type_name
                .as_deref()
                .map(|type_name| format!("`{type_name}`"))
                .unwrap_or_default();
            if let Some(description) = returns.description.as_deref() {
                if !value.is_empty() {
                    value.push('：');
                }
                value.push_str(description);
            }
            if !value.is_empty() {
                sections.push(format!("**返回值**\n\n{value}"));
            }
        }
        if let Some(details) = self.details.as_deref() {
            sections.push(format!("**详细说明**\n\n{details}"));
        }
        if let Some(note) = self.note.as_deref() {
            sections.push(format!("> **备注**  \n> {}", note.replace('\n', "\n> ")));
        }
        for tag in &self.extra_tags {
            if let Some(value) = tag.value.as_deref() {
                sections.push(format!("**@{}**\n\n{value}", tag.name));
            }
        }
        sections.join("\n\n")
    }
}

fn normalize_doc_comment_lines(comment: &str) -> Vec<String> {
    comment
        .replace("\r\n", "\n")
        .strip_prefix("/**")
        .unwrap_or(comment)
        .strip_suffix("*/")
        .unwrap_or_else(|| comment.strip_prefix("/**").unwrap_or(comment))
        .split('\n')
        .map(|line| {
            line.trim_start()
                .strip_prefix('*')
                .unwrap_or(line.trim_start())
                .strip_prefix(' ')
                .unwrap_or_else(|| {
                    line.trim_start()
                        .strip_prefix('*')
                        .unwrap_or(line.trim_start())
                })
                .to_owned()
        })
        .collect()
}

fn parse_tag_header(line: &str) -> Option<(String, Option<String>)> {
    let tail = line.strip_prefix('@')?;
    let split = tail.find(char::is_whitespace).unwrap_or(tail.len());
    let name = &tail[..split];
    if name.is_empty()
        || !name.chars().enumerate().all(|(index, character)| {
            if index == 0 {
                character.is_ascii_alphabetic()
            } else {
                character.is_ascii_alphanumeric() || character == '-'
            }
        })
    {
        return None;
    }
    let remainder = tail[split..].trim();
    Some((
        name.to_owned(),
        (!remainder.is_empty()).then(|| remainder.to_owned()),
    ))
}

fn normalize_tag_text(lines: &[String]) -> Option<String> {
    let mut normalized = Vec::new();
    let mut previous_blank = false;
    for line in lines.iter().map(|line| line.trim()) {
        let blank = line.is_empty();
        if blank && previous_blank {
            continue;
        }
        normalized.push(line.to_owned());
        previous_blank = blank;
    }
    while normalized.first().is_some_and(String::is_empty) {
        normalized.remove(0);
    }
    while normalized.last().is_some_and(String::is_empty) {
        normalized.pop();
    }
    (!normalized.is_empty()).then(|| normalized.join("\n"))
}

fn append_block(target: &mut Option<String>, value: Option<String>) {
    let Some(value) = value else {
        return;
    };
    if let Some(existing) = target.as_mut() {
        existing.push_str("\n\n");
        existing.push_str(&value);
    } else {
        *target = Some(value);
    }
}

fn strip_documented_return_type(
    value: Option<String>,
    declared_return_type: Option<&str>,
) -> Option<String> {
    let value = value?;
    let Some(declared) = declared_return_type else {
        return Some(value);
    };
    let normalized_declared = declared.split_whitespace().collect::<String>();
    let mut matching_end = None;
    for (index, character) in value.char_indices() {
        if !character.is_whitespace() {
            continue;
        }
        let documented = value[..index].split_whitespace().collect::<String>();
        if documented == normalized_declared {
            matching_end = Some(index);
            break;
        }
        if documented.len() > normalized_declared.len() {
            break;
        }
    }
    if value.split_whitespace().collect::<String>() == normalized_declared {
        matching_end = Some(value.len());
    }
    let Some(matching_end) = matching_end else {
        return Some(value);
    };
    let remainder = value[matching_end..].trim_start();
    (!remainder.is_empty()).then(|| remainder.to_owned())
}

fn parse_parameter_tag(
    value: &str,
    declared_names: &HashSet<&str>,
) -> Option<(Option<String>, String, Option<String>)> {
    let (header, continuation) = value
        .split_once('\n')
        .map_or((value, None), |(header, tail)| (header, Some(tail)));
    let mut parts = header.split_whitespace();
    let first = parts.next()?;
    let second = parts.next();
    let remaining = parts.collect::<Vec<_>>();

    if declared_names.contains(first) {
        return Some((
            second
                .filter(|value| looks_like_type(value))
                .map(str::to_owned),
            first.to_owned(),
            description_from_parts(
                if second.is_some_and(looks_like_type) {
                    remaining
                } else {
                    second.into_iter().chain(remaining).collect()
                },
                continuation,
            ),
        ));
    }

    let second = second?;
    if declared_names.contains(second) {
        return Some((
            Some(first.to_owned()),
            second.to_owned(),
            description_from_parts(remaining, continuation),
        ));
    }

    if let Some((pointer, name)) = split_attached_pointer(second) {
        return Some((
            Some(format!("{first} {pointer}")),
            name.to_owned(),
            description_from_parts(remaining, continuation),
        ));
    }
    if second.chars().all(|character| character == '*') {
        let name = *remaining.first()?;
        return Some((
            Some(format!("{first} {second}")),
            name.to_owned(),
            description_from_parts(remaining.into_iter().skip(1).collect(), continuation),
        ));
    }
    Some((
        Some(first.to_owned()),
        second.to_owned(),
        description_from_parts(remaining, continuation),
    ))
}

fn description_from_parts(parts: Vec<&str>, continuation: Option<&str>) -> Option<String> {
    let head = parts.join(" ");
    match (
        head.is_empty(),
        continuation.filter(|value| !value.is_empty()),
    ) {
        (true, None) => None,
        (false, None) => Some(head),
        (true, Some(tail)) => Some(tail.to_owned()),
        (false, Some(tail)) => Some(format!("{head}\n{tail}")),
    }
}

fn split_attached_pointer(value: &str) -> Option<(&str, &str)> {
    let pointer_len = value.bytes().take_while(|byte| *byte == b'*').count();
    (pointer_len > 0 && pointer_len < value.len()).then(|| value.split_at(pointer_len))
}

fn looks_like_type(value: &str) -> bool {
    matches!(
        value.trim_end_matches('*'),
        "array"
            | "buffer"
            | "class"
            | "closure"
            | "float"
            | "function"
            | "int"
            | "mapping"
            | "mixed"
            | "object"
            | "status"
            | "string"
            | "struct"
            | "void"
    ) || value.contains('*')
}

fn parse_return_objects(value: &str) -> Option<Vec<String>> {
    let trimmed = value.trim();
    let body = trimmed.strip_prefix('{')?.strip_suffix('}')?;
    serde_json::from_str::<Vec<String>>(&format!("[{body}]")).ok()
}

fn indent_continuation(value: &str) -> String {
    value.replace('\n', "\n  ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lossless_structured_javadoc_and_quality_issues() {
        let comment = concat!(
            "/**\r\n",
            " * @brief 第一行\r\n",
            " * 第二行\r\n",
            " * @param mapping *data 主参数\r\n",
            " *   参数续行\r\n",
            " * @param missing object 兼容 name-first\r\n",
            " * @param int stale 无效参数\r\n",
            " * @return string 第一行\r\n",
            " *   返回续行\r\n",
            " * @return string 重复\r\n",
            " * @details - 列表一\r\n",
            " *\r\n",
            " *   1. 列表二\r\n",
            " * @note 保留备注\r\n",
            " * @warning 保留未知标签\r\n",
            " * @lpc-return-objects {\"/obj/a\", \"/obj/b\"}\r\n",
            " */",
        );
        let parsed = parse_callable_documentation(
            comment,
            Some("string"),
            &["data".to_owned(), "missing".to_owned()],
        );

        assert_eq!(parsed.summary.as_deref(), Some("第一行\n第二行"));
        assert_eq!(parsed.parameters[0].type_name.as_deref(), Some("mapping *"));
        assert_eq!(parsed.parameters[0].name, "data");
        assert_eq!(
            parsed.parameters[0].description.as_deref(),
            Some("主参数\n参数续行")
        );
        assert_eq!(parsed.parameters[1].name, "missing");
        assert_eq!(parsed.parameters[1].type_name.as_deref(), Some("object"));
        assert_eq!(
            parsed
                .returns
                .as_ref()
                .and_then(|value| value.description.as_deref()),
            Some("第一行\n返回续行")
        );
        assert_eq!(parsed.note.as_deref(), Some("保留备注"));
        assert_eq!(parsed.return_objects, ["/obj/a", "/obj/b"]);
        assert_eq!(parsed.extra_tags[0].name, "warning");
        assert!(
            parsed
                .issues
                .iter()
                .any(|issue| issue.code == "stale-parameter-name")
        );
        assert!(
            parsed
                .issues
                .iter()
                .any(|issue| issue.code == "duplicate-return-tag")
        );
        let markdown = parsed.render_markdown();
        assert!(markdown.contains("参数续行"));
        assert!(markdown.contains("**@warning**"));
        assert!(markdown.contains("> **备注**"));
    }

    #[test]
    fn supports_name_first_and_untyped_real_world_parameter_tags() {
        let declared = vec!["me".to_owned(), "ob".to_owned()];
        let parsed = parse_callable_documentation(
            "/**\n * @param me object 玩家\n * @param ob 队伍成员\n */",
            None,
            &declared,
        );
        assert_eq!(parsed.parameters[0].name, "me");
        assert_eq!(parsed.parameters[0].type_name.as_deref(), Some("object"));
        assert_eq!(parsed.parameters[1].name, "ob");
        assert_eq!(parsed.parameters[1].type_name, None);
        assert_eq!(
            parsed.parameters[1].description.as_deref(),
            Some("队伍成员")
        );
    }

    #[test]
    fn preserves_plain_markdown_as_a_summary_fallback() {
        let parsed = parse_callable_documentation(
            "/**\n * First paragraph.\n *\n * - item\n * ```lpc\n * call();\n * ```\n */",
            None,
            &[],
        );
        assert_eq!(
            parsed.summary.as_deref(),
            Some("First paragraph.\n\n- item\n```lpc\ncall();\n```")
        );
    }
}
