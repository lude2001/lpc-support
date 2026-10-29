use serde::{Deserialize, Deserializer, Serialize};

use crate::{Diagnostic, Locale, Range};

/// Cached analysis facts contain stable message identities and original arguments.
/// Only the public Diagnostic DTO contains a localized display string.
#[derive(Debug, Clone, Serialize)]
pub(super) struct DiagnosticFact {
    pub range: Range,
    pub severity: u32,
    pub code: &'static str,
    pub source: &'static str,
    pub message: DiagnosticMessage,
}

impl<'de> Deserialize<'de> for DiagnosticFact {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct CachedDiagnosticFact {
            range: Range,
            severity: u32,
            code: String,
            source: String,
            message: DiagnosticMessage,
        }
        let cached = CachedDiagnosticFact::deserialize(deserializer)?;
        // Match the existing public Diagnostic contract for static code/source IDs.
        Ok(Self {
            range: cached.range,
            severity: cached.severity,
            code: Box::leak(cached.code.into_boxed_str()),
            source: Box::leak(cached.source.into_boxed_str()),
            message: cached.message,
        })
    }
}

impl DiagnosticFact {
    pub fn into_diagnostic(self, locale: Locale) -> Diagnostic {
        Diagnostic {
            range: self.range,
            severity: self.severity,
            code: self.code,
            source: self.source,
            message: self.message.render(locale),
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub(super) enum TypeContext {
    VariableInitializer,
    ReturnValue,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "key", content = "args")]
pub(super) enum DiagnosticMessage {
    #[serde(rename = "diagnostic.unused-parameter")]
    UnusedParameter { name: String },
    #[serde(rename = "diagnostic.unused-local")]
    UnusedLocal { name: String },
    #[serde(rename = "diagnostic.unused-global")]
    UnusedGlobal { name: String },
    #[serde(rename = "diagnostic.undefined-function")]
    UndefinedFunction { name: String },
    #[serde(rename = "diagnostic.argument-count-mismatch")]
    ArgumentCountMismatch { name: String, actual: usize },
    #[serde(rename = "diagnostic.undefined-symbol")]
    UndefinedSymbol { name: String },
    #[serde(rename = "diagnostic.optional-assignment")]
    OptionalAssignment,
    #[serde(rename = "diagnostic.promise-void")]
    PromiseVoid,
    #[serde(rename = "diagnostic.async-function-only")]
    AsyncFunctionOnly,
    #[serde(rename = "diagnostic.async-context")]
    AsyncContext { keyword: String },
    #[serde(rename = "diagnostic.suspension-in-catch")]
    SuspensionInCatch { keyword: String },
    #[serde(rename = "diagnostic.empty-heredoc")]
    EmptyHeredoc,
    #[serde(rename = "diagnostic.file-extension")]
    FileExtension { extension: String },
    #[serde(rename = "diagnostic.file-name-characters")]
    FileNameCharacters,
    #[serde(rename = "diagnostic.file-name-length")]
    FileNameLength,
    #[serde(rename = "diagnostic.local-declaration-position")]
    LocalDeclarationPosition,
    #[serde(rename = "diagnostic.type-mismatch")]
    TypeMismatch {
        context: TypeContext,
        expected: String,
        actual: String,
    },
    #[serde(rename = "diagnostic.missing-syntax")]
    MissingSyntax { kind: String },
    #[serde(rename = "diagnostic.invalid-syntax")]
    InvalidSyntax,
}

impl DiagnosticMessage {
    pub fn render(&self, locale: Locale) -> String {
        match self {
            Self::UnusedParameter { name } => match locale {
                Locale::En => format!("Unused parameter: {name}"),
                Locale::ZhCn => format!("未使用的参数: {name}"),
            },
            Self::UnusedLocal { name } => match locale {
                Locale::En => format!("Local variable '{name}' is unused"),
                Locale::ZhCn => format!("局部变量 '{name}' 未被使用"),
            },
            Self::UnusedGlobal { name } => match locale {
                Locale::En => format!("Global variable '{name}' is unused"),
                Locale::ZhCn => format!("全局变量 '{name}' 未被使用"),
            },
            Self::UndefinedFunction { name } => match locale {
                Locale::En => format!("Undefined function: {name}"),
                Locale::ZhCn => format!("未定义函数: {name}"),
            },
            Self::ArgumentCountMismatch { name, actual } => match locale {
                Locale::En => format!("Function {name} argument count mismatch: received {actual}"),
                Locale::ZhCn => format!("函数 {name} 参数数量不匹配: 当前 {actual} 个"),
            },
            Self::UndefinedSymbol { name } => match locale {
                Locale::En => format!("Undefined symbol: {name}"),
                Locale::ZhCn => format!("未定义符号: {name}"),
            },
            Self::OptionalAssignment => locale.text(
                "The result of optional access cannot be an assignment target",
                "可选访问结果不能直接用作赋值目标",
            ).to_owned(),
            Self::PromiseVoid => locale.text(
                "A promise value type cannot be void", "promise 的值类型不能为 void",
            ).to_owned(),
            Self::AsyncFunctionOnly => locale.text(
                "async can only modify a function declaration", "async 只能修饰函数声明",
            ).to_owned(),
            Self::AsyncContext { keyword } => match locale {
                Locale::En => format!("{keyword} can only be used directly inside an async function body"),
                Locale::ZhCn => format!("{keyword} 只能直接用于 async 函数体内"),
            },
            Self::SuspensionInCatch { keyword } => match locale {
                Locale::En => format!("{keyword} cannot be used inside catch or time_expression; use acatch"),
                Locale::ZhCn => format!("catch 和 time_expression 内不能使用 {keyword}，请使用 acatch"),
            },
            Self::EmptyHeredoc => locale.text("Empty multiline string", "空的多行字符串").to_owned(),
            Self::FileExtension { extension } => match locale {
                Locale::En => format!("The file extension should be .c or .h, not .{extension}"),
                Locale::ZhCn => format!("文件扩展名应为 .c 或 .h，而不是 .{extension}"),
            },
            Self::FileNameCharacters => locale.text(
                "File names should contain letters, digits, underscores, hyphens, or Chinese characters",
                "文件名应由字母（可大写/小写）、数字、下划线、连字符或中文组成",
            ).to_owned(),
            Self::FileNameLength => locale.text(
                "The file name is too long; use no more than 100 characters",
                "文件名过长，建议不超过 100 个字符",
            ).to_owned(),
            Self::LocalDeclarationPosition => locale.text(
                "Local variables must be declared at the start of an executable statement or block.",
                "局部变量定义必须在可执行语句或代码块的开头。",
            ).to_owned(),
            Self::TypeMismatch { context, expected, actual } => match (locale, context) {
                (Locale::En, TypeContext::VariableInitializer) => format!("Variable initializer type mismatch: expected {expected}, got {actual}"),
                (Locale::En, TypeContext::ReturnValue) => format!("Return value type mismatch: expected {expected}, got {actual}"),
                (Locale::ZhCn, TypeContext::VariableInitializer) => format!("变量初始化类型不匹配: 期望 {expected}，实际 {actual}"),
                (Locale::ZhCn, TypeContext::ReturnValue) => format!("返回值类型不匹配: 期望 {expected}，实际 {actual}"),
            },
            Self::MissingSyntax { kind } => match locale {
                Locale::En => format!("Missing syntax element `{kind}`"),
                Locale::ZhCn => format!("缺少语法元素 `{kind}`"),
            },
            Self::InvalidSyntax => locale.text(
                "Cannot parse the LPC syntax here", "无法解析此处的 LPC 语法",
            ).to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_message_variant_has_bilingual_text_and_a_stable_serializable_identity() {
        let name = "raw_name_{0}".to_owned();
        let cases = vec![
            (
                DiagnosticMessage::UnusedParameter { name: name.clone() },
                "Unused parameter: raw_name_{0}",
                "未使用的参数: raw_name_{0}",
            ),
            (
                DiagnosticMessage::UnusedLocal { name: name.clone() },
                "Local variable 'raw_name_{0}' is unused",
                "局部变量 'raw_name_{0}' 未被使用",
            ),
            (
                DiagnosticMessage::UnusedGlobal { name: name.clone() },
                "Global variable 'raw_name_{0}' is unused",
                "全局变量 'raw_name_{0}' 未被使用",
            ),
            (
                DiagnosticMessage::UndefinedFunction { name: name.clone() },
                "Undefined function: raw_name_{0}",
                "未定义函数: raw_name_{0}",
            ),
            (
                DiagnosticMessage::ArgumentCountMismatch {
                    name: name.clone(),
                    actual: 3,
                },
                "Function raw_name_{0} argument count mismatch: received 3",
                "函数 raw_name_{0} 参数数量不匹配: 当前 3 个",
            ),
            (
                DiagnosticMessage::UndefinedSymbol { name },
                "Undefined symbol: raw_name_{0}",
                "未定义符号: raw_name_{0}",
            ),
            (
                DiagnosticMessage::OptionalAssignment,
                "The result of optional access cannot be an assignment target",
                "可选访问结果不能直接用作赋值目标",
            ),
            (
                DiagnosticMessage::PromiseVoid,
                "A promise value type cannot be void",
                "promise 的值类型不能为 void",
            ),
            (
                DiagnosticMessage::AsyncFunctionOnly,
                "async can only modify a function declaration",
                "async 只能修饰函数声明",
            ),
            (
                DiagnosticMessage::AsyncContext {
                    keyword: "await".to_owned(),
                },
                "await can only be used directly inside an async function body",
                "await 只能直接用于 async 函数体内",
            ),
            (
                DiagnosticMessage::SuspensionInCatch {
                    keyword: "await".to_owned(),
                },
                "await cannot be used inside catch or time_expression; use acatch",
                "catch 和 time_expression 内不能使用 await，请使用 acatch",
            ),
            (
                DiagnosticMessage::EmptyHeredoc,
                "Empty multiline string",
                "空的多行字符串",
            ),
            (
                DiagnosticMessage::FileExtension {
                    extension: "lpc".to_owned(),
                },
                "The file extension should be .c or .h, not .lpc",
                "文件扩展名应为 .c 或 .h，而不是 .lpc",
            ),
            (
                DiagnosticMessage::FileNameCharacters,
                "File names should contain letters, digits, underscores, hyphens, or Chinese characters",
                "文件名应由字母（可大写/小写）、数字、下划线、连字符或中文组成",
            ),
            (
                DiagnosticMessage::FileNameLength,
                "The file name is too long; use no more than 100 characters",
                "文件名过长，建议不超过 100 个字符",
            ),
            (
                DiagnosticMessage::LocalDeclarationPosition,
                "Local variables must be declared at the start of an executable statement or block.",
                "局部变量定义必须在可执行语句或代码块的开头。",
            ),
            (
                DiagnosticMessage::TypeMismatch {
                    context: TypeContext::VariableInitializer,
                    expected: "int".to_owned(),
                    actual: "string".to_owned(),
                },
                "Variable initializer type mismatch: expected int, got string",
                "变量初始化类型不匹配: 期望 int，实际 string",
            ),
            (
                DiagnosticMessage::TypeMismatch {
                    context: TypeContext::ReturnValue,
                    expected: "int".to_owned(),
                    actual: "void".to_owned(),
                },
                "Return value type mismatch: expected int, got void",
                "返回值类型不匹配: 期望 int，实际 void",
            ),
            (
                DiagnosticMessage::MissingSyntax {
                    kind: ";".to_owned(),
                },
                "Missing syntax element `;`",
                "缺少语法元素 `;`",
            ),
            (
                DiagnosticMessage::InvalidSyntax,
                "Cannot parse the LPC syntax here",
                "无法解析此处的 LPC 语法",
            ),
        ];
        for (message, english, chinese) in cases {
            assert_eq!(message.render(Locale::En), english);
            assert_eq!(message.render(Locale::ZhCn), chinese);
            let serialized = serde_json::to_value(&message).unwrap();
            assert!(
                serialized["key"]
                    .as_str()
                    .unwrap()
                    .starts_with("diagnostic.")
            );
            assert_eq!(
                serde_json::from_value::<DiagnosticMessage>(serialized).unwrap(),
                message
            );
        }
    }
}
