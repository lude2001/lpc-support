use lpc_analysis::Locale;

#[derive(Debug, Clone, Copy)]
pub enum RequestKind {
    SemanticTokens,
    DocumentSymbols,
    Formatting,
    RangeFormatting,
}

impl RequestKind {
    fn label(self, locale: Locale) -> &'static str {
        match self {
            Self::SemanticTokens => locale.text("semantic tokens", "语义标记"),
            Self::DocumentSymbols => locale.text("document symbols", "文档符号"),
            Self::Formatting => locale.text("formatting", "格式化"),
            Self::RangeFormatting => locale.text("range formatting", "选区格式化"),
        }
    }
}

/// Transient server context; language facts and cached analysis never store it.
#[derive(Debug, Clone, Copy)]
pub enum ServerMessage<'a> {
    InitializationResponseFailed,
    EfunDocumentationUnavailable,
    TransportFailed,
    AnalysisLockPoisoned,
    UnopenedDocument { kind: RequestKind, uri: &'a str },
    MissingSyntax { kind: RequestKind, uri: &'a str },
    RangeStartOutsideDocument,
    RangeEndOutsideDocument,
    OpenedDocumentNotRetained,
    ChangedDocumentNotRetained,
    MarkUnused { name: &'a str },
    UnsupportedMethod { method: &'a str },
}

impl ServerMessage<'_> {
    pub fn render(self, locale: Locale) -> String {
        match self {
            Self::InitializationResponseFailed => locale
                .text("LSP initialization response failed", "LSP 初始化响应失败")
                .to_owned(),
            Self::EfunDocumentationUnavailable => locale
                .text("efun documentation unavailable", "Efun 文档不可用")
                .to_owned(),
            Self::TransportFailed => locale
                .text("LSP transport failed", "LSP 通信失败")
                .to_owned(),
            Self::AnalysisLockPoisoned => locale
                .text(
                    "analysis database lock was poisoned",
                    "分析数据库锁已被破坏",
                )
                .to_owned(),
            Self::UnopenedDocument { kind, uri } => match locale {
                Locale::En => format!(
                    "{} requested for unopened document {uri}",
                    kind.label(locale)
                ),
                Locale::ZhCn => format!("{}请求的文档尚未打开：{uri}", kind.label(locale)),
            },
            Self::MissingSyntax { kind, uri } => match locale {
                Locale::En => format!("{} requested without syntax for {uri}", kind.label(locale)),
                Locale::ZhCn => format!("{}请求缺少文档语法快照：{uri}", kind.label(locale)),
            },
            Self::RangeStartOutsideDocument => locale
                .text(
                    "range formatting start is outside the document",
                    "选区格式化起点超出文档范围",
                )
                .to_owned(),
            Self::RangeEndOutsideDocument => locale
                .text(
                    "range formatting end is outside the document",
                    "选区格式化终点超出文档范围",
                )
                .to_owned(),
            Self::OpenedDocumentNotRetained => locale
                .text("opened document was not retained", "打开的文档未被保留")
                .to_owned(),
            Self::ChangedDocumentNotRetained => locale
                .text("changed document was not retained", "修改的文档未被保留")
                .to_owned(),
            Self::MarkUnused { name } => match locale {
                Locale::En => format!("Mark unused `{name}` as intentionally kept"),
                Locale::ZhCn => format!("将未使用的 `{name}` 标记为有意保留"),
            },
            Self::UnsupportedMethod { method } => match locale {
                Locale::En => format!("Rust LPC server does not implement {method} yet"),
                Locale::ZhCn => format!("Rust LPC 服务器尚未实现 {method}"),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{RequestKind, ServerMessage};
    use lpc_analysis::Locale;

    #[test]
    fn all_server_contexts_have_distinct_nonempty_language_projections() {
        let contexts = [
            ServerMessage::InitializationResponseFailed,
            ServerMessage::EfunDocumentationUnavailable,
            ServerMessage::TransportFailed,
            ServerMessage::AnalysisLockPoisoned,
            ServerMessage::RangeStartOutsideDocument,
            ServerMessage::RangeEndOutsideDocument,
            ServerMessage::OpenedDocumentNotRetained,
            ServerMessage::ChangedDocumentNotRetained,
            ServerMessage::MarkUnused { name: "kept_value" },
            ServerMessage::UnsupportedMethod {
                method: "lpc/fixture",
            },
        ];
        for context in contexts {
            let english = context.render(Locale::En);
            let chinese = context.render(Locale::ZhCn);
            assert!(!english.is_empty() && !chinese.is_empty());
            assert_ne!(english, chinese);
        }
    }

    #[test]
    fn request_contexts_and_fix_titles_preserve_supplied_values() {
        let uri = "file:///fixture/原文.c";
        for kind in [
            RequestKind::SemanticTokens,
            RequestKind::DocumentSymbols,
            RequestKind::Formatting,
            RequestKind::RangeFormatting,
        ] {
            for locale in [Locale::En, Locale::ZhCn] {
                assert!(
                    ServerMessage::UnopenedDocument { kind, uri }
                        .render(locale)
                        .contains(uri)
                );
                assert!(
                    ServerMessage::MissingSyntax { kind, uri }
                        .render(locale)
                        .contains(uri)
                );
            }
        }
        assert_eq!(
            ServerMessage::MarkUnused { name: "kept_value" }.render(Locale::En),
            "Mark unused `kept_value` as intentionally kept"
        );
        assert_eq!(
            ServerMessage::UnsupportedMethod {
                method: "lpc/fixture"
            }
            .render(Locale::En),
            "Rust LPC server does not implement lpc/fixture yet"
        );
        assert!(
            ServerMessage::UnsupportedMethod {
                method: "lpc/fixture"
            }
            .render(Locale::ZhCn)
            .contains("lpc/fixture")
        );
    }
}
