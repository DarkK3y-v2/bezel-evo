//! Non-destructive Unicode case formatting, shared by all text content.
use std::borrow::Cow;
use unicode_segmentation::UnicodeSegmentation;

/// Letter case applied after resolving static text, sensors, clocks and media.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum TextCase {
    /// Preserve the source exactly.
    #[default]
    Normal,
    /// All letters uppercase.
    Upper,
    /// All letters lowercase.
    Lower,
    /// Only the first letter uppercase; remaining letters lowercase.
    Sentence,
    /// First letter of each Unicode word uppercase; remaining letters lowercase.
    Title,
}

fn initial(text: &str) -> String {
    let Some((at, first)) = text.char_indices().find(|(_, c)| c.is_alphabetic()) else {
        return text.to_owned();
    };
    format!(
        "{}{}{}",
        &text[..at],
        first.to_uppercase(),
        &text[at + first.len_utf8()..]
    )
}

impl TextCase {
    /// Formats display text without changing the stored source.
    pub fn apply(self, text: &str) -> Cow<'_, str> {
        match self {
            Self::Normal => Cow::Borrowed(text),
            Self::Upper => Cow::Owned(text.to_uppercase()),
            Self::Lower => Cow::Owned(text.to_lowercase()),
            Self::Sentence => Cow::Owned(initial(&text.to_lowercase())),
            Self::Title => Cow::Owned(
                text.to_lowercase()
                    .split_word_bounds()
                    .map(initial)
                    .collect(),
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unicode_modes_preserve_source_punctuation_and_spacing() {
        let source = "  «È GIÀ LUNEDÌ» — música NOVA\nhello-world";
        assert_eq!(TextCase::Normal.apply(source), source);
        assert_eq!(TextCase::Upper.apply("straße è già"), "STRASSE È GIÀ");
        assert_eq!(TextCase::Lower.apply("MÚSICA È GIÀ"), "música è già");
        assert_eq!(
            TextCase::Sentence.apply(source),
            "  «È già lunedì» — música nova\nhello-world"
        );
        assert_eq!(
            TextCase::Title.apply(source),
            "  «È Già Lunedì» — Música Nova\nHello-World"
        );
        assert_eq!(
            TextCase::Title.apply("e\u{301}COLE l'ACQUA"),
            "E\u{301}cole L'acqua"
        );
        assert_eq!(TextCase::Sentence.apply("123 …"), "123 …");
        assert_eq!(TextCase::Title.apply(""), "");
        assert_eq!(source, "  «È GIÀ LUNEDÌ» — música NOVA\nhello-world");
    }
}
