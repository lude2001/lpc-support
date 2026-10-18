use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
enum Token {
    Number(i64, String),
    Word(String),
    Operator(String),
}

pub(crate) fn evaluate(
    source: &str,
    definitions: &HashMap<String, String>,
    efuns: &HashSet<String>,
) -> bool {
    let mut budget = 16_384;
    let tokens = expand(
        tokenize(source),
        definitions,
        efuns,
        &mut Vec::new(),
        &mut budget,
        0,
    );
    let mut parser = Expression {
        tokens: &tokens,
        index: 0,
        depth: 0,
    };
    let value = parser.conditional();
    parser.index == tokens.len() && value.unwrap_or(0) != 0
}

fn tokenize(source: &str) -> Vec<Token> {
    let bytes = source.as_bytes();
    let mut index = 0;
    let mut result = Vec::new();
    while index < bytes.len() {
        if bytes[index].is_ascii_whitespace() {
            index += 1;
            continue;
        }
        if bytes[index..].starts_with(b"//") {
            break;
        }
        if bytes[index..].starts_with(b"/*") {
            index += source[index + 2..]
                .find("*/")
                .map_or(bytes.len() - index, |end| end + 4);
            continue;
        }
        let start = index;
        if bytes[index].is_ascii_digit() {
            while index < bytes.len()
                && (bytes[index].is_ascii_alphanumeric() || bytes[index] == b'_')
            {
                index += 1;
            }
            let raw = source[start..index].replace('_', "");
            let (digits, radix) = if raw.starts_with("0x") || raw.starts_with("0X") {
                (&raw[2..], 16)
            } else if raw.starts_with("0b") || raw.starts_with("0B") {
                (&raw[2..], 2)
            } else {
                (raw.as_str(), 10)
            };
            result.push(Token::Number(
                u64::from_str_radix(digits, radix).unwrap_or(0) as i64,
                source[start..index].to_owned(),
            ));
        } else if bytes[index] == b'\'' {
            index += 1;
            let value = if bytes.get(index) == Some(&b'\\') {
                index += 1;
                let escaped = bytes.get(index).copied().unwrap_or(0);
                index += 1;
                match escaped {
                    b'n' => 10,
                    b'r' => 13,
                    b't' => 9,
                    b'b' => 8,
                    b'a' => 7,
                    b'f' => 12,
                    b'v' => 11,
                    b'x' => {
                        let first = index;
                        while index < bytes.len() && bytes[index].is_ascii_hexdigit() {
                            index += 1;
                        }
                        i64::from_str_radix(&source[first..index], 16).unwrap_or(0)
                    }
                    b'0'..=b'7' => {
                        let first = index - 1;
                        while index < bytes.len() && matches!(bytes[index], b'0'..=b'7') {
                            index += 1;
                        }
                        i64::from_str_radix(&source[first..index], 8).unwrap_or(0)
                    }
                    other => i64::from(other),
                }
            } else {
                let character = source[index..].chars().next().unwrap_or('\0');
                index = (index + character.len_utf8()).min(bytes.len());
                if character.is_ascii() {
                    character as i64
                } else {
                    0
                }
            };
            index = index.min(bytes.len());
            while !source.is_char_boundary(index) {
                index += 1;
            }
            if bytes.get(index) == Some(&b'\'') {
                index += 1;
            }
            result.push(Token::Number(value, source[start..index].to_owned()));
        } else if bytes[index].is_ascii_alphabetic() || bytes[index] == b'_' {
            index += 1;
            while index < bytes.len() && super::lexical::identifier_byte(bytes[index]) {
                index += 1;
            }
            result.push(Token::Word(source[start..index].to_owned()));
        } else {
            let length = ["||", "&&", "==", "!=", "<=", ">=", "<<", ">>", "##"]
                .iter()
                .find(|operator| source[index..].starts_with(**operator))
                .map_or(1, |_| 2);
            // Unknown non-ASCII bytes must not split a UTF-8 code point.
            let length = if bytes[index].is_ascii() {
                length
            } else {
                source[index..].chars().next().unwrap().len_utf8()
            };
            result.push(Token::Operator(source[index..index + length].to_owned()));
            index += length;
        }
    }
    result
}

fn op(token: Option<&Token>, value: &str) -> bool {
    matches!(token, Some(Token::Operator(operator)) if operator == value)
}

fn expand(
    tokens: Vec<Token>,
    definitions: &HashMap<String, String>,
    efuns: &HashSet<String>,
    stack: &mut Vec<String>,
    budget: &mut usize,
    depth: usize,
) -> Vec<Token> {
    if depth >= 64 {
        return vec![Token::Operator("<expansion-limit>".to_owned())];
    }
    let mut output = Vec::new();
    let mut index = 0;
    while index < tokens.len() && *budget > 0 {
        *budget -= 1;
        let Token::Word(name) = &tokens[index] else {
            output.push(tokens[index].clone());
            index += 1;
            continue;
        };
        if name == "defined" || name == "efun_defined" {
            index += 1;
            let parenthesized = op(tokens.get(index), "(");
            if parenthesized {
                index += 1;
            }
            let found = if let Some(Token::Word(operand)) = tokens.get(index) {
                if name == "defined" {
                    definitions.contains_key(operand)
                } else {
                    efuns.contains(operand)
                }
            } else {
                false
            };
            index += 1;
            if parenthesized && op(tokens.get(index), ")") {
                index += 1;
            }
            output.push(Token::Number(
                i64::from(found),
                i64::from(found).to_string(),
            ));
            continue;
        }
        let Some(value) = definitions
            .get(name)
            .filter(|_| stack.len() < 64 && !stack.contains(name))
        else {
            output.push(tokens[index].clone());
            index += 1;
            continue;
        };
        let mut replacement = tokenize(value);
        let mut consumed = 1;
        // Function macros are stored as `(parameters) replacement` by parse_define.
        if op(replacement.first(), "(")
            && op(tokens.get(index + 1), "(")
            && let Some(close) = replacement.iter().position(|token| op(Some(token), ")"))
        {
            let parameters = replacement[1..close]
                .iter()
                .filter_map(|token| {
                    if let Token::Word(name) = token {
                        Some(name.clone())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>();
            let valid_parameters = replacement[1..close]
                .iter()
                .all(|token| matches!(token, Token::Word(_)) || op(Some(token), ","));
            if valid_parameters
                && let Some((arguments, end)) = arguments(&tokens, index + 1)
                && arguments.len() == parameters.len()
            {
                let expanded_arguments = arguments
                    .iter()
                    .cloned()
                    .map(|argument| expand(argument, definitions, efuns, stack, budget, depth + 1))
                    .collect::<Vec<_>>();
                replacement = replacement[close + 1..]
                    .iter()
                    .enumerate()
                    .flat_map(|(index, token)| {
                        if let Token::Word(word) = token
                            && let Some(position) =
                                parameters.iter().position(|parameter| parameter == word)
                        {
                            let in_body = close + 1 + index;
                            let pasted = op(replacement.get(in_body - 1), "##")
                                || op(replacement.get(in_body + 1), "##");
                            return if pasted {
                                arguments[position].clone()
                            } else {
                                expanded_arguments[position].clone()
                            };
                        }
                        vec![token.clone()]
                    })
                    .collect();
                let mut pasted = Vec::new();
                let mut items = replacement.into_iter();
                while let Some(token) = items.next() {
                    if op(Some(&token), "##") {
                        if let (Some(left), Some(right)) = (pasted.pop(), items.next()) {
                            let spelling = |token: Token| match token {
                                Token::Number(_, raw) | Token::Word(raw) | Token::Operator(raw) => {
                                    raw
                                }
                            };
                            pasted.extend(tokenize(&(spelling(left) + &spelling(right))));
                        }
                    } else {
                        pasted.push(token);
                    }
                }
                replacement = pasted;
                consumed = end - index;
            }
        }
        stack.push(name.clone());
        output.extend(expand(
            replacement,
            definitions,
            efuns,
            stack,
            budget,
            depth + 1,
        ));
        stack.pop();
        index += consumed;
    }
    if index < tokens.len() {
        output.push(Token::Operator("<expansion-limit>".to_owned()));
    }
    output
}

fn arguments(tokens: &[Token], open: usize) -> Option<(Vec<Vec<Token>>, usize)> {
    let mut result = Vec::new();
    let mut current = Vec::new();
    let mut depth = 0;
    for (index, token) in tokens.iter().enumerate().skip(open + 1) {
        if op(Some(token), ")") && depth == 0 {
            if !current.is_empty() || !result.is_empty() {
                result.push(current);
            }
            return Some((result, index + 1));
        }
        if op(Some(token), ",") && depth == 0 {
            result.push(std::mem::take(&mut current));
            continue;
        }
        if op(Some(token), "(") {
            depth += 1;
        }
        if op(Some(token), ")") {
            depth -= 1;
        }
        current.push(token.clone());
    }
    None
}

struct Expression<'a> {
    tokens: &'a [Token],
    index: usize,
    depth: usize,
}
impl Expression<'_> {
    fn take(&mut self, value: &str) -> bool {
        if op(self.tokens.get(self.index), value) {
            self.index += 1;
            true
        } else {
            false
        }
    }
    fn conditional(&mut self) -> Option<i64> {
        if self.depth >= 128 {
            return None;
        }
        self.depth += 1;
        let condition = self.binary(1)?;
        let result = if self.take("?") {
            let yes = self.conditional()?;
            if !self.take(":") {
                return None;
            }
            let no = self.conditional()?;
            if condition != 0 { yes } else { no }
        } else {
            condition
        };
        self.depth -= 1;
        Some(result)
    }
    fn binary(&mut self, minimum: u8) -> Option<i64> {
        let mut left = self.unary()?;
        while let Some(Token::Operator(operator)) = self.tokens.get(self.index) {
            let precedence = precedence(operator);
            if precedence < minimum {
                break;
            }
            let operator = operator.clone();
            self.index += 1;
            let right = self.binary(precedence + 1)?;
            left = match operator.as_str() {
                "||" => i64::from(left != 0 || right != 0),
                "&&" => i64::from(left != 0 && right != 0),
                "|" => left | right,
                "^" => left ^ right,
                "&" => left & right,
                "==" => i64::from(left == right),
                "!=" => i64::from(left != right),
                "<" => i64::from(left < right),
                ">" => i64::from(left > right),
                "<=" => i64::from(left <= right),
                ">=" => i64::from(left >= right),
                "<<" => left.wrapping_shl((right & 63) as u32),
                ">>" => left.wrapping_shr((right & 63) as u32),
                "+" => left.wrapping_add(right),
                "-" => left.wrapping_sub(right),
                "*" => left.wrapping_mul(right),
                "/" => left.checked_div(right).unwrap_or(0),
                "%" => left.checked_rem(right).unwrap_or(0),
                _ => return None,
            };
        }
        Some(left)
    }
    fn unary(&mut self) -> Option<i64> {
        if self.depth >= 128 {
            return None;
        }
        self.depth += 1;
        let value = if self.take("!") {
            i64::from(self.unary()? == 0)
        } else if self.take("~") {
            !self.unary()?
        } else if self.take("-") {
            self.unary()?.wrapping_neg()
        } else if self.take("+") {
            self.unary()?
        } else if self.take("(") {
            let value = self.conditional()?;
            if !self.take(")") {
                return None;
            }
            value
        } else {
            let token = self.tokens.get(self.index)?;
            self.index += 1;
            match token {
                Token::Number(value, _) => *value,
                Token::Word(_) => 0,
                _ => return None,
            }
        };
        self.depth -= 1;
        Some(value)
    }
}
fn precedence(operator: &str) -> u8 {
    match operator {
        "||" => 1,
        "&&" => 2,
        "|" => 3,
        "^" => 4,
        "&" => 5,
        "==" | "!=" => 6,
        "<" | ">" | "<=" | ">=" => 7,
        "<<" | ">>" => 8,
        "+" | "-" => 9,
        "*" | "/" | "%" => 10,
        _ => 0,
    }
}
