/// The two display languages shipped with the extension.
/// This is session state and must not become part of cached language facts.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
pub enum Locale {
    #[default]
    En,
    ZhCn,
}

impl Locale {
    pub fn from_language(language: Option<&str>) -> Self {
        if language.is_some_and(|value| value.eq_ignore_ascii_case("zh-cn")) {
            Self::ZhCn
        } else {
            Self::En
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::En => "en",
            Self::ZhCn => "zh-cn",
        }
    }

    pub fn text<'a>(self, english: &'a str, chinese: &'a str) -> &'a str {
        match self {
            Self::En => english,
            Self::ZhCn => chinese,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Locale;

    #[test]
    fn matches_the_same_locale_cases_as_the_extension_host() {
        let cases: serde_json::Value = serde_json::from_str(include_str!(
            "../../../../tests/fixtures/localization/locale-cases.json"
        ))
        .expect("shared locale fixture must be valid JSON");
        for case in cases.as_array().expect("locale fixture must be an array") {
            let input = case["input"].as_str();
            assert_eq!(
                Locale::from_language(input).as_str(),
                case["expected"].as_str().unwrap(),
                "{}",
                case["reason"]
            );
        }
        assert_eq!(Locale::default(), Locale::En);
    }

    #[test]
    fn selection_does_not_change_or_interpolate_user_content() {
        assert_eq!(Locale::En.text("Value {0}", "值 {0}"), "Value {0}");
        assert_eq!(Locale::ZhCn.text("Value {0}", "值 {0}"), "值 {0}");
    }
}
