#[derive(Default)]
pub(crate) struct LexicalState {
    modes: Vec<Mode>,
    heredoc: Option<String>,
}

enum Mode {
    Comment,
    Quote(u8),
    Template,
    Interpolation(usize),
}

impl LexicalState {
    pub(crate) fn in_code(&self) -> bool {
        self.modes.is_empty() && self.heredoc.is_none()
    }

    pub(crate) fn scan_line(&mut self, line: &str) {
        let bytes = line.as_bytes();
        let mut index = 0;
        if let Some(marker) = &self.heredoc {
            if line.starts_with(marker)
                && !bytes.get(marker.len()).is_some_and(|b| identifier_byte(*b))
            {
                index = marker.len();
                self.heredoc = None;
            } else {
                return;
            }
        }
        while index < bytes.len() {
            match self.modes.last_mut() {
                Some(Mode::Comment) => {
                    if bytes[index..].starts_with(b"*/") {
                        self.modes.pop();
                        index += 2;
                    } else {
                        index += 1;
                    }
                    continue;
                }
                Some(Mode::Quote(quote)) => {
                    if bytes[index] == b'\\' {
                        index = (index + 2).min(bytes.len());
                    } else {
                        if bytes[index] == *quote {
                            self.modes.pop();
                        }
                        index += 1;
                    }
                    continue;
                }
                Some(Mode::Template) => {
                    if bytes[index] == b'\\' {
                        index = (index + 2).min(bytes.len());
                    } else if bytes[index] == b'`' {
                        self.modes.pop();
                        index += 1;
                    } else if bytes[index..].starts_with(b"${") {
                        self.modes.push(Mode::Interpolation(1));
                        index += 2;
                    } else {
                        index += 1;
                    }
                    continue;
                }
                Some(Mode::Interpolation(braces)) if bytes[index] == b'{' => {
                    *braces += 1;
                    index += 1;
                    continue;
                }
                Some(Mode::Interpolation(braces)) if bytes[index] == b'}' => {
                    *braces -= 1;
                    if *braces == 0 {
                        self.modes.pop();
                    }
                    index += 1;
                    continue;
                }
                _ => {}
            }
            if bytes[index..].starts_with(b"//") {
                return;
            } else if bytes[index..].starts_with(b"/*") {
                self.modes.push(Mode::Comment);
                index += 2;
            } else if bytes[index] == b'`' {
                self.modes.push(Mode::Template);
                index += 1;
            } else if matches!(bytes[index], b'"' | b'\'') {
                self.modes.push(Mode::Quote(bytes[index]));
                index += 1;
            } else if bytes[index] == b'@' {
                index += 1;
                if bytes.get(index) == Some(&b'@') {
                    index += 1;
                }
                let start = index;
                while index < bytes.len() && identifier_byte(bytes[index]) {
                    index += 1;
                }
                if index > start {
                    self.heredoc = Some(line[start..index].to_owned());
                    return;
                }
            } else {
                index += 1;
            }
        }
    }
}

pub(crate) fn identifier_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}

/// Keep byte positions while stripping comments and splicing physical lines.
/// A comment opened on a directive can extend its logical line across newlines.
pub fn logical_directive(source: &str) -> (String, usize) {
    let bytes = source.as_bytes();
    let mut output = Vec::new();
    let mut index = 0;
    let mut block = false;
    let mut quote = None;
    while index < bytes.len() {
        if block {
            if bytes[index..].starts_with(b"*/") {
                output.extend_from_slice(b"  ");
                index += 2;
                block = false;
            } else {
                output.push(b' ');
                index += 1;
            }
        } else if let Some(delimiter) = quote {
            output.push(bytes[index]);
            if bytes[index] == b'\\' && index + 1 < bytes.len() {
                index += 1;
                output.push(bytes[index]);
            } else if bytes[index] == delimiter {
                quote = None;
            }
            index += 1;
        } else if bytes[index..].starts_with(b"/*") {
            block = true;
            output.extend_from_slice(b"  ");
            index += 2;
        } else if bytes[index..].starts_with(b"//") {
            while index < bytes.len() && bytes[index] != b'\n' {
                output.push(b' ');
                index += 1;
            }
        } else if bytes[index] == b'\\'
            && (bytes.get(index + 1) == Some(&b'\n') || bytes[index + 1..].starts_with(b"\r\n"))
        {
            let length = if bytes.get(index + 1) == Some(&b'\r') {
                3
            } else {
                2
            };
            output.extend(std::iter::repeat_n(b' ', length));
            index += length;
        } else if bytes[index] == b'\n' {
            index += 1;
            break;
        } else {
            if matches!(bytes[index], b'"' | b'\'') {
                quote = Some(bytes[index]);
            }
            output.push(bytes[index]);
            index += 1;
        }
    }
    (
        String::from_utf8(output).expect("comment masking preserves UTF-8"),
        index,
    )
}
