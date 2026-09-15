#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

enum TokenType {
    HEREDOC_LITERAL,
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

bool tree_sitter_lpc_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
    (void)payload;
    if (!valid_symbols[HEREDOC_LITERAL]) {
        return false;
    }
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r' ||
           lexer->lookahead == '\n') {
        lexer->advance(lexer, true);
    }
    if (lexer->lookahead != '@') {
        return false;
    }

    lexer->advance(lexer, false);
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
                while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
                    lexer->advance(lexer, true);
                }
                if (lexer->lookahead == ';' || lexer->lookahead == ')' ||
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
