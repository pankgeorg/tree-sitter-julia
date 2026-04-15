#include "tree_sitter/parser.h"

/// Block comments and immediate parentheses are easy to parse, but strings
/// require extra-attention.
///
/// The main problems that arise when parsing strings are:
/// 1. Triple quoted strings allow single quotes inside. e.g. """ "foo" """.
/// 2. Strings can have arbitrary interpolations, including other strings.
///    e.g. "echo $("foo")"
/// 3. Non-standard string literals don't allow interpolations or escape
///    sequences, but you can always write \" and \`.
/// All of the above also applies to command literals.
enum TokenType {
    BLOCK_COMMENT_REST,
    IMMEDIATE_PAREN,
    IMMEDIATE_BRACKET,
    IMMEDIATE_BRACE,
    IMMEDIATE_STRING_START,
    IMMEDIATE_COMMAND_START,
    CONTENT_CMD_1,
    CONTENT_CMD_1_RAW,
    CONTENT_CMD_3,
    CONTENT_CMD_3_RAW,
    CONTENT_STR_1,
    CONTENT_STR_1_RAW,
    CONTENT_STR_3,
    CONTENT_STR_3_RAW,
    END_CMD,
    END_STR,
    IMPORT_FROM_CURRENT_MODULE,
    BINARY_TILDE,
    EMOJI_IDENTIFIER,
};

void *tree_sitter_julia_external_scanner_create() {
    return NULL;
}

void tree_sitter_julia_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_julia_external_scanner_serialize(void *payload, char *buffer) { return 0; }

void tree_sitter_julia_external_scanner_deserialize(void *payload, const char *buffer, unsigned size) {}

// Scanner functions

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static void mark_end(TSLexer *lexer) { lexer->mark_end(lexer); }

static bool scan_content(TSLexer *lexer, TSSymbol content_symbol, char end_char, unsigned n_delim, bool interp) {
    TSSymbol end_symbol = (end_char == '"') ? END_STR : END_CMD;
    bool has_content = false;
    int32_t next;
    while ((next = lexer->lookahead)) {
        mark_end(lexer);
        if (interp && (next == '$' || next == '\\')) {
            lexer->result_symbol = content_symbol;
            return has_content;
        } else if (next == '\\') {
            // Parse backslash in raw strings (check escaped delimiters and '\\')
            advance(lexer);
            next = lexer->lookahead;
            if (next == end_char || next == '\\') {
                lexer->result_symbol = content_symbol;
                return has_content;
            }
        } else {
            bool is_end_delimiter = true;
            for (unsigned i = 1; i <= n_delim; i++) {
                if (lexer->lookahead == end_char) {
                    advance(lexer);
                } else {
                    is_end_delimiter = false;
                    break;
                }
            }
            if (is_end_delimiter) {
                if (has_content) {
                    lexer->result_symbol = content_symbol;
                    return true;
                } else {
                    mark_end(lexer);
                    lexer->result_symbol = end_symbol;
                    return true;
                }
            }
        }
        advance(lexer);
        has_content = true;
    }
    return false;
}

static bool scan_block_comment(TSLexer *lexer) {
    // NOTE: The first `#=` is scanned by tree-sitter
    bool after_eq = false;
    unsigned nesting_depth = 1;
    for (;;) {
        switch (lexer->lookahead) {
            case '=':
                advance(lexer);
                after_eq = true;
                break;
            case '#':
                advance(lexer);
                if (after_eq) {
                    after_eq = false;
                    nesting_depth--;
                    if (nesting_depth == 0) {
                        lexer->result_symbol = BLOCK_COMMENT_REST;
                        return true;
                    }
                } else {
                    after_eq = false;
                    if (lexer->lookahead == '=') {
                        advance(lexer);
                        nesting_depth++;
                    }
                }
                break;
            case '\0':
                return false;
            default:
                advance(lexer);
                after_eq = false;
                break;
        }
    }
}

static void skip_whitespace(TSLexer *lexer) {
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
           lexer->lookahead == '\n' || lexer->lookahead == '\r') {
        lexer->advance(lexer, true); // true = skip (mark as whitespace)
    }
}

// Matches ~ or .~ as a BINARY operator, using whitespace sensitivity.
// Julia rule: ~ is unary (prefix) ONLY when preceded by space and followed
// by no space (e.g., `a ~b` is hcat(a, ~b)). In all other cases, ~ is binary:
//   a ~ b  → binary (space before AND after)
//   a~b    → binary (no space before)
//   a~ b   → binary (no space before)
//   a ~b   → unary  (space before, no space after) — DON'T match here
static bool scan_binary_tilde(TSLexer *lexer) {
    // Check for whitespace at current position (before ~).
    // External scanner is called at raw input, before extras consumption.
    // Only check spaces/tabs, NOT newlines (newlines are statement terminators).
    bool has_space_before = (lexer->lookahead == ' ' || lexer->lookahead == '\t');

    // Skip spaces/tabs before the tilde (not newlines — those are terminators)
    while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
        lexer->advance(lexer, true);
    }

    // If we hit a newline, don't consume it — let tree-sitter handle it
    if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
        return false;
    }

    // Check for optional . (broadcast tilde .~)
    if (lexer->lookahead == '.') {
        lexer->advance(lexer, false);
        // .~ is always binary (broadcast operator), no whitespace sensitivity
        if (lexer->lookahead != '~') return false;
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        lexer->result_symbol = BINARY_TILDE;
        return true;
    }

    // Must be ~
    if (lexer->lookahead != '~') return false;
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);

    // Check for whitespace after ~
    bool has_space_after = (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
                            lexer->lookahead == '\n' || lexer->lookahead == '\r');

    // Julia rule: unary only when space before AND no space after
    if (has_space_before && !has_space_after) {
        return false;  // This is unary — don't match as binary
    }

    lexer->result_symbol = BINARY_TILDE;
    return true;
}

// Check if a codepoint is a valid Julia identifier character (SMP So symbols).
// BMP So is handled in the grammar regex; this covers supplementary plane emoji.
static bool is_smp_so_identifier(uint32_t cp) {
    return (cp >= 0x1F000 && cp <= 0x1F02B) ||  // Mahjong Tiles
           (cp >= 0x1F030 && cp <= 0x1F093) ||  // Domino Tiles
           (cp >= 0x1F0A0 && cp <= 0x1F0F5) ||  // Playing Cards
           (cp >= 0x1F10D && cp <= 0x1F1AD) ||  // Enclosed Alphanumeric Supp
           (cp >= 0x1F1E6 && cp <= 0x1F202) ||  // Regional Indicators + Enclosed CJK
           (cp >= 0x1F210 && cp <= 0x1F23B) ||  // Enclosed CJK contd
           (cp >= 0x1F240 && cp <= 0x1F248) ||
           (cp >= 0x1F250 && cp <= 0x1F251) ||
           (cp >= 0x1F260 && cp <= 0x1F265) ||
           (cp >= 0x1F300 && cp <= 0x1F3FA) ||  // Misc Symbols & Pictographs
           (cp >= 0x1F400 && cp <= 0x1F6D7) ||  // Misc Symbols & Pictographs + Emoticons + Transport
           (cp >= 0x1F6DC && cp <= 0x1F6EC) ||
           (cp >= 0x1F6F0 && cp <= 0x1F6FC) ||
           (cp >= 0x1F700 && cp <= 0x1F776) ||  // Alchemical Symbols
           (cp >= 0x1F77B && cp <= 0x1F7D9) ||
           (cp >= 0x1F7E0 && cp <= 0x1F7EB) ||
           (cp >= 0x1F7F0 && cp <= 0x1F7F0) ||
           (cp >= 0x1F800 && cp <= 0x1F80B) ||  // Supplemental Arrows-C
           (cp >= 0x1F810 && cp <= 0x1F847) ||
           (cp >= 0x1F850 && cp <= 0x1F859) ||
           (cp >= 0x1F860 && cp <= 0x1F887) ||
           (cp >= 0x1F890 && cp <= 0x1F8AD) ||
           (cp >= 0x1F8B0 && cp <= 0x1F8BB) ||
           (cp >= 0x1F8C0 && cp <= 0x1F8C1) ||
           (cp >= 0x1F900 && cp <= 0x1FA53) ||  // Supplemental Symbols & Pictographs
           (cp >= 0x1FA60 && cp <= 0x1FA6D) ||
           (cp >= 0x1FA70 && cp <= 0x1FA7C) ||  // Symbols Extended-A
           (cp >= 0x1FA80 && cp <= 0x1FA89) ||
           (cp >= 0x1FA8F && cp <= 0x1FAC6) ||
           (cp >= 0x1FACE && cp <= 0x1FADC) ||
           (cp >= 0x1FADF && cp <= 0x1FAE9) ||
           (cp >= 0x1FAF0 && cp <= 0x1FAF8);
}

// Scan an emoji identifier (SMP codepoints that are valid Julia identifiers).
// These can't be in the grammar regex because JS RegExp doesn't support
// supplementary plane characters without the 'u' flag.
static bool scan_emoji_identifier(TSLexer *lexer) {
    if (!is_smp_so_identifier(lexer->lookahead)) return false;

    // Consume the first emoji character
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);

    // Continue consuming valid identifier characters (emoji or BMP)
    // Julia allows mixing: 😄x is a valid identifier
    while (lexer->lookahead != 0) {
        uint32_t cp = lexer->lookahead;
        if (is_smp_so_identifier(cp)) {
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);
            continue;
        }
        // Also accept XID_Continue characters (letters, digits, combining marks)
        // These are handled by the grammar regex for normal identifiers,
        // but we need them here for emoji continuation (e.g., 😄x, x😄2)
        if ((cp >= 'a' && cp <= 'z') || (cp >= 'A' && cp <= 'Z') ||
            (cp >= '0' && cp <= '9') || cp == '_' || cp == '!' ||
            // Common Unicode identifier chars
            (cp >= 0x00C0 && cp <= 0x024F) || // Latin Extended
            (cp >= 0x0370 && cp <= 0x03FF) || // Greek
            (cp >= 0x0400 && cp <= 0x04FF) || // Cyrillic
            (cp >= 0x2600 && cp <= 0x27BF))   // BMP So (already in grammar)
        {
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);
            continue;
        }
        break;
    }

    lexer->result_symbol = EMOJI_IDENTIFIER;
    return true;
}

static bool scan_import_from_current_module(TSLexer *lexer) {
    skip_whitespace(lexer);
    if (lexer->lookahead != '.') return false;
    advance(lexer);
    mark_end(lexer);
    for (;;) {
        // Skip spaces/tabs between dots (not newlines)
        while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
            advance(lexer);
        }
        if (lexer->lookahead == '.') {
            advance(lexer);
            mark_end(lexer);
        } else {
            break;
        }
    }
    lexer->result_symbol = IMPORT_FROM_CURRENT_MODULE;
    return true;
}

bool tree_sitter_julia_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    if (valid_symbols[IMMEDIATE_PAREN] && lexer->lookahead == '(') {
        lexer->result_symbol = IMMEDIATE_PAREN;
        return true;
    } else if (valid_symbols[IMMEDIATE_BRACKET] && lexer->lookahead == '[') {
        lexer->result_symbol = IMMEDIATE_BRACKET;
        return true;
    } else if (valid_symbols[IMMEDIATE_BRACE] && lexer->lookahead == '{') {
        lexer->result_symbol = IMMEDIATE_BRACE;
        return true;
    } else if (valid_symbols[IMMEDIATE_STRING_START] && lexer->lookahead == '"') {
        lexer->result_symbol = IMMEDIATE_STRING_START;
        return true;
    } else if (valid_symbols[IMMEDIATE_COMMAND_START] && lexer->lookahead == '`') {
        lexer->result_symbol = IMMEDIATE_COMMAND_START;
        return true;
    }

    if (valid_symbols[EMOJI_IDENTIFIER] && scan_emoji_identifier(lexer)) {
        return true;
    }

    if (valid_symbols[BINARY_TILDE] && scan_binary_tilde(lexer)) {
        return true;
    }

    if (valid_symbols[IMPORT_FROM_CURRENT_MODULE] && scan_import_from_current_module(lexer)) {
        return true;
    }

    if (valid_symbols[BLOCK_COMMENT_REST] && scan_block_comment(lexer)) {
        return true;
    }

    if (valid_symbols[CONTENT_STR_1] && scan_content(lexer, CONTENT_STR_1, '"', 1, true)) {
        return true;
    }

    if (valid_symbols[CONTENT_STR_3] && scan_content(lexer, CONTENT_STR_3, '"', 3, true)) {
        return true;
    }

    if (valid_symbols[CONTENT_CMD_1] && scan_content(lexer, CONTENT_CMD_1, '`', 1, true)) {
        return true;
    }

    if (valid_symbols[CONTENT_CMD_3] && scan_content(lexer, CONTENT_CMD_3, '`', 3, true)) {
        return true;
    }

    if (valid_symbols[CONTENT_STR_1_RAW] && scan_content(lexer, CONTENT_STR_1_RAW, '"', 1, false)) {
        return true;
    }

    if (valid_symbols[CONTENT_STR_3_RAW] && scan_content(lexer, CONTENT_STR_3_RAW, '"', 3, false)) {
        return true;
    }

    if (valid_symbols[CONTENT_CMD_1_RAW] && scan_content(lexer, CONTENT_CMD_1_RAW, '`', 1, false)) {
        return true;
    }

    if (valid_symbols[CONTENT_CMD_3_RAW] && scan_content(lexer, CONTENT_CMD_3_RAW, '`', 3, false)) {
        return true;
    }

    return false;
}
