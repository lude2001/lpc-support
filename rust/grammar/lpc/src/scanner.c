#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

enum TokenType {
    HEREDOC_LITERAL,
    MACRO_IDENTIFIER,
    TRAILING_DOT_FLOAT,
    TYPE_IDENTIFIER,
};

void *tree_sitter_lpc_external_scanner_create(void) {
    return NULL;
}

void tree_sitter_lpc_external_scanner_destroy(void *payload) {
    (void)payload;
}

unsigned tree_sitter_lpc_external_scanner_serialize(void *payload, char *buffer) {
    (void)payload;
    (void)buffer;
    return 0;
}

void tree_sitter_lpc_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    (void)payload;
    (void)buffer;
    (void)length;
}

static bool is_identifier_character(int32_t character) {
    return character == '_' || (character >= '0' && character <= '9') ||
        (character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z');
}

static bool is_reserved_word(const char *word) {
    static const char *words[] = {
        "int", "float", "string", "object", "mixed", "mapping", "function", "buffer", "void",
        "array", "closure", "class", "struct", "promise", "__TREE__", "async", "await", "acatch",
        "private", "public", "protected", "varargs", "nosave", "static", "nomask", "ref",
        "if", "else", "while", "do", "for", "foreach", "in", "switch", "case", "default",
        "return", "break", "continue", "new", "catch", "time_expression", "inherit", "include", "efun"
    };
    for (unsigned i = 0; i < sizeof(words) / sizeof(words[0]); i++) {
        if (strcmp(word, words[i]) == 0) { return true; }
    }
    return false;
}

bool tree_sitter_lpc_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
    (void)payload;
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' ||
           lexer->lookahead == '\n') {
        lexer->advance(lexer, true);
    }
    if (valid_symbols[TRAILING_DOT_FLOAT] && lexer->lookahead >= '0' && lexer->lookahead <= '9') {
        while ((lexer->lookahead >= '0' && lexer->lookahead <= '9') || lexer->lookahead == '_') {
            lexer->advance(lexer, false);
        }
        if (lexer->lookahead != '.') { return false; }
        lexer->advance(lexer, false);
        if (lexer->lookahead == '.' || is_identifier_character(lexer->lookahead)) { return false; }
        lexer->mark_end(lexer);
        lexer->result_symbol = TRAILING_DOT_FLOAT;
        return true;
    }
    if ((valid_symbols[MACRO_IDENTIFIER] || valid_symbols[TYPE_IDENTIFIER]) &&
        (lexer->lookahead == '_' || (lexer->lookahead >= 'a' && lexer->lookahead <= 'z') ||
         (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z'))) {
        bool has_letter = false;
        bool uppercase = true;
        char word[128];
        unsigned word_length = 0;
        while (is_identifier_character(lexer->lookahead)) {
            if (word_length + 1 < sizeof(word)) { word[word_length++] = (char)lexer->lookahead; }
            has_letter = has_letter ||
                (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z');
            if (lexer->lookahead >= 'a' && lexer->lookahead <= 'z') { uppercase = false; }
            lexer->advance(lexer, false);
        }
        lexer->mark_end(lexer);
        word[word_length] = '\0';
        if (valid_symbols[MACRO_IDENTIFIER] && uppercase && has_letter && lexer->lookahead == '(') {
            lexer->result_symbol = MACRO_IDENTIFIER;
            return true;
        }
        if (valid_symbols[TYPE_IDENTIFIER] && !is_reserved_word(word)) {
            while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' || lexer->lookahead == '\n' || lexer->lookahead == '*') {
                lexer->advance(lexer, false);
            }
            if (lexer->lookahead == '_' || (lexer->lookahead >= 'A' && lexer->lookahead <= 'Z') ||
                (lexer->lookahead >= 'a' && lexer->lookahead <= 'z')) {
                word_length = 0;
                while (is_identifier_character(lexer->lookahead)) {
                    if (word_length + 1 < sizeof(word)) { word[word_length++] = (char)lexer->lookahead; }
                    lexer->advance(lexer, false);
                }
                word[word_length] = '\0';
                if (is_reserved_word(word)) { return false; }
                while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' || lexer->lookahead == '\n') {
                    lexer->advance(lexer, false);
                }
                if (lexer->lookahead == '(' || lexer->lookahead == ')' || lexer->lookahead == '=' ||
                    lexer->lookahead == ',' || lexer->lookahead == ';') {
                    lexer->result_symbol = TYPE_IDENTIFIER;
                    return true;
                }
            }
        }
        return false;
    }
    if (!valid_symbols[HEREDOC_LITERAL]) {
        return false;
    }
    if (lexer->lookahead != '@') {
        return false;
    }

    lexer->advance(lexer, false);
    if (lexer->lookahead == '@') {
        lexer->advance(lexer, false);
    }
    char delimiter[128];
    unsigned delimiter_length = 0;
    while (is_identifier_character(lexer->lookahead)) {
        if (delimiter_length + 1 >= sizeof(delimiter)) {
            return false;
        }
        delimiter[delimiter_length++] = (char)lexer->lookahead;
        lexer->advance(lexer, false);
    }
    if (delimiter_length == 0) {
        return false;
    }
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
        lexer->advance(lexer, false);
    }
    if (lexer->lookahead == '\r') {
        lexer->advance(lexer, false);
    }
    if (lexer->lookahead != '\n') {
        return false;
    }
    lexer->advance(lexer, false);

    bool line_start = true;
    unsigned matched = 0;
    while (!lexer->eof(lexer)) {
        if (line_start && matched < delimiter_length && lexer->lookahead == delimiter[matched]) {
            matched++;
            lexer->advance(lexer, false);
            if (matched == delimiter_length) {
                lexer->mark_end(lexer);
                if (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
                    lexer->lookahead == ';' || lexer->lookahead == ')' ||
                    lexer->lookahead == ']' || lexer->lookahead == '}' ||
                    lexer->lookahead == ',' || lexer->lookahead == '\r' ||
                    lexer->lookahead == '\n') {
                    lexer->result_symbol = HEREDOC_LITERAL;
                    return true;
                }
            }
            continue;
        }
        if (matched > 0) {
            matched = 0;
            line_start = false;
        }
        line_start = lexer->lookahead == '\n';
        lexer->advance(lexer, false);
    }
    return false;
}
